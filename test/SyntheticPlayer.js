const puppeteer = require('puppeteer');
const path = require('path');
const _ = require('lodash');
const process = require('process');

// When exploring a game-space, how often the logged progress
// display updates.
const PROGRESS_REPORT_INTERVAL_MS = 150;

module.exports = class SyntheticPlayer {
  async setup() {
    // Create browser, navigate to game
    this.browser = await puppeteer.launch({
      // Uncomment to make the tests open a window so you can watch.
      // headless: !!process.env.CI,

      // Change to slow down the tests, helpful in combination with above.
      // Given as milliseconds of delay per step, so 200 is 10x slower than 20.
      // slowMo: 20,

      // Opens the Chromium developer tools, used for step-debugging tests.
      // devtools: true,
    });
    this.page = await this.browser.newPage();
    await this.page.goto(`file:${path.join(__dirname, '..', 'main.html?automation=true')}`);

    // Keep known knots organized by passage name for quicker lookup.
    this.knotsByPassageName = {};

    // Capture root knot for quick restart
    this.root = await Knot.capture(this);
    this.currentKnot = this.root;
  }

  async teardown() {
    await this.browser.close();
  }

  async restart() {
    await this.root.restore();
  }

  // After opening the browser, capture can be a little unreliable so we
  // add a wait before Knot capture. This decreases as it's used.
  _captureDelay = 300;
  captureDelay() {
    const nextDelay = this._captureDelay;
    this._captureDelay = Math.max(1, this._captureDelay / 4);
    return nextDelay;
  }

  registerKnownKnot(knot) {
    this.knotsByPassageName[knot.passageName] = this.knotsByPassageName[knot.passageName] || [];
    if (!this.knotsByPassageName[knot.passageName].includes(knot)) {
      this.knotsByPassageName[knot.passageName].push(knot);
    }
  }

  /**
   * Look for an equivalent (collapsible) knot in the set of known knots.
   * @param {Knot} knot 
   * @returns {Knot|undefined} A known equivalent knot, or undefined if none is found.
   */
  findEquivalentKnot(knot) {
    const passageKnots = this.knotsByPassageName[knot.passageName] || [];
    return passageKnots.find(k => k !== knot && k.equivalent(knot));
  }

  convergeKnots(survivingKnot, knotToDestroy) {
    // Attach parents to surviving knot.
    Object.entries(knotToDestroy._parents).forEach(([linkText, parentKnots]) => {
      parentKnots.forEach(parentKnot => parentKnot.children[linkText] = survivingKnot);
      survivingKnot._parents[linkText] = (survivingKnot._parents[linkText] || []).concat(parentKnots);
    });
    // Remove destoryed knot from known knots
    this.knotsByPassageName[knotToDestroy.passageName].splice(this.knotsByPassageName[knotToDestroy.passageName].findIndex(k => k === knotToDestroy), 1);
  }

  /**
  * Walk a series of links in sequence, with validations.
  * @param {Array.{string]} steps Text of links to click, in order
  */
  async walk(steps) {
    while (steps.length > 0) {
      await this.currentKnot.followLink(steps.shift());
    }
  }

  /**
   * Walk a naive path forward until a certain passage is reached.
   * Accepts a list of "biases," link text that will always be taken
   * if it appears on the walk, to ensure the desired state is reached.
   * Vulnerable to cycles.
   * @param {string} stopAtPassageName 
   * @param {[...string]} biases Preferred choices along the walk, given
   *        as link text.
   */
  async walkTo(stopAtPassageName, biases) {
    while (this.currentKnot.passageName !== stopAtPassageName) {
      let moveOptions = Object.keys(this.currentKnot.children)
      let biasedStep = moveOptions.find(option => biases.includes(option));
      await this.currentKnot.followLink(biasedStep || moveOptions[0]);
    }
  }

  async randomWalk() {
    let link = _.sample(Object.keys(this.currentKnot.children));
    await this.currentKnot.followLink(link);
    return link;
  }

  /**
   * Fully explores a subset of story-space, starting from the current story knot
   * and proceeding as far as it can. Exploration stops at specified passages,
   * or when a maximum depth is reached.
   * 
   * As it runs, this exploration checks for errors, dead ends, and save-states that
   * don't restore successfully.
   * 
   * @param {Array.<string>} terminalPassageNames A list of passage names at which
   *        the command will (intentionally) stop exploring.
   * @param {number} maxDepth [default 50] How far from the initial knot this command
   *        will explore before it gives up. If this is ever reached, the command
   *        will return `fullyExplored = false`.
   * @returns 
   */
  async exploreTo(terminalPassageNames, { maxDepth = 50, progressReport = true } = {}) {
    let totalKnots = 0;
    let convergences = 0;
    let terminalStates = 0;
    let terminalKnots = [];
    let fullyExplored = true; // Until proven otherwise
    let startTimeMs = Date.now();
    let lastReportMs = -Infinity;

    // Automatically nope out of printing progress if we feature-detect that
    // stderr is not a TTY (like in our CI environment).
    if (typeof process.stderr.clearLine !== 'function') {
      progressReport = false;
    }

    const explorationRoot = this.currentKnot;
    const knotsToExplore = [explorationRoot];
    while (knotsToExplore.length > 0) {
      const now = Date.now();
      if (progressReport && now - lastReportMs > PROGRESS_REPORT_INTERVAL_MS) {
        lastReportMs = now;
        rewriteProgressReport(now - startTimeMs, totalKnots, terminalStates);
      }

      const knotBeingExplored = knotsToExplore.pop();
      totalKnots++;

      // Before exploring the knot, check that it actually has children.
      // Not having children is a mistake - this is an unintended dead-end.
      if (Object.keys(knotBeingExplored.children).length === 0) {
        const path = [knotBeingExplored];
        while (path[0].parent) { path.unshift(path[0].parent); }
        throw new Error(`Found a dead end at ${knotBeingExplored.passageName}, `
          + `reached by path:\n` + path.map(k => k.passageName).join('\n'));
      }

      for (let exit in knotBeingExplored.children) {
        if (this.currentKnot !== knotBeingExplored) {
          await knotBeingExplored.restore();
        }

        // Following the link changes this.currentKnot.
        await this.currentKnot.followLink(exit);

        // If we've reached one of the terminal passages we can stop
        // exploring in this direction.
        if (terminalPassageNames.includes(this.currentKnot.passageName)) {
          this.currentKnot.children = {};
          terminalKnots.push(this.currentKnot);
          terminalStates++;
          continue;
        }

        // If the next node has reached our maximum depth we can stop
        // exploring in this direction.
        if (this.currentKnot.depthFrom(explorationRoot) >= maxDepth) {
          fullyExplored = false;
          continue;
        }

        // If we arrive at a knot that is equivalent to an existing one
        // paths converge here and we only need to explore it once
        // so don't bother pushing for further exploration.
        let matchingKnot = this.findEquivalentKnot(this.currentKnot);
        if (matchingKnot && matchingKnot.descendantOf(explorationRoot)) {
          this.convergeKnots(matchingKnot, this.currentKnot);
          convergences++;
          continue;
        }

        knotsToExplore.push(this.currentKnot);
      }
    }

    if (progressReport) {
      rewriteProgressReport(Date.now() - startTimeMs, totalKnots, terminalStates);
      process.stderr.write('\n');
    }

    // Knots per passage
    // console.log('Knots per passage:', _.mapValues(this.knotsByPassageName, 'length'));

    // Stats on story length
    const lengths = explorationRoot.lengthsFrom();
    const table = {};
    ['characters', 'words', 'knots'].forEach(row => {
      const data = lengths.map(l => l[row]).sort((a, b) => a - b);
      table[row] = {
        min: data[0],
        max: data[data.length - 1],
        mean: Math.round(data.reduce((acc, x) => acc + x, 0) / data.length),
        median: data[Math.floor(data.length / 2)], // Close enough :)
      };
    });
    console.log(`Found ${lengths.length} possible paths.`);
    console.table(table);

    return { totalKnots, convergences, terminalKnots, fullyExplored };
  }

}

