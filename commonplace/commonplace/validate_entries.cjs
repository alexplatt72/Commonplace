// validate_entries_v2.js — Commonplace entry validator
// Rabbit hole schema: { label, entryId, status, relationship, reason }
// status: "published" | "planned"
// relationship: Foundational | Consequential | Thematic | Parallel | Gateway
// Gateway entries have no entryId or status

const fs = require('fs');
const path = require('path');

const ENTRIES_DIR = process.argv[2] || 'public/entries';

const manifest = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, 'manifest.json'), 'utf8'));
const manifestIds = new Set(manifest.map(e => e.id));

// ── Template section maps ────────────────────────────────────────────────────
const SUBTYPE_SECTIONS = {
  'Period':            ['thePeriod','theBoundaries','theConditions','internalDiversity','longConsequences','periodizationDebate'],
  'Movement':          ['theMovement','theOrigins','howItOrganized','whatItAchieved','contestedLegacy','whyItEnded'],
  'Extended Process':  ['theEvent','context','theRecord','phases','mechanics','transformation','causation','significance'],
  'Single Event':      ['theEvent','context','theRecord','immediateOutcome','longConsequences','causation'],
  'Historical Actor':  ['theFigure','worldInherited','howExercisedPower','whatTheyChanged','legendVsRecord'],
  'Intellectual':      ['theFigure','theFormativeWorld','theCoreIdeas','theInfluence','theDisputes'],
  'Material Foundation':['theFoundation','howItArrived','whatItReorganized','thePoliticalEconomy','theFeedback','presentAndFuture'],
  'Technology':        ['theTechnology','origins','howItSpread','whatItReplaced','consequences','presentState'],
  'Concept':           ['theConcept','origins','howItSpread','coreVariants','inPractice','theDisputes'],
  'Narrative':         ['theWork','momentOfMaking','whatItDoes','whatItChanged','howBeenRead'],
  'Argument':          ['theArgument','context','theCase','theCountercase','influence'],
  'Philosophical Text':['theWork','theContext','theCoreArgument','theInfluence','enduring'],
};

const VALID_RELATIONSHIPS = new Set(['Foundational','Consequential','Thematic','Parallel','Gateway']);
const VALID_STATUSES = new Set(['published','planned']);

// ── Readability helpers ──────────────────────────────────────────────────────
function avgSentenceLength(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const words = sentences.map(s => s.trim().split(/\s+/).length);
  return words.reduce((a,b)=>a+b,0) / words.length;
}
function maxSentenceLength(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return Math.max(...sentences.map(s => s.trim().split(/\s+/).length));
}
function wordCount(text) { return text.trim().split(/\s+/).length; }

// ── Main validator ───────────────────────────────────────────────────────────
const results = { pass:0, fail:0, fatal:[], required:[], advisory:[] };
let totalPlanned = 0, totalReadabilityAdvisory = 0, totalQualityAdvisory = 0;

const files = fs.readdirSync(ENTRIES_DIR)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json' && f !== 'searchIndex.json');

