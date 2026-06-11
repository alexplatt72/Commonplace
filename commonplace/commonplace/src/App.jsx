import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let MANIFEST = [];      // loaded once from /entries/manifest.json
let ENTRY_CACHE = {};   // full entries loaded on demand
let SEARCH_INDEX = [];  // richer search data: aliases, themes, indexTerms
let FUSE = null;        // Fuse.js instance, initialised after searchIndex loads
let COLLECTIONS = [];   // curated tours, loaded once from /entries/collections.json
let PATHWAYS = [];      // learning pathways, loaded once from /entries/pathways.json
let CALENDAR = null;    // Featured-Entries almanac, loaded once from /entries/calendar.json


// Reactive viewport check for responsive inline styles (phone breakpoint).
function useIsMobile(bp = 680) {
  const [m, setM] = React.useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  React.useEffect(() => {
    const f = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', f); f();
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return m;
}

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  /* overflow-x: clip (not hidden) guards against horizontal scroll WITHOUT making
     body a scroll container — hidden would break the sticky header's position. */
  html, body { overflow-x: clip; max-width: 100%; }
  .compass-btn { transition: border-color .2s, background .2s; }
  .compass-btn svg { transition: transform .35s ease; }
  .compass-btn:hover { border-color: rgba(200,169,110,0.95) !important; background: rgba(200,169,110,0.14); }
  .compass-btn:hover svg { transform: rotate(20deg); }
  .compass-btn:active svg { transform: rotate(160deg); }
  body { background: #f4f1eb; }
  .hdr-search::placeholder { color: rgba(234,240,247,0.78); opacity: 1; }
  .commerce-find { color: #243447; text-decoration: none; }
  .commerce-find .cf-circle { border: 1px solid rgba(44,101,242,0.32); background: rgba(255,255,255,0.55); transition: all .12s; }
  .commerce-find:hover { color: #9a6a00; }
  .commerce-find:hover .cf-circle { border-color: #c8a96e; background: #fffaf0; }
  .wax-seal-btn .wax-seal-svg { transition: transform .16s ease; }
  .wax-seal-btn:hover .wax-seal-svg { transform: scale(1.07) rotate(2deg); }
  .wax-seal-btn:active .wax-seal-svg { transform: scale(1.02); }
  .qa-modal-backdrop { animation: qaFade .18s ease; }
  .qa-modal-card { animation: qaPop .22s cubic-bezier(.2,.8,.3,1.05); }
  @keyframes qaFade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes qaPop { from { opacity: 0; transform: translateY(10px) scale(.985) } to { opacity: 1; transform: none } }
  .qa-answer strong { color: #8c1a2c; font-weight: 600; }
`;

// ─── TEMPLATE CONFIGURATION ───────────────────────────────────────────────────

const TEMPLATE_CONFIG = {
  Events:             { accent:"#8b4513", active:true  },
  People:             { accent:"#2d5a3d", active:true  },
  Works:              { accent:"#5c2d6e", active:true  },
  Concepts:           { accent:"#1e3a5f", active:true  },
  Periods:            { accent:"#744210", active:true  },
  Places:             { accent:"#1a4731", active:true  },
  "Natural Phenomena":{ accent:"#1d4ed8", active:true  },
  Policy:             { accent:"#92400e", active:true  },
  Foundations:        { accent:"#5c4a1e", active:true  },
};

const C = {
  bg:"#f4f1eb", surface:"#ffffff", warm:"#faf8f4",
  border:"#e2d8c8", borderStrong:"#c8b89a",
  text:"#1c1917", muted:"#6b6356", light:"#9c8e7e", navy:"#243447",
};

// ─── PLATFORM CONFIGURATION ───────────────────────────────────────────────────

const DEPTH_LAYERS = [
  { id:"beginner",    label:"Beginner",    next:"general",     nextLabel:"General",     desc:"Stable orientation" },
  { id:"general",     label:"General",     next:"educational", nextLabel:"Educational", desc:"Substantive understanding" },
  { id:"educational", label:"Educational", next:"advanced",    nextLabel:"Advanced",    desc:"Analytical literacy" },
  { id:"advanced",    label:"Advanced",    next:"research",    nextLabel:"Research",    desc:"Near-peer engagement" },
  { id:"research",    label:"Research",    next:null,                                   desc:"Open frontiers" },
];

const SUBTYPE_SECTIONS = {
  "Discrete Event":                ["theEvent","context","theRecord","theMoment","causation","significance"],
  "Extended Process":              ["theEvent","context","theRecord","phases","mechanics","transformation","causation","significance"],
  "Threshold Moment — Restructured":["thePivot","theRecord","context","secondOrderEffects","longShadow","causation"],
  "Historical Actor":  ["theFigure","worldInherited","howExercisedPower","whatTheyChanged","legendVsRecord"],
  "Creative Figure":   ["theFigure","bodyOfWork","howBeenRead","whyItEndured","contestedInheritance"],
  "Thinker":           ["theFigure","worldOfIdeas","centralIdea","howSpread","contestedInheritance"],
  "Narrative":         ["theWork","momentOfMaking","whatItDoes","whatItChanged","howBeenRead"],
  "Non-narrative":     ["theWork","momentOfMaking","centralArgument","whatItChanged","contestedReading"],
  "Foundational Text": ["theText","momentOfMaking","whatItClaims","interpretiveEcosystem","usedAndWeaponized"],
  "Analytical Concept":["theConcept","problemItSolves","howItWorks","whatItExplains","whereItBreaksDown","usedAndMisusedC"],
  "Normative Concept": ["theConcept","problemItAddresses","competingTraditions","politicalStakes","contestedHistoryC","whereDebateStands"],
  "Period":   ["thePeriod","theBoundaries","theConditions","internalDiversity","longConsequences","periodizationDebate"],
  "Movement": ["theMovement","origins","coreCommitments","whatItChanged","legacyAndLimits","internalTensions"],
  "Site":     ["thePlace","physicalWorld","theLayers","whatItBecame","whoClaimsIt","theLongLife"],
  "System":   ["theSystem","physicalLogic","whatMovedThrough","whoOrganizedIt","whatItMadePossible","theLongLifeS"],
  "Natural Event": ["theForce","theRecord","howPeopleKnew","whatItDidToSocieties","theUnequal","theLongConsequence"],
  "Natural Force": ["theForce","theRecord","howPeopleKnew","whatItDidToSocieties","theUnequal","theLongConsequence"],
  "Policy Landscape": ["theLandscape","theHistoricalArc","theValueFramework","theEvidenceEcosystem","theInternationalComparison","theCurrentDebates"],
  "Policy Question": ["theQuestion","theStakes","theValueFramework","theEvidence","theOptions","theInternationalEvidence"],
  "Material Foundation":    ["theFoundation","howItArrived","whatItReorganized","thePoliticalEconomy","theFeedback","presentAndFuture"],
  "Biological Foundation":  ["theFoundation","howItArrived","whatItReorganized","thePoliticalEconomy","theFeedback","presentAndFuture"],
  "Conceptual Foundation":  ["theFoundation","howItArrived","whatItReorganized","thePoliticalEconomy","theFeedback","presentAndFuture"],
};

const SECTION_LABELS = {
  theEvent:"The Event", context:"Context", theRecord:"The Record",
  theMoment:"The Moment", causation:"Causation", significance:"Significance",
  phases:"Phases", mechanics:"Mechanics", transformation:"Transformation",
  thePivot:"The Pivot — What Actually Changed", secondOrderEffects:"What It Made Possible",
  longShadow:"The Long Shadow — Why It Still Operates", theFigure:"The Figure",
  worldInherited:"The World They Inherited", howExercisedPower:"How They Exercised Power",
  whatTheyChanged:"What They Changed", legendVsRecord:"The Gap Between Legend and Record",
  whatMadePossible:"What Made Them Possible", bodyOfWork:"The Body of Work",
  howBeenRead:"How They've Been Read", worldOfIdeas:"The World of Ideas They Inherited",
  centralIdea:"The Central Idea", howSpread:"How the Ideas Spread and Were Transformed",
  contestedInheritance:"The Contested Inheritance", whyItEndured:"Why It Has Endured", theWork:"The Work",
  momentOfMaking:"The Moment of Making", whatItDoes:"What It Does",
  whatItChanged:"What It Changed", centralArgument:"The Central Argument",
  contestedReading:"The Contested Reading", theText:"The Text",
  whatItClaims:"What It Claims", interpretiveEcosystem:"The Interpretive Ecosystem",
  usedAndWeaponized:"How It's Been Used and Weaponized",
  theConcept:"The Concept",
  problemItSolves:"The Problem It Solves", howItWorks:"How It Works",
  whatItExplains:"What It Explains", whereItBreaksDown:"Where It Breaks Down",
  usedAndMisusedC:"How It's Been Used and Misused",
  problemItAddresses:"The Problem It Addresses", competingTraditions:"The Competing Traditions",
  politicalStakes:"The Political Stakes", contestedHistoryC:"The Contested History",
  whereDebateStands:"Where the Debate Stands",
  thePeriod:"The Period", theBoundaries:"The Boundaries", theConditions:"The Conditions",
  internalDiversity:"The Internal Diversity", longConsequences:"The Long Consequences",
  periodizationDebate:"The Periodization Debate",
  theMovement:"The Movement", origins:"Origins", coreCommitments:"Core Commitments",
  legacyAndLimits:"Legacy and Limits", internalTensions:"Internal Tensions",
  thePlace:"The Place", physicalWorld:"The Physical World", theLayers:"The Layers",
  whatItBecame:"What It Became", whoClaimsIt:"Who Claims It", theLongLife:"The Long Life",
  theSystem:"The System", physicalLogic:"The Physical Logic",
  whatMovedThrough:"What Moved Through It", whoOrganizedIt:"Who Organized It",
  whatItMadePossible:"What It Made Possible", theLongLifeS:"The Long Life",
  thePhenomenon:"The Phenomenon", theScience:"The Science",
  whatItDid:"What It Did to Human Civilization",
  howHumansUnderstoodIt:"How Humans Understood It",
  whatChanged:"What Changed Because of It", theLongShadow:"The Long Shadow",
  theForce:"The Force", theRecord:"The Record", howPeopleKnew:"How People Knew", whatItDidToSocieties:"What It Did to Societies", theUnequal:"The Unequal", theLongConsequence:"The Long Consequence",
  humanResponse:"Human Response and Adaptation",
  whatItMadeImpossible:"What It Made Impossible or Inevitable",
  presentAndFuture:"The Present and Future",
  theLandscape:"The Landscape", theHistoricalArc:"The Historical Arc",
  theValueFramework:"The Value Framework", theEvidenceEcosystem:"The Evidence Ecosystem",
  theInternationalComparison:"The International Comparison", theCurrentDebates:"The Current Debates",
  theQuestion:"The Question", theStakes:"The Stakes",
  theEvidence:"The Evidence", theOptions:"The Options",
  theInternationalEvidence:"The International Evidence",
  theFoundation:"The Foundation", howItArrived:"How It Entered Human Civilization",
  whatItReorganized:"What It Reorganized", thePoliticalEconomy:"The Political Economy",
  theFeedback:"Feedback and Unintended Consequences", theTransmission:"Transmission and Adoption",
};

const SIGNAL_STYLES = {
  "Scholarly consensus": { bg:"#f0faf4", color:"#276749", border:"#6aaa82" },
  "Widely accepted":     { bg:"#f0faf4", color:"#276749", border:"#6aaa82" },
  "Dominant interpretation":{ bg:"#f0f9f0", color:"#166534", border:"#4ade80" },
  "Contested":           { bg:"#fffbeb", color:"#92400e", border:"#d4a017" },
  "Actively debated":    { bg:"#fff1f2", color:"#9f1239", border:"#e07080" },
  "Emerging research":   { bg:"#eff6ff", color:"#1d4ed8", border:"#60a5d8" },
  "Common framing":      { bg:"#f5f3ff", color:"#5b21b6", border:"#8b72c8" },
};

const RESEARCH_STATUS = {
  established:   { label:"Established",   color:"#276749", bg:"#f0faf4", border:"#6aaa82" },
  emerging:      { label:"Emerging",      color:"#1d4ed8", bg:"#eff6ff", border:"#60a5d8" },
  speculative:   { label:"Speculative",   color:"#92400e", bg:"#fffbeb", border:"#d4a017" },
  unrecoverable: { label:"Unrecoverable", color:"#4a2060", bg:"#f5f0ff", border:"#9060c0" },
};

const RABBIT_TYPE_COLORS = {
  Foundational:"#2c5282", Consequential:"#744210", Contrasting:"#553c9a",
  Parallel:"#276749", Gateway:"#2d3748", Precursor:"#5c2d6e", Descendant:"#1a4a4a",
};

// Gravity defaults by type — can be overridden per link with explicit gravity:"high"|"medium"|"low"
const TYPE_GRAVITY = {
  Foundational:"high", Consequential:"high", Precursor:"high",
  Contrasting:"medium", Parallel:"medium", Descendant:"medium", Gateway:"medium",
};

const GRAVITY_STYLES = {
  high: {
    padding:"16px 20px",
    borderWidth:5,
    bg:C.surface,
    border:"1px solid rgba(0,0,0,0.09)",
    shadow:"0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)",
    labelSize:16,
    labelWeight:700,
    reasonSize:14,
    reasonColor:C.text,
    typeVisible:true,
  },
  medium: {
    padding:"8px 14px",
    borderWidth:2,
    bg:"transparent",
    border:`1px solid ${C.border}`,
    shadow:"none",
    labelSize:13,
    labelWeight:500,
    reasonSize:12,
    reasonColor:C.light,
    typeVisible:false,
  },
  low: {
    padding:"6px 12px",
    borderWidth:2,
    bg:"transparent",
    border:`1px dashed ${C.border}`,
    shadow:"none",
    labelSize:12,
    labelWeight:400,
    reasonSize:11,
    reasonColor:C.light,
    typeVisible:false,
  },
};

const RELIABILITY_CONFIG = {
  "Primary":       { color:"#1e3a5f", bg:"#e8f0f8", border:"#5b7fa6" },
  "Authoritative": { color:"#1a4731", bg:"#e8f5ee", border:"#5a9e7a" },
  "Scholarly":     { color:"#2d5a3d", bg:"#f0faf4", border:"#6aaa82" },
  "Credible":      { color:"#7d4e00", bg:"#fef3e2", border:"#d4a017" },
};

const CONTRIBUTION_CONFIG = {
  "Foundational":  { color:"#7b1a1a", bg:"#fef2f2", border:"#e07070" },
  "Essential":     { color:"#1a4731", bg:"#e8f5ee", border:"#5a9e7a" },
  "Supplementary": { color:"#7d4e00", bg:"#fef3e2", border:"#d4a017" },
};

// ─── ENTRY REGISTRY ───────────────────────────────────────────────────────────


// ─── COMPONENT LIBRARY ────────────────────────────────────────────────────────

// ─── COMPONENT LIBRARY ────────────────────────────────────────────────────────

function Signal({ label }) {
  const s = SIGNAL_STYLES[label];
  if (!s) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.04em", fontWeight:500, color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>
      <span style={{ fontSize:7 }}>◆</span>{label}
    </span>
  );
}

function Hook({ text }) {
  return (
    <div style={{ padding:"26px 40px 20px", borderBottom:`1px solid ${C.border}` }}>
      <p style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontStyle:"italic", lineHeight:1.58, color:C.text }}>{text}</p>
    </div>
  );
}

function SectionBlock({ label, content, signal }) {
  if (!content) return null;
  const paragraphs = content.split("\n\n");
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <span style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.12em", textTransform:"uppercase", color:C.light, fontWeight:500 }}>{label}</span>
        {signal && <Signal label={signal} />}
      </div>
      {paragraphs.map((p,i) => (
        <p key={i} style={{ fontFamily:"'Lora',serif", fontSize:16.5, lineHeight:1.78, color:C.text, marginBottom: i < paragraphs.length-1 ? 14 : 0 }}>{p}</p>
      ))}
    </div>
  );
}

function QuestionsToConsider({ questions }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop:32, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", background: open ? C.navy : C.warm, border:"none", cursor:"pointer", textAlign:"left" }}>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color: open ? "#fff" : C.text }}>Questions to Consider</span>
        <span style={{ color: open ? "#ffffff80" : C.muted, fontSize:20, fontWeight:300 }}>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div style={{ padding:"22px 24px", background:C.surface }}>
          {questions.map((q,i) => (
            <div key={i} style={{ display:"flex", gap:14, marginBottom: i < questions.length-1 ? 18 : 0, paddingBottom: i < questions.length-1 ? 18 : 0, borderBottom: i < questions.length-1 ? `1px dashed ${C.border}` : "none" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"#555", fontWeight:600, minWidth:20, marginTop:3 }}>{i+1}.</span>
              <p style={{ fontFamily:"'Lora',serif", fontSize:15.5, lineHeight:1.72, color:C.text }}>{q}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EducationalView({ content }) {
  const [sub, setSub] = useState("foundation");
  const f = [{key:"theStory",label:"The Deeper Story",sub2:"What actually matters"},{key:"theDebate",label:"Why Scholars Disagree",sub2:"Competing interpretations accessibly"},{key:"whyItMatters",label:"Why It Still Matters",sub2:"Connections to present and adjacent knowledge"}];
  const t = [{key:"scholarlyConversation",label:"The Scholarly Conversation",sub2:"Named arguments and frameworks"},{key:"evidenceAndLimits",label:"Evidence and Its Limits",sub2:"What the record shows"},{key:"takingAPosition",label:"Taking a Position",sub2:"What a strong argument needs"}];
  const sections = sub === "foundation" ? f : t;
  const current = content[sub];
  const ac = sub === "foundation" ? "#2d5a3d" : "#5b21b6";
  return (
    <div>
      <div style={{ display:"inline-flex", marginBottom:28, border:`1px solid ${C.border}`, borderRadius:6, overflow:"hidden" }}>
        {["foundation","interpretation"].map(s => (
          <button key={s} onClick={() => setSub(s)} style={{ padding:"8px 22px", border:"none", background: sub === s ? ac : C.warm, color: sub === s ? "#fff" : C.muted, fontFamily:"'Lora',serif", fontSize:13, fontWeight: sub === s ? 600 : 400, cursor:"pointer", transition:"all 0.15s", textTransform:"capitalize" }}>{s}</button>
        ))}
      </div>
      {sections.map((s,i) => current?.[s.key] ? (
        <div key={s.key} style={{ marginBottom:28, paddingBottom:24, borderBottom: i < sections.length-1 ? `1px dashed ${C.border}` : "none" }}>
          <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.12em", textTransform:"uppercase", color:ac, fontWeight:500, marginBottom:3 }}>{s.label}</div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.light, fontStyle:"italic", marginBottom:10 }}>{s.sub2}</div>
          <p style={{ fontFamily:"'Lora',serif", fontSize:16.5, lineHeight:1.78, color:C.text }}>{current[s.key]}</p>
        </div>
      ) : null)}
      {current?.questions && <QuestionsToConsider questions={current.questions} />}
    </div>
  );
}

function ResearchView({ items }) {
  return (
    <div>
      <div style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic", marginBottom:24, paddingBottom:16, borderBottom:`1px solid ${C.border}`, lineHeight:1.6 }}>
        Research findings are marked by how well established they are. Claims not appearing here are either settled matters of scholarly consensus, or excluded as fringe.
      </div>
      {items.map((item,i) => {
        const s = RESEARCH_STATUS[item.status] || RESEARCH_STATUS.speculative;
        return (
          <div key={i} style={{ marginBottom:24, paddingLeft:16, borderLeft:`3px solid ${s.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.04em", color:s.color, background:s.bg, border:`1px solid ${s.border}` }}>{s.label}</span>
              <span style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, color:C.text }}>{item.topic}</span>
            </div>
            <p style={{ fontFamily:"'Lora',serif", fontSize:15.5, lineHeight:1.75, color:C.text }}>{item.content}</p>
          </div>
        );
      })}
    </div>
  );
}

