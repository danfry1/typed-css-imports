// Exported names for the CSS Modules cases bundlers handle (via postcss-modules), Sass modules, and syntax errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { exportedNames, mappedTransform, transform, SassError } from "../dist/transform.js";

const cases = [
  ["classes and pseudo selectors", ".g:is(.h, .i):not(.j) { } .k::after { content: \".notaclass\"; }", ["g", "h", "i", "j", "k"]],
  ["comments, strings and url() are ignored", "/* .x { } */ .a { background: url(\"b.c.png\"); }", ["a"]],
  ["ids", "#main { } .a { }", ["main", "a"]],
  ["keyframes (percent selectors are not classes)", "@keyframes spin { from { opacity: 0 } 50.5% { opacity: .5 } } .b { animation: spin 1s; }", ["b", "spin"]],
  ["@value", "@value primary: #f00; .c { color: primary; }", ["primary", "c"]],
  ["composes from another file (not read)", ".d { composes: base from \"./does-not-exist.css\"; }", ["d"]],
  ["escaped names", ".sm\\:p-4 { } .w-1\\/2 { }", ["sm:p-4", "w-1/2"]],
  ["native nesting", ".card { color: red; &.active { color: blue; } .title { } }", ["card", "active", "title"]],
  [":global is not exported", ":global(.gl) .loc { } :global .gl2 { }", ["loc"]],
  ["at-rules", "@media (min-width: 1px) { .m { } } @supports (display: grid) { .s { } } @layer base { .l { } }", ["m", "s", "l"]],
];
for (const [name, css, expected] of cases) {
  test(name, async () => assert.deepEqual(await exportedNames(css), expected));
}

test("localsConvention", async () => {
  const css = ".button-primary { } .icon--large { }";
  assert.deepEqual(await exportedNames(css, { localsConvention: "camelCase" }), ["button-primary", "buttonPrimary", "icon--large", "iconLarge"]);
  assert.deepEqual(await exportedNames(css, { localsConvention: "camelCaseOnly" }), ["buttonPrimary", "iconLarge"]);
});

test("transform output", async () => {
  assert.equal(await transform(".a { } .b-c { }"), 'declare const styles: {\n  readonly a: string;\n  readonly "b-c": string;\n};\nexport default styles;\n');
});

// Each mapping as [name in the TS text, text it points at in the module, kind, whether rename is allowed].
async function mapped(source, options) {
  const { text, mappings } = await mappedTransform(source, options);
  return mappings.map(([v, vl, o, ol, kind, features]) => [text.slice(v, v + vl), source.slice(o, o + ol), ["verbatim", "atom", "alias"][kind], features === undefined]);
}

test("mappings point each name at its declaration", async () => {
  const css = "/* .a { } */ .a { }\n.a:hover, .b-c { }\n#main { }\n@keyframes spin { from { } }\n@value brand: #0a7;\n:global(.g) .loc { }\n.sm\\:p-4 { }\n";
  const byName = (list) => [...list].sort((x, y) => (x[0] < y[0] ? -1 : 1));
  assert.deepEqual(byName(await mapped(css)), byName([
    ["a", "a", "verbatim", true],
    ['"b-c"', "b-c", "atom", false],
    ["main", "main", "verbatim", true],
    ["spin", "spin", "verbatim", true],
    ["brand", "brand", "verbatim", true],
    ["loc", "loc", "verbatim", true],
    ['"sm:p-4"', "sm\\:p-4", "atom", false],
  ]));
  // The first declaration is the target: the class after the comment, not the one inside it.
  const { text, mappings } = await mappedTransform(css);
  const a = mappings.find(([v, vl]) => text.slice(v, v + vl) === "a");
  assert.equal(a?.[2], css.indexOf(".a { }\n") + 1);
});

test("@value names map to themselves, whatever their value", async () => {
  assert.deepEqual(await mapped("@value brand: red;\n@value gap: 4px;\n.red { }\n"), [
    ["brand", "brand", "verbatim", true],
    ["gap", "gap", "verbatim", true],
    ["red", "red", "verbatim", true],
  ]);
});

