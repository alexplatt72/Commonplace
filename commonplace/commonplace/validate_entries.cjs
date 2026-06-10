// validate_entries.cjs — Commonplace entry validator
// Version 2.0 — Restructured per updated specification
//
// Priority hierarchy:
//   FAIL    — blocks publication (schema, layer structure, layer collapse, cross-layer sentence
//             repetition [Advanced must advance; hook not re-narrated], duplicate commerce/
//             popularCulture items, beginner limits, broken links)
//   WARNING — should be reviewed before publication (layer progression, AI failure modes,
//             Beginner↔General verbatim reuse, graph health)
//   ADVISORY — useful diagnostics, track across sessions
//
// Run:  node validate_entries.cjs <entries_dir> [--verbose] [--entry <id>]

'use strict';

const fs   = require('fs');
const path = require('path');

const ENTRIES_DIR   = process.argv[2] || 'public/entries';
const VERBOSE       = process.argv.includes('--verbose');
const SINGLE_ENTRY  = (() => {
  const i = process.argv.indexOf('--entry');
  return i !== -1 ? process.argv[i + 1] : null;
})();

// ── Manifest ──────────────────────────────────────────────────────────────────
const manifestPath = path.join(ENTRIES_DIR, 'manifest.json');
const manifest     = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestIds  = new Set(manifest.map(e => e.id));

// ── Label → entryId lookup (for resolving planned links with missing entryId) ──
// Builds a map from normalised label strings to manifest IDs so the validator
// can detect when a planned link's label matches a published entry even though
// the entryId field was stripped.  Normalisation: lowercase, strip leading
// "the ", collapse whitespace.
const normalise = s => s.toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
const labelToId = new Map();
for (const e of manifest) {
  labelToId.set(normalise(e.title), e.id);
  labelToId.set(normalise(e.id),    e.id);   // camelCase label e.g. "printingPress"
}

// ── Template → subtype → section keys ────────────────────────────────────────
const SUBTYPE_SECTIONS = {
  // People
  'Historical Actor':                ['theFigure','worldInherited','howExercisedPower','whatTheyChanged','legendVsRecord'],
  'Thinker':                         ['theFigure','worldOfIdeas','centralIdea','howSpread','contestedInheritance'],
  'Creative Figure':                 ['theFigure','bodyOfWork','howBeenRead','whyItEndured','contestedInheritance'],
  // Events
  'Discrete Event':                  ['theEvent','context','theMoment','theRecord','causation','significance'],
  'Extended Process':                ['theEvent','context','theRecord','phases','mechanics','transformation','causation','significance'],
  'Threshold Moment — Restructured': ['thePivot','theRecord','context','secondOrderEffects','longShadow','causation'],
  // Concepts
  'Analytical Concept':              ['theConcept','problemItSolves','howItWorks','whatItExplains','whereItBreaksDown','usedAndMisusedC'],
  'Normative Concept':               ['theConcept','problemItAddresses','competingTraditions','politicalStakes','contestedHistoryC','whereDebateStands'],
  // Periods & Movements
  'Period':                          ['thePeriod','theBoundaries','theConditions','internalDiversity','longConsequences','periodizationDebate'],
  'Movement':                        ['theMovement','origins','coreCommitments','internalTensions','whatItChanged','legacyAndLimits'],
  // Places
  'Site':                            ['thePlace','physicalWorld','theLayers','whatItBecame','whoClaimsIt','theLongLife'],
  'System':                          ['theSystem','physicalLogic','whatMovedThroughIt','whoOrganizedIt','whatItMadePossible','theLongLife'],
  // Works
  'Foundational Text':               ['theText','momentOfMaking','whatItClaims','interpretiveEcosystem','usedAndWeaponized'],
  'Narrative':                       ['theWork','momentOfMaking','whatItDoes','whatItChanged','howBeenRead'],
  // Natural Phenomena — unified template (both subtypes share identical section keys)
  // Subtype ('Natural Event', 'Natural Force') preserved for browse/filter but does not alter keys
  'Natural Event':                   ['theForce','theRecord','howPeopleKnew','whatItDidToSocieties','theUnequal','theLongConsequence'],
  'Natural Force':                   ['theForce','theRecord','howPeopleKnew','whatItDidToSocieties','theUnequal','theLongConsequence'],
  // Foundations
  'Material Foundation':             ['theFoundation','howItArrived','whatItReorganized','thePoliticalEconomy','theFeedback','presentAndFuture'],
  'Conceptual Foundation':           ['theFoundation','howItArrived','whatItReorganized','thePoliticalEconomy','theFeedback','presentAndFuture'],
  'Biological Foundation':           ['theFoundation','howItArrived','whatItReorganized','thePoliticalEconomy','theFeedback','presentAndFuture'],
  // Policy
  'Policy Landscape':                ['theLandscape','theHistoricalArc','theValueFramework','theEvidenceEcosystem','theInternationalComparison','theCurrentDebates'],
  'Policy Question':                 ['theQuestion','theStakes','theValueFramework','theEvidence','theOptions','theInternationalEvidence'],
};

const VALID_RELATIONSHIPS = new Set([
  'Foundational','Consequential','Thematic','Parallel','Gateway','Contrasting','Precursor','Descendant'
]);
const VALID_RH_STATUSES = new Set(['published','planned']);

// ── Text helpers ──────────────────────────────────────────────────────────────

/** Split text into sentences. Handles BCE/CE, abbreviations, decimals. */
function splitSentences(text) {
  // Protect known abbreviations and patterns before splitting
  const protected_ = text
    .replace(/\b(c\.|ca\.|vs\.|etc\.|Dr\.|Mr\.|Mrs\.|St\.|Jr\.|Sr\.|Prof\.|e\.g\.|i\.e\.|cf\.)/g, m => m.replace(/\./g, '⊙'))
    .replace(/\b(\d+)\.(BCE|CE|AD|BC)\b/g, '$1⊙$2')
    .replace(/(\d)\.(\d)/g, '$1⊙$2');  // decimals

  const raw = protected_.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [protected_];
  return raw.map(s => s.replace(/⊙/g, '.').trim()).filter(s => s.length > 0);
}

function avgSentenceLength(text) {
  const sents = splitSentences(text);
  if (!sents.length) return 0;
  return sents.reduce((a, s) => a + wordCount(s), 0) / sents.length;
}

function maxSentenceLength(text) {
  const sents = splitSentences(text);
  if (!sents.length) return 0;
  return Math.max(...sents.map(s => wordCount(s)));
}

