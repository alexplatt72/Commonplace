'use strict';
// Reference integrity: duplicate titles, missing Essential, year format, canned annotations.

const YEAR_OK = /^(c\.?\s*)?\d{3,4}(\s*(bce|ce|bc|ad))?([–—/,&;-]\s*(c\.?\s*)?\d{1,4}(\s*(bce|ce|bc|ad))?)*$|century|\bongoing\b|present|\bn\.?d\.?\b|forthcoming/i;
const CANNED_CLOSERS = [
  'the essential starting point', 'the necessary starting point',
  'won the pulitzer prize', 'the definitive account', 'the standard account',
  'indispensable for', 'a landmark study', 'the classic study'
];

// Author key that ignores name ORDER and INITIALS, so "A.B. Bosworth" and
// "Bosworth, A.B." collapse to the same key, while two different people sharing a
// title (Clark vs Isaacson on "Leonardo da Vinci") stay distinct. Keeps surname-length
// tokens only (len>=2 after stripping dots), drops connectives/role words, sorts.
const AUTHOR_STOP = new Set(['and','the','of','eds','ed','editor','editors','trans','al','et','jr','sr','with']);
function authorKey(s) {
  const toks = (s == null ? '' : String(s)).toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[.,&]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .filter(t => t.length >= 2 && !AUTHOR_STOP.has(t));
  return [...new Set(toks)].sort().join(' ');
}

module.exports = function references(entry, ctx) {
  const out = [];
  const refs = entry.reference || [];
  if (!refs.length) return out;

  // duplicate references within the entry — same title AND same author IDENTITY.
  // Author match is order/initial-insensitive (see authorKey) so the same work listed
  // twice in different name formats is caught, while two distinct works that happen to
  // share a title but have different authors are not falsely flagged.
  const seen = new Map();
  for (const [i, r] of refs.entries()) {
    const t = ctx.norm(r.title);
    if (!t) continue;
    const k = t + '|' + authorKey(r.author);
    if (seen.has(k)) {
      out.push({ id: 'ref.duplicateTitle', message: `reference[${i}] "${r.title}" duplicates reference[${seen.get(k)}] — same work (title + author identity) within one entry; remove or merge.` });
    } else seen.set(k, i);
  }

  // at least one Essential reference
  if (!refs.some(r => (r.contribution || '') === 'Essential'))
    out.push({ id: 'ref.noEssential', message: `no reference marked contribution:"Essential" — every entry needs at least one essential source.` });

  // year format (warn)
  for (const [i, r] of refs.entries()) {
    const y = (r.year == null ? '' : String(r.year)).trim();
    if (y && !YEAR_OK.test(y))
      out.push({ id: 'ref.yearFormat', message: `reference[${i}] "${r.title}" has a non-normalized year "${y}" — use a year, range, or "c. YYYY" / "Nth century".` });
  }

  // canned annotation closers (warn)
  for (const [i, r] of refs.entries()) {
    const a = (r.annotation || '').toLowerCase();
    const hit = CANNED_CLOSERS.find(c => a.includes(c));
    if (hit)
      out.push({ id: 'ref.annotationBoilerplate', message: `reference[${i}] "${r.title}" annotation uses canned phrase "${hit}" — vary it or say what the work specifically does here.` });
  }

  return out;
};
