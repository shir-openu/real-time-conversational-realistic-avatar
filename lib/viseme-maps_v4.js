/* viseme-maps_v4.js
 * -----------------------------------------------------------------------------
 * v4: hybrid heads (her own keys + CC keys) - CC family only for idle when the convention is cc
 *
 * One vocabulary (the 15 Oculus visemes) mapped onto the three blendshape naming
 * conventions a GLB can arrive in. Pure data + pure functions. No imports, no DOM.
 * This file ports to Dart almost line for line.
 *
 *   OCULUS  - Ready Player Me, Avaturn, TalkingHead. Names look like viseme_aa.
 *   CC      - Reallusion Character Creator 5 / iClone. Names look like V_Open.
 *   ARKIT   - Apple / Headshot / most scanned heads. Names look like jawOpen.
 *
 * A model may carry more than one set. resolveConvention() picks the richest.
 *
 * -----------------------------------------------------------------------------
 * V2 (S2 iteration 1, 2026-11-02): a NEW file. The original (WEB_LIPSYNC\viseme-maps.js)
 * is untouched. Everything above and below this banner down to the end of the
 * original code is the original code, with these exceptions only:
 *   - this banner and the CC_MAP comment (comments only),
 *   - LEGACY8_MAP was added and CONVENTIONS gained a 'legacy8' key.
 * Every original export keeps its name and behaviour. The V2 additions (the
 * 4th convention 'legacy8', name normalisation, the name index, coverage-based
 * convention detection, idle-life aliases) are appended at the END of the file.
 *
 *   LEGACY8 - Our auto-rigged 8-shape Danit models (mouthOpen, jawOpen,
 *             mouthPucker, mouthFunnel, mouthSmile, eyeBlinkLeft/Right,
 *             browRaise). This is the exact MIX table of live_talk_v18_FIXED.html.
 *
 * Iteration 2 (after the real CC5 export exists) only needs to edit DATA here:
 * CC_MAP, IDLE_ALIASES, LEADING_PREFIXES. No logic has to change.
 *
 * -----------------------------------------------------------------------------
 * V3 (S2 iteration 2, 2026-11-02): a NEW file, a copy of viseme-maps_v2.js with
 * the real CC5 names (CONFIRMED from the CC5 export of 2026-11-02: the GLB files
 * cc5_default_v001.glb and danit_cc5_v002.glb, names listed in
 * CC5-MORPH-NAMES.txt and DANIT-CC5-V002-MORPH-NAMES.txt). Every v2 export keeps
 * its name and behaviour. What changed versus v2:
 *   - CC_MAP: the real GLB spellings ('V_Tongue_Curl_U', was 'V_Tongue_Curl-U');
 *     'sil' maps to V_None at weight 0 (rest). V_None itself is NOT in the GLB:
 *     the CC5 import drops it as an empty shape key, so nothing is driven for sil.
 *   - IDLE_ALIASES: Jaw_Open first in jawOpen; the CC5 blink names marked
 *     CONFIRMED; browUp gained Brow_Raise_In_L/R and Brow_Raise_Outer_L/R;
 *     new group browDown (Brow_Down_L/R, available for later emotion, the idle
 *     life does not use it yet). The old CC-style GUESSES that the real export
 *     does not contain are kept as harmless fallbacks for other exporters and
 *     are marked "NOT in the CC5 export".
 *   - resolveConvention() (the v1 probe resolver, kept for old callers): a chord
 *     whose weights are all 0 (sil -> V_None 0) counts as "needs no shape", so
 *     its answers are identical to v2's on every v2 input. One filter, one line.
 *   - NEW exports: mappingInUse() (the per-viseme mapping shown in the page panel)
 *     and mouthShapeCandidates() (which shapes the page's face finder tries, so
 *     the page needs no hard-coded names).
 * -----------------------------------------------------------------------------
 * V4 (S5, 2026-11-02): a NEW file, a copy of viseme-maps_v3.js. Every v3 export keeps
 * its name and its behaviour (tests\test-viseme-maps-v4.mjs compares them one by one).
 * Why: the hybrid Danit head (assets\danit_FIXED_v001_cc5faces_v010.glb) carries BOTH
 * families: her own 8 shape keys (mouthOpen, jawOpen, mouthPucker, mouthFunnel,
 * mouthSmile, eyeBlinkLeft, eyeBlinkRight, browRaise) and 50 CC5 face shapes. The v3
 * idle aliases return the UNION of every match (and normalizeName() makes 'Jaw_Open'
 * and 'jawOpen' one key), so the idle life of a hybrid head would drive her old keys
 * too. v4 adds, at the END of the file (nothing above is edited):
 *   - resolveExactFirst(): an alias that the head has spelled EXACTLY (case-sensitive)
 *     takes only that spelling; only otherwise the normalised v3 lookup is used.
 *   - IDLE_CC_ONLY: the CC5 names of the idle channels (blink, brows, jaw).
 *   - resolveIdleChannels(): for convention 'cc' the idle channels use the CC family
 *     only ('cc-only'); every other convention keeps the v3 union exactly ('union').
 * -----------------------------------------------------------------------------
 */

