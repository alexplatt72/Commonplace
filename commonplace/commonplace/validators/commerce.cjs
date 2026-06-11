'use strict';
// Commerce recommendation notes lean on a few canned openers. Warn-only, low priority —
// the corpus repetition detector also surfaces these at the site level.

const CANNED = ['start here', 'for readers who want', 'essential for understanding', 'the most accessible', 'the essential account of'];

module.exports = function commerce(entry, ctx) {
  const out = [];
  for (const [i, c] of (entry.commerce || []).entries()) {
    const n = (c.note || '').toLowerCase();
    const hit = CANNED.find(p => n.includes(p));
    if (hit) out.push({ id: 'commerce.microcopy', message: `commerce[${i}] "${c.title || '?'}" note opens with templated microcopy "${hit}" — vary the recommendation voice.` });
  }
  return out;
};
