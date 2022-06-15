/*
Tests that explore every path through the game, per-player.
Checks for errors and dead-ends, and the expected size of the possibility space.

WARNING! These are very slow, can take 30s or more to finish.
*/

const test = require('tape');
const SyntheticPlayer = require('./SyntheticPlayer');

test('Full Explorations', async t => {
  const player = new SyntheticPlayer();
  await player.setup();
  t.teardown(async () => await player.teardown());

  t.test(`Cassia`, async t => {
    await player.restart();
    await player.walk(['Play as Cassia']);

    const exploration = await player.exploreTo([`Cass/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 312);
    t.equal(exploration.convergences, 232);
    t.equal(exploration.terminalStates, 9);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Flora`, async t => {
    await player.restart();
    await player.walk(['Play as Flora']);

    const exploration = await player.exploreTo([`Flora/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 342);
    t.equal(exploration.convergences, 244);
    t.equal(exploration.terminalStates, 12);
    t.true(exploration.fullyExplored);
    t.end();
  });
});