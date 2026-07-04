# Hook audit — batch 1 (15 entries)

model: claude-opus-4-8 (in-session; scaled headless run needs `npm i @anthropic-ai/sdk` + key) · **advisory only, nothing applied**

Goal: make the reader know where they are and why to continue. **Length is not the metric** — each hook is judged against its own summary and the general-layer opening.

## Tally

| Verdict | Count | Entries |
|---|---|---|
| ✅ strong — **keep** | 6 | leonardo, rousseau, blackDeath, printingPress, silkRoad, photosynthesis\* |
| ✂️ buried — **trim** (author's own words) | 7 | earthquakes, tamerlane, englishCivilWar, olmec, jazz, dna, fertilizer |
| ✍️ expository — **rewrite** | 2 | charlemagne, opera |

\*photosynthesis: hook is strong; the redundancy is with the **summary** (see note) — a presentation fix, not a hook fix.

**Headline:** ~13% need a real rewrite. ~47% just need the summary/exposition glued onto the end **cut off** — the author already wrote a fine hook; it's the first 1–3 sentences. And a slice of the "problem" is actually the **summary or general-opening duplicating the hook**, which is a layout/labeling fix, not a content one.

---

## KEEP (strong hooks — proof that long ≠ bad)

**leonardo** (25w) · `strong` · none
> Leonardo da Vinci was the last person who could know everything — and the first person who understood that knowing everything was the same activity.
One idea, one turn, stop. The house style.

**rousseau** (66w) · `strong` · none
> …His ideas on education shaped how the modern world raises children. And he abandoned all five of his own children to an orphanage.
66 words, but the idea-list earns a devastating twist. Not in the summary. **This is why the rule can't be "shorten."**

**blackDeath** (54w) · `strong` · none — the "In four years." fragment lands; the "what it revealed… was as consequential as the killing" sets the entry's real angle.

**printingPress** (43w) · `strong` · none — single tension (monopoly on knowledge → broken), stops clean.

**silkRoad** (45w) · `strong` · none — "It was not primarily about silk" reframes in one move.

**photosynthesis** (112w) · `strong` hook, but **redundancy: summary** · problemType **presentation**
> Almost everything you have ever eaten began as sunlight… the oxygen they released was a poison that killed most of the life around them.
The hook is the *stronger* twin. The **summary** re-hits the same three beats (sunlight→sugar→O₂, Great Oxidation poison). Fix is to trim the *summary*, not the hook — a presentation call.

---

## TRIM (buried hook — cut the summary/exposition off the end; keep the author's opening)

**earthquakes** (144w) · `buried` · redundancy: **summary** (buildings-kill, Haiti, can't-predict are all in the summary right above it)
> **Trim →** The ground is the one thing we trust without thinking. Then, for thirty terrible seconds, it betrays you, and the most solid fact in your world turns to liquid.
Stop there — the "earthquakes don't kill people, buildings do" thesis is the summary's literal first line.

**tamerlane** (166w) · `buried` · redundancy: **summary + general-opening** (campaign checklist repeated in both)
> **Trim →** He could not call himself khan, so he made the world fear him as something worse. Barred from the title because he was no son of Genghis, Timur ruled through puppet khans and married into the line — and for thirty-five years he marched, sparing the cities that surrendered and stacking the heads of those that resisted into towers.

**englishCivilWar** (154w) · `buried` · redundancy: **general-opening** (the scaffold scene is re-run almost verbatim as the general layer's first paragraph)
> **Trim →** On a cold January morning in 1649, a king of England walked onto a scaffold outside his own palace and laid his head on the block — tried in open court by his own subjects, convicted as a tyrant, and beheaded before a silent crowd. No reigning monarch had ever been judged and killed by the people he ruled, and the idea that even a king must answer to the law had been written in blood.
Note: because the general layer opens on the *same* scene, decide who keeps it (a presentation call).

**olmec** (147w) · `buried` · redundancy: **general-opening** (San Lorenzo/basket-loads scene) — but the hook's opening scene + closing question are strong
> **Trim →** Sometime around 1200 BCE, workers on the Gulf Coast of Mexico dragged twenty-ton blocks of basalt some eighty kilometers across swamp and river — without wheels, metal tools, or pack animals — and carved them into colossal portrait heads of their rulers. We cannot read their writing or even say what they called themselves; the one large question is how much of everything that followed in Mesoamerica began with them.

**jazz** (153w) · `buried` · redundancy: **summary** (Armstrong/Ellington/Parker roll-call is the summary)
> **Trim →** It is the music America made and then refused, for decades, to call art. Born around 1900 in Black New Orleans among the grandchildren of enslaved people — in a country that segregated, cheated, and policed them — jazz became the sound of a people inventing a freedom in music that their country denied them in life.
Keeps both killer bookends; drops the middle history the summary already tells.

**dna** (112w) · `buried` · redundancy: **summary** (double-helix / unified-biology tail)
> **Trim →** On the morning of February 28, 1953, Francis Crick walked into the Eagle pub in Cambridge and announced that he and James Watson had found 'the secret of life.' It was an unusual claim for a Tuesday morning. It turned out to be approximately correct.
The double-helix explanation is the summary's job.

**fertilizer** (140w) · `buried` · redundancy: **neither** (low) — the only defect is a thesis-*tell* ending
> **Trim →** Fritz Haber won the Nobel Prize in Chemistry in 1918. He also ran Germany's chemical-weapons program, overseeing the first chlorine gas at Ypres in 1915; his wife killed herself in protest, and he died a Jewish refugee from the Germany he had served. His most consequential work was none of that — it was pulling nitrogen from the air to make synthetic fertilizer, the same discovery that now feeds roughly half the people alive.
Cut the final "This is a story about… that refuses any simple interpretation" — it tells the reader what to think instead of showing it.

---

## REWRITE (the opening itself is expository/redundant)

**charlemagne** (94w) · `expository` middle + redundant tail (France/Germany/EU restates the summary and recurs at the entry's end)
> **Rewrite →** On Christmas Day, 800 CE, Pope Leo III set a crown on Charlemagne's head and hailed him Emperor of the Romans — a title, his own biographer swears, he neither sought nor saw coming. In that instant a pope revived an empire three centuries dead and claimed the right to *make* emperors, a claim that would pit church against crown for the next thousand years.

**opera** (195w) · `expository` — reads as an encyclopedia intro; triples with the summary **and** the general-opening (both cover born-1600 / sing-not-speak / castrati / expensive)
> **Rewrite →** Opera asks the human voice to do what speech cannot: a character in love, in terror, or about to die does not say so — she sings it, at the limit of the voice, over a full orchestra, until the feeling fills a hall. It is the art that refuses to let drama be merely spoken.
Drops the born-1600/castrati/expensive material — the summary and body already carry it.
