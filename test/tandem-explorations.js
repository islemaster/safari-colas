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
  for (let i = 1; i <= 10; i++) {
    t.test(`Joint random walk ${('00' + i).slice(-2)}`, async t => {
      const eventLog = [];
      const flora = new KeywordPassingPlayer('Flora', eventLog);
      const cass = new KeywordPassingPlayer('Cassia', eventLog);
      t.teardown(async () => {
        await flora.teardown();
        await cass.teardown();
      });
      await Promise.all([flora.setup(), cass.setup()]);
  
      while (!(cass.currentKnot.isAnEnding && flora.currentKnot.isAnEnding)) {
        const moved = (await Promise.all([cass.tryStep(), flora.tryStep()])).some(x => x);
        const passedAKeyword = [cass.tryPassTo(flora), flora.tryPassTo(cass)].some(x => x);
        if (!moved && !passedAKeyword) {
          throw new Error('Got stuck!\n\n' + eventLog.join('\n'));
        }

        // If we see the same event ten times in a row, we got stuck.
        if (eventLog.length >= 10 && eventLog.slice(-10).every((x, _, arr) => x == arr[0])) {
          throw new Error('Got stuck!\n\n' + eventLog.join('\n'));
        }
      }
  
      t.end();
    });
  }
  
});

class KeywordPassingPlayer extends SyntheticPlayer {
  constructor(characterName, eventLog) {
    super();
    this.characterName = characterName;
    this.eventLog = eventLog;
    this.waiting = false;
    this.hasKeyword = false;
    this.gotKeyword = false;
  }

  async setup() {
    await super.setup();
    await this.walk([`Play as ${this.characterName}`]);
  }

  record(eventString) {
    if (this.characterName == 'Flora') eventString = ' '.repeat(80) + eventString;
    this.eventLog.push(eventString);
  }

  async tryStep() {
    if (!this.currentKnot.isAnEnding && !this.waiting && !this.hasKeyword) {
      if (this.gotKeyword) {
        await this.walk([this.gotKeyword]);
        this.record(this.gotKeyword + ' => ' + this.currentKnot.passageName);
        this.gotKeyword = false;
      } else {
        const link = await this.randomWalk();
        this.record(link + ' => ' + this.currentKnot.passageName);
      }

      // Find a readaloud keyword
      let m;
      if (m = this.currentKnot.html.match(/class="readaloud">([^<]+)/)) {
        this.hasKeyword = m && m[1];
        this.record(`${this.characterName} has a keyword: ${this.hasKeyword}`)
      }

      // Find a stop box (both can happen in one knot)
      if (this.currentKnot.html.includes(`class="stop"`)) {
        this.record(`${this.characterName} is waiting on a keyword`);
        this.waiting = true;
      }
      return true; // Advanced
    }
    return false; // Did not advance
  }

  tryPassTo(toPlayer) {
    if (this.hasKeyword && toPlayer.waiting) {
      toPlayer.gotKeyword = this.hasKeyword;
      this.hasKeyword = toPlayer.waiting = false;
      this.eventLog.push(' '.repeat(40) + '-'.repeat(20) + ' KEYWORD EXCHANGE ' + '-'.repeat(20));
      return true; // Passed a keyword
    }
    return false; // Did not pass a keyword
  }
}