'use strict';
// Plain English (CEFR B1) layer validator.
//
// Runs ONLY on entries that already carry a content.plainEnglish block — the 999
// entries without one are untouched. The B1 layer is generated FROM content.beginner
// by *transformation* (rewrite the language, keep every fact), so these gates enforce
// exactly that contract and catch agent drift mechanically:
//   pe.keyParity          (fail) — B1 sections must mirror Beginner's sections exactly
//   pe.sectionEmpty       (fail) — no empty section
//   pe.markdown           (fail) — plain prose strings only (no [[ ]], **, #, lists, `)
//   pe.punctuation        (fail) — no em dash / semicolon (B1 uses short sentences)
//   pe.readability        (fail) — Flesch–Kincaid grade above the B1 hard ceiling
//   pe.readabilityWatch   (warn) — FK grade above the B1 target (domain-vocab allowance)
//   pe.sentenceMax        (fail) — no single sentence over the hard word cap
//   pe.sentenceMean       (warn) — mean sentence length target
//   pe.numberFidelity     (fail) — every digit-number must exist in the Beginner source
//   pe.properNounFidelity (warn) — every name should exist in the Beginner source
//   pe.style              (warn) — non-B1 idioms/phrasings (data-driven blocklist)
//   pe.styleWatch         (warn) — softer idiom watchlist
//   pe.lengthBand         (warn) — total B1 length vs Beginner length
//
// Thresholds and phrase lists live in rules/style.json (key "plainEnglish") so they
// tune without touching code. Severity is staged in rules/severity.json.

function compile(patterns) {
  return (patterns || []).map(p => ({ re: new RegExp(p.re, p.flags || 'gi'), label: p.label }));
}

// Digit-number tokens, comma-stripped. "1,200" -> "1200", "1880s" -> "1880".
function numbersIn(text) {
  const set = new Set();
  for (const m of (text || '').matchAll(/\d[\d,]*/g)) set.add(m[0].replace(/,/g, ''));
  return set;
}

// Candidate proper nouns: capitalized ASCII word tokens that are NOT sentence-initial
// (sentence-initial capitals are grammatical, not names). Heuristic — hence warn-level.
function properNounsIn(text, split) {
  const set = new Set();
  for (const sent of split(text)) {
    const tokens = sent.trim().split(/\s+/);
    tokens.forEach((tok, i) => {
      if (i === 0) return;                                   // skip sentence-initial word
      const w = tok.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''); // strip wrapping punctuation
      if (/^[A-Z][a-z]+$/.test(w) || /^[A-Z]{2,}$/.test(w)) set.add(w);
    });
  }
  return set;
}

