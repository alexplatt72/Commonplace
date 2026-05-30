#!/usr/bin/env node
/**
 * The Commonplace — Entry Validator
 * Run: node validate_entries.js [entries_dir]
 * Default entries_dir: ./public/entries
 */

const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = process.argv[2] || path.join(__dirname, 'public/entries');
const MANIFEST_FILE = path.join(ENTRIES_DIR, 'manifest.json');

// ── Subtype section keys (used to validate content layer sections) ──────────
const SUBTYPE_SECTIONS = {
  "Discrete Event":                  ["theEvent","context","theRecord","theMoment","causation","significance"],
  "Extended Process":                ["theEvent","context","theRecord","phases","mechanics","transformation","causation","significance"],
  "Threshold Moment — Restructured": ["thePivot","theRecord","context","secondOrderEffects","longShadow","causation"],
  "Historical Actor":  ["theFigure","worldInherited","howExercisedPower","whatTheyChanged","legendVsRecord"],
  "Creative Figure":   ["theFigure","whatMadePossible","bodyOfWork","whatTheyChanged","howBeenRead"],
  "Thinker":           ["theFigure","worldOfIdeas","centralIdea","howSpread","contestedInheritance"],
  "Narrative":         ["theWork","momentOfMaking","whatItDoes","whatItChanged","howBeenRead"],
  "Non-narrative":     ["theWork","momentOfMaking","centralArgument","whatItChanged","contestedReading"],
  "Foundational Text": ["theText","momentOfMaking","whatItClaims","interpretiveEcosystem","usedAndWeaponized"],
  "Analytical Concept":["theConcept","problemItSolves","howItWorks","whatItExplains","whereItBreaksDown","usedAndMisusedC"],
  "Normative Concept": ["theConcept","problemItAddresses","competingTraditions","politicalStakes","contestedHistoryC","whereDebateStands"],
  "Period":   ["thePeriod","theBoundaries","theConditions","internalDiversity","longConsequences","periodizationDebate"],
  "Movement": ["theMovement","theOrigins","howItOrganized","whatItAchieved","contestedLegacy","whyItEnded"],
  "Site":     ["thePlace","physicalWorld","theLayers","whatItBecame","whoClaimsIt","theLongLife"],
  "System":   ["theSystem","physicalLogic","whatMovedThrough","whoOrganizedIt","whatItMadePossible","theLongLife"],
  "Natural Event": ["thePhenomenon","theScience","whatItDid","howHumansUnderstoodIt","whatChanged","theLongShadow"],
  "Natural Force": ["theForce","theScience","howItShaped","humanResponse","whatItMadeImpossible","presentAndFuture"],
  "Policy Landscape": ["theLandscape","theHistoricalArc","theValueFramework","theEvidenceEcosystem","theInternationalComparison","theCurrentDebates"],
  "Policy Question": ["theQuestion","theStakes","theValueFramework","theEvidence","theOptions","theInternationalEvidence"],
  "Material Foundation":    ["theFoundation","howItArrived","whatItReorganized","thePoliticalEconomy","theFeedback","presentAndFuture"],
  "Conceptual Foundation":  ["theFoundation","howItArrived","whatItReorganized","theTransmission","theFeedback","presentAndFuture"],
};

// ── Helpers ─────────────────────────────────────────────────────────────────
let failures = [];
let warnings = [];
let passes   = 0;

function fail(id, msg) { failures.push(`  FAIL  ${id}: ${msg}`); }
function warn(id, msg) { warnings.push(`  WARN  ${id}: ${msg}`); }
function check(id, condition, msg) { if (!condition) fail(id, msg); }

