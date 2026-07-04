# _quarantine/ — staging for brand-new entries

**Rule: every brand-new entry is authored here first. Nothing in this folder is
part of the production site, and nothing moves to production except by an
explicit promotion command.**

This folder sits *outside* `public/`, so Vite never serves it, the prerender
never renders it, the manifest never lists it, and the pre-commit hook / build
treat it as invisible. Entries collect here until you decide to publish them.

## Conventions
- New entries land here as `<id>.json` with `"status": "draft"`.
- Validate them anytime against the live production manifest:

  ```
  node validate_entries.cjs _quarantine --manifest public/entries/manifest.json
  ```

  (The `--manifest` flag lets their outbound rabbit-hole links resolve against
  the real corpus while they sit in quarantine.)

## Promotion (the only way into production)
Explicit, per your instruction — never automatic:

```
node promote_entries.cjs --list                 # show what's waiting here
node promote_entries.cjs <id1> <id2> ...         # promote the named entries
node promote_entries.cjs --all                   # promote everything here
```

Promotion validates each entry, flips `draft -> published`, moves it to
`public/entries/`, registers it in the manifest, upgrades any planned links that
now resolve, recomputes `degree`, and re-validates. Afterward, run your normal
searchIndex/sitemap regenerate, then commit and push.