for (const fname of files) {
  const raw = fs.readFileSync(path.join(ENTRIES_DIR, fname), 'utf8');
  let entry;
  try { entry = JSON.parse(raw); }
  catch(e) { results.fatal.push(`${fname}: invalid JSON — ${e.message}`); results.fail++; continue; }

  const id = entry.id || fname.replace('.json','');
  const issues = { fatal:[], required:[], advisory:[] };

  // ── Required top-level fields ──────────────────────────────────────────────
  for (const f of ['id','title','template','subtype','period','summary','hook',
                   'themes','content','research','comparativeNarrative',
                   'rabbitHole','reference','commerce','popularCulture']) {
    if (!entry[f]) issues.required.push(`${id}: missing required field: ${f}`);
  }
  if (entry.schemaVersion !== 1) issues.required.push(`${id}: schemaVersion must be 1`);
  if (!['published','draft'].includes(entry.status)) issues.required.push(`${id}: status must be "published" or "draft"`);
  if (!['A','B','C'].includes(entry.qualityTier)) issues.advisory.push(`${id}: qualityTier should be A, B, or C`);

  // ── Content layers ─────────────────────────────────────────────────────────
  const content = entry.content || {};
  for (const layer of ['beginner','general','advanced']) {
    if (!content[layer]) { issues.required.push(`${id}: missing content.${layer}`); continue; }
  }
  const edu = content.educational;
  if (!edu) { issues.required.push(`${id}: missing content.educational`); }
  else {
    for (const sec of ['foundation','interpretation']) {
      if (!edu[sec]) issues.required.push(`${id}: missing content.educational.${sec}`);
      else {
        const fSec = edu[sec];
        const secFields = sec === 'foundation' ? ['theStory','theDebate','whyItMatters','questions'] : ['scholarlyConversation','evidenceAndLimits','takingAPosition','questions'];
        for (const f of secFields) {
          if (!fSec[f]) issues.required.push(`${id}: missing content.educational.${sec}.${f}`);
        }
        if (Array.isArray(fSec.questions) && fSec.questions.length < 2)
          issues.required.push(`${id}: content.educational.${sec}.questions must have at least 2 items`);
      }
    }
  }

  // ── Subtype sections ───────────────────────────────────────────────────────
  const expectedSections = SUBTYPE_SECTIONS[entry.subtype];
  if (!expectedSections) {
    issues.advisory.push(`${id}: unknown subtype "${entry.subtype}"`);
  } else {
    for (const layer of ['beginner','general','advanced']) {
      if (!content[layer]) continue;
      for (const sec of expectedSections) {
        const val = content[layer][sec];
        if (!val || val.length < 80)
          issues.required.push(`${id}: missing or too short: content.${layer}.${sec}`);
      }
    }
  }

  // ── Research ───────────────────────────────────────────────────────────────
  const research = entry.research || [];
  if (research.length < 3) issues.required.push(`${id}: research needs at least 3 items`);
  const hasUnrecoverable = research.some(r => r.status === 'unrecoverable');
  if (!hasUnrecoverable) issues.required.push(`${id}: research must include at least one "unrecoverable" item`);
  for (const [i,r] of research.entries()) {
    if (!r.status || !r.topic || !r.content)
      issues.required.push(`${id}: research[${i}] missing status, topic, or content`);
    if (!['established','emerging','unrecoverable'].includes(r.status))
      issues.required.push(`${id}: research[${i}] invalid status "${r.status}"`);
  }

  // ── Comparative narrative ──────────────────────────────────────────────────
  const cn = entry.comparativeNarrative || [];
  if (cn.length < 3) issues.required.push(`${id}: comparativeNarrative needs at least 3 items`);
  for (const [i,c] of cn.entries()) {
    if (!c.perspective || !c.name || !c.content)
      issues.required.push(`${id}: comparativeNarrative[${i}] missing perspective, name, or content`);
  }

  // ── Rabbit holes (new schema) ──────────────────────────────────────────────
  const rhs = entry.rabbitHole || [];
  if (rhs.length < 4) issues.required.push(`${id}: rabbitHole needs at least 4 items`);
  let entryPlanned = 0;
  for (const [i,rh] of rhs.entries()) {
    if (!rh.label) { issues.required.push(`${id}: rabbitHole[${i}] missing label`); continue; }
    if (!rh.reason) issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" missing reason`);

    if (!rh.relationship) {
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" missing relationship`);
      continue;
    }
    if (!VALID_RELATIONSHIPS.has(rh.relationship)) {
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" invalid relationship "${rh.relationship}"`);
      continue;
    }

    if (rh.relationship === 'Gateway') {
      // Gateway: no entryId or status needed
      if (rh.entryId) issues.advisory.push(`${id}: rabbitHole[${i}] Gateway should not have entryId`);
      continue;
    }

    // Non-Gateway: must have entryId and status
    if (!rh.entryId) {
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" missing entryId`);
      continue;
    }
    if (!rh.status) {
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" missing status`);
      continue;
    }
    if (!VALID_STATUSES.has(rh.status)) {
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.label}" invalid status "${rh.status}"`);
      continue;
    }

    const inManifest = manifestIds.has(rh.entryId);
    if (rh.status === 'published' && !inManifest) {
      // Broken link — published but not in manifest
      issues.required.push(`${id}: rabbitHole[${i}] broken link — "${rh.entryId}" is status:published but not in manifest`);
    } else if (rh.status === 'planned' && inManifest) {
      // Stale planned — entry now exists, update to published
      issues.advisory.push(`${id}: rabbitHole[${i}] "${rh.entryId}" is in manifest — update status to "published"`);
      entryPlanned++;
    } else if (rh.status === 'planned') {
      entryPlanned++;
    }
  }
  if (entryPlanned > 0) totalPlanned += entryPlanned;

  // ── References (Tier A: 5+) ────────────────────────────────────────────────
  const refs = entry.reference || [];
  if (entry.qualityTier === 'A' && refs.length < 5)
    issues.advisory.push(`${id}: Tier A entry should have 5+ references (has ${refs.length})`);
  else if (refs.length < 3)
    issues.required.push(`${id}: references needs at least 3 items`);
  for (const [i,r] of refs.entries()) {
    if (!r.author || !r.title || !r.year || !r.annotation)
      issues.required.push(`${id}: reference[${i}] missing author, title, year, or annotation`);
  }

  // ── Commerce (Tier A: 4+) ──────────────────────────────────────────────────
  const commerce = entry.commerce || [];
  if (entry.qualityTier === 'A' && commerce.length < 4)
    issues.advisory.push(`${id}: Tier A entry should have 4+ commerce items (has ${commerce.length})`);
  else if (commerce.length < 3)
    issues.required.push(`${id}: commerce needs at least 3 items`);

  // ── Popular culture (Tier A: 4+) ──────────────────────────────────────────
  const pc = entry.popularCulture || [];
  if (entry.qualityTier === 'A' && pc.length < 4)
    issues.advisory.push(`${id}: Tier A entry should have 4+ popularCulture items (has ${pc.length})`);
  else if (pc.length < 3)
    issues.required.push(`${id}: popularCulture needs at least 3 items`);

  // ── Beginner readability ───────────────────────────────────────────────────
  if (content.beginner) {
    const sections = expectedSections || Object.keys(content.beginner);
    const allText = sections.map(s => content.beginner[s] || '').join(' ');
    if (allText.trim()) {
      const avg = avgSentenceLength(allText);
      const max = maxSentenceLength(allText);
      const wc = wordCount(allText);
      let readAdvisory = false;
      if (avg > 18) { issues.required.push(`${id}: beginner avg sentence length ${avg.toFixed(1)} words (target ≤18)`); }
      if (max > 35) { issues.required.push(`${id}: beginner has sentence >${35} words (max: ${max})`); }
      if (wc < 400) { issues.advisory.push(`${id}: beginner word count ${wc} (target 400-700)`); readAdvisory = true; }
      if (wc > 700) { issues.advisory.push(`${id}: beginner word count ${wc} (target 400-700)`); readAdvisory = true; }
      if (readAdvisory) totalReadabilityAdvisory++;
    }
  }

  // ── interpretiveInfluences ─────────────────────────────────────────────────
  if (!entry.interpretiveInfluences || entry.interpretiveInfluences.length < 3)
    issues.advisory.push(`${id}: interpretiveInfluences should have 3+ names`);

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const hasIssues = issues.fatal.length + issues.required.length > 0;
  if (hasIssues) results.fail++;
  else results.pass++;

  results.fatal.push(...issues.fatal);
  results.required.push(...issues.required);
  results.advisory.push(...issues.advisory);
  if (issues.advisory.length > 0 && issues.fatal.length === 0 && issues.required.length === 0)
    totalQualityAdvisory += issues.advisory.length;
}

