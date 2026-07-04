#!/usr/bin/env node
// promote_entries.cjs — move quarantined draft entries into production.
//
//   node promote_entries.cjs <id1> <id2> ...     promote the named entries
//   node promote_entries.cjs --all               promote everything in _quarantine/
//   node promote_entries.cjs --list              show what's waiting in quarantine
//
// PROCESS RULE: brand-new entries live in _quarantine/ and NEVER enter production
// (public/entries/) except by an explicit run of this script. Nothing here is
// automatic — promotion happens only when you name the entries (or pass --all).
//
// What it does, per promoted entry:
//   1. validates the quarantine entry against the LIVE manifest (aborts on any fail),
//   2. flips status draft -> published and stamps `added` (today) if missing,
//   3. moves the file _quarantine/<id>.json -> public/entries/<id>.json,
//   4. appends a manifest record (same shape the session register scripts use),
//   5. upgrades any planned rabbit-hole links that now point to a live entry,
//   6. recomputes `degree` (published outbound links) for promoted + touched entries,
//   7. re-validates the promoted entries in production.
// After it runs it reminds you to regenerate searchIndex/sitemap and commit.

const fs = require('fs'), path = require('path'), cp = require('child_process');
const QDIR = '_quarantine', DIR = 'public/entries', MPATH = DIR + '/manifest.json';
const REC = ['id','title','template','subtype','period','status','summary','startYear','endYear','regions','degree','added'];
const NON = new Set(['manifest.json','searchIndex.json','calendar.json','collections.json','pathways.json']);

const args = process.argv.slice(2);
if (!fs.existsSync(QDIR)) { console.error('No _quarantine/ folder.'); process.exit(1); }
const inQ = fs.readdirSync(QDIR).filter(f => f.endsWith('.json') && !NON.has(f)).map(f => f.replace('.json',''));

if (args.includes('--list') || args.length === 0) {
  console.log(`_quarantine/ holds ${inQ.length} entr${inQ.length===1?'y':'ies'}:` + (inQ.length?'\n  '+inQ.join('\n  '):' (empty)'));
  console.log('\nPromote with:  node promote_entries.cjs <id> [<id> ...]   |   --all');
  process.exit(0);
}
let ids = args.includes('--all') ? inQ : args.filter(a => !a.startsWith('--'));
const missing = ids.filter(id => !fs.existsSync(`${QDIR}/${id}.json`));
if (missing.length) { console.error('Not in _quarantine/: ' + missing.join(', ')); process.exit(1); }
if (!ids.length) { console.error('No entry ids given.'); process.exit(1); }

// 1. validate the quarantine entries against the LIVE manifest
console.log(`Validating ${ids.length} quarantined entr${ids.length===1?'y':'ies'} against the live manifest...`);
try {
  cp.execSync(`node validate_entries.cjs ${QDIR} --only ${ids.join(',')} --manifest ${MPATH}`, { stdio: 'inherit' });
} catch (_) { console.error('\n✗ Validation failed — nothing promoted. Fix the entries in _quarantine/ and retry.'); process.exit(1); }

// 2-4. move + register
const today = new Date().toISOString().slice(0, 10);
const m = JSON.parse(fs.readFileSync(MPATH, 'utf8'));
const mids = new Set(m.map(x => x.id));
const liveIds = new Set([...mids, ...ids]);
for (const id of ids) {
  if (mids.has(id)) { console.error(`!! ${id} already in manifest — skipping (is it already live?)`); continue; }
  const e = JSON.parse(fs.readFileSync(`${QDIR}/${id}.json`, 'utf8'));
  if (e.status !== 'published') e.status = 'published';
  if (!e.added) e.added = today;
  fs.writeFileSync(`${DIR}/${id}.json`, JSON.stringify(e, null, 2));
  fs.unlinkSync(`${QDIR}/${id}.json`);
  const rec = {}; for (const k of REC) rec[k] = e[k];
  m.push(rec); console.log('  promoted ' + id);
}
const mById = new Map(m.map(r => [r.id, r]));

// 5. upgrade planned links across the whole corpus that now resolve
const touched = new Set(); let upg = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || NON.has(f)) continue;
  let e; try { e = JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8')); } catch { continue; }
  let ch = false;
  for (const r of (e.rabbitHole || [])) if (r.status === 'planned' && liveIds.has(r.entryId)) { r.status = 'published'; ch = true; upg++; }
  if (ch) { fs.writeFileSync(`${DIR}/${f}`, JSON.stringify(e, null, 2)); touched.add(e.id); }
}
if (upg) console.log(`  upgraded ${upg} planned link(s) that now resolve`);

// 6. recompute degree for promoted + touched
const pubOut = e => (e.rabbitHole || []).filter(r => r.status === 'published' && liveIds.has(r.entryId)).length;
for (const id of new Set([...ids, ...touched])) {
  const p = `${DIR}/${id}.json`; if (!fs.existsSync(p)) continue;
  const e = JSON.parse(fs.readFileSync(p, 'utf8'));
  e.degree = pubOut(e); fs.writeFileSync(p, JSON.stringify(e, null, 2));
  const rec = mById.get(id); if (rec) rec.degree = e.degree;
}
fs.writeFileSync(MPATH, JSON.stringify(m, null, 2));
console.log(`  manifest length now ${m.length}`);

// 7. re-validate in production
console.log('\nRe-validating promoted entries in production...');
try { cp.execSync(`node validate_entries.cjs ${DIR} --only ${ids.join(',')}`, { stdio: 'inherit' }); }
catch { console.error('\n✗ Post-move validation failed — inspect public/entries. (Entries were moved.)'); process.exit(1); }

console.log(`\n✓ Promoted ${ids.length} entr${ids.length===1?'y':'ies'} to production.`);
console.log('Next: regenerate searchIndex + sitemap (your normal finalize), then commit & push.');