export const VISEMES = [
  'sil', 'PP', 'FF', 'TH', 'DD', 'kk',
  'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'
];

/* --- 1. Oculus: one blendshape per viseme, straight through ---------------- */

export const OCULUS_MAP = Object.freeze(
  VISEMES.reduce((m, v) => { m[v] = { ['viseme_' + v]: 1 }; return m; }, {})
);

/* --- 2. Reallusion Character Creator 5 / iClone ----------------------------
 * Built from the CC "V_" morph list. This mapping is MY construction, not an
 * official Reallusion table - the shapes are theirs, the assignment is mine.
 * Adjust the weights here if a character's mouth reads wrong; nothing else
 * in the system needs to change.
 *
 * CONFIRMED from CC5 export 2026-11-02: every shape name below is spelled exactly
 * as it arrives in the GLB (cc5_default_v001.glb and danit_cc5_v002.glb, see
 * CC5-MORPH-NAMES.txt). The 15 V_ shapes of the export are V_Open V_Explosive
 * V_Dental_Lip V_Tight V_Tight_O V_Wide V_Affricate V_Lip_Open V_Tongue_up
 * V_Tongue_Raise V_Tongue_Out V_Tongue_Narrow V_Tongue_Lower V_Tongue_Curl_U
 * V_Tongue_Curl_D; this table uses 12 of them (V_Tongue_Narrow, V_Tongue_Lower
 * and V_Tongue_Curl_D are not mapped yet). The names are CONFIRMED; the weights
 * and the viseme-to-shape assignment are still a construction, tune them here.
 * V_None (the neutral viseme) is not in the GLB (empty shape key, dropped by the
 * CC5 import), so 'sil' drives nothing: V_None at weight 0 means REST.
 */

export const CC_MAP = Object.freeze({
  sil: { 'V_None': 0.0 },
  PP:  { 'V_Explosive': 1.0 },
  FF:  { 'V_Dental_Lip': 1.0 },
  TH:  { 'V_Tongue_Out': 0.7, 'V_Lip_Open': 0.3 },
  DD:  { 'V_Tongue_up': 0.7, 'V_Lip_Open': 0.3 },
  kk:  { 'V_Tongue_Raise': 0.6, 'V_Lip_Open': 0.35 },
  CH:  { 'V_Affricate': 1.0 },
  SS:  { 'V_Tight': 0.9 },
  nn:  { 'V_Tongue_up': 0.8, 'V_Lip_Open': 0.15 },
  RR:  { 'V_Tongue_Curl_U': 0.7, 'V_Tight_O': 0.25 },
  aa:  { 'V_Open': 1.0 },
  E:   { 'V_Wide': 0.75, 'V_Lip_Open': 0.3 },
  I:   { 'V_Wide': 0.95, 'V_Lip_Open': 0.15 },
  O:   { 'V_Tight_O': 0.75, 'V_Open': 0.3 },
  U:   { 'V_Tight_O': 1.0 }
});

