# Hook audit — batch 2 (top-22 by lexical redundancy)

model: claude-opus-4-8 (in-session) · advisory only, nothing applied · queue source: `/tmp/hook_prioritize.cjs` (ranked all 1,000)

## The batch-2 finding (different from batch 1)

Batch 1 was **bloated hook / tight summary** → trim the hook. The highest-lexical-overlap entries in batch 2 are often the opposite: **the hook and the summary (or the General opening) were written as near-twins** — and frequently the *summary cloned a strong hook*, or the *General layer re-runs the hook's own device*. So the fix is **not always the hook**. Remediation splits across **three fields**:

| Bucket | Fix | Count | Entries |
|---|---|---|---|
| **A — trim the hook** (hook carries a catalogue the summary/General already owns) | edit hook | 13 | billOfRights, haudenosauneeConfederacy, captainCooksPacificVoyages, indianOceanSlaveTrade, bartolomeDeLasCasas, hipHop, zapotec, timuridEmpire, gokturks, treatyOfWaitangi, taino, marcusGarvey, goryeoDynasty |
| **B — keep hook, fix the SUMMARY** (hook is the stronger twin; summary echoes it) | edit summary | 7 | sistineChapelCeiling, impressionism, elNino, greatLeapForward, blackHoles, usConstitution, kamaSutra |
| **C — keep hook, fix the GENERAL opening** (General para re-runs the hook's device) | edit general[0] | 3 | hanDynasty, songDynasty, kamaSutra |

**This is the answer to your original "content-rewrite vs presentation/labeling" question:** it's mostly content, but spread over *three* surfaces — and for a real minority (buckets B/C, ~9 of 22) **the hook is fine and the summary or General opening is what duplicates.** Editing summaries touches cards/search/SEO, and editing General openings touches the reading text — so those two buckets need your explicit call before I touch them.

---

## Bucket A — proposed hook trims (ready to apply on your OK)

**billOfRights** — hook is a near-verbatim clone of the summary (same opening list, same "promise was written first…" close).
> **Rewrite →** These are among the most quoted words in American law — and at birth they were nearly toothless. The Bill of Rights bound only the federal government, not the states where people actually lived, and left the enslaved, women, and Native nations outside its protection. It took the Fourteenth Amendment and two centuries of court fights to turn the promise into something you could hold a government to.

**haudenosauneeConfederacy** — hook repeats *itself* ("carried… in memory and wampum" twice) and clones the summary.
> **Rewrite →** The oldest living constitution in North America was never written down. The Haudenosaunee Great Law of Peace, memorized and recited from belts of wampum beads, bound five warring nations into a single council — and gave clan mothers the power to choose its chiefs and to strip any who failed their people. It has governed this way for centuries, and it still meets today.

**captainCooksPacificVoyages** — hook ≈ summary (rarely-first / drew-onto-map / both-truths).
> **Trim →** James Cook was among the finest navigators who ever lived — and almost nowhere he charted was empty. The peoples of the Pacific had lived on those coasts for centuries, in Australia for tens of thousands of years; what Cook did was draw them, with startling accuracy, onto the European map. Behind that map came the settlers, missionaries, and disease, so the same voyages that advanced science were the advance scouts of dispossession.

**indianOceanSlaveTrade** — hook's monsoon-winds clause duplicates the General opening's image.
> **Trim →** Most people know the Atlantic slave trade. Fewer know the one that was older, ran longer, and scattered its descendants from Iraq to India — an enormous system that carried enslaved people across the Indian Ocean toward Arabia, Persia, and India for more than a thousand years. It is the great forgotten counterpart to the trade the West cannot forget.

**bartolomeDeLasCasas** — 169w mini-biography that mirrors the summary.
> **Trim →** Bartolomé de las Casas spent fifty years telling the Spanish crown that its conquest of the Americas was mass murder — and he began as one of the profiteers. As a young settler he held an encomienda, a grant of Indigenous labor, and grew rich on it, until around 1514 the slaughter he had watched turned him into his own nation's most relentless accuser. He was no spotless saint: he once urged shipping enslaved Africans to spare the Indians, a proposal he later damned as sin. The founder of a human-rights argument had first to unlearn the cruelty of his own age.

**hipHop** — keep the burning-city framing; the Kool Herc turntable mechanics are in both summary and General opening.
> **Trim →** The city was burning. In the South Bronx of the early 1970s, landlords torched buildings for the insurance, the factories had fled, and the poorest Black and Latino kids in New York were written off as a lost generation. With almost nothing, they built an entire culture out of two turntables, a microphone, a spray can, and their own bodies — and within thirty years the sound made in the rubble ruled American music and spread across the world.

**zapotec** — keep the "chose a mountain, cut its top off" opening; drop the glyph/calendar catalogue (summary owns it).
> **Trim →** To build their capital, the Zapotec did not choose a hill. They chose a mountain — and then cut its top off, leveling a ridge four hundred metres above the Valley of Oaxaca, with no metal tools and no draft animals, to raise the city of Monte Albán. Its people never vanished: their descendants still fill Oaxaca today, and call themselves the Be'ena'a — the People.

**timuridEmpire** — keep the skulls-and-beauty frame; drop the Ulugh Beg / miniature / Babur catalogue (summary + General own it).
> **Trim →** Timur the Lame built beauty on a mountain of skulls. From Samarkand he cut an empire across Central Asia and Persia in a storm of massacre — and then the dynasty he founded turned the plunder into one of the most brilliant cultural ages the Islamic world has known. The conqueror and the patron of genius were the same family, and often the same man.

**gokturks** — keep the Orkhon-inscription angle; drop the empire catalogue (summary owns it).
> **Trim →** For the first time in any surviving Turkic writing, a steppe people cut its own political memory into stone, in its own language: the Orkhon inscriptions of Mongolia, raised around 732, in which a dead king warns his people in the first person not to trade their freedom for Chinese silk and soft living. They are the founding words of the very people who gave the world the term "Turk."

**treatyOfWaitangi** — drop the transliterated terms (summary carries them); keep the human drama.
> **Trim →** In 1840, the British Crown and some 540 Māori chiefs signed one treaty in two languages — and the two languages did not promise the same thing. Where the English text had the chiefs surrender their "sovereignty," the Māori text almost all of them actually signed gave up far less, and kept authority over their own lands and people. Within decades the Crown ruled as if they had signed the English, a court dismissed the treaty as a "simple nullity," and Māori lost most of their country. The gap between the two texts is now the frame through which a nation is still trying to make itself whole.

**taino** — lead with the loanwords (the hook's one asset not in summary/General); compress the rest.
> **Trim →** Hurricane, hammock, canoe, barbecue: the Taíno gave English all four before most of them were gone. They were the people who met Columbus on a Caribbean beach in 1492, and within a single generation enslavement and disease had killed the overwhelming majority — one of the swiftest collapses on record. Declared extinct for centuries, they were not: their descendants are overturning that colonial story now.

**marcusGarvey** — 206w life-story; keep the frame + arc + afterlife, drop the catalogue (summary/body own it).
> **Trim →** Marcus Garvey told millions of Black people to look up. A Jamaican printer with a booming voice, he built in the 1910s and 1920s the largest organized movement of people of African descent the world had ever seen, on a message electric and simple: Africa's scattered children were one people, with a proud past and a future they could seize. His steamship line went bankrupt, a contested fraud conviction sent him to prison and then into exile, and he died in London in 1940 with his empire scattered. But the pride he planted outlived him — into African independence, the civil rights movement, and the Rastafari who took his words as prophecy.

**goryeoDynasty** — drop the woodblock-canon story (the General opening owns it, in detail); keep the two sharpest facts.
> **Trim →** The English word "Korea" comes from Goryeo, a Buddhist kingdom whose name traders carried west. It was also, in 1377, the place that printed a book with movable metal type — the Jikji, cast decades before Gutenberg in Europe made a single letter.

---

## Bucket B — keep the hook, fix the SUMMARY (needs your call; touches cards/search/SEO)

In each, the **hook is the stronger writing** and the **summary reads as a clone of it**. Recommend rewriting the *summary* to lead with the plain definition and let the hook keep the drama.
- **sistineChapelCeiling** — summary copies the hook's beats (four years / sculptor-not-painter / 1512 / Adam's gap / most-reproduced).
- **impressionism** — both open "the name was an insult"; summary echoes the whole arc.
- **greatLeapForward** — summary is nearly the hook re-typed (pots→furnaces→useless iron→fictional harvests→15–45M).
- **blackHoles** — summary repeats mass/light/event-horizon + the evidence list + singularity.
- **elNino** — summary repeats the mechanism + effects list + the Christ-Child naming.
- **usConstitution** — summary repeats Philadelphia-1787 / three-branches / oldest-in-force / slavery-bargain / three-fifths.
- **kamaSutra** — summary repeats "misunderstood as a sex manual → actually about kama → one part of one of seven books."

## Bucket C — keep the hook, fix the GENERAL opening (needs your call; touches the reading text)

The General layer's first sentences re-run the hook's exact device, so on the deeper layers the reader sees the same line twice.
- **hanDynasty** — hook: "call themselves Han… the measure of what the Han built"; General[0]: "call themselves Han… the simplest measure of what this period produced." (near-identical)
- **songDynasty** — hook lists the inventions + "did not industrialize / why is the central question"; General[0] makes the same move.
- **kamaSutra** — General[0] re-runs the "say the words… most picture a sex manual… a distortion" reveal.

---

## Corpus scale (from the ranked pass over all 1,000)

- **744 / 1,000** hooks are long (≥90 words) — but length alone is not the defect.
- Lexical redundancy (hook vs its own summary / General opening): **19** at ≥0.45 (heavy), **132** at 0.30–0.45 (moderate), **849** low.
- The deterministic metric is a **high-precision floor** — it misses paraphrase (earthquakes/jazz/opera from batch 1 didn't rank). A full headless LLM sweep (needs `@anthropic-ai/sdk` — now installed — plus your `ANTHROPIC_API_KEY`) is what catches the thematic cases at scale: `node hook_audit.cjs --sample 60`.
