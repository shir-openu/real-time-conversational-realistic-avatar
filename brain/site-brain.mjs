// The public brain of Danit's page: page -> THIS server (two Vercel functions, api/health.js and api/chat.js) -> the Claude API.
// The key never reaches the browser: it lives in the host's environment (ANTHROPIC_API_KEY) and is read only by the SDK client below.
// Built on danit-brain, the local proxy of the workshop page: brain-core.mjs is its file, unchanged (validation, the request to Claude,
// error mapping, the stream forwarding). New here: the origin rule, the limits a public address needs, the guide and the site knowledge.
// Nothing a visitor says is stored or logged: the one log line per request holds counts and timings only.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, validateChatBody, buildParams, echoText, echoChunks, mapError, redact, streamReply } from "./brain-core.mjs";

export const GUIDE_NAME = "app-v001";
const read = (name) => readFileSync(new URL("./" + name, import.meta.url), "utf8").trim();
const SYSTEM = read("danit-guide_app_v001.txt") + "\n\n" + read("site-knowledge_v002.txt");

// ---- who may call: the page's own origin. Further origins (a local test) come only from the environment.
const ORIGINS = ["https://shir-openu.github.io", ...String(process.env.DANIT_EXTRA_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean)];
const ECHO = process.env.DANIT_ECHO === "1";                               // tests only: no key is looked for, no API call can happen
const hasKey = () => !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
const mode = () => (ECHO ? "echo" : (hasKey() ? "claude" : null));
let client = null;
const getClient = () => client || (client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim(), maxRetries: 1, timeout: 60000 }));