/* --- 3. ARKit 52 ----------------------------------------------------------
 * ARKit has no viseme shapes, so each viseme is a chord of muscle shapes.
 * Left/right pairs are written out because many exporters keep them separate.
 */

const LR = (base, w) => ({ [base + 'Left']: w, [base + 'Right']: w });

export const ARKIT_MAP = Object.freeze({
  sil: {},
  PP:  { mouthClose: 0.85, ...LR('mouthPress', 0.35) },
  FF:  { mouthRollLower: 0.55, mouthShrugUpper: 0.30, jawOpen: 0.12 },
  TH:  { tongueOut: 0.55, jawOpen: 0.22 },
  DD:  { jawOpen: 0.20, tongueOut: 0.06 },
  kk:  { jawOpen: 0.24, mouthShrugUpper: 0.10 },
  CH:  { mouthFunnel: 0.50, mouthPucker: 0.40, jawOpen: 0.20 },
  SS:  { ...LR('mouthStretch', 0.35), jawOpen: 0.08 },
  nn:  { jawOpen: 0.12, tongueOut: 0.04 },
  RR:  { mouthPucker: 0.32, jawOpen: 0.20 },
  aa:  { jawOpen: 0.65 },
  E:   { jawOpen: 0.30, ...LR('mouthStretch', 0.35) },
  I:   { jawOpen: 0.18, ...LR('mouthStretch', 0.50), ...LR('mouthSmile', 0.15) },
  O:   { jawOpen: 0.42, mouthFunnel: 0.60, mouthPucker: 0.28 },
  U:   { jawOpen: 0.18, mouthPucker: 0.75, mouthFunnel: 0.40 }
});

/* --- 4. LEGACY8: our auto-rigged 8-shape Danit models (V2 addition) ---------
 * The exact MIX table from live_talk_v18_FIXED.html (lines 163-179): same keys,
 * same numbers. The 8 shapes of danit_FIXED_v001.glb are mouthOpen, jawOpen,
 * mouthPucker, mouthFunnel, mouthSmile, eyeBlinkLeft, eyeBlinkRight, browRaise;
 * only the first five are mouth shapes. tests\test-viseme-maps-v2.mjs checks
 * this table against the v18 source text, so it cannot drift silently.
 */

export const LEGACY8_MAP = Object.freeze({
  sil: {},
  aa : { jawOpen:1.00, mouthOpen:0.85 },
  E  : { jawOpen:0.45, mouthOpen:0.35, mouthSmile:0.50 },
  I  : { jawOpen:0.25, mouthOpen:0.20, mouthSmile:0.70 },
  O  : { jawOpen:0.60, mouthOpen:0.45, mouthPucker:0.50, mouthFunnel:0.40 },
  U  : { jawOpen:0.18, mouthPucker:1.00, mouthFunnel:0.60 },
  PP : { mouthPucker:0.15 },
  FF : { jawOpen:0.12, mouthFunnel:0.70 },
  TH : { jawOpen:0.28, mouthOpen:0.32 },
  DD : { jawOpen:0.30, mouthOpen:0.35 },
  kk : { jawOpen:0.35, mouthOpen:0.30 },
  CH : { jawOpen:0.20, mouthFunnel:0.60, mouthPucker:0.40 },
  SS : { jawOpen:0.10, mouthSmile:0.45 },
  nn : { jawOpen:0.22, mouthOpen:0.25 },
  RR : { jawOpen:0.25, mouthPucker:0.50, mouthFunnel:0.30 }
});

export const CONVENTIONS = Object.freeze({
  oculus: OCULUS_MAP,
  cc:     CC_MAP,
  arkit:  ARKIT_MAP,
  legacy8: LEGACY8_MAP
});

/* Probe shapes used only to decide which convention a model speaks. */
const PROBES = {
  oculus: ['viseme_aa', 'viseme_PP', 'viseme_O'],
  cc:     ['V_Open', 'V_Explosive', 'V_Tight_O'],
  arkit:  ['jawOpen', 'mouthPucker', 'mouthFunnel']
};

