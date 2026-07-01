#!/usr/bin/env node
'use strict';
/*
 * propose_geo.cjs — coordinate proposals for the entry locator map.
 *
 * TWO STAGES (never writes coordinates into entries without your review):
 *
 *   1) PROPOSE  node propose_geo.cjs [--geocode] [--limit N] [--only id,id]
 *        Classifies every entry as place / event / person / period / work /
 *        skip, and writes geo_proposals.csv (+ .json) for you to review in
 *        Excel/Sheets. With --geocode it also fills lat/lng for the "place"
 *        bucket via OpenStreetMap Nominatim (real coordinates, never invented),
 *        rate-limited to 1 req/1.1s and cached in .geo_cache.json.
 *
 *   2) APPLY    node propose_geo.cjs --apply geo_proposals.csv [--force]
 *        Reads the reviewed CSV and writes geo:{kind:"point",lat,lng,label}
 *        into each entry whose `decision` column is "keep" and whose lat/lng
 *        are numeric. Skips entries that already have `geo` unless --force.
 *
 * Design notes / safety:
 *   - Only the "place" bucket is auto-geocoded. People/Periods/Works are left
 *     BLANK for you (geocoding "Cicero" or "the Roman Empire" by title gives
 *     garbage — a town named Cicero, etc.). The `matched` column shows what
 *     Nominatim returned so you can sanity-check every hit.
 *   - Routes and region shading are NOT produced here — do those by hand like
 *     silkRoad (a CSV row can't hold a polyline).
 *   - Nothing is written to entries in PROPOSE mode.
 */

const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = path.join(__dirname, 'public', 'entries');
const CACHE_FILE = path.join(__dirname, '.geo_cache.json');
const OUT_CSV = path.join(__dirname, 'geo_proposals.csv');
const OUT_JSON = path.join(__dirname, 'geo_proposals.json');

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

// ── entry loading ─────────────────────────────────────────────────────────
function loadEntries() {
  const out = [];
  for (const f of fs.readdirSync(ENTRIES_DIR)) {
    if (!f.endsWith('.json')) continue;
    let e; try { e = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, f), 'utf8')); } catch { continue; }
    if (!e || !e.id || !e.template) continue; // skip data files (manifest, calendar…)
    out.push(e);
  }
  return out;
}

// ── classification: which entries can carry a single-point locator ──────────
// bucket drives what the human does. Only "place" is auto-geocoded.
function classify(e) {
  const tmpl = e.template || '';
  const sub = e.subtype || '';
  const regions = e.regions || [];
  const globalOnly = regions.length === 1 && /global|transregional/i.test(regions[0]);

  if (tmpl === 'Concepts' || /Analytical Concept|Normative Concept/i.test(sub)) return 'skip';
  if (tmpl === 'Foundations') return 'skip';                 // materials/ideas — global
  if (globalOnly && tmpl !== 'Places') return 'skip';        // no single point

  if (tmpl === 'Places') return 'place';                     // cities, sites — geocode by title
  if (tmpl === 'Events') {
    if (/Discrete Event|Threshold Moment/i.test(sub)) return 'event'; // a battle/treaty has a place
    return 'period';                                         // Extended Process — spans space, review by hand
  }
  if (tmpl === 'Periods') return 'period';                   // empires/eras — a point is usually misleading
  if (tmpl === 'People') return 'person';                    // birthplace vs. field of action — you decide
  if (tmpl === 'Works') return 'work';                       // a book has no place; a monument does
  if (tmpl === 'Natural Phenomena') return 'skip';           // usually global/regional
  if (tmpl === 'Policy') return 'skip';
  return 'review';
}

const KIND = { place: 'point', event: 'point', person: 'point', period: 'region', work: 'point', skip: 'none', review: 'point' };
// default decision per bucket: place hits -> keep; ambiguous -> review; concepts -> skip
const DEFAULT_DECISION = { place: 'keep', event: 'review', person: 'review', period: 'review', work: 'review', skip: 'skip', review: 'review' };

function geocodeQuery(e) {
  // light cleanup of the title into a place query
  return (e.title || e.id).replace(/^The\s+/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ── Nominatim geocoding (real coords, rate-limited, cached) ─────────────────
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } }
function saveCache(c) { fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 0)); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fetch up to 5 candidates (cached as a list), then pick one — dropping US/Canada
// results when the entry isn't tagged to the Americas (kills "Damascus -> Oregon").
async function fetchCandidates(query, cache) {
  if (query in cache) return cache[query];
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=10&q=' + encodeURIComponent(query);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TheCommonplace-geo-tool/1.0 (internal one-time entry-coordinate proposal)' } });
    const j = res.ok ? await res.json() : [];
    const list = (Array.isArray(j) ? j : []).map(x => ({ lat: +(+x.lat).toFixed(4), lng: +(+x.lon).toFixed(4), display: x.display_name, cls: (x.class || '') + '/' + (x.type || ''), imp: x.importance || 0 }));
    cache[query] = list; return list;
  } catch (err) { cache[query] = null; return null; }
}
function pickCandidate(list, regions) {
  if (!list || !list.length) return null;
  const wantsAmericas = (regions || []).some(r => /north america|latin america|caribbean/i.test(r));
  // Non-Americas entry: drop US/Canada results outright. If that leaves nothing,
  // the real place isn't in the top hits (e.g. "Carthage" -> only US namesakes) —
  // return null so it's flagged for manual entry, never a confidently-wrong pick.
  const pool = wantsAmericas ? list : list.filter(x => !/United States|, USA$|Canada$/.test(x.display));
  if (!pool.length) return null;
  const best = pool.slice().sort((a, b) => b.imp - a.imp)[0];
  return { lat: best.lat, lng: best.lng, matched: best.display, cls: best.cls };
}

