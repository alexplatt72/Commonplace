#!/usr/bin/env node
/**
 * build-search-index.js
 * Run from the repo root: node build-search-index.js
 *
 * Reads every entry JSON from public/entries/ (except manifest.json),
 * extracts fields used by Fuse.js, and writes public/searchIndex.json.
 *
 * Fuse keys (must match App.jsx initFuse):
 *   title      weight 0.40
 *   aliases    weight 0.30  ← people/places the entry is also known as
 *   indexTerms weight 0.15  ← key concepts, figures, events within the entry
 *   themes     weight 0.10  ← broader thematic tags
 *   summary    weight 0.05
 */

const fs   = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, 'public', 'entries');
const OUT_FILE    = path.join(__dirname, 'public', 'searchIndex.json');

// ─── helpers ──────────────────────────────────────────────────────────────────

function uniq(arr) {
  return [...new Set(arr.filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 1))];
}

/** Pull short strings from an array of objects by key name. */
function pluck(arr, key) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => item?.[key]).filter(s => typeof s === 'string' && s.trim());
}

/**
 * Extract the first N words of a prose string —
 * used to pull named entities from long text blocks without including full prose.
 */
function firstWords(str, n = 6) {
  if (typeof str !== 'string') return '';
  return str.split(/\s+/).slice(0, n).join(' ');
}

// ─── per-entry index builder ───────────────────────────────────────────────────

function buildRecord(entry) {
  const { id, title, summary, template, subtype, hook,
          rabbitHole, comparativeNarrative, reference,
          commerce, popularCulture, content } = entry;

  // ── aliases ────────────────────────────────────────────────────────────────
  // Things the entry is also known as: alternative names, abbreviations, epithets.
  // Sourced from: rabbit hole labels (they often carry canonical alternate names),
  // comparative perspective names, and selected reference titles.
  const aliases = uniq([
    ...pluck(rabbitHole,            'label'),
    ...pluck(comparativeNarrative,  'name'),
  ]);

  // ── indexTerms ─────────────────────────────────────────────────────────────
  // Key figures, concepts, places, and events discussed within the entry.
  // Sourced from: reference authors & titles, commerce titles, popular culture titles,
  // and rabbit hole reason snippets (first few words contain the key entity).
  const indexTerms = uniq([
    ...pluck(reference,      'author'),
    ...pluck(reference,      'title'),
    ...pluck(commerce,       'title'),
    ...pluck(commerce,       'author'),
    ...pluck(popularCulture, 'title'),
    ...(Array.isArray(rabbitHole)
      ? rabbitHole.map(r => firstWords(r?.reason, 5))
      : []),
    // Pull the entry's own subtype as a term (e.g. "Discrete Event", "Historical Actor")
    subtype,
  ]);

  // ── themes ─────────────────────────────────────────────────────────────────
  // Broad conceptual tags used for thematic browsing matches.
  // Sourced from: template name, subtype, and commerce/popularCulture item types.
  const themes = uniq([
    template,
    subtype,
    ...pluck(commerce,       'type'),
    ...pluck(popularCulture, 'type'),
    ...pluck(reference,      'type'),
  ]);

  return { id, title, summary: summary || '', aliases, indexTerms, themes };
}

// ─── main ──────────────────────────────────────────────────────────────────────

function main() {
  const files = fs.readdirSync(ENTRIES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json');

  const index = [];
  const errors = [];

  for (const file of files) {
    const filePath = path.join(ENTRIES_DIR, file);
    try {
      const raw   = fs.readFileSync(filePath, 'utf8');
      const entry = JSON.parse(raw);
      if (!entry.id || !entry.title) {
        errors.push(`${file}: missing id or title — skipped`);
        continue;
      }
      index.push(buildRecord(entry));
    } catch (e) {
      errors.push(`${file}: ${e.message}`);
    }
  }

  // Sort alphabetically by title for deterministic diffs
  index.sort((a, b) => a.title.localeCompare(b.title));

  fs.writeFileSync(OUT_FILE, JSON.stringify(index, null, 2));

  console.log(`\n✓ searchIndex.json written — ${index.length} entries indexed`);

  if (errors.length) {
    console.warn(`\n⚠ ${errors.length} file(s) skipped:`);
    errors.forEach(e => console.warn('  ' + e));
  }

  // Summary
  const sample = index.slice(0, 3);
  console.log('\nSample records:');
  sample.forEach(r => {
    console.log(`  ${r.id}: aliases[${r.aliases.length}] indexTerms[${r.indexTerms.length}] themes[${r.themes.length}]`);
  });
}

main();
