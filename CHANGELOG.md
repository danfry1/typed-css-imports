# Changelog

## 0.1.0

First release.

- TypeScript 7.1 content mapper for `.module.css`, `.module.scss` and `.module.sass` imports: the default export is typed with exactly the names postcss-modules exports, including `localsConvention`.
- Sass modules are compiled with the project's `sass` or `sass-embedded`, with `loadPaths` and string `additionalData` options.
- CSS and Sass syntax errors are reported at their position in the module.
- `typed-css-imports generate` writes the same types to `.d.css.ts` / `.d.scss.ts` / `.d.sass.ts` files, with `--check` for stale files.
- Published manually, without npm provenance.
