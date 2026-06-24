// Prerender static HTML for every entry (and the main pages) into dist/, so crawlers and
// link-unfurlers get a real <title>, meta description, canonical, OG/Twitter tags, schema.org
// JSON-LD, and a hidden text block — without running the SPA. The SPA still hydrates #root.
//
// Runs AFTER `vite build` (operates on dist/index.html as its template). The template keeps
// the noindex meta, so every prerendered page stays out of search until index.html's
// `<meta name="robots" content="noindex, nofollow">` line is removed for public launch.
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const ENTRIES_DIR = path.join(__dirname, 'public', 'entries');
const BASE = 'https://www.thecommonplace.dev';
const SITE = 'TheCommonPlace';
const SITE_DESC = 'A curated canon of civilizational significance — structured analytical depth across history, ideas, and the world.';

const tpl = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, 'manifest.json'), 'utf8'));

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function render({ title, desc, url, type = 'website', jsonld = null, seoBody = '' }) {
  let h = tpl;
  const sub = (re, val) => { h = h.replace(re, val); };
  sub(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  sub(/(<meta name="description" content=")[\s\S]*?(")/, `$1${esc(desc)}$2`);
  sub(/(<link rel="canonical" href=")[\s\S]*?(")/, `$1${esc(url)}$2`);
  sub(/(<meta property="og:title" content=")[\s\S]*?(")/, `$1${esc(title)}$2`);
  sub(/(<meta property="og:description" content=")[\s\S]*?(")/, `$1${esc(desc)}$2`);
  sub(/(<meta property="og:url" content=")[\s\S]*?(")/, `$1${esc(url)}$2`);
  sub(/(<meta property="og:type" content=")[\s\S]*?(")/, `$1${type}$2`);
  sub(/(<meta name="twitter:title" content=")[\s\S]*?(")/, `$1${esc(title)}$2`);
  sub(/(<meta name="twitter:description" content=")[\s\S]*?(")/, `$1${esc(desc)}$2`);
  if (jsonld)
    h = h.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n  </head>`);
  if (seoBody)
    h = h.replace('<div id="root"></div>', `<div id="root"></div>\n    <div id="prerendered-seo" hidden>${seoBody}</div>`);
  return h;
}

// ── entries ──────────────────────────────────────────────────────────────────
const entryDir = path.join(DIST, 'entry');
fs.mkdirSync(entryDir, { recursive: true });
let n = 0;
for (const m of manifest) {
  let full;
  try { full = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, m.id + '.json'), 'utf8')); } catch { full = m; }
  const title = `${full.title} — ${SITE}`;
  const desc = full.summary || SITE_DESC;
  const url = `${BASE}/entry/${m.id}`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: full.title,
    description: full.summary || undefined,
    url,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE, url: BASE },
    publisher: { '@type': 'Organization', name: SITE, url: BASE },
  };
  const seoBody =
    `<h1>${esc(full.title)}</h1>` +
    (full.summary ? `<p>${esc(full.summary)}</p>` : '') +
    (full.hook ? `<p>${esc(full.hook)}</p>` : '');
  fs.writeFileSync(path.join(entryDir, m.id + '.html'), render({ title, desc, url, type: 'article', jsonld, seoBody }));
  n++;
}

// ── main pages ───────────────────────────────────────────────────────────────
const pages = [
  { slug: 'browse',   title: `Browse all ${manifest.length} entries — ${SITE}`, desc: `Browse and filter all ${manifest.length} entries by era, region, and category.` },
  { slug: 'tours',    title: `Tours — ${SITE}`,    desc: 'Place-based reading paths connecting a place to the entries it unlocks.' },
  { slug: 'pathways', title: `Pathways — ${SITE}`, desc: 'Curated sequences that build toward a big question.' },
  { slug: 'about',    title: `About — ${SITE}`,    desc: SITE_DESC },
  { slug: 'method',   title: `Method — ${SITE}`,   desc: 'How entries are built, sourced, and checked.' },
  { slug: 'privacy',  title: `Privacy — ${SITE}`,  desc: 'A reading site that needs no account and asks for nothing.' },
];
for (const p of pages) {
  fs.writeFileSync(path.join(DIST, p.slug + '.html'),
    render({ title: p.title, desc: p.desc, url: `${BASE}/${p.slug}`, type: 'website' }));
}

console.log(`✓ prerender — ${n} entry pages + ${pages.length} main pages written to dist/`);
