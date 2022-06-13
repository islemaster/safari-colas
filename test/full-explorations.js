/*
Tests that explore every path through the game, per-player.
Checks for errors and dead-ends, and the expected size of the possibility space.

WARNING! These are very slow, can take 30s or more to finish.
*/

const test = require('tape');
const Story = require('./Story');

test('Full Explorations', async t => {
  const story = new Story();
  await story.setup();
  t.teardown(async () => await story.teardown());

  t.test(`Cassia`, async t => {
    await story.restart();
    await story.walk(['Play as Cassia']);

    const exploration = await story.exploreTo([`Cass/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 312);
    t.equal(exploration.convergences, 232);
    t.equal(exploration.terminalStates, 9);
    t.true(exploration.fullyExplored);
    t.end();
  });

  t.test(`Flora`, async t => {
    await story.restart();
    await story.walk(['Play as Flora']);

    const exploration = await story.exploreTo([`Flora/Sleeper/Beat 2`]);
    t.equal(exploration.totalKnots, 309);
    t.equal(exploration.convergences, 238);
    t.equal(exploration.terminalStates, 3);
    t.true(exploration.fullyExplored);
    t.end();
  });
});