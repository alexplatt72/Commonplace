// Generate public/sitemap.xml — every entry as a crawlable path URL plus the main pages.
// Run as part of the build (before `vite build`, so Vite copies it into dist/).
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.thecommonplace.dev';
const ENTRIES_DIR = path.join(__dirname, 'public', 'entries');
const OUT = path.join(__dirname, 'public', 'sitemap.xml');

const manifest = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, 'manifest.json'), 'utf8'));

const staticPages = ['', 'browse', 'tours', 'pathways', 'about', 'method', 'privacy'];

const urls = [];
for (const p of staticPages) {
  urls.push({ loc: BASE + '/' + p, priority: p === '' ? '1.0' : '0.6' });
}
for (const e of manifest) {
  urls.push({ loc: BASE + '/entry/' + encodeURIComponent(e.id), priority: '0.8' });
}

const body = urls
  .map(u => `  <url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

fs.writeFileSync(OUT, xml);
console.log(`✓ sitemap.xml written — ${urls.length} URLs (${manifest.length} entries + ${staticPages.length} pages)`);