/**
 * Decide which convention a set of blendshape names belongs to.
 * @param {string[]} names  every morph target name found in the GLB
 * @returns {{convention:string|null, scores:Object, coverage:number, missing:string[]}}
 */
export function resolveConvention(names) {
  const have = new Set(names);
  const scores = {};
  for (const key of Object.keys(PROBES)) {
    scores[key] = PROBES[key].filter(n => have.has(n)).length;
  }
  let convention = null, best = 0;
  for (const key of Object.keys(scores)) {
    if (scores[key] > best) { best = scores[key]; convention = key; }
  }
  if (!convention) return { convention: null, scores, coverage: 0, missing: VISEMES.slice() };

  // How many of the 15 visemes can actually be driven on this model?
  const map = CONVENTIONS[convention];
  const missing = [];
  let ok = 0;
  for (const v of VISEMES) {
    const targets = Object.keys(map[v] || {}).filter(t => map[v][t] !== 0);   // V3: a zero-weight entry (sil -> V_None 0) needs no shape
    if (targets.length === 0) { ok++; continue; }              // sil needs nothing
    if (targets.some(t => have.has(t))) ok++; else missing.push(v);
  }
  return { convention, scores, coverage: ok / VISEMES.length, missing };
}

/**
 * Turn {viseme: weight} into {blendshapeName: weight} for one convention.
 * Overlapping chords take the max, never the sum, so two visemes that both
 * push jawOpen do not slam the jaw to 2.0.
 */
export function visemeWeightsToShapes(visemeWeights, convention) {
  const map = CONVENTIONS[convention] || OCULUS_MAP;
  const out = {};
  for (const v of Object.keys(visemeWeights)) {
    const w = visemeWeights[v];
    if (!w) continue;
    const chord = map[v];
    if (!chord) continue;
    for (const shape of Object.keys(chord)) {
      const val = chord[shape] * w;
      if (!(shape in out) || val > out[shape]) out[shape] = val;
    }
  }
  return out;
}

/* =============================================================================
 * V2 ADDITIONS (S2 iteration 1). Everything from here to the end of the file is
 * new. Pure data + pure functions, same as above.
 * =========================================================================== */

/* Tie order when two conventions drive the same number of visemes. */
export const CONVENTION_ORDER = Object.freeze(['oculus', 'cc', 'arkit', 'legacy8']);

/* Probe shapes per convention. Informational only: resolveConventionV2() decides
 * by coverage, not by probes. The legacy8 probes are none of the ARKit names. */
export const CONVENTION_PROBES = Object.freeze({
  oculus:  PROBES.oculus.slice(),
  cc:      PROBES.cc.slice(),
  arkit:   PROBES.arkit.slice(),
  legacy8: ['mouthOpen', 'mouthSmile', 'browRaise']
});

/* --- name normalisation + index ---------------------------------------------
 * A GLB exporter may change case, add a mesh qualifier ("CC_Base_Body.V_Open",
 * "Mesh.V_Open", "Object|V_Open") or swap separators ("V_Tongue_Curl-U"). We
 * compare names in a normalised form so canonical names resolve regardless.
 */

/* Leading prefixes dropped (one at most, longest first). DATA: extendable. */
export const LEADING_PREFIXES = Object.freeze(['cc_base_', 'cc_']);

/* A '.'-tail like ".001" (Blender duplicate counter) or ".L" / ".Left" is a
 * SUFFIX, not an object qualifier, so it must not be cut off the name. */
const SUFFIX_TAIL = /^(\d+|l|r|left|right)$/;

/**
 * normalizeName('CC_Base_Body.V_Tongue_Curl-U') === 'vtonguecurlu'
 *   1. lowercase
 *   2. drop an object/mesh qualifier: everything up to the last '.' or '|'
 *      ("mesh.", "object|", "cc_base_body.") unless the tail is a suffix token
 *   3. drop one leading "cc_base_" or "cc_"
 *   4. remove every non-alphanumeric character
 */
