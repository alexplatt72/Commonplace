# The Commonplace

A curated canon of civilizational significance — structured analytical depth across history, ideas, and the world.

Live at: https://thecommonplace.dev

## Adding New Entries

1. Create a new JSON file in `public/entries/` named `entryId.json`
2. Add the entry to `public/entries/manifest.json` (add one object to the array with: id, title, template, subtype, period, summary)
3. Commit and push — Vercel deploys automatically

## Weekly: Question & Answer of the Week

The crimson **wax seal** on the homepage hero (left of "Start exploring") opens a modal
with one question and answer drawn from an entry's Educational layer. It is **data-driven
and archive-ready** — past weeks are never thrown away.

**To rotate it each week:** open `src/App.jsx`, find the `QA_WEEKLY` array (just above the
`WaxSeal` component), and **PREPEND** a new object to the front. The seal always shows
`QA_WEEKLY[0]`; every earlier week stays in the array (ready for a future "past questions"
archive — don't delete them). Then commit and push.

Each week is one object:

```js
{
  week: "2026-06-16",            // ISO date, for ordering / a future archive
  originId: "georgeWashington",  // the entry the question comes from (manifest id)
  originTitle: "George Washington",
  title: "On virtue, custom, and law",   // short modal headline
  question: "…the full question text…",
  answer: [                      // ordered content blocks (rendered top to bottom):
    { p: "A paragraph. **double-asterisks** become bold." },
    { pull: "A one-line pull-quote, set large in the serif display face." },
    { lifecycleLabel: "A constitutional lifecycle",   // optional numbered-step block
      lifecycle: [ ["Bold lead-in.", "Rest of the step."], ["…", "…"] ] },
    { p: "Final paragraph.", top: true },   // top:true adds the divider rule above it
  ],
}
```

That's the whole contract — no other files change. (The sibling weekly feature, the
Featured-Entries almanac, is documented in `Project Tracking/Featured_Calendar_Plan.md`
and built by `_meta_tools/build_calendar.cjs`.)

## Project Structure

```
public/
  entries/
    manifest.json     ← metadata for all entries (used for search/browse)
    entryId.json      ← one file per entry (loaded on demand)
src/
  App.jsx             ← full application
  main.jsx            ← React entry point
index.html
```

## Tech Stack

- React 18 + Vite
- Deployed on Vercel
- Domain: Namecheap → thecommonplace.dev
