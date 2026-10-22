// Editor behaviour through the TypeScript 7.1 language server (`tsc --lsp --stdio`): class-name completion, and
// completion updating as soon as the open (unsaved) CSS document changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const tsc = fileURLToPath(new URL("../node_modules/.bin/tsc", import.meta.url));

function lsp() {
  const srv = spawn(tsc, ["--lsp", "--stdio"], { cwd: dir });
  let id = 1, buf = Buffer.alloc(0);
  const pending = new Map();
  const write = (m) => { const b = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...m })); srv.stdin.write(`Content-Length: ${b.length}\r\n\r\n`); srv.stdin.write(b); };
  srv.stdout.on("data", (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      const i = buf.indexOf("\r\n\r\n"); if (i < 0) return;
      const len = Number(/Content-Length: (\d+)/i.exec(buf.subarray(0, i).toString())[1]);
      if (buf.length < i + 4 + len) return;
      const m = JSON.parse(buf.subarray(i + 4, i + 4 + len).toString()); buf = buf.subarray(i + 4 + len);
      if (m.id !== undefined && m.method) write({ id: m.id, result: m.method === "workspace/configuration" ? m.params.items.map(() => null) : null });
      else if (m.id !== undefined) { pending.get(m.id)?.(m); pending.delete(m.id); }
    }
  });
  const request = (method, params) => new Promise((res, rej) => { pending.set(id, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result))); write({ id: id++, method, params }); });
  const notify = (method, params) => write({ method, params });
  const close = async () => { await request("shutdown"); notify("exit"); srv.kill(); };
  return { request, notify, close };
}

test("completion lists class names and follows edits to the open CSS document", async () => {
  const { request, notify, close } = lsp();
  try {
    // Without runExternalCode the language server does not start content mappers.
    await request("initialize", { processId: process.pid, rootUri: pathToFileURL(dir).href, initializationOptions: { runExternalCode: true }, capabilities: { textDocument: { diagnostic: {} } } });
    notify("initialized", {});
    const tsUri = pathToFileURL(dir + "editor.ts").href, cssUri = pathToFileURL(dir + "button.module.css").href;
    const text = 'import styles from "./button.module.css";\nstyles.\n';
    notify("textDocument/didOpen", { textDocument: { uri: tsUri, languageId: "typescript", version: 1, text } });
    const complete = async () => {
      const r = await request("textDocument/completion", { textDocument: { uri: tsUri }, position: { line: 1, character: "styles.".length } });
      return (Array.isArray(r) ? r : r.items).map((i) => i.label);
    };
    const before = await complete();
    for (const name of ["button", "button-primary", "buttonPrimary", "card", "spin", "brand"]) assert.ok(before.includes(name), `missing ${name}`);
    assert.ok(!before.includes("not-mine"));

    const css = readFileSync(new URL("button.module.css", import.meta.url), "utf8");
    notify("textDocument/didOpen", { textDocument: { uri: cssUri, languageId: "css", version: 1, text: css } });
    notify("textDocument/didChange", { textDocument: { uri: cssUri, version: 2 }, contentChanges: [{ text: css + ".brand-new { }\n" }] });
    const after = await complete();
    assert.ok(after.includes("brand-new") && after.includes("brandNew"), "edit to the open CSS document not reflected");
  } finally {
    await close();
  }
});
