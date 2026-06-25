# Plain English (B1) Layer — Rollout Progress

Running ledger for the B1 "Plain English" accessibility layer. See `PLAIN_ENGLISH_SPEC.md`
for the generation/validation rules; this file tracks **what is done and what is left**.

## Status

- **41 / 1000** entries have a `content.plainEnglish` block.
- **Hidden on the live site** behind `PLAIN_ENGLISH_ENABLED = false` (src/App.jsx).
- Read locally: on localhost, `localStorage.setItem('cp_pe_preview','1')` then reload.
- Corpus validates 1000/1000; published canon and all other layers untouched.

## Key files

| File | Role |
|---|---|
| `PLAIN_ENGLISH_SPEC.md` | Single source of truth for generation (given to agents verbatim). |
| `validators/plainEnglish.cjs` | The gate. Runs only on entries with a `plainEnglish` block. |
| `rules/style.json` → `plainEnglish` | Tunable thresholds + idiom/ban lists. |
| `rules/severity.json` | `pe.*` fail/warn staging. |
| `pe_process.cjs` | Batch processor: auto-inserts clean double-passes, flags the tail. |
| `src/App.jsx` | `PLAIN_ENGLISH_ENABLED` kill-switch + `plainEnglishVisible()` dev preview. |

## Process (validated cadence)

1. Pick ~15 entries, **balanced** concrete + abstract (see spec §9).
2. Run the Sonnet workflow (gen + triage review) → `node pe_process.cjs <output>`.
3. The processor auto-inserts clean double-passes; **hand-repair the flagged tail**, then insert.
4. **Do not re-run the tail** — hand-fix it. Re-run only when the spec changes.
5. Update this file.

## Rounds

| Round | Entries | Auto-insert | Notes |
|---|---|---|---|
| 1 | 5 | ~0% | Initial calibration; established spec + gates. |
| 2 | 5 | 20% | Triage reviewer + real-newline instruction; cut false positives. |
| 3 | 10 | 60% | Added `pe_process.cjs` auto-insert; concrete-leaning set. |
| 4 | 20 | 45% (9 auto / 11 hand) | Abstract-heavy stress test. Refined spec (emphasis adverbs, FK push, no fact-adding glosses). Lesson: balance composition, ~15/batch, hand-repair the tail. |

## Done (41)

**Round 1** (commit 8d97487): aluminum, coldWar, alexandria, aristotle, abrahamLincoln, crusades
**Round 2** (commit 5b4ebf3): bazaar, democracy, corporation, enlightenment, frankenstein
**Round 3** (commit 51dc0d2): photosynthesis, confucius, frenchRevolution, buddhism, mansaMusa, tajMahal, money, greatWallOfChina, haitianRevolution, gunpowder
**Round 4**: writing, capitalism, cleopatra, blackDeath, marx, shakespeare, silkRoad, hamlet, pyramidsOfGiza, plato, industrialRevolution, mongolEmpire, slavery, renaissance, islam, steamEngine, feminism, darwin, nelsonMandela, codeOfHammurabi

## Remaining

**~959 entries.** No blockers — every entry has a Beginner layer to transform from.
Next: balanced ~15-entry batches. To list entries that still need it:
`node -e 'const fs=require("fs");for(const f of fs.readdirSync("public/entries")){if(!f.endsWith(".json"))continue;try{const e=JSON.parse(fs.readFileSync("public/entries/"+f));if(e.content&&!e.content.plainEnglish&&e.content.beginner)process.stdout.write(e.id+" ")}catch{}}'`
