# Entry Frame — Field Roles Specification

Status: **draft, not yet enforced.** This is the contract for what the three "frame"
fields — `summary`, `hook`, and the opening of each reading layer — are *for*. It exists
because those three drifted, across much of the 1,000-entry corpus, into the same thing:
a compressed, vivid mini-essay. Nothing in the validator enforced their *roles*, so they
collapsed into each other and the reader meets the same paragraph two or three times.

This document is the **single source of truth** for the frame. It is given to every
generation and review agent **verbatim**, and it defines the checks the validator will
enforce (§6). Do not paraphrase it per-run.

---

## 1. What the reader sees, in order

On every entry the reader meets four things, top to bottom, before the article proper:

```
TITLE
SUMMARY            ← bordered block under the title  (entry.summary)
HOOK               ← under the summary, above the level tabs  (entry.hook)  — shows on ALL layers
[OPENING PARAGRAPH]← first paragraph of the reading layer they're in  (content.<layer>, first section)
```

These are read **in sequence, in seconds**. If two of them say the same thing, the reader
feels they have not started yet. The whole problem this spec fixes is: **the frame must
advance, not repeat.**

`entry.summary` is also the **card subtitle, the search text, and the `<meta>` /
`og:description`** (App.jsx lines ~2187, ~2418, ~1831). Editing a summary changes SEO and
listing surfaces — so summary edits carry more weight than hook edits.

---

## 2. The three roles

Each field does **one** job. The one-line test for each is the fastest way to check it.

### 2.1 `summary` — the DEFINITION
**Job:** orient. Tell a first-time reader *what this is* and why it matters.
**Test:** it can complete the sentence **"___ is…"**.
- **MUST** lead with the category / what the thing *is* (a person, event, work, idea, place, period) and its significance.
- **MUST** stand alone as the card subtitle and meta description.
- **MUST NOT** open with an argument, a thesis, or a scene.
- **MUST NOT** be a fact-list (dates, sub-events, secondary figures) — that is article body, not a definition.
- **Length:** 1–3 sentences. Plain, declarative.

### 2.2 `hook` — the PULL
**Job:** make the reader *want to continue*. One tension, surprise, paradox, scene, or question — then stop.
**Test:** it opens **one** idea and creates a pull; it is not a second summary.
- **MUST** do exactly one of: a tension, a surprise, a paradox, a scene, or a framing question.
- **MUST NOT** restate the summary.
- **MUST NOT** restate the opening paragraph of the layer it precedes (see §3).
- **MUST NOT** end on a thesis-*tell* ("this is a story about… that refuses simple interpretation") — show the pull, don't announce it.
- **Length is NOT a rule.** A long hook stays if it earns the length with tension, surprise, or interpretive framing *and* duplicates neither the summary nor the opening. A short hook that only states a thesis is worse than a long one that pulls. Never force a 2–3 sentence limit.

### 2.3 Reading-layer opening — the START OF THE READ
**Job:** begin the article in the reader's chosen register.
**Test:** it enters the topic in its own way, not by re-running the hook's line or the summary's sentence.
- **MUST NOT** re-use the hook's device (the same scene, the same reversal, the same first fact).
- **MUST NOT** restate the summary's definition sentence.
- Applies to **every** layer's first paragraph (`plainEnglish`, `beginner`/Starter, `general`/Standard, …), because the hook sits above all of them. The default layer (`general`) is the primary check.

---

## 3. The core rule: the frame must not echo itself

> **No two of {summary, hook, layer-opening} may substantially restate each other.**

"Substantially restate" = the same fact stated as the lead, the same scene, the same
reversal, or heavy shared distinctive vocabulary. It is broader than word-for-word overlap —
paraphrase counts.

When two fields collide, fix the one that is doing the *wrong* job, not the better-written one:

| Collision | Which field is wrong | Fix |
|---|---|---|
| hook restates **summary**, and the hook is a mini-essay | the **hook** | trim it to its pull, or rewrite |
| hook restates **summary**, and the *summary* is the clone of a strong hook | the **summary** | rewrite the summary as a plain definition |
| hook restates the **layer opening** (same scene/device) | usually the **hook** | reframe the hook to a different angle; let the layer keep the scene |
| **summary** argues or fact-lists instead of defining | the **summary** | rewrite as "___ is…" |

---

## 4. Worked examples (from the corpus)

**Good hooks — proof that length is not the defect:**
- *leonardo* (25w): "…the last person who could know everything — and the first who understood that knowing everything was the same activity." — one idea, one turn, stop.
- *rousseau* (66w): ends "…And he abandoned all five of his own children to an orphanage." — long, but the twist earns it.

**Fixed this session (batch 1):**
- *earthquakes* hook was the summary re-typed (buildings-kill / Haiti / can't-predict). Trimmed to the visceral opening; the thesis now lives only in the summary.
- *charlemagne* hook had an expository middle + a France/Germany/EU tail that recurs at the entry's end. Rewritten to the church-vs-crown pull.
- *englishCivilWar* hook re-ran the General opening's scaffold scene. Reframed to the *precedent* angle so the General layer keeps the scene.

**Summaries that fail §2.1 (still open):**
- *earthquakes* summary opens "Earthquakes don't kill people — buildings do." — a **thesis**, not a definition; never says what an earthquake is.
- *haudenosauneeConfederacy* summary is a **fact-list** (Peacemaker/Hiawatha, Tuscarora 1722, 1988 Congress) and defines the Great Law, not the Confederacy (the title).

**Layer-opening duplication (still open):**
- *hanDynasty* / *songDynasty*: the General opening re-runs the hook's exact device, so the reader sees it twice.

---

## 5. Roles vs. reading level (do not confuse the two axes)

This spec governs **roles** (what each field is *for*). It is orthogonal to the **reading-level**
system (Easy/Starter/Standard/… — a language-and-depth axis; see `PLAIN_ENGLISH_SPEC.md`).
A summary is a definition whether the reader is on Easy or Scholarly; a hook pulls on every
layer. Fixing roles does not change any layer's grade level.

---

## 6. Enforcement (planned validator gate)

Advisory first (like `factcheck_gate.cjs`), then `warn`. Three checks:

1. **Frame redundancy (deterministic).** Score `max(overlap(hook, summary), overlap(hook, general-opening))` — the ranker in `hook_prioritize.cjs`. **Threshold is deliberately unset here.** Run the ranker over all 1,000 first, read the distribution, then pick the warn cutoff so it flags the genuine restatements without drowning in false positives — and record the chosen number in this section once set. High precision; a *floor*, since it misses paraphrase.
2. **Summary-is-a-definition (heuristic + LLM).** Flag summaries that open with a thesis, a scene, or a bare fact-list rather than a definition.
3. **Frame audit (LLM).** `hook_audit.cjs` (Opus 4.8, advisory) classifies each field and proposes the fix, catching the paraphrase cases the deterministic score misses.

Remediation order once the gate exists: **triage worst-first → trim before rewrite → keep the better-written twin and fix the other field.** Batches 1–2 of the hook pass are the pilot (`hook-audit-batch1.md`, `hook-audit-batch2.md`).

## 7. Generation (make it born correct)

New entries must satisfy §2–§3 at authoring time. This file goes to every generation and
review agent verbatim; the review step checks each of the three fields against its one-line
test and against the §3 no-echo rule before an entry can pass. This is the half of the fix
that makes the roles *hold* instead of drifting again with each new batch.
