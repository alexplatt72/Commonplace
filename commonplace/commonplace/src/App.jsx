import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────────
let MANIFEST = [];      // loaded once from /entries/manifest.json
let ENTRY_CACHE = {};   // full entries loaded on demand
let SEARCH_INDEX = [];  // richer search data: aliases, themes, indexTerms
let FUSE = null;        // Fuse.js instance, initialised after searchIndex loads


const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f4f1eb; }
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
  "Creative Figure":   ["theFigure","whatMadePossible","bodyOfWork","whatTheyChanged","howBeenRead"],
  "Thinker":           ["theFigure","worldOfIdeas","centralIdea","howSpread","contestedInheritance"],
  "Narrative":         ["theWork","momentOfMaking","whatItDoes","whatItChanged","howBeenRead"],
  "Non-narrative":     ["theWork","momentOfMaking","centralArgument","whatItChanged","contestedReading"],
  "Foundational Text": ["theText","momentOfMaking","whatItClaims","interpretiveEcosystem","usedAndWeaponized"],
  "Analytical Concept":["theConcept","problemItSolves","howItWorks","whatItExplains","whereItBreaksDown","usedAndMisusedC"],
  "Normative Concept": ["theConcept","problemItAddresses","competingTraditions","politicalStakes","contestedHistoryC","whereDebateStands"],
  "Period":   ["thePeriod","theBoundaries","theConditions","internalDiversity","longConsequences","periodizationDebate"],
  "Movement": ["theMovement","theOrigins","howItOrganized","whatItAchieved","contestedLegacy","whyItEnded"],
  "Site":     ["thePlace","physicalWorld","theLayers","whatItBecame","whoClaimsIt","theLongLife"],
  "System":   ["theSystem","physicalLogic","whatMovedThrough","whoOrganizedIt","whatItMadePossible","theLongLifeS"],
  "Natural Event": ["thePhenomenon","theScience","whatItDid","howHumansUnderstoodIt","whatChanged","theLongShadow"],
  "Natural Force": ["theForce","theScience","howItShaped","humanResponse","whatItMadeImpossible","presentAndFuture"],
  "Policy Landscape": ["theLandscape","theHistoricalArc","theValueFramework","theEvidenceEcosystem","theInternationalComparison","theCurrentDebates"],
  "Policy Question": ["theQuestion","theStakes","theValueFramework","theEvidence","theOptions","theInternationalEvidence"],
  "Material Foundation":    ["theFoundation","howItArrived","whatItReorganized","thePoliticalEconomy","theFeedback","presentAndFuture"],
  "Conceptual Foundation":  ["theFoundation","howItArrived","whatItReorganized","theTransmission","theFeedback","presentAndFuture"],
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
  contestedInheritance:"The Contested Inheritance", theWork:"The Work",
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
  theMovement:"The Movement", theOrigins:"The Origins", howItOrganized:"How It Organized",
  whatItAchieved:"What It Achieved", contestedLegacy:"The Contested Legacy",
  whyItEnded:"Why It Ended or Transformed",
  thePlace:"The Place", physicalWorld:"The Physical World", theLayers:"The Layers",
  whatItBecame:"What It Became", whoClaimsIt:"Who Claims It", theLongLife:"The Long Life",
  theSystem:"The System", physicalLogic:"The Physical Logic",
  whatMovedThrough:"What Moved Through It", whoOrganizedIt:"Who Organized It",
  whatItMadePossible:"What It Made Possible", theLongLifeS:"The Long Life",
  thePhenomenon:"The Phenomenon", theScience:"The Science",
  whatItDid:"What It Did to Human Civilization",
  howHumansUnderstoodIt:"How Humans Understood It",
  whatChanged:"What Changed Because of It", theLongShadow:"The Long Shadow",
  theForce:"The Force", howItShaped:"How It Shaped Human History",
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
  "Accessible":    { color:"#1d3461", bg:"#e8eef8", border:"#6080c0" },
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

