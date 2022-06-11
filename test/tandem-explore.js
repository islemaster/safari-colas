/*
Tests that run two browsers and check lockstep scenarios for the two players.
*/

const test = require('tape');
const Story = require('./Story');

test('Tandem Explorations', async t => {
  t.test(`Validate set paths`, async t => {
    const flora = new Story();
    const cass = new Story();
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

    const floraPlayer = {
      story: flora,
      waiting: false,
      hasKeyword: false,
      gotKeyword: false,
    };

    const cassPlayer = {
      story: cass,
      waiting: false,
      hasKeyword: false,
      gotKeyword: false,
    }

    const step = async (player) => {
      const character = player.story.currentKnot.state.playerCharacter;
      if (!player.story.currentKnot.isAnEnding && !player.waiting && !player.hasKeyword) {
        if (player.gotKeyword) {
          await player.story.walk([player.gotKeyword]);
          record(character, player.gotKeyword + ' => ' + player.story.currentKnot.passageName);
          player.gotKeyword = false;
        } else {
          const link = await player.story.randomWalk();
          record(character, link + ' => ' + player.story.currentKnot.passageName);
        }

        // Find a readaloud keyword
        if (m = player.story.currentKnot.html.match(/class="readaloud">([^<]+)/)) {
          player.hasKeyword = m && m[1];
          record(character, `${character} has a keyword: ${player.hasKeyword}`)
        }

        // Find a stop box (both can happen in one knot)
        if (player.story.currentKnot.html.includes(`class="stop"`)) {
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
      let stuck = true;
      let moved = await Promise.all([step(cassPlayer), step(floraPlayer)]);
      moved = moved.some(x => x);

      tryPass(cassPlayer, floraPlayer);
      tryPass(floraPlayer, cassPlayer);

      if (!moved) {
        throw new Error('Got stuck!');
      }
    }

    console.log(eventLog.join('\n'));

    t.end();
  });
});