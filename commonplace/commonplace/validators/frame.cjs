'use strict';
// FRAME redundancy detector — enforces the deterministic half of FIELD_ROLES_SPEC.md §6.
//
// The three "frame" fields the reader meets in sequence before the article proper —
//   summary  (the DEFINITION)  →  hook (the PULL)  →  layer-opening (the START OF THE READ)
// — must ADVANCE, not repeat. Across the 1,000-entry corpus they had drifted into the same
// compressed mini-essay, so the reader met the same paragraph two or three times. This check
// is the cheap floor that keeps NEW entries from being born that way.
//
// Metric: overlap(hook, X) = |content-tokens(hook) ∩ content-tokens(X)| / |content-tokens(hook)|
//   over lowercased words > 3 chars, stopword-filtered. We score the hook against BOTH the
//   summary and the general-layer opening paragraph and flag on the MAX.
//
// This is HIGH-RECALL, LOW-PRECISION on purpose — a triage FLOOR, advisory only (`warn`).
//   * It MISSES paraphrase (different words, same idea) — that is the LLM audit's job
//     (hook_audit.cjs, FIELD_ROLES_SPEC §6.3).
//   * It OVER-flags same-subject entries whose hook and summary legitimately share proper
//     nouns (a las-Casas hook and a las-Casas summary share "casas / spanish / indians"
//     no matter how differently they are framed). So a flag is a REQUEST TO RE-READ against
//     §3, not a verdict. Never auto-rewrite on this signal alone.
//
// Threshold (warn cutoff) chosen from the post-remediation corpus distribution (2026-07-06):
//   >=0.45: 15 entries | 0.40-0.45: ~14 | 0.35-0.40: ~41 | <0.35: long tail.
//   0.40 sits at the knee — it surfaces the ~29 worst restatements for review and leaves the
//   subject-vocabulary noise below it quiet. Tune via rules/style.json → frame.warnAt.

const STOP = new Set(('a an the and or but for nor so yet of to in on at by with from as into about over under is are was were be been being it its this that these those they them their he she his her we us our you your not no than then there which who what when where how all any more most such only same too very has have had will would can could did does done made make making after before during between against without within across around through then also who whom whose'.split(/\s+/)));

function contentTokens(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w));
}
function overlap(a, b) {
  const A = new Set(contentTokens(a));
  if (!A.size) return 0;
  const B = new Set(contentTokens(b));
  let n = 0; for (const t of A) if (B.has(t)) n++;
  return n / A.size;
}
function generalOpening(entry) {
  const g = entry.content && entry.content.general;
  if (!g || typeof g !== 'object') return '';
  const k = Object.keys(g)[0];
  return k ? String(g[k] || '').split('\n\n')[0] : '';
}

module.exports = function frameRedundancy(entry, ctx) {
  const cfg = (ctx.rules && ctx.rules.frame) || {};
  const warnAt = cfg.warnAt != null ? cfg.warnAt : 0.40;
  const hook = entry.hook, summary = entry.summary;
  if (!hook || !summary) return [];   // required-field checks own the missing case

  const hSum = overlap(hook, summary);
  const hGen = overlap(hook, generalOpening(entry));
  const worst = Math.max(hSum, hGen);
  if (worst < warnAt) return [];

  const which = hSum >= hGen
    ? `hook ↔ summary (${(hSum * 100).toFixed(0)}% of the hook's distinctive words also lead the summary)`
    : `hook ↔ general-opening (${(hGen * 100).toFixed(0)}% of the hook's distinctive words reappear in the opening paragraph)`;
  return [{
    id: 'frame.echo',
    message: `Frame redundancy — ${which}. The frame must advance, not repeat (FIELD_ROLES_SPEC §3): summary = the definition, hook = the pull, opening = the start of the read. Re-read the three against §2's one-line tests and fix the field doing the WRONG job — NOT necessarily the better-written one. (Deterministic floor: shared proper nouns can inflate this; confirm it is a real restatement, not just a shared subject, before editing.)`
  }];
};