module.exports = function plainEnglish(entry, ctx) {
  const out = [];
  const pe = entry.content && entry.content.plainEnglish;
  if (!pe) return out;                                       // only entries that HAVE the layer

  const beg = (entry.content && entry.content.beginner) || {};
  const cfg = (ctx.rules && ctx.rules.plainEnglish) || {};
  const split = ctx.splitSentences || (t => (t || '').split(/(?<=[.!?])\s+/).filter(Boolean));

  const fkMax        = cfg.fkMax            != null ? cfg.fkMax            : 8.0;
  const fkWarn       = cfg.fkWarn           != null ? cfg.fkWarn           : 7.0;
  const sentMax      = cfg.sentenceMaxWords != null ? cfg.sentenceMaxWords : 28;
  const sentMeanMax  = cfg.sentenceMeanMax  != null ? cfg.sentenceMeanMax  : 16;
  const bandLow      = cfg.lengthBandLow    != null ? cfg.lengthBandLow    : 0.6;
  const bandHigh     = cfg.lengthBandHigh   != null ? cfg.lengthBandHigh   : 1.25;
  const banned = compile(cfg.bannedPatterns);
  const watch  = compile(cfg.watchPatterns);

  // 1. Key parity — plainEnglish sections must mirror beginner exactly.
  const peKeys  = Object.keys(pe);
  const begKeys = Object.keys(beg);
  const missing = begKeys.filter(k => !peKeys.includes(k));
  const extra   = peKeys.filter(k => !begKeys.includes(k));
  if (missing.length || extra.length) {
    out.push({ id: 'pe.keyParity', message: `plainEnglish must mirror beginner sections exactly. ${missing.length ? `missing: [${missing.join(', ')}] ` : ''}${extra.length ? `unexpected: [${extra.join(', ')}]` : ''}`.trim() });
  }

  // Whole-Beginner text for fact-fidelity fallback (a name may move sections).
  const begAll = begKeys.map(k => beg[k] || '').join(' ');
  const begNums = numbersIn(begAll);
  const begLower = begAll.toLowerCase();

  let peTotal = 0;
  let begTotal = 0;
  for (const k of begKeys) begTotal += ctx.wordCount(beg[k] || '');

  for (const key of peKeys) {
    const text = (pe[key] || '').trim();
    if (!text) { out.push({ id: 'pe.sectionEmpty', message: `plainEnglish.${key} is empty.` }); continue; }
    peTotal += ctx.wordCount(text);

    // 2. No markdown / scaffolding.
    const md = text.match(/\[\[|\]\]|\*\*|`|(^|\n)#{1,6}\s|(^|\n)[-*]\s/);
    if (md) out.push({ id: 'pe.markdown', message: `plainEnglish.${key} contains markup near "${md[0].trim() || md[0]}". Plain prose only.` });

    // 3. Punctuation bans — em dash + semicolon.
    const punct = text.match(/[—;]/);
    if (punct) out.push({ id: 'pe.punctuation', message: `plainEnglish.${key} uses ${punct[0] === '—' ? 'an em dash (—)' : 'a semicolon (;)'}. Use short, separate sentences at B1.` });

    // 4. Readability — two-tier: hard fail well above B1, warn at the B1 target.
    const fk = ctx.fk(text);
    if (fk > fkMax) out.push({ id: 'pe.readability', message: `plainEnglish.${key} reads at FK grade ${fk.toFixed(1)} — above the B1 hard ceiling ${fkMax}. Use shorter sentences and commoner words.` });
    else if (fk > fkWarn) out.push({ id: 'pe.readabilityWatch', message: `plainEnglish.${key} reads at FK grade ${fk.toFixed(1)} (B1 target ≤ ${fkWarn}). Tighten if the domain vocabulary allows.` });

    // 5. Sentence length — hard max + mean.
    const lens = split(text).map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+/).filter(Boolean).length);
    const longest = lens.length ? Math.max(...lens) : 0;
    const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    if (longest > sentMax) out.push({ id: 'pe.sentenceMax', message: `plainEnglish.${key} has a ${longest}-word sentence (hard max ${sentMax}). Split it.` });
    if (mean > sentMeanMax) out.push({ id: 'pe.sentenceMean', message: `plainEnglish.${key} mean sentence ${mean.toFixed(1)} words (target ≤ ${sentMeanMax}).` });

    // 6. Style — non-B1 idioms / phrasings (data-driven).
    for (const { re, label } of banned) { re.lastIndex = 0; const m = re.exec(text); if (m) { out.push({ id: 'pe.style', message: `plainEnglish.${key} — non-B1 phrasing [${label}]: "…${m[0].trim()}…".` }); break; } }
    for (const { re, label } of watch)  { re.lastIndex = 0; const m = re.exec(text); if (m) { out.push({ id: 'pe.styleWatch', message: `plainEnglish.${key} — watch phrase [${label}]: "…${m[0].trim()}…".` }); break; } }

    // 7. Fact fidelity — numbers (fail) and names (warn) must trace to Beginner.
    for (const n of numbersIn(text)) if (!begNums.has(n)) out.push({ id: 'pe.numberFidelity', message: `plainEnglish.${key} introduces number "${n}" not in the Beginner source (possible fact drift).` });
    for (const pn of properNounsIn(text, split)) if (!begLower.includes(pn.toLowerCase())) out.push({ id: 'pe.properNounFidelity', message: `plainEnglish.${key} introduces name "${pn}" not in the Beginner source — verify it is not invented.` });
  }

  // 8. Length band — total B1 words relative to Beginner.
  if (begTotal > 0) {
    const ratio = peTotal / begTotal;
    if (ratio < bandLow || ratio > bandHigh) {
      out.push({ id: 'pe.lengthBand', message: `plainEnglish total ${peTotal}w is ${Math.round(ratio * 100)}% of Beginner ${begTotal}w (allowed ${Math.round(bandLow * 100)}–${Math.round(bandHigh * 100)}%).` });
    }
  }

  // 9. "matters" crutch cap — limit the EVALUATIVE form across the whole B1 block.
  // Targets the verb ("matters"/"mattered") and evaluative frames ("why it matters"),
  // NOT the physical-substance noun ("states of matter", "dark matter").
  const matterCap = cfg.matterCap != null ? cfg.matterCap : 2;
  const matterRe = /\b(?:matters|mattered)\b|\b(?:why it|what|whether it|that|really|truly|still) matter\b|\bmatter (?:because|here|most|more|to us)\b/gi;
  const matterHits = (peKeys.map(k => pe[k] || '').join(' \n ').match(matterRe) || []).length;
  if (matterHits > matterCap) {
    out.push({ id: 'pe.matterCap', message: `plainEnglish uses the evaluative "matters/mattered" ${matterHits} times (cap ${matterCap}) — a register crutch. Rephrase: "is important", "shaped", "changed", or just state the point.` });
  }

  return out;
};
