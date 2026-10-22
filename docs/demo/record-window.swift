// Records one window with ScreenCaptureKit: only that window's own pixels, even if other windows cover it, so nothing
// else on screen can end up in the recording.
// Build: swiftc -parse-as-library -O record-window.swift -o record-window (record-ghostty.sh does this)
// Usage: record-window <window-id> <out.mov> <signal-dir>
// Writes <signal-dir>/recording once capture has started, stops when <signal-dir>/done appears (or after 60s), and
// writes <signal-dir>/stopped once the file is finalised.
import AppKit
import ScreenCaptureKit

final class Delegate: NSObject, SCRecordingOutputDelegate {
  var finished = false
  func recordingOutputDidFinishRecording(_ recordingOutput: SCRecordingOutput) { finished = true }
  func recordingOutput(_ recordingOutput: SCRecordingOutput, didFailWithError error: any Error) {
    FileHandle.standardError.write("recording failed: \(error)\n".data(using: .utf8)!)
    exit(1)
  }
}

@main
struct RecordWindow {
  static func main() async throws {
    // Command-line tools must connect to the window server before ScreenCaptureKit can be used.
    _ = NSApplication.shared
    let args = CommandLine.arguments
    guard args.count == 4, let windowID = UInt32(args[1]) else {
      FileHandle.standardError.write("usage: record-window <window-id> <out.mov> <signal-dir>\n".data(using: .utf8)!)
      exit(2)
    }
    let output = URL(fileURLWithPath: args[2]), signals = URL(fileURLWithPath: args[3])

    let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
    guard let window = content.windows.first(where: { $0.windowID == windowID }) else {
      FileHandle.standardError.write("window \(windowID) is not on screen\n".data(using: .utf8)!)
      exit(1)
    }
    let filter = SCContentFilter(desktopIndependentWindow: window)
    let config = SCStreamConfiguration()
    let scale = CGFloat(filter.pointPixelScale)
    config.width = Int(window.frame.width * scale)
    config.height = Int(window.frame.height * scale)
    config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
    config.showsCursor = false
    config.capturesAudio = false

    let recordingConfig = SCRecordingOutputConfiguration()
    recordingConfig.outputURL = output
    recordingConfig.outputFileType = .mov
    let delegate = Delegate()
    let recording = SCRecordingOutput(configuration: recordingConfig, delegate: delegate)
    let stream = SCStream(filter: filter, configuration: config, delegate: nil)
    try stream.addRecordingOutput(recording)
    try await stream.startCapture()
    FileManager.default.createFile(atPath: signals.appendingPathComponent("recording").path, contents: nil)

    let deadline = Date().addingTimeInterval(60)
    while !FileManager.default.fileExists(atPath: signals.appendingPathComponent("done").path) && Date() < deadline {
      try await Task.sleep(nanoseconds: 100_000_000)
    }
    try await Task.sleep(nanoseconds: 500_000_000)
    // The stream may already have stopped if the window closed; the recording is finalised either way.
    try? await stream.stopCapture()
    for _ in 0..<100 where !delegate.finished { try await Task.sleep(nanoseconds: 50_000_000) }
    FileManager.default.createFile(atPath: signals.appendingPathComponent("stopped").path, contents: nil)
    print("recorded \(config.width)x\(config.height) to \(output.path)")
  }
}
