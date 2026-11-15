# Real-Time Conversational Realistic Avatar

Talk live with **Danit**, a realistic 3D avatar, in the browser:
**https://shir-openu.github.io/real-time-conversational-realistic-avatar/**

- Press the button and speak, or type. Your speech becomes text in your own browser.
- The question goes to a small server (`api/`), which asks the Claude API for a short spoken answer.
- Danit says the answer in her own voice, generated in the browser, and her face moves with the words.
- You can turn her with the mouse.

Best on a desktop Chrome or Edge with WebGPU. The first visit downloads about 500 MB (her 3D model, her voice and the
speech recogniser); later visits use the browser's cache.

## What runs where

| Part | Where it runs | With |
|---|---|---|
| The page, her 3D model | GitHub Pages | three.js |
| Speech to text | the visitor's browser | Moonshine (transformers.js, WebGPU), Silero VAD |
| Her voice and lip-sync timings | the visitor's browser | HeadTTS (Kokoro) |
| Her answers | `api/` on Vercel | Claude API, official SDK; the key lives only in the host's environment |

## Files

- `index.html` - the public page. It is the workshop page `live_talk_v39_cc5.html` with two places changed (the title, and one
  block after `<body>`: the address gate, the keep-awake of the sound device and the footer line), made by
  `tools/build_public_page.mjs`. The keep-awake: a browser closes a page's sound stream after 30 seconds of silence and
  opens it again only when sound begins, and the device's wake-up then swallows the beginning of her answer. From a
  press or key until two minutes after the last one (or after her last word) the page plays a 5 Hz tone at 0.0001 of
  full scale - far under hearing - so the stream stays open.
- `worker-tts_v39.mjs`, `lib/viseme-maps_v4.js` - the page's own voice worker and its mouth-shape tables.
- `assets/` - Danit's 3D model.
- `api/`, `brain/` - the answering server: the origin rule, the limits of a public address, her guide and what she knows
  about the portfolio page. `brain/brain-core.mjs` is the workshop proxy's core, unchanged.
- `tools/local-brain.mjs` - the same server on 127.0.0.1 for tests (echo mode, no key).
- `privacy.html` - what happens to what a visitor says.

## Rights

See [RIGHTS.md](RIGHTS.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
