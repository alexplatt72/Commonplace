#!/usr/bin/env node
// Commerce-link audit for The Commonplace.
//
//   node commerce_audit.cjs               # static checks only (offline, fast)
//   node commerce_audit.cjs --external    # also verify every isbnUS:true ISBN against OpenLibrary
//
// Static layer flags: invalid ISBN-13/10 checksum, isbnUS:true with a missing/invalid ISBN,
// the same ISBN reused across genuinely different titles (wrong-link risk), non-book items
// carrying an ISBN, and books with no author. The external layer resolves each trusted ISBN
// against OpenLibrary and flags any that come back as a different book (incl. the "right
// author, wrong title" case). Exit code is non-zero if any hard problem is found.
//
// This mirrors the trust rule in src/App.jsx resolveCommerceLink(): a direct Indie/Amazon
// link is only generated when isbnUS===true AND the ISBN passes its checksum.

const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'public', 'entries');
const SKIP = new Set(['manifest.json', 'searchIndex.json', 'calendar.json', 'collections.json', 'pathways.json', 'theArchive.json']);
const EXTERNAL = process.argv.includes('--external');

const clean = v => (v || '').replace(/[^0-9Xx]/g, '').toUpperCase();
function validIsbn13(s) { if (s.length !== 13 || /[^0-9]/.test(s)) return false; let sum = 0; for (let i = 0; i < 12; i++) sum += +s[i] * (i % 2 ? 3 : 1); return (10 - sum % 10) % 10 === +s[12]; }
function validIsbn10(s) { if (s.length !== 10) return false; let sum = 0; for (let i = 0; i < 10; i++) { const c = s[i]; const v = c === 'X' ? 10 : +c; if ((c === 'X' && i !== 9) || Number.isNaN(v)) return false; sum += v * (10 - i); } return sum % 11 === 0; }
const validIsbn = s => s.length === 13 ? validIsbn13(s) : s.length === 10 ? validIsbn10(s) : false;
const isBookLike = t => /^(book|novel)$/i.test(t || '');

const items = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || SKIP.has(f)) continue;
  const e = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  for (const [i, c] of (e.commerce || []).entries())
    items.push({ entry: f.replace('.json', ''), idx: i, type: c.type || '', title: c.title || '', author: c.author || '', isbnRaw: c.isbn, isbn: clean(c.isbn), isbnUS: !!c.isbnUS });
}

const books = items.filter(x => isBookLike(x.type));
const isbnUS = items.filter(x => x.isbnUS);
const invalid = items.filter(x => x.isbn && !validIsbn(x.isbn));
const usButInvalid = isbnUS.filter(x => !x.isbn || !validIsbn(x.isbn));
const nonBookWithIsbn = items.filter(x => !isBookLike(x.type) && x.isbn);
const bookNoAuthor = books.filter(x => !x.author.trim());

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const byIsbn = {};
for (const x of items) if (x.isbn) (byIsbn[x.isbn] = byIsbn[x.isbn] || []).push(x);
const dupDiffTitle = Object.entries(byIsbn).filter(([, a]) => new Set(a.map(x => norm(x.title))).size > 1);

const p = (l, n) => console.log(String(l).padEnd(44) + n);
console.log('=== STATIC COMMERCE AUDIT ===');
p('Commerce items', items.length);
p('Book/novel items', books.length);
p('isbnUS:true items', isbnUS.length);
p('INVALID ISBN checksum', invalid.length);
p('isbnUS:true but ISBN missing/invalid', usButInvalid.length);
p('Non-book carrying an ISBN', nonBookWithIsbn.length);
p('Book missing author', bookNoAuthor.length);
p('Same ISBN, different titles', dupDiffTitle.length);
const show = (label, arr, fmt) => { if (arr.length) { console.log('\n--- ' + label + ' ---'); arr.forEach(x => console.log(fmt(x))); } };
show('INVALID CHECKSUM', invalid, x => `  ${x.entry}[${x.idx}] "${x.title}" — ${x.isbnRaw}`);
show('isbnUS:true but invalid/missing', usButInvalid, x => `  ${x.entry}[${x.idx}] "${x.title}" — ${x.isbnRaw || '(none)'}`);
show('Non-book with ISBN', nonBookWithIsbn, x => `  ${x.entry}[${x.idx}] (${x.type}) "${x.title}" — ${x.isbnRaw}`);
show('Same ISBN across different titles (verify: same book, or wrong link?)', dupDiffTitle,
  ([isbn, a]) => `  ${isbn}:\n` + a.map(x => `      ${x.entry} :: "${x.title}" (${x.author})`).join('\n'));

