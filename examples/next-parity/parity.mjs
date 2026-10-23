// Parity check against Next.js: the names Next.js exports at runtime for each CSS/Sass module vs the names
// typed-css-imports types. Copies the modules into fixtures/ (Turbopack only resolves relative imports), builds a
// generated page that renders Object.keys() of each, once with webpack (css-loader) and once with Turbopack
// (Lightning CSS), then reads the prerendered HTML.
// Next.js has no localsConvention option, so names are compared as written.
// Usage: node parity.mjs   (from examples/next-parity, after pnpm install)
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportedNames } from "typed-css-imports/transform";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
rmSync(here + "fixtures", { recursive: true, force: true });
cpSync(root + "examples/vite-react/src", here + "fixtures/vite-react", { recursive: true, filter: (f) => !/\.(tsx?)$/.test(f) });
cpSync(root + "test", here + "fixtures/test", { recursive: true, filter: (f) => !/\.(ts|mjs|sh|json)$/.test(f) });
// button.module.css has url("a.b.png"), which css-loader resolves; the file only needs to exist.
writeFileSync(here + "fixtures/test/a.b.png", Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex"));
const files = [
  ...readdirSync(here + "fixtures/vite-react").filter((f) => /\.module\.(css|scss|sass)$/.test(f)).map((f) => "fixtures/vite-react/" + f),
  ...["button.module.css", "card.module.scss", "list.module.sass"].map((f) => "fixtures/test/" + f),
];
// The test fixtures' Sass partials (`@use "tokens"`), for Next.js and the types alike.
const loadPaths = [here + "fixtures/test/styles"];

rmSync(here + "app", { recursive: true, force: true });
mkdirSync(here + "app");
writeFileSync(here + "next.config.mjs", `export default { sassOptions: { loadPaths: ${JSON.stringify(loadPaths)} }, turbopack: { root: ${JSON.stringify(root)} } };\n`);
writeFileSync(here + "app/layout.jsx", "export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n");
writeFileSync(here + "app/page.jsx", [
  ...files.map((f, i) => `import m${i} from ${JSON.stringify("../" + f)};`),
  `const names = { ${files.map((f, i) => `${JSON.stringify(f)}: Object.keys(m${i})`).join(", ")} };`,
  `export default function Page() { return <pre id="names">{JSON.stringify(names)}</pre>; }`,
].join("\n") + "\n");

const typed = Object.fromEntries(await Promise.all(files.map(async (f) => [f, await exportedNames(readFileSync(here + f, "utf8"), { fileName: here + f, sass: { loadPaths } })])));
const short = (f) => f.replace(/^fixtures\//, "");
/** @param {string} s */
const unescapeHtml = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
// Differences the README documents under Limits: Lightning CSS (Turbopack) omits names for empty rules and @value.
// Any other difference fails the check, and so does one of these disappearing, since the README is then out of date.
/** @type {Record<string, Record<string, { missingFromTypes: string[], extraInTypes: string[] }>>} */
const known = {
  turbopack: { "test/button.module.css": { missingFromTypes: [], extraInTypes: ["brand", "main", "sm:p-4"] } },
};
let failed = false;
for (const bundler of ["webpack", "turbopack"]) {
  rmSync(here + ".next", { recursive: true, force: true });
  let runtime;
  try {
    execFileSync("node_modules/.bin/next", ["build", `--${bundler}`], { cwd: here, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
    const html = readFileSync(here + ".next/server/app/index.html", "utf8");
    runtime = JSON.parse(unescapeHtml(/<pre id="names">(.*?)<\/pre>/s.exec(html)[1]));
  } catch (e) {
    const err = /** @type {any} */ (e);
    console.log(JSON.stringify({ bundler, buildError: String(err.stderr || err.stdout || err.message).split("\n").filter(Boolean).slice(0, 12).join("\n") }));
    failed = true;
    continue;
  }
  const diffs = files.flatMap((f) => {
    const missing = runtime[f].filter((n) => !typed[f].includes(n)), extra = typed[f].filter((n) => !runtime[f].includes(n));
    return missing.length || extra.length ? [{ file: short(f), missingFromTypes: missing, extraInTypes: extra }] : [];
  });
  const expected = known[bundler] ?? {};
  const sameAsKnown = (d) => JSON.stringify(expected[d.file]) === JSON.stringify({ missingFromTypes: d.missingFromTypes, extraInTypes: d.extraInTypes });
  const unexpected = diffs.filter((d) => !sameAsKnown(d));
  const gone = Object.keys(expected).filter((f) => !diffs.some((d) => d.file === f && sameAsKnown(d)));
  console.log(JSON.stringify({ bundler, files: files.length, same: files.length - diffs.length, knownDifferences: diffs.length - unexpected.length, unexpected: unexpected.length }));
  for (const d of unexpected) console.log(JSON.stringify({ unexpected: d }));
  for (const f of gone) console.log(JSON.stringify({ documentedDifferenceGone: f, note: "update `known` here and the Next.js line under Limits in the README" }));
  if (unexpected.length || gone.length) failed = true;
}
process.exit(failed ? 1 : 0);
