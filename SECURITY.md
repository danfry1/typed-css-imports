# Security

typed-css-imports runs inside `tsc` and the TypeScript language server when `--runExternalCode` is enabled, so it
treats CSS files as untrusted input:

- It never reads other files (`composes: x from "./other.css"` is resolved without touching the filesystem), never
  makes network requests and never executes code from the CSS.
- Its only runtime dependencies are `postcss` and `postcss-modules`.

## Supply chain

- Dependencies are pinned to exact versions and installed from the lockfile (`pnpm install --frozen-lockfile`).
- `pnpm-workspace.yaml` requires every dependency, direct or transitive, to have been published for at least a week,
  blocks git/tarball dependencies, blocks install scripts, and fails on trust downgrades (lost provenance).
- CI uses actions pinned to commit SHAs with a read-only token. Published releases carry npm provenance.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab), not in public issues.
