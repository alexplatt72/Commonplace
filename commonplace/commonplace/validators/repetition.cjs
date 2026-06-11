'use strict';
// CORPUS repetition detector — the permanent anti-mole. Runs over the whole corpus (full mode
// only). For the configured freeform sections it counts 4-5 word evaluative stems and reports
// any that recur across many entries and are NOT on the allowlist (sanctioned framework phrases).
// This catches the NEXT model tic by frequency, before you know the phrase — then you decide:
// ban it (rules/style.json) or allowlist it (sanctioned scaffolding).

const STOP = new Set(('a an the and or but for nor so yet of to in on at by with from as into about over under is are was were be been being it its this that these those they them their he she his her we us our you your i not no than then there which who what when where how all any more most such only same too very has have had will would can could'.split(' ')));

function sectionTexts(entry, section) {
  if (section === 'popularCulture') return (entry.popularCulture || []).map(x => x.description || '');
  if (section === 'comparativeNarrative') return (entry.comparativeNarrative || []).map(x => x.content || '');
  return [];
}
function ngrams(text, n) {
  const w = String(text).toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n));
  return out;
}

module.exports = function corpusRepetition(entries, ctx) {
  const cfg = (ctx.rules.repetitionStems) || {};
  const sizes = cfg.ngramSizes || [4, 5];
  const minEntries = cfg.minEntriesToFlag || 25;
  const minOcc = cfg.minOccurrences || 30;
  const stopMax = cfg.stopwordHeavyMax != null ? cfg.stopwordHeavyMax : 0.8;
  const allow = new Set((ctx.rules.allowlistStems && ctx.rules.allowlistStems.stems || []).map(s => s.toLowerCase()));

  const findings = [];
  for (const section of (cfg.sections || ['popularCulture', 'comparativeNarrative'])) {
    const occ = new Map();      // stem -> total occurrences
    const ents = new Map();     // stem -> Set(entryId)
    for (const { id, e } of entries) {
      for (const text of sectionTexts(e, section)) {
        for (const n of sizes) {
          for (const g of ngrams(text, n)) {
            const stopRatio = g.filter(t => STOP.has(t)).length / g.length;
            if (stopRatio > stopMax) continue;
            const stem = g.join(' ');
            if (allow.has(stem)) continue;
            occ.set(stem, (occ.get(stem) || 0) + 1);
            if (!ents.has(stem)) ents.set(stem, new Set());
            ents.get(stem).add(id);
          }
        }
      }
    }
    for (const [stem, count] of occ) {
      const nEnt = ents.get(stem).size;
      if (nEnt >= minEntries && count >= minOcc)
        findings.push({ section, stem, count, entries: nEnt });
    }
  }
  // longest/highest first; collapse sub-stems contained in a flagged longer stem
  findings.sort((a, b) => b.entries - a.entries || b.count - a.count);
  return findings;
};