function RabbitHole({ links, depth, navigateTo }) {
  const dl = depth === "beginner" ? "Beginner" : "General";

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
        Links open at <strong style={{ color:C.muted }}>{dl}</strong> — matching where you are now. Heavier connections first.
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
      <div style={{ fontFamily:"'Lora',serif", fontSize:14, color:C.muted, fontStyle:"italic", marginBottom:24, paddingBottom:16, borderBottom:`1px solid ${C.border}`, lineHeight:1.6 }}>
        Sources rated on two axes: <strong style={{ color:C.text }}>Reliability</strong> (trustworthiness of method) and <strong style={{ color:C.text }}>Contribution</strong> (value to this subject).
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
                <span style={{ padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap", color:rel.color, background:rel.bg, border:`1px solid ${rel.border}` }}>R: {item.reliability}</span>
                <span style={{ padding:"2px 8px", borderRadius:3, fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:500, letterSpacing:"0.04em", whiteSpace:"nowrap", color:con.color, background:con.bg, border:`1px solid ${con.border}` }}>C: {item.contribution}</span>
              </div>
            </div>
            <p style={{ fontFamily:"'Lora',serif", fontSize:13.5, lineHeight:1.65, color:C.muted }}>{item.annotation}</p>
          </div>
        );
      })}
    </div>
  );
}

