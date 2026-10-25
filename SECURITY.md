# Security

typed-css-imports runs inside `tsc` and the TypeScript language server when `--runExternalCode` is enabled, so it
treats CSS files as untrusted input:

- For CSS modules it never reads other files (`composes: x from "./other.css"` is resolved without touching the
  filesystem). It never makes network requests and never executes code from the stylesheet.
- Sass modules are compiled with the `sass` or `sass-embedded` package already installed in the project. Like the
  bundler's own Sass build, that reads the files the module `@use`s or `@import`s, from the module's directory,
  `sass.loadPaths` and `pkg:` URLs resolved through node_modules. Sass has no way to run code from a stylesheet, and
  no custom Sass functions or importers are registered.
- Its only runtime dependencies are `postcss` and `postcss-modules`; Sass is not a dependency.

## Supply chain

- Dependencies are pinned to exact versions and installed from the lockfile (`pnpm install --frozen-lockfile`).
- `pnpm-workspace.yaml` requires every dependency, direct or transitive, to have been published for at least a week,
  blocks git/tarball dependencies, blocks install scripts, and fails on trust downgrades (lost provenance).
- CI uses actions pinned to commit SHAs with a read-only token. Releases are published only from CI through npm trusted publishing and need 2FA approval. Releases from 0.1.1 carry
  npm provenance; 0.1.0 (published manually) and 0.1.1-beta.1 (published while the repository was private) have none.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab), not in public issues.