class Knot {
  children = {};

  static async capture(player, parentKnot, fromLinkText) {
    const knot = new Knot();
    knot.player = player;
    knot.parent = parentKnot;
    knot._parents = {};
    if (parentKnot) {
      knot._parents[fromLinkText] = [parentKnot]
    }

    // Wait a moment to ensure the passage is fully loaded
    await player.page.waitForTimeout(player.captureDelay());

    // Capture knot properties from the DOM
    const passage = await player.page.$('tw-passage');
    knot.passageName = await passage.evaluate(() => window.passage.name);
    knot.text = await passage.evaluate(p => p.innerText);
    knot.html = await passage.evaluate(p => p.innerHTML);
    knot.state = await passage.evaluate(() => window.story.state);
    knot.saveHash = await passage.evaluate(p => window.story.saveHash());
    knot.isAnEnding = await passage.evaluate(p => !!$(p).find('.ending').length);

    const links = await passage.$$('a');
    const linkTexts = await Promise.all(links.map(l => l.evaluate(l => l.innerText)));
    linkTexts.forEach(text => { knot.children[text] = null; });

    player.registerKnownKnot(knot);

    return knot;
  }

  /** Prefer Knot.capture() to create knots. */
  constructor() { }

  /**
   * Whether this knot represents an un-restorable state, because it resulted
   * from a mutation within a passage.
   */
  isCosmetic() {
    return this.parent && this.passageName === this.parent.passageName;
  }

