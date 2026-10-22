# Records docs/demo.gif: Neovim (LazyVim, lume) with a CSS module and the component using it side by side. Renaming a
# class in the CSS shows the type error in the component before anything is saved; completion then offers the new name.
# Captions and the error float are driven with output hidden (see docs/demo/nvim.lua).
# Run from the repo root after `pnpm install`: vhs docs/demo/nvim.tape
Output docs/demo.gif

Set Shell "bash"
# Looks like a Ghostty window on a 14" MacBook Pro: the 1512x982 logical display minus the menu bar, the hidden
# titlebar and 16/12 window padding from ~/.config/ghostty/config, and JetBrains Mono. The font is set larger than
# Ghostty's 13pt default, as for a screen recording, so the text stays readable when the GIF is scaled down.
Set FontFamily "JetBrainsMono Nerd Font"
Set FontSize 18
Set LineHeight 1.35
Set Width 1512
Set Height 945
Set Padding 16
Set Margin 0
Set BorderRadius 0
Set TypingSpeed 65ms
# lume, as in ~/.config/ghostty/themes/lume (https://github.com/danfry1/lume)
Set Theme { "name": "Lume", "background": "#12101e", "foreground": "#d8d0e4", "cursor": "#d0a0b8", "selection": "#262236", "black": "#56526c", "red": "#c49080", "green": "#a0d4a8", "yellow": "#c4b080", "blue": "#8cc0e0", "magenta": "#b8a0e0", "cyan": "#88c0b8", "white": "#b0a8c4", "brightBlack": "#68647e", "brightRed": "#d0a0b8", "brightGreen": "#a8d4b8", "brightYellow": "#e8b4a0", "brightBlue": "#a0c8e0", "brightMagenta": "#c4b0e0", "brightCyan": "#a0d4cc", "brightWhite": "#d8d0e4" }

Hide
Type "cd examples/vite-react && clear && nvim -S ../../docs/demo/nvim.lua" Enter
# LazyVim startup and the TypeScript 7.1 language server (content mapper transform) settle off camera.
Sleep 7s
Type `:lua Caption("TypeScript knows the classes in your CSS modules")` Enter
Sleep 300ms
Show
Sleep 2.5s

# 1. Rename .ghost to .outline in the CSS module (not saved).
Hide
Type `:lua Caption("①  Rename a class in the CSS module")` Enter
Sleep 200ms
Show
Sleep 1.2s
Type ":%s/ghost/outline/" Sleep 500ms Enter
Sleep 1.5s

# 2. The component on the right now uses a class that no longer exists: show the full error.
Hide
Type `:lua Caption("②  The component errors instantly, before saving")` Enter
Sleep 200ms
Show
Sleep 1.8s
Ctrl+W Sleep 150ms Type "l" Sleep 500ms
Hide
Type ":lua ShowError()" Enter
Sleep 200ms
Show
Sleep 4.5s

# 3. Fix the component: completion lists the renamed class then both files are saved.
Hide
Type `:lua Caption("③  Autocomplete already knows the new class")` Enter
Sleep 200ms
Show
Sleep 1s
Type "ciw" Sleep 300ms
Type "outline"
Sleep 2s
Escape
Sleep 900ms
Type ":wa" Sleep 300ms Enter
Sleep 900ms
Hide
Type `:lua Caption("✓  Fixed and saved.   typed-css-imports")` Enter
Sleep 200ms
Show
Sleep 3.5s

Hide
Type ":qa!" Enter
