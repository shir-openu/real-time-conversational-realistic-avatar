// Makes the public page (index.html) from the workshop page live_talk_v39_cc5.html.
//   node tools/build_public_page.mjs <path of live_talk_v39_cc5.html> <address of the brain> [<out file, default index.html>]
// The public page is the workshop page with exactly TWO places changed; each must be found exactly once, or nothing is written:
//   1. the title line (a title and a description);
//   2. one block right after <body>: the address gate, the keep-awake of the sound device, and the footer line.
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
<script>
// 3. The sound device is kept awake while a talk is going on (Shir, 2026-11-15: the beginning of an answer was not heard).
//    A browser closes a page's sound stream after 30 seconds of pure silence and opens it again only when sound begins;
//    many sound devices need a moment to wake, and that moment was taken from her first word.
//    From the visitor's press or key on, and for two minutes after the last one or after her last word, the page's own
//    audio context plays a 5 Hz tone at 0.0001 of full scale (80 dB under full scale, far under hearing), so the stream
//    stays open. Then the tone stops, and the next press starts it again before she answers. Her voice is not touched.
(function () {
  var Base = window.AudioContext || window.webkitAudioContext; if (!Base) return;
  var IDLE_MS = 120000, LEVEL = 1e-4, HZ = 5, ctxs = [], until = 0, timer = null, own = false;
  function hum(c) {
    if (c.__awake || c.state !== "running") return;
    try {
      var n = Math.round(c.sampleRate), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), i, s;
      for (i = 0; i < n; i++) d[i] = LEVEL * Math.sin(2 * Math.PI * HZ * i / n);
      own = true; try { s = c.createBufferSource(); } finally { own = false; }
      s.buffer = b; s.loop = true; s.connect(c.destination); s.start(); c.__awake = s;
    } catch (e) {}
  }
  function hush(c) { var s = c.__awake; if (!s) return; c.__awake = null; try { s.stop(); } catch (e) {} try { s.disconnect(); } catch (e) {} }
  function tick() {
    var on = Date.now() < until, i, c;
    for (i = ctxs.length - 1; i >= 0; i--) { c = ctxs[i]; if (c.state === "closed") { ctxs.splice(i, 1); continue; } if (on) hum(c); else hush(c); }
    if (!on && timer) { clearInterval(timer); timer = null; }
  }
  function touch() { until = Date.now() + IDLE_MS; if (!timer) timer = setInterval(tick, 5000); tick(); }
  var Awake = class extends Base {
    constructor(o) { super(o); ctxs.push(this); this.addEventListener("statechange", tick); }
    createBufferSource() { var s = super.createBufferSource(); if (!own) { touch(); s.addEventListener("ended", touch); } return s; }
  };
  window.AudioContext = Awake; if (window.webkitAudioContext) window.webkitAudioContext = Awake;
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { window.addEventListener(t, touch, { capture: true, passive: true }); });
  window.__danitAwake = function () { return { on: Date.now() < until, contexts: ctxs.length, humming: ctxs.filter(function (c) { return !!c.__awake; }).length }; };
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
