const fs = require('fs');
const RES = JSON.parse(fs.readFileSync('C:/Users/ALEXAN~1/AppData/Local/Temp/claude/C--Users-Alexander-Berger-Desktop-Commonplace-main-Commonplace-main-commonplace-commonplace-public-entries/012efa93-83ef-4d65-8a77-335b92b97200/tasks/wjnulh1hn.output', 'utf8')).result;
const ONLY = new Set(['juliusCaesar','mahatmaGandhi','leonardo','americanRevolution','constantinople','iliad','coffee','silk','nationalism','imperialism','humanRights','liberalism','revolution']);

const FIX = {
  juliusCaesar: [
    ['theFigure', 'for a single ruler to control Rome.', 'for a single ruler to control the Roman world.'],
    ['theFigure', 'into Italy and took control of the government.', 'into Italy and seized control of the government.'],
    ['theFigure', 'His death did not stop one-man rule.', 'His death did not save Rome from one-man rule.'],
  ],
  mahatmaGandhi: [
    ['centralIdea', "Gandhi's most important political idea was about power.", "Gandhi's most important political insight was about power."],
    ['howSpread', 'The logic spread because it proved useful in different places.', 'The logic spread because it proved effective in different places.'],
    ['howSpread', 'Activists studying how to challenge authoritarian governments have used Gandhi’s example.', 'Activists have used Gandhi’s example to challenge harsh governments.'],
    ['howSpread', 'The boycotts, marches, and willingness to accept arrest in that movement drew directly from satyagraha.', 'The boycotts, marches, and arrests in that movement came directly from satyagraha.'],
  ],
  leonardo: [
    ['theFigure', 'He built up paint in many thin layers.', 'He built up paint in so many thin layers.'],
    ['theFigure', 'He studied how water moves in a stream. He studied how water moves in the veins of a human arm.', 'He studied the same movement of water in a stream and in the veins of a human arm.'],
    ['whyItEndured', 'topics that seem completely unrelated.', 'topics that seem completely unrelated on the surface.'],
    ['whyItEndured', 'remains very remarkable.', 'remains remarkable.'],
    ['howBeenRead', 'The people who knew him recognized he was extraordinary.', 'The people of his own time recognized he was extraordinary.'],
  ],
  americanRevolution: [
    ['secondOrderEffects', 'These were stated as universal truths, not American ones.', 'These were said to be truths for everyone, not just for America.'],
    ['secondOrderEffects', 'Leaders across Africa and Asia invoked its language when demanding freedom from European powers.', 'Leaders across Africa and Asia used its words to demand freedom from European rule.'],
  ],
  constantinople: [
    ['thePlace', 'He needed a city between the eastern and western halves of his vast empire.', 'He wanted a city between the eastern and western halves of his vast empire.'],
    ['physicalWorld', 'The city sat on a peninsula with water on three sides.', 'The city sat on a peninsula protected by water on three sides.'],
    ['physicalWorld', 'Inside those walls grew one of the most great cities in history.', 'Inside those walls grew one of the greatest cities in history.'],
    ['theLongLife', 'a city of very great cultural variety.', 'a city of very great cultural complexity.'],
  ],
  iliad: [
    ['whatItChanged', 'It encoded shared values, good behavior, and a way of understanding the world.', 'It encoded shared values, model behavior, and a way of understanding the world.'],
  ],
  coffee: [
    ['presentAndFuture', 'Some scientists project that suitable land could be cut roughly in half by 2050 if warming continues.', 'Some scientists think the good land could be cut in half by 2050 if warming continues.'],
    ['presentAndFuture', 'The roasted seed that woke Sufi monks in Yemen, fueled Enlightenment arguments in London, and built plantation economies across the tropics is still at work.', 'The roasted seed once woke Sufi monks in Yemen. It fueled arguments in London’s coffeehouses. It built plantation economies across the tropics. It is still at work today.'],
  ],
  silk: [
    ['howItArrived', 'For close to two thousand years, China was the only place producing it.', 'For close to two thousand years, China was effectively the only place producing it.'],
  ],
  nationalism: [
    ['problemItAddresses', 'Paying taxes, serving in the army, following laws — these things are easier when you feel connected to the people around you.', 'Paying taxes, serving in the army, and following laws are easier when you feel connected to the people around you.'],
    ['problemItAddresses', 'The idea that brought freedom to some peoples brought horror to others.', 'The idea that brought liberation to some peoples brought horror to others.'],
    ['contestedHistoryC', 'Having different groups inside one country is likely to cause conflict.', 'Having different groups inside one country is bound to cause conflict.'],
    ['contestedHistoryC', 'They argue that the English, the French, and the Japanese have existed as separate peoples for many hundreds of years.', 'They argue that the English, the French, and the Japanese have been separate peoples for hundreds of years.'],
    ['whereDebateStands', 'It was not fixed and timeless.', 'It was not simply fixed and timeless.'],
  ],
  imperialism: [
    ['theConcept', 'That change tells you a lot about what imperialism is.', 'That change tells you most of what imperialism is about.'],
    ['theConcept', 'A powerful nation can shape a poorer one through money and threats alone.', 'A powerful nation can dominate a poorer one through money and threats alone.'],
    ['whereDebateStands', 'A country can control others through money and the odd intervention without ever ruling them outright.', 'A country can dominate others through money and the odd intervention without ever ruling them outright.'],
  ],
  humanRights: [
    ['theConcept', 'This idea has old roots.', 'This idea has ancient roots.'],
    ['theConcept', 'the German government had killed six million Jewish people and millions of others in a planned way.', 'the German government had murdered six million Jewish people and millions of others in a planned way.'],
    ['contestedHistoryC', 'Philosophers and religious traditions have argued for centuries that people have fundamental dignity that rulers cannot simply ignore.', 'For centuries, thinkers and religions have said that all people have worth. Rulers cannot simply ignore it.'],
    ['contestedHistoryC', 'Historians have pointed out that human rights as a global political force really emerged in the 1970s.', 'Historians say that human rights became a global force only in the 1970s.'],
    ['contestedHistoryC', 'Earlier political movements had promised to transform the world and had not fully delivered.', 'Earlier movements had promised to change the whole world. They had not fully done it.'],
    ['contestedHistoryC', "Whether the system truly represents all of humanity, or mainly one part of humanity's tradition, is a debate that continues.", 'Does the system speak for all of humanity? Or mainly for one part of it? That debate goes on.'],
    ['whereDebateStands', 'The deepest question is whether human rights is a truly universal system or a set of Western values dressed in universal language.', 'The deepest question is simple. Is human rights truly for everyone? Or is it a set of Western values in universal dress?'],
    ['whereDebateStands', 'Genocide is a crime that can be prosecuted internationally.', 'Genocide is a crime that world courts can punish.'],
  ],
  liberalism: [
    ['theConcept', 'This was a bold claim.', 'This was a radical claim.'],
    ['theConcept', 'a group of colonists said that a king had no right to rule them without their agreement.', 'a group of colonists declared that a king had no right to rule them without their agreement.'],
    ['contestedHistoryC', 'Historians still argue about whether this gap was a failure to live up to liberal ideas. Others ask whether it was present in those ideas from the start.', 'Historians still argue about this. Was the gap a failure to live up to liberal ideas? Or was it present in those ideas from the start?'],
    ['whereDebateStands', 'At the same time, many people feel that global markets have made life worse for them. Some people grew very rich.', 'At the same time, many people feel that global markets have made life worse for them, even as some grew very rich.'],
  ],
  revolution: [
    ['howItWorks', 'This shift toward more extreme groups appears in revolution after revolution.', 'This shift toward more extreme factions appears in revolution after revolution.'],
    ['whereItBreaksDown', 'It says the change was legal, that people rose up against real injustice.', 'It says the change was legitimate, that people rose up against real injustice.'],
  ],
};

for (const r of RES) {
  if (!ONLY.has(r.id)) continue;
  const block = {};
  for (const [k, v] of Object.entries(r.block)) block[k] = String(v).split('\\n').join('\n');
  for (const [sec, find, rep] of (FIX[r.id] || [])) {
    if (!block[sec] || !block[sec].includes(find)) { console.log('  !! UNMATCHED ' + r.id + '.' + sec + ': "' + find.slice(0, 50) + '"'); continue; }
    block[sec] = block[sec].replace(find, rep);
  }
  const file = './public/entries/' + r.id + '.json';
  const orig = fs.readFileSync(file, 'utf8');
  const e = JSON.parse(orig);
  e.content = { plainEnglish: block, ...e.content };
  fs.writeFileSync(file, JSON.stringify(e, null, 2) + (orig.endsWith('\n') ? '\n' : ''));
  console.log(r.id + ': repaired + inserted');
}
