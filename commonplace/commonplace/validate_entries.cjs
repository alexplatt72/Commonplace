#!/usr/bin/env node
/**
 * The Commonplace — Entry Validator  v2
 *
 * Three levels:
 *   FATAL    — App may break or entry cannot render. Always blocks. Exit 1.
 *   REQUIRED — Entry violates current schema. Blocks publishing. Exit 1.
 *   ADVISORY — Quality or roadmap issue. Never blocks. Exit 0.
 *
 * Run: node validate_entries.js [entries_dir]
 * Default entries_dir: ./public/entries
 */

const fs   = require('fs');
const path = require('path');

const ENTRIES_DIR  = process.argv[2] || path.join(__dirname, 'public/entries');
const MANIFEST_FILE = path.join(ENTRIES_DIR, 'manifest.json');

// ── Subtype → required section keys ─────────────────────────────────────────
const SUBTYPE_SECTIONS = {
  'Discrete Event':                  ['theEvent','context','theRecord','theMoment','causation','significance'],
  'Extended Process':                ['theEvent','context','theRecord','phases','mechanics','transformation','causation','significance'],
  'Threshold Moment — Restructured': ['thePivot','theRecord','context','secondOrderEffects','longShadow','causation'],
  'Threshold Moment -- Restructured':['thePivot','theRecord','context','secondOrderEffects','longShadow','causation'],
  'Historical Actor':  ['theFigure','worldInherited','howExercisedPower','whatTheyChanged','legendVsRecord'],
  'Creative Figure':   ['theFigure','whatMadePossible','bodyOfWork','whatTheyChanged','howBeenRead'],
  'Thinker':           ['theFigure','worldOfIdeas','centralIdea','howSpread','contestedInheritance'],
  'Narrative':         ['theWork','momentOfMaking','whatItDoes','whatItChanged','howBeenRead'],
  'Non-narrative':     ['theWork','momentOfMaking','centralArgument','whatItChanged','contestedReading'],
  'Foundational Text': ['theText','momentOfMaking','whatItClaims','interpretiveEcosystem','usedAndWeaponized'],
  'Analytical Concept':['theConcept','problemItSolves','howItWorks','whatItExplains','whereItBreaksDown','usedAndMisusedC'],
  'Normative Concept': ['theConcept','problemItAddresses','competingTraditions','politicalStakes','contestedHistoryC','whereDebateStands'],
  'Period':            ['thePeriod','theBoundaries','theConditions','internalDiversity','longConsequences','periodizationDebate'],
  'Movement':          ['theMovement','theOrigins','howItOrganized','whatItAchieved','contestedLegacy','whyItEnded'],
  'Site':              ['thePlace','physicalWorld','theLayers','whatItBecame','whoClaimsIt','theLongLife'],
  'System':            ['theSystem','physicalLogic','whatMovedThrough','whoOrganizedIt','whatItMadePossible','theLongLife'],
  'Natural Event':     ['thePhenomenon','theScience','whatItDid','howHumansUnderstoodIt','whatChanged','theLongShadow'],
  'Natural Force':     ['theForce','theScience','howItShaped','humanResponse','whatItMadeImpossible','presentAndFuture'],
  'Policy Landscape':  ['theLandscape','theHistoricalArc','theValueFramework','theEvidenceEcosystem','theInternationalComparison','theCurrentDebates'],
  'Policy Question':   ['theQuestion','theStakes','theValueFramework','theEvidence','theOptions','theInternationalEvidence'],
  'Material Foundation':   ['theFoundation','howItArrived','whatItReorganized','thePoliticalEconomy','theFeedback','presentAndFuture'],
  'Conceptual Foundation': ['theFoundation','howItArrived','whatItReorganized','theTransmission','theFeedback','presentAndFuture'],
};

// ── Issue buckets ─────────────────────────────────────────────────────────────
const fatals    = [];   // blocks always
const requireds = [];   // blocks publishing
const advisories = [];  // never blocks
let passes = 0;

const F = (id, msg) => fatals.push(`  FATAL    ${id}: ${msg}`);
const R = (id, msg) => requireds.push(`  REQUIRED ${id}: ${msg}`);
const A = (id, msg) => advisories.push(`  ADVISORY ${id}: ${msg}`);

