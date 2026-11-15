# Third-party notices

## Included in this repository

**`worker-tts_v39.mjs`** is a modified copy of `modules/worker-tts.mjs` of **HeadTTS 1.3.0**
(https://github.com/met4citizen/HeadTTS), MIT License. The changes are marked in the file ("LFMA capture", "LFMA v39"):
its two imports point at the package's own files on the CDN, and read-only copies of the voice model's timings travel
with each audio message. Nothing the voice computes, says or encodes is changed. The license of HeadTTS:

```
MIT License

Copyright (c) 2025 Mika Suominen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Loaded at run time (not included here; each under its own license)

- three.js 0.180.0 (cdn.jsdelivr.net)
- @met4citizen/headtts 1.3 - the voice engine; it loads the Kokoro voice model and the voice "af_bella" from Hugging Face
- @huggingface/transformers 4.3.2 with the speech recogniser onnx-community/moonshine-base-ONNX (Hugging Face)
- @ricky0123/vad-web 0.0.31 (Silero voice activity detection)
- onnxruntime-web 1.22.0

## On the server

- @anthropic-ai/sdk, installed by the host from npm.
