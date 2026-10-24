#!/usr/bin/env bash
# Packed-package check: install the tarball `pnpm pack` produces into an empty project and use it the way a consumer
# does, so a missing file in "files", a broken bin or a bad "exports"/"typescript" entry fails before release.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/pkg" "$work/app/src"

pnpm --dir "$root" pack --pack-destination "$work/pkg" >/dev/null
tarball="$(ls "$work"/pkg/*.tgz)"
typescript="$(node -p 'require(process.argv[1]).devDependencies.typescript' "$root/package.json")"

cd "$work/app"
cat > package.json <<EOF
{ "name": "consumer", "private": true, "type": "module",
  "devDependencies": { "typed-css-imports": "file:$tarball", "typescript": "$typescript" } }
EOF
cat > tsconfig.json <<'EOF'
{ "compilerOptions": { "allowArbitraryExtensions": true, "strict": true, "noEmit": true, "module": "preserve" },
  "include": ["src"],
  "contentMappers": [{ "package": "typed-css-imports", "extensions": [".module.css"], "options": { "localsConvention": "camelCase" } }] }
EOF
printf '.button-primary { color: red; }\n' > src/b.module.css
printf 'import s from "./b.module.css";\nexport const ok: string = s.buttonPrimary;\n' > src/ok.ts

# The temp project is outside the workspace, so repeat its supply-chain settings (pnpm-workspace.yaml).
pnpm install --config.minimum-release-age=10080 --config.trust-policy=no-downgrade --config.block-exotic-subdeps=true >/dev/null

pnpm exec tsc --runExternalCode

printf 'import s from "./b.module.css";\nexport const bad = s.buttn;\n' > src/bad.ts
if out="$(pnpm exec tsc --runExternalCode 2>&1)"; then
  echo "expected a type error for s.buttn"; exit 1
fi
grep -q "Property 'buttn' does not exist" <<<"$out" || { echo "$out"; exit 1; }
rm src/bad.ts

pnpm exec typed-css-imports generate --check src/b.module.css 2>/dev/null && { echo "expected --check to fail before generate"; exit 1; }
pnpm exec typed-css-imports generate src/b.module.css >/dev/null
grep -q '"button-primary"' src/b.module.d.css.ts
echo "packed package check passed ($(basename "$tarball"))"