const chk = (id, condition, msg, level = 'required') => {
  if (!condition) {
    if (level === 'fatal')    F(id, msg);
    else if (level === 'advisory') A(id, msg);
    else R(id, msg);
  }
};

// ── Entry validation ──────────────────────────────────────────────────────────
function validateEntry(entry, filename, manifestIds) {
  const id       = entry.id || filename.replace('.json', '');
  const beforeF  = fatals.length;
  const beforeR  = requireds.length;

  // ── FATAL checks — app cannot render without these ────────────────────────
  chk(id, entry.id    && String(entry.id).trim().length > 0,    'missing: id',    'fatal');
  chk(id, entry.title && String(entry.title).trim().length > 0, 'missing: title', 'fatal');
  chk(id, entry.id === filename.replace('.json', ''),
    `entry.id "${entry.id}" does not match filename "${filename}"`, 'fatal');
  chk(id, entry.content && typeof entry.content === 'object',   'missing: content (app will crash)', 'fatal');

  if (fatals.length > beforeF) return false; // can't continue safely

  // ── REQUIRED checks — schema violations ───────────────────────────────────

  // Core metadata
  ['template','subtype','period','summary','hook'].forEach(field =>
    chk(id, entry[field] && String(entry[field]).trim().length > 0, `missing or empty: ${field}`)
  );

  // Governance fields
  if (entry.status && !['draft','review','published','legacy','deprecated','merged'].includes(entry.status))
    R(id, `invalid status value: '${entry.status}'`);
  if (entry.qualityTier && !['A','B','C','D','Hold'].includes(entry.qualityTier))
    R(id, `invalid qualityTier value: '${entry.qualityTier}'`);

  // Themes — required for search
  chk(id, Array.isArray(entry.themes) && entry.themes.length > 0,
    'missing or empty: themes — required for search (add 5-10 from themes.json)');

  // Content depth layers
  ['beginner','general','advanced'].forEach(depth => {
    chk(id, entry.content[depth] && typeof entry.content[depth] === 'object',
      `missing: content.${depth}`);
    if (entry.content[depth]) {
      const sections = SUBTYPE_SECTIONS[entry.subtype];
      if (sections) {
        sections.forEach(key =>
          chk(id, entry.content[depth][key] && String(entry.content[depth][key]).trim().length > 10,
            `missing or too short: content.${depth}.${key}`)
        );
      } else {
        A(id, `unknown subtype "${entry.subtype}" — cannot validate section keys`);
      }
    }
  });

  // Educational layer
  chk(id, entry.content.educational && typeof entry.content.educational === 'object',
    'missing: content.educational');
  if (entry.content.educational) {
    const edu = entry.content.educational;

    chk(id, edu.foundation && typeof edu.foundation === 'object',
      'missing: content.educational.foundation');
    if (edu.foundation) {
      ['theStory','theDebate','whyItMatters'].forEach(f =>
        chk(id, edu.foundation[f] && String(edu.foundation[f]).trim().length > 10,
          `missing or too short: content.educational.foundation.${f}`)
      );
      chk(id, Array.isArray(edu.foundation.questions) && edu.foundation.questions.length >= 2,
        'content.educational.foundation.questions must have at least 2 items');
    }

    chk(id, edu.interpretation && typeof edu.interpretation === 'object',
      'missing: content.educational.interpretation');
    if (edu.interpretation) {
      ['scholarlyConversation','evidenceAndLimits','takingAPosition'].forEach(f =>
        chk(id, edu.interpretation[f] && String(edu.interpretation[f]).trim().length > 10,
          `missing or too short: content.educational.interpretation.${f}`)
      );
      chk(id, Array.isArray(edu.interpretation.questions) && edu.interpretation.questions.length >= 2,
        'content.educational.interpretation.questions must have at least 2 items');
    }
  }

  // Bottom six sections
  chk(id, Array.isArray(entry.research) && entry.research.length >= 3,
    `research must have at least 3 items (has ${Array.isArray(entry.research) ? entry.research.length : 'none'})`);
  if (Array.isArray(entry.research)) {
    const validStatuses = ['established','emerging','speculative','unrecoverable'];
    entry.research.forEach((r, i) => {
      chk(id, r.status && validStatuses.includes(r.status),
        `research[${i}].status must be one of: ${validStatuses.join(', ')} (got "${r.status}")`);
      chk(id, r.topic  && r.topic.trim().length > 0,   `research[${i}].topic is missing`);
      chk(id, r.content && r.content.trim().length > 20, `research[${i}].content is too short`);
    });
  }

  chk(id, Array.isArray(entry.comparativeNarrative) && entry.comparativeNarrative.length >= 3,
    `comparativeNarrative must have at least 3 items (has ${Array.isArray(entry.comparativeNarrative) ? entry.comparativeNarrative.length : 'none'})`);

  chk(id, Array.isArray(entry.rabbitHole) && entry.rabbitHole.length >= 5,
    `rabbitHole must have at least 5 items (has ${Array.isArray(entry.rabbitHole) ? entry.rabbitHole.length : 'none'})`);
  if (Array.isArray(entry.rabbitHole)) {
    entry.rabbitHole.forEach((r, i) => {
      chk(id, r.label  && r.label.trim().length > 0,   `rabbitHole[${i}].label is missing`);
      chk(id, r.reason && r.reason.trim().length > 10, `rabbitHole[${i}].reason is too short`);
      // No entryId = Future link → Advisory only
      if (!r.entryId || r.entryId.trim().length === 0)
        A(id, `rabbitHole[${i}].entryId is missing (future entry: "${r.label}")`);
      // entryId present but not in manifest = broken Published link → Required
      if (r.entryId && manifestIds && !manifestIds.includes(r.entryId)) {
        const suggestion = canonicalIds[r.entryId.toLowerCase()];
        const hint = suggestion ? ` — did you mean '${suggestion}'?` : '';
        R(id, `rabbitHole[${i}].entryId "${r.entryId}" not found in manifest${hint} — fix ID or remove it`);
      }
    });
  }

  chk(id, Array.isArray(entry.reference) && entry.reference.length >= 4,
    `reference must have at least 4 items (has ${Array.isArray(entry.reference) ? entry.reference.length : 'none'})`);
  if (Array.isArray(entry.reference)) {
    entry.reference.forEach((r, i) => {
      chk(id, r.author && r.author.trim().length > 0,       `reference[${i}].author is missing`);
      chk(id, r.title  && r.title.trim().length > 0,        `reference[${i}].title is missing`);
      chk(id, r.annotation && r.annotation.trim().length > 20, `reference[${i}].annotation is too short`);
    });
  }

  chk(id, Array.isArray(entry.commerce) && entry.commerce.length >= 3,
    `commerce must have at least 3 items (has ${Array.isArray(entry.commerce) ? entry.commerce.length : 'none'})`);

  chk(id, Array.isArray(entry.popularCulture) && entry.popularCulture.length >= 3,
    `popularCulture must have at least 3 items (has ${Array.isArray(entry.popularCulture) ? entry.popularCulture.length : 'none'})`);
  if (Array.isArray(entry.popularCulture)) {
    entry.popularCulture.forEach((p, i) => {
      chk(id, p.type  && p.type.trim().length > 0,           `popularCulture[${i}].type is missing`);
      chk(id, p.title && p.title.trim().length > 0,          `popularCulture[${i}].title is missing`);
      chk(id, p.description && p.description.trim().length > 20, `popularCulture[${i}].description is too short`);
    });
  }

  // ── Beginner readability check ───────────────────────────────────────────
  (function checkBeginnerReadability() {
    if (!entry.content || !entry.content.beginner) return;
    const sections = SUBTYPE_SECTIONS[entry.subtype] || [];
    const text = sections.map(k => entry.content.beginner[k] || '').join(' ');
    if (!text.trim()) return;

    // Split into sentences
    const sents = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.split(/\s+/).length > 3);
    if (!sents.length) return;

    const wordCounts = sents.map(s => s.split(/\s+/).filter(w => w).length);
    const avg = wordCounts.reduce((a,b) => a+b, 0) / wordCounts.length;
    const over35 = wordCounts.filter(n => n > 35).length;
    const totalWords = text.split(/\s+/).filter(w => w).length;

    if (avg > 18)
      A(id, `Beginner avg sentence ${avg.toFixed(1)} words (target ≤18) — readability pass needed`);
    if (over35 > 0)
      A(id, `Beginner has ${over35} sentence(s) over 35 words — split for accessibility`);
    if (totalWords > 800)
      A(id, `Beginner layer ${totalWords} words (target 400–700) — consider tightening`);
  })();

    // ── ADVISORY checks — quality and enrichment ──────────────────────────────
  if (!entry.schemaVersion && entry.schemaVersion !== 0)
    A(id, 'missing: schemaVersion (add schemaVersion: 1)');
  if (!entry.status)
    A(id, 'missing: status (add status: "published")');
  if (!entry.qualityTier)
    A(id, 'missing: qualityTier (add qualityTier: "A", "B", "C", "D", or "Hold")');
  if (!Array.isArray(entry.aliases))
    A(id, 'missing: aliases (alternate search names — empty array if none)');
  if (!Array.isArray(entry.indexTerms))
    A(id, 'missing: indexTerms (proper nouns inside the entry — empty array if none)');

  const clean = fatals.length === beforeF && requireds.length === beforeR;
  if (clean) passes++;
  return clean;
}

