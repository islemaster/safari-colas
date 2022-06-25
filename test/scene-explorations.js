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

  t.test(`Cass Dream`, async t => {
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
      `It is a memorable face.`,
      `everything is prepared for the hunt.`,
      `The crossbow can attack from a distance.`,
      `You attend to one of the thoughts.`,
      `We’ve reached the mountains.`,

    ]);
    const exploration = await player.exploreTo([`Cass/Morning/Beat 1`]);
    t.true(exploration.fullyExplored);
    t.end();
  });
});