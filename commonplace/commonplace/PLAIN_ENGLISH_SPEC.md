# Plain English (CEFR B1) Layer — Specification

> ## ⚠️ RETIRED (2026-07) — HISTORICAL ONLY
> **The Easy / Plain English layer is retired and must never be written, generated, or
> transformed again.** It has been removed from the reader-facing site
> (`PLAIN_ENGLISH_ENABLED = false`, permanent); the accessible reading levels are now
> **Starter** (`beginner`) and **Standard** (`general`). Legacy entries may carry a dormant
> `content.plainEnglish` block — hidden and inert; leave it, but never author a new one.
> This document is kept only to explain the dormant blocks; it is **not** a live authoring spec.

Status (historical): the layer was completed across the canon, then **retired and hidden**
behind the master kill-switch `PLAIN_ENGLISH_ENABLED` in `src/App.jsx` (permanently `false`).

This document is the **single source of truth** for generating the layer. It is given
to every generation and review agent **verbatim**. Do not paraphrase it per-run.

---

## 1. What this layer is

A `plainEnglish` content block on an entry, written at **CEFR B1**, for readers whose
first language is not English (and, usefully, for low-literacy native readers and
skimmers). It is the most accessible reading of an entry.

It is a **language axis, not a depth axis**: same facts as Beginner, simpler English.
In the depth selector it sits first: `Plain English → Beginner → General → Educational
→ Advanced → Research`.

## 2. The core rule: transformation, not authorship

**You are translating, not writing.** The input is the entry's existing `content.beginner`
block. Your job is to rewrite its language to B1 and nothing else.

- Keep **every fact, name, number, date, place, and claim** in the Beginner source.
- **Add no new facts.** No new examples, figures, names, dates, events, or claims — even if
  you "know" them. *"Add nothing" means add no new information.* It does **not** forbid a
  short plain-words gloss of a term that is already in the source (see §3) — glossing is
  required, and restating an existing term in simpler words is not a new fact.
- **Drop no fact.** You may drop ornament, never information. Do not drop a clause or a
  sentence that carries a fact, a qualifier, or a place ("…at sea", "almost nothing there").
- **Preserve these *precisely* — do not "simplify" them**, because changing them changes a
  fact: numbers, dates, names, **titles** ("emperor", not "ruler"), **quantifiers** ("a few",
  not "several"), and **loaded/characterizing words the source chose on purpose** ("mobs" not
  "groups"; "grabbing" not "taking"; "accommodated" not "accepted"). A neutral synonym for
  readability is fine; a synonym that shifts meaning, scale, or connotation is fact drift.
  This does **not** include plain emphasis/intensity adverbs — "remarkably", "enormously",
  "strikingly", "legendary" may and should be simplified ("very", "really", "great"); they
  carry no fact. Preserve only words whose change alters who/what/when/how-many or a
  deliberate characterization (legal vs normal, diagnosis vs understanding, mobs vs groups).
- Keep the **same sections, in the same order**, with the **same section keys**.
- Keep roughly the **same number of paragraphs** and the same order of ideas.

If the Beginner source is wrong or thin, that is not your problem to fix here — flag it,
do not silently "improve" it. Inventing to improve is the #1 drift failure.

**The one-line test — Beginner authors, Plain English translates.** This is *not* "easier
Beginner." FK score does not separate the two layers (both read under 8); **purpose** does.
The Beginner layer already made every authorial choice — the structure, the emphasis, which
facts to foreground, the examples, how deep to explain. You may remake **none** of them.
Beyond "add nothing / drop nothing" above, that specifically means you may **not**: change
which points are emphasized or re-weight the argument; cut a tension or a difficulty to make
the prose "flow"; swap in different examples; or compress a section into a summary (stay in
Beginner's length band — this is a re-expression, not a digest). You may change only the
*language*: shorter sentences, commoner words, in-line glosses of terms already present, no
idioms, more sequential syntax.

## 3. B1 language rules

**Sentences**
- One idea per sentence. Prefer 8–14 words; **hard max 28 words** (validator-enforced).
- Active voice. Clear subject → verb → object.
- Present tense where the meaning allows.
- **Readability is enforced (FK ≤ 8 hard, ≤ 7 target).** Abstract topics — concepts,
  philosophy, economics, law — run hot and need *harder* work: split sentences to ~10–12
  words and reach for the plainest possible word. If a section feels dense, it is over the
  line. Re-check your most abstract sections before finishing.

**Vocabulary**
- Prefer the ~3,000 most common English words.
- **Gloss every technical term on first use**, briefly and in-line. Example from the
  aluminum exemplar: *"a rock called bauxite"*, *"a white powder. We call this powder
  alumina."*, *"Wind turbines are the tall machines that make power from wind."*
- Replace heavy words with light ones when meaning survives: prefer *power* over
  *electricity*, *useful* over *important*, *costly* over *expensive*. (Polysyllabic
  domain terms that have no plain synonym — *aluminum*, *pollution* — stay.)

**Banned at B1**
- Idioms, metaphors, figurative phrasing ("the stuff of", "packs in", "cuts across",
  "double-edged", "tip of the iceberg").
- Phrasal verbs where a plain verb exists.
- **Em dashes and semicolons** (validator-enforced) — split into short sentences.
- Rhetorical flourishes, ironic asides, rare connectives.
- Any markdown or `[[wiki]]` scaffolding (validator-enforced) — plain prose strings only.
- **Crutch words — limited, not banned:** the evaluative "matters/mattered" ("why it
  matters", "X matters because") is capped per block (validator-enforced, default 2). Prefer
  "is important", "shaped", "changed", or just state the point. The physical-substance noun
  "matter" ("states of matter") is fine and uncapped.

**Variety — avoid corpus-wide sameness.** You write one entry, but it sits beside hundreds.
A per-entry reviewer can't see this; you must. An editorial read of the first ~100 entries
found two repeating molds to break:

- **Vary the opening.** Do *not* default to either of the two over-used openers: a date
  ("In 1687…", "In 1429…") or a second-person/device hook ("Imagine…", "Stand…", "Think
  about…", "Pick up…", "you…"). About half the early entries opened one of these two ways.
  Each is fine *occasionally*, but reach for alternatives: lead with the subject, a plain
  consequence, a concrete object, a surprising fact, or a direct question. The opening should
  fit the entry, not a template.
- **Limit these connective crutches** (they recur across entries): "one of the most / largest
  / oldest …", "for a long time", "for most of history", "at the same time", "changed
  everything / changed the world". Use them sparingly — at most once per block — and prefer a
  specific statement ("the oldest city in the region" beats "one of the oldest cities").

## 4. Output format

A JSON object whose keys are **exactly** the Beginner block's section keys, each value a
plain string. Paragraphs separated by `\n\n`. No markdown, no headings, no lists, no
trailing commentary. Example shape (keys vary by entry subtype):

```json
{ "theFoundation": "…", "howItArrived": "…", "whatItReorganized": "…",
  "thePoliticalEconomy": "…", "theFeedback": "…", "presentAndFuture": "…" }
```

## 5. The golden exemplar

`public/entries/aluminum.json` → `content.plainEnglish` is the reference transformation.
Read its Beginner source beside it and match that voice, sentence rhythm, and glossing
style. It passes every gate below with FK grades 3.9–6.1.

## 6. What the validator enforces (the drift fence)

`validators/plainEnglish.cjs` runs on any entry that has a `plainEnglish` block.
Thresholds live in `rules/style.json` → `plainEnglish`; severity in `rules/severity.json`.
**Anything checkable is checked here, not left to the eye** — that is the anti-drift rule.

| Check | Severity | What it catches |
|---|---|---|
| `pe.keyParity` | **fail** | sections don't mirror Beginner exactly — same keys **and same order** (structure drift) |
| `pe.sectionEmpty` | **fail** | a section is empty |
| `pe.markdown` | **fail** | `[[ ]]`, `**`, `#`, list markers, backticks (format drift) |
| `pe.punctuation` | **fail** | em dash or semicolon present |
| `pe.readability` | **fail** | FK grade > **8.0** (clearly above B1) |
| `pe.sentenceMax` | **fail** | a sentence longer than **28 words** |
| `pe.numberFidelity` | **fail** | a digit-number not present in the Beginner source (fact drift) |
| `pe.readabilityWatch` | warn | FK grade > **7.0** (B1 target ceiling) |
| `pe.sentenceMean` | warn | mean sentence length > **16 words** |
| `pe.properNounFidelity` | warn | a name not present in the Beginner source (verify) |
| `pe.style` | warn | a banned idiom matched (data-driven list) |
| `pe.styleWatch` | warn | a watchlist idiom matched |
| `pe.lengthBand` | warn | total B1 length outside **60–125%** of Beginner |
| `pe.matterCap` | warn | more than **2** evaluative "matters/mattered" in the block (register crutch; substance noun exempt) |

The `fail` checks block commit via the pre-commit hook. Thresholds are **locked after the
pilot** — change them in `style.json`, never in the prompt.

## 7. What the validator cannot enforce (the review agent's job)

A separate **adversarial review agent** receives the Beginner source, the B1 output, and
this spec. Its job is to **triage**, not to flag every difference — a flood of false
positives is as useless as missing real drift. Compare against the Beginner source and:

- **FAIL** on genuine fact drift only: a fact, name, number, date, event, or claim added,
  dropped, or changed; a **quantifier, title, or loaded/characterizing word** altered (per
  §2's preserve-precisely list, e.g. "a few"→"several", "emperor"→"ruler", "mobs"→"groups");
  or a sentence that is genuinely B2+ (subordinate clauses, rare words, idioms, em dash,
  semicolon) despite passing FK.
- **DO NOT fail** on a plain-words **gloss** of a term already in the source (that is
  *required* — §3), nor on a **neutral synonym** that does not change meaning, scale, or
  connotation ("from scratch"→"from nothing", "piles"→"numbers"), nor on a plain
  **emphasis/intensity adverb** simplified to a plainer one ("remarkably"→"very",
  "enormous"→"very big", "legendary"→"great") — these carry no fact.

A `pass` must mean the layer is **fact-faithful and B1**, not that it is word-identical to
Beginner. A fail routes the entry back for regeneration (max N), then to a human queue.

## 8. Pipeline order (per entry)

`read Beginner → generate B1 (this spec + exemplar) → validator gates → adversarial review
→ insert content.plainEnglish → re-validate`.

Pinned: same model, same locked spec, low temperature, **one entry per agent** (small
context = less drift), idempotent insertion.

**Insertion must normalize newlines.** Structured-output agents emit paragraph breaks
inconsistently — some return real newlines, some return the literal two-character escape
`\n`. The insertion step replaces any literal `\n` with a real newline before writing, or
the layer renders the escape as visible text. (Pilot 1: 3 of 5 agents emitted literal `\n`.)

## 9. Rollout

The pilot (rounds 1–4, 41 entries) is done and the spec is locked. Validated cadence:

1. **Batches of ~15, balanced composition.** Mix concrete/narrative entries (which
   auto-pass ~60%) with abstract/conceptual ones (which drift more, ~20–30%) so each batch
   averages ~50% auto-insert and a ~6–8 entry hand-repair tail — tractable in one pass.
   *Do not* run a batch of 20 that skews abstract: it produces ~16 hand-repairs.
2. **Per batch:** run the Sonnet workflow (gen + triage review) → `node pe_process.cjs
   <output>` auto-inserts every clean double-pass (validator 0 fails **and** reviewer
   `pass:true` **and** no fact flags) → **hand-repair only the flagged tail**, then insert.
3. **Hand-repair the tail; do not re-run it.** Re-running a flagged tail costs ~1M tokens
   and hits diminishing returns on the stubborn core (dropped qualifiers, FK on dense
   topics). Re-run *only* when you have changed the spec and want to re-validate the change.
4. **Track progress in `plain-english-progress.md`** (the running ledger of done entry IDs,
   per-round metrics, and what's left).
5. Layer stays hidden the entire time. Flip `PLAIN_ENGLISH_ENABLED = true` only when the
   full set is generated, validated, and reviewed.

Recurring drift to watch (from the pilot): dropped qualifiers ("Pacific coast"→"coast",
"A single idea from"); characterization swaps ("found guilty"→"said guilty",
"argued"→"said"); factually wrong glosses ("condense"→"squeeze"); fact-adding glosses
(invented Latin names, definitions); and FK creep on abstract topics.

Scope v1: **content layers only**. The hook and summary stay original-register (a B1 hook/
summary is an optional phase 2). All 1,000 entries are eligible — every entry has a Beginner
layer to transform from.
