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

  // likely duplicate (warn): same author identity + one title is a word-boundary prefix of
  // the other — i.e. a subtitle-variant of the same work ("The Great Transformation" vs
  // "The Great Transformation: The Political and Economic Origins of Our Time"). Warn, not
  // fail: this is human-judged. Some same-author titles legitimately nest (Spinoza's
  // "Political Treatise" is not a prefix of "Theological-Political Treatise", so it is not
  // flagged), and harder same-work/different-title cases (Marx's "Capital, Volume I" vs
  // "Capital: A Critique of Political Economy, Volume 1") need a periodic manual audit.
  const ntitle = s => (s == null ? '' : String(s)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  for (let a = 0; a < refs.length; a++) {
    for (let b = a + 1; b < refs.length; b++) {
      const ka = authorKey(refs[a].author), kb = authorKey(refs[b].author);
      if (!ka || ka !== kb) continue;
      const ta = ntitle(refs[a].title), tb = ntitle(refs[b].title);
      if (!ta || !tb || ta === tb) continue; // exact dupes already hard-failed above
      const shorter = ta.length <= tb.length ? ta : tb;
      const longer  = ta.length <= tb.length ? tb : ta;
      if (longer.startsWith(shorter) && longer.charAt(shorter.length) === ' ')
        out.push({ id: 'ref.likelyDuplicate', message: `reference[${b}] "${refs[b].title}" looks like a subtitle-variant of reference[${a}] "${refs[a].title}" (same author) — merge if it is the same work; ignore if genuinely distinct.` });
    }
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