function CommerceSection({ items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{ width:3, height:20, background:"#1d4ed8", borderRadius:2 }} />
        <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:C.text }}>Books, Documentaries & Resources</h3>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:8 }}>
        {items.map((item,i) => (
          <div key={i} style={{ padding:"14px 16px", background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:6 }}>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"#1d4ed8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>{item.type}</div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:14, fontStyle:"italic", fontWeight:600, color:C.text, marginBottom:3 }}>{item.title}</div>
            {item.author && <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted, marginBottom:4 }}>{item.author}</div>}
            <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted }}>{item.note}</div>
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
  const [depth, setDepth] = useState("general");
  const [tab, setTab] = useState("content");
  const showPopularCulture = depth === "beginner" && entry.popularCulture;
  const showComparative = depth === "general" || depth === "educational";
  const showRabbitHole = depth === "beginner" || depth === "general";
  const showCommerce = depth === "general" || depth === "educational" || depth === "advanced";
  return (
    <div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", borderTop:`4px solid ${accent}`, marginBottom:2 }}>
        <div style={{ padding:"24px 40px 0" }}>
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
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"36px 40px" }}>
        {tab === "content" ? (
          <>
            <ContentView entry={entry} depth={depth} />
            {depth !== "research" && <GoDeeper currentDepth={depth} hasResearch={!!(entry.research && entry.research.length)} onChange={setDepth} accent={accent} />}
            <div style={{ borderTop:`1px solid ${C.border}`, marginTop:44, paddingTop:36 }}>
              {showPopularCulture && <PopularCulture items={entry.popularCulture} />}
              {showComparative && <ComparativeNarrative perspectives={entry.comparativeNarrative} summary={entry.comparativeSummary} />}
              {showRabbitHole && <RabbitHole links={entry.rabbitHole} depth={depth} navigateTo={navigateTo} />}
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
  Events:            { question:"What happened, and what did it set in motion?",      desc:"Moments that altered the structure of what followed",               icon:"◈" },
  People:            { question:"How did this person exercise power, and what did it change?", desc:"Figures whose exercise of power changed what was possible", icon:"◉" },
  Works:             { question:"What did this work do to the people who encountered it?", desc:"Texts and creations that reorganized thought and culture",       icon:"◇" },
  "Concepts":        { question:"How did this idea alter what was thinkable?",         desc:"Ideas that changed what people could think, argue, or do",          icon:"◎" },
  Periods:           { question:"What made this moment coherent, and what did it produce?", desc:"Epochs and movements with coherent internal logic",            icon:"◫" },
  Places:            { question:"How has this location been inhabited and remembered?", desc:"Locations whose significance exceeds their geography",             icon:"◬" },
  "Natural Phenomena":{ question:"How did this force shape what civilization could do?", desc:"Forces of nature that shaped the conditions of civilization",     icon:"◭" },
  Policy:            { question:"What values are in genuine tension here?",            desc:"Live questions where values, evidence, and institutions collide",    icon:"◮" },
  Foundations:       { question:"Did this substrate fundamentally reorganize what civilization could do?", desc:"The substrates — material and conceptual — that civilization was built on", icon:"◯" },
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
      style={{ display:"block", width:"100%", textAlign:"left", padding: compact ? "14px 16px" : "18px 20px",
        background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${accent}`,
        borderRadius:6, cursor:"pointer", transition:"all 0.12s",
        boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
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

function HomeView({ onSearch, onTemplate, onEntry }) {

  const totalEntries = MANIFEST.length;

  // Featured: placeholder selection — will be replaced by date-driven editorial rotation
  const featuredIds = ['wheat', 'slaveTrade', 'democracy', 'mosquitoes']
    .filter(id => MANIFEST.find(e => e.id === id));

  return (
    <main id="main-content" style={{ maxWidth:960, margin:"0 auto", padding:"40px 40px 80px" }}>

      {/* Platform statement */}
      <div style={{ textAlign:"center", marginBottom:44 }}>
        <img src="/tcp_logo_transparent.png" alt="TheCommonPlace logo"
          style={{ display:"block", margin:"0 auto 16px", width:"360px", maxWidth:"90%", objectFit:"contain" }} />
        <h1 style={{ fontFamily:"'DM Serif Display',serif", fontSize:52, fontWeight:400,
          color:C.text, lineHeight:1, letterSpacing:"-0.01em", margin:"0 auto 16px" }}>
          TheCommonPlace
        </h1>
        <p style={{ fontFamily:"'Lora',serif", fontSize:15, color:C.muted, lineHeight:1.7,
          maxWidth:560, margin:"0 auto 6px" }}>
          Every subject here changed what was possible — what could be built, thought, governed, or understood.
        </p>
        <p style={{ fontFamily:"'Lora',serif", fontSize:13, color:C.light, fontStyle:"italic",
          maxWidth:480, margin:"0 auto" }}>
          Not a catalogue. A canon. {totalEntries} subjects selected for the understanding they unlock.
        </p>
      </div>

      {/* Category grid */}
      <section aria-label="Browse by category" style={{ marginBottom:52 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
          textTransform:"uppercase", color:C.light, marginBottom:20 }}>
          Browse by category
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
          {Object.entries(TEMPLATE_CONFIG).filter(([_, cfg]) => cfg.active).map(([name, cfg]) => {
            const meta = TEMPLATE_META[name] || {};
            const count = MANIFEST.filter(e => e.template === name).length;
            return (
              <button key={name} onClick={() => onTemplate(name)}
                aria-label={`Browse ${name} — ${count} entries`}
                style={{ padding:"18px 20px", background:C.surface, border:`1px solid ${C.border}`,
                  borderTop:`3px solid ${cfg.accent}`, borderRadius:6, cursor:"pointer",
                  textAlign:"left", transition:"all 0.12s" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700,
                    letterSpacing:"0.08em", textTransform:"uppercase", color:cfg.accent }}>
                    {name}
                  </span>
                  <span aria-hidden="true" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9,
                    color:C.light, background:C.bg, padding:"2px 7px", borderRadius:10 }}>
                    {count}
                  </span>
                </div>
                <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.muted, lineHeight:1.5,
                  fontStyle:"italic" }}>
                  {meta.question || ''}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured entries — placeholder for date-driven editorial rotation */}
      <section aria-label="Featured entries">
        <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:16 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
            textTransform:"uppercase", color:C.light }}>
            Featured
          </div>
          <div style={{ fontFamily:"'Lora',serif", fontSize:12, color:C.light, fontStyle:"italic" }}>
            Selections rotate with the calendar
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
          {featuredIds.map(id => {
            const entry = MANIFEST.find(e => e.id === id);
            return entry ? <EntryCard key={id} id={id} entry={entry} onClick={onEntry} /> : null;
          })}
        </div>
      </section>

    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE GALLERY VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function TemplateGallery({ templateName, onEntry, onHome }) {
  const cfg = TEMPLATE_CONFIG[templateName] || {};
  const meta = TEMPLATE_META[templateName] || {};
  const accent = cfg.accent || '#555';
  const sortKey = t => (t || '').replace(/^the\s+/i, '').toLowerCase();
  const entries = MANIFEST.filter(e => e.template === templateName)
    .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
    .map(e => [e.id, e]);

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"32px 40px 80px" }}>

      {/* Back + Header */}
      <button onClick={onHome}
        style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:28,
          padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:4, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
          fontSize:10, letterSpacing:"0.06em", color:C.muted }}>
        ← Home
      </button>

      <div style={{ borderLeft:`4px solid ${accent}`, paddingLeft:20, marginBottom:40 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, letterSpacing:"0.12em",
          textTransform:"uppercase", color:accent, marginBottom:6 }}>
          {templateName} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
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

      {/* Entry grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
        {entries.map(([id, entry]) => (
          <EntryCard key={id} id={id} entry={entry} onClick={onEntry} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH RESULTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function SearchResultsView({ initialQuery, onEntry, onHome, onSearch }) {
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState(() => searchEntries(initialQuery));

  const handleSearch = (q) => {
    setQuery(q);
    setResults(searchEntries(q));
  };

  const totalEntries = MANIFEST.length;

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"32px 40px 80px" }}>

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
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
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
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10 }}>
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

function EntryViewWrapper({ entryId, onHome, onTemplate, onEntry }) {
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
    const entryUrl   = `https://www.thecommonplace.dev/entry/${entryId}`;

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
  if (!entry) return null;
  const cfg = TEMPLATE_CONFIG[entry.template] || {};
  const accent = cfg.accent || '#555';

  return (
    <div style={{ maxWidth:960, margin:"0 auto", padding:"24px 40px 80px" }}>

      {/* Breadcrumb */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        <button onClick={onHome}
          style={{ padding:"4px 10px", background:"transparent", border:`1px solid ${C.border}`,
            borderRadius:3, cursor:"pointer", fontFamily:"'JetBrains Mono',monospace",
            fontSize:9, letterSpacing:"0.06em", color:C.muted }}>
          Home
        </button>
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
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function CommonplaceApp() {
  const [manifestLoaded, setManifestLoaded] = React.useState(false);
  const [view, setView] = React.useState('home'); // 'home' | 'template' | 'search' | 'entry'
  const [activeTemplate, setActiveTemplate] = React.useState(null);
  const [activeEntryId, setActiveEntryId] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [headerQuery, setHeaderQuery] = React.useState('');
  const [acResults, setAcResults] = React.useState([]); // autocomplete suggestions
  const [acOpen, setAcOpen] = React.useState(false);

  React.useEffect(() => {
    // Load manifest + search index in parallel
    Promise.all([
      fetch('/entries/manifest.json').then(r => r.json()),
      fetch('/searchIndex.json').then(r => r.json()).catch(() => []),
    ]).then(([manifest, searchIdx]) => {
      MANIFEST = manifest;
      SEARCH_INDEX = searchIdx;
      if (searchIdx.length > 0) initFuse(); // initialise Fuse once data is ready
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

  const goHome = () => setView('home');
  const goToTemplate = (t) => { setActiveTemplate(t); setView('template'); };
  const goToEntry = (id) => {
    if (!MANIFEST.find(e=>e.id===id)) return;
    setActiveEntryId(id);
    setView('entry');
  };
  const doSearch = (q) => {
    if (!q.trim()) return;
    setSearchQuery(q);
    setHeaderQuery(q);
    setView('search');
  };

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
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <style>{FONTS}</style>

      {/* Header */}
      <header role="banner" style={{ background:C.navy, borderBottom:`3px solid ${accent}`,
        transition:"border-color 0.3s", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding:"0 40px", display:"flex",
          alignItems:"center", gap:14, height:54 }}>

          {/* Home button — minimal, no wordmark */}
          <button onClick={goHome} aria-label="Go to homepage"
            style={{ background:"transparent", border:"none", cursor:"pointer",
              flexShrink:0, padding:"4px 8px", color:"rgba(255,255,255,0.5)",
              fontFamily:"'JetBrains Mono',monospace", fontSize:10,
              letterSpacing:"0.08em", textTransform:"uppercase" }}>
            Home
          </button>

          {/* Search — fuzzy, always visible */}
          <div style={{ flex:1, maxWidth:440, position:"relative" }}>
            <form role="search" onSubmit={e => { e.preventDefault(); setAcOpen(false); doSearch(headerQuery); }}
              style={{ display:"flex", gap:6 }}>
              <input
                aria-label="Search the canon"
                value={headerQuery}
                onChange={handleHeaderChange}
                onFocus={() => acResults.length > 0 && setAcOpen(true)}
                onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                placeholder="Search the canon…"
                style={{ flex:1, padding:"7px 12px", fontFamily:"'Lora',serif", fontSize:13,
                  color:"#f8f8f0", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
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

        </div>
      </header>

      {/* Views */}
      {view === 'home' && (
        <HomeView onSearch={doSearch} onTemplate={goToTemplate} onEntry={goToEntry} />
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
          onTemplate={goToTemplate} onEntry={goToEntry} />
      )}
    </div>
  );
}

