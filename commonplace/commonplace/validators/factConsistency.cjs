'use strict';
// Deterministic fact-consistency checks (added 2026-07 after the corpus fact-check pass).
//
// These are HIGH-PRECISION, NARROW checks. They catch only the mechanically-verifiable
// error classes — co-located date arithmetic, age vs birth year, header/body year clashes,
// acronym-vs-expansion, and conflicting name forms. They do NOT (and cannot) catch
// externally-wrong-but-internally-consistent facts (e.g. "leaded gas banned 1986",
// "Timation was a NASA program") — that requires the LLM fact-check gate. All run at `warn`.
//
// Design note: broad numeric-divergence detection was prototyped and REJECTED — history
// sections legitimately hold clusters of nearby real dates (1863 Gettysburg vs 1864
// Atlanta), so a blind "two close numbers = contradiction" check floods with false
// positives (46 and 1256 flags in two prototypes). Only the tightly-scoped checks below
// clear an acceptable precision bar.

const STOP_ACR = new Set(['of','the','on','and','for','in','to','a','an','de','la','le','du','des']);
const NUMWORD = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,
  nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};

function wordsToNum(s){ // "six hundred" -> 600 ; "forty-six" -> 46 ; "seventeen" -> 17
  const parts = String(s).toLowerCase().replace(/-/g,' ').split(/\s+/).filter(Boolean);
  let cur=0, any=false;
  for(const w of parts){
    if(w==='hundred'){ cur=(cur||1)*100; any=true; }
    else if(NUMWORD[w]!=null){ cur+=NUMWORD[w]; any=true; }
    else return null;
  }
  return any ? cur : null;
}

function allTexts(entry){
  const s=[];
  (function walk(v){ if(typeof v==='string')s.push(v);
    else if(Array.isArray(v))v.forEach(walk);
    else if(v&&typeof v==='object')Object.values(v).forEach(walk); })(entry.content);
  ['hook','summary'].forEach(k=>{ if(typeof entry[k]==='string')s.push(entry[k]); });
  (entry.comparativeNarrative||[]).forEach(x=>s.push((x&&x.content)||''));
  (entry.research||[]).forEach(x=>s.push((x&&x.content)||''));
  (entry.popularCulture||[]).forEach(x=>s.push((x&&x.description)||''));
  (entry.rabbitHole||[]).forEach(x=>s.push((x&&x.reason)||''));
  (entry.reference||[]).forEach(x=>s.push((x&&x.annotation)||''));
  (entry.commerce||[]).forEach(x=>s.push((x&&x.note)||''));
  return s.filter(Boolean);
}

function yearsWithEra(sent){ // each year token counted once, BCE negative
  const out=[]; const re=/\b(\d{3,4})\s*(BCE|BC|CE|AD)?\b/g; let m;
  while((m=re.exec(sent))){ let y=+m[1]; if(m[2]&&/^B/.test(m[2])) y=-y; out.push(y); }
  return out;
}
function periodYears(period){ const ys=[]; if(typeof period!=='string')return ys;
  const re=/(\d{3,4})/g; let m; while((m=re.exec(period))) ys.push(+m[1]); return ys; }

