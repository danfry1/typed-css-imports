# Records docs/demo.gif: rename a class in a CSS module, and tsc reports every stale use.
# Run from the repo root: vhs docs/demo.tape
Output docs/demo.gif
Set Shell "bash"
Set FontSize 20
Set Width 1400
Set Height 720
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms

Hide
Type "cd examples/vite-react && cp src/Button.module.css /tmp/Button.module.css.bak && export PS1='$ ' && clear" Enter
Show

Type "grep -A3 ghost src/Button.module.css" Sleep 300ms Enter
Sleep 1.5s
Type "grep -n buttonGhost src/Button.tsx" Sleep 300ms Enter
Sleep 1.5s
Type "# rename .button-ghost to .button-outline in the CSS" Enter
Type "sed -i '' 's/button-ghost/button-outline/' src/Button.module.css" Sleep 300ms Enter
Sleep 800ms
Type "pnpm typecheck" Sleep 300ms Enter
Sleep 5s

Hide
Type "mv /tmp/Button.module.css.bak src/Button.module.css && clear" Enter
Show