function validateEntry(entry, filename, manifestIds) {
  const id = entry.id || filename.replace('.json','');
  let entryFailed = false;
  const before = failures.length;

  // ── 1. Top-level metadata ──────────────────────────────────────────────
  ['id','title','template','subtype','period','summary','hook'].forEach(field => {
    check(id, entry[field] && String(entry[field]).trim().length > 0, `missing or empty: ${field}`);
  });

  // id must match filename
  check(id, entry.id === filename.replace('.json',''), `entry.id "${entry.id}" does not match filename "${filename}"`);

  // ── 2. content object ──────────────────────────────────────────────────
  check(id, entry.content && typeof entry.content === 'object', 'missing: content');
  if (!entry.content) return; // can't continue without content

  // ── 3. Depth layers: beginner, general, advanced ───────────────────────
  ['beginner','general','advanced'].forEach(depth => {
    check(id, entry.content[depth] && typeof entry.content[depth] === 'object', `missing: content.${depth}`);
    if (entry.content[depth]) {
      // Validate section keys for this subtype
      const sections = SUBTYPE_SECTIONS[entry.subtype];
      if (sections) {
        sections.forEach(key => {
          check(id, entry.content[depth][key] && String(entry.content[depth][key]).trim().length > 10,
            `missing or too short: content.${depth}.${key}`);
        });
      } else {
        warn(id, `unknown subtype "${entry.subtype}" — cannot validate section keys`);
      }
    }
  });

  // ── 4. Educational layer ───────────────────────────────────────────────
  check(id, entry.content.educational && typeof entry.content.educational === 'object', 'missing: content.educational');
  if (entry.content.educational) {
    const edu = entry.content.educational;

    // foundation
    check(id, edu.foundation && typeof edu.foundation === 'object', 'missing: content.educational.foundation');
    if (edu.foundation) {
      ['theStory','theDebate','whyItMatters'].forEach(f => {
        check(id, edu.foundation[f] && String(edu.foundation[f]).trim().length > 10,
          `missing or too short: content.educational.foundation.${f}`);
      });
      check(id, Array.isArray(edu.foundation.questions) && edu.foundation.questions.length >= 2,
        'content.educational.foundation.questions must have at least 2 items');
    }

    // interpretation
    check(id, edu.interpretation && typeof edu.interpretation === 'object', 'missing: content.educational.interpretation');
    if (edu.interpretation) {
      ['scholarlyConversation','evidenceAndLimits','takingAPosition'].forEach(f => {
        check(id, edu.interpretation[f] && String(edu.interpretation[f]).trim().length > 10,
          `missing or too short: content.educational.interpretation.${f}`);
      });
      check(id, Array.isArray(edu.interpretation.questions) && edu.interpretation.questions.length >= 2,
        'content.educational.interpretation.questions must have at least 2 items');
    }
  }

  // ── 5. research ────────────────────────────────────────────────────────
  check(id, Array.isArray(entry.research) && entry.research.length >= 3,
    `research must have at least 3 items (has ${Array.isArray(entry.research) ? entry.research.length : 'none'})`);
  if (Array.isArray(entry.research)) {
    const validStatuses = ['established','emerging','speculative','unrecoverable'];
    entry.research.forEach((r,i) => {
      check(id, r.status && validStatuses.includes(r.status),
        `research[${i}].status must be one of: ${validStatuses.join(', ')} (got "${r.status}")`);
      check(id, r.topic && r.topic.trim().length > 0, `research[${i}].topic is missing`);
      check(id, r.content && r.content.trim().length > 20, `research[${i}].content is too short`);
    });
  }

  // ── 6. comparativeNarrative ────────────────────────────────────────────
  check(id, Array.isArray(entry.comparativeNarrative) && entry.comparativeNarrative.length >= 3,
    `comparativeNarrative must have at least 3 items (has ${Array.isArray(entry.comparativeNarrative) ? entry.comparativeNarrative.length : 'none'})`);

  // ── 7. rabbitHole ──────────────────────────────────────────────────────
  check(id, Array.isArray(entry.rabbitHole) && entry.rabbitHole.length >= 5,
    `rabbitHole must have at least 5 items (has ${Array.isArray(entry.rabbitHole) ? entry.rabbitHole.length : 'none'})`);
  if (Array.isArray(entry.rabbitHole)) {
    entry.rabbitHole.forEach((r,i) => {
      if (!r.entryId || r.entryId.trim().length === 0) warn(id, `rabbitHole[${i}].entryId is missing (future entry: "${r.label}")`);
      check(id, r.label && r.label.trim().length > 0, `rabbitHole[${i}].label is missing`);
      check(id, r.reason && r.reason.trim().length > 10, `rabbitHole[${i}].reason is too short`);
      // Warn (not fail) if entryId not in manifest — may be intentional future entry
      if (r.entryId && manifestIds && !manifestIds.includes(r.entryId)) {
        warn(id, `rabbitHole[${i}].entryId "${r.entryId}" not found in manifest (future entry or typo?)`);
      }
    });
  }

  // ── 8. reference ───────────────────────────────────────────────────────
  check(id, Array.isArray(entry.reference) && entry.reference.length >= 4,
    `reference must have at least 4 items (has ${Array.isArray(entry.reference) ? entry.reference.length : 'none'})`);
  if (Array.isArray(entry.reference)) {
    entry.reference.forEach((r,i) => {
      check(id, r.author && r.author.trim().length > 0, `reference[${i}].author is missing`);
      check(id, r.title && r.title.trim().length > 0, `reference[${i}].title is missing`);
      check(id, r.annotation && r.annotation.trim().length > 20, `reference[${i}].annotation is too short`);
    });
  }

  // ── 9. commerce ────────────────────────────────────────────────────────
  check(id, Array.isArray(entry.commerce) && entry.commerce.length >= 3,
    `commerce must have at least 3 items (has ${Array.isArray(entry.commerce) ? entry.commerce.length : 'none'})`);

  // ── 10. popularCulture ─────────────────────────────────────────────────
  check(id, Array.isArray(entry.popularCulture) && entry.popularCulture.length >= 3,
    `popularCulture must have at least 3 items (has ${Array.isArray(entry.popularCulture) ? entry.popularCulture.length : 'none'})`);
  if (Array.isArray(entry.popularCulture)) {
    entry.popularCulture.forEach((p,i) => {
      check(id, p.type && p.type.trim().length > 0, `popularCulture[${i}].type is missing`);
      check(id, p.title && p.title.trim().length > 0, `popularCulture[${i}].title is missing`);
      check(id, p.description && p.description.trim().length > 20, `popularCulture[${i}].description is too short`);
    });
  }

  if (failures.length === before) passes++;
  return failures.length === before;
}

