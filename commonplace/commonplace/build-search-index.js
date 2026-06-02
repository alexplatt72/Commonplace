#!/usr/bin/env node
/**
 * build-search-index.js
 * Run from the repo root: node build-search-index.js
 *
 * Output fields (must match App.jsx initFuse keys):
 *   title           — entry title
 *   aliases         — genuine alternate names (comparative narrative names only)
 *   associatedWorks — works by this person (People entries only); used for "hamlet → Shakespeare"
 *   indexTerms      — author names; used for Fuse typo tolerance on scholarly names
 *   themes          — conceptual tags only (power, tragedy, etc.) — NEVER entry types or work titles
 *   summary         — entry summary for fuzzy fallback
 *
 * Data model rules enforced here:
 *   themes must contain conceptual tags. Types (Book, Film, Monograph) are NOT themes.
 *   associatedWorks is the correct container for works by People-template creators.
 *   Commerce/popularCulture titles are NOT indexed — they caused false cross-entry matches.
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

// Types that should never appear in themes
const TYPE_GARBAGE = new Set([
  'Book','Novel','Film','TV','Documentary','Monograph','Essay','Article','Report',
  'Biography','Autobiography','Album','Play','Museum','Concept','Event',
  'Historical Actor','Creative Figure','Thinker','People','Places','Events',
  'Concepts','Periods','Foundations','Natural Phenomena','Policy',
  'Analytical Concept','Normative Concept','Material Foundation',
  'Biological Foundation','Conceptual Foundation','Discrete Event',
  'Extended Process','Threshold Moment — Restructured','Period','Movement',
  'Site','System','Foundational Text','Narrative','Natural Event','Natural Force',
  'Policy Landscape','Policy Question',
]);

function buildRecord(entry) {
  const { id, title, summary, template, subtype,
          comparativeNarrative, reference, commerce,
          themes, associatedWorks } = entry;

  // aliases: genuine alternate names for THIS entry only
  const aliases = uniq([
    ...pluck(comparativeNarrative, 'name'),
  ]);

  // associatedWorks: works by this person — drives "hamlet → Shakespeare" search
  // Source of truth is the dedicated associatedWorks field on the entry (People template only)
  const works = Array.isArray(associatedWorks) ? associatedWorks : [];

  // indexTerms: author names for Fuse typo tolerance on scholarly references
  const indexTerms = uniq([
    ...pluck(reference, 'author'),
    ...pluck(commerce,  'author'),
    subtype,
  ]);

  // themes: conceptual tags only — filter out any type garbage that slipped through
  const cleanThemes = uniq(
    (Array.isArray(themes) ? themes : []).filter(t => !TYPE_GARBAGE.has(t))
  );

  return {
    id,
    title,
    summary: summary || '',
    aliases,
    associatedWorks: uniq(works),
    indexTerms,
    themes: cleanThemes,
  };
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