export function normalizeName(n) {
  let s = String(n).toLowerCase();
  const cut = Math.max(s.lastIndexOf('.'), s.lastIndexOf('|'));
  if (cut >= 0) {
    const tail = s.slice(cut + 1);
    if (tail && !SUFFIX_TAIL.test(tail)) s = tail;
  }
  for (const p of LEADING_PREFIXES) {
    if (s.startsWith(p) && s.length > p.length) { s = s.slice(p.length); break; }
  }
  return s.replace(/[^a-z0-9]/g, '');
}

/**
 * Map(normalizedName -> [actual names as they appear in the model]).
 * Duplicates are dropped; first-seen order is kept.
 * @param {Iterable<string>} actualNames
 */
export function buildNameIndex(actualNames) {
  const index = new Map();
  for (const name of actualNames || []) {
    if (typeof name !== 'string') continue;
    const key = normalizeName(name);
    if (!key) continue;
    const bucket = index.get(key);
    if (!bucket) index.set(key, [name]);
    else if (!bucket.includes(name)) bucket.push(name);
  }
  return index;
}

/**
 * Which of these canonical/alias names does the model actually have?
 * @param {string[]|string} aliasList  names to look for (any spelling)
 * @param {Map|Iterable<string>} nameIndex  from buildNameIndex(), or the raw names
 * @returns {string[]} actual names present, in alias order, no duplicates
 */
export function resolveAliases(aliasList, nameIndex) {
  const index = nameIndex instanceof Map ? nameIndex : buildNameIndex(nameIndex);
  const list = typeof aliasList === 'string' ? [aliasList] : (aliasList || []);
  const out = [];
  for (const alias of list) {
    const hits = index.get(normalizeName(alias));
    if (!hits) continue;
    for (const actual of hits) if (!out.includes(actual)) out.push(actual);
  }
  return out;
}

/**
 * Decide which convention a head speaks, by COVERAGE (not by probes).
 * For each convention: coverage = drivable visemes / 15. A viseme is drivable
 * when at least one of its chord shapes exists in the model (names compared
 * after normalizeName). 'sil' always counts. The highest coverage wins; ties go
 * oculus > cc > arkit > legacy8. If nothing beats the free 'sil' (1/15) the
 * answer is convention null.
 * @param {Iterable<string>|Map} names  every morph target name in the GLB (or a built index)
 * @returns {{convention:string|null, coverage:number, drivable:number, total:number,
 *            missing:string[], perConvention:Object}}
 */
export function resolveConventionV2(names) {
  const index = names instanceof Map ? names : buildNameIndex(names);
  const total = VISEMES.length;
  const perConvention = {};
  for (const key of CONVENTION_ORDER) {
    const map = CONVENTIONS[key];
    const missing = [];
    let drivable = 0;
    for (const v of VISEMES) {
      const shapes = Object.keys(map[v] || {});
      if (v === 'sil' || shapes.length === 0) { drivable++; continue; }   // sil needs nothing
      if (shapes.some(s => resolveAliases(s, index).length > 0)) drivable++; else missing.push(v);
    }
    const probes = CONVENTION_PROBES[key].filter(p => resolveAliases(p, index).length > 0).length;
    perConvention[key] = { coverage: drivable / total, drivable, missing, probes };
  }
  let convention = null, best = 1;             // 'sil' alone (1/15) never wins
  for (const key of CONVENTION_ORDER) {        // strict '>' keeps the earlier one on a tie
    if (perConvention[key].drivable > best) { best = perConvention[key].drivable; convention = key; }
  }
  if (!convention) {
    return { convention: null, coverage: 0, drivable: 0, total,
             missing: VISEMES.filter(v => v !== 'sil'), perConvention };
  }
  const r = perConvention[convention];
  return { convention, coverage: r.coverage, drivable: r.drivable, total,
           missing: r.missing.slice(), perConvention };
}

