# Contributing

## Development

```sh
pnpm install --frozen-lockfile
pnpm test   # source type-check, type tests, transform tests, language-server test, generate fallback, example + Vite parity
pnpm test:package   # install the packed tarball into an empty project and run tsc and the CLI against it
pnpm --filter example-next-parity run parity   # Next.js parity (webpack and Turbopack builds; weekly in CI)
docs/demo/record-ghostty.sh   # re-record docs/demo.gif in a real Ghostty window (macOS 15+, Screen Recording permission)
vhs docs/demo/nvim.tape       # or render it headlessly with vhs (no Ghostty cursor shaders)
```

## Releasing

Releases are published only from CI ([`release.yml`](.github/workflows/release.yml)); `prepublishOnly` refuses a local publish.

1. Bump `version` in package.json and add a matching `## <version>` section to CHANGELOG.md. Commit to main.
2. Push a signed, annotated tag: `git tag -s v<version> -m v<version> && git push origin v<version>`.
3. The workflow checks that the tag is on main, that the commit and tag are signed, and that the version matches package.json and CHANGELOG.md, then runs the tests and the packed-package check and stages the version on npm through trusted publishing. A prerelease version (`1.2.0-beta.0`) goes to the `beta` dist-tag.
4. Approve the staged version with 2FA (`npm stage approve <id>`, or on npmjs.com). Until then it isn't installable. The GitHub release, with the CHANGELOG.md section as notes and a CycloneDX SBOM, is created after staging.

Supply-chain settings and how to report vulnerabilities: [SECURITY.md](SECURITY.md).