// ── Report ───────────────────────────────────────────────────────────────────
const total = results.pass + results.fail;
console.log(`\n  FATAL = app breaks  |  REQUIRED = schema violation  |  ADVISORY = quality/roadmap`);

if (results.fatal.length) {
  console.log(`\n── FATAL ───────────────────────────────────────────────────────────────`);
  results.fatal.forEach(m => console.log(`  FATAL ${m}`));
}
if (results.required.length) {
  console.log(`\n── REQUIRED (schema violation — fix before publishing) ─────────────────`);
  results.required.forEach(m => console.log(`  REQUIRED ${m}`));
}
if (results.advisory.length && process.argv.includes('--verbose')) {
  console.log(`\n── ADVISORY (quality goals — fix when possible) ────────────────────────`);
  results.advisory.forEach(m => console.log(`  ADVISORY ${m}`));
}

console.log(`\n  Passed:   ${results.pass} / ${total} entries`);
console.log(`  Fatal:    ${results.fatal.length}`);
console.log(`  Required: ${results.required.length}`);
console.log(`  Advisory: ${results.advisory.length}`);

const otherAdvisory = results.advisory.length - totalPlanned - totalReadabilityAdvisory;
console.log(`\n  Advisory breakdown: ${totalPlanned} planned links, ${totalReadabilityAdvisory} readability, ${Math.max(0,otherAdvisory)} other`);