test("mappings for localsConvention aliases", async () => {
  assert.deepEqual(await mapped(".button-primary { }", { localsConvention: "camelCase" }), [
    ['"button-primary"', "button-primary", "atom", false],
    ["buttonPrimary", "button-primary", "alias", false],
  ]);
});

test("Sass mappings: nesting and loops map to the selector, other files and additionalData aren't mapped", async () => {
  const scss = '@use "./layout";\n.card { color: red; &-title { color: blue; } }\n@each $t in info, warning { .tone-#{$t} { order: 1; } }\n';
  // `stack` comes from the _layout.scss partial, so it's typed but has no mapping into this file.
  assert.ok((await exportedNames(scss, { fileName: sassFile("x.module.scss") })).includes("stack"));
  assert.deepEqual(await mapped(scss, { fileName: sassFile("x.module.scss") }), [
    ["card", "card", "verbatim", true],
    ['"card-title"', "&-title", "atom", false],
    ['"tone-info"', "tone-#{$t}", "atom", false],
    ['"tone-warning"', "tone-#{$t}", "atom", false],
  ]);
  // Offsets are in the module, after additionalData; classes from additionalData itself aren't mapped.
  assert.deepEqual(await mapped(".plain { color: red; }\n", { fileName: sassFile("x.module.scss"), sass: { additionalData: "$x: 1;\n.extra { color: red; }\n" } }), [
    ["plain", "plain", "verbatim", true],
  ]);
  assert.deepEqual(await mapped(".list\n  &-item\n    color: red\n", { fileName: sassFile("x.module.sass") }), [['"list-item"', "&-item", "atom", false]]);
});

test("CSS syntax errors carry a position", async () => {
  await assert.rejects(exportedNames(".a { color: red;\n.b { "), (e) => e.name === "CssSyntaxError" && e.line > 0);
});

// Sass modules are compiled from the given text (the unsaved buffer), with imports resolved next to fileName.
const sassFile = (name) => fileURLToPath(new URL(name, import.meta.url));

test("Sass: nesting, mixins and loops, from unsaved text", async () => {
  const scss = '@use "./layout";\n.a { &-b { color: red; } }\n@each $n in x, y { .is-#{$n} { order: 1; } }\n.empty { }\n';
  // Like bundlers, which compile with Sass too, empty rules (.a, .empty) are dropped from the output.
  assert.deepEqual(await exportedNames(scss, { fileName: sassFile("unsaved.module.scss") }), ["stack", "a-b", "is-x", "is-y"]);
});

test("Sass: indented syntax", async () => {
  assert.deepEqual(await exportedNames(".list\n  &-item\n    color: red\n", { fileName: sassFile("x.module.sass") }), ["list-item"]);
});

test("Sass: loadPaths resolve against the tsconfig and additionalData is prepended", async () => {
  const options = { fileName: sassFile("x.module.scss"), configFileName: sassFile("tsconfig.json"), sass: { loadPaths: ["styles"], additionalData: '@use "tokens";\n' } };
  assert.deepEqual(await exportedNames("@include tokens.tone(ok);\n", options), ["tone-ok"]);
});

test("Sass errors carry an offset in the module, after additionalData", async () => {
  const source = ".a {\n  color: red\n  .b { }\n}\n";
  await assert.rejects(exportedNames(source, { fileName: sassFile("x.module.scss") }), (e) => e instanceof SassError && e.offset === source.indexOf(".b") + 1);
  const additionalData = "$x: 1;\n";
  await assert.rejects(exportedNames(source, { fileName: sassFile("x.module.scss"), sass: { additionalData } }), (e) => e instanceof SassError && e.offset === source.indexOf(".b") + 1);
});

test("Sass errors in imported files name the file and line", async () => {
  await assert.rejects(exportedNames('@use "./missing";\n', { fileName: sassFile("x.module.scss") }), (e) => e instanceof SassError && e.offset === 0 && /Can't find stylesheet/.test(e.message));
});
