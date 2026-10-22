#!/usr/bin/env bash
# Records docs/demo.gif from a real Ghostty window, so Ghostty's own rendering (font, your config's custom cursor
# shaders) is captured. A separate Ghostty instance opens a MacBook-sized window and plays docs/demo/autoplay.lua.
# Only that window is recorded (ScreenCaptureKit, record-window.swift): other windows, notifications and the desktop
# never appear, even if they cover it. It closes by itself after about 30 seconds.
# macOS 15+ only. Needs Screen Recording permission for the terminal that runs it. Run from the repo root after
# `pnpm install`: docs/demo/record-ghostty.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$PWD
WORK=$(mktemp -d)
cleanup() {
  # Quit the demo's Neovim (its Ghostty instance quits with its last window), then remove the work directory.
  pkill -f -- "-S ../../docs/demo/autoplay.lua" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cat > "$WORK/run.sh" <<RUN
#!/bin/zsh -l
cd "$ROOT/examples/vite-react"
DEMO_SIGNAL_DIR="$WORK" exec nvim -S ../../docs/demo/nvim.lua -S ../../docs/demo/autoplay.lua
RUN
chmod +x "$WORK/run.sh"

# Build the recorder first, so a build failure happens before any window opens.
swiftc -parse-as-library -O docs/demo/record-window.swift -o "$WORK/record-window"

# The demo window is whichever Ghostty window appears after launch; anything already open is ignored.
swift docs/demo/ghostty-windows.swift | cut -d' ' -f1 | sort > "$WORK/before"

# 130x36 cells of JetBrains Mono at 18pt is about 1501x934 points: the 14" MacBook Pro's display below the menu bar.
# Opaque background, so nothing behind the window shows through. The window opens in the background, and cursor
# shaders only animate in focused windows unless custom-shader-animation is "always".
open -na Ghostty --args --window-width=130 --window-height=36 --window-position-x=0 --window-position-y=0 \
  --font-size=18 --background-opacity=1 --custom-shader-animation=always \
  --quit-after-last-window-closed=true --confirm-close-surface=false \
  --command="$WORK/run.sh"

for _ in $(seq 600); do [ -e "$WORK/ready" ] && break; sleep 0.1; done
[ -e "$WORK/ready" ] || { echo "Neovim did not become ready" >&2; exit 1; }

swift docs/demo/ghostty-windows.swift > "$WORK/after"
NEW=$(sort "$WORK/after" | join -v1 - "$WORK/before")
if [ "$(printf '%s\n' "$NEW" | grep -c .)" -ne 1 ]; then
  echo "expected exactly one new Ghostty window, found:" >&2; printf '%s\n' "$NEW" >&2; exit 1
fi
read -r WINDOW WIDTH HEIGHT <<< "$NEW"
if [ "$WIDTH" -lt 1400 ] || [ "$WIDTH" -gt 1520 ] || [ "$HEIGHT" -lt 850 ] || [ "$HEIGHT" -gt 1000 ]; then
  echo "new Ghostty window $WINDOW is ${WIDTH}x${HEIGHT}, not the expected ~1512x945; not recording" >&2; exit 1
fi
echo "recording only Ghostty window $WINDOW (${WIDTH}x${HEIGHT})"

"$WORK/record-window" "$WINDOW" "$WORK/demo.mov" "$WORK" &
RECORDER=$!
for _ in $(seq 300); do [ -e "$WORK/recording" ] && break; sleep 0.1; done
[ -e "$WORK/recording" ] || { echo "recorder did not start" >&2; kill "$RECORDER" 2>/dev/null; exit 1; }
sleep 0.5
touch "$WORK/go"
wait "$RECORDER"
[ -e "$WORK/done" ] || echo "warning: the demo had not finished when recording stopped" >&2

# Retina capture (2x) scaled to the window's point size; one palette for the whole clip.
ffmpeg -loglevel error -y -i "$WORK/demo.mov" \
  -vf "fps=30,scale=1512:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
  docs/demo.gif
ls -la docs/demo.gif
