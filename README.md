# typed-css-imports

Plain `tsc` knows the class names in your CSS modules. A misspelled class name is a compile error, in your editor and in CI.

![Neovim: renaming a class in a CSS module shows the type error in the component before saving, and completion offers the new name](docs/demo.gif)

```css
/* button.module.css */
.button { color: white; }
.button-primary { background: royalblue; }
```

```ts
import styles from "./button.module.css";

styles.buttonPrimary; // string
styles.buttn;
// error TS2551: Property 'buttn' does not exist on type '{ readonly button: string; ... }'. Did you mean 'button'?
```

- **Real types, not `{ [key: string]: string }`.** Every class, id, `@keyframes` and `@value` name the bundler exports, and nothing else. Typos, removed classes and `:global` names are errors.
- **Same names as your bundler.** Names come from [postcss-modules](https://github.com/madyankin/postcss-modules), the plugin Vite uses, including `localsConvention` (`camelCase`, `dashes`, …).
- **No codegen, no `.d.ts` files to commit.** Built on TypeScript 7.1 content mappers. Add a class in the CSS file and it autocompletes in your component immediately, even before you save.
- **Overrides the generic stubs.** The `declare module "*.module.css"` declarations from `vite/client` or Next.js stay in place; the mapped types take precedence.
- **No runtime.** Your bundler already loads CSS modules. This package only provides types.
- **Fallback for older toolchains.** `typed-css-imports generate` writes the same types to `.d.css.ts` files for TypeScript < 7.1 or CI without `--runExternalCode`.

## Setup

Requires TypeScript 7.1 (currently in beta) and Node >= 22.12.

```sh
pnpm add -D typed-css-imports
```

`tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "allowArbitraryExtensions": true
  },
  "contentMappers": [
    {
      "package": "typed-css-imports",
      "extensions": [".module.css"],
      "options": { "localsConvention": "camelCase" } // optional: match your bundler's setting
    }
  ]
}
```

Type-check with external code enabled. Content mappers run code at type-check time, so TypeScript requires an explicit opt-in:

```sh
tsc --noEmit --runExternalCode
```

## Editor setup

The TypeScript 7.1 language server (`tsc --lsp`) starts content mappers only when the client sends `initializationOptions: { runExternalCode: true }`. Without it, CSS module imports report TS2307, or with `vite/client` types silently fall back to `{ [key: string]: string }`.

How soon types update depends on what the editor sends the server:

- **As you type:** if the editor also attaches the TypeScript server to `.module.css` buffers, each edit sends the unsaved CSS. The server re-runs the mapper on that text and asks the editor to refresh diagnostics, so errors in components appear before the CSS file is saved. This is what the demo above shows.
- **On save:** otherwise the server sees the CSS file when it changes on disk.

`tsc --noEmit --runExternalCode` on the command line always reads saved files.

### VS Code

Install the [TypeScript 7](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview) extension (`TypeScriptTeam.native-preview`) and point it at the project's TypeScript in `.vscode/settings.json`:

```jsonc
{
  "js/ts.tsdk.path": "node_modules/typescript"
}
```

Accept the prompt "This workspace has a TypeScript 7 tsdk configured … Would you like to use it?" (or run **TypeScript: Select TypeScript Version...**). The workspace must be trusted. Nothing else is needed: the extension enables content mappers by default (`js/ts.contentMappers.enabled`) and sends `.module.css` edits to the server, so errors update as you type.

Without the setting, the extension runs the TypeScript 7.0 it bundles, which has no content mappers. There are no errors: imports silently fall back to `vite/client`'s `{ [key: string]: string }`.

Tested with VS Code 1.135 and extension version 1.0.1.

### LazyVim

In `lua/config/options.lua`:

```lua
vim.g.lazyvim_ts_lsp = "tsc"
```

In `lua/plugins/typescript.lua`:

```lua
return {
  "neovim/nvim-lspconfig",
  opts = function(_, opts)
    -- cmd and root_dir share a cache of which tsc binary to run, so take both from the same copy of lspconfig's config.
    local tsc = dofile(vim.api.nvim_get_runtime_file("lsp/tsc.lua", false)[1])
    opts.servers.tsc = vim.tbl_deep_extend("force", opts.servers.tsc or {}, {
      mason = false, -- run the project's node_modules/.bin/tsc
      init_options = { runExternalCode = true },
      -- CSS modules are attached so unsaved edits reach the server. Other CSS files have no project and are skipped.
      filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact", "css" },
      cmd = tsc.cmd,
      root_dir = function(bufnr, on_dir)
        if vim.bo[bufnr].filetype ~= "css" or vim.api.nvim_buf_get_name(bufnr):match("%.module%.css$") then
          tsc.root_dir(bufnr, on_dir)
        end
      end,
    })
  end,
}
```

Tested with Neovim 0.12, LazyVim 16 and the `lang.typescript` extra. Neovim 0.11 doesn't handle `workspace/diagnostic/refresh`, so components update only when they are edited.

## Example

[`examples/vite-react`](examples/vite-react) is a Vite + React app with `vite/client` types and `localsConvention: "camelCaseOnly"` in both `vite.config.ts` and `tsconfig.json`. `pnpm --filter example-vite-react run parity` loads every CSS module through Vite and checks that the names Vite exports at runtime match the types exactly.

## What's exported

| CSS | exported name |
|---|---|
| `.button { }`, `.a:is(.b, .c)`, `&.active` (nesting) | `button`, `a`, `b`, `c`, `active` |
| `#main { }` | `main` |
| `@keyframes spin { }` | `spin` |
| `@value brand: #0a7;` | `brand` |
| `.sm\:p-4 { }` | `sm:p-4` |
| `:global(.x)`, `:global .x` | (not exported) |
| class names in comments, strings, `url()` | (not exported) |
| `.button-primary` with `localsConvention: "camelCase"` | `button-primary` and `buttonPrimary` |

`composes: x from "./other.css"` is supported. Other files are never read during type-checking, because `composes` doesn't change which names a module exports.

CSS syntax errors are reported at their line and column in the `.module.css` file.

## Fallback: generated declaration files

```sh
typed-css-imports generate [--locals-convention camelCase] src/**/*.module.css   # writes x.module.d.css.ts
typed-css-imports generate --check src/**/*.module.css                           # exit 1 if any are stale
```

With `allowArbitraryExtensions`, tsc picks up `button.module.d.css.ts` for `import styles from "./button.module.css"` and no content mapper is needed.

## Limits

- `.module.css` only. Sass/Less modules need the preprocessor to run first: class names can be generated by mixins and loops.
- Names reflect the CSS as written. PostCSS plugins your bundler runs before CSS Modules (for example ones that generate classes) are not applied.
- Default export only. Named imports (`import { button } from "./x.module.css"`) work in Vite but not in every bundler, so they aren't typed.

## Development

```sh
pnpm install --frozen-lockfile
pnpm test   # source type-check, type tests, transform tests, language-server test, generate fallback, example + Vite parity
docs/demo/record-ghostty.sh   # re-record docs/demo.gif in a real Ghostty window (macOS 15+, Screen Recording permission)
vhs docs/demo/nvim.tape       # or render it headlessly with vhs (no Ghostty cursor shaders)
```

Supply-chain settings and how to report vulnerabilities: [SECURITY.md](SECURITY.md).

## License

MIT
