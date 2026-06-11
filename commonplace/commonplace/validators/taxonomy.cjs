'use strict';
// Taxonomy integrity: popularCulture.type and themes must resolve to a canonical value
// (directly or via an alias map). Registries live in taxonomy/*.json so the approved
// vocabulary is data, not code. Until the enums are approved these run at warn severity.

function resolve(value, reg) {
  if (!reg) return { ok: true };
  const v = (value == null ? '' : String(value)).trim();
  if (!v) return { ok: false, reason: 'empty' };
  if (reg.canonicalSet.has(v)) return { ok: true };
  const aliased = reg.aliases[v] || reg.aliases[v.toLowerCase()];
  if (aliased) return { ok: true, alias: aliased };
  return { ok: false, reason: 'unknown' };
}

module.exports = function taxonomy(entry, ctx) {
  const out = [];
  const pcReg = ctx.taxonomy && ctx.taxonomy.pcTypes;
  const thReg = ctx.taxonomy && ctx.taxonomy.themes;

  for (const [i, item] of (entry.popularCulture || []).entries()) {
    const r = resolve(item.type, pcReg);
    if (!r.ok) out.push({ id: 'taxonomy.pcType', message: `popularCulture[${i}] "${item.title || '?'}" type "${item.type}" is not an approved type — map it to the canonical enum (taxonomy/popular_culture_types.json).` });
  }
  for (const t of (entry.themes || [])) {
    const r = resolve(t, thReg);
    if (!r.ok) out.push({ id: 'taxonomy.theme', message: `theme "${t}" is not a canonical theme id — add it to taxonomy/themes.json or use an existing id.` });
  }
  return out;
};
