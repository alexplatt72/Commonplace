'use strict';
// Comparative Memory: the section needs a top-level intro (comparativeSummary) before the
// Explore button opens into the comparison cards, and individual cards shouldn't run too long.

module.exports = function comparativeMemory(entry, ctx) {
  const out = [];
  const cn = entry.comparativeNarrative || [];
  if (!Array.isArray(cn) || cn.length === 0) return out;

  const intro = (entry.comparativeSummary || '').trim();
  if (!intro) {
    out.push({ id: 'cm.summaryRequired', message: `comparativeNarrative has ${cn.length} comparisons but comparativeSummary (the intro before Explore) is empty — add a 40–110 word lead-in framing the major memory traditions (don't just restate the first card).` });
  } else {
    const w = ctx.wordCount(intro);
    if (w < 30) out.push({ id: 'cm.summaryRequired', message: `comparativeSummary is only ${w} words — aim for 40–110 words that frame the interpretive traditions.` });
  }

  for (const [i, c] of cn.entries()) {
    const w = ctx.wordCount(c.content || '');
    if (w > 170) out.push({ id: 'cm.cardLength', message: `comparativeNarrative[${i}] "${c.perspective || c.name || '?'}" is ${w} words — over 170; tighten, the section sits behind an Explore button.` });
    else if (w > 130) out.push({ id: 'cm.cardLength', message: `comparativeNarrative[${i}] "${c.perspective || c.name || '?'}" is ${w} words — over 130; consider tightening.` });
  }
  return out;
};
