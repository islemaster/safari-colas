/*
Tests that explore a subset of game-space.
*/

const test = require('tape');
const Story = require('./Story');

test('Scene Explorations', async t => {
  const story = new Story();
  await story.setup();
  t.teardown(async () => await story.teardown());

  t.test(`Cass Dining conversation with Flora`, async t => {
    await story.restart();
    await story.walk([
      'Play as Cassia',
      `You’re in the dining car.`,
      `take another bite of pheasant.`,
      `isn’t cut out for this after all.`,
      `Flora will too.`
    ]);
    t.match(story.currentKnot.text, /Stop! What did your partner say\?/);

    const exploration = await story.exploreTo([`Cass/Dining/Beat 7`]);
    t.equal(exploration.totalKnots, 279);
    t.equal(exploration.convergences, 181);
    t.equal(exploration.terminalStates, 50);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Cass Baggage car scene`, async t => {
    await story.restart();
    await story.walk([
      'Play as Cassia',
      `You’re in the dining car.`,
      `take another bite of pheasant.`,
      `isn’t cut out for this after all.`,
      `Flora will too.`,
      `Necklace`,
      `“None of your business.”`,
      `dangerous`,
      `simpler that way.`,
      `a family at another table.`,
      `you feel calmer, watching them.`,
      `leave`,
    ]);
    const exploration = await story.exploreTo([`Cass/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 6);
    t.equal(exploration.convergences, 0);
    t.equal(exploration.terminalStates, 3);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Flora Dining conversation with Cass`, async t => {
    await story.restart();
    await story.walk([
      'Play as Flora',
      `You’re in the dining car.`,
      `You observe in disgust.`,
    ]);
    t.match(story.currentKnot.text, /When in doubt, gather information./);

    const exploration = await story.exploreTo([`Flora/Dining/Beat 4`]);
    t.equal(exploration.totalKnots, 280);
    t.equal(exploration.convergences, 182);
    t.equal(exploration.terminalStates, 50);
    t.true(exploration.fullyExplored);
    t.end();
  });
});