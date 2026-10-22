-- Loaded by docs/demo/nvim.tape on top of a normal (LazyVim) config: lume colours, the TypeScript 7.1 language server
-- with content mappers enabled, and the CSS module and the component that uses it side by side.
vim.cmd.colorscheme("lume")

-- LazyVim's TypeScript extra runs vtsls (TypeScript 5), which has no content mappers. It is enabled lazily, after this
-- script runs, so it is stopped when it attaches.
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local client = vim.lsp.get_client_by_id(args.data.client_id)
    if client and client.name == "vtsls" then vim.schedule(function() client:stop() end) end
  end,
})

-- `css` is attached too, so edits to the CSS buffer reach the server before they are saved.
vim.lsp.config("tsgo", {
  cmd = { vim.fn.getcwd() .. "/node_modules/.bin/tsc", "--lsp", "--stdio" },
  filetypes = { "typescript", "typescriptreact", "css" },
  root_markers = { "tsconfig.json" },
  init_options = { runExternalCode = true },
})
vim.lsp.enable("tsgo")

-- Show diagnostic messages inline, up to " on type '...'" so they fit next to the code (ShowError has the full text).
-- LazyVim applies its diagnostic config when the LSP setup loads, so this runs after it.
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function()
    vim.diagnostic.config({
      underline = true,
      virtual_text = { spacing = 2, prefix = "●", format = function(d) return (d.message:gsub(" on type .*$", "")) end },
    })
  end,
})

-- bufferline skips diagnostic updates made during insert mode, so its tab counts can lag behind; redraw them.
vim.api.nvim_create_autocmd("DiagnosticChanged", {
  callback = function() vim.schedule(function() pcall(function() require("bufferline.ui").refresh() end) end) end,
})

-- Completion shows only language-server items (the CSS class names), not snippets or buffer words.
vim.api.nvim_create_autocmd("InsertEnter", {
  once = true,
  callback = function()
    pcall(function()
      local config = require("blink.cmp.config")
      config.sources.default = { "lsp" }
      -- The menu alone: no preview of the selected item inline, and no documentation popup beside it.
      config.completion.ghost_text.enabled = false
      config.completion.documentation.auto_show = false
    end)
  end,
})

-- Inlay hints (e.g. a component's return type) appear mid-recording and push lines past the edge of the pane. LazyVim
-- enables them per buffer after attaching, so turn them off and make later enable calls no-ops for this session.
vim.lsp.inlay_hint.enable(false)
vim.lsp.inlay_hint.enable = function() end

-- Absolute line numbers read more easily in a recording than LazyVim's relative ones.
vim.opt.relativenumber = false

-- Step captions: a small floating window in the empty space at the bottom of the editor, styled with lume's palette. The tape calls
-- Caption("...") with output hidden, so viewers only see the caption appear.
vim.api.nvim_set_hl(0, "DemoCaption", { fg = "#d8d0e4", bg = "#262236", bold = true })
vim.api.nvim_set_hl(0, "DemoCaptionBorder", { fg = "#b8a0e0", bg = "#262236" })
local caption = { buf = vim.api.nvim_create_buf(false, true) }
function _G.Caption(text)
  if caption.win and vim.api.nvim_win_is_valid(caption.win) then vim.api.nvim_win_close(caption.win, true) end
  if not text then return end
  local line = "  " .. text .. "  "
  vim.api.nvim_buf_set_lines(caption.buf, 0, -1, false, { line })
  local width = vim.fn.strdisplaywidth(line)
  caption.win = vim.api.nvim_open_win(caption.buf, false, {
    relative = "editor", row = vim.o.lines - 7, col = math.floor((vim.o.columns - width) / 2), width = width, height = 1,
    style = "minimal", border = "rounded", focusable = false, zindex = 250,
  })
  vim.wo[caption.win].winhighlight = "Normal:DemoCaption,FloatBorder:DemoCaptionBorder"
end

-- Full diagnostic message in a wrapped float, so the generated type (the CSS classes) is readable.
function _G.ShowError()
  vim.diagnostic.open_float({ scope = "line", border = "rounded", max_width = 70, header = "", source = false })
end

-- The demo saves both files at the end. Put back what was on disk when Neovim exits, so recording changes nothing.
local originals = {}
for _, f in ipairs({ "src/Button.module.css", "src/Button.tsx" }) do originals[f] = vim.fn.readfile(f, "b") end
vim.api.nvim_create_autocmd("VimLeavePre", {
  callback = function() for f, lines in pairs(originals) do vim.fn.writefile(lines, f, "b") end end,
})

-- CSS module on the left (focused, narrower: its lines are short), the component that uses it on the right, with its
-- cursor already on the class the demo renames.
vim.cmd("edit src/Button.module.css | rightbelow vsplit src/Button.tsx")
vim.fn.search([[styles\.\zsghost]])
-- The component pane gets 86 columns (its longest line plus the inline error message); the CSS pane, whose lines are
-- short, gets the rest. Re-applied when the terminal is resized (e.g. moved to a display with a different scale).
local css_win = vim.fn.win_getid(vim.fn.winnr("h"))
local function layout()
  if vim.api.nvim_win_is_valid(css_win) then vim.api.nvim_win_set_width(css_win, math.max(vim.o.columns - 87, 40)) end
end
vim.cmd("wincmd h")
layout()
vim.api.nvim_create_autocmd("VimResized", { callback = layout })
