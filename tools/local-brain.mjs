// A local run of the public brain for tests: the same two handlers behind a plain http server on 127.0.0.1. Nothing here is uploaded to the host.
//   echo test (no key is looked for):   DANIT_ECHO=1 DANIT_EXTRA_ORIGINS=http://127.0.0.1:8093 node tools/local-brain.mjs --port 8098
import http from "node:http";

const pi = process.argv.indexOf("--port"), PORT = +(pi > 0 ? process.argv[pi + 1] : 8098);
if (!(PORT >= 1024 && PORT <= 65535) || PORT === 8095) { console.error("--port: 1024 to 65535, never 8095 (the workshop brain)"); process.exit(2); }
const { handleHealth, handleChat } = await import("../brain/site-brain.mjs");
http.createServer((req, res) => {
  let p = "/"; try { p = new URL(req.url, "http://127.0.0.1").pathname; } catch (e) { /* 404 below */ }
  if (p === "/api/health") return handleHealth(req, res);
  if (p === "/api/chat") return handleChat(req, res);
  res.statusCode = 404; res.end("not found");
}).listen(PORT, "127.0.0.1", () => console.log("local danit site brain on 127.0.0.1:" + PORT));