// ── Main ──────────────────────────────────────────────────────────────────────
// Load canonical ID registry (optional)
let canonicalIds = {};
const canonicalPath = path.join(ENTRIES_DIR, '..', 'canonicalIds.json');
try {
  const raw = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
  Object.keys(raw).filter(k => k !== '_note')
    .forEach(k => { canonicalIds[k.toLowerCase()] = raw[k]; });
} catch (e) { /* optional — skip if missing */ }

console.log(`\nThe Commonplace — Entry Validator v2`);
console.log(`  FATAL = app breaks  |  REQUIRED = schema violation  |  ADVISORY = quality/roadmap`);
console.log(`Entries directory: ${ENTRIES_DIR}\n`);

// Load manifest
let manifest = [], manifestIds = [];
try {
  manifest    = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  manifestIds = manifest.map(e => e.id);
  console.log(`Manifest loaded: ${manifest.length} entries`);
} catch (e) {
  console.error(`ERROR: Could not read manifest.json — ${e.message}`);
  process.exit(1);
}

const entryFiles = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort();
console.log(`Entry files found: ${entryFiles.length}\n`);

// Manifest integrity
console.log('── Manifest integrity ─────────────────────────────────────────');
const fileIds = entryFiles.map(f => f.replace('.json', ''));
fileIds.forEach(id => {
  if (!manifestIds.includes(id))
    R('MANIFEST', `entry file "${id}.json" exists but is not in manifest.json`);
});
manifestIds.forEach(id => {
  if (!fileIds.includes(id))
    R('MANIFEST', `manifest entry "${id}" has no matching JSON file`);
});
if (requireds.length === 0) console.log('  PASS  manifest — all files and entries match\n');
else console.log('');

