// CSS module source -> TS module text that types its default export: one readonly string per exported name.
// Names come from postcss-modules (the plugin Vite uses), so they match what the bundler exports at runtime:
// classes, ids, keyframes and @value names, with `localsConvention` applied.
import postcss from "postcss";
import postcssModules from "postcss-modules";

// `composes: x from "./other.css"` changes values, never keys, so imported files are not read: type-checking a
// CSS file never touches the filesystem.
class NoFileLoader {
  async fetch() { return {}; }
}

export async function exportedNames(css, { fileName = "input.module.css", localsConvention } = {}) {
  let names = {};
  await postcss([postcssModules({ getJSON: (_, json) => { names = json; }, Loader: NoFileLoader, localsConvention, generateScopedName: "[local]" })])
    .process(css, { from: fileName });
  return Object.keys(names);
}

export async function transform(css, options) {
  const names = await exportedNames(css, options);
  return `declare const styles: {\n${names.map((n) => `  readonly ${JSON.stringify(n)}: string;`).join("\n")}\n};\nexport default styles;\n`;
}