  /**
   * Advances the story by clicking on the link with exactly the given text
   * within the page.
   * Prerequisite: Must already be navigated to this knot.
   * @param {string} linkText
   */
  async followLink(linkText) {
    if (this.player.currentKnot !== this) {
      throw new Error(`Tried to follow link [[${linkText}]] from knot ${this.passageName} `
        + `but it is not the current knot.`);
    }

    const findLink = async () => {
      const links = await this.player.page.$$('tw-passage a');
      for (let link of links) {
        const text = await link.evaluate(l => l.innerText);
        if (linkText.toLowerCase() === text.toLowerCase()) return link;
      }
      return null;
    }

    const link = await findLink();
    if (!link) {
      const passageText = await this.player.page.$eval('tw-passage', p => p.innerText);
      throw new Error(`Expected a link with text "${linkText}" but none was found `
        + `in passage:\n\n${passageText}\n\nBacktrace:\n ${this.backtrace()}`);
    }

    await link.click();
    await this.assertNoError();
    this.children[linkText] = this.children[linkText] || await Knot.capture(this.player, this, linkText);
    this.player.currentKnot = this.children[linkText];
  }

  async restore() {
    // Cosmetic (intra-passage mutation) knots are a special case; restored by
    // restoring their parent and then clicking the link to return to them.
    if (this.isCosmetic()) {
      const pathFromParent = _.findKey(this._parents, knots => knots.includes(this.parent));
      await this.parent.restore();
      await this.parent.followLink(pathFromParent);
      return;
    }


    await this.player.page.evaluate((h) => window.story.restore(h), this.saveHash);
    await this.assertNoError();
    const textAfterRestore = await this.player.page.$eval('tw-passage', p => p.innerText);
    if (this.text != textAfterRestore) {
      throw new Error(`Passage text mismatch after restore:\n`
        + `<<<<<<<< EXPECTED\n`
        + this.text
        + `\n========\n`
        + textAfterRestore
        + `\n>>>>>>>> ACTUAL`);
    }
    this.player.currentKnot = this;
  }

