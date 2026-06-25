'use strict';
// Plain English batch processor. Reads a workflow result file ({result:[{id,title,block,verdict}]}),
// validates each block deterministically, AUTO-INSERTS the clean double-passes (validator 0 fails
// AND reviewer pass=true AND no reviewer fact flags), and prints the flagged subset for hand-repair.
//
// Usage:  node pe_process.cjs <workflow-output.json>
//
// "Clean" entries are normalized (literal \n -> real newline) and written into their entry JSON
// (plainEnglish first under content). Flagged entries are NOT touched — they go to the review queue.

const fs = require('fs');
const path = require('path');

const mod = require('./validators/plainEnglish.cjs');
const STYLE = JSON.parse(fs.readFileSync('./rules/style.json', 'utf8'));
const SEV = JSON.parse(fs.readFileSync('./rules/severity.json', 'utf8')).severity;

// --- validator helpers, mirrored from validate_entries.cjs so the decision matches the real gate ---
function wordCount(t) { return (t || '').trim().split(/\s+/).filter(w => w.length > 0).length; }
function splitSentences(text) {
  const p = text
    .replace(/\b(c\.|ca\.|vs\.|etc\.|Dr\.|Mr\.|Mrs\.|St\.|Jr\.|Sr\.|Prof\.|e\.g\.|i\.e\.|cf\.)/g, m => m.replace(/\./g, '⊙'))
    .replace(/\b(\d+)\.(BCE|CE|AD|BC)\b/g, '$1⊙$2')
    .replace(/(\d)\.(\d)/g, '$1⊙$2');
  const raw = p.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [p];
  return raw.map(s => s.replace(/⊙/g, '.').trim()).filter(s => s.length > 0);
}
function syllableCount(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word.length) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?<=[^aeiou])e$/, '');
  const v = word.match(/[aeiouy]+/g);
  let c = v ? v.length : 1;
  if (word.endsWith('ed') && !word.match(/[td]ed$/)) c--;
  if (word.endsWith('es') && !word.match(/[sxz]es$|[cs]hes$/)) c--;
  if (word.match(/[^aeiou]le$/)) c++;
  return Math.max(1, c);
}
function fk(text) {
  if (!text || !text.trim()) return 0;
  const s = splitSentences(text);
  const w = text.trim().split(/\s+/).filter(Boolean);
  if (!s.length || !w.length) return 0;
  const ts = w.reduce((a, x) => a + syllableCount(x), 0);
  return Math.max(0, 0.39 * (w.length / s.length) + 11.8 * (ts / w.length) - 15.59);
}
const ctx = { wordCount, fk, splitSentences, rules: STYLE };

// --- load results ---
const outPath = process.argv[2];
if (!outPath) { console.error('usage: node pe_process.cjs <workflow-output.json>'); process.exit(1); }
const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
const results = Array.isArray(parsed) ? parsed : parsed.result;

const inserted = [];
const flagged = [];

for (const r of results) {
  if (!r || !r.block) { flagged.push({ id: r && r.id, why: ['no block returned (agent died?)'] }); continue; }
  // normalize literal \n -> real newline
  const block = {};
  for (const [k, v] of Object.entries(r.block)) block[k] = String(v).split('\\n').join('\n');

  const file = './public/entries/' + r.id + '.json';
  const orig = fs.readFileSync(file, 'utf8');
  const entry = JSON.parse(orig);
  const findings = mod({ ...entry, content: { ...entry.content, plainEnglish: block } }, ctx);
  const fails = findings.filter(f => (SEV[f.id] || 'warn') === 'fail');
  const warns = findings.filter(f => (SEV[f.id] || 'warn') === 'warn');

  const reviewerPass = r.verdict && r.verdict.pass === true;
  const reviewerFactIssues = (r.verdict && r.verdict.factIssues) || [];
  const clean = fails.length === 0 && reviewerPass && reviewerFactIssues.length === 0;

  if (clean) {
    entry.content = { plainEnglish: block, ...entry.content };
    fs.writeFileSync(file, JSON.stringify(entry, null, 2) + (orig.endsWith('\n') ? '\n' : ''));
    inserted.push({ id: r.id, title: r.title, warns: warns.length });
  } else {
    flagged.push({
      id: r.id, title: r.title,
      validatorFails: fails.map(f => f.message),
      reviewerFact: reviewerFactIssues,
      reviewerLevel: (r.verdict && r.verdict.levelIssues) || [],
      warns: warns.length,
    });
  }
}

console.log('================ PE BATCH PROCESSING ================');
console.log('AUTO-INSERTED (clean double-pass): ' + inserted.length + ' / ' + results.length);
inserted.forEach(e => console.log('  ✓ ' + e.id + (e.warns ? '  (' + e.warns + ' soft warns)' : '')));
console.log('\nFLAGGED for hand-repair: ' + flagged.length);
for (const f of flagged) {
  console.log('\n  ✗ ' + (f.title || f.id) + '  (' + f.id + ')');
  (f.validatorFails || []).forEach(m => console.log('      [validator] ' + m));
  (f.reviewerFact || []).forEach(m => console.log('      [reviewer-fact] ' + String(m).slice(0, 170)));
  (f.reviewerLevel || []).forEach(m => console.log('      [reviewer-level] ' + String(m).slice(0, 170)));
}
console.log('\nNOTE: flagged entries were NOT written. Repair them, then insert.');