// ── Main ────────────────────────────────────────────────────────────────────
console.log(`\nThe Commonplace — Entry Validator`);
console.log(`Entries directory: ${ENTRIES_DIR}\n`);

// Load manifest
let manifest = [];
let manifestIds = [];
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  manifestIds = manifest.map(e => e.id);
  console.log(`Manifest loaded: ${manifest.length} entries`);
} catch(e) {
  console.error(`ERROR: Could not read manifest.json — ${e.message}`);
  process.exit(1);
}

// Get all entry files
const entryFiles = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json')
  .sort();

console.log(`Entry files found: ${entryFiles.length}\n`);

// ── Manifest cross-checks ────────────────────────────────────────────────
console.log('── Manifest integrity ─────────────────────────────────────────');
const fileIds = entryFiles.map(f => f.replace('.json',''));

// Every file in manifest?
fileIds.forEach(id => {
  if (!manifestIds.includes(id)) {
    fail('MANIFEST', `entry file "${id}.json" exists but is not in manifest.json`);
  }
});

// Every manifest entry has a file?
manifestIds.forEach(id => {
  if (!fileIds.includes(id)) {
    fail('MANIFEST', `manifest entry "${id}" has no matching JSON file`);
  }
});

if (failures.length === 0) console.log('  PASS  manifest — all files and entries match\n');
else console.log('');

// ── Validate each entry ──────────────────────────────────────────────────
console.log('── Entry validation ────────────────────────────────────────────');
entryFiles.forEach(filename => {
  const filepath = path.join(ENTRIES_DIR, filename);
  try {
    const entry = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const passed = validateEntry(entry, filename, manifestIds);
    if (passed) process.stdout.write(`  PASS  ${filename}\n`);
  } catch(e) {
    fail(filename.replace('.json',''), `JSON parse error — ${e.message}`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n── Results ─────────────────────────────────────────────────────`);
console.log(`  Passed:  ${passes} / ${entryFiles.length} entries`);
console.log(`  Failed:  ${failures.length > 0 ? failures.length + ' issues' : '0'}`);
console.log(`  Warnings: ${warnings.length}`);

if (failures.length > 0) {
  console.log('\n── FAILURES ────────────────────────────────────────────────────');
  failures.forEach(f => console.log(f));
}
if (warnings.length > 0) {
  console.log('\n── WARNINGS (not blocking) ─────────────────────────────────────');
  warnings.forEach(w => console.log(w));
}
console.log('');
process.exit(failures.length > 0 ? 1 : 0);
