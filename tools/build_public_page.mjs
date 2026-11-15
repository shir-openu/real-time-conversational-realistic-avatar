// Makes the public page (index.html) from the workshop page live_talk_v39_cc5.html.
//   node tools/build_public_page.mjs <path of live_talk_v39_cc5.html> <address of the brain> [<out file, default index.html>]
// The public page is the workshop page with exactly TWO places changed; each must be found exactly once, or nothing is written:
//   1. the title line (a title and a description);
//   2. one block right after <body>: the address gate and the footer line.
// Nothing else differs - a plain diff of the two files shows it.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const V39_SHA256 = "0716011b6ce07bc22c2418feb8da7b70d2bf8a9b97ea0f017e312b6fbbd55aa7";
const [src, brain, outArg] = process.argv.slice(2);
if (!src || !brain) { console.error("usage: node tools/build_public_page.mjs <live_talk_v39_cc5.html> <brain address> [out file]"); process.exit(2); }
if (!/^https:\/\/[a-z0-9.-]+$/.test(brain) && !/^http:\/\/127\.0\.0\.1:\d+$/.test(brain)) { console.error("the brain address must be https://<host> (or http://127.0.0.1:<port> for a local test), no path"); process.exit(2); }
if (/:8095$/.test(brain)) { console.error("8095 is the workshop brain: never the public page's"); process.exit(2); }
const out = path.resolve(outArg || "index.html");

const buf = readFileSync(src), sha = createHash("sha256").update(buf).digest("hex");
if (sha !== V39_SHA256) { console.error("the source is not live_talk_v39_cc5.html as approved (sha256 " + sha + ")"); process.exit(2); }
let html = buf.toString("utf8");

const once = (find, put, what) => {
  const n = html.split(find).length - 1;
  if (n !== 1) { console.error(`"${what}" was found ${n} times (must be 1): nothing written`); process.exit(2); }
  html = html.replace(find, () => put);
};

const TITLE = `<title>Real-Time Conversational Realistic Avatar - Shir Sivroni</title>
<meta name="description" content="Talk live with Danit, a realistic 3D avatar by Shir Sivroni. Speech recognition, her voice and her lip-sync run in your browser.">`;

const GATE = `<body>
<script>
// PUBLIC PAGE (made by tools/build_public_page.mjs from the workshop page live_talk_v39_cc5.html; this block and the title are the only changes).
// 1. The workshop page's address options (?brain=, ?debug=, ?model= and the rest) are not offered here: before any other script
//    reads the address it is rewritten - whatever a link carried is dropped, and the brain is always this page's own server.
// 2. On a phone, or with the browser's data saver on, the visitor is asked once before the large downloads begin.
(function () {
  var BRAIN = "${brain}", HOME = "https://shir-openu.github.io/", want = "?brain=" + BRAIN;
  if (location.search !== want) {
    try { history.replaceState(null, "", location.pathname + want + location.hash); } catch (e) {}
    if (location.search !== want) { location.replace(location.pathname + want + location.hash); return; }
  }
  try {
    var phone = Math.min(screen.width, screen.height) < 700 && window.matchMedia && matchMedia("(pointer: coarse)").matches;
    var saver = !!(navigator.connection && navigator.connection.saveData), ok = false;
    try { ok = localStorage.getItem("danit_weight_ok") === "1"; } catch (e) {}
    if ((phone || saver) && !ok) {
      if (!confirm("Danit downloads about 500 MB the first time: her 3D model, her voice and the speech recogniser. Wi-Fi and a computer work best. Load her now?")) { location.replace(HOME); return; }
      try { localStorage.setItem("danit_weight_ok", "1"); } catch (e) {}
    }
  } catch (e) {}
})();
</script>
<div id="pubfoot">&copy; Shir Sivroni &middot; <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> &middot; <a href="https://shir-openu.github.io/">Portfolio</a></div>
<style>
 #pubfoot{position:fixed;right:10px;bottom:5px;z-index:4;font:11.5px/1.4 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#64748b}
 #pubfoot a{color:inherit}
</style>`;

once("<title>live_talk v39</title>", TITLE, "the title line");
once("<body>\n", GATE + "\n", "<body>");
writeFileSync(out, html, "utf8");
console.log("written " + out + " (" + Buffer.byteLength(html, "utf8") + " bytes, sha256 " + createHash("sha256").update(html, "utf8").digest("hex") + "), brain " + brain);
