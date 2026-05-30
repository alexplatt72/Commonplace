# The Commonplace

A curated canon of civilizational significance — structured analytical depth across history, ideas, and the world.

Live at: https://thecommonplace.dev

## Adding New Entries

1. Create a new JSON file in `public/entries/` named `entryId.json`
2. Add the entry to `public/entries/manifest.json` (add one object to the array with: id, title, template, subtype, period, summary)
3. Commit and push — Vercel deploys automatically

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