  descendantOf(parentKnot) {
    return this.path().includes(parentKnot);
  }

  /** True for converge-able knots; false for exact same knot. */
  equivalent(otherKnot) {
    const KNOT_EQUALITY_PROPS = ['passageName', 'html', 'state'];
    return this !== otherKnot && _.isEqual(_.pick(this, KNOT_EQUALITY_PROPS), _.pick(otherKnot, KNOT_EQUALITY_PROPS));
  }

  depthFrom(ancestor) {
    if (this === ancestor) {
      return 0;
    }

    let p = this.parent;
    let depth = 0;
    while (p) {
      depth++;
      if (p === ancestor) {
        break;
      }
      p = p.parent;
    }
    return depth;
  }

  lengthsFrom() {
    // Depth-first search to build eval sequence
    const lengthEvaluationSequence = [this];
    let i = 0;
    while (i < lengthEvaluationSequence.length) {
      for (let childKnot of Object.values(lengthEvaluationSequence[i].children)) {
        if (!lengthEvaluationSequence.includes(childKnot)) {
          lengthEvaluationSequence.push(childKnot);
        }
      }
      i++;
    }
    // console.log(`Okay, going to evaluate ${lengthEvaluationSequence.length} knots`);
    while (lengthEvaluationSequence.length > 0) {
      const nextKnot = lengthEvaluationSequence.pop();
      const nextKnotLength = StoryLength.fromKnot(nextKnot);
      if (Object.values(nextKnot.children).length > 0) {
        nextKnot._lengths = Object.values(nextKnot.children).flatMap(k => {
          if (!k._lengths) return [];
          return k._lengths.map(l => l.addTo(nextKnotLength));
        });
      } else {
        nextKnot._lengths = [nextKnotLength];
      }
    }
    return this._lengths;
  }

  /**
   * Return the series of knots that led to this point, in order,
   * ending in this knot.
   */
  path() {
    const path = [this];
    let parent = this.parent;
    while (parent) {
      path.unshift(parent);
      parent = parent.parent;
    }
    return path;
  }

  backtrace() {
    return this.path().map((knot, i, path) => {
      let text = knot.passageName;
      if (i < path.length) {
        const exit = _.findKey(knot.children, k => k === path[i + 1]);
        text = text + ` => ${exit}`;
      }
      return text;
    }).join('\n  ');
  }

  transcript() {
    return this.path().map((knot, i, path) => {
      let text = knot.text;
      Object.keys(knot.children).forEach(link => {
        text = text.replace(link, `[[${link}]]`);
      });
      let exit = _.findKey(knot.children, k => k === path[i + 1]);
      text = text.replace(`[[${exit}]]`, `{{${exit}}}`);
      return text;
    }).join(`\n\n        ----\n\n`);
  }

  async assertNoError() {
    const passage = await this.player.page.$('tw-passage');
    if (!passage) {
      const errorMessage = await this.player.page.$eval('tw-story', el => el.innerText);
      throw new Error(`Twine reported an error: ${errorMessage}`);
    }
  }
}

class StoryLength {
  static fromKnot(knot) {
    const l = new StoryLength();
    l.characters = knot.text.length;
    l.words = knot.text.split(/\s+/).length;
    l.knots = 1;
    return l;
  }

  addTo(other) {
    const l = new StoryLength();
    l.characters = this.characters + other.characters;
    l.words = this.words + other.words;
    l.knots = this.knots + other.knots;
    return l;
  }
};

function rewriteProgressReport(elapsedMs, totalKnots, endings) {
  process.stderr.clearLine(0);
  process.stderr.cursorTo(0);
  process.stderr.write(`${formatTime(elapsedMs)} | Knots: ${totalKnots} | Endings: ${endings}`);
}

function formatTime(ms) {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms - mins * 60000) / 1000);
  return `${('00' + mins).slice(-2)}:${('00' + secs).slice(-2)}`;
}