module.exports = function factConsistency(entry, ctx){
  const out=[];
  const texts = allTexts(entry);
  const splitSent = (ctx && ctx.splitSentences) || (t => t.split(/(?<=[.!?])\s+/));
  const isPerson = entry.template === 'People';
  const pys = periodYears(entry.period);

  // A. arith.dateSpan — two explicit years + an explicit interval, in ONE sentence.
  for(const t of texts) for(const sent of splitSent(t)){
    const iv = sent.match(/\b((?:[a-z]+[- ])*[a-z]+|\d+)\s+(years|centuries)\s+(?:later|after|earlier|before)\b/i);
    if(!iv) continue;
    let span = /^\d+$/.test(iv[1]) ? +iv[1] : wordsToNum(iv[1]);
    if(span==null || span<5) continue;
    const isC = /centur/i.test(iv[2]);
    // remove the interval phrase itself so its own number ("550 years after") isn't read as a year
    const ys = [...new Set(yearsWithEra(sent.replace(iv[0],'  ')))].filter(y=>Math.abs(y)>=100);
    if(ys.length<2) continue;
    let best=Infinity;
    for(let i=0;i<ys.length;i++) for(let j=i+1;j<ys.length;j++)
      best=Math.min(best, Math.abs(Math.abs(ys[i]-ys[j]) - (isC?span*100:span)));
    const tol = isC ? 60 : 3;
    if(best>tol && best<3000)
      out.push({id:'arith.dateSpan', message:`Date arithmetic: "${iv[0].trim()}" but the years in that sentence (${ys.join(', ')}) are ~${best} years off from the stated interval.`});
  }

  // B. arith.age — birth year (from period) vs a stated age at a dated event. Flags gross (>=2yr) errors.
  if(isPerson && pys.length){
    const birth = pys[0];
    for(const t of texts) for(const sent of splitSent(t)){
      let age=null, mm;
      if((mm=sent.match(/\b(\d{1,3})[-\s]year[s]?[-\s]old\b/i))) age=+mm[1];
      else if((mm=sent.match(/\baged\s+(\d{1,3})\b/i))) age=+mm[1];
      else if((mm=sent.match(/\b((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?)[-\s]year[-\s]old\b/i))) age=wordsToNum(mm[1]);
      else if((mm=sent.match(/\b(?:was|turned)\s+((?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?)\b/i)) && /\byear|\bold\b|when|birthday/i.test(sent)) age=wordsToNum(mm[1]);
      if(age==null || age<1 || age>120) continue;
      const ys = yearsWithEra(sent).filter(y=>y>birth-1 && y<birth+130);
      for(const ey of ys){ const expect = ey - birth;
        if(Math.abs(expect-age)>=2){ out.push({id:'arith.age', message:`Age check: text says age ${age} at ${ey}, but ${ey} minus birth year ${birth} = ${expect} (off by ${Math.abs(expect-age)}). Verify the age.`}); break; } }
    }
  }

  // C. consistency.subjectYears — the entry's own period vs a body "born/died YYYY".
  if(isPerson && pys.length){
    const pb = pys[0];
    for(const t of texts){ let m; const re=/\bborn (?:in |around |about |c\.\s*)?(\d{3,4})\b/gi;
      while((m=re.exec(t))){ const y=+m[1]; const d=Math.abs(y-pb);
        if(d>=1 && d<=5){ out.push({id:'consistency.subjectYears', message:`Birth-year clash: body says "born ${y}" but the entry's period field gives ${pb}.`}); break; } } }
  }

  // D. consistency.acronym — "Expanded Name (ACR)" where ACR is not the initials of the name.
  {
    const joined = texts.join('  '); const seen=new Set();
    const re=/([A-Z][A-Za-z.'’-]+(?:\s+[A-Za-z.'’-]+){1,7})\s*\(([A-Z]{2,6})\)/g; let m;
    while((m=re.exec(joined))){
      const name=m[1], acr=m[2];
      const sig = name.split(/\s+/).filter(w=>/^[A-Z]/.test(w) && !STOP_ACR.has(w.toLowerCase()));
      if(sig.length !== acr.length) continue; // only when it's clearly meant as an initialism of these words
      const initials = sig.map(w=>w[0].toUpperCase()).join('');
      let diff=0; for(let i=0;i<acr.length;i++) if(acr[i]!==initials[i]) diff++;
      if(diff>=1){ const key=name+'|'+acr; if(seen.has(key))continue; seen.add(key);
        out.push({id:'consistency.acronym', message:`Acronym check: "${name} (${acr})" — the initials of that name spell "${initials}", not "${acr}".`}); }
    }
  }

  // E. consistency.nameForms — same surname, two NEAR-IDENTICAL first names (spelling-variant of one
  //    person, e.g. "Francesco Berdan" vs "Frances Berdan"). Deliberately narrow: only edit-distance
  //    1-2 pairs on real-looking names. It does NOT try to catch dissimilar first-name swaps
  //    (John vs Pierre) — that needs world knowledge, not string distance.
  {
    // common capitalized non-names to exclude (sentence-openers, directions, ordinals, adjectives)
    const NOT_NAME = new Set(('the this these those a an and but or when where while what who whom whose which that ' +
      'both does did do now then here there over under above below new old first second third fourth fifth sixth ' +
      'north south east west northern southern eastern western central modern ancient early late early reading ' +
      'american british french german chinese indian roman greek islamic christian catholic western eastern ' +
      'his her their its our your my before after during since until because although however').split(/\s+/));
    const lev=(a,b)=>{ a=a.toLowerCase(); b=b.toLowerCase();
      const dp=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=0;j<=b.length;j++)dp[0][j]=j;
      for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)dp[i][j]=Math.min(dp[i-1][j]+1,(dp[i][j-1]||j)+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      return dp[a.length][b.length]; };
    const joined = texts.join('  '); const by={};
    const re=/\b([A-Z][a-z]{3,})\s+([A-Z][a-z]{3,})\b/g; let m;
    while((m=re.exec(joined))){ const first=m[1], sur=m[2];
      if(NOT_NAME.has(first.toLowerCase()) || NOT_NAME.has(sur.toLowerCase())) continue;
      (by[sur]=by[sur]||new Set()).add(first); }
    for(const sur in by){ const firsts=[...by[sur]]; if(firsts.length<2) continue;
      for(let i=0;i<firsts.length;i++) for(let j=i+1;j<firsts.length;j++){
        const a=firsts[i], b=firsts[j], d=lev(a,b);
        if(d>=1 && d<=2 && Math.min(a.length,b.length)>=5){
          out.push({id:'consistency.nameForms', message:`Name-form clash: surname "${sur}" appears with two near-identical first names in one entry — "${a}" and "${b}". Likely one person spelled two ways.`});
        }
      }
    }
  }

  return out;
};