function ContentView({ entry, depth }) {
  const sections = SUBTYPE_SECTIONS[entry.subtype] || [];
  const content = entry.content[depth];
  const signals = content?.signals || {};
  if (depth === "educational") {
    if (!content) return <div style={{ padding:"40px 0", fontFamily:"'Lora',serif", fontSize:15, color:C.muted, fontStyle:"italic" }}>Educational content for this entry is in development.</div>;
    return <EducationalView content={content} />;
  }
  if (depth === "research") return <ResearchView items={entry.research} />;
  if (!content) return <div style={{ padding:"40px 0", fontFamily:"'Lora',serif", fontSize:16, color:C.muted, fontStyle:"italic" }}>Full content for this depth level available in the concept build files.</div>;
  return (
    <div>
      {sections.map(key => content?.[key] ? (
        <SectionBlock key={key} label={SECTION_LABELS[key]} content={content[key]} signal={signals[key]} />
      ) : null)}
    </div>
  );
}

function DepthIndicator({ depth, hasResearch, onChange }) {
  const layers = DEPTH_LAYERS.filter(l => l.id !== "research" || hasResearch);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", color:C.light, marginRight:4 }}>Depth</span>
      {layers.map((l,i) => (
        <span key={l.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span onClick={() => onChange(l.id)} title={l.desc} style={{ fontFamily:"'Lora',serif", fontSize:13, color: depth === l.id ? "#555" : C.light, fontWeight: depth === l.id ? 600 : 400, borderBottom: depth === l.id ? `1.5px solid #555` : "none", paddingBottom:1, cursor:"pointer" }}>{l.label}</span>
          {i < layers.length-1 && <span style={{ color:C.border, fontSize:10 }}>·</span>}
        </span>
      ))}
    </div>
  );
}

function GoDeeper({ currentDepth, hasResearch, onChange, accent }) {
  const current = DEPTH_LAYERS.find(l => l.id === currentDepth);
  if (!current?.next) return null;
  if (current.next === "research" && !hasResearch) return null;
  return (
    <div style={{ marginTop:36, padding:"18px 22px", background:C.warm, border:`1px solid ${C.border}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, marginBottom:2 }}>Reading at <strong style={{ color:C.text }}>{current.label}</strong></div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.light, fontStyle:"italic" }}>{current.desc}</div>
      </div>
      <button onClick={() => onChange(current.next)} style={{ padding:"8px 18px", background:accent || C.navy, color:"#fff", border:"none", borderRadius:4, fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, cursor:"pointer" }}>
        {current.nextLabel} →
      </button>
    </div>
  );
}

function ComparativeNarrative({ perspectives, summary }) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(0);
  return (
    <div style={{ marginTop:44 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{ width:3, height:20, background:"#553c9a", borderRadius:2 }} />
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.text }}>Comparative Memory</h3>
      </div>
      <div style={{ background:C.warm, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
          <p style={{ fontFamily:"'Lora',serif", fontSize:14, lineHeight:1.6, color:C.muted, fontStyle:"italic" }}>{summary}</p>
          <button onClick={() => setExpanded(!expanded)} style={{ padding:"6px 14px", border:`1.5px solid ${C.borderStrong}`, borderRadius:4, background: expanded ? "#553c9a" : C.surface, color: expanded ? "#fff" : "#553c9a", fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
            {expanded ? "Close" : "Explore"}
          </button>
        </div>
        {expanded && (
          <div style={{ borderTop:`1px solid ${C.border}` }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
              {perspectives.map((p,i) => (
                <button key={i} onClick={() => setActive(i)} style={{ padding:"10px 16px", border:"none", borderBottom: i === active ? `2px solid #553c9a` : "2px solid transparent", background: i === active ? C.surface : "transparent", color: i === active ? "#553c9a" : C.muted, fontFamily:"'Lora',serif", fontSize:13, fontWeight: i === active ? 600 : 400, cursor:"pointer", whiteSpace:"nowrap" }}>{perspectives[i].perspective}</button>
              ))}
            </div>
            <div style={{ padding:"22px 26px" }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontStyle:"italic", color:"#553c9a", marginBottom:8 }}>{perspectives[active].name}</div>
              <p style={{ fontFamily:"'Lora',serif", fontSize:16, lineHeight:1.75, color:C.text }}>{perspectives[active].content}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RabbitHole({ links, navigateTo }) {

  // Assign gravity and sort: high → medium → low
  const GRAVITY_ORDER = { high:0, medium:1, low:2 };
  const sortedLinks = [...links]
    .map(link => ({ ...link, _gravity: link.gravity || TYPE_GRAVITY[link.type] || "medium" }))
    .sort((a, b) => GRAVITY_ORDER[a._gravity] - GRAVITY_ORDER[b._gravity]);

  // Group for section headers
  const highLinks   = sortedLinks.filter(l => l._gravity === "high");
  const otherLinks  = sortedLinks.filter(l => l._gravity !== "high");

  const renderLink = (link, i) => {
    const tc = RABBIT_TYPE_COLORS[link.type] || C.muted;
    const gs = GRAVITY_STYLES[link._gravity];
    const hasEntry = link.entryId && MANIFEST.find(e => e.id === link.entryId);
    const targetTemplate = hasEntry ? hasEntry.template : null;
    return (
      <div key={i}
        onClick={() => hasEntry && navigateTo(link.entryId)}
        style={{
          display:"flex", alignItems:"flex-start", gap:12,
          padding:gs.padding,
          background:gs.bg,
          border:gs.border,
          borderLeft:`${gs.borderWidth}px solid ${hasEntry ? tc : C.light}`,
          borderRadius:7,
          cursor: hasEntry ? "pointer" : "default",
          boxShadow: gs.shadow,
          transition:"all 0.15s",
          marginBottom: link._gravity === "high" ? 8 : 4,
          opacity: hasEntry ? 1 : 0.6,
        }}
      >
        {/* Type label: prominent chip for high gravity, inline text for medium/low */}
        {gs.typeVisible ? (
          <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 8px", borderRadius:4, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", whiteSpace:"nowrap", marginTop:2, color:"#fff", background: hasEntry ? tc : C.light, flexShrink:0 }}>{link.type}</span>
        ) : (
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color: hasEntry ? tc : C.light, fontWeight:500, letterSpacing:"0.05em", textTransform:"uppercase", whiteSpace:"nowrap", marginTop:3, minWidth:72, flexShrink:0 }}>{link.type}</span>
        )}
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: link._gravity === "high" ? 5 : 2 }}>
            <span style={{ fontFamily:"'Lora',serif", fontSize:gs.labelSize, fontWeight:gs.labelWeight, color: hasEntry ? C.text : C.muted, fontStyle: hasEntry ? "normal" : "italic" }}>{link.label}</span>
            {targetTemplate && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase", padding:"1px 6px", borderRadius:2, color:"#fff", background:TEMPLATE_CONFIG[targetTemplate]?.accent || C.navy }}>
                → {targetTemplate}
              </span>
            )}
            {!hasEntry && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.05em", textTransform:"uppercase", padding:"1px 7px", borderRadius:3, color:C.muted, background:C.border, whiteSpace:"nowrap" }}>
                Coming soon
              </span>
            )}
            {hasEntry && link._gravity === "high" && (
              <span style={{ marginLeft:"auto", fontSize:16, color:tc, opacity:0.5 }}>→</span>
            )}
          </div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:gs.reasonSize, color:gs.reasonColor, lineHeight:1.5 }}>{link.reason}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
        <div style={{ width:3, height:20, background:C.navy, borderRadius:2 }} />
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.text }}>Down the Rabbit Hole</h3>
      </div>
      <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.light, fontStyle:"italic", marginBottom:14 }}>

      </div>

      {/* High gravity: essential connections */}
      {highLinks.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:C.light, marginBottom:8 }}>Essential connections</div>
          {highLinks.map((link, i) => renderLink(link, `h${i}`))}
        </div>
      )}

      {/* Medium / low: further exploration */}
      {otherLinks.length > 0 && (
        <div>
          {highLinks.length > 0 && (
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:C.light, marginBottom:8, marginTop:16 }}>For deeper exploration</div>
          )}
          {otherLinks.map((link, i) => renderLink(link, `m${i}`))}
        </div>
      )}
    </div>
  );
}

function ReferenceTab({ items }) {
  if (!items || !items.length) return <div style={{ padding:"40px 0", fontFamily:"'Lora',serif", fontSize:16, color:C.muted, fontStyle:"italic" }}>Reference data available in concept build files.</div>;
  return (
    <div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 20px", marginBottom:24, lineHeight:1.6 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.06em", textTransform:"uppercase", color:C.muted, marginBottom:10 }}>How references work</div>
        <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, margin:"0 0 10px" }}>
          These works informed the entry as a whole. The Commonplace does not use inline footnotes; this list is the citation trail for the entry. Some sources are named or used directly in the text; others shaped the background, interpretation, or further-reading path.
        </p>
        <p style={{ fontFamily:"'Lora',serif", fontSize:13.5, color:C.muted, margin:"0 0 4px" }}>
          <strong style={{ color:C.text }}>Reliability</strong> — how trustworthy the source is as scholarship, evidence, or method.
        </p>
        <p style={{ fontFamily:"'Lora',serif", fontSize:13.5, color:C.muted, margin:"0 0 10px" }}>
          <strong style={{ color:C.text }}>Role</strong> — how important the source is to this particular entry.
        </p>
        <p style={{ fontFamily:"'Lora',serif", fontSize:12.5, color:C.light, fontStyle:"italic", margin:0 }}>
          The “Find it” links inside each reading layer are for further reading, not sentence-by-sentence citation.
        </p>
      </div>
      {items.map((item,i) => {
        const rel = RELIABILITY_CONFIG[item.reliability] || RELIABILITY_CONFIG["Scholarly"];
        const con = CONTRIBUTION_CONFIG[item.contribution] || CONTRIBUTION_CONFIG["Supplementary"];
        return (
          <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 20px", borderLeft:`4px solid ${rel.border}`, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:8 }}>
              <div style={{ display:"flex", flexWrap:"wrap", alignItems:"baseline", gap:"2px 0" }}>
                {item.author && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.muted, marginRight:6, whiteSpace:"nowrap" }}>{item.author} —</span>}
                <span style={{ fontFamily:"'Lora',serif", fontSize:15, fontStyle:"italic", color:C.text }}>{item.title}</span>
                {item.year && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.light, marginLeft:6, whiteSpace:"nowrap" }}>{item.year}</span>}
                {item.originLanguage && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"#4a2060", background:"#f3eef8", padding:"1px 6px", borderRadius:2, marginLeft:8, whiteSpace:"nowrap" }}>Non-English: {item.originLanguage}</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                <span style={{ padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap", color:rel.color, background:rel.bg, border:`1px solid ${rel.border}` }}>Reliability: {item.reliability}</span>
                <span style={{ padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap", color:con.color, background:con.bg, border:`1px solid ${con.border}` }}>Role: {item.contribution}</span>
              </div>
            </div>
            <p style={{ fontFamily:"'Lora',serif", fontSize:13.5, lineHeight:1.65, color:C.muted }}>{item.annotation}</p>
          </div>
        );
      })}
    </div>
  );
}

// Affiliate IDs — empty until accounts are set up. When populated, links gain tags
// automatically; WorldCat is always a free, non-commercial library link.
const AFFILIATES = { amazonTag: '', bookshopId: '125011' };

const cleanISBN = (v) => (v || '').replace(/[^0-9Xx]/g, '');
const isBookLike = (type) => /^(book|novel)$/i.test(type || '');

// Validate an ISBN-13 (or ISBN-10) checksum. A direct ISBN-based link must point at a
// real, correctly-keyed product — a typo'd or transposed ISBN resolves to the wrong book
// (or nothing). When the checksum fails we fall back to a title+author search instead.
function isValidISBN(value) {
  const s = cleanISBN(value).toUpperCase();
  if (s.length === 13) {
    if (/[^0-9]/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (i % 2 ? 3 : 1) * parseInt(s[i], 10);
    return (10 - (sum % 10)) % 10 === parseInt(s[12], 10);
  }
  if (s.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = s[i];
      const v = ch === 'X' ? 10 : parseInt(ch, 10);
      if (Number.isNaN(v) || (ch === 'X' && i !== 9)) return false;
      sum += v * (10 - i);
    }
    return sum % 11 === 0;
  }
  return false;
}

// Convert ISBN-13 (978 prefix) to ISBN-10. Amazon keys products to the ISBN-10/ASIN,
// so /dp/{isbn10} is a direct product page. 979-prefix ISBNs have no ISBN-10 → null.
function isbn13to10(value) {
  const s = cleanISBN(value);
  if (s.length === 10) return s.toUpperCase();
  if (s.length !== 13 || !s.startsWith('978')) return null;
  const core = s.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * parseInt(core[i], 10);
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? 'X' : String(c));
}

