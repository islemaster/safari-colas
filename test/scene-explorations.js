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
    await player.walkTo('Cass/Sleeper/Beat 2', [
      'Play as Cassia'
    ]);
    const exploration = await player.exploreTo([`Cass/Morning/Beat 1`]);
    t.true(exploration.fullyExplored);
    t.end();
  });
});