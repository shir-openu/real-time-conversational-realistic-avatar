// danit-brain core (v33): the pure parts of the proxy: validation, the request to Claude, the echo reply, error mapping, the stream forwarding.
// No key, no file access and no network here: the key and the SDK client live in server.mjs; the unit tests (test-core.mjs) use a fake client.
// SDK usage is exactly the one of the bundled Claude API docs (typescript/claude-api/README.md + shared/model-migration.md): client.beta.messages.stream(...),
// output_config.effort, betas ["server-side-fallback-2026-07-01"] with fallbacks "default", top-level cache_control, stream.finalMessage().
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";                 // one constant: Shir may change it (a faster or cheaper model is this one line)
export const MAX_HISTORY = 20;                          // the last 20 messages
export const MAX_MESSAGE_CHARS = 4000;                  // one message (a spoken sentence or two is far less)
export const REFUSAL_LINE = "Sorry, I can't help with that one.";
export const ALLOWED_ORIGINS = ["http://127.0.0.1:8092", "http://127.0.0.1:8093"];
export const ECHO_SUFFIX = "My brain is not connected yet.";

// ---- the body of POST /api/chat: {messages:[{role, content}...]} -> the last 20, the first a user message, roles alternate, the last a user message
export function validateChatBody(body) {
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return { ok: false, text: "bad request: messages must be an array" };
  let m = body.messages;
  if (m.length === 0) return { ok: false, text: "bad request: no messages" };
  for (const x of m) {
    if (!x || typeof x !== "object" || (x.role !== "user" && x.role !== "assistant") || typeof x.content !== "string") return { ok: false, text: "bad request: every message needs a role (user or assistant) and a text" };
    if (x.content.trim() === "") return { ok: false, text: "bad request: an empty message" };
    if (x.content.length > MAX_MESSAGE_CHARS) return { ok: false, text: "bad request: a message is too long" };
  }
  m = m.slice(-MAX_HISTORY).map(x => ({ role: x.role, content: x.content }));
  while (m.length && m[0].role !== "user") m.shift();                       // the window may start inside a turn: the first message must be a user message
  if (!m.length) return { ok: false, text: "bad request: the first message must be a user message" };
  for (let i = 1; i < m.length; i++) if (m[i].role === m[i - 1].role) return { ok: false, text: "bad request: the roles must alternate" };
  if (m[m.length - 1].role !== "user") return { ok: false, text: "bad request: the last message must be a user message" };
  return { ok: true, messages: m };
}

// ---- the request to Claude (the shape of the spec; nothing else)
export function buildParams(messages, system) {
  return {
    model: MODEL,
    max_tokens: 4096,                                   // a cap only; the replies are short by the prompt; thinking counts toward it
    output_config: { effort: "low" },                   // Opus 5.5 thinking is always on; effort low keeps it short
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    cache_control: { type: "ephemeral" },               // automatic caching of the last cacheable block
    system,
    messages,
  };
}

// ---- ECHO mode: "You said: <text>. My brain is not connected yet." in a few chunks
export function echoText(messages) {
  const last = messages[messages.length - 1].content.replace(/\s+/g, " ").trim();
  return `You said: ${last}. ${ECHO_SUFFIX}`;
}
export function echoChunks(text) {
  const words = text.split(" "), per = Math.max(2, Math.ceil(words.length / 5)), out = [];
  for (let i = 0; i < words.length; i += per) out.push((i ? " " : "") + words.slice(i, i + per).join(" "));
  return out;
}

// ---- errors -> a short plain status line for the page (never a key, never a header)
export function mapError(err) {
  const st = err && typeof err.status === "number" ? err.status : null;
  if (err instanceof Anthropic.AuthenticationError || st === 401) return { status: 401, text: "The brain key was not accepted (401)." };
  if (err instanceof Anthropic.RateLimitError || st === 429) return { status: 429, text: "The brain is busy right now (429). Please try again in a moment." };
  if (err instanceof Anthropic.APIConnectionError) return { status: 502, text: "The brain could not be reached (network)." };
  if (st !== null && st >= 500) return { status: 502, text: `The brain had a problem (${st}).` };
  if (st !== null && st >= 400) return { status: 502, text: `The brain refused the request (${st}).` };
  return { status: 502, text: "The brain had a problem (network)." };
}

// ---- never log a key: any sk-ant-... run is replaced
export const redact = (s) => String(s).replace(/sk-ant-[A-Za-z0-9_-]{4,}/g, "[redacted]");

// ---- forward only the text of the stream; thinking and fallback blocks are not forwarded. sink = { begin(), write(text) } (begin is called lazily, at the first byte)
// Returns { stopReason, forwarded, firstByteMs, totalMs, model, fallback, usage }. An error before the first byte throws (the caller maps it to a status); after it the stream just ends.
// v33 part C: model = the model that produced the message (message.model), fallback = whether a server-side fallback ran, usage = token counts. The three signals are the ones of the bundled docs
// (shared/model-migration.md "Reading the response"): a content_block_start / content block of type "fallback" (a switch point) and a "fallback_message" entry in usage.iterations (the served-by signal).
export async function streamReply(client, params, sink, signal) {
  const t0 = Date.now(); let firstByteMs = null, forwarded = 0, fallbackSeen = false;
  const out = (text) => { if (!text) return; if (firstByteMs === null) { firstByteMs = Date.now() - t0; sink.begin(); } forwarded += text.length; sink.write(text); };
  const stream = client.beta.messages.stream(params, signal ? { signal } : undefined);
  let failed = null;
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") out(event.delta.text);
      else if (event.type === "content_block_start" && event.content_block && event.content_block.type === "fallback") fallbackSeen = true;
    }
  } catch (e) { failed = e; }
  if (failed && firstByteMs === null) throw failed;                         // nothing was sent yet: a real status can still be returned
  let stopReason = failed ? "error" : null, model = null, usage = null;
  if (!failed) {
    const final = await stream.finalMessage();
    stopReason = final.stop_reason; model = final.model || null;
    if (Array.isArray(final.content) && final.content.some(b => b && b.type === "fallback")) fallbackSeen = true;
    const its = final.usage && Array.isArray(final.usage.iterations) ? final.usage.iterations : [];
    if (its.some(e => e && e.type === "fallback_message")) fallbackSeen = true;
    if (final.usage) usage = { input: final.usage.input_tokens ?? null, output: final.usage.output_tokens ?? null, cacheRead: final.usage.cache_read_input_tokens ?? null, cacheWrite: final.usage.cache_creation_input_tokens ?? null };
    if (stopReason === "refusal") out((forwarded ? " " : "") + REFUSAL_LINE);
  }
  return { stopReason, forwarded, firstByteMs, totalMs: Date.now() - t0, model, fallback: fallbackSeen, usage };
}