// Resolve a "find it" link.
// WorldCat (Library) searches by ISBN and resolves reliably to the right library record.
// Bookshop (Indie) always searches by title+author: its catalog hard-404s on many academic/
// older/non-US-edition ISBNs, so a direct ISBN link is not safe (a search always resolves).
// Amazon keys products to ISBN-10/ASIN, so /dp/{isbn10} is a reliable direct product page for a
// confirmed US edition; otherwise it searches by title+author.
function resolveCommerceLink(item, provider) {
  const isbn = cleanISBN(item.isbn);
  const titleAuthor = [item.title, item.author].filter(Boolean).join(' ');
  const ta = encodeURIComponent(titleAuthor);
  // US edition confirmed AND the ISBN is structurally valid → safe for a direct Amazon link.
  // A bad-checksum ISBN can never generate a direct link; it searches instead. (Bookshop always
  // searches regardless, so `trusted` now only gates Amazon's direct /dp/ link.)
  const trusted = !!item.isbnUS && !!isbn && isValidISBN(isbn);
  if (provider === 'worldcat') {
    // WorldCat resolves any edition's ISBN to the right library record.
    return `https://search.worldcat.org/search?q=${encodeURIComponent(isbn || titleAuthor)}`;
  }
  if (provider === 'bookshop') {
    // ALWAYS search — never a direct /a/{id}/{isbn} link. Bookshop's catalog does not carry a
    // large share of academic, older, and non-US-edition ISBNs, so direct ISBN links hard-404
    // (verified across the corpus: most failed). A keyword search always resolves (HTTP 200) and
    // lands on the book when Bookshop stocks it, or an honest "no results" when it doesn't —
    // never a dead link. Affiliate attribution is preserved via the ?affiliate= param.
    const aff = AFFILIATES.bookshopId ? `&affiliate=${AFFILIATES.bookshopId}` : '';
    return `https://bookshop.org/search?keywords=${ta}${aff}`;
  }
  // amazon — direct /dp/{isbn10} only for confirmed US editions; else title+author search
  const isbn10 = trusted ? isbn13to10(isbn) : null;
  if (isbn10) {
    const dp = `https://www.amazon.com/dp/${isbn10}`;
    return AFFILIATES.amazonTag ? `${dp}?tag=${AFFILIATES.amazonTag}` : dp;
  }
  const base = `https://www.amazon.com/s?k=${ta}&i=stripbooks`;
  return AFFILIATES.amazonTag ? `${base}&tag=${AFFILIATES.amazonTag}` : base;
}

const COMMERCE_PROVIDERS = [
  { key:'worldcat', label:'Library', aria:'Find in libraries via WorldCat' },
  { key:'bookshop', label:'Indie',   aria:'Find at independent bookstores via Bookshop.org' },
  { key:'amazon',   label:'Amazon',  aria:'Find on Amazon' },
];

function ProviderIcon({ name }) {
  const p = { width:14, height:14, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor",
    strokeWidth:1.7, strokeLinecap:"round", strokeLinejoin:"round" };
  if (name === 'worldcat') return <svg {...p}><path d="M3 21h18"/><path d="M5 21V9.5l7-4.5 7 4.5V21"/><path d="M9.5 21v-5h5v5"/></svg>;
  if (name === 'bookshop') return <svg {...p}><path d="M3.5 9 5 4h14l1.5 5"/><path d="M4.5 9v11h15V9"/><path d="M10 20v-5h4v5"/></svg>;
  return <svg {...p}><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/><path d="M2.5 4H5l2.2 11h10.5"/><path d="M7 7.5h13l-1.3 6H8.2"/></svg>;
}

function FindItRow({ item }) {
  return (
    <div style={{ marginTop:"auto", paddingTop:10, borderTop:"1px solid rgba(44,101,242,0.18)",
      display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8.5, letterSpacing:"0.08em",
        textTransform:"uppercase", color:"#5f6b7a" }}>Find it</span>
      <div style={{ display:"flex", gap:7 }}>
        {COMMERCE_PROVIDERS.map(p => (
          <a key={p.key} className="commerce-find" href={resolveCommerceLink(item, p.key)}
            target="_blank" rel="noopener noreferrer sponsored" aria-label={p.aria} title={p.aria}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span className="cf-circle" style={{ width:26, height:26, borderRadius:"50%",
              display:"grid", placeItems:"center" }}>
              <ProviderIcon name={p.key} />
            </span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:7.5,
              letterSpacing:"0.03em", color:"inherit" }}>{p.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function CommerceSection({ items }) {
  if (!items || !items.length) return null;
  const hasBooks = items.some(it => isBookLike(it.type));
  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: hasBooks ? 6 : 14 }}>
        <div style={{ width:3, height:20, background:"#1d4ed8", borderRadius:2 }} />
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.text }}>Books, Documentaries &amp; Resources</h3>
      </div>
      {hasBooks && (
        <div style={{ fontFamily:"'Lora',serif", fontSize:11.5, fontStyle:"italic", color:C.light,
          lineHeight:1.6, marginBottom:14 }}>
          Library links are free to use. As a Bookshop.org affiliate, the site may earn a commission from Bookshop purchases.
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
        {items.map((item,i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", padding:"14px 16px",
            background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:6 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#1d4ed8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>{item.type}</div>
              <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontStyle:"italic", fontWeight:600, color:C.text, marginBottom:3 }}>{item.title}</div>
              {item.author && <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted, marginBottom:4 }}>{item.author}</div>}
              <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted }}>{item.note}</div>
            </div>
            {isBookLike(item.type) && <FindItRow item={item} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PopularCulture({ items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
        <div style={{ width:3, height:20, background:"#d97706", borderRadius:2 }} />
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.text }}>In Popular Culture</h3>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:8 }}>
        {items.map((item,i) => (
          <div key={i} style={{ padding:"14px 16px", background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:6 }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#92400e", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>{item.type}</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontWeight:600, color:C.text, marginBottom:5 }}>{item.title}</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryView({ entry, accent, navigateTo }) {
  const [depth, setDepth] = useState("beginner");
  const [tab, setTab] = useState("content");
  // Switching layer should start the reader at the top of the new layer, not leave
  // them at the bottom where the "go deeper" link was.
  const changeDepth = (d) => { setDepth(d); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const isMobile = useIsMobile();
  const showPopularCulture = depth === "beginner" && entry.popularCulture;
  const showComparative = depth === "general" || depth === "educational";
  const showRabbitHole = depth === "beginner" || depth === "general";
  const showCommerce = depth === "general" || depth === "educational" || depth === "advanced";
  return (
    <div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", borderTop:`4px solid ${accent}`, marginBottom:2 }}>
        <div style={{ padding: isMobile ? "18px 16px 0" : "24px 40px 0" }}>
          <div style={{ display:"flex", gap:7, marginBottom:10, flexWrap:"wrap" }}>
            <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.05em", textTransform:"uppercase", color:"#fff", background:accent }}>{entry.template}</span>
            <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.05em", textTransform:"uppercase", color:C.navy, background:"#eef2f7", border:`1px solid ${C.border}` }}>{entry.subtype}</span>
            <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:C.light, background:C.bg, border:`1px solid ${C.border}` }}>{entry.period}</span>
            {entry.creatorId && <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", color:"#5b21b6", background:"#f5f0ff", border:"1px solid #c4b5fd" }}>creator: {entry.creatorId}</span>}
          </div>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, lineHeight:1.25, color:C.text, marginBottom:6 }}>{entry.title}</h2>
          <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic", paddingBottom:20 }}>{entry.summary}</p>
        </div>
        <Hook text={entry.hook} />
        <div style={{ display:"flex", borderTop:`1px solid ${C.border}` }}>
          {["content","reference"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:"12px 24px", border:"none", borderBottom: tab === t ? `2px solid ${accent}` : "2px solid transparent", background: tab === t ? C.surface : C.warm, color: tab === t ? accent : C.muted, fontFamily:"'Lora',serif", fontSize:14, fontWeight: tab === t ? 600 : 400, cursor:"pointer", transition:"all 0.15s", textTransform:"capitalize" }}>{t}</button>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", paddingRight:24, opacity: tab === "reference" ? 0.3 : 1, pointerEvents: tab === "reference" ? "none" : "auto" }}>
            <DepthIndicator depth={depth} hasResearch={!!(entry.research && entry.research.length)} onChange={setDepth} />
          </div>
        </div>
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding: isMobile ? "24px 16px" : "36px 40px" }}>
        {tab === "content" ? (
          <>
            <ContentView entry={entry} depth={depth} />
            {depth !== "research" && <GoDeeper currentDepth={depth} hasResearch={!!(entry.research && entry.research.length)} onChange={changeDepth} accent={accent} />}
            <div style={{ borderTop:`1px solid ${C.border}`, marginTop:44, paddingTop:36 }}>
              {showPopularCulture && <PopularCulture items={entry.popularCulture} />}
              {showComparative && <ComparativeNarrative perspectives={entry.comparativeNarrative} summary={entry.comparativeSummary} />}
              {showRabbitHole && <RabbitHole links={entry.rabbitHole} navigateTo={navigateTo} />}
              {showCommerce && <CommerceSection items={entry.commerce} />}
            </div>
          </>
        ) : (
          <ReferenceTab items={entry.reference} />
        )}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────


// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE METADATA
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATE_META = {
  Events:             { question:"What happened, and what it set in motion.",          desc:"Moments that altered the structure of what followed",               icon:"◈" },
  People:             { question:"Who they were, and what they made possible.",        desc:"The people who changed what was possible",                          icon:"◉" },
  Works:              { question:"The creations that shape the world.",                desc:"Texts and creations that outlasted their moment",                   icon:"◇" },
  "Concepts":         { question:"How an idea alters what's possible.",               desc:"Ideas that changed what people could think, argue, or do",          icon:"◎" },
  Periods:            { question:"Epochs, eras, and ages.",                            desc:"The ages that made the world what it is",                           icon:"◫" },
  Places:             { question:"The places where history happened.",                 desc:"Locations whose significance exceeds their geography",              icon:"◬" },
  "Natural Phenomena":{ question:"The forces that steer civilization.",                desc:"The natural forces that shaped what civilization could do",          icon:"◭" },
  Policy:             { question:"Where reasonable people disagree.",                  desc:"Live questions where values, evidence, and institutions collide",    icon:"◮" },
  Foundations:        { question:"The building blocks of human history.",               desc:"The materials, organisms, and ideas civilization was built on",      icon:"◯" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function initFuse() {
  FUSE = new Fuse(SEARCH_INDEX, {
    keys: [
      { name: "title",       weight: 0.65 },
      { name: "aliases",     weight: 0.15 },
      { name: "associatedWorks", weight: 0.12 },
      { name: "indexTerms",  weight: 0.05 },
      { name: "themes",      weight: 0.02 },
      { name: "summary",     weight: 0.01 },
    ],
    threshold:        0.35,  // 0 = exact, 1 = match anything — 0.35 tolerates typos
    ignoreLocation:   true,  // match anywhere in the string, not just start
    minMatchCharLength: 2,
    includeScore:     true,
  });
}

// scoreEntry used for autocomplete dropdown — must use same ranking as searchEntries.
// Title/alias prefix matches always outrank Fuse fuzzy matches.
function scoreEntry(entry, terms) {
  const q     = terms.join(' ').toLowerCase();
  const title = (entry.title || '').toLowerCase();
  const bare  = title.replace(/^(the |a |an )/, '');
  const siRec   = SEARCH_INDEX.find(s => s.id === entry.id);
  const aliases = (siRec?.aliases || []).map(a => a.toLowerCase());

  if (title === q || bare === q)                              return 1000;
  if (title.startsWith(q) || bare.startsWith(q))             return 950;
  if (aliases.some(a => a === q))                             return 900;
  if (aliases.some(a => a.startsWith(q)))                     return 850;
  if (terms.length && terms.every(t => title.includes(t)))   return 800;
  if (terms.length && terms.some(t => title.startsWith(t)))  return 750;
  if (terms.length && terms.some(t => bare.startsWith(t)))   return 700;
  if (terms.length === 1 && terms.some(t => title.includes(t)))    return 650;
  // associatedWorks: works by People-entry creators — e.g. "hamlet" → Shakespeare
  const assocWorks = (siRec?.associatedWorks || []).map(s => s.toLowerCase());
  if (assocWorks.some(s => s === q))                         return 580;
  if (terms.length && assocWorks.some(s => terms.every(t => s.includes(t)))) return 570;
  if (terms.length && assocWorks.some(s => terms.some(t => s.startsWith(t)))) return 550;
  if (terms.length && assocWorks.some(s => terms.some(t => s.includes(t))))   return 520;

  // Fall back to Fuse for typo tolerance
  if (!FUSE || !terms.length) return 0;
  const results = FUSE.search(q);
  const match = results.find(r => r.item.id === entry.id);
  return match ? Math.round((1 - match.score) * 100) : 0;
}

function searchEntries(query) {
  if (!query.trim()) return { results: [], query: '', empty: false };

  const q = query.trim().toLowerCase();
  const stopWords = new Set(['the','a','an','is','are','was','were','of','in','on','at','to','for','with','by','from','and','or','that','this','it','as']);
  const terms = q.split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t));

  // ── Step 1: deterministic title/alias ranking — always beats Fuse ───────────
  // Scoring tiers (600–1000) always outrank Fuse scores (0–100).
  // "sha" matches Shakespeare because title.startsWith(q) fires on the full
  // lowercased title string, not just on word boundaries.
  const scoredByTitle = MANIFEST.map(entry => {
    const title   = (entry.title   || '').toLowerCase();
    // Strip leading articles for matching ("The British Empire" → "british empire")
    const bare    = title.replace(/^(the |a |an )/, '');
    // Aliases from search index (comparative narrative names)
    const siRec   = SEARCH_INDEX.find(s => s.id === entry.id);
    const aliases = (siRec?.aliases || []).map(a => a.toLowerCase());

    if (title === q || bare === q)                        return { id: entry.id, entry, score: 1000 }; // exact
    if (title.startsWith(q) || bare.startsWith(q))       return { id: entry.id, entry, score: 950 };  // title prefix
    if (aliases.some(a => a === q))                       return { id: entry.id, entry, score: 900 };  // exact alias
    if (aliases.some(a => a.startsWith(q)))               return { id: entry.id, entry, score: 850 };  // alias prefix
    if (terms.length && terms.every(t => title.includes(t)))   return { id: entry.id, entry, score: 800 };  // all terms in title
    if (terms.length && terms.some(t => title.startsWith(t)))  return { id: entry.id, entry, score: 750 };  // word prefix
    if (terms.length && terms.some(t => bare.startsWith(t)))   return { id: entry.id, entry, score: 700 };  // bare word prefix
    if (terms.length === 1 && terms.some(t => title.includes(t)))    return { id: entry.id, entry, score: 650 };  // word anywhere (single-term only)
    // associatedWorks: deterministic match, always beats Fuse
    const assocWorks = (siRec?.associatedWorks || []).map(s => s.toLowerCase());
    if (assocWorks.some(s => s === q))                                          return { id: entry.id, entry, score: 580 };
    if (terms.length && assocWorks.some(s => terms.every(t => s.includes(t)))) return { id: entry.id, entry, score: 570 };
    if (terms.length && assocWorks.some(s => terms.some(t => s.startsWith(t)))) return { id: entry.id, entry, score: 550 };
    if (terms.length && assocWorks.some(s => terms.some(t => s.includes(t))))   return { id: entry.id, entry, score: 520 };
    return null;
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  const pinnedIds = new Set(scoredByTitle.map(r => r.id));

  // ── Step 2: Fuse fills remaining slots for typo/fuzzy tolerance ──────────
  if (FUSE) {
    const fuseResults = FUSE.search(query, { limit: 12 });
    const fuseExtra = fuseResults
      .filter(r => !pinnedIds.has(r.item.id))
      .map(r => {
        const manifest = MANIFEST.find(e => e.id === r.item.id);
        return { id: r.item.id, entry: manifest || r.item, score: Math.min(499, Math.round((1 - r.score) * 100)) };
      }).filter(x => x.entry);

    const combined = [...scoredByTitle, ...fuseExtra].sort((a,b) => b.score - a.score).slice(0, 12);
    if (combined.length > 0) return { results: combined, query, empty: false };
    return { results: [], suggestions: [], query, empty: true };
  }

  // Fallback: simple keyword search before Fuse loads (terms already defined above)
  if (!terms.length) return { results: [], query, empty: false };
  const scored = MANIFEST.map(entry => {
    const title = (entry.title || '').toLowerCase();
    const score = terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0), 0);
    return { id: entry.id, entry, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);
  return scored.length > 0
    ? { results: scored.slice(0,12), query, empty: false }
    : { results: [], suggestions: [], query, empty: true };
}
function getMatchSnippet(entry, terms) {
  // Priority: hook first (interpretive statement), then comparativeSummary, then summary
  // Returns the best matching sentence — the phrase that explains WHY this entry is relevant
  const fields = [
    entry.hook || '',
    entry.comparativeSummary || '',
    entry.summary || '',
  ];
  
  for (const text of fields) {
    // Split into sentences and find the one containing a search term
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 25);
    for (const sentence of sentences) {
      if (terms.some(t => sentence.toLowerCase().includes(t))) {
        return sentence.length > 130 ? sentence.slice(0, 127) + '…' : sentence;
      }
    }
  }
  // Fallback: first sentence of hook
  const fallback = (entry.hook || entry.summary || '').split('.')[0].trim();
  return fallback.length > 130 ? fallback.slice(0, 127) + '…' : fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function EntryCard({ id, entry, onClick, compact, snippet }) {
  const cfg = TEMPLATE_CONFIG[entry.template] || {};
  const summary = entry.summary || '';
  const accent = cfg.accent || '#555';
  return (
    <button onClick={() => onClick(id)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 7px 18px rgba(0,0,0,0.11)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}
      style={{ display:"block", width:"100%", textAlign:"left", padding: compact ? "14px 16px" : "18px 20px",
        background:C.warm, border:`1px solid ${C.border}`, borderLeft:`3px solid ${accent}`,
        borderRadius:6, cursor:"pointer", transition:"box-shadow 0.15s, transform 0.15s",
        boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom: compact ? 4 : 6 }}>
        <span style={{ padding:"2px 7px", borderRadius:2, fontSize:9, fontFamily:"'JetBrains Mono',monospace",
          fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"#fff", background:accent }}>
          {entry.template}
        </span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light, letterSpacing:"0.04em" }}>
          {entry.period}
        </span>
      </div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize: compact ? 14 : 15.5, fontWeight:700,
        color:C.text, lineHeight:1.3, marginBottom: snippet ? 6 : (compact ? 3 : 6) }}>
        {entry.title}
      </div>
      {snippet && (
        <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:accent, lineHeight:1.5,
          fontStyle:"italic", borderTop:`1px solid ${C.border}`, paddingTop:6, marginTop:2 }}>
          {snippet}
        </div>
      )}
      {!compact && !snippet && (
        <div style={{ fontFamily:"'Lora',serif", fontSize:12.5, color:C.muted, lineHeight:1.5,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
          {summary}
        </div>
      )}
    </button>
  );
}

