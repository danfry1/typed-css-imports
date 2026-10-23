// Exported names for the CSS Modules cases bundlers handle (via postcss-modules), Sass modules, and syntax errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { exportedNames, transform, SassError } from "../src/transform.js";

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
  assert.equal(await transform(".a { } .b-c { }"), 'declare const styles: {\n  readonly "a": string;\n  readonly "b-c": string;\n};\nexport default styles;\n');
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