/* --- idle life: blink, brow, jaw -------------------------------------------
 * Alias lists, in priority order. DATA. Names are matched through
 * normalizeName(), so case, underscores and "CC_Base_*" prefixes do not matter
 * (that also means 'Jaw_Open' and 'jawOpen' are ONE key: the order of those two
 * changes the documentation, not what a head resolves to).
 *
 * V3: every entry the real CC5 export contains is marked CONFIRMED (checked
 * against CC5-MORPH-NAMES.txt on 2026-11-02). The old CC-style guesses that the
 * export does NOT contain are marked "NOT in the CC5 export"; they stay in the
 * lists as harmless fallbacks for other exporters (a name that no head has
 * resolves to nothing).
 */
export const IDLE_ALIASES = {
  blinkL: [
    'eyeBlinkLeft',        // ARKit / Oculus heads (verified on brunette.glb and danit_FIXED_v001.glb)
    'eyeBlink_L',          // facecap-style ARKit
    'Eye_Blink_L',         // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body, CC_Base_EyeOcclusion, CC_Base_TearLine, lash cards)
    'EyeBlink_L',          // CC-style guess: NOT in the CC5 export (checked 2026-11-02; same normalised key as Eye_Blink_L, so it adds nothing)
    'Eye_Blink_Left'       // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
  ],
  blinkR: [
    'eyeBlinkRight',       // ARKit / Oculus heads (verified on brunette.glb and danit_FIXED_v001.glb)
    'eyeBlink_R',          // facecap-style ARKit
    'Eye_Blink_R',         // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body, CC_Base_EyeOcclusion, CC_Base_TearLine, lash cards)
    'EyeBlink_R',          // CC-style guess: NOT in the CC5 export (checked 2026-11-02; same normalised key as Eye_Blink_R, so it adds nothing)
    'Eye_Blink_Right'      // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
  ],
  blinkBoth: [
    'eyesClosed',          // ARKit / Oculus heads (present on brunette.glb)
    'Eye_Blink',           // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'Eyes_Blink'           // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
  ],
  browUp: [
    'browInnerUp',         // ARKit / Oculus heads (present on brunette.glb)
    'browRaise',           // legacy8 (danit_FIXED_v001.glb)
    'Brow_Raise_In_L',     // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'Brow_Raise_In_R',     // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'Brow_Raise_Outer_L',  // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'Brow_Raise_Outer_R',  // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'Brow_Raise_Inner_L',  // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'Brow_Raise_Inner_R',  // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'Brow_Raise_L',        // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'Brow_Raise_R',        // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'browOuterUpLeft',     // ARKit / Oculus heads (present on brunette.glb)
    'browOuterUpRight'     // ARKit / Oculus heads (present on brunette.glb)
  ],
  browDown: [              // V3: available for later emotion; the idle life does NOT use it yet
    'Brow_Down_L',         // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'Brow_Down_R'          // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
  ],
  jawOpen: [
    'Jaw_Open',            // CC5: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body). Same normalised key as 'jawOpen' (ARKit / Oculus / legacy8 heads)
    'jawOpen',             // ARKit / Oculus / legacy8 heads
    'Mouth_Open',          // CC-style guess: NOT in the CC5 export (checked 2026-11-02), fallback for other exporters
    'mouthOpen',           // legacy8 / Oculus-RPM heads
    'V_Open',              // CC5 viseme: CONFIRMED from CC5 export 2026-11-02 (CC_Base_Body)
    'viseme_aa'            // Oculus heads
  ]
};

/* --- V3: which shapes does the page's face finder try? ---------------------------
 * The page finds the mouth from the vertices that a mouth shape moves. Instead of
 * a hard-coded name list it asks this function, which returns ACTUAL morph names of
 * the loaded head, in priority order:
 *   1. the head's own jaw / mouth-open shapes (IDLE_ALIASES.jawOpen resolved: on a
 *      CC5 head 'Jaw_Open' then 'V_Open'),
 *   2. the shapes of the convention's 'aa' chord, then of every other viseme chord
 *      (heaviest weight first), whatever exists on the head.
 * @param {string} convention  'oculus' | 'cc' | 'arkit' | 'legacy8' | null
 * @param {Map|Iterable<string>} nameIndex  from buildNameIndex(), or the raw names
 * @returns {string[]} actual names, no duplicates
 */
