// CSS module source -> TS module text that types its default export: one readonly string per exported name.
// Names come from postcss-modules (the plugin Vite uses), so they match what the bundler exports at runtime:
// classes, ids, keyframes and @value names, with `localsConvention` applied.
// `.module.scss` and `.module.sass` are compiled with the project's Sass first, as bundlers do, so classes generated
// by mixins and loops are included.
// mappedTransform also maps each name in the TS text back to where the module declares it, so the language server
// can go to definition, find references and rename across the TS and CSS files.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postcss, { type AtRule } from "postcss";
import postcssModules from "postcss-modules";
import selectorParser from "postcss-selector-parser";
import { SourceMapConsumer } from "source-map-js";

// `composes: x from "./other.css"` changes values, never keys, so imported files are not read: type-checking a
// CSS file never touches the filesystem. (Sass `@use` and `@import` do read files: they can add classes.)
class NoFileLoader {
  async fetch() { return {}; }
}

export interface SassOptions {
  /** Extra directories for `@use`/`@import`, relative to the tsconfig.json. */
  loadPaths?: string[];
  /** Prepended to every Sass module, like Vite's `css.preprocessorOptions.scss.additionalData`. */
  additionalData?: string;
}

export interface Options {
  /** Path of the CSS file; used in error messages and to resolve Sass imports. */
  fileName?: string;
  /** Same as the bundler's setting. */
  localsConvention?: "camelCase" | "camelCaseOnly" | "dashes" | "dashesOnly";
  /** Options for `.module.scss` and `.module.sass` files. */
  sass?: SassOptions;
  /** tsconfig.json the options came from; relative `sass.loadPaths` resolve against it. */
  configFileName?: string;
}

/** A Sass compile error, with its offset in the module's own source when it is in that file. */
export class SassError extends Error {
  readonly offset: number | undefined;
  constructor(message: string, offset: number | undefined) {
    super(message);
    this.name = "SassError";
    this.offset = offset;
  }
}

// The project's own Sass, resolved from the module's directory, so types match what its bundler compiles. Like Vite,
// sass-embedded is preferred when both are installed. It is the project's dependency, not ours, so it is untyped here.
const sassByPath = new Map<string, Promise<any>>();
function loadSass(fileName: string): Promise<any> {
  const require = createRequire(resolve(fileName));
  for (const name of ["sass-embedded", "sass"]) {
    let path;
    try { path = require.resolve(name); } catch { continue; }
    let sass = sassByPath.get(path);
    // require.resolve finds the CommonJS entry, whose exports are all on `default` when imported.
    if (!sass) sassByPath.set(path, sass = import(pathToFileURL(path).href).then((m) => m.default ?? m));
    return sass;
  }
  throw new SassError(`${fileName} needs the "sass" package to compile. Install it in the project (e.g. pnpm add -D sass).`, undefined);
}

async function compileSass(source: string, { fileName, sass: { loadPaths = [], additionalData = "" } = {}, configFileName }: Options & { fileName: string }) {
  const sass = await loadSass(fileName);
  const url = pathToFileURL(resolve(fileName));
  const base = configFileName ? dirname(configFileName) : dirname(resolve(fileName));
  try {
    const result = await sass.compileStringAsync(additionalData + source, {
      url,
      syntax: fileName.endsWith(".sass") ? "indented" : "scss",
      loadPaths: loadPaths.map((p) => resolve(base, p)),
      importers: [new sass.NodePackageImporter(dirname(resolve(fileName)))],
      logger: sass.Logger.silent,
      sourceMap: true,
    });
    return { css: result.css as string, map: new SourceMapConsumer(result.sourceMap), url: url.href, input: additionalData + source, prefixLength: additionalData.length };
  } catch (e) {
    const err = e as any;
    if (!err?.sassMessage) throw e;
    // Errors inside the module itself point at their position (minus any additionalData); errors in imported files or
    // in additionalData are reported at the start of the module, with the file and line in the message.
    const span = err.span;
    const inThisFile = span?.url?.href === url.href && span.start.offset >= additionalData.length;
    const where = inThisFile || !span?.url ? "" : ` (${span.url.protocol === "file:" ? span.url.pathname : span.url.href}:${span.start.line + 1})`;
    throw new SassError(`Sass: ${err.sassMessage}${where}`, inThisFile ? span.start.offset - additionalData.length : undefined);
  }
}