let hardProblems = invalid.length + usButInvalid.length + nonBookWithIsbn.length + bookNoAuthor.length;

async function external() {
  const list = books.filter(x => x.isbnUS && x.isbn && validIsbn(x.isbn));
  console.log(`\n=== EXTERNAL VERIFICATION (OpenLibrary) — ${list.length} trusted ISBNs ===`);
  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'how', 'with', 'for', 'vol', 'volume', 'selections', 'edition', 'classics', 'penguin', 'oxford', 'worlds', 'world', 'study']);
  const nrm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = s => new Set(nrm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w)));
  const lasts = a => nrm(a).split(' ').filter(w => w.length > 2 && !['jr', 'trans', 'ed', 'and'].includes(w));
  const overlap = (listed, found) => { const lt = toks(listed.split(':')[0]), ft = toks(found); if (!lt.size) return 1; let h = 0; for (const t of lt) if (ft.has(t)) h++; return h / lt.size; };
  const authorOk = (listed, fa) => { const ln = lasts(listed); if (!ln.size) return true; const f = nrm((fa || []).map(x => x.name).join(' ')).split(' '); return ln.some(n => f.includes(n)); };

  const flags = [];
  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100);
    let data = {};
    try {
      const keys = batch.map(x => 'ISBN:' + x.isbn).join(',');
      const r = await fetch(`https://openlibrary.org/api/books?bibkeys=${keys}&format=json&jscmd=data`, { headers: { 'User-Agent': 'TheCommonplace-commerce-audit/1.0' } });
      data = await r.json();
    } catch (e) { console.error(`  batch ${i} failed: ${e.message}`); }
    for (const it of batch) {
      const rec = data['ISBN:' + it.isbn];
      if (!rec) { flags.push({ ...it, kind: 'no-result', found: '' }); continue; }
      const tov = overlap(it.title, rec.title || ''), am = authorOk(it.author, rec.authors);
      const found = `"${rec.title}" / ${(rec.authors || []).map(a => a.name).join(', ')}`;
      if (tov < 0.2 && am) flags.push({ ...it, kind: 'same-author-diff-title', found, tov });
      else if (tov < 0.34 && !am) flags.push({ ...it, kind: 'MISMATCH', found, tov });
    }
    process.stderr.write(`  ${Math.min(i + 100, list.length)}/${list.length}\r`);
    await new Promise(r => setTimeout(r, 400));
  }
  process.stderr.write('\n');
  const mism = flags.filter(f => f.kind === 'MISMATCH');
  const sadt = flags.filter(f => f.kind === 'same-author-diff-title');
  const nr = flags.filter(f => f.kind === 'no-result');
  p('Pass', list.length - flags.length);
  p('No-result (cannot confirm)', nr.length);
  p('MISMATCH (different book)', mism.length);
  p('Same-author, different-title (review)', sadt.length);
  const d = (label, arr) => { if (arr.length) { console.log('\n--- ' + label + ' ---'); arr.forEach(f => console.log(`  ${f.entry}[${f.idx}] listed "${f.title}" / ${f.author} (${f.isbn})\n      OpenLibrary: ${f.found} [titleOverlap ${(f.tov ?? 0).toFixed(2)}]`)); } };
  d('MISMATCH — different book entirely', mism);
  d('Same author, different title — verify not a wrong-book ISBN', sadt);
  hardProblems += mism.length;
}

(async () => {
  if (EXTERNAL) {
    if (typeof fetch !== 'function') { console.error('\n--external needs Node 18+ (global fetch).'); process.exit(2); }
    await external();
  } else {
    console.log('\n(Run with --external to verify ISBNs resolve to the right book via OpenLibrary.)');
  }
  console.log(hardProblems ? `\nFAIL: ${hardProblems} hard problem(s).` : '\nOK: no hard problems.');
  process.exit(hardProblems ? 1 : 0);
})();