export function mouthShapeCandidates(convention, nameIndex) {
  const index = nameIndex instanceof Map ? nameIndex : buildNameIndex(nameIndex);
  const out = [];
  const add = list => { for (const n of list) if (!out.includes(n)) out.push(n); };
  add(resolveAliases(IDLE_ALIASES.jawOpen, index));
  const map = CONVENTIONS[convention];
  if (map) {
    const order = ['aa', ...VISEMES.filter(v => v !== 'aa' && v !== 'sil')];
    for (const v of order) {
      const shapes = Object.entries(map[v] || {}).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
      for (const s of shapes) add(resolveAliases(s, index));
    }
  }
  return out;
}

/* --- V3: the per-viseme mapping IN USE on a loaded head (shown in the page panel) ----
 * One row per viseme, with the ACTUAL morph names the head has, so a human can see
 * (and then tune in CC_MAP / OCULUS_MAP / ARKIT_MAP / LEGACY8_MAP) what really drives
 * the mouth. text looks like "aa -> V_Open" or "E -> V_Wide x0.75 + V_Lip_Open x0.30".
 * A zero-weight chord (sil -> V_None 0) reads "sil -> rest (V_None: not in this file)".
 * @returns {{viseme:string, rest:boolean, shapes:{canonical:string, weight:number, actual:string[]}[], missing:string[], text:string}[]}
 */
export function mappingInUse(convention, nameIndex) {
  const map = CONVENTIONS[convention];
  if (!map) return [];
  const index = nameIndex instanceof Map ? nameIndex : buildNameIndex(nameIndex);
  return VISEMES.map(viseme => {
    const chord = map[viseme] || {};
    const shapes = Object.keys(chord).map(canonical => ({ canonical, weight: chord[canonical], actual: resolveAliases(canonical, index) }));
    const rest = shapes.every(s => s.weight === 0);
    const missing = shapes.filter(s => s.actual.length === 0).map(s => s.canonical);
    let text;
    if (rest) {
      text = viseme + ' -> rest' + (shapes.length
        ? ' (' + shapes.map(s => s.canonical + ': ' + (s.actual.length ? s.actual.join('/') : 'not in this file')).join(', ') + ')'
        : '');
    } else {
      text = viseme + ' -> ' + shapes.filter(s => s.weight !== 0).map(s => {
        const name = s.actual.length ? s.actual.join('/') : s.canonical + ' (not in this file)';
        return s.weight === 1 ? name : name + ' x' + s.weight.toFixed(2);
      }).join(' + ');
    }
    return { viseme, rest, shapes, missing, text };
  });
}

/* =============================================================================
 * V4 ADDITIONS (S5, 2026-11-02). Everything from here to the end of the file is
 * new: hybrid heads (her own keys + CC keys). Pure data + pure functions, same as
 * above. Nothing above this banner was edited except the header comment.
 * =========================================================================== */

/**
 * Like resolveAliases(), but an alias that the head has spelled EXACTLY like the
 * alias (case-sensitive, character for character) takes only that spelling. Only
 * an alias without an exact spelling falls back to resolveAliases([alias], nameIndex),
 * the normalised lookup of v3. The hits are united in alias order, no duplicates.
 * Purpose: on a hybrid head that has both 'jawOpen' (hers) and 'Jaw_Open' (CC5) the
 * alias 'Jaw_Open' must not pull in 'jawOpen' (normalizeName() makes them one key).
 * @param {string[]|string} aliasList  names to look for
 * @param {Map|Iterable<string>} nameIndex  from buildNameIndex(), or the raw names
 * @param {Iterable<string>} [actualNames]  every morph name of the head as it is spelled
 *                                          in the file (default: all names the index holds)
 * @returns {string[]} actual names present, in alias order, no duplicates
 */