/**
 * The module's exports, keyed by exported name with the local name it was declared as (they differ under
 * `localsConvention`), plus the CSS postcss-modules read and, for Sass, the map from that CSS back to the source.
 */
async function analyze(source: string, options: Options) {
  const { fileName = "input.module.css", localsConvention } = options;
  const sass = /\.s[ac]ss$/.test(fileName) ? await compileSass(source, { ...options, fileName }) : undefined;
  const css = sass?.css ?? source;
  let json: Record<string, string> = {};
  // Scoped names are the local names unchanged, so each value is the local name (a class with `composes` adds the
  // composed names). The exported keys don't depend on it.
  await postcss([postcssModules({ getJSON: (_, j) => { json = j; }, Loader: NoFileLoader, localsConvention, generateScopedName: (name) => name })])
    .process(css, { from: fileName });
  return { json, css, sass };
}

export async function exportedNames(css: string, options: Options = {}): Promise<string[]> {
  return Object.keys((await analyze(css, options)).json);
}

// The fields of postcss-selector-parser's nodes used below. (Its own declarations fail TypeScript 7's circularity check.)
interface SelectorNode { type: string; value: string; sourceIndex: number; raws?: { value?: string }; nodes: SelectorNode[] }
const parseSelectors = selectorParser as unknown as (transform: (root: { nodes: SelectorNode[] }) => void) => { processSync(selector: string): unknown };

interface Declaration { name: string; start: number; length: number; value?: boolean }

/**
 * Where `css` declares each local name: classes and ids in selectors (not inside `:global`), `@keyframes` names and
 * `@value` names (marked `value`), in source order. `length` is the name's length as written, which differs from the
 * name when it has escapes (`.sm\:p-4`).
 */
function declarations(css: string): Declaration[] {
  const found: Declaration[] = [];
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) return;
    const start = rule.source?.start?.offset;
    if (start === undefined) return;
    const visit = (selector: SelectorNode, global: boolean) => {
      let isGlobal = global;
      for (const node of selector.nodes) {
        if (node.type === "pseudo" && (node.value === ":global" || node.value === ":local")) {
          // `:global(.x)` scopes its argument; a bare `:global` switches the rest of the selector, as in postcss-modules.
          if (node.nodes.length) for (const s of node.nodes) visit(s, node.value === ":global");
          else isGlobal = node.value === ":global";
        } else if ((node.type === "class" || node.type === "id") && !isGlobal) {
          found.push({ name: node.value, start: start + node.sourceIndex + 1, length: (node.raws?.value ?? node.value).length });
        } else if (node.type === "pseudo") {
          for (const s of node.nodes) visit(s, isGlobal);
        }
      }
    };
    const raw = (rule.raws.selector as { raw?: string } | undefined)?.raw ?? rule.selector;
    parseSelectors((root) => { for (const s of root.nodes) visit(s, false); }).processSync(raw);
  });
  root.walkAtRules((at) => {
    const start = at.source?.start?.offset;
    if (start === undefined) return;
    const paramsStart = start + 1 + at.name.length + (at.raws.afterName ?? "").length;
    if (/keyframes$/i.test(at.name) && /^[\w-]+$/.test(at.params)) found.push({ name: at.params, start: paramsStart, length: at.params.length });
    if (at.name === "value") {
      // `@value name: value` declares one name; `@value a, b as c from "./x"` declares a and c.
      const definition = /^([\w-]+)\s*:/.exec(at.params);
      if (definition) found.push({ name: definition[1], start: paramsStart, length: definition[1].length, value: true });
      else {
        const imports = /^(.*?)\s+from\s/.exec(at.params)?.[1] ?? "";
        for (const m of imports.matchAll(/([\w-]+)(?:\s+as\s+([\w-]+))?/g)) {
          const name = m[2] ?? m[1];
          found.push({ name, start: paramsStart + m.index + m[0].length - name.length, length: name.length, value: true });
        }
      }
    }
  });
  return found.sort((a, b) => a.start - b.start);
}

