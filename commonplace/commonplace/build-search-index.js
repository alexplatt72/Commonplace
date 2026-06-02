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
 *   aliases    weight 0.30
 *   indexTerms weight 0.15
 *   themes     weight 0.10
 *   summary    weight 0.05
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENTRIES_DIR = join(__dirname, 'public', 'entries');
const OUT_FILE    = join(__dirname, 'public', 'searchIndex.json');

function uniq(arr) {
  return [...new Set(arr.filter(Boolean).map(s => String(s).trim()).filter(s => s.length > 1))];
}

function pluck(arr, key) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => item?.[key]).filter(s => typeof s === 'string' && s.trim());
}

function firstWords(str, n = 6) {
  if (typeof str !== 'string') return '';
  return str.split(/\s+/).slice(0, n).join(' ');
}

function buildRecord(entry) {
  const { id, title, summary, template, subtype,
          rabbitHole, comparativeNarrative, reference,
          commerce, popularCulture } = entry;

  // aliases = genuine alternate names for THIS entry only.
  // Rabbit hole labels are names of OTHER entries — including them caused
  // those other entries to surface when searching for this entry's title.
  const aliases = uniq([
    ...pluck(comparativeNarrative, 'name'),
  ]);

  // indexTerms = author names only. Reference/commerce titles and rabbit hole
  // reason snippets caused false matches (e.g. searching 'shakespe' surfaced
  // Hamlet because its commerce items mention 'Hamlet (Arden Shakespeare...)').
  const indexTerms = uniq([
    ...pluck(reference, 'author'),
    ...pluck(commerce,  'author'),
    subtype,
  ]);

  const themes = uniq([
    template,
    subtype,
    ...pluck(commerce,       'type'),
    ...pluck(popularCulture, 'type'),
    ...pluck(reference,      'type'),
  ]);

  return { id, title, summary: summary || '', aliases, indexTerms, themes };
}

const files = readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json' && f !== 'searchIndex.json');

const index = [];
const errors = [];

for (const file of files) {
  const filePath = join(ENTRIES_DIR, file);
  try {
    const raw   = readFileSync(filePath, 'utf8');
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

index.sort((a, b) => a.title.localeCompare(b.title));
writeFileSync(OUT_FILE, JSON.stringify(index, null, 2));

console.log(`✓ searchIndex.json written — ${index.length} entries indexed`);
if (errors.length) {
  console.warn(`⚠ ${errors.length} file(s) skipped:`);
  errors.forEach(e => console.warn('  ' + e));
}
