#!/usr/bin/env node
'use strict';
// hook_audit.cjs — LLM hook auditor for entries.
//
// The problem it exists for: the `hook` field drifted, across much of the corpus,
// from a HOOK (one idea/tension that pulls the reader in) into a STANDFIRST — a full
// opening paragraph that restates the summary and the general-layer's first lines.
// A deterministic scan (hook length + verbatim body overlap) can size that, but it
// cannot tell a strong-long hook (rousseau, 66w) from an expository dump (opera, 195w).
// That judgment is what this gate is for.
//
//   node hook_audit.cjs                        audit every live entry (public/entries)
//   node hook_audit.cjs <id> <id> ...          audit named entries
//   node hook_audit.cjs --dir _quarantine      audit a different folder
//   node hook_audit.cjs --sample 15            audit a spread of N varied entries
//
// Requires:  npm i @anthropic-ai/sdk   and   ANTHROPIC_API_KEY set (or `ant auth login`).
//
// DESIGN PHILOSOPHY (do not skip): the goal is NOT "make every hook short." It is:
// make the reader know where they are and why to continue. Length is not the disease.
// The auditor CLASSIFIES first, and only proposes a change when the hook actually fails
// the reader. It reads the hook AGAINST the summary and the general-layer opening,
// because that is where the real redundancy lives.
//
// ADVISORY, like factcheck_gate.cjs: writes a findings file, changes nothing. A human
// reviews, approves, and edits. Nothing here edits an entry or touches production.

const fs = require('fs'), path = require('path');
const SDK = require('@anthropic-ai/sdk');
const Anthropic = SDK.default || SDK;

const MODEL = 'claude-opus-4-8';
const NON = new Set(['manifest.json','searchIndex.json','calendar.json','collections.json','pathways.json']);

const genText = e => Object.values((e.content && e.content.general) || {}).join(' ');
const firstSentences = (s, n) => (s||'').split(/(?<=[.!?])\s+/).slice(0, n).join(' ');

const SYSTEM = `You are an exacting editorial auditor for a curated encyclopedia. You will be given ONE entry's HOOK, its SUMMARY, and the opening of its GENERAL reading layer. Judge the HOOK only.

WHAT A HOOK IS HERE: the first thing a reader sees after the title and summary. Its job is to make the reader know where they are and why to keep reading — by opening ONE idea, tension, paradox, scene, or question, and then stopping. It is NOT a second summary, and NOT the first paragraph of the article.

DESIGN PHILOSOPHY — this overrides any instinct to shorten:
- Length is NOT the defect. A 60-word hook that lands a real pull is excellent; a 30-word hook that just states a thesis is not. Judge the PULL, not the word count.
- The most common real defect is REDUNDANCY: the hook restates the SUMMARY and/or the GENERAL layer's opening lines. On the page the reader sees title → summary → hook → general-opening in sequence; if three of those say the same thing, the hook has failed even if it reads well in isolation.
- The second most common defect is a BURIED HOOK: a strong 1–3 sentence opening followed by exposition/summary that should simply be cut. The fix is usually a TRIM of the author's own words, not a rewrite.

CLASSIFY the hook as exactly one of:
- "strong"          — opens one idea/tension and stops; keep as is (may be long).
- "opening-paragraph" — reads as a competent article intro, not a hook: informative but no pull; acceptable but not doing the hook's job.
- "expository"      — a thesis/definition dump; explains rather than pulls.
- "redundant"      — substantially restates the summary and/or the general-layer opening.
- "buried"         — contains a strong 1–3 sentence hook, then keeps going into summary/exposition.
(If more than one applies, pick the one that most drives the needed fix; note the others in "notes".)

Then decide:
- "action": "keep" | "trim" | "rewrite"   (trim = cut to the author's own strong opening; rewrite = the opening itself is expository/redundant and needs new words)
- "problemType": "none" | "content" | "presentation"   (presentation = the hook is fine but the layout's title→summary→hook→general stacking is what makes it feel redundant)
- "proposedHook": for trim/rewrite, the tightened hook (2–3 sentences; prefer the author's own words on a trim; never use the words "simpler"/"simplest"); "" for keep.
- "redundancyNote": one line naming what the hook duplicates (summary / general-opening / neither).
- "rationale": one or two sentences.

OUTPUT — return ONLY a fenced \`\`\`json block: an array with ONE object for the entry:
[{"classification":"","action":"","problemType":"","proposedHook":"","redundancyNote":"","rationale":""}]
No prose outside the JSON block.`;