function SearchBar({ value, onChange, onSubmit, placeholder, large }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(value); }}
      style={{ display:"flex", gap:8, width:"100%" }}>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "Search the canon…"}
        style={{ flex:1, padding: large ? "14px 18px" : "10px 14px",
          fontFamily:"'Lora',serif", fontSize: large ? 16 : 14, color:C.text,
          background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:6,
          outline:"none", boxShadow:"inset 0 1px 3px rgba(0,0,0,0.04)" }} />
      <button type="submit"
        style={{ padding: large ? "14px 22px" : "10px 16px", background:C.navy, color:"#fff",
          border:"none", borderRadius:6, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:12, letterSpacing:"0.06em" }}>
        Search
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOME VIEW
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Category icons (inline SVG, single-stroke) ──────────────────────────────
function CatIcon({ name, color = "#333", size = 22 }) {
  const paths = {
    "Events": <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    "People": <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    "Works": <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    "Concepts": <><path d="M9 18h6M10 22h4"/><path d="M15.1 14c.2-1 .7-1.7 1.4-2.5A4.6 4.6 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.8 1.2 1.5 1.4 2.5"/></>,
    "Periods": <><path d="M5 22h14M5 2h14"/><path d="M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/></>,
    "Places": <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></>,
    "Natural Phenomena": <><path d="M6 16.3A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="m13 12-3 5h4l-3 5"/></>,
    "Policy": <><path d="M16 16l3-8 3 8c-.9.6-1.9 1-3 1s-2.1-.4-3-1zM2 16l3-8 3 8c-.9.6-1.9 1-3 1s-2.1-.4-3-1zM7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></>,
    "Foundations": <><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M4 11l8-7 8 7"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || <circle cx="12" cy="12" r="9"/>}
    </svg>
  );
}

// ─── Reading levels (mirrors the entry depth system) ─────────────────────────
const READING_LEVELS = [
  { label:"Beginner",    color:"#2d5a3d" },
  { label:"General",     color:"#1e3a5f" },
  { label:"Educational", color:"#9a6a00" },
  { label:"Advanced",    color:"#5c2d6e" },
];

// ─── Per-category hero image (ONE image per category, shown on featured cards) ─
// Files live in /public/category-images/ as Title-case .png (≈3:1 banners).
// Missing images fall back to a tinted panel — nothing breaks.
const CATEGORY_SLUG = {
  "Events":"Events", "People":"People", "Works":"Works", "Concepts":"Concepts",
  "Periods":"Periods", "Places":"Places", "Natural Phenomena":"Natural",
  "Policy":"Policy", "Foundations":"Foundations",
};
const categoryImage = (template) => `/category-images/${CATEGORY_SLUG[template] || 'Events'}.webp`;

// ─── Featured card (image keyed to category; calendar rotation set later) ─────
function FeaturedCard({ id, entry, onClick }) {
  const cfg = TEMPLATE_CONFIG[entry.template] || {};
  const accent = cfg.accent || "#555";
  return (
    <button onClick={() => onClick(id)}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 7px 18px rgba(0,0,0,0.11)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}
      style={{ display:"flex", flexDirection:"column", textAlign:"left", padding:0, overflow:"hidden",
        background:C.warm, border:`1px solid ${C.border}`, borderTop:`3px solid ${accent}`,
        borderRadius:8, cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.06)",
        transition:"box-shadow 0.15s, transform 0.15s" }}>
      <div style={{ width:"100%", aspectRatio:"3 / 1",
        background:`linear-gradient(135deg, ${accent}26, ${accent}0a)`, borderBottom:`1px solid ${C.border}` }}>
        <img src={categoryImage(entry.template)} alt=""
          onError={e => { e.currentTarget.style.display = 'none'; }}
          style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
      <div style={{ padding:"14px 16px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ padding:"2px 7px", borderRadius:2, fontSize:9, fontFamily:"'JetBrains Mono',monospace",
            fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"#fff", background:accent }}>
            {entry.template}
          </span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light }}>{entry.period}</span>
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700,
          color:C.text, lineHeight:1.25, marginBottom:6 }}>{entry.title}</div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:12.5, color:C.muted, lineHeight:1.5,
          display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
          {entry.summary}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9.5, color:C.light,
            letterSpacing:"0.04em" }}>4 reading levels</span>
          <span style={{ fontFamily:"'Lora',serif", fontSize:12.5, fontWeight:500, color:accent }}>Read entry →</span>
        </div>
      </div>
    </button>
  );
}

// ─── Featured Entries — calendar engine (weekly pathway + daily/floating override) ──
function centralTodayParts() {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' });
  const p = {}; for (const x of fmt.formatToParts(new Date())) p[x.type] = x.value;
  return { y: +p.year, m: p.month, d: p.day };
}
function isoWeekOf(y, mm, dd) {
  const date = new Date(Date.UTC(y, +mm - 1, +dd));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3); // nearest Thursday
  const firstThu = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((date - firstThu) / 604800000);
}
function getFeatured() {
  if (!CALENDAR || !CALENDAR.weeks) return null;
  let { y, m, d } = centralTodayParts();
  // ?day=MM-DD (or YYYY-MM-DD) previews any date's featured selection
  const ov = typeof location !== 'undefined' && new URLSearchParams(location.search).get('day');
  if (ov && /^(\d{4}-)?\d{2}-\d{2}$/.test(ov)) {
    const p = ov.split('-');
    if (p.length === 3) { y = +p[0]; m = p[1]; d = p[2]; } else { m = p[0]; d = p[1]; }
  }
  const md = `${m}-${d}`;
  const wk = Math.min(52, Math.max(1, isoWeekOf(y, m, d)));
  const weekObj = CALENDAR.weeks.find(w => w.week === wk) || CALENDAR.weeks[0];
  const floats = (CALENDAR.floating && CALENDAR.floating[String(y)]) || [];
  const todays = [...floats, ...(CALENDAR.daily || [])].filter(o => o.md === md);
  for (const o of todays) {
    if (o.suppressIfTheme && o.suppressIfTheme.includes(weekObj.theme)) continue; // covered by this week
    if (!o.entryId) continue;                                                      // [BUILD]/planned — inactive
    const entry = MANIFEST.find(e => e.id === o.entryId);
    if (entry) return { mode:'daily', override:o, entry };
  }
  const cards = (weekObj.cards || []).map(id => MANIFEST.find(e => e.id === id)).filter(Boolean);
  return { mode:'weekly', week:weekObj, cards };
}

// ─── Q&A OF THE WEEK ────────────────────────────────────────────────────────
// Data-driven and archive-ready: each week is an object in QA_WEEKLY (newest
// first). The seal/modal always shows QA_WEEKLY[0]. To rotate, PREPEND a new
// object — old weeks are retained for a future "past questions" archive.
// answer = ordered blocks: { p } paragraph (supports **bold**), { pull } a
// pull-quote line, { lifecycleLabel, lifecycle:[[label,body],…] } the steps.
// Mark the final paragraph with top:true for the divider rule.
const QA_WEEKLY = [
  {
    week: "2026-06-09",
    originId: "georgeWashington",
    originTitle: "George Washington",
    title: "On virtue, custom, and law",
    question: "Washington set the two-term precedent through personal choice rather than legal requirement. Franklin Roosevelt broke it in a national crisis. Congress then constitutionalized it. What does this sequence tell you about the relationship between personal virtue, unwritten norms, and formal constitutional rules? Can a republic rely on founding figures to supply the restraint its laws do not demand?",
    answer: [
      { p: "It tells us that republics often begin by **depending on character**, then try to convert that character into **custom**, and finally, when custom proves vulnerable, into **law**." },
      { p: "Washington's two-term retirement mattered because the Constitution did **not** force him to leave. That was the point. His restraint dramatized the difference between a republic and a monarchy: power was something a citizen temporarily held, not something a great man naturally possessed. The precedent worked because Washington's personal virtue became an unwritten constitutional norm." },
      { p: "But Franklin Roosevelt exposed the weakness of that arrangement. He did not \"violate the Constitution.\" He violated a **tradition**, and he did so under conditions where many Americans believed the tradition should yield to emergency: first the Great Depression, then World War II. Unwritten norms are strongest when circumstances feel normal. In crisis, people often ask not \"What restraint did Washington model?\" but \"Who can get us through this?\"" },
      { p: "Congress and the states then constitutionalized the limit through the Twenty-Second Amendment. That move says: **we no longer trust example alone to do the work.**" },
      { lifecycleLabel: "A constitutional lifecycle", lifecycle: [
        ["Virtue creates the norm.", "Washington shows what republican restraint looks like."],
        ["Custom preserves the norm.", "Later presidents follow the example because violating it would seem dangerous, vain, or un-republican."],
        ["Crisis tests the norm.", "FDR proves that a strong enough justification, paired with popular support, can overwhelm tradition."],
        ["Law replaces the norm.", "The Twenty-Second Amendment turns an expectation into an enforceable boundary."],
      ] },
      { p: "The deeper lesson is not that virtue is irrelevant. It is that virtue is **too fragile to be the only guardrail**. A republic needs citizens and leaders with self-restraint, because no constitution can anticipate every abuse. But it also needs formal rules, because personal restraint is unevenly distributed, and the most talented leaders are often the ones most able to persuade people that exceptions should be made for them." },
      { p: "So, can a republic rely on founding figures to supply the restraint its laws do not demand?" },
      { pull: "Only at the beginning, and only imperfectly." },
      { p: "Founders can set a moral pattern. They can give later generations a vocabulary of restraint. But they cannot permanently govern from memory. Once the founding generation is gone, the republic has to decide whether its norms are strong enough to remain unwritten. If they are not, it must either formalize them or watch them become optional." },
      { p: "The Washington–FDR–Twenty-Second Amendment sequence is therefore a quiet warning: **a republic that depends entirely on great men behaving modestly has already left too much to chance.**", top: true },
    ],
  },
];
const QA_OF_WEEK = QA_WEEKLY[0];

// Render a plain string with **bold** segments as JSX.
function qaInline(text) {
  return text.split("**").map((seg, i) => (i % 2 ? <strong key={i}>{seg}</strong> : seg));
}

function WaxSeal({ size = 116 }) {
  return (
    <svg className="wax-seal-svg" width={size} height={size} viewBox="0 0 120 120"
      role="img" aria-hidden="true"
      style={{ filter: "drop-shadow(0 3px 5px rgba(70,12,20,0.34))", display: "block", overflow: "visible" }}>
      <defs>
        <radialGradient id="waxGrad" cx="40%" cy="33%" r="72%">
          <stop offset="0%" stopColor="#cf3c50" />
          <stop offset="52%" stopColor="#b3243a" />
          <stop offset="100%" stopColor="#871728" />
        </radialGradient>
        <filter id="waxWobble" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6.5" />
        </filter>
        <path id="waxRimTop" d="M60,60 m0,-39 a39,39 0 1,1 -0.01,0" fill="none" />
      </defs>
      <g transform="rotate(-7 60 60)">
        <circle cx="60" cy="60" r="46" fill="url(#waxGrad)" filter="url(#waxWobble)" />
        <ellipse cx="48" cy="42" rx="20" ry="13" fill="#ffffff" opacity="0.10" />
        <circle cx="60" cy="60" r="40.5" fill="none" stroke="#5e0e1c" strokeOpacity="0.45" strokeWidth="1.1" />
        <circle cx="60" cy="60" r="38" fill="none" stroke="#e9d3a6" strokeOpacity="0.30" strokeWidth="0.8" />
        <text fontFamily="'Lora',serif" fontSize="7.2" fontWeight="600" letterSpacing="1.9" fill="#ecd5a3">
          <textPath href="#waxRimTop" startOffset="2%">QUESTION &amp; ANSWER · OF THE WEEK ·</textPath>
        </text>
        <text x="60" y="59" textAnchor="middle" fontFamily="'DM Serif Display',serif" fontSize="25" fill="#f5e9d2">Q&amp;A</text>
        <text x="60" y="73" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="6.4" letterSpacing="1.6" fill="#e7cf9e">EDUCATION</text>
      </g>
    </svg>
  );
}

