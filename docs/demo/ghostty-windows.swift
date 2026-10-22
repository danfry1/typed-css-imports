// Lists on-screen, normal (layer 0) Ghostty terminal windows as "id width height", so record-ghostty.sh can tell which window
// is new. Off-screen and thin helper windows (e.g. 30pt-high titlebar strips) are skipped.
import CoreGraphics

let windows = CGWindowListCopyWindowInfo([.optionAll, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows where window[kCGWindowOwnerName as String] as? String == "Ghostty" && window[kCGWindowLayer as String] as? Int == 0
  && window[kCGWindowIsOnscreen as String] as? Bool == true {
  guard let id = window[kCGWindowNumber as String] as? Int, let b = window[kCGWindowBounds as String] as? [String: Double],
    (b["Height"] ?? 0) > 200 else { continue }
  print(id, Int(b["Width"] ?? 0), Int(b["Height"] ?? 0))
}
