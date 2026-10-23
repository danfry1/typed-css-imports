// CSS module source -> TS module text that types its default export: one readonly string per exported name.
// Names come from postcss-modules (the plugin Vite uses), so they match what the bundler exports at runtime:
// classes, ids, keyframes and @value names, with `localsConvention` applied.
// `.module.scss` and `.module.sass` are compiled with the project's Sass first, as bundlers do, so classes generated
// by mixins and loops are included.
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import postcssModules from "postcss-modules";

// `composes: x from "./other.css"` changes values, never keys, so imported files are not read: type-checking a
// CSS file never touches the filesystem. (Sass `@use` and `@import` do read files: they can add classes.)
class NoFileLoader {
  async fetch() { return {}; }
}

/**
 * @typedef {object} SassOptions
 * @property {string[]} [loadPaths] Extra directories for `@use`/`@import`, relative to the tsconfig.json.
 * @property {string} [additionalData] Prepended to every Sass module, like Vite's `css.preprocessorOptions.scss.additionalData`.
 */
/**
 * @typedef {object} Options
 * @property {string} [fileName] Path of the CSS file; used in error messages and to resolve Sass imports.
 * @property {"camelCase" | "camelCaseOnly" | "dashes" | "dashesOnly"} [localsConvention] Same as the bundler's setting.
 * @property {SassOptions} [sass] Options for `.module.scss` and `.module.sass` files.
 * @property {string} [configFileName] tsconfig.json the options came from; relative `sass.loadPaths` resolve against it.
 */

/** A Sass compile error, with its offset in the module's own source when it is in that file. */
export class SassError extends Error {
  /** @param {string} message @param {number | undefined} offset */
  constructor(message, offset) {
    super(message);
    this.name = "SassError";
    this.offset = offset;
  }
}

// The project's own Sass, resolved from the module's directory, so types match what its bundler compiles. Like Vite,
// sass-embedded is preferred when both are installed.
/** @type {Map<string, Promise<any>>} */
const sassByPath = new Map();
/** @param {string} fileName */
function loadSass(fileName) {
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

/** @param {string} source @param {Options & { fileName: string }} options */
async function compileSass(source, { fileName, sass: { loadPaths = [], additionalData = "" } = {}, configFileName }) {
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
    });
    return result.css;
  } catch (e) {
    const err = /** @type {any} */ (e);
    if (!err?.sassMessage) throw e;
    // Errors inside the module itself point at their position (minus any additionalData); errors in imported files or
    // in additionalData are reported at the start of the module, with the file and line in the message.
    const span = err.span;
    const inThisFile = span?.url?.href === url.href && span.start.offset >= additionalData.length;
    const where = inThisFile || !span?.url ? "" : ` (${span.url.protocol === "file:" ? span.url.pathname : span.url.href}:${span.start.line + 1})`;
    throw new SassError(`Sass: ${err.sassMessage}${where}`, inThisFile ? span.start.offset - additionalData.length : undefined);
  }
}

/** @param {string} css @param {Options} [options] @returns {Promise<string[]>} */
export async function exportedNames(css, options = {}) {
  const { fileName = "input.module.css", localsConvention } = options;
  if (/\.s[ac]ss$/.test(fileName)) css = await compileSass(css, { ...options, fileName });
  /** @type {Record<string, string>} */
  let names = {};
  await postcss([postcssModules({ getJSON: (_, json) => { names = json; }, Loader: NoFileLoader, localsConvention, generateScopedName: "[local]" })])
    .process(css, { from: fileName });
  return Object.keys(names);
}

/** @param {string} css @param {Options} [options] @returns {Promise<string>} */
export async function transform(css, options) {
  const names = await exportedNames(css, options);
  return `declare const styles: {\n${names.map((n) => `  readonly ${JSON.stringify(n)}: string;`).join("\n")}\n};\nexport default styles;\n`;
}
