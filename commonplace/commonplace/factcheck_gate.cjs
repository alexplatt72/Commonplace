#!/usr/bin/env node
'use strict';
// factcheck_gate.cjs — LLM fact-check gate for entries (the ~85% the deterministic
// validators can't catch: externally-wrong-but-internally-consistent facts).
//
//   node factcheck_gate.cjs                 fact-check everything in _quarantine/
//   node factcheck_gate.cjs <id> <id> ...   fact-check named entries in _quarantine/
//   node factcheck_gate.cjs --dir public/entries <id>   fact-check a live entry
//
// Requires:  npm i @anthropic-ai/sdk   and   ANTHROPIC_API_KEY set (or `ant auth login`).
//
// It hands each entry's prose to Claude (Opus 4.8) WITH the web_search tool, asks it to
// verify every checkable claim (dates, names, attributions, statistics, quotes) against
// live sources, and writes a findings file in the SAME shape as the manual fact-check pass:
//   ENTRY / FIELD / CLAIM / PROBLEM / CORRECTION / CONFIDENCE.
//
// ADVISORY, like the deterministic warn-checks: findings are for HUMAN review, never
// auto-applied. Run it on _quarantine/ entries BEFORE `promote_entries.cjs`. Nothing here
// edits an entry or touches production.

const fs = require('fs'), path = require('path');
const SDK = require('@anthropic-ai/sdk');
const Anthropic = SDK.default || SDK;

const MODEL = 'claude-opus-4-8';
const NON = new Set(['manifest.json','searchIndex.json','calendar.json','collections.json','pathways.json']);

// ---- collect the prose of an entry as labeled (path -> text) leaves ----
function labeledTexts(entry){
  const out=[];
  (function walk(v, p){
    if(typeof v==='string'){ if(v.trim().length>40) out.push({path:p, text:v}); }
    else if(Array.isArray(v)) v.forEach((x,i)=>walk(x, `${p}[${i}]`));
    else if(v&&typeof v==='object') for(const k of Object.keys(v)) walk(v[k], p?`${p}.${k}`:k);
  })({content:entry.content, hook:entry.hook, summary:entry.summary,
      comparativeNarrative:entry.comparativeNarrative, research:entry.research,
      popularCulture:entry.popularCulture, rabbitHole:entry.rabbitHole,
      reference:entry.reference, commerce:entry.commerce}, '');
  return out;
}

const SYSTEM = `You are a rigorous historical fact-checker for a curated encyclopedia. You will be given the prose of ONE entry, split into labeled fields. Find every factual error.

METHOD — this is non-negotiable:
- For every checkable claim (a specific date, year, name, title, attribution, statistic, quantity, or quotation), VERIFY it with the web_search tool against an authoritative source. Do not rely on memory — memory is exactly what produces errors here.
- Watch specifically for: wrong dates/years, misattributed people or works, wrong or fabricated titles/acronyms, arithmetic that doesn't add up (spans, ages, sums), and INTERNAL CONTRADICTIONS where one field disagrees with another field of the same entry.
- Recency guard: if a claim references a recent event, SEARCH before assuming it is wrong — your training may predate it. A real recent event is not an error.
- Only report a correction you can support with a source. If you are unsure, mark it low confidence and say what you could not verify. Never invent a correction.

OUTPUT — return ONLY a fenced \`\`\`json block containing an array. Each item:
  {"field": "<the field label>", "claim": "<the exact claim>", "problem": "<what's wrong>", "correction": "<the verified fact + source>", "confidence": "high|medium|low"}
If the entry has no factual errors, return \`\`\`json\n[]\n\`\`\`. No prose outside the JSON block.`;

async function factCheckEntry(client, id, entry){
  const fields = labeledTexts(entry).map(f=>`### ${f.path}\n${f.text}`).join('\n\n');
  const user = `Entry id: ${id}\nTitle: ${entry.title||id}\nPeriod: ${entry.period||'n/a'}\n\nFIELDS:\n\n${fields}`;
  let messages = [{ role:'user', content:user }];
  let resp;
  for(let guard=0; guard<12; guard++){
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type:'adaptive' },
      tools: [{ type:'web_search_20260209', name:'web_search' }],
      system: SYSTEM,
      messages,
    });
    if(resp.stop_reason !== 'pause_turn') break;   // server tool hit its iteration cap — continue
    messages.push({ role:'assistant', content: resp.content });
  }
  const text = resp.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  if(!m){ return { findings:[], raw:text, parseError:true }; }
  try { return { findings: JSON.parse(m[1]), raw:text }; }
  catch(e){ return { findings:[], raw:text, parseError:true }; }
}

async function main(){
  const args = process.argv.slice(2);
  let dir = '_quarantine';
  const di = args.indexOf('--dir'); if(di!==-1){ dir = args[di+1]; args.splice(di,2); }
  if(!fs.existsSync(dir)){ console.error(`No ${dir}/ folder.`); process.exit(1); }
  const present = fs.readdirSync(dir).filter(f=>f.endsWith('.json') && !NON.has(f)).map(f=>f.replace('.json',''));
  const ids = args.filter(a=>!a.startsWith('--'));
  const targets = ids.length ? ids : present;
  if(!targets.length){ console.log(`Nothing to fact-check in ${dir}/.`); process.exit(0); }

  let client;
  try { client = new Anthropic(); } // reads ANTHROPIC_API_KEY / ant profile
  catch(e){ console.error('Could not construct Anthropic client:', e.message); process.exit(1); }

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const outFile = `factcheck-findings-${stamp}.txt`;
  const lines = [`FACT-CHECK GATE — ${dir} — ${new Date().toISOString()}`, `model: ${MODEL} + web_search`, ''];
  let total=0, high=0;

  for(const id of targets){
    const fp = path.join(dir, `${id}.json`);
    if(!fs.existsSync(fp)){ console.error(`  skip ${id}: not found in ${dir}/`); continue; }
    process.stdout.write(`  checking ${id} ... `);
    let entry; try { entry = JSON.parse(fs.readFileSync(fp,'utf8')); } catch { console.log('parse fail'); continue; }
    let res;
    try { res = await factCheckEntry(client, id, entry); }
    catch(e){ console.log('API error: '+e.message); lines.push(`ENTRY: ${id}\n  (API error: ${e.message})\n`); continue; }
    const f = res.findings || [];
    total += f.length; high += f.filter(x=>x.confidence==='high').length;
    console.log(f.length ? `${f.length} finding(s)` : (res.parseError?'unparsed output':'clean'));
    if(res.parseError){ lines.push(`ENTRY: ${id}\n  (could not parse model output)\n  RAW: ${(res.raw||'').slice(0,400)}\n`); continue; }
    for(const x of f){
      lines.push(`ENTRY: ${id}`, `FIELD: ${x.field||'?'}`, `CLAIM: ${x.claim||''}`,
                 `PROBLEM: ${x.problem||''}`, `CORRECTION: ${x.correction||''}`, `CONFIDENCE: ${x.confidence||'?'}`, '');
    }
  }
  lines.push('', `SUMMARY: ${total} finding(s) across ${targets.length} entr${targets.length===1?'y':'ies'} (${high} high-confidence).`);
  fs.writeFileSync(outFile, lines.join('\n'));
  console.log(`\n${total} finding(s) (${high} high). Written to ${outFile}`);
  console.log('Advisory only — review, apply fixes by hand, then run promote_entries.cjs.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
