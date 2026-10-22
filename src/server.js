// Content mapper for tsc: `*.module.css` -> typed default export (see transform.js).
// Protocol: JSON-RPC over stdio with Content-Length framing (initialize/openProject/transform/closeProject).
import { transform } from "./transform.js";
// stdout carries the protocol, so anything a dependency logs goes to stderr instead.
console.log = console.info = console.warn = console.error;
let chunks = [], size = 0, need = 0;
// projectHandle -> openProject params; `options` holds the tsconfig contentMappers options (e.g. localsConvention).
const projects = new Map();
const send = (id, result) => { const b = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result })); process.stdout.write(`Content-Length: ${b.length}\r\n\r\n`); process.stdout.write(b); };

// CSS syntax errors point at their line/column in the .module.css file; anything else is reported at its start.
function diagnostic(e, content) {
  if (e.name !== "CssSyntaxError" || !e.line) return { messageText: String(e.message), start: 0, length: 1, code: 9001 };
  const lineStart = content.split("\n").slice(0, e.line - 1).reduce((n, l) => n + l.length + 1, 0);
  return { messageText: `CSS syntax error: ${e.reason}`, start: Math.min(lineStart + (e.column ?? 1) - 1, content.length), length: 1, code: 9002 };
}

function handle(msg) {
  if (msg.id === undefined) return;
  const p = msg.params ?? {};
  switch (msg.method) {
    case "initialize": return send(msg.id, { positionEncoding: "utf-16", diagnosticSource: "typed-css-imports" });
    case "openProject": projects.set(p.projectHandle, p); return send(msg.id, {});
    case "closeProject": projects.delete(p.projectHandle); return send(msg.id, null);
    case "transform":
      return transform(p.content, { ...projects.get(p.projectHandle)?.options, fileName: p.fileName }).then(
        (text) => send(msg.id, { text, extension: ".ts" }),
        (e) => send(msg.id, { text: "export {}", extension: ".ts", diagnostics: [diagnostic(e, p.content)] }));
    default: return send(msg.id, null);
  }
}
// Chunks are only concatenated once a whole message has arrived.
process.stdin.on("data", (d) => {
  chunks.push(d); size += d.length;
  while (size >= need) {
    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, size);
    chunks = [buf];
    const i = buf.indexOf("\r\n\r\n"); if (i < 0) return;
    need = i + 4 + Number(/Content-Length: (\d+)/i.exec(buf.subarray(0, i).toString())[1]);
    if (size < need) return;
    const body = buf.subarray(i + 4, need).toString(); buf = buf.subarray(need);
    chunks = buf.length ? [buf] : []; size = buf.length; need = 0;
    handle(JSON.parse(body));
    if (!size) return;
  }
});
process.stdin.on("end", () => process.exit(0));