function longestSentence(text) {
  const sents = splitSentences(text);
  if (!sents.length) return '';
  return sents.reduce((a, s) => wordCount(s) > wordCount(a) ? s : a, '');
}

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Count syllables in a word (English approximation).
 * Handles common patterns: silent e, vowel runs, -ed, -es, -le endings.
 */
function syllableCount(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word.length) return 0;
  if (word.length <= 3) return 1;
  // Remove trailing silent e (not after vowel, not -le)
  word = word.replace(/(?<=[^aeiou])e$/, '');
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;
  // Subtract for common silent patterns
  if (word.endsWith('ed') && !word.match(/[td]ed$/)) count--;
  if (word.endsWith('es') && !word.match(/[sxz]es$|[cs]hes$/)) count--;
  // -le at end counts as a syllable if preceded by consonant
  if (word.match(/[^aeiou]le$/)) count++;
  return Math.max(1, count);
}

/**
 * Flesch-Kincaid Grade Level for a block of text.
 * FK-GL = 0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59
 * Returns grade level (e.g. 8.2 = 8th grade).
 */
function fleschKincaidGradeLevel(text) {
  if (!text || text.trim().length === 0) return 0;
  const sents = splitSentences(text);
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (!sents.length || !words.length) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  const asl = words.length / sents.length;         // avg sentence length
  const asw = totalSyllables / words.length;        // avg syllables per word
  const grade = (0.39 * asl) + (11.8 * asw) - 15.59;
  return Math.max(0, grade);
}

/** Compute word-level bigram Jaccard similarity between two texts. */
function similarity(textA, textB) {
  if (!textA || !textB) return 0;
  const bigrams = t => {
    const words = t.toLowerCase().split(/\s+/);
    const set = new Set();
    for (let i = 0; i < words.length - 1; i++) set.add(words[i] + '_' + words[i+1]);
    return set;
  };
  const a = bigrams(textA);
  const b = bigrams(textB);
  let intersection = 0;
  for (const bg of a) if (b.has(bg)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Get all section text from a layer as flat string. */
function layerText(layerObj, sectionKeys) {
  if (!layerObj || !sectionKeys) return '';
  return sectionKeys.map(k => layerObj[k] || '').join(' ');
}

/** Get per-section text map for a layer. */
function sectionTexts(layerObj, sectionKeys) {
  const out = {};
  if (!layerObj || !sectionKeys) return out;
  for (const k of sectionKeys) out[k] = layerObj[k] || '';
  return out;
}

// ── Cross-layer sentence-repetition helpers (check 4.6) ───────────────────────
// Whole-layer Jaccard (4.1) misses a single signature anecdote/quote/stat reused
// across depths while the rest of the layer differs. These power a sentence-level
// check: a genuinely consecutive copied phrase (run) OR high content-word overlap.
const REP_STOP = new Set(('a an the and or but nor for so yet of to in on at by with from as into about ' +
  'over under is are was were be been being am do does did have has had having will would shall should ' +
  'can could may might must this that these those it its they them their he she his her him we us our you ' +
  'your i me my not no than then there which who whom whose what when where why how all any both each few ' +
  'more most other some such only own same too very').split(/\s+/));
function repTokens(s) {
  return String(s).toLowerCase().replace(/[‘’“”]/g, "'").replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/).filter(Boolean);
}
function repContent(s) { return repTokens(s).filter(t => !REP_STOP.has(t) && t.length > 1); }
function repJaccard(a, b) {
  const A = new Set(a), B = new Set(b); let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const uni = A.size + B.size - inter; return uni === 0 ? 0 : inter / uni;
}
function repLongestRun(a, b) {           // longest shared contiguous run = real copied phrase
  const n = a.length, m = b.length; if (!n || !m) return { len: 0, text: '' };
  let best = 0, bestEnd = 0; const prev = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    let diag = 0;
    for (let j = 1; j <= m; j++) {
      const tmp = prev[j];
      if (a[i - 1] === b[j - 1]) { prev[j] = diag + 1; if (prev[j] > best) { best = prev[j]; bestEnd = i; } }
      else prev[j] = 0;
      diag = tmp;
    }
  }
  return { len: best, text: a.slice(bestEnd - best, bestEnd).join(' ') };
}
/** Match descriptor if two sentences substantially overlap, else null.
 *  lenient=true (Beginner↔General) requires near-verbatim; strict catches reuse. */
function repMatch(sa, sb, lenient) {
  const ca = repContent(sa), cb = repContent(sb);
  if (ca.length < 5 || cb.length < 5) return null;
  const jac = repJaccard(ca, cb);
  const run = repLongestRun(repTokens(sa), repTokens(sb));
  if (run.len >= (lenient ? 10 : 6) || jac >= (lenient ? 0.72 : 0.50))
    return { jac, run: run.len, runText: run.text };
  return null;
}

// ── Media duplicate helpers (commerce / popularCulture, checks 9.3 / 10.3) ────
// Same logic as the dedup tool: strip parenthetical edition/translator notes so
// "Arrian (Penguin Classics edition)" matches "Arrian", but distinct authors of a
// same-titled book (Isaacson vs Clark on "Leonardo da Vinci") stay distinct.
const mediaNorm = s => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
const mediaStripParen = s => (s || '').replace(/\([^)]*\)/g, ' ');
function commerceSig(c) {
  const sigs = [];
  if (c.isbn) sigs.push('i:' + String(c.isbn).replace(/[^0-9xX]/g, ''));
  const t = mediaNorm(mediaStripParen(c.title));
  if (t) sigs.push('t:' + t + '|' + mediaNorm(mediaStripParen(c.author)));
  return sigs;
}

// ── AI failure mode phrase lists ──────────────────────────────────────────────
const PROCEDURAL_NARRATION_PHRASES = [
  'what makes this analytically interesting',
  'it is worth noting that',
  'this is significant because',
  'in order to understand',
  'to understand x, we must',
  'this entry will',
  'there are several key',
  'in what follows',
  'as we will see',
];

const ANTI_DECLARATIVE_PHRASES = [
  'one of the most important',
  'one of the most significant',
  'one of the most consequential',
  'one of the most influential',
  'cannot be overstated',
  'profoundly shaped',
  'had a profound impact',
  'fundamentally transformed',
  'fundamentally changed',
  'fundamentally altered',
  'revolutionized',
];

