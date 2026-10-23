#!/usr/bin/env bash
# Fallback check: generate the declaration file, then run the type tests with no content mapper configured.
set -euo pipefail
cd "$(dirname "$0")/.."
trap 'rm -f test/button.module.d.css.ts test/card.module.d.scss.ts test/list.module.d.sass.ts' EXIT
node src/cli.js generate --locals-convention camelCase test/button.module.css
node src/cli.js generate --check --locals-convention camelCase test/button.module.css
node src/cli.js generate --locals-convention camelCase --load-path test/styles test/card.module.scss test/list.module.sass
pnpm exec tsc -p test/tsconfig.fallback.json
echo "fallback type tests passed"