function QAModal({ qa, onClose, onEntry }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const num = { flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: "#b3243a",
    color: "#fff", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, display: "flex",
    alignItems: "center", justifyContent: "center", marginTop: 1 };
  const lab = { fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.12em",
    textTransform: "uppercase", color: C.light, marginBottom: 12 };
  return (
    <div className="qa-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(28,25,23,0.55)", zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "5vh 16px", overflowY: "auto" }}>
      <div className="qa-modal-card" onClick={e => e.stopPropagation()}
        style={{ background: C.bg, maxWidth: 680, width: "100%", borderRadius: 14, border: `1px solid ${C.border}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)", position: "relative", overflow: "hidden", marginBottom: 40 }}>
        <div style={{ background: "#b3243a", padding: "18px 26px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flexShrink: 0 }}><WaxSeal size={54} /></div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#f3d9a0" }}>Question &amp; Answer of the Week</div>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 22, color: "#fff", lineHeight: 1.15, marginTop: 3 }}>{qa.title}</div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ position: "absolute", top: 12, right: 14, background: "rgba(255,255,255,0.16)", border: "none",
              color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "20px 26px 28px" }}>
          <div style={{ fontFamily: "'Lora',serif", fontSize: 13, color: C.muted, marginBottom: 16 }}>
            From the{" "}
            <button onClick={() => { onClose(); onEntry(qa.originId); }}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9a6a00",
                fontFamily: "'Lora',serif", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>
              {qa.originTitle}
            </button>{" "}entry's <strong style={{ color: C.text, fontWeight: 600 }}>Educational layer</strong> — a section built around questions to think through, not facts to memorize.
          </div>

          <div style={{ borderLeft: "3px solid #b3243a", background: C.warm, padding: "14px 18px", borderRadius: "0 8px 8px 0", marginBottom: 22 }}>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b3243a", marginBottom: 7 }}>The Question</div>
            <p style={{ fontFamily: "'Lora',serif", fontStyle: "italic", fontSize: 15.5, lineHeight: 1.6, color: C.text }}>{qa.question}</p>
          </div>

          <div className="qa-answer" style={{ fontFamily: "'Lora',serif", fontSize: 15, lineHeight: 1.72, color: C.text }}>
            {qa.answer.map((b, i) => {
              if (b.lifecycle) return (
                <div key={i}>
                  <div style={lab}>{b.lifecycleLabel}</div>
                  <ol style={{ listStyle: "none", padding: 0, margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                    {b.lifecycle.map(([label, body], j) => (
                      <li key={j} style={{ display: "flex", gap: 12 }}>
                        <span style={num}>{j + 1}</span>
                        <span><strong style={{ color: "#8c1a2c", fontWeight: 600 }}>{label}</strong> {body}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
              if (b.pull) return (
                <p key={i} style={{ fontFamily: "'DM Serif Display',serif", fontSize: 18, color: "#8c1a2c", margin: "0 0 14px" }}>{b.pull}</p>
              );
              return (
                <p key={i} style={ b.top
                  ? { marginBottom: 0, paddingTop: 14, borderTop: `1px solid ${C.border}` }
                  : { marginBottom: 14 } }>{qaInline(b.p)}</p>
              );
            })}
          </div>

          <button onClick={() => { onClose(); onEntry(qa.originId); }}
            style={{ marginTop: 22, fontFamily: "'Playfair Display',serif", fontSize: 14.5, color: "#fff", background: C.navy,
              border: "none", borderRadius: 6, padding: "11px 22px", cursor: "pointer" }}>
            Explore {qa.originTitle}'s Education layer  →
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeView({ onSearch, onTemplate, onEntry, onBrowse }) {
  const isMobile = useIsMobile();
  const isWide = !useIsMobile(960);   // ≥960px: content column is a fixed 880, room to nudge the seal right
  const [showQA, setShowQA] = useState(false);

  const totalEntries = MANIFEST.length;

  const featured = getFeatured();

  return (
    <main id="main-content" style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "24px 14px 60px" : "40px 40px 80px" }}>

      {showQA && <QAModal qa={QA_OF_WEEK} onClose={() => setShowQA(false)} onEntry={onEntry} />}

      {/* Platform statement */}
      <div style={{ textAlign:"center", marginBottom:36, position:"relative" }}>
        {!isMobile && (
          <button onClick={() => setShowQA(true)} className="wax-seal-btn"
            aria-label="Open the Question and Answer of the Week"
            title="Question &amp; Answer of the Week"
            style={{ position:"absolute", left: isWide ? 150 : -4, top: isWide ? "87%" : "83%",
              transform:"translateY(-50%)", zIndex:3,
              background:"none", border:"none", padding:0, cursor:"pointer" }}>
            <WaxSeal size={120} />
          </button>
        )}
        <img src="/tcp_logo_transparent.webp" alt="TheCommonPlace logo"
          style={{ display:"block", margin:"0 auto 6px", width:"340px", maxWidth:"86%", objectFit:"contain" }} />
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize: isMobile ? 34 : 50, fontWeight:400,
          color:C.text, lineHeight:1, letterSpacing:"-0.01em", margin:"0 auto 18px" }}>
          TheCommonPlace
        </h1>
        <p style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:600, color:"#9a6a00",
          lineHeight:1.35, maxWidth:660, margin:"0 auto 16px" }}>
          {totalEntries} pathways through the ideas, people, events, and forces that built the world.
        </p>
        <p style={{ fontFamily:"'Lora',serif", fontSize:15.5, color:C.muted, lineHeight:1.8,
          maxWidth:600, margin:"0 auto" }}>
          How a mosquito defeated an empire. Why debt existed before money.<br/>Who reforested a continent without planting a single tree.
        </p>
        <div style={{ marginTop:26, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
          <button onClick={() => onBrowse()}
            style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", background:C.navy,
              border:"none", borderRadius:6, padding:"13px 32px", cursor:"pointer", letterSpacing:"0.01em",
              boxShadow:"0 2px 6px rgba(36,52,71,0.25)" }}>
            Start exploring  →
          </button>
          <button onClick={() => {
            const published = MANIFEST.filter(e => e.status === 'published');
            const random = published[Math.floor(Math.random() * published.length)];
            if (random) onEntry(random.id);
          }}
            style={{ fontFamily:"'Lora',serif", fontSize:13.5, fontStyle:"italic", color:C.navy,
              background:"transparent", border:"none", cursor:"pointer", padding:"2px 6px" }}>
            Prefer a hint of whimsy? Chase the rabbit →
          </button>
        </div>
      </div>

      {isMobile && (
        <div style={{ display:"flex", justifyContent:"center", marginBottom:34, marginTop:-6 }}>
          <button onClick={() => setShowQA(true)} className="wax-seal-btn"
            aria-label="Open the Question and Answer of the Week"
            title="Question &amp; Answer of the Week"
            style={{ background:"none", border:"none", padding:0, cursor:"pointer" }}>
            <WaxSeal size={104} />
          </button>
        </div>
      )}

      {/* Explore by thread — search shortcuts (not filters) */}
      <div style={{ textAlign:"center", marginBottom:44 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600,
          letterSpacing:"0.12em", textTransform:"uppercase", color:C.light, marginBottom:13 }}>
          Explore by thread
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:8,
          maxWidth:700, margin:"0 auto" }}>
          {THREADS.map(t => (
            <button key={t} onClick={() => onSearch(t)}
              style={{ fontFamily:"'Lora',serif", fontSize:13.5, color:C.navy, background:"transparent",
                border:`1px solid ${C.borderStrong}`, borderRadius:20, padding:"5px 15px",
                cursor:"pointer", transition:"all 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#9a6a00"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#9a6a00"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.navy; e.currentTarget.style.borderColor = C.borderStrong; }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Reading levels */}
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"center",
        gap:"10px 18px", background:C.warm, border:`1px solid ${C.border}`, borderRadius:10,
        padding:"16px 22px", marginBottom:48, boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}>
        <span style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.text }}>
          Every entry has <strong style={{ fontWeight:600 }}>four reading levels</strong>
        </span>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {READING_LEVELS.map(l => (
            <span key={l.label} style={{ display:"inline-flex", alignItems:"center", gap:6,
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:l.color,
              border:`1px solid ${l.color}55`, borderRadius:20, padding:"5px 12px" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:l.color }} />
              {l.label}
            </span>
          ))}
        </div>
        <span style={{ flexBasis:"100%", textAlign:"center", fontFamily:"'Lora',serif", fontSize:12.5,
          color:C.light, fontStyle:"italic" }}>
          Choose the depth that fits you. Grow your understanding at your own pace.
        </span>
      </div>

      {/* Category grid */}
      <section id="browse-categories" aria-label="Browse by category"
        style={{ marginBottom:52, scrollMarginTop:70 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:"0.12em",
          textTransform:"uppercase", color:"#9a6a00", marginBottom:6 }}>
          Browse by category
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:C.text }}>
            Find what fascinates you
          </h2>
          <div style={{ flex:1, height:1, background:"linear-gradient(to right, #c8a96e, rgba(200,169,110,0.12))" }} />
          <span aria-hidden="true" style={{ color:"#9a6a00", fontSize:13, lineHeight:1, marginLeft:-4 }}>✦</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap:12 }}>
          {Object.entries(TEMPLATE_CONFIG).filter(([_, cfg]) => cfg.active).map(([name, cfg]) => {
            const meta = TEMPLATE_META[name] || {};
            const count = MANIFEST.filter(e => e.template === name).length;
            return (
              <button key={name} onClick={() => onTemplate(name)}
                aria-label={`Browse ${name} — ${count} entries`}
                style={{ display:"flex", gap:14, padding:"18px 18px", background:C.warm,
                  border:`1px solid ${C.border}`, borderTop:`3px solid ${cfg.accent}`, borderRadius:8,
                  cursor:"pointer", textAlign:"left", transition:"box-shadow 0.15s, transform 0.15s",
                  boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 7px 18px rgba(0,0,0,0.11)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}>
                <span style={{ flexShrink:0, width:42, height:42, borderRadius:"50%",
                  display:"flex", alignItems:"center", justifyContent:"center", background:`${cfg.accent}14` }}>
                  <CatIcon name={name} color={cfg.accent} size={21} />
                </span>
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontFamily:"'Playfair Display',serif", fontSize:15.5, fontWeight:700, color:C.text }}>
                      {name}
                    </span>
                    <span aria-hidden="true" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                      color:C.muted, background:C.bg, padding:"2px 8px", borderRadius:10 }}>
                      {count}
                    </span>
                  </span>
                  <span style={{ display:"block", fontFamily:"'Lora',serif", fontSize:12.5, color:C.muted, lineHeight:1.5 }}>
                    {meta.question || ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Entries — calendar-driven: weekly pathway, or daily/floating override */}
      {featured && (
        <section aria-label="Featured entries">
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600, letterSpacing:"0.12em",
            textTransform:"uppercase", color:"#9a6a00", marginBottom:6 }}>
            Featured Entries
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:C.text, whiteSpace:"nowrap" }}>
              {featured.mode === 'daily' ? 'On This Day' : 'This Week in The Commonplace'}
            </h2>
            <div style={{ flex:1, height:1, background:"linear-gradient(to right, #c8a96e, rgba(200,169,110,0.12))" }} />
            <span aria-hidden="true" style={{ color:"#9a6a00", fontSize:13, lineHeight:1, marginLeft:-4 }}>✦</span>
          </div>

          {featured.mode === 'daily' ? (
            <>
              {featured.override.salutation && (
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, fontWeight:600, color:"#9a6a00", marginBottom:4 }}>
                  {featured.override.salutation}
                </div>
              )}
              <div style={{ fontFamily:"'Lora',serif", fontSize:17, fontStyle:"italic", color:C.text }}>
                {featured.override.label}
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:C.light, letterSpacing:"0.04em", marginBottom:16 }}>
                {featured.override.dateLabel}
              </div>
              <div style={{ maxWidth: isMobile ? "none" : 430 }}>
                <FeaturedCard id={featured.entry.id} entry={featured.entry} onClick={onEntry} />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom:6 }}>
                <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:C.text }}>{featured.week.theme}</span>
                <span style={{ fontFamily:"'Lora',serif", fontSize:14.5, fontStyle:"italic", color:C.muted }}>{' — ' + featured.week.hook}</span>
              </div>
              {featured.week.anchor && (
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.07em",
                  textTransform:"uppercase", color:"#9a6a00", marginBottom:18 }}>
                  Why this week&nbsp;·&nbsp;{featured.week.anchor}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap:14 }}>
                {featured.cards.map(c => <FeaturedCard key={c.id} id={c.id} entry={c} onClick={onEntry} />)}
              </div>
            </>
          )}
        </section>
      )}

    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE GALLERY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Reader-facing facet derivations (all computed from existing fields) ──────

// Era — 6 buckets from startYear (Classical folded into Ancient)
const ERAS = [
  { key:"Prehistory",   max:-3000 },   // before 3000 BCE
  { key:"Ancient",      max:500   },   // 3000 BCE – 500 CE
  { key:"Medieval",     max:1500  },   // 500 – 1500
  { key:"Early Modern", max:1800  },   // 1500 – 1800
  { key:"Modern",       max:1945  },   // 1800 – 1945
  { key:"Contemporary", max:Infinity },// 1945 – present
];
function eraOf(year) {
  if (year == null) return null;
  for (const e of ERAS) if (year < e.max) return e.key;
  return "Contemporary";
}
const ERA_ORDER = ERAS.reduce((m, e, i) => { m[e.key] = i; return m; }, {});

// Region — collapse granular stored regions into 7 reader-facing buckets (display only)
const REGION_DISPLAY = {
  "Europe":"Europe", "The Americas":"The Americas",
  "North Africa & Middle East":"Middle East & North Africa",
  "Sub-Saharan Africa":"Sub-Saharan Africa",
  "East Asia":"East Asia", "Southeast Asia":"East Asia", "Central Asia & the Steppe":"East Asia",
  "South Asia":"South Asia",
  "Oceania":"Global / Transregional", "Global / Transregional":"Global / Transregional",
};
const REGION_ORDER = {
  "Europe":0, "The Americas":1, "Middle East & North Africa":2,
  "East Asia":3, "South Asia":4, "Sub-Saharan Africa":5, "Global / Transregional":6,
};
const displayRegions = (regions) => [...new Set((regions || []).map(r => REGION_DISPLAY[r] || r))];

// Connectedness — buckets from degree
function connOf(d) { return d == null ? null : d >= 30 ? "Major hub" : d >= 12 ? "Well connected" : "Specialized"; }
const CONN_ORDER = { "Major hub":0, "Well connected":1, "Specialized":2 };

// Duration — buckets from startYear/endYear
function durationOf(e) {
  if (e.startYear == null || e.endYear == null) return null;
  const span = e.endYear - e.startYear;
  if (e.endYear >= 2000 && span > 10) return "Ongoing";      // runs to present
  if (span === 0) return "Single event";
  if (span <= 10) return "Under a decade";
  if (span <= 150) return "Decades";
  return "Centuries";
}
const DUR_ORDER = { "Single event":0, "Under a decade":1, "Decades":2, "Centuries":3, "Ongoing":4 };

// Entry shape — friendly 1:1 relabel of subtype (editor jargon → reader words)
const SHAPE_LABEL = {
  "Extended Process":"Long Transformation", "Threshold Moment":"Turning Point",
  "Threshold Moment — Restructured":"Turning Point", "Discrete Event":"Single Event",
  "Movement":"Movement", "Period":"Period",
  "Historical Actor":"Figure", "Thinker":"Thinker", "Creative Figure":"Creator",
  "Material Foundation":"Material", "Conceptual Foundation":"Idea", "Biological Foundation":"Organism",
  "Normative Concept":"Ideal", "Analytical Concept":"Analytical lens",
  "Site":"Place", "System":"System", "Natural Event":"Event", "Natural Force":"Force",
  "Policy Question":"Open Question", "Policy Landscape":"Landscape",
};
const shapeOf = (st) => SHAPE_LABEL[st] || st;

// Threads — search shortcuts (NOT filters); clicking runs the existing search
const THREADS = ["War","Empire","Religion","Science","Trade","Democracy","Slavery",
  "Capitalism","Colonialism","Technology","Philosophy","Migration","Disease","Agriculture","Literature"];

function FilterChip({ label, count, active, disabled, accent, onClick }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ padding:"5px 11px", borderRadius:14, cursor: disabled ? "default" : "pointer",
        fontFamily:"'JetBrains Mono',monospace", fontSize:10.5, letterSpacing:"0.02em",
        border:`1px solid ${active ? accent : C.border}`,
        background: active ? accent : C.surface,
        color: active ? "#fff" : (disabled ? C.light : C.muted),
        opacity: disabled ? 0.45 : 1, transition:"all 0.12s", whiteSpace:"nowrap" }}>
      {label}{count != null && <span style={{ opacity:0.6, marginLeft:5 }}>{count}</span>}
    </button>
  );
}

// Disjunctive faceting: chips show contextual counts; a 0-count option (given the
// OTHER active filters) is disabled so you can never click into a dead end.
function FacetRow({ title, keys, counts, selected, accent, onToggle }) {
  if (!keys || keys.length <= 1) return null; // no point filtering on a single value
  return (
    <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap", marginTop:12 }}>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.1em",
        textTransform:"uppercase", color:C.light, minWidth:54, paddingTop:2 }}>{title}</span>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {keys.map(k => {
          const c = counts[k] || 0;
          const active = selected.has(k);
          return (
            <FilterChip key={k} label={k} count={c} active={active}
              disabled={c === 0 && !active} accent={accent} onClick={() => onToggle(k)} />
          );
        })}
      </div>
    </div>
  );
}

const CATEGORY_ORDER = Object.keys(TEMPLATE_CONFIG).reduce((m, k, i) => { m[k] = i; return m; }, {});

// Shared filterable/sortable grid. Used by both the category page and Browse-everything.
function EntryBrowser({ entries, accent, showCategory, placeholder, pageSize, onEntry }) {
  const isMobile = useIsMobile();
  const all = entries;

  const [sort, setSort]     = React.useState('az');
  const [text, setText]     = React.useState('');
  const [catF, setCatF]     = React.useState(() => new Set());
  const [eraF, setEraF]     = React.useState(() => new Set());
  const [regF, setRegF]     = React.useState(() => new Set());
  const [shapeF, setShapeF] = React.useState(() => new Set());
  const [durF, setDurF]     = React.useState(() => new Set());
  const [showMore, setShowMore] = React.useState(false);
  const [shuffleMap, setShuffleMap] = React.useState({});
  const [visible, setVisible] = React.useState(pageSize);

  // reset all filters when the entry set changes (category switch / view switch)
  React.useEffect(() => {
    setSort('az'); setText(''); setShowMore(false); setVisible(pageSize);
    setCatF(new Set()); setEraF(new Set()); setRegF(new Set()); setShapeF(new Set()); setDurF(new Set());
  }, [entries, pageSize]);

  const matchText = (e) => {
    const q = text.trim().toLowerCase();
    return !q || (e.title || '').toLowerCase().includes(q) || (e.summary || '').toLowerCase().includes(q);
  };
  // one predicate per facet (within a facet = OR; across facets = AND)
  const preds = {
    cat:    (e) => !showCategory || !catF.size || catF.has(e.template),
    era:    (e) => !eraF.size   || eraF.has(eraOf(e.startYear)),
    region: (e) => !regF.size   || displayRegions(e.regions).some(r => regF.has(r)),
    shape:  (e) => !shapeF.size || shapeF.has(shapeOf(e.subtype)),
    dur:    (e) => !durF.size   || durF.has(durationOf(e)),
  };
  // entries passing text + every facet EXCEPT the named one → for disjunctive counts
  const passingExcept = (except) =>
    all.filter(e => matchText(e) && Object.keys(preds).every(k => k === except || preds[k](e)));

  const countMap = (rows, getVal) => {
    const m = {};
    for (const e of rows) for (const v of [].concat(getVal(e) || [])) if (v != null) m[v] = (m[v] || 0) + 1;
    return m;
  };
  const catCounts   = showCategory ? countMap(passingExcept('cat'), e => e.template) : {};
  const eraCounts   = countMap(passingExcept('era'),    e => eraOf(e.startYear));
  const regCounts   = countMap(passingExcept('region'), e => displayRegions(e.regions));
  const shapeCounts = countMap(passingExcept('shape'),  e => shapeOf(e.subtype));
  const durCounts   = countMap(passingExcept('dur'),    e => durationOf(e));

  // full ordered vocabulary per facet (so 0-count options still render, greyed)
  const vocab = (getVal) => {
    const s = new Set();
    for (const e of all) for (const v of [].concat(getVal(e) || [])) if (v != null) s.add(v);
    return [...s];
  };
  const shapeTotals = countMap(all, e => shapeOf(e.subtype));
  const catKeys   = showCategory ? vocab(e => e.template).sort((a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)) : [];
  const eraKeys   = vocab(e => eraOf(e.startYear)).sort((a, b) => ERA_ORDER[a] - ERA_ORDER[b]);
  const regKeys   = vocab(e => displayRegions(e.regions)).sort((a, b) => (REGION_ORDER[a] ?? 9) - (REGION_ORDER[b] ?? 9));
  const shapeKeys = vocab(e => shapeOf(e.subtype)).sort((a, b) => (shapeTotals[b] || 0) - (shapeTotals[a] || 0));
  const durKeys   = vocab(e => durationOf(e)).sort((a, b) => DUR_ORDER[a] - DUR_ORDER[b]);

  const toggle = (set, setter) => (v) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n);
  };

  const titleKey = t => (t || '').replace(/^the\s+/i, '').toLowerCase();
  const sorted = all
    .filter(e => matchText(e) && Object.values(preds).every(p => p(e)))
    .sort((a, b) => {
      if (sort === 'chrono')  return (a.startYear ?? 0) - (b.startYear ?? 0);
      if (sort === 'recent')  return (b.added || '').localeCompare(a.added || '') || titleKey(a.title).localeCompare(titleKey(b.title));
      if (sort === 'shuffle') return (shuffleMap[a.id] ?? 0) - (shuffleMap[b.id] ?? 0);
      return titleKey(a.title).localeCompare(titleKey(b.title));
    });
  const shown = sorted.slice(0, visible);

  // reset paging whenever the filter/sort signature changes
  React.useEffect(() => { setVisible(pageSize); }, [text, sort, catF, eraF, regF, shapeF, durF]); // eslint-disable-line

  const anyFilter = catF.size + eraF.size + regF.size + shapeF.size + durF.size + (text.trim() ? 1 : 0);
  const clearAll = () => {
    setCatF(new Set()); setEraF(new Set()); setRegF(new Set()); setShapeF(new Set()); setDurF(new Set()); setText('');
  };
  const hasPrimary = (showCategory && catKeys.length > 1) || eraKeys.length > 1 || regKeys.length > 1;
  const hasMore = shapeKeys.length > 1 || durKeys.length > 1;

  return (
    <>
      {/* Filter / sort panel */}
      <div style={{ background:C.warm, border:`1px solid ${C.border}`, borderRadius:8,
        padding:"15px 18px", marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
          <input value={text} onChange={e => setText(e.target.value)}
            placeholder={placeholder || "Filter…"}
            style={{ flex:"1 1 200px", padding:"8px 12px", fontFamily:"'Lora',serif", fontSize:13.5,
              color:C.text, background:C.surface, border:`1px solid ${C.border}`, borderRadius:6,
              outline:"none" }} />
          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"0.1em",
              textTransform:"uppercase", color:C.light }}>Sort</span>
            {[['az','A–Z'], ['chrono','Chronological'], ['recent','Recently Added'], ['shuffle','Shuffle']].map(([k, lbl]) => (
              <FilterChip key={k} label={lbl} active={sort === k} accent={C.navy}
                onClick={() => { if (k === 'shuffle') { const m = {}; for (const e of all) m[e.id] = Math.random(); setShuffleMap(m); } setSort(k); }} />
            ))}
          </div>
        </div>
        {hasPrimary && (
          <div style={{ borderTop:`1px solid ${C.border}`, marginTop:12, paddingTop:2 }}>
            {showCategory && <FacetRow title="Category" keys={catKeys} counts={catCounts} selected={catF} accent={accent} onToggle={toggle(catF, setCatF)} />}
            <FacetRow title="Era"    keys={eraKeys} counts={eraCounts} selected={eraF} accent={accent} onToggle={toggle(eraF, setEraF)} />
            <FacetRow title="Region" keys={regKeys} counts={regCounts} selected={regF} accent={accent} onToggle={toggle(regF, setRegF)} />
          </div>
        )}
        {hasMore && (
          <div style={{ marginTop:12 }}>
            <button onClick={() => setShowMore(v => !v)}
              style={{ background:"none", border:"none", cursor:"pointer", padding:0,
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.08em",
                textTransform:"uppercase", color:C.muted }}>
              {showMore ? "Less ▴" : "More filters ▾"}
            </button>
            {showMore && (
              <div>
                <FacetRow title="Duration"    keys={durKeys}   counts={durCounts}   selected={durF}   accent={accent} onToggle={toggle(durF, setDurF)} />
                <FacetRow title="Shape"       keys={shapeKeys} counts={shapeCounts} selected={shapeF} accent={accent} onToggle={toggle(shapeF, setShapeF)} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result count + clear */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}{anyFilter ? ` of ${all.length}` : ''}
        </span>
        {anyFilter ? (
          <button onClick={clearAll}
            style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
              fontSize:10, color:accent, textDecoration:"underline" }}>
            clear filters
          </button>
        ) : null}
      </div>

      {/* Entry grid */}
      {sorted.length ? (
        <>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap:10 }}>
            {shown.map(e => (
              <EntryCard key={e.id} id={e.id} entry={e} onClick={onEntry} />
            ))}
          </div>
          {visible < sorted.length && (
            <div style={{ textAlign:"center", marginTop:26 }}>
              <button onClick={() => setVisible(v => v + pageSize)}
                style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.06em",
                  color:C.navy, background:C.surface, border:`1px solid ${C.borderStrong}`,
                  borderRadius:6, padding:"10px 24px", cursor:"pointer" }}>
                Load more  ·  {sorted.length - visible} more
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ padding:"48px 20px", textAlign:"center", fontFamily:"'Lora',serif",
          fontSize:14.5, color:C.muted, fontStyle:"italic" }}>
          No entries match these filters.{' '}
          <button onClick={clearAll}
            style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'Lora',serif",
              fontSize:14.5, fontStyle:"italic", color:accent, textDecoration:"underline" }}>
            Clear them?
          </button>
        </div>
      )}
    </>
  );
}

// ─── Category page = header + browser scoped to one category ─────────────────
function TemplateGallery({ templateName, onEntry, onHome }) {
  const isMobile = useIsMobile();
  const cfg = TEMPLATE_CONFIG[templateName] || {};
  const meta = TEMPLATE_META[templateName] || {};
  const accent = cfg.accent || '#555';
  const all = React.useMemo(() => MANIFEST.filter(e => e.template === templateName), [templateName]);

  return (
    <div style={{ maxWidth:980, margin:"0 auto", padding: isMobile ? "20px 14px 60px" : "32px 40px 80px" }}>
      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:24,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>
      <div style={{ borderLeft:`4px solid ${accent}`, paddingLeft:20, marginBottom:24 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
          textTransform:"uppercase", color:accent, marginBottom:6 }}>
          {templateName} · {all.length} {all.length === 1 ? 'entry' : 'entries'}
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700,
          color:C.text, marginBottom:8 }}>
          {meta.desc || templateName}
        </div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic",
          lineHeight:1.6 }}>
          {meta.question}
        </div>
      </div>
      <EntryBrowser entries={all} accent={accent} showCategory={false}
        placeholder={`Filter ${templateName}…`} pageSize={9999} onEntry={onEntry} />
    </div>
  );
}

// ─── Browse everything = all entries with Category as the first facet ────────
function BrowseAllView({ onEntry, onHome }) {
  const isMobile = useIsMobile();
  const all = React.useMemo(() => MANIFEST.slice(), []);
  return (
    <div style={{ maxWidth:980, margin:"0 auto", padding: isMobile ? "20px 14px 60px" : "32px 40px 80px" }}>
      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:24,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>
      <div style={{ borderLeft:"4px solid #9a6a00", paddingLeft:20, marginBottom:24 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
          textTransform:"uppercase", color:"#9a6a00", marginBottom:6 }}>
          Browse everything · {all.length} entries
        </div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700,
          color:C.text, marginBottom:8 }}>
          The whole canon, filtered your way
        </div>
        <div style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic",
          lineHeight:1.6 }}>
          Every entry, across all categories. Narrow by category, time, and place — or chase a thread from the home page.
        </div>
      </div>
      <EntryBrowser entries={all} accent="#9a6a00" showCategory={true}
        placeholder={`Filter all ${all.length} entries…`} pageSize={60} onEntry={onEntry} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function SearchResultsView({ initialQuery, onEntry, onHome, onSearch }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState(() => searchEntries(initialQuery));

  const handleSearch = (q) => {
    setQuery(q);
    setResults(searchEntries(q));
  };

  const totalEntries = MANIFEST.length;

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "20px 14px 60px" : "32px 40px 80px" }}>

      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:28,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>

      <div style={{ marginBottom:32 }}>
        <SearchBar value={query} onChange={setQuery} onSubmit={handleSearch} large={false} />
      </div>

      {/* Results found */}
      {!results.empty && results.results.length > 0 && (
        <div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.1em",
            textTransform:"uppercase", color:C.light, marginBottom:16 }}>
            {results.results.length} result{results.results.length !== 1 ? 's' : ''} for "{results.query}"
          </div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap:10 }}>
            {results.results.map(({ id, entry, snippet }) => (
              <EntryCard key={id} id={id} entry={entry} onClick={onEntry} snippet={snippet} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.empty && (
        <div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8,
            padding:"32px 36px", marginBottom:32 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700,
              color:C.text, marginBottom:12 }}>
              "{results.query}" isn't in the canon yet.
            </div>
            <p style={{ fontFamily:"'Lora',serif", fontSize:14.5, color:C.muted, lineHeight:1.7,
              marginBottom:12 }}>
              TheCommonPlace covers {totalEntries} subjects currently — and is building toward approximately 7,000. Every entry is selected because it changed what was possible: what could be built, thought, governed, or understood. Not every important topic is here yet, and not every important topic will ever be here. The canon is finite and curated by design.
            </p>
            <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.light, lineHeight:1.6,
              fontStyle:"italic" }}>
              If "{results.query}" isn't here, it either hasn't been built yet or didn't meet the threshold for civilizational significance, analytical depth, or connective value.
            </p>
          </div>

          {results.suggestions && results.suggestions.length > 0 && (
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.1em",
                textTransform:"uppercase", color:C.light, marginBottom:16 }}>
                Related entries you might find useful
              </div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap:10 }}>
                {results.suggestions.map(({ id, entry }) => (
                  <EntryCard key={id} id={id} entry={entry} onClick={onEntry} />
                ))}
              </div>
            </div>
          )}

          {(!results.suggestions || results.suggestions.length === 0) && (
            <div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.1em",
                textTransform:"uppercase", color:C.light, marginBottom:16 }}>
                Browse the canon by category
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {Object.entries(TEMPLATE_CONFIG).filter(([_,c]) => c.active).map(([name, cfg]) => (
                  <button key={name} onClick={() => onHome()}
                    style={{ padding:"8px 14px", background:C.surface, border:`1px solid ${cfg.accent}`,
                      borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
                      fontSize:10, letterSpacing:"0.06em", textTransform:"uppercase", color:cfg.accent }}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY VIEW WRAPPER (existing viewer with nav)
// ═══════════════════════════════════════════════════════════════════════════════

function EntryViewWrapper({ entryId, onHome, onTemplate, onEntry, onTours, onPathways, returnTo, returnToId }) {
  const isMobile = useIsMobile();
  const [entry, setEntry] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    setLoading(true);
    if (ENTRY_CACHE[entryId]) {
      setEntry(ENTRY_CACHE[entryId]);
      setLoading(false);
    } else {
      fetch(`/entries/${entryId}.json`)
        .then(r => r.json())
        .then(data => { ENTRY_CACHE[entryId] = data; setEntry(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [entryId]);

  // Update page title and meta tags when entry loads; reset to site defaults on unmount
  React.useEffect(() => {
    if (!entry) return;
    const siteTitle = 'TheCommonPlace';
    const siteDesc  = 'A curated canon of civilizational significance — structured analytical depth across history, ideas, and the world.';
    const entryTitle = `${entry.title} — ${siteTitle}`;
    const entryDesc  = entry.summary || siteDesc;
    const entryUrl   = `https://www.thecommonplace.dev/#/entry/${entryId}`;

    const setMeta = (sel, attr, val) => {
      const el = document.querySelector(sel);
      if (el) el.setAttribute(attr, val);
    };

    document.title = entryTitle;
    setMeta('meta[name="description"]',        'content', entryDesc);
    setMeta('meta[property="og:title"]',       'content', entryTitle);
    setMeta('meta[property="og:description"]', 'content', entryDesc);
    setMeta('meta[property="og:url"]',         'content', entryUrl);
    setMeta('meta[property="og:type"]',        'content', 'article');

    return () => {
      document.title = siteTitle;
      setMeta('meta[name="description"]',        'content', siteDesc);
      setMeta('meta[property="og:title"]',       'content', siteTitle);
      setMeta('meta[property="og:description"]', 'content', siteDesc);
      setMeta('meta[property="og:url"]',         'content', 'https://www.thecommonplace.dev');
      setMeta('meta[property="og:type"]',        'content', 'website');
    };
  }, [entry, entryId]);
  if (loading) return <div style={{padding:60,textAlign:'center',fontFamily:"'Lora',serif",color:C.muted}}>Loading…</div>;
  if (!entry) return (
    <div style={{padding:"80px 24px",textAlign:'center',fontFamily:"'Lora',serif",color:C.muted}}>
      <div style={{fontSize:20,color:C.text,marginBottom:8}}>Entry not found</div>
      <div style={{marginBottom:24}}>This link doesn’t match anything in the canon (yet).</div>
      <button onClick={onHome} style={{background:'none',border:`1px solid ${C.muted}`,color:C.text,
        padding:"8px 18px",borderRadius:4,cursor:'pointer',fontFamily:"'Lora',serif",fontSize:14}}>
        ← Back to home
      </button>
    </div>
  );
  const cfg = TEMPLATE_CONFIG[entry.template] || {};
  const accent = cfg.accent || '#555';

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "16px 14px 60px" : "24px 40px 80px" }}>

      {/* Breadcrumb */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <button onClick={onHome}
          style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${C.border}`,
            borderRadius:3, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
            fontSize:9, letterSpacing:"0.06em", color:C.muted }}>
          Home
        </button>
        {returnTo === 'tours' && (
          <>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light }}>›</span>
            <button onClick={() => onTours(returnToId)}
              style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${C.border}`,
                borderRadius:3, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
                fontSize:9, letterSpacing:"0.06em", color:C.muted }}>
              Tours
            </button>
          </>
        )}
        {returnTo === 'pathways' && (
          <>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light }}>›</span>
            <button onClick={() => onPathways(returnToId)}
              style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${C.border}`,
                borderRadius:3, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
                fontSize:9, letterSpacing:"0.06em", color:C.muted }}>
              Pathways
            </button>
          </>
        )}
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light }}>›</span>
        <button onClick={() => onTemplate(entry.template)}
          style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${accent}`,
            borderRadius:3, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
            fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase", color:accent }}>
          {entry.template}
        </button>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:C.light }}>›</span>
        <span style={{ fontFamily:"'Lora',serif", fontSize:13, fontWeight:600, color:C.text }}>
          {entry.title}
        </span>
      </div>

      {/* Delegate to existing EntryView */}
      <EntryViewer entry={entry} accent={accent} navigateTo={onEntry} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY VIEWER (extracted from original App)