const FORMULAIC_CN_OPENERS = [
  /^for [a-z][\w\s]+,\s+[a-z]/i,         // "For the X tradition, Y was..."
  /^from (within|the perspective)/i,       // "From within the X tradition..."
  /^(the|this) [a-z][\w\s]+ (saw|viewed|understood|experienced)/i,
];

const COMMERCE_NOTE_TEMPLATES = [
  'a comprehensive history',
  'a complete account',
  'an essential overview',
  'a detailed examination',
  'covers all aspects',
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATION LOOP
// ─────────────────────────────────────────────────────────────────────────────

// Track per-file results for the final report
const allResults = [];
let globalFails = 0, globalPasses = 0;
let totalPlannedLinks = 0;

// Support files that live in the entries dir but are NOT entries (app data, not canon).
const NON_ENTRY_FILES = new Set([
  'manifest.json', 'searchIndex.json', 'calendar.json', 'collections.json', 'pathways.json',
]);
const allFiles = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.json') && !NON_ENTRY_FILES.has(f));

const filesToProcess = SINGLE_ENTRY
  ? allFiles.filter(f => f === `${SINGLE_ENTRY}.json`)
  : allFiles;

// Track all IDs seen for duplicate detection
const seenIds = new Map(); // id → filename

for (const fname of filesToProcess) {
  const raw = fs.readFileSync(path.join(ENTRIES_DIR, fname), 'utf8');
  let entry;
  try { entry = JSON.parse(raw); }
  catch (e) {
    allResults.push({
      id: fname,
      fname,
      fails: [`PARSE ERROR: ${e.message}`],
      warnings: [],
      advisories: [],
      stats: null,
    });
    globalFails++;
    continue;
  }

  const id       = entry.id || fname.replace('.json', '');
  const fails    = [];
  const warnings = [];
  const advisories = [];

  // ── 1. SCHEMA INTEGRITY ────────────────────────────────────────────────────

  // 1.1 Required top-level fields
  const REQUIRED_FIELDS = [
    'id','schemaVersion','status','qualityTier','template','subtype',
    'period','title','summary','hook','themes','content',
    'research','comparativeNarrative','rabbitHole','reference','commerce','popularCulture'
  ];
  for (const f of REQUIRED_FIELDS) {
    if (entry[f] === undefined || entry[f] === null || entry[f] === '')
      fails.push(`Missing required field: ${f}`);
  }

  // 1.2 Schema version
  if (entry.schemaVersion !== 1)
    fails.push(`schemaVersion must be 1 (got: ${entry.schemaVersion})`);

  // 1.3 Status
  if (!['published','draft'].includes(entry.status))
    fails.push(`status must be "published" or "draft" (got: "${entry.status}")`);

  // 1.4 Quality tier (advisory only)
  if (!['A','B','C'].includes(entry.qualityTier))
    advisories.push(`qualityTier should be A, B, or C (got: "${entry.qualityTier}")`);

  // 1.5 Template/subtype pairing
  const sectionKeys = SUBTYPE_SECTIONS[entry.subtype];
  if (!sectionKeys)
    warnings.push(`Unknown subtype: "${entry.subtype}" — section key validation skipped`);

  // 1.6 ID format: camelCase, no spaces or special chars
  if (entry.id && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(entry.id))
    fails.push(`id "${entry.id}" is not valid camelCase (no spaces or special chars)`);

  // 1.7 ID matches filename
  const expectedId = fname.replace('.json', '');
  if (entry.id && entry.id !== expectedId)
    fails.push(`id "${entry.id}" does not match filename "${fname}"`);

  // 1.8 ID uniqueness (across this run)
  if (entry.id) {
    if (seenIds.has(entry.id))
      fails.push(`Duplicate id "${entry.id}" — also in ${seenIds.get(entry.id)}`);
    else
      seenIds.set(entry.id, fname);
  }

  // 1.9 Manifest synchronization
  if (entry.id && entry.status === 'published' && !manifestIds.has(entry.id))
    fails.push(`Entry "${entry.id}" is status:published but not in manifest.json`);

  // ── 2. LAYER ARCHITECTURE ─────────────────────────────────────────────────

  const content = entry.content || {};

  // 2.1 All four content layers present
  for (const layer of ['beginner','general','advanced']) {
    if (!content[layer])
      fails.push(`Missing content.${layer}`);
  }
  const edu = content.educational;
  if (!edu) {
    fails.push(`Missing content.educational`);
  } else {
    // 2.2 Educational foundation + interpretation sublayers
    for (const sec of ['foundation','interpretation']) {
      if (!edu[sec]) {
        fails.push(`Missing content.educational.${sec}`);
        continue;
      }
      const expectedFields = sec === 'foundation'
        ? ['theStory','theDebate','whyItMatters','questions']
        : ['scholarlyConversation','evidenceAndLimits','takingAPosition','questions'];
      for (const f of expectedFields) {
        if (!edu[sec][f])
          fails.push(`Missing content.educational.${sec}.${f}`);
      }
      // 2.3 Questions array: exactly 2 items
      const qs = edu[sec]?.questions;
      if (!Array.isArray(qs) || qs.length < 2)
        fails.push(`content.educational.${sec}.questions must have at least 2 items (has ${Array.isArray(qs) ? qs.length : 0})`);
    }
  }

  // 2.4 Required section keys in all three content tiers
  if (sectionKeys) {
    for (const layer of ['beginner','general','advanced']) {
      if (!content[layer]) continue;
      for (const sec of sectionKeys) {
        const val = content[layer][sec];
        if (!val || wordCount(val) < 30)
          fails.push(`Missing or too short: content.${layer}.${sec} (${wordCount(val || '')} words, min 30)`);
      }
    }
  }

  // ── 3. LAYER REGISTER QUALITY (Flesch-Kincaid Grade Level) ───────────────
  //
  // FK grade level enforces actual reading difficulty per layer.
  // Replaces blunt sentence-length and word-count checks that failed to
  // catch Advanced-register prose in Beginner/General slots.
  //
  // Limits:
  //   Beginner  — FK ≤ 8.0  (grade 8, readable by a confident 12-year-old)
  //   General   — FK ≤ 12.0 (grade 12, readable by a high-school senior)
  //   Advanced  — FK ≥ 10.0 (warn if suspiciously thin / low complexity)
  //
  // Word count floor: Beginner must be ≥ 400 words (still enforced).
  // Word count ceiling: Beginner must be ≤ 1000 words (still enforced).

  const beginnerStats = { avg: 0, max: 0, totalWords: 0, maxSent: '', sectionWords: {}, fkGrade: 0 };

  if (content.beginner && sectionKeys) {
    const beginnerSections = sectionKeys.map(k => content.beginner[k] || '');

    // Per-section word count (tracked for stats)
    for (const k of sectionKeys) {
      const secText = content.beginner[k] || '';
      beginnerStats.sectionWords[k] = wordCount(secText);
    }

    const allBeginnerText = beginnerSections.join(' ');
    const avg = avgSentenceLength(allBeginnerText);
    const max = maxSentenceLength(allBeginnerText);
    const totalWc = wordCount(allBeginnerText);
    const longest = longestSentence(allBeginnerText);
    const fkBeginner = fleschKincaidGradeLevel(allBeginnerText);

    beginnerStats.avg = avg;
    beginnerStats.max = max;
    beginnerStats.totalWords = totalWc;
    beginnerStats.maxSent = longest;
    beginnerStats.fkGrade = fkBeginner;

    // 3.1 FK grade level > 8 = FAIL (register too high for target reader)
    if (fkBeginner > 8.0)
      fails.push(`Beginner FK grade level ${fkBeginner.toFixed(1)} — hard limit is 8.0 (grade 8). Layer is written above beginner register. Rewrite from scratch.`);

    // 3.1b FK grade level < 4 = FAIL (too telegraphic / condescending)
    else if (fkBeginner < 4.0)
      fails.push(`Beginner FK grade level ${fkBeginner.toFixed(1)} — floor is 4.0. Layer is too simplified or telegraphic. Expand sentences to proper beginner register.`);

    // 3.2 Word count floor
    if (totalWc < 400)
      warnings.push(`Beginner total word count ${totalWc} is low (target 400–1000)`);

    // 3.3 Word count ceiling
    if (totalWc > 1000)
      fails.push(`Beginner total word count ${totalWc} — hard limit is 1000`);

    // 3.4 Any single sentence > 35 words = FAIL (catches runaway sentences FK may miss)
    if (max > 35)
      fails.push(`Beginner has sentence >35 words (max: ${max}) — "${longest.substring(0,80)}..."`);
  }

  // General layer FK check
  if (content.general && sectionKeys) {
    const allGeneralText = sectionKeys.map(k => content.general[k] || '').join(' ');
    const fkGeneral = fleschKincaidGradeLevel(allGeneralText);
    if (fkGeneral > 11.0)
      fails.push(`General FK grade level ${fkGeneral.toFixed(1)} — hard limit is 11.0 (grade 11). Layer drifts toward Educational/Advanced register. Pull back to a serious-magazine general reader level.`);
    else if (fkGeneral < 9.0)
      fails.push(`General FK grade level ${fkGeneral.toFixed(1)} — floor is 9.0. Layer is too simplified for a general adult reader. Raise register to serious magazine level.`);
    else if (fkGeneral > 10.5)
      warnings.push(`General FK grade level ${fkGeneral.toFixed(1)} — approaching the 11.0 ceiling (warn above 10.5)`);
  }

  // Advanced layer FK check — warn if suspiciously easy (likely collapsed into General)
  if (content.advanced && sectionKeys) {
    const allAdvancedText = sectionKeys.map(k => content.advanced[k] || '').join(' ');
    const fkAdvanced = fleschKincaidGradeLevel(allAdvancedText);
    if (fkAdvanced < 10.0)
      fails.push(`Advanced FK grade level ${fkAdvanced.toFixed(1)} — floor is 10.0. Layer is not written at Advanced register. Rewrite to scholarly near-peer level.`);
  }

  // ── 4. LAYER COLLAPSE DETECTION ───────────────────────────────────────────

  const layerStats = { bwc: 0, gwc: 0, awc: 0, bgSim: 0, gaSim: 0, baSim: 0, sectionSims: {} };

  if (sectionKeys && content.beginner && content.general && content.advanced) {
    const bText = layerText(content.beginner, sectionKeys);
    const gText = layerText(content.general, sectionKeys);
    const aText = layerText(content.advanced, sectionKeys);

    layerStats.bwc = wordCount(bText);
    layerStats.gwc = wordCount(gText);
    layerStats.awc = wordCount(aText);

    // Whole-layer similarities
    const bgSim = similarity(bText, gText);
    const gaSim = similarity(gText, aText);
    const baSim = similarity(bText, aText);

    layerStats.bgSim = bgSim;
    layerStats.gaSim = gaSim;
    layerStats.baSim = baSim;

    // 4.1 Whole-layer collapse: Hard Fail at > 0.85
    if (bgSim > 0.85)
      fails.push(`Layer collapse: Beginner ↔ General similarity ${(bgSim*100).toFixed(0)}% (hard limit 85%) — layers are effectively identical`);
    else if (bgSim > 0.65)
      warnings.push(`Layer similarity warning: Beginner ↔ General ${(bgSim*100).toFixed(0)}% (warn above 65%)`);

    if (gaSim > 0.85)
      fails.push(`Layer collapse: General ↔ Advanced similarity ${(gaSim*100).toFixed(0)}% (hard limit 85%)`);
    else if (gaSim > 0.65)
      warnings.push(`Layer similarity warning: General ↔ Advanced ${(gaSim*100).toFixed(0)}%`);

    if (baSim > 0.85)
      fails.push(`Layer collapse: Beginner ↔ Advanced similarity ${(baSim*100).toFixed(0)}% (hard limit 85%)`);
    else if (baSim > 0.65)
      warnings.push(`Layer similarity warning: Beginner ↔ Advanced ${(baSim*100).toFixed(0)}%`);

    // 4.2 Section-level collapse detection (more granular)
    for (const k of sectionKeys) {
      const bSec = (content.beginner[k] || '');
      const gSec = (content.general[k] || '');
      const aSec = (content.advanced[k] || '');

      // Only check sections with enough content to be meaningful
      if (wordCount(bSec) < 40 || wordCount(gSec) < 40) continue;

      const secBG = similarity(bSec, gSec);
      const secGA = wordCount(aSec) >= 40 ? similarity(gSec, aSec) : 0;

      layerStats.sectionSims[k] = { bg: secBG, ga: secGA };

      if (secBG > 0.85)
        fails.push(`Section collapse [${k}]: Beginner ↔ General ${(secBG*100).toFixed(0)}% — section is effectively copied across layers`);
      else if (secBG > 0.65)
        warnings.push(`Section similarity [${k}]: Beginner ↔ General ${(secBG*100).toFixed(0)}%`);

      if (secGA > 0.85)
        fails.push(`Section collapse [${k}]: General ↔ Advanced ${(secGA*100).toFixed(0)}%`);
      else if (secGA > 0.65)
        warnings.push(`Section similarity [${k}]: General ↔ Advanced ${(secGA*100).toFixed(0)}%`);
    }

    // 4.3 Layer progression ratios removed — fired on 91% of corpus at median ~1.0.
    //     Depth quality is caught by similarity detection (4.2) and the Coherence Check.

    // 4.4 Within-layer duplicate passage detection
    // Splits each layer into paragraphs and checks pairwise similarity.
    // Catches near-verbatim repetition within a single layer (assembly errors).
    // Threshold: 0.6 similarity between paragraphs of >= 30 words each.
    // Join sections with \n\n (not space) to preserve paragraph boundaries between sections.
    const splitParagraphs = (text) =>
      text.split(/\n\n+/).map(p => p.trim()).filter(p => wordCount(p) >= 30);

    const layerTextWithBreaks = (layerObj, keys) =>
      keys.map(k => layerObj[k] || '').join('\n\n');

    for (const [layerName, layerObj] of [['beginner', content.beginner], ['general', content.general], ['advanced', content.advanced]]) {
      if (!layerObj) continue;
      const fullText = layerTextWithBreaks(layerObj, sectionKeys);
      const paras = splitParagraphs(fullText);
      for (let i = 0; i < paras.length; i++) {
        for (let j = i + 1; j < paras.length; j++) {
          const sim = similarity(paras[i], paras[j]);
          if (sim > 0.6) {
            const preview = paras[i].substring(0, 60).replace(/\n/g, ' ');
            fails.push(`Duplicate passage [${layerName}]: paragraphs ${i+1} and ${j+1} share ${(sim*100).toFixed(0)}% similarity — "${preview}..."`);
          }
        }
      }
    }

    // 4.5 Section-opening similarity check
    // Extracts the first two sentences of each section and checks pairwise similarity
    // across all sections within the same layer.
    // Targets the assembly error where two sections open with the same introductory move:
    // same scholar introduced, same claim restated, same framing repeated.
    // Catches cross-section duplication that paragraph-level detection misses because
    // the overlap is concentrated at the opening rather than spread across a full paragraph.
    // Threshold: 0.4 similarity between openings of >= 10 words each.
    // Severity: WARNING (not FAIL) — some shared vocabulary at section openings is legitimate.
    const getOpening = (text) => {
      if (!text || typeof text !== 'string') return '';
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      return sentences.slice(0, 2).join(' ').trim();
    };

    for (const [layerName, layerObj] of [['beginner', content.beginner], ['general', content.general], ['advanced', content.advanced]]) {
      if (!layerObj || !sectionKeys) continue;
      const openings = sectionKeys
        .map(k => ({ key: k, text: getOpening(layerObj[k] || '') }))
        .filter(o => wordCount(o.text) >= 10);
      for (let i = 0; i < openings.length; i++) {
        for (let j = i + 1; j < openings.length; j++) {
          const sim = similarity(openings[i].text, openings[j].text);
          if (sim > 0.4) {
            warnings.push(
              `Section opening similarity [${layerName}]: ${openings[i].key} ↔ ${openings[j].key} share ${(sim*100).toFixed(0)}% — both sections may open with the same move`
            );
          }
        }
      }
    }

    // 4.6 Cross-layer sentence repetition (targeted — see helpers above)
    // Catches the signature anecdote/quote/stat reused across depths that whole-layer
    // similarity (4.1) misses. Severity follows the depth rule:
    //   * Advanced must ADVANCE — reusing a shallower layer's sentence, or re-narrating the
    //     hook in any body layer, is a FAIL.
    //   * Beginner is a lower register than General — parallel is allowed, so only
    //     near-VERBATIM reuse between them is a WARNING.
    const repHookSents = splitSentences(entry.hook || '');
    const repLayerSents = {};
    for (const L of ['beginner', 'general', 'advanced']) {
      repLayerSents[L] = {};
      for (const k of sectionKeys) repLayerSents[L][k] = splitSentences((content[L] && content[L][k]) || '');
    }
    const repSeen = new Set();

    // Hook re-narrated inside a body layer => FAIL
    for (const L of ['beginner', 'general', 'advanced']) {
      for (const k of sectionKeys) for (const sent of repLayerSents[L][k]) {
        for (const h of repHookSents) {
          const m = repMatch(sent, h, false);
          if (!m) continue;
          const dk = 'hook|' + L + '|' + m.runText;
          if (repSeen.has(dk)) continue; repSeen.add(dk);
          fails.push(`Hook re-narrated [${L}.${k}]: body restates the hook (shared "${m.runText.slice(0, 50)}") — the hook should anchor one entry point, not reappear in a layer`);
        }
      }
    }

    // Same-section reuse across layers: Advanced echo => FAIL ; Beginner↔General verbatim => WARNING
    const repPairs = [['beginner', 'general', true], ['beginner', 'advanced', false], ['general', 'advanced', false]];
    for (const [LA, LB, lenient] of repPairs) {
      for (const k of sectionKeys) {
        for (const sa of repLayerSents[LA][k]) for (const sb of repLayerSents[LB][k]) {
          const m = repMatch(sa, sb, lenient);
          if (!m) continue;
          const dk = LA + LB + k + m.runText;
          if (repSeen.has(dk)) continue; repSeen.add(dk);
          if (LB === 'advanced')
            fails.push(`Advanced echoes ${LA} [${k}]: Advanced reuses a shallower sentence (shared "${m.runText.slice(0, 50)}", ${(m.jac*100).toFixed(0)}% overlap) — Advanced must advance, not reword`);
          else
            warnings.push(`Verbatim reuse [${k}]: Beginner ↔ General share a near-identical sentence (shared "${m.runText.slice(0, 50)}") — parallel is fine, but rewrite the duplicate`);
        }
      }
    }
  }

  // ── 5. RESEARCH ───────────────────────────────────────────────────────────

  const research = entry.research || [];

  // 5.1 Minimum count: 3
  if (research.length < 3)
    fails.push(`research needs at least 3 items (has ${research.length})`);

  // 5.2 Required fields per item
  for (const [i, r] of research.entries()) {
    if (!r.status || !r.topic || !r.content)
      fails.push(`research[${i}] missing required field (status, topic, or content)`);
    if (r.status && !['established','emerging','unrecoverable'].includes(r.status))
      fails.push(`research[${i}] invalid status "${r.status}" (must be established|emerging|unrecoverable)`);
  }

  // 5.3 Unrecoverable advisory
  if (research.length >= 3 && !research.some(r => r.status === 'unrecoverable'))
    advisories.push(`research: no "unrecoverable" item — consider adding limits-of-knowledge item`);

  // ── 6. COMPARATIVE NARRATIVE ──────────────────────────────────────────────

  const cn = entry.comparativeNarrative || [];

  // 6.1 Minimum count: 3
  if (cn.length < 3)
    fails.push(`comparativeNarrative needs at least 3 items (has ${cn.length})`);

  // 6.2 Required fields per item
  for (const [i, c] of cn.entries()) {
    if (!c.perspective || !c.name || !c.content)
      fails.push(`comparativeNarrative[${i}] missing required field (perspective, name, or content)`);
  }

  // 6.3 Comparative narrative quality is an editorial judgment, not a word count.
  //     No automated check beyond required fields (6.2 above).

  // 6.4 Register — Comparative Memory displays on the GENERAL layer (App.jsx), so it
  //     must read at General register (FK ~9–11, no banned words), not Advanced/seminar
  //     prose. Without this gate the analytical content silently drifts to FK 15+.
  {
    const cnText = cn.map(c => c.content || '').join(' ').trim();
    if (cnText) {
      const fk = fleschKincaidGradeLevel(cnText);
      if (fk > 11.5)
        fails.push(`comparativeNarrative reads at FK ${fk.toFixed(1)} — it displays on the General layer and must read at General register (target 9–11). Rewrite in serious-magazine prose, not seminar prose.`);
      const banned = cnText.match(/\b(structural|structurally|historiographical|postcolonial|materialist|teleological)\b/gi) || [];
      if (banned.length)
        fails.push(`comparativeNarrative uses General-banned word(s): ${[...new Set(banned.map(w => w.toLowerCase()))].join(', ')} — replace with plain language.`);
    }
  }

  // ── 7. RABBIT HOLES ───────────────────────────────────────────────────────

  const rhs = entry.rabbitHole || [];
  let entryPlannedCount = 0;

  // 7.1 Minimum count: 4 (was 5, reduced after Gateway items removed from rabbit holes)
  if (rhs.length < 4)
    fails.push(`rabbitHole needs at least 4 items (has ${rhs.length})`);

  // 7.2 Gateway relationship type removed — reading recommendations belong in Commerce.

  // 7.3 Self-referential link
  for (const [i, rh] of rhs.entries()) {
    if (rh.entryId && rh.entryId === entry.id)
      fails.push(`rabbitHole[${i}] "${rh.label}" is self-referential (entryId === entry id)`);
  }

  // 7.4 Per-item validation
  for (const [i, rh] of rhs.entries()) {
    if (!rh.label)
      fails.push(`rabbitHole[${i}] missing label`);
    if (!rh.reason)
      warnings.push(`rabbitHole[${i}] "${rh.label || '?'}" missing reason field`);
    if (!rh.relationship) {
      fails.push(`rabbitHole[${i}] "${rh.label || '?'}" missing relationship`);
      continue;
    }
    if (!VALID_RELATIONSHIPS.has(rh.relationship)) {
      fails.push(`rabbitHole[${i}] "${rh.label || '?'}" invalid relationship "${rh.relationship}"`);
      continue;
    }

    // Gateway: valid for backward compatibility but no longer recommended.
    // Commerce section handles reading recommendations better.
    if (rh.relationship === 'Gateway') continue; // no entryId required

    // entryId + status required for all non-Gateway relationship types
    if (!rh.entryId) {
      // Check whether the label resolves to a published entry — if so, the
      // entryId was stripped rather than genuinely unknown.
      const resolvedId = rh.label ? labelToId.get(normalise(rh.label)) : undefined;
      if (resolvedId) {
        warnings.push(`rabbitHole[${i}] "${rh.label}" missing entryId but label resolves to published entry "${resolvedId}" — set entryId and upgrade status to "published"`);
      } else {
        warnings.push(`rabbitHole[${i}] "${rh.label}" missing entryId (use status:planned if entry doesn't exist yet)`);
      }
      continue;
    }
    if (!rh.status) {
      warnings.push(`rabbitHole[${i}] "${rh.label}" missing status field`);
      continue;
    }
    if (!VALID_RH_STATUSES.has(rh.status)) {
      warnings.push(`rabbitHole[${i}] "${rh.label}" invalid status "${rh.status}"`);
      continue;
    }

    // Published link integrity
    if (rh.status === 'published' && !manifestIds.has(rh.entryId))
      fails.push(`rabbitHole[${i}] broken link — "${rh.entryId}" is status:published but not in manifest`);

    // Stale planned link (exists in manifest but still marked planned)
    if (rh.status === 'planned' && manifestIds.has(rh.entryId))
      warnings.push(`rabbitHole[${i}] "${rh.entryId}" is now in manifest — upgrade status from "planned" to "published"`);

    if (rh.status === 'planned') entryPlannedCount++;
  }
  totalPlannedLinks += entryPlannedCount;

  // ── 8. REFERENCES ─────────────────────────────────────────────────────────

  const refs = entry.reference || [];
  const isTierA = entry.qualityTier === 'A';

  // 8.1 Minimum count
  const minRefs = isTierA ? 5 : 3;
  if (refs.length < minRefs)
    fails.push(`${isTierA ? 'Tier A entry' : 'Entry'} requires ${minRefs}+ references (has ${refs.length})`);

  // 8.2 Required fields per item
  for (const [i, r] of refs.entries()) {
    const missing = [];
    if (!r.author) missing.push('author');
    if (!r.title)  missing.push('title');
    if (!r.year)   missing.push('year');
    if (!r.annotation) missing.push('annotation');
    if (missing.length)
      fails.push(`reference[${i}] missing required field(s): ${missing.join(', ')}`);
    // Annotation quality is editorial judgment — no automated length check.
  }

  // ── 9. COMMERCE ───────────────────────────────────────────────────────────

  const commerce = entry.commerce || [];
  const minCommerce = isTierA ? 5 : 3;

  // 9.1 Minimum count
  if (commerce.length < minCommerce)
    fails.push(`${isTierA ? 'Tier A entry' : 'Entry'} requires ${minCommerce}+ commerce items (has ${commerce.length})`);

  // 9.2 Required fields
  // Author is required for text-based types; optional for media types
  const COMMERCE_AUTHOR_REQUIRED_TYPES = new Set(['Book','Novel','Report','Essay','Article','Monograph']);
  for (const [i, c] of commerce.entries()) {
    const authorRequired = !c.type || COMMERCE_AUTHOR_REQUIRED_TYPES.has(c.type);
    const missing = [];
    if (!c.type)  missing.push('type');
    if (!c.title) missing.push('title');
    if (authorRequired && !c.author) missing.push('author');
    if (!c.note)  missing.push('note');
    if (missing.length)
      fails.push(`commerce[${i}] missing required field(s): ${missing.join(', ')}`);
    // Templated note warning
    if (c.note) {
      const noteLower = c.note.toLowerCase();
      if (COMMERCE_NOTE_TEMPLATES.some(t => noteLower.includes(t)))
        warnings.push(`commerce[${i}] "${c.title || '?'}" note sounds templated — should direct the reader ("start here if..."), not describe the book`);
    }
  }

  // 9.3 Duplicate detection — a repeated book pads the min-count check (9.1) and
  // renders twice in the "Find it" row. Same book = shared ISBN OR title+author.
  {
    const seen = new Map(); // signature -> first index
    for (const [i, c] of commerce.entries()) {
      const sigs = commerceSig(c);
      let dupOf = -1;
      for (const s of sigs) if (seen.has(s)) { dupOf = seen.get(s); break; }
      if (dupOf >= 0)
        fails.push(`commerce[${i}] "${c.title || '?'}" duplicates commerce[${dupOf}] "${commerce[dupOf].title || '?'}" — same book (shared ISBN or title+author); remove the duplicate`);
      else
        sigs.forEach(s => seen.set(s, i));
    }
  }

  // ── 10. POPULAR CULTURE ───────────────────────────────────────────────────

  const pc = entry.popularCulture || [];
  const minPc = isTierA ? 5 : 3;

  // 10.1 Minimum count
  if (pc.length < minPc)
    fails.push(`${isTierA ? 'Tier A entry' : 'Entry'} requires ${minPc}+ popularCulture items (has ${pc.length})`);

  // 10.2 Required fields + description length
  for (const [i, item] of pc.entries()) {
    if (!item.type || !item.title || !item.description)
      fails.push(`popularCulture[${i}] missing required field (type, title, or description)`);
    const descWc = wordCount(item.description || '');
    if (descWc > 75)
      fails.push(`popularCulture[${i}] "${item.title || '?'}" description is ${descWc} words — hard limit is 75`);
  }

  // 10.3 Duplicate detection — a repeated item pads the min-count check (10.1)
  // and renders twice on the page. Same item = shared normalized title.
  {
    const seen = new Map();
    for (const [i, item] of pc.entries()) {
      const key = mediaNorm(item.title);
      if (!key) continue;
      if (seen.has(key))
        fails.push(`popularCulture[${i}] "${item.title || '?'}" duplicates popularCulture[${seen.get(key)}] — same item; remove the duplicate`);
      else seen.set(key, i);
    }
  }

  // 10.4 Register — Popular Culture displays on the BEGINNER layer (App.jsx), so the
  //      descriptions must read at Beginner register (plain, concrete), not Advanced.
  //      The "gets it right / distorts" analysis stays; the vocabulary comes down.
  {
    const pcText = pc.map(item => item.description || '').join(' ').trim();
    if (pcText) {
      const fk = fleschKincaidGradeLevel(pcText);
      if (fk > 10.0)
        fails.push(`popularCulture descriptions read at FK ${fk.toFixed(1)} — this section displays on the Beginner layer and must read at Beginner register (aim ≤8). Say what each work gets right and distorts in plain, everyday words.`);
    }
  }

  // 10.5 Global banned word — "historiography"/"historiographical"/etc. must NEVER
  //      appear, in any layer or section. It is the most seminar-coded word there is.
  {
    const hits = JSON.stringify(entry).match(/historiograph\w*/gi);
    if (hits)
      fails.push(`Banned word "${[...new Set(hits.map(h => h.toLowerCase()))].join('", "')}" appears ${hits.length}× — "historiograph…" must never appear, in any layer. Use plain language: "the historical debate", "how historians have read it", "scholarly accounts".`);
  }

  // ── 11. AI FAILURE MODE WARNINGS ──────────────────────────────────────────
  // Procedural self-narration: kept as warning — distinctive pattern, low false positive rate.
  // Anti-declarative inflation phrases removed — too context-dependent, high false positive rate.

  if (content.beginner && sectionKeys) {
    const allBeginnerText = layerText(content.beginner, sectionKeys).toLowerCase();

    // 11.1 Procedural self-narration
    for (const phrase of PROCEDURAL_NARRATION_PHRASES) {
      if (allBeginnerText.includes(phrase))
        warnings.push(`AI pattern [beginner]: procedural self-narration — "${phrase}"`);
    }
  }

  // 11.3 Summary duplicates hook
  if (entry.summary && entry.hook) {
    const hookSim = similarity(entry.summary, entry.hook);
    if (hookSim > 0.6)
      warnings.push(`Summary/hook similarity ${(hookSim*100).toFixed(0)}% — summary may be repeating the hook rather than complementing it`);
  }

  // ── 12. MISC ADVISORIES ───────────────────────────────────────────────────

  // 12.1 interpretiveInfluences present
  if (!entry.interpretiveInfluences || !Array.isArray(entry.interpretiveInfluences) || entry.interpretiveInfluences.length < 3)
    advisories.push(`interpretiveInfluences should have 3+ names (has ${(entry.interpretiveInfluences || []).length})`);

  // ── Aggregate result ───────────────────────────────────────────────────────

  const hasFails = fails.length > 0;
  if (hasFails) globalFails++;
  else globalPasses++;

  allResults.push({
    id,
    fname,
    fails,
    warnings,
    advisories,
    stats: {
      beginner: beginnerStats,
      layers: layerStats,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT REPORT
// ─────────────────────────────────────────────────────────────────────────────

const totalEntries = globalPasses + globalFails;

// Helper to display layer stats block
function layerStatsBlock(result) {
  const { beginner, layers } = result.stats;
  const lines = [];

  // Word counts
  if (layers.bwc || layers.gwc || layers.awc) {
    lines.push(`    Word counts  — Beginner: ${layers.bwc}  General: ${layers.gwc}  Advanced: ${layers.awc}`);
  }

  // Similarity scores
  if (layers.bgSim > 0 || layers.gaSim > 0 || layers.baSim > 0) {
    lines.push(`    Similarity   — B↔G: ${(layers.bgSim*100).toFixed(0)}%  G↔A: ${(layers.gaSim*100).toFixed(0)}%  B↔A: ${(layers.baSim*100).toFixed(0)}%`);
  }

  // Section-level sims if any are notable
  const notableSections = Object.entries(layers.sectionSims || {})
    .filter(([, v]) => v.bg > 0.4 || v.ga > 0.4);
  if (notableSections.length) {
    lines.push(`    Section sims:`);
    for (const [k, v] of notableSections) {
      lines.push(`      ${k.padEnd(26)} B↔G: ${(v.bg*100).toFixed(0)}%  G↔A: ${(v.ga*100).toFixed(0)}%`);
    }
  }

  // Beginner stats with FK grade
  if (beginner.totalWords > 0) {
    const fkFlag = beginner.fkGrade > 8.0 ? ' ✗ OVER LIMIT' : beginner.fkGrade > 7.0 ? ' ⚠ approaching limit' : '';
    lines.push(`    Beginner     — ${beginner.totalWords} words  FK grade: ${beginner.fkGrade.toFixed(1)}${fkFlag}  max sent: ${beginner.max}w`);
  }

  return lines.join('\n');
}

// Count totals
let totalFails = 0, totalWarnings = 0, totalAdvisories = 0;
for (const r of allResults) {
  totalFails     += r.fails.length;
  totalWarnings  += r.warnings.length;
  totalAdvisories += r.advisories.length;
}

// ── FAIL section ──────────────────────────────────────────────────────────────
const failEntries = allResults.filter(r => r.fails.length > 0);
if (failEntries.length) {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  FAIL  (${failEntries.length} entries with publication-blocking errors)`);
  console.log(`${'═'.repeat(72)}`);
  for (const r of failEntries) {
    console.log(`\n  ── ${r.id} (${r.fname})`);
    if (r.stats) {
      const statsBlock = layerStatsBlock(r);
      if (statsBlock) console.log(statsBlock);
    }
    for (const f of r.fails) {
      console.log(`    FAIL  ${f}`);
    }
    if (r.warnings.length) {
      for (const w of r.warnings) {
        console.log(`    WARN  ${w}`);
      }
    }
  }
}

// ── WARNING section (entries with warnings but no fails) ─────────────────────
const warnOnlyEntries = allResults.filter(r => r.fails.length === 0 && r.warnings.length > 0);
if (warnOnlyEntries.length && VERBOSE) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  WARNING  (${warnOnlyEntries.length} entries with warnings — review before publishing)`);
  console.log(`${'─'.repeat(72)}`);
  for (const r of warnOnlyEntries) {
    console.log(`\n  ── ${r.id}`);
    if (r.stats) {
      const statsBlock = layerStatsBlock(r);
      if (statsBlock) console.log(statsBlock);
    }
    for (const w of r.warnings) {
      console.log(`    WARN  ${w}`);
    }
  }
} else if (warnOnlyEntries.length && !VERBOSE) {
  // Show just a summary of warning-only entries
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  WARNING  (${warnOnlyEntries.length} entries with warnings — run --verbose to see)`);
  console.log(`${'─'.repeat(72)}`);
  // Still print entries that have layer similarity warnings since those are important
  const layerWarnEntries = warnOnlyEntries.filter(r =>
    r.warnings.some(w => w.startsWith('Layer') || w.startsWith('Section'))
  );
  for (const r of layerWarnEntries) {
    console.log(`\n  ── ${r.id}`);
    const statsBlock = layerStatsBlock(r);
    if (statsBlock) console.log(statsBlock);
    for (const w of r.warnings.filter(w => w.startsWith('Layer') || w.startsWith('Section'))) {
      console.log(`    WARN  ${w}`);
    }
  }
}

// ── ADVISORY section (verbose only) ──────────────────────────────────────────
const advisoryEntries = allResults.filter(r => r.advisories.length > 0);
if (advisoryEntries.length && VERBOSE) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  ADVISORY  (${advisoryEntries.length} entries — diagnostic, does not block)`);
  console.log(`${'─'.repeat(72)}`);
  for (const r of advisoryEntries) {
    if (!r.advisories.length) continue;
    console.log(`\n  ── ${r.id}`);
    for (const a of r.advisories) {
      console.log(`    ADV   ${a}`);
    }
  }
}

// ── SINGLE ENTRY DETAIL (when --entry is used) ───────────────────────────────
if (SINGLE_ENTRY) {
  const r = allResults.find(x => x.id === SINGLE_ENTRY);
  if (r) {
    console.log(`\n${'═'.repeat(72)}`);
    console.log(`  FULL REPORT: ${r.id}`);
    console.log(`${'═'.repeat(72)}`);
    if (r.stats) console.log(layerStatsBlock(r));

    if (r.fails.length)
      console.log(`\n  FAILS (${r.fails.length}):\n` + r.fails.map(f => `    ✗ ${f}`).join('\n'));
    if (r.warnings.length)
      console.log(`\n  WARNINGS (${r.warnings.length}):\n` + r.warnings.map(w => `    ⚠ ${w}`).join('\n'));
    if (r.advisories.length)
      console.log(`\n  ADVISORIES (${r.advisories.length}):\n` + r.advisories.map(a => `    · ${a}`).join('\n'));
    if (!r.fails.length && !r.warnings.length && !r.advisories.length)
      console.log(`\n  ✓ Entry passes all checks.`);
  } else {
    console.log(`\n  No entry found with id "${SINGLE_ENTRY}"`);
  }
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(72)}`);
console.log(`  SUMMARY`);
console.log(`${'─'.repeat(72)}`);
console.log(`  Entries:    ${totalEntries}  (${globalPasses} passed, ${globalFails} failed)`);
console.log(`  Fails:      ${totalFails}  — publication blocked`);
console.log(`  Warnings:   ${totalWarnings}  — review before publishing`);
console.log(`  Advisories: ${totalAdvisories}  — diagnostic`);
console.log(`  Planned:    ${totalPlannedLinks} rabbit hole links still marked planned`);
console.log(`${'═'.repeat(72)}\n`);

// Exit code: non-zero if any hard fails
process.exit(globalFails > 0 ? 1 : 0);
