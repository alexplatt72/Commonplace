'use strict';
// Popular Culture scorecard-prose detector. Driven entirely by rules/style.json so the
// banned/watch lists are data, not code. Scoped to popularCulture descriptions, which must
// be lively interpretive prose — not a "gets X right / what it leaves out" grading worksheet.

function compile(patterns) {
  return (patterns || []).map(p => ({ re: new RegExp(p.re, p.flags || 'gi'), label: p.label }));
}

module.exports = function popularCultureStyle(entry, ctx) {
  const out = [];
  const pc = entry.popularCulture || [];
  if (!pc.length) return out;

  const banned = compile(ctx.rules.popularCultureScorecard && ctx.rules.popularCultureScorecard.patterns);
  const watch = compile(ctx.rules.popularCultureWatch && ctx.rules.popularCultureWatch.patterns);

  for (const [i, item] of pc.entries()) {
    const text = (item.description || '');
    if (!text) continue;
    for (const { re, label } of banned) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) { out.push({ id: 'pc.scorecard', message: `popularCulture[${i}] "${item.title || '?'}" uses scorecard prose [${label}]: "…${m[0].trim()}…". Rewrite: name what the work emphasizes, then the distortion directly — no right/wrong checklist.` }); break; }
    }
    for (const { re, label } of watch) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) { out.push({ id: 'pc.watch', message: `popularCulture[${i}] "${item.title || '?'}" — watch phrase [${label}]: "…${m[0].trim()}…" (scorecard mutation).` }); break; }
    }
  }
  return out;
};