// ---- the limits of a public address. They live in the memory of one running instance: a brake, not a wall.
// The wall is the spend limit of the key's own workspace at the API provider.
const LIMITS = { bodyBytes: 32768, totalChars: 8000, perMinute: 12, perDay: 100, allPerDay: 600 };
const DAY = 86400000, MIN = 60000;
const seen = new Map();                                                    // caller -> { m0, m, d0, d }
let all = { d0: Date.now(), d: 0 };
function allow(caller, now = Date.now()) {
  if (now - all.d0 >= DAY) all = { d0: now, d: 0 };
  if (all.d >= LIMITS.allPerDay) return false;
  let s = seen.get(caller);
  if (!s) { if (seen.size > 5000) seen.clear(); s = { m0: now, m: 0, d0: now, d: 0 }; seen.set(caller, s); }
  if (now - s.m0 >= MIN) { s.m0 = now; s.m = 0; }
  if (now - s.d0 >= DAY) { s.d0 = now; s.d = 0; }
  if (s.m >= LIMITS.perMinute || s.d >= LIMITS.perDay) return false;
  s.m++; s.d++; all.d++; return true;
}
const callerOf = (req) => String(req.headers["x-real-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || (req.socket && req.socket.remoteAddress) || "?").trim().slice(0, 64);

// the newest messages that fit the total; the first one stays a user message (validateChatBody already made the roles alternate)
function fit(messages) {
  const size = (a) => a.reduce((t, x) => t + x.content.length, 0);
  let m = messages;
  while (m.length > 1 && size(m) > LIMITS.totalChars) { m = m.slice(1); while (m.length > 1 && m[0].role !== "user") m = m.slice(1); }
  return m;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const send = (res, code, text, type = "text/plain; charset=utf-8") => { res.statusCode = code; res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "no-store"); res.end(text); };
function cors(req, res) {                                                  // false = the origin is not allowed (the answer is already sent)
  const origin = req.headers.origin;
  if (origin) {
    if (!ORIGINS.includes(origin)) { send(res, 403, "origin not allowed"); return false; }
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin");
  }
  return true;
}
function preflight(res) {
  res.statusCode = 204; res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "600"); res.end();
}
// the body as an object: the host may have parsed it already (req.body); a plain node server has not
async function bodyOf(req) {
  if (+(req.headers["content-length"] || 0) > LIMITS.bodyBytes) throw Object.assign(new Error("too big"), { code: 413 });
  if (req.body !== undefined && req.body !== null) {
    const b = req.body;
    if (typeof b === "string") return JSON.parse(b);
    if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
    return b;
  }
  const text = await new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on("data", c => { n += c.length; if (n > LIMITS.bodyBytes) { reject(Object.assign(new Error("too big"), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
  return JSON.parse(text);
}

// ---- GET /api/health -> { ok, mode: "claude" | "echo", model }. Without a key: 503 and plain text, so that the page says "Danit's brain is not connected".
export function handleHealth(req, res) {
  if (!cors(req, res)) return;
  if (req.method === "OPTIONS") return preflight(res);
  if (req.method !== "GET") return send(res, 405, "method not allowed");
  const m = mode();
  if (!m) return send(res, 503, "brain not connected");
  send(res, 200, JSON.stringify({ ok: true, mode: m, model: MODEL, guide: GUIDE_NAME }), "application/json; charset=utf-8");
}

// ---- POST /api/chat  { messages: [{ role, content } ...] }  ->  the answer as a plain text stream (only the text of the reply is forwarded)
export async function handleChat(req, res) {
  const t0 = Date.now(); let status = 200, stop = "-", ttfb = "-", nmsg = 0, extra = "";
  const plain = (code, text) => { status = code; if (!res.headersSent) send(res, code, text); else res.end(); };
  try {
    if (!cors(req, res)) { status = 403; return; }
    if (req.method === "OPTIONS") { status = 204; return preflight(res); }
    if (req.method !== "POST") return plain(405, "method not allowed");
    if (!req.headers.origin) return plain(403, "origin not allowed");      // a page always sends its origin with a POST
    const m = mode();
    if (!m) return plain(503, "The brain is not connected.");
    if (!allow(callerOf(req))) return plain(429, "Danit is resting for a moment. Please try again in a minute.");
    let body;
    try { body = await bodyOf(req); } catch (e) { return plain(e && e.code === 413 ? 413 : 400, e && e.code === 413 ? "bad request: body too big" : "bad request: the body must be JSON"); }
    const v = validateChatBody(body);
    if (!v.ok) return plain(400, v.text);
    const messages = fit(v.messages); nmsg = messages.length;
    let begun = false;
    const begin = () => { begun = true; res.statusCode = 200; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Accel-Buffering", "no"); };
    if (m === "echo") {                                                     // tests: the same chunked stream, a few chunks about 50 ms apart
      stop = "echo"; begin(); const chunks = echoChunks(echoText(messages));
      for (let i = 0; i < chunks.length; i++) { if (i) await sleep(50); else ttfb = Date.now() - t0; res.write(chunks[i]); }
      return res.end();
    }
    const ac = new AbortController(); res.on("close", () => { if (!res.writableEnded) ac.abort(); });
    const sink = { begin, write: (t) => { res.write(t); } };
    try {
      const r = await streamReply(getClient(), buildParams(messages, SYSTEM), sink, ac.signal);
      stop = r.stopReason; ttfb = r.firstByteMs === null ? "-" : r.firstByteMs;
      extra = ` model=${r.model || "-"} fallback=${r.fallback ? "yes" : "no"}` + (r.usage ? ` in=${r.usage.input} out=${r.usage.output} cache_read=${r.usage.cacheRead} cache_write=${r.usage.cacheWrite}` : "");
      if (!begun) begin();                                                  // an empty reply: a valid empty 200
      res.end();
    } catch (e) { const x = mapError(e); stop = "error"; plain(x.status, x.text); }   // before the first byte: a real status and a short plain text
  } catch (e) { stop = "error"; try { plain(500, "The brain had a problem (server)."); } catch (x) { /* already closed */ } }
  finally { console.log(redact(`danit-site-brain guide=${GUIDE_NAME} mode=${mode()} msgs=${nmsg} ttfb=${ttfb}ms total=${Date.now() - t0}ms stop=${stop}${extra} status=${status}`)); }
}
