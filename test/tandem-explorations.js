/*
Tests that use two simulated players to walk through the game
and simulate the keyword-passing mechanic, looking for scenarios
where we are stuck because each player is waiting on a keyword
from the other.  For example, this could happen if we forget to
put a 'readaloud' annotation in a passage.
*/

const test = require('tape');
const SyntheticPlayer = require('./SyntheticPlayer');

test('Tandem Explorations', async t => {
  t.test(`Joint random walk`, async t => {
    const flora = new SyntheticPlayer();
    const cass = new SyntheticPlayer();
    t.teardown(async () => {
      await flora.teardown();
      await cass.teardown();
    });

    await Promise.all([
      (async () => {
        await flora.setup();
        await flora.walk(['Play as Flora']);
      })(),
      (async () => {
        await cass.setup();
        await cass.walk(['Play as Cassia'])
      })()
    ]);

    const eventLog = [];
    const record = (character, text) => {
      if (character == 'Flora') text = ' '.repeat(80) + text;
      eventLog.push(text);
    }

    const decorateForKeywordPassing = player => {
      player.waiting = false;
      player.hasKeyword = false;
      player.gotKeyword = false;
    }
    decorateForKeywordPassing(flora);
    decorateForKeywordPassing(cass);

    const tryStep = async (player) => {
      const character = player.currentKnot.state.playerCharacter;
      if (!player.currentKnot.isAnEnding && !player.waiting && !player.hasKeyword) {
        if (player.gotKeyword) {
          await player.walk([player.gotKeyword]);
          record(character, player.gotKeyword + ' => ' + player.currentKnot.passageName);
          player.gotKeyword = false;
        } else {
          const link = await player.randomWalk();
          record(character, link + ' => ' + player.currentKnot.passageName);
        }

        // Find a readaloud keyword
        if (m = player.currentKnot.html.match(/class="readaloud">([^<]+)/)) {
          player.hasKeyword = m && m[1];
          record(character, `${character} has a keyword: ${player.hasKeyword}`)
        }

        // Find a stop box (both can happen in one knot)
        if (player.currentKnot.html.includes(`class="stop"`)) {
          record(character, `${character} is waiting on a keyword`);
          player.waiting = true;
        } 
        return true; // Advanced
      }
      return false; // Did not advance
    };

    const tryPass = (fromPlayer, toPlayer) => {
      if (fromPlayer.hasKeyword && toPlayer.waiting) {
        toPlayer.gotKeyword = fromPlayer.hasKeyword;
        fromPlayer.hasKeyword = toPlayer.waiting = false;
        eventLog.push(' '.repeat(40) + '-'.repeat(20) + ' KEYWORD EXCHANGE ' + '-'.repeat(20));
      }
    }

    while (!(cass.currentKnot.isAnEnding && flora.currentKnot.isAnEnding)) {
      let moved = await Promise.all([
        tryStep(cass),
        tryStep(flora)
      ]);
      moved = moved.some(x => x);

      tryPass(cass, flora);
      tryPass(cass, flora);

      if (!moved) {
        throw new Error('Got stuck!\n\n' + eventLog.join('\n'));
      }
    }

    t.end();
  });
});