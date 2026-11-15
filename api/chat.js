// POST /api/chat  { messages: [{ role, content } ...] }  ->  Danit's answer as a plain text stream. The work is in brain/site-brain.mjs.
import { handleChat } from "../brain/site-brain.mjs";

export const config = { supportsResponseStreaming: true };
export default handleChat;