async function auditEntry(client, id, entry){
  const user = `Entry id: ${id}\nTitle: ${entry.title||id}\nTemplate: ${entry.template||'n/a'}\n\n`
    + `HOOK (${(entry.hook||'').split(/\s+/).length} words):\n${entry.hook||'(none)'}\n\n`
    + `SUMMARY:\n${entry.summary||'(none)'}\n\n`
    + `GENERAL LAYER — opening:\n${firstSentences(genText(entry), 4)}`;
  let messages = [{ role:'user', content:user }];
  let resp;
  for(let guard=0; guard<6; guard++){
    resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type:'adaptive' },
      system: SYSTEM,
      messages,
    });
    if(resp.stop_reason !== 'pause_turn') break;
    messages.push({ role:'assistant', content: resp.content });
  }
  const text = resp.content.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);
  if(!m) return { rec:null, raw:text, parseError:true };
  try { const arr = JSON.parse(m[1]); return { rec: Array.isArray(arr)?arr[0]:arr, raw:text }; }
  catch { return { rec:null, raw:text, parseError:true }; }
}

// deterministic spread so --sample hits varied templates, lengths, categories
function pickSpread(entries, n){
  const withLen = entries.map(e=>({...e, w:(e.hook||'').split(/\s+/).length}))
                         .sort((a,b)=>a.w-b.w);
  const out=[], step=Math.max(1, Math.floor(withLen.length/n));
  for(let i=0;i<withLen.length && out.length<n;i+=step) out.push(withLen[i]);
  return out;
}

async function main(){
  const args = process.argv.slice(2);
  let dir = 'public/entries';
  const di = args.indexOf('--dir'); if(di!==-1){ dir = args[di+1]; args.splice(di,2); }
  let sample = 0;
  const si = args.indexOf('--sample'); if(si!==-1){ sample = parseInt(args[si+1],10)||15; args.splice(si,2); }
  if(!fs.existsSync(dir)){ console.error(`No ${dir}/ folder.`); process.exit(1); }

  const load = f => { try { return JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); } catch { return null; } };
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.json') && !NON.has(f));
  const ids = args.filter(a=>!a.startsWith('--'));

  let targets;
  if(ids.length){ targets = ids.map(id=>({id, entry:load(`${id}.json`)})).filter(t=>t.entry); }
  else {
    let all = files.map(f=>({id:f.replace('.json',''), entry:load(f)})).filter(t=>t.entry && t.entry.hook);
    if(sample){ all = pickSpread(all.map(t=>({...t.entry, id:t.id})), sample).map(e=>({id:e.id, entry:e})); }
    targets = all;
  }
  if(!targets.length){ console.log('Nothing to audit.'); process.exit(0); }

  let client;
  try { client = new Anthropic(); }
  catch(e){ console.error('Could not construct Anthropic client:', e.message); process.exit(1); }

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const outFile = `hook-audit-findings-${stamp}.md`;
  const rows = [], lines = [
    `# Hook audit — ${dir} — ${new Date().toISOString()}`,
    `model: ${MODEL} · advisory only (nothing auto-applied)`, '',
    `Goal: make the reader know where they are and why to continue. Length is not the metric.`, '',
  ];
  const tally = {};

  for(const {id, entry} of targets){
    process.stdout.write(`  auditing ${id} ... `);
    let res;
    try { res = await auditEntry(client, id, entry); }
    catch(e){ console.log('API error: '+e.message); continue; }
    if(res.parseError || !res.rec){ console.log('unparsed'); lines.push(`## ${id}\n(could not parse) RAW: ${(res.raw||'').slice(0,300)}\n`); continue; }
    const r = res.rec;
    tally[r.classification] = (tally[r.classification]||0)+1;
    console.log(`${r.classification} / ${r.action}`);
    rows.push({id, ...r});
    lines.push(`## ${id}  —  \`${r.classification}\` · action: **${r.action}** · ${r.problemType}`);
    lines.push(`- redundancy: ${r.redundancyNote||'—'}`);
    lines.push(`- rationale: ${r.rationale||''}`);
    lines.push(`- ORIGINAL HOOK:\n  > ${(entry.hook||'').replace(/\n/g,' ')}`);
    if(r.action!=='keep' && r.proposedHook) lines.push(`- PROPOSED (${r.action}):\n  > ${r.proposedHook.replace(/\n/g,' ')}`);
    lines.push('');
  }

  lines.splice(4, 0, `## Tally\n${Object.entries(tally).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n`);
  fs.writeFileSync(outFile, lines.join('\n'));
  fs.writeFileSync(outFile.replace(/\.md$/,'.json'), JSON.stringify(rows,null,2));
  console.log(`\nAudited ${rows.length} entr${rows.length===1?'y':'ies'}. Written to ${outFile} (+ .json).`);
  console.log('Advisory only — review, approve, edit hooks by hand. Nothing was changed.');
}

main().catch(e=>{ console.error(e); process.exit(1); });