// ── CSV helpers ─────────────────────────────────────────────────────────────
const COLS = ['id', 'title', 'template', 'subtype', 'regions', 'bucket', 'kind', 'query', 'lat', 'lng', 'matched', 'match_type', 'decision', 'label'];
function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function toCSV(rows) {
  const lines = [COLS.join(',')];
  for (const r of rows) lines.push(COLS.map(c => csvCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}
function parseCSV(text) {
  const rows = []; let i = 0, field = '', row = [], inQ = false;
  const pushF = () => { row.push(field); field = ''; };
  const pushR = () => { pushF(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ',') { pushF(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { pushR(); i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) pushR();
  const header = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, k) => [h, r[k] ?? ''])));
}

// ── APPLY MODE ──────────────────────────────────────────────────────────────
function apply(csvPath, force) {
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  let written = 0, skipped = 0, existing = 0, bad = 0;
  for (const r of rows) {
    if ((r.decision || '').trim().toLowerCase() !== 'keep') { skipped++; continue; }
    const lat = parseFloat(r.lat), lng = parseFloat(r.lng);
    if (!isFinite(lat) || !isFinite(lng)) { console.log('  ! ' + r.id + ': decision=keep but lat/lng not numeric — skipped'); bad++; continue; }
    const f = path.join(ENTRIES_DIR, r.id + '.json');
    if (!fs.existsSync(f)) { console.log('  ! ' + r.id + ': no such entry'); bad++; continue; }
    const orig = fs.readFileSync(f, 'utf8'); const e = JSON.parse(orig);
    if (e.geo && !force) { existing++; continue; }
    e.geo = { kind: 'point', lat, lng, label: (r.label || '').trim() || e.title };
    fs.writeFileSync(f, JSON.stringify(e, null, 2) + (orig.endsWith('\n') ? '\n' : ''));
    written++;
  }
  console.log(`\napply: ${written} written, ${existing} already had geo (use --force to overwrite), ${skipped} not marked keep, ${bad} problems.`);
}

// ── PROPOSE MODE ─────────────────────────────────────────────────────────────
async function propose() {
  const doGeocode = has('--geocode');
  const limit = val('--limit') ? parseInt(val('--limit'), 10) : Infinity;
  const only = val('--only') ? new Set(val('--only').split(',').map(s => s.trim())) : null;

  const entries = loadEntries().sort((a, b) => a.id.localeCompare(b.id));
  const cache = loadCache();
  const rows = [];
  const counts = {};
  let geocoded = 0, requests = 0;

  for (const e of entries) {
    if (only && !only.has(e.id)) continue;
    const bucket = classify(e);
    counts[bucket] = (counts[bucket] || 0) + 1;
    const row = {
      id: e.id, title: e.title || '', template: e.template || '', subtype: e.subtype || '',
      regions: (e.regions || []).join('; '), bucket, kind: KIND[bucket], query: geocodeQuery(e),
      lat: '', lng: '', matched: '', match_type: '', decision: DEFAULT_DECISION[bucket],
      label: (e.title || '').trim(),
    };
    if (e.geo && e.geo.kind === 'point') { // already placed (the pilots) — carry through, mark done
      row.lat = e.geo.lat; row.lng = e.geo.lng; row.label = e.geo.label || row.label; row.decision = 'keep'; row.matched = '(already set)';
    } else if (doGeocode && bucket === 'place' && requests < limit) {
      const wasCached = row.query in cache;
      const list = await fetchCandidates(row.query, cache);
      if (!wasCached) { requests++; saveCache(cache); await sleep(1100); }
      const hit = pickCandidate(list, e.regions);
      if (hit) { row.lat = hit.lat; row.lng = hit.lng; row.matched = hit.matched; row.match_type = hit.cls; geocoded++; }
      else { row.decision = 'review'; row.matched = (list && list.length) ? '(only distant namesakes found — set by hand)' : '(no geocode hit — set by hand)'; }
    }
    rows.push(row);
  }

  fs.writeFileSync(OUT_CSV, toCSV(rows));
  fs.writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2));

  console.log('\n=== geo proposal summary ===');
  console.log('entries considered: ' + rows.length);
  for (const b of ['place', 'event', 'person', 'period', 'work', 'review', 'skip'])
    if (counts[b]) console.log('  ' + b.padEnd(8) + counts[b] + (b === 'place' ? '  (auto-geocoded when --geocode)' : b === 'skip' ? '  (no map)' : '  (fill/verify by hand)'));
  if (doGeocode) console.log('geocoded this run: ' + geocoded + ' (network requests: ' + requests + ', rest from cache)');
  else console.log('classification only — re-run with --geocode to fill "place" coordinates via OpenStreetMap.');
  console.log('\nwrote ' + path.basename(OUT_CSV) + ' and ' + path.basename(OUT_JSON));
  console.log('Review the CSV (verify each `matched`, set decision=keep and edit lat/lng where needed), then:');
  console.log('  node propose_geo.cjs --apply ' + path.basename(OUT_CSV));
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  if (has('--apply')) return apply(val('--apply'), has('--force'));
  await propose();
})();