// Validate each entry
console.log('── Entry validation ────────────────────────────────────────────');
entryFiles.forEach(filename => {
  const filepath = path.join(ENTRIES_DIR, filename);
  try {
    const entry = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const ok = validateEntry(entry, filename, manifestIds);
    if (ok) process.stdout.write(`  PASS  ${filename}\n`);
  } catch (e) {
    F(filename.replace('.json', ''), `JSON parse error — ${e.message}`);
  }
});

// Summary
const totalIssues = fatals.length + requireds.length;
console.log(`\n── Results ─────────────────────────────────────────────────────`);
console.log(`  Passed:   ${passes} / ${entryFiles.length} entries`);
console.log(`  Fatal:    ${fatals.length}`);
console.log(`  Required: ${requireds.length}`);
console.log(`  Advisory: ${advisories.length}`);

if (fatals.length > 0) {
  console.log('\n── FATAL (entry cannot render — fix immediately) ───────────────');
  fatals.forEach(f => console.log(f));
}
if (requireds.length > 0) {
  console.log('\n── REQUIRED (schema violation — fix before publishing) ─────────');
  requireds.forEach(r => console.log(r));
}
if (advisories.length > 0) {
  console.log('\n── ADVISORY (quality / roadmap — never blocks) ─────────────────');
  advisories.forEach(a => console.log(a));
}
console.log('');
process.exit(totalIssues > 0 ? 1 : 0);