const lineStarts = (text: string) => [0, ...[...text.matchAll(/\n/g)].map((m) => m.index + 1)];

// Span-map segment kinds and the language-service features a segment allows (TypeScript's spanmap package).
const VERBATIM = 0, ATOM = 1, ALIAS = 2;
const ALL_FEATURES = (1 << 20) - 1, RENAME = 1 << 8;

interface Located { start: number; length: number; exact: boolean }

/**
 * Where in `source` the module declares `local`, as a span and whether it is the name exactly as written (so a
 * rename can edit it). For Sass, positions in the compiled CSS are mapped back through Sass's source map; a name
 * generated by `&` or `#{}` maps to that selector as a whole, and names from other files aren't mapped.
 */
function locator(source: string, { css, sass }: Awaited<ReturnType<typeof analyze>>) {
  const byName = new Map<string, Declaration[]>();
  const found = declarations(css);
  for (const d of found) byName.set(d.name, [...(byName.get(d.name) ?? []), d]);
  const cssLines = sass ? lineStarts(css) : [], inputLines = sass ? lineStarts(sass.input) : [];
  const values = new Set(found.filter((d) => d.value).map((d) => d.name));
  const locate = (local: string): Located | undefined => {
    for (const d of byName.get(local) ?? []) {
      if (!sass) return { start: d.start, length: d.length, exact: d.length === local.length };
      const line = cssLines.findLastIndex((start) => start <= d.start);
      const original = sass.map.originalPositionFor({ line: line + 1, column: d.start - cssLines[line], bias: SourceMapConsumer.GREATEST_LOWER_BOUND });
      if (original.source !== sass.url || original.line == null || original.column == null) continue;
      // The map's positions are in what Sass compiled: additionalData followed by the module.
      const offset = (inputLines[original.line - 1] ?? NaN) + original.column - sass.prefixLength;
      if (!(offset >= 0)) continue;
      // The selector as written at that position, including Sass interpolation (`.tone-#{$t}`).
      const token = /^(?:#\{[^}]*\}|[^\s{},>+~:;()])+/.exec(source.slice(offset))?.[0] ?? "";
      const name = token.replace(/^[.#]/, "");
      if (name === local) return { start: offset + token.length - name.length, length: name.length, exact: true };
      if (/[&]|#\{/.test(token)) {
        const lead = /^[.#]/.test(token) ? 1 : 0;
        return { start: offset + lead, length: token.length - lead, exact: false };
      }
    }
    return undefined;
  };
  return { locate, values };
}

export async function transform(css: string, options?: Options): Promise<string> {
  return (await mappedTransform(css, options)).text;
}

/**
 * The TS text plus a span map (TypeScript's `[virtualStart, virtualLength, originalStart, originalLength, kind,
 * features?]` tuples, in UTF-16 offsets) from each property name to its declaration in the module. A name kept as
 * written maps verbatim, so it can be renamed from either file. Quoted names (`"button-primary"`) and
 * `localsConvention` aliases (`buttonPrimary`) map as a whole, with go to definition and references but no rename,
 * which would have to rewrite text that differs between the two files.
 */
export async function mappedTransform(source: string, options: Options = {}): Promise<{ text: string; mappings: number[][] }> {
  const analysis = await analyze(source, options);
  const { locate, values } = locator(source, analysis);
  let text = "declare const styles: {\n";
  const mappings: number[][] = [];
  for (const [name, value] of Object.entries(analysis.json)) {
    const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
    // A class's or keyframes' value starts with its local name; an @value's value is its value, not a name.
    const local = values.has(name) ? name : value.split(" ")[0];
    const span = locate(local);
    const keyStart = text.length + "  readonly ".length;
    text += `  readonly ${key}: string;\n`;
    if (!span) continue;
    if (local === name && span.exact && key === name) mappings.push([keyStart, key.length, span.start, span.length, VERBATIM]);
    else mappings.push([keyStart, key.length, span.start, span.length, local === name ? ATOM : ALIAS, ALL_FEATURES & ~RENAME]);
  }
  text += "};\nexport default styles;\n";
  return { text, mappings };
}
