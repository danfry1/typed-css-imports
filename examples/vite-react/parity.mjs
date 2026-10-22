// Parity check: the names Vite exports at runtime for a CSS module vs the names typed-css-imports types.
// Usage: node parity.mjs [list-of-absolute-paths.txt]  (default: this example's src/ and the package's test fixture)
import { createServer } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportedNames } from "typed-css-imports/transform";

const here = fileURLToPath(new URL(".", import.meta.url));
const files = process.argv[2]
  ? readFileSync(process.argv[2], "utf8").trim().split("\n").filter(Boolean)
  : [...readdirSync(here + "src").filter((f) => f.endsWith(".module.css")).map((f) => here + "src/" + f), fileURLToPath(new URL("../../test/button.module.css", import.meta.url))];
const localsConvention = "camelCase";
const vite = await createServer({ root: here, configFile: false, logLevel: "silent", appType: "custom", server: { middlewareMode: true, fs: { strict: false } }, css: { modules: { localsConvention } } });
let same = 0; const diffs = [], errors = [];
for (const file of files) {
  let runtime;
  try { runtime = Object.keys((await vite.ssrLoadModule("/@fs" + file)).default ?? {}); }
  catch (e) { errors.push(`${file}: vite: ${e.message.split("\n")[0].slice(0, 120)}`); continue; }
  const typed = await exportedNames(readFileSync(file, "utf8"), { fileName: file, localsConvention });
  const missing = runtime.filter((n) => !typed.includes(n)), extra = typed.filter((n) => !runtime.includes(n));
  if (missing.length || extra.length) diffs.push({ file: file.replace(/.*node_modules\//, ""), missingFromTypes: missing, extraInTypes: extra });
  else same++;
}
await vite.close();
console.log(JSON.stringify({ files: files.length, same, differ: diffs.length, viteErrors: errors.length }));
for (const d of diffs.slice(0, 15)) console.log(JSON.stringify(d));
for (const e of errors.slice(0, 5)) console.log(e);
process.exit(diffs.length ? 1 : 0);
