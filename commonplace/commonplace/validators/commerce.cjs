'use strict';
// Commerce recommendation notes lean on a few canned openers. Warn-only, low priority —
// the corpus repetition detector also surfaces these at the site level.

const CANNED = ['start here', 'for readers who want', 'essential for understanding', 'the most accessible', 'the essential account of'];

// LITERARY (fiction) layer: matches isLiterary() in src/App.jsx — keep in sync.
const isLiterary = (t) => /^(novel|short stor(y|ies)|play|poem|graphic novel|graphic memoir|verse novel)$/i.test(t || '');

module.exports = function commerce(entry, ctx) {
  const out = [];
  for (const [i, c] of (entry.commerce || []).entries()) {
    const n = (c.note || '').toLowerCase();
    const hit = CANNED.find(p => n.includes(p));
    if (hit) out.push({ id: 'commerce.microcopy', message: `commerce[${i}] "${c.title || '?'}" note opens with templated microcopy "${hit}" — vary the recommendation voice.` });
    // A fiction pick must carry a note: the tie that unlocks the entry + any caveat (outsider lens,
    // dramatic license, adjacent event). No bare literary picks.
    if (isLiterary(c.type) && !String(c.note || '').trim())
      out.push({ id: 'commerce.fictionNote', message: `commerce[${i}] "${c.title || '?'}" is a literary pick with no note — fiction must state what it unlocks about the entry and any caveat.` });
  }
  // Cap: at most 2 literary picks per entry (no padding to hit a count; 0 is fine).
  const litCount = (entry.commerce || []).filter(c => isLiterary(c.type)).length;
  if (litCount > 2)
    out.push({ id: 'commerce.fictionCap', message: `${litCount} literary (fiction) commerce picks — the cap is 2 per entry; keep only the works that most unlock the entry.` });
  return out;
};