export function resolveExactFirst(aliasList, nameIndex, actualNames) {
  const index = nameIndex instanceof Map ? nameIndex : buildNameIndex(nameIndex);
  const have = new Set(actualNames === undefined || actualNames === null ? [...index.values()].flat() : actualNames);
  const list = typeof aliasList === 'string' ? [aliasList] : (aliasList || []);
  const out = [];
  for (const alias of list) {
    const hits = have.has(alias) ? [alias] : resolveAliases([alias], index);
    for (const actual of hits) if (!out.includes(actual)) out.push(actual);
  }
  return out;
}

/* --- idle channels, CC family only ------------------------------------------------
 * The CC5 names of the idle channels, in the same six groups as IDLE_ALIASES. DATA.
 * Every name is CONFIRMED from the CC5 export 2026-11-02 (CC5-MORPH-NAMES.txt) and is
 * present in assets\danit_FIXED_v001_cc5faces_v010.glb. blinkBoth stays empty: CC5
 * has only the two single-eye blinks.
 */
export const IDLE_CC_ONLY = {
  blinkL: ['Eye_Blink_L'],            // CC5: CONFIRMED from CC5 export 2026-11-02
  blinkR: ['Eye_Blink_R'],            // CC5: CONFIRMED from CC5 export 2026-11-02
  blinkBoth: [],
  browUp: [
    'Brow_Raise_In_L',                // CC5: CONFIRMED from CC5 export 2026-11-02
    'Brow_Raise_In_R',                // CC5: CONFIRMED from CC5 export 2026-11-02
    'Brow_Raise_Outer_L',             // CC5: CONFIRMED from CC5 export 2026-11-02
    'Brow_Raise_Outer_R'              // CC5: CONFIRMED from CC5 export 2026-11-02
  ],
  browDown: [
    'Brow_Down_L',                    // CC5: CONFIRMED from CC5 export 2026-11-02
    'Brow_Down_R'                     // CC5: CONFIRMED from CC5 export 2026-11-02
  ],
  jawOpen: ['Jaw_Open']               // CC5: CONFIRMED from CC5 export 2026-11-02
};

/**
 * The idle channels (blink, brows, jaw) of a head, one family per channel.
 *   convention === 'cc': each channel = resolveExactFirst(IDLE_CC_ONLY[k]) when that gives
 *     at least one name (family 'cc-only'), otherwise the v3 resolveAliases(IDLE_ALIASES[k])
 *     (family 'union'). When blinkL and blinkR are both 'cc-only', blinkBoth is [] and is
 *     labelled 'cc-only' too (the CC rule decided it).
 *   any other convention (or none): every channel = resolveAliases(IDLE_ALIASES[k]) exactly
 *     as in v3 (family 'union').
 * @param {string|null} convention  'oculus' | 'cc' | 'arkit' | 'legacy8' | null
 * @param {Map|Iterable<string>} nameIndex  from buildNameIndex(), or the raw names
 * @param {Iterable<string>} [actualNames]  every morph name of the head as spelled in the file
 * @returns {{channels:{blinkL:string[], blinkR:string[], blinkBoth:string[], browUp:string[], browDown:string[], jawOpen:string[]},
 *            family:{blinkL:string, blinkR:string, blinkBoth:string, browUp:string, browDown:string, jawOpen:string}}}
 */
export function resolveIdleChannels(convention, nameIndex, actualNames) {
  const index = nameIndex instanceof Map ? nameIndex : buildNameIndex(nameIndex);
  const channels = {}, family = {};
  for (const k of Object.keys(IDLE_ALIASES)) {
    let names = [], fam = 'union';
    if (convention === 'cc') {
      const only = resolveExactFirst(IDLE_CC_ONLY[k] || [], index, actualNames);
      if (only.length >= 1) { names = only; fam = 'cc-only'; }
    }
    if (fam === 'union') names = resolveAliases(IDLE_ALIASES[k], index);
    channels[k] = names; family[k] = fam;
  }
  if (convention === 'cc' && family.blinkL === 'cc-only' && family.blinkR === 'cc-only') {
    channels.blinkBoth = []; family.blinkBoth = 'cc-only';
  }
  return { channels, family };
}
