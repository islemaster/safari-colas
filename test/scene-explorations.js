/*
Tests that fully explore a particular scene.
Checks for errors and dead-ends.
*/

const test = require('tape');
const SyntheticPlayer = require('./SyntheticPlayer');

test('Scene Explorations', async t => {
  const player = new SyntheticPlayer();
  await player.setup();
  t.teardown(async () => await player.teardown());

  t.test(`Cass Dining conversation with Flora`, async t => {
    await player.restart();
    await player.walk([
      'Play as Cassia',
      `You’re in the dining car.`,
      `take another bite of pheasant.`,
      `isn’t cut out for this after all.`,
      `Flora will too.`
    ]);
    t.match(player.currentKnot.text, /Stop! What did your partner say\?/);

    const exploration = await player.exploreTo([`Cass/Dining/Beat 7`]);
    t.equal(exploration.totalKnots, 279);
    t.equal(exploration.convergences, 181);
    t.equal(exploration.terminalStates, 50);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Cass Baggage car scene`, async t => {
    await player.restart();
    await player.walk([
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
    const exploration = await player.exploreTo([`Cass/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 6);
    t.equal(exploration.convergences, 0);
    t.equal(exploration.terminalStates, 3);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Flora Dining conversation with Cass`, async t => {
    await player.restart();
    await player.walk([
      'Play as Flora',
      `You’re in the dining car.`,
      `You observe in disgust.`,
    ]);
    t.match(player.currentKnot.text, /When in doubt, gather information./);

    const exploration = await player.exploreTo([`Flora/Dining/Beat 4`]);
    t.equal(exploration.totalKnots, 280);
    t.equal(exploration.convergences, 182);
    t.equal(exploration.terminalStates, 50);
    t.true(exploration.fullyExplored);
    t.end();
  });
});