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

    let floraWaiting = false;
    let floraKeyword = false;
    let floraNextStep = false;
    let cassWaiting = false;
    let cassKeyword = false;
    let cassNextStep = false;
    while (!(cass.currentKnot.isAnEnding && flora.currentKnot.isAnEnding)) {
      let stuck = true;

      if (!cass.currentKnot.isAnEnding && !cassWaiting && !cassKeyword) {
        stuck = false;
        if (cassNextStep) {
          await cass.walk([cassNextStep]);
          cassNextStep = false;
        } else {
          await cass.randomWalk();
        }
        // console.log(cass.currentKnot.passageName);

        // Find a readaloud keyword
        if (m = cass.currentKnot.html.match(/class="readaloud">([^<]+)/)) {
          cassKeyword = m && m[1];
          console.log(`Cass has a keyword for flora: ${cassKeyword}`)
        }

        // Find a stop box (both can happen in one knot)
        if (cass.currentKnot.html.includes(`class="stop"`)) {
          console.log('Cass is waiting on Flora');
          cassWaiting = true;
        } 

      }

      if (!flora.currentKnot.isAnEnding && !floraWaiting && !floraKeyword) {
        stuck = false;
        if (floraNextStep) {
          await flora.walk([floraNextStep]);
          floraNextStep = false;
        } else {
          await flora.randomWalk();
        }
        // console.log(flora.currentKnot.passageName);

        if (m = flora.currentKnot.html.match(/class="readaloud">([^<]+)/)) {
          floraKeyword = m && m[1];
          console.log(`Flora has a keyword for cass: ${floraKeyword}`)
        }

        if (flora.currentKnot.html.includes(`class="stop"`)) {
          console.log('Flora is waiting on cass');
          floraWaiting = true;
        } 
      }

      if (cassWaiting && floraKeyword) {
        cassNextStep = floraKeyword;
        cassWaiting = false;
        floraKeyword = false;
      } else if (floraWaiting && cassKeyword) {
        floraNextStep = cassKeyword;
        floraWaiting = false;
        cassKeyword = false;
      }

      if (stuck) {
        throw new Error('Got stuck!');
      }
    }

    t.end();
  });
});