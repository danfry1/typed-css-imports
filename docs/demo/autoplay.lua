-- Plays the demo inside Neovim (used by record-ghostty.sh): the same steps as nvim.tape, driven by timers and typed
-- keys, so the terminal renders it as in normal use, including effects such as Ghostty cursor shaders.
-- Signals through files in $DEMO_SIGNAL_DIR: writes "ready" once the language server has settled, starts when "go"
-- appears, writes "done" at the end, and quits once the recorder writes "stopped".
local dir = assert(vim.env.DEMO_SIGNAL_DIR, "DEMO_SIGNAL_DIR is not set")
local function touch(name) vim.fn.writefile({}, dir .. "/" .. name) end
local function keys(k) vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(k, true, false, true), "t", false) end

-- A flat list of steps: { ms = n } waits, { fn = f } acts. Typing is one key every 65ms.
local steps = {}
local function wait(ms) steps[#steps + 1] = { ms = ms } end
local function run(fn) steps[#steps + 1] = { fn = fn } end
local function type(text)
  for c in text:gmatch(".") do
    run(function() keys(c) end)
    wait(65)
  end
end
local function play(i)
  local step = steps[i]
  if not step then return end
  if step.ms then return vim.defer_fn(function() play(i + 1) end, step.ms) end
  step.fn()
  vim.schedule(function() play(i + 1) end)
end

run(function() Caption("TypeScript knows the classes in your CSS modules") end)
wait(2500)
run(function() Caption("①  Rename a class in the CSS module") end)
wait(1200)
type(":%s/ghost/outline/")
wait(500)
run(function() keys("<CR>") end)
wait(1500)
run(function() Caption("②  The component errors instantly, before saving") end)
wait(1800)
run(function() keys("<C-w>l") end)
wait(600)
run(function() ShowError() end)
wait(4500)
run(function() Caption("③  Autocomplete already knows the new class") end)
wait(1000)
type("ciw")
wait(300)
type("outline")
wait(2000)
run(function() keys("<Esc>") end)
wait(900)
type(":wa")
wait(300)
run(function() keys("<CR>") end)
wait(900)
run(function() Caption("✓  Fixed and saved.   typed-css-imports") end)
wait(3500)
-- Keep the window open until the recorder has stopped and finalised the file (at most 5s).
run(function()
  touch("done")
  local waited = 0
  local timer = assert(vim.uv.new_timer())
  timer:start(0, 100, vim.schedule_wrap(function()
    waited = waited + 100
    if vim.uv.fs_stat(dir .. "/stopped") or waited >= 5000 then
      timer:stop()
      timer:close()
      vim.cmd("qa!")
    end
  end))
end)

-- LazyVim startup and the TypeScript 7.1 language server (content mapper transform) settle before "ready".
vim.defer_fn(function()
  touch("ready")
  local timer = assert(vim.uv.new_timer())
  timer:start(0, 50, vim.schedule_wrap(function()
    if vim.uv.fs_stat(dir .. "/go") then
      timer:stop()
      timer:close()
      play(1)
    end
  end))
end, 7000)
