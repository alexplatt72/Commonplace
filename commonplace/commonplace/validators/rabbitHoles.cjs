'use strict';
// Rabbit-hole integrity beyond the core check (which already fails published-broken links).
// Adds: blank entryId is a hard fail (not just a warning); duplicate entryId within one entry.
// Planned links that point to a not-yet-built entry are allowed (status must be "planned").

module.exports = function rabbitHoles(entry, ctx) {
  const out = [];
  const rhs = entry.rabbitHole || [];
  const seen = new Map();
  for (const [i, rh] of rhs.entries()) {
    if (rh.relationship === 'Gateway') continue; // legacy, no target required
    const tgt = (rh.entryId == null ? '' : String(rh.entryId)).trim();
    if (!tgt) {
      out.push({ id: 'rabbit.blankEntryId', message: `rabbitHole[${i}] "${rh.label || '?'}" has a blank/missing entryId — every link needs a target (use status:planned for a not-yet-built entry, and give it the intended entryId).` });
      continue;
    }
    if (seen.has(tgt))
      out.push({ id: 'rabbit.dupEntryId', message: `rabbitHole[${i}] points to "${tgt}" which is already linked at rabbitHole[${seen.get(tgt)}] — duplicate rabbit-hole within one entry.` });
    else seen.set(tgt, i);
  }
  return out;
};