// ═══════════════════════════════════════════════════════════════════════════════

function EntryViewer({ entry, accent, navigateTo }) {
  return <EntryView entry={entry} accent={accent} navigateTo={navigateTo} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ToursView({ onEntry, onHome, restoreId }) {
  const isMobile = useIsMobile();
  const validRestoreId = typeof restoreId === "string" && COLLECTIONS.some(c => c.id === restoreId) ? restoreId : null;
  const [selectedId, setSelectedId] = React.useState(validRestoreId || COLLECTIONS[0]?.id || "");
  // The tour to restore is applied by the useState initializer above (this view
  // remounts on every entry → tours return). Here we only keep the value valid —
  // do NOT force it back to restoreId, or the user couldn't switch tours.
  React.useEffect(() => {
    if (!COLLECTIONS.some(c => c.id === selectedId)) {
      setSelectedId(COLLECTIONS[0]?.id || "");
    }
  }, [selectedId]);
  const selected = COLLECTIONS.find(c => c.id === selectedId);

  return (
    <main id="main-content" style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "24px 14px 60px" : "40px 40px 80px", overflowX:"hidden" }}>

      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:32,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>

      {/* Header */}
      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, fontWeight:400,
          color:C.text, marginBottom:8 }}>Tours</h1>
        <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic" }}>
          Curated paths through the canon. Each tour connects a place to the entries it unlocks.
        </p>
      </div>

      {/* Dropdown */}
      <div style={{ marginBottom:40 }}>
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          style={{ padding:"12px 16px", fontFamily:"'Lora',serif", fontSize:15,
            color:C.text, background:C.surface, border:`1.5px solid ${C.borderStrong}`,
            borderRadius:6, cursor:"pointer", width:"100%", maxWidth:480,
            outline:"none", appearance:"none",
            backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6356' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center",
            paddingRight:40 }}>
          {COLLECTIONS.map(c => (
            <option key={c.id} value={c.id}>{c.title}{c.location ? ` — ${c.location}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Selected tour */}
      {selected && (
        <div>
          <div style={{ marginBottom:32, paddingBottom:24, borderBottom:`1px solid ${C.border}` }}>
            {selected.location && (
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:"0.1em",
                textTransform:"uppercase", color:"#8a6d3b", marginBottom:6 }}>{selected.location}</div>
            )}
            <h2 style={{ fontFamily:"'DM Serif Display',serif", fontSize: isMobile?24:30, fontWeight:400,
              color:C.text, margin:"0 0 10px" }}>{selected.title}</h2>
            <p style={{ fontFamily:"'Lora',serif", fontSize:15, color:C.muted, lineHeight:1.7 }}>
              {selected.description}
            </p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {selected.entries.map((item, i) => {
              const entry = MANIFEST.find(e => e.id === item.entryId);
              if (!entry) return null;
              const cfg = TEMPLATE_CONFIG[entry.template] || {};
              const accent = cfg.accent || C.navy;
              return (
                <div key={item.entryId} style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

                  {/* Number */}
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                    color:C.light, flexShrink:0, paddingTop:20, minWidth:20, textAlign:"right" }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  {/* Card + note */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Object name + note inline */}
                    <div style={{ marginBottom:8, lineHeight:1.6, width: isMobile ? "100%" : "78%", maxWidth:760, minWidth: isMobile ? 0 : 420 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                        letterSpacing:"0.08em", textTransform:"uppercase", color:accent,
                        marginRight:6 }}>
                        {item.object}
                      </span>
                      <span style={{ fontFamily:"'Lora',serif", fontSize:13, color:C.muted,
                        fontStyle:"italic" }}>
                        — {item.note}
                      </span>
                    </div>

                    {/* Entry card */}
                    <div onClick={() => onEntry(item.entryId, selectedId)}
                      style={{ width: isMobile ? "100%" : "78%", maxWidth:760, minWidth: isMobile ? 0 : 420,
                        background:C.surface, border:`1px solid ${C.border}`,
                        borderLeft:`3px solid ${accent}`, borderRadius:6, padding:"8px 12px",
                        cursor:"pointer", transition:"all 0.12s", overflow:"hidden" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9,
                          fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
                          color:"#fff", background:accent, padding:"2px 7px", borderRadius:3,
                          flexShrink:0 }}>
                          {entry.template}
                        </span>
                        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:15,
                          fontWeight:700, color:C.text, whiteSpace:"nowrap",
                          overflow:"hidden", textOverflow:"ellipsis" }}>
                          {entry.title}
                        </span>
                      </div>
                      <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted,
                        lineHeight:1.5, whiteSpace:"nowrap", overflow:"hidden",
                        textOverflow:"ellipsis" }}>
                        {entry.summary || ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATHWAYS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function PathwaysView({ onEntry, onHome, restoreId }) {
  const isMobile = useIsMobile();
  const validRestoreId = typeof restoreId === "string" && PATHWAYS.some(p => p.id === restoreId) ? restoreId : null;
  const [selectedId, setSelectedId] = React.useState(validRestoreId || PATHWAYS[0]?.id || "");
  // Restore is applied by the initializer above (this view remounts on return);
  // here we only keep the value valid, never force it back to restoreId.
  React.useEffect(() => {
    if (!PATHWAYS.some(p => p.id === selectedId)) {
      setSelectedId(PATHWAYS[0]?.id || "");
    }
  }, [selectedId]);
  const selected = PATHWAYS.find(p => p.id === selectedId);
  if (!PATHWAYS.length) return (
    <main id="main-content" style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "24px 14px 60px" : "40px 40px 80px" }}>
      <button onClick={onHome} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, cursor:"pointer" }}>← Home</button>
      <p style={{ fontFamily:"'Lora',serif", color:C.muted, marginTop:20 }}>No pathways loaded.</p>
    </main>
  );

  return (
    <main id="main-content" style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "24px 14px 60px" : "40px 40px 80px", overflowX:"hidden" }}>

      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:32,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>

      <div style={{ marginBottom:32 }}>
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:36, fontWeight:400,
          color:C.text, marginBottom:8 }}>Pathways</h1>
        <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic" }}>
          Curated reading sequences. Each pathway builds toward understanding a subject from the ground up.
        </p>
      </div>

      {/* Dropdown */}
      <div style={{ marginBottom:24 }}>
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          style={{ padding:"12px 16px", fontFamily:"'Lora',serif", fontSize:15,
            color:C.text, background:C.surface, border:`1.5px solid ${C.borderStrong}`,
            borderRadius:6, cursor:"pointer", width:"100%", maxWidth:480,
            outline:"none", appearance:"none",
            backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6356' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat:"no-repeat", backgroundPosition:"right 14px center",
            paddingRight:40 }}>
          {PATHWAYS.map(p => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {selected && (
        <div>
          {/* Arrow chain */}
          <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:6,
            marginBottom:12 }}>
            {selected.entries.map((item, i) => {
              const entry = MANIFEST.find(e => e.id === item.entryId);
              if (!entry) return null;
              const cfg = TEMPLATE_CONFIG[entry.template] || {};
              return (
                <React.Fragment key={item.entryId}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:13,
                    fontWeight:700, color:C.text }}>
                    {entry.title}
                  </span>
                  {i < selected.entries.length - 1 && (
                    <span style={{ color:C.light, fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Description */}
          <p style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted,
            fontStyle:"italic", lineHeight:1.7, marginBottom:32 }}>
            {selected.description}
          </p>

          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:24 }} />

          {/* Entry cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:24 }}>
            {selected.entries.map((item, i) => {
              const entry = MANIFEST.find(e => e.id === item.entryId);
              if (!entry) return null;
              const cfg = TEMPLATE_CONFIG[entry.template] || {};
              const accent = cfg.accent || C.navy;
              return (
                <div key={item.entryId} style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

                  {/* Number */}
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                    color:C.light, flexShrink:0, paddingTop:10, minWidth:20, textAlign:"right" }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Note */}
                    <div style={{ fontFamily:"'Lora',serif", fontSize:13, color:C.muted,
                      fontStyle:"italic", marginBottom:8, lineHeight:1.6,
                      width: isMobile ? "100%" : "78%", maxWidth:760, minWidth: isMobile ? 0 : 420 }}>
                      {item.note}
                    </div>

                    {/* Entry card */}
                    <div onClick={() => onEntry(item.entryId, selectedId)}
                      style={{ width: isMobile ? "100%" : "78%", maxWidth:760, minWidth: isMobile ? 0 : 420,
                        background:C.surface, border:`1px solid ${C.border}`,
                        borderLeft:`3px solid ${accent}`, borderRadius:6, padding:"8px 12px",
                        cursor:"pointer", transition:"all 0.12s", overflow:"hidden" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = accent}
                      onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9,
                          fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
                          color:"#fff", background:accent, padding:"2px 7px", borderRadius:3,
                          flexShrink:0 }}>
                          {entry.template}
                        </span>
                        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:15,
                          fontWeight:700, color:C.text, whiteSpace:"nowrap",
                          overflow:"hidden", textOverflow:"ellipsis" }}>
                          {entry.title}
                        </span>
                      </div>
                      <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted,
                        lineHeight:1.5, whiteSpace:"nowrap", overflow:"hidden",
                        textOverflow:"ellipsis" }}>
                        {entry.summary || ''}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HASH ROUTING  —  shareable / refreshable / back-button URLs without a server
//   #/                         home
//   #/browse                   browse everything
//   #/tours  #/pathways        tours / pathways
//   #/category/People          a category (template) gallery
//   #/search/democracy         a search
//   #/entry/johnLocke          an entry (deep link)
// ═══════════════════════════════════════════════════════════════════════════════
function parseHash(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'home' };
  const seg = parts[0];
  const arg = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('/')) : null;
  switch (seg) {
    case 'browse':   return { view: 'browse' };
    case 'tours':    return { view: 'tours' };
    case 'pathways': return { view: 'pathways' };
    case 'about':    return { view: 'about' };
    case 'method':   return { view: 'method' };
    case 'privacy':  return { view: 'privacy' };
    case 'category': return (arg && TEMPLATE_CONFIG[arg]) ? { view: 'template', template: arg } : { view: 'home' };
    case 'search':   return arg ? { view: 'search', query: arg } : { view: 'home' };
    case 'entry':    return arg ? { view: 'entry', entryId: arg } : { view: 'home' };
    default:         return { view: 'home' };
  }
}
function routeToHash(view, s) {
  switch (view) {
    case 'browse':   return '#/browse';
    case 'tours':    return '#/tours';
    case 'pathways': return '#/pathways';
    case 'about':    return '#/about';
    case 'method':   return '#/method';
    case 'privacy':  return '#/privacy';
    case 'template': return s.activeTemplate ? '#/category/' + encodeURIComponent(s.activeTemplate) : '#/';
    case 'search':   return s.searchQuery ? '#/search/' + encodeURIComponent(s.searchQuery) : '#/';
    case 'entry':    return s.activeEntryId ? '#/entry/' + encodeURIComponent(s.activeEntryId) : '#/';
    default:         return '#/';
  }
}

// Feedback / contact destination. Monitored mailbox for all feedback/contact links.
const CONTACT_EMAIL = 'TCPFeedback@pm.me';

// ── Footer (shown on every view) ─────────────────────────────────────────────
function Footer({ onHome, onBrowse, onAbout, onMethod, onPrivacy }) {
  const isMobile = useIsMobile();
  const link = (label, onClick, href) => href
    ? <a href={href} style={{ color: C.muted, textDecoration: 'none', fontSize: 13, fontFamily: "'Lora',serif" }}>{label}</a>
    : <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: C.muted, fontSize: 13, fontFamily: "'Lora',serif" }}>{label}</button>;
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 64, padding: isMobile ? '28px 20px 40px' : '32px 40px 48px',
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 24,
      alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
      <div>
        <button onClick={onHome} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          color: C.text, fontFamily: "'DM Serif Display',serif", fontSize: 18 }}>TheCommonPlace</button>
        <div style={{ color: C.light, fontSize: 12, fontStyle: 'italic', fontFamily: "'Lora',serif", marginTop: 2 }}>
          A curated atlas of civilization, ideas, and power. Currently in beta.
        </div>
      </div>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 16 : 20, alignItems: 'center' }}>
        {link('About', onAbout)}
        {link('Method', onMethod)}
        {link('Privacy', onPrivacy)}
        {link('Browse', onBrowse)}
        {link('Feedback', null, `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('The Commonplace — beta feedback')}`)}
        {link('Suggest an entry', null, `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('The Commonplace — entry suggestion')}`)}
      </nav>
    </footer>
  );
}

// ── About / Method content pages ─────────────────────────────────────────────
function InfoPage({ kind, onHome, onBrowse }) {
  const isMobile = useIsMobile();
  const H = ({ children }) => <h2 style={{ fontFamily: "'DM Serif Display',serif", fontWeight: 400, fontSize: isMobile ? 19 : 21,
    color: C.text, margin: '30px 0 10px' }}>{children}</h2>;
  const P = ({ children }) => <p style={{ fontFamily: "'Lora',serif", fontSize: isMobile ? 15 : 16, lineHeight: 1.7,
    color: C.text, margin: '0 0 14px' }}>{children}</p>;
  const mailLink = <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.text, textDecoration: 'underline' }}>{CONTACT_EMAIL}</a>;
  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: isMobile ? '28px 20px 0' : '44px 40px 0' }}>
      <button onClick={onHome} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: C.muted, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.08em', marginBottom: 18 }}>← HOME</button>
      <h1 style={{ fontFamily: "'DM Serif Display',serif", fontWeight: 400, fontSize: isMobile ? 30 : 38, color: C.text, margin: '0 0 6px' }}>
        {kind === 'about' ? 'About' : kind === 'privacy' ? 'Privacy & Notices' : 'Method'}
      </h1>
      {kind === 'about' ? (
        <>
          <P>TheCommonPlace is a curated atlas of the people, ideas, events, and forces that built the world — not an encyclopedia that aims to cover everything, but a deliberately finite canon of subjects that genuinely warrant deep, structured treatment.</P>
          <H>Four ways to read every entry</H>
          <P>Each entry is written at several reading levels — Beginner, General, and Advanced, alongside Educational and Research material. You choose how deep to go and can move between levels as you read. The idea is one subject, met at whatever altitude you need: a clear first orientation, a fuller account, or the scholarly debate underneath.</P>
          <H>Find your way in</H>
          <P>Browse the whole canon and filter it by era, region, category, and more; follow a Tour that connects a place to the entries it unlocks; or take a Pathway — a curated sequence that builds toward a big question like “how capitalism happened.” If you prefer to wander, search anything or chase a rabbit hole between related entries.</P>
          <H>This is a beta</H>
          <P>The canon currently holds {MANIFEST.length} entries and is still expanding. Things will change, and some subjects you expect are not here yet. If you find an error or want to suggest an entry, the Feedback and Suggest links in the footer go straight to us — beta readers are the best source of both.</P>
          <P><button onClick={onBrowse} style={{ background: 'none', border: `1px solid ${C.borderStrong}`, color: C.text,
            padding: '9px 18px', borderRadius: 4, cursor: 'pointer', fontFamily: "'Lora',serif", fontSize: 15 }}>Start exploring →</button></P>
        </>
      ) : kind === 'method' ? (
        <>
          <P>This page explains how the canon is built and how to read it. It uses a few loaded words — “canon,” “threshold,” “significance” — and they deserve a frame.</P>
          <H>What qualifies as an entry</H>
          <P>An entry has to clear a threshold of civilizational significance: it must have genuinely shaped how the world works, and it must reward structured, multi-level treatment. The test is not fame or popularity but consequence and depth. That makes the canon finite by design — the goal is the subjects that matter most, treated well, rather than exhaustive coverage.</P>
          <H>Why this size now, and what a larger canon means</H>
          <P>The current {MANIFEST.length} entries are an early, deliberately curated core. Growth is gated on quality and balance, not volume: a larger canon should mean more of the world represented — more regions, eras, and traditions — not simply more pages. Expansion is a series of intentional decisions, each with the same threshold.</P>
          <H>What the reading levels mean</H>
          <P>Beginner grounds the subject in plain language and concrete scenes. General adds the mechanisms, named figures, and live debates. Advanced develops the scholarly tension — the questions specialists actually argue about. Educational and Research material support teaching and deeper study. The levels are meant to differ in altitude, not just in difficulty.</P>
          <H>How sources are handled</H>
          <P>The Commonplace is written for layered public reading, not formal academic publication, so the prose carries no inline footnotes or numbered citations. Instead, each entry’s Reference list is the citation: the works that actually informed it — including the books, papers, and primary sources it names and engages in the text — gathered in one place rather than scattered through it.</P>
          <P>References are rated on two axes — Reliability (how trustworthy the source is as a resource) and Role (the part the source played in building this particular entry) — so you can see not just what was used but why it carries weight here. The separate “Find it” links under each layer are for further reading and where to buy a work; they are not a claim that every line traces to them.</P>
          <H>How entries are made</H>
          <P>Entries are composed with AI assistance and then checked against an automated validator and editorial review — for structure, reading-level calibration, sourcing, and balance — before publication. This is a beta, and that process is still being tuned.</P>
          <H>How to read omissions</H>
          <P>If something is missing, that is not a verdict that it does not matter. The canon is finite and still expanding, and many worthy subjects simply have not been built yet. Tell us what you would add — the footer’s Suggest link is exactly for that.</P>
        </>
      ) : (
        <>
          <P>Short version: The Commonplace is a reading site. It needs no account and asks you for nothing to use it. Last updated for the beta.</P>
          <H>Privacy</H>
          <P>The site is static and currently sets no advertising or tracking cookies. Our host keeps standard server logs — things like IP address, browser type, and the pages requested — to operate and secure the site. If we add usage analytics during the beta, we will use a privacy-friendly, cookieless tool and update this page to name it.</P>
          <P>If you email us through the Feedback or Suggest-an-entry links, we keep your message and email address so we can reply and improve the site. We do not sell personal information. Questions or requests about your data: {mailLink}.</P>
          <H>An educational project</H>
          <P>The Commonplace is an educational and editorial project. Entries are provided for general learning and exploration — not as legal, medical, financial, professional, or academic advice. The site may contain errors or omissions, especially during the beta. Corrections are welcome at {mailLink}.</P>
          <H>Sources & rights</H>
          <P>Quotations, references, and images are used for educational and editorial purposes. Where possible, The Commonplace uses public-domain, openly licensed, or attributed material. If you believe something has been used incorrectly, contact us at {mailLink} and we will review it.</P>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function CommonplaceApp() {
  const initialRoute = parseHash(typeof window !== 'undefined' ? window.location.hash : '');
  const isMobile = useIsMobile();
  const compactHeader = useIsMobile(880); // tablet: hide the wordmark text so the search keeps room
  const [manifestLoaded, setManifestLoaded] = React.useState(false);
  const [view, setView] = React.useState(initialRoute.view || 'home'); // 'home' | 'template' | 'search' | 'entry' | 'tours' | 'pathways' | 'browse'
  const [activeTemplate, setActiveTemplate] = React.useState(initialRoute.template || null);
  const [activeEntryId, setActiveEntryId] = React.useState(initialRoute.entryId || null);
  const [searchQuery, setSearchQuery] = React.useState(initialRoute.query || '');
  const [headerQuery, setHeaderQuery] = React.useState(initialRoute.query || '');
  const [acResults, setAcResults] = React.useState([]); // autocomplete suggestions
  const [acOpen, setAcOpen] = React.useState(false);

  React.useEffect(() => {
    // Load manifest + search index in parallel
    Promise.all([
      fetch('/entries/manifest.json').then(r => r.json()),
      fetch('/searchIndex.json').then(r => r.json()).catch(() => []),
      fetch('/entries/collections.json').then(r => r.json()).catch(() => []),
      fetch('/entries/pathways.json').then(r => r.json()).catch(() => []),
      fetch('/entries/calendar.json').then(r => r.json()).catch(() => null),
    ]).then(([manifest, searchIdx, collections, pathways, calendar]) => {
      MANIFEST = manifest;
      SEARCH_INDEX = searchIdx;
      COLLECTIONS = collections;
      PATHWAYS = pathways;
      CALENDAR = calendar;
      if (searchIdx.length > 0) initFuse();
      setManifestLoaded(true);
    }).catch(() => setManifestLoaded(true));
  }, []);

  // Live autocomplete as user types in header.
  // Uses the same deterministic prefix ranking as searchEntries/scoreEntry —
  // title prefix matches always appear before Fuse fuzzy matches.
  const handleHeaderChange = (e) => {
    const raw = e.target.value;
    setHeaderQuery(raw);
    if (raw.trim().length < 2) { setAcResults([]); setAcOpen(false); return; }

    const q       = raw.trim().toLowerCase();
    const stopWords = new Set(['the','a','an','is','are','was','were','of','in','on','at','to','for','with','by','from','and','or','that','this','it','as']);
    const terms   = q.split(/\s+/).filter(t => t.length > 1 && !stopWords.has(t));

    // Step 1 — deterministic prefix scoring (same tiers as scoreEntry)
    const pinned = MANIFEST.map(entry => {
      const title = (entry.title || '').toLowerCase();
      const bare  = title.replace(/^(the |a |an )/, '');
      const siRec   = SEARCH_INDEX.find(s => s.id === entry.id);
      const aliases = (siRec?.aliases || []).map(a => a.toLowerCase());

      if (title === q || bare === q)                              return { entry, score: 1000 };
      if (title.startsWith(q) || bare.startsWith(q))             return { entry, score: 950 };
      if (aliases.some(a => a === q))                             return { entry, score: 900 };
      if (aliases.some(a => a.startsWith(q)))                     return { entry, score: 850 };
      if (terms.length && terms.every(t => title.includes(t)))   return { entry, score: 800 };
      if (terms.length && terms.some(t => title.startsWith(t)))  return { entry, score: 750 };
      if (terms.length && terms.some(t => bare.startsWith(t)))   return { entry, score: 700 };
      if (terms.length === 1 && terms.some(t => title.includes(t)))    return { entry, score: 650 };
      // associatedWorks: deterministic match, always beats Fuse
      const assocWorks = (siRec?.associatedWorks || []).map(s => s.toLowerCase());
      if (assocWorks.some(s => s === q))                                          return { entry, score: 580 };
    if (terms.length && assocWorks.some(s => terms.every(t => s.includes(t)))) return { entry, score: 570 };
      if (terms.length && assocWorks.some(s => terms.some(t => s.startsWith(t)))) return { entry, score: 550 };
      if (terms.length && assocWorks.some(s => terms.some(t => s.includes(t))))   return { entry, score: 520 };
      return null;
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    const pinnedIds = new Set(pinned.map(r => r.entry.id));

    // Step 2 — Fuse fills remaining slots for typo tolerance
    let fuseExtra = [];
    if (FUSE) {
      fuseExtra = FUSE.search(raw, { limit: 8 })
        .filter(r => !pinnedIds.has(r.item.id))
        .map(r => {
          const entry = MANIFEST.find(m => m.id === r.item.id) || r.item;
          return { entry, score: Math.min(499, Math.round((1 - r.score) * 100)) };
        }).filter(x => x.entry);
    }

    const scored = [...pinned, ...fuseExtra].sort((a,b) => b.score - a.score).slice(0, 6);
    setAcResults(scored);
    setAcOpen(scored.length > 0);
  };

  const [returnTo, setReturnTo] = React.useState(null);     // 'tours' | 'pathways' | null
  const [returnToId, setReturnToId] = React.useState(null); // which collection/pathway to restore

  const goHome = () => { setReturnTo(null); setReturnToId(null); setView('home'); };
  const goToTours = (restoreId=null) => {
    const validRestoreId = typeof restoreId === "string" && COLLECTIONS.some(c => c.id === restoreId) ? restoreId : null;
    setReturnTo(null); setReturnToId(validRestoreId); setView('tours');
  };
  const goToPathways = (restoreId=null) => {
    const validRestoreId = typeof restoreId === "string" && PATHWAYS.some(p => p.id === restoreId) ? restoreId : null;
    setReturnTo(null); setReturnToId(validRestoreId); setView('pathways');
  };
  const goToTemplate = (t) => { setActiveTemplate(t); setView('template'); };
  const goToBrowse = () => { setReturnTo(null); setReturnToId(null); setView('browse'); };
  const goToEntry = (id, source=null, sourceId=null, preserveReturn=false) => {
    if (!MANIFEST.find(e => e.id === id)) return;
    if (!preserveReturn) {
      setReturnTo(source);
      setReturnToId(sourceId);
    }
    setActiveEntryId(id);
    setView('entry');
  };
  const doSearch = (q) => {
    if (!q.trim()) return;
    setSearchQuery(q);
    setHeaderQuery(q);
    setView('search');
  };
  // Compass = serendipity: jump to a random published entry from anywhere.
  const goToRandomEntry = () => {
    const pool = MANIFEST.filter(e => e.status === 'published');
    const r = pool[Math.floor(Math.random() * pool.length)];
    if (r) goToEntry(r.id);
  };

  // ── Hash routing sync ──────────────────────────────────────────────────────
  // suppress one hashchange immediately after we write the hash ourselves, so an
  // in-app navigation does not bounce back through applyHash and clobber context
  // (e.g. the returnTo set when an entry was opened from a tour).
  const suppressNextHashApply = React.useRef(false);

  // hash -> state (browser back/forward, or a manually edited/shared URL)
  useEffect(() => {
    if (!manifestLoaded) return;
    const onHash = () => {
      if (suppressNextHashApply.current) { suppressNextHashApply.current = false; return; }
      const r = parseHash(window.location.hash);
      if (r.view === 'entry')         goToEntry(r.entryId);
      else if (r.view === 'template') goToTemplate(r.template);
      else if (r.view === 'search')   doSearch(r.query);
      else if (r.view === 'browse')   goToBrowse();
      else if (r.view === 'tours')    goToTours();
      else if (r.view === 'pathways') goToPathways();
      else if (r.view === 'about')    { setReturnTo(null); setReturnToId(null); setView('about'); }
      else if (r.view === 'method')   { setReturnTo(null); setReturnToId(null); setView('method'); }
      else if (r.view === 'privacy')  { setReturnTo(null); setReturnToId(null); setView('privacy'); }
      else                            goHome();
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [manifestLoaded]);

  // state -> hash (in-app navigation), guarded so it never fights the listener
  useEffect(() => {
    if (!manifestLoaded) return;
    const desired = routeToHash(view, { activeTemplate, activeEntryId, searchQuery });
    if ((window.location.hash || '#/') !== desired) {
      suppressNextHashApply.current = true;
      window.location.hash = desired;
    }
  }, [manifestLoaded, view, activeEntryId, activeTemplate, searchQuery]);

  const accent = view === 'entry' && activeEntryId
    ? (TEMPLATE_CONFIG[MANIFEST.find(e=>e.id===activeEntryId)?.template]?.accent || '#8b4513')
    : '#8b4513';

  if (!manifestLoaded) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{FONTS}</style>
      <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:24, color:C.muted }}>TheCommonPlace</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", backgroundColor:C.bg,
      backgroundImage:`linear-gradient(rgba(244,241,235,0.88), rgba(244,241,235,0.90)), url('/Backgroundmap.webp')`,
      backgroundSize:"cover", backgroundPosition:"center top",
      backgroundAttachment: isMobile ? "scroll" : "fixed", backgroundRepeat:"no-repeat" }}>
      <style>{FONTS}</style>

      {/* Header */}
      <header role="banner" style={{ background:C.navy, borderBottom:`3px solid ${accent}`,
        transition:"border-color 0.3s", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding: isMobile ? "7px 14px" : "0 40px", display:"flex",
          alignItems:"center", gap: isMobile ? 8 : 14, height: isMobile ? "auto" : 54,
          flexWrap: isMobile ? "wrap" : "nowrap" }}>

          {/* Brand — home */}
          <button onClick={goHome} aria-label="Home"
            style={{ display:"flex", alignItems:"center", gap:9, background:"transparent",
              border:"none", cursor:"pointer", flexShrink:0, padding:"4px 2px" }}>
            <img src="/tcp_logo_transparent.webp" alt=""
              style={{ height:28, width:"auto", objectFit:"contain" }} />
            <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:"#f6f3ec",
              letterSpacing:"0.01em", whiteSpace:"nowrap", display: compactHeader ? "none" : "inline" }}>TheCommonPlace</span>
          </button>

          {/* Search — fuzzy, always visible */}
          <div style={{ flex:1, minWidth:0, maxWidth: isMobile ? "none" : 440, position:"relative" }}>
            <form role="search" onSubmit={e => { e.preventDefault(); setAcOpen(false); doSearch(headerQuery); }}
              style={{ display:"flex", gap:6 }}>
              <input
                aria-label="Search the canon"
                value={headerQuery}
                onChange={handleHeaderChange}
                onFocus={() => acResults.length > 0 && setAcOpen(true)}
                onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                placeholder={`Search ${MANIFEST.length} entries…`}
                className="hdr-search"
                style={{ flex:1, minWidth:0, padding:"7px 12px", fontFamily:"'Lora',serif", fontSize:13,
                  color:"#f4f1e8", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)",
                  borderRadius:4, outline:"none" }} />
              <button type="submit" aria-label="Submit search"
                style={{ padding:"7px 12px", background:"rgba(255,255,255,0.12)", color:"#cbd5e1",
                  border:"1px solid rgba(255,255,255,0.15)", borderRadius:4, cursor:"pointer",
                  fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.05em" }}>
                ↵
              </button>
            </form>
            {acOpen && acResults.length > 0 && (
              <div role="listbox" aria-label="Search suggestions"
                style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
                background:"#1e2d3d", border:"1px solid rgba(255,255,255,0.15)", borderRadius:6,
                boxShadow:"0 8px 24px rgba(0,0,0,0.4)", zIndex:200, overflow:"hidden" }}>
                {acResults.map(({ entry }, i) => {
                  const cfg = TEMPLATE_CONFIG[entry.template] || {};
                  return (
                    <div key={entry.id} role="option"
                      onMouseDown={() => { goToEntry(entry.id); setHeaderQuery(''); setAcOpen(false); }}
                      style={{ padding:"10px 14px", cursor:"pointer",
                        borderBottom: i < acResults.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span aria-hidden="true" style={{ width:8, height:8, borderRadius:"50%",
                          background: cfg.accent || "#8b4513", flexShrink:0 }} />
                        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:13,
                          color:"#f8f8f0", fontWeight:600 }}>{entry.title}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                          color:"rgba(255,255,255,0.4)", marginLeft:"auto" }}>{entry.template}</span>
                      </div>
                      <div style={{ fontFamily:"'Lora',serif", fontSize:11,
                        color:"rgba(255,255,255,0.5)", marginTop:3, marginLeft:16,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {entry.subtype} · {entry.period}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 2 : 14,
            flexBasis: isMobile ? "100%" : "auto", justifyContent: isMobile ? "center" : "flex-start" }}>
          {/* Explore nav link → Browse everything */}
          <button onClick={goToBrowse}
            style={{ background:"transparent", border:"none", cursor:"pointer", flexShrink:0, padding:"4px 10px",
              color: view === 'browse' ? "#c8a96e" : "rgba(255,255,255,0.6)",
              fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase",
              borderBottom: view === 'browse' ? "1px solid #c8a96e" : "1px solid transparent", transition:"all 0.15s" }}>
            Explore
          </button>

          {/* Tours nav link — restore the tour if returning from a tour-opened entry */}
          <button onClick={() => goToTours(returnTo === 'tours' ? returnToId : null)}
            style={{ background:"transparent", border:"none", cursor:"pointer",
              flexShrink:0, padding:"4px 10px",
              color: view === 'tours' ? "#c8a96e" : "rgba(255,255,255,0.6)",
              fontFamily:"'JetBrains Mono',monospace", fontSize:10,
              letterSpacing:"0.08em", textTransform:"uppercase",
              borderBottom: view === 'tours' ? "1px solid #c8a96e" : "1px solid transparent",
              transition:"all 0.15s" }}>
            Tours
          </button>

          {/* Pathways nav link — restore the pathway if returning from a pathway-opened entry */}
          <button onClick={() => goToPathways(returnTo === 'pathways' ? returnToId : null)}
            style={{ background:"transparent", border:"none", cursor:"pointer",
              flexShrink:0, padding:"4px 10px",
              color: view === 'pathways' ? "#c8a96e" : "rgba(255,255,255,0.6)",
              fontFamily:"'JetBrains Mono',monospace", fontSize:10,
              letterSpacing:"0.08em", textTransform:"uppercase",
              borderBottom: view === 'pathways' ? "1px solid #c8a96e" : "1px solid transparent",
              transition:"all 0.15s" }}>
            Pathways
          </button>

          {/* Compass = jump to a random entry (serendipity) */}
          <button onClick={goToRandomEntry} className="compass-btn"
            aria-label="Jump to a random entry" title="Surprise me — jump to a random entry"
            style={{ flexShrink:0, marginLeft:4, width:30, height:30, borderRadius:"50%", padding:0,
              border:"1px solid rgba(200,169,110,0.5)", background:"transparent", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>
          </button>
          </div>

        </div>
      </header>

      {/* Views */}
      {view === 'home' && (
        <HomeView onSearch={doSearch} onTemplate={goToTemplate} onEntry={goToEntry} onBrowse={goToBrowse} />
      )}
      {view === 'browse' && (
        <BrowseAllView onEntry={goToEntry} onHome={goHome} />
      )}
      {view === 'tours' && (
        <ToursView
          onEntry={(entryId, tourId) => goToEntry(entryId, 'tours', tourId)}
          onHome={goHome}
          restoreId={returnToId}
        />
      )}
      {view === 'pathways' && (
        <PathwaysView
          onEntry={(entryId, pathwayId) => goToEntry(entryId, 'pathways', pathwayId)}
          onHome={goHome}
          restoreId={returnToId}
        />
      )}
      {view === 'template' && activeTemplate && (
        <TemplateGallery templateName={activeTemplate} onEntry={goToEntry} onHome={goHome} />
      )}
      {view === 'search' && (
        <SearchResultsView initialQuery={searchQuery} onEntry={goToEntry}
          onHome={goHome} onSearch={doSearch} />
      )}
      {view === 'entry' && activeEntryId && (
        <EntryViewWrapper entryId={activeEntryId} onHome={goHome}
          onTours={goToTours} onPathways={goToPathways}
          returnTo={returnTo} returnToId={returnToId}
          onTemplate={goToTemplate}
          onEntry={(id) => goToEntry(id, null, null, true)} />
      )}
      {view === 'about' && (
        <InfoPage kind="about" onHome={goHome} onBrowse={goToBrowse} />
      )}
      {view === 'method' && (
        <InfoPage kind="method" onHome={goHome} onBrowse={goToBrowse} />
      )}
      {view === 'privacy' && (
        <InfoPage kind="privacy" onHome={goHome} onBrowse={goToBrowse} />
      )}
      <Footer onHome={goHome} onBrowse={goToBrowse}
        onAbout={() => setView('about')} onMethod={() => setView('method')}
        onPrivacy={() => setView('privacy')} />
    </div>
  );
}

