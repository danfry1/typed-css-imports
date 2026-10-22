// Exported names for the CSS Modules cases bundlers handle (via postcss-modules), and CSS syntax errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exportedNames, transform } from "../src/transform.js";

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
