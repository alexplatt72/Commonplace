#!/usr/bin/env node
'use strict';
// Pre-commit gate: validate ONLY the staged entry files, fast (no slow corpus repetition scan).
// Blocks the commit if any changed entry has a hard FAIL. Run the full corpus + repetition scan
// separately (npm run validate:full) before a push / at batch completion.
const { execSync, spawnSync } = require('child_process');
const path = require('path');

let root;
try { root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim(); }
catch { process.exit(0); }
const app = path.join(root, 'commonplace', 'commonplace');

const NON_ENTRY = /(?:manifest|searchIndex|calendar|collections|pathways)\.json$/;
let staged = '';
try { staged = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' }); }
catch { process.exit(0); }

const ids = staged.split('\n')
  .map(s => s.trim())
  .filter(f => /commonplace\/commonplace\/public\/entries\/[^/]+\.json$/.test(f) && !NON_ENTRY.test(f))
  .map(f => path.basename(f, '.json'));

if (!ids.length) process.exit(0);

console.log(`pre-commit: validating ${ids.length} changed ${ids.length === 1 ? 'entry' : 'entries'}: ${ids.join(', ')}`);
const r = spawnSync('node', [
  path.join(app, 'validate_entries.cjs'),
  path.join(app, 'public', 'entries'),
  '--only', ids.join(','), '--fast'
], { stdio: 'inherit' });

if (r.status !== 0) {
  console.error('\n✗ Commit blocked: a changed entry failed the validator. Fix it (do not bypass with --no-verify).');
  process.exit(1);
}
process.exit(0);
