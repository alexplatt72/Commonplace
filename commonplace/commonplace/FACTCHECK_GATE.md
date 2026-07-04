# Fact-checking: the two-layer defense

The 2026-07 corpus fact-check surfaced ~215 real errors. Analyzing them showed **no single tool catches them all** — they split into two populations that need two different mechanisms.

## Layer 1 — deterministic validators (catches ~10–15%)

`validators/factConsistency.cjs`, wired into `validate_entries.cjs` at `warn`. Five narrow, high-precision checks for the *mechanically verifiable* classes:

| check | catches |
|---|---|
| `arith.dateSpan` | "YEAR … YEAR … N years/centuries later" where the math is wrong |
| `arith.age` | a stated age that doesn't match the subject's birth year (from `period`) |
| `consistency.subjectYears` | `period` birth/death year vs a body "born/died YYYY" |
| `consistency.acronym` | "Expanded Name (ACR)" where ACR isn't the name's initials |
| `consistency.nameForms` | one surname with two near-identical first names (spelling typo) |

These are ~free and run on every commit. **Broad numeric-divergence detection was prototyped and rejected** — history sections legitimately hold clusters of nearby real dates (1863 Gettysburg vs 1864 Atlanta), so a blind "two close numbers = contradiction" check floods with false positives (measured: 46 and 1,256 flags). Only the tight checks above clear an acceptable precision bar. They can't see the other ~85%.

## Layer 2 — LLM fact-check gate (catches the rest)

`factcheck_gate.cjs`. The bulk of the errors were **externally wrong but internally consistent** — "leaded gas banned 1986", "Timation was a NASA program", "Kabir died in Varanasi", a fabricated book title. No structural check can see these; they need an outside source. The gate hands each entry's prose to **Claude Opus 4.8 with the `web_search` tool** and asks it to verify every checkable claim, returning findings in the same `ENTRY / FIELD / CLAIM / PROBLEM / CORRECTION / CONFIDENCE` shape the manual pass used.

```
npm i @anthropic-ai/sdk          # one-time; ANTHROPIC_API_KEY or `ant auth login`
node factcheck_gate.cjs          # fact-check everything in _quarantine/
node factcheck_gate.cjs <id> …   # fact-check named quarantine entries
node factcheck_gate.cjs --dir public/entries <id>   # re-check a live entry
```

It writes `factcheck-findings-<timestamp>.txt` and **changes nothing** — findings are advisory, reviewed and applied by hand (the same discipline that caught the two *fact-check-was-wrong* cases: greatZimbabwe's real April-2026 repatriation, and Java being ~the same size as England).

- **Cost/latency:** one web-search-enabled Opus call per entry, minutes each — a pre-publish gate, not a per-commit hook. Run it in batches over a session's new entries.
- **Not perfect:** an LLM fact-checker has its own false-positive/negative rate. Treat it as a strong reviewer whose findings a human verifies — exactly how the manual `.txt` was used.

## Where it sits in the pipeline

New entries stage in `_quarantine/` (see `_quarantine/README.md`). Before promotion:

```
author entry → _quarantine/<id>.json (status: draft)
   → node validate_entries.cjs _quarantine --manifest public/entries/manifest.json   (Layer 1, blocks)
   → node factcheck_gate.cjs <id>                                                     (Layer 2, advisory)
   → review findings, fix by hand
   → node promote_entries.cjs <id>        (explicit — the only path to production)
```

Layer 1 blocks on hard fails; Layer 2 is a human-reviewed reviewer; promotion is always explicit.
