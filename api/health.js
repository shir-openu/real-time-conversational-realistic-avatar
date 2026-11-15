// GET /api/health  ->  { ok, mode, model }: the page asks this before it offers the talk. The work is in brain/site-brain.mjs.
import { handleHealth } from "../brain/site-brain.mjs";

export default handleHealth;
