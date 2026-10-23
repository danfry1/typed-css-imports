// Content mapper for tsc: `*.module.css`, `*.module.scss`, `*.module.sass` -> typed default export (see transform.js).
// Protocol: JSON-RPC over stdio with Content-Length framing (initialize/openProject/transform/closeProject).
import { SassError, transform } from "./transform.js";
// stdout carries the protocol, so anything a dependency logs goes to stderr instead.
console.log = console.info = console.warn = console.error;
/** @type {Buffer[]} */
let chunks = [];
let size = 0, need = 0;
// projectHandle -> openProject params; `options` holds the tsconfig contentMappers options (e.g. localsConvention).
/** @type {Map<string, { options?: import("./transform.js").Options, configFileName?: string }>} */
const projects = new Map();
/** @param {number | string} id @param {unknown} result */
const send = (id, result) => { const b = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id, result })); process.stdout.write(`Content-Length: ${b.length}\r\n\r\n`); process.stdout.write(b); };

// CSS and Sass syntax errors point at their position in the module; anything else is reported at its start.
/** @param {any} e @param {string} content @param {string} fileName */
function diagnostic(e, content, fileName) {
  if (e instanceof SassError) return { messageText: e.message, start: Math.min(e.offset ?? 0, content.length), length: 1, code: e.offset === undefined ? 9001 : 9002 };
  // A CssSyntaxError in a Sass module is about the compiled CSS, whose lines don't match the source.
  if (e.name !== "CssSyntaxError" || !e.line || /\.s[ac]ss$/.test(fileName)) return { messageText: String(e.message), start: 0, length: 1, code: 9001 };
  const lineStart = content.split("\n").slice(0, e.line - 1).reduce((n, l) => n + l.length + 1, 0);
  return { messageText: `CSS syntax error: ${e.reason}`, start: Math.min(lineStart + (e.column ?? 1) - 1, content.length), length: 1, code: 9002 };
}

/** @param {{ id?: number | string, method: string, params?: any }} msg */
function handle(msg) {
  const { id } = msg;
  if (id === undefined) return;
  const p = msg.params ?? {};
  switch (msg.method) {
    case "initialize": return send(id, { positionEncoding: "utf-16", diagnosticSource: "typed-css-imports" });
    case "openProject": projects.set(p.projectHandle, p); return send(id, {});
    case "closeProject": projects.delete(p.projectHandle); return send(id, null);
    case "transform":
    {
      const project = projects.get(p.projectHandle);
      return transform(p.content, { ...project?.options, configFileName: project?.configFileName, fileName: p.fileName }).then(
        (text) => send(id, { text, extension: ".ts" }),
        (/** @type {unknown} */ e) => send(id, { text: "export {}", extension: ".ts", diagnostics: [diagnostic(e, p.content, p.fileName)] }));
    }
    default: return send(id, null);
  }
}
// Chunks are only concatenated once a whole message has arrived.
process.stdin.on("data", (d) => {
  chunks.push(d); size += d.length;
  while (size >= need) {
    let buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, size);
    chunks = [buf];
    const i = buf.indexOf("\r\n\r\n"); if (i < 0) return;
    const length = /Content-Length: (\d+)/i.exec(buf.subarray(0, i).toString())?.[1];
    if (length === undefined) throw new Error("typed-css-imports: message without a Content-Length header");
    need = i + 4 + Number(length);
    if (size < need) return;
    const body = buf.subarray(i + 4, need).toString(); buf = buf.subarray(need);
    chunks = buf.length ? [buf] : []; size = buf.length; need = 0;
    handle(JSON.parse(body));
    if (!size) return;
  }
});
process.stdin.on("end", () => process.exit(0));
