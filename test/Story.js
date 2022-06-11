const puppeteer = require('puppeteer');
const path = require('path');
const _ = require('lodash');

module.exports = class Story {
  async setup() {
    // Create browser, navigate to game
    this.browser = await puppeteer.launch({
      // headless: false,
      // devtools: true,
      // slowMo: 20,
    });
    this.page = await this.browser.newPage();
    await this.page.goto(`file:${path.join(__dirname, '..', 'main.html')}`);

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

  /**
  * Walk a series of links in sequence, with validations.
  * @param {Array.{string]} steps Text of links to click, in order
  */
  async walk(steps) {
    while (steps.length > 0) {
      await this.currentKnot.followLink(steps.shift());
    }
  }

  async randomWalk() {
    await this.currentKnot.followLink(_.sample(Object.keys(this.currentKnot.children)));
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
  async exploreTo(terminalPassageNames, maxDepth = 50) {
    let totalKnots = 0;
    let convergences = 0;
    let terminalStates = 0;
    let fullyExplored = true; // Until proven otherwise

    const explorationRoot = this.currentKnot;
    const knotsToExplore = [explorationRoot];
    while (knotsToExplore.length > 0) {
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
        if (explorationRoot.anyDescendant(d => d.equivalent(this.currentKnot))) {
          convergences++;
          continue;
        }

        knotsToExplore.push(this.currentKnot);
      }
    }

    return { totalKnots, convergences, terminalStates, fullyExplored };
  }


}

class Knot {
  children = {};

  static async capture(story, parentKnot) {
    const knot = new Knot();
    knot.story = story;
    knot.parent = parentKnot;

    const passage = await story.page.$('tw-passage');
    knot.passageName = await passage.evaluate(() => window.passage.name);
    knot.text = await passage.evaluate(p => p.innerText);
    knot.html = await passage.evaluate(p => p.innerHTML);
    knot.state = await passage.evaluate(() => window.story.state);
    knot.saveHash = await passage.evaluate(p => window.story.saveHash());
    knot.isAnEnding = await passage.evaluate(p => !!$(p).find('.ending').length);

    const links = await passage.$$('a');
    const linkTexts = await Promise.all(links.map(l => l.evaluate(l => l.innerText)));
    linkTexts.forEach(text => { knot.children[text] = null; });

    return knot;
  }

  /** Prefer Knot.capture() to create knots. */
  constructor() { }

  /**
   * Advances the story by clicking on the link with exactly the given text
   * within the page.
   * Prerequisite: Must already be navigated to this knot.
   * @param {string} linkText
   */
  async followLink(linkText) {
    if (this.story.currentKnot !== this) {
      throw new Error(`Tried to follow link [[${linkText}]] from knot ${this.name()} `
        + `but it is not the current knot.`);
    }

    const findLink = async () => {
      const links = await this.story.page.$$('tw-passage a');
      for (let link of links) {
        const text = await link.evaluate(l => l.innerText);
        if (linkText.toLowerCase() === text.toLowerCase()) return link;
      }
      return null;
    }

    const link = await findLink();
    if (!link) {
      const passageText = await this.story.page.$eval('tw-passage', p => p.innerText);
      throw new Error(`Expected a link with text "${linkText}" but none was found `
        + `in passage:\n\n${passageText}`);
    }

    await link.click();
    await this.assertNoError();
    this.children[linkText] = this.children[linkText] || await Knot.capture(this.story, this);
    this.story.currentKnot = this.children[linkText];
  }

  async restore() {
    await this.story.page.evaluate((h) => window.story.restore(h), this.saveHash);
    await this.assertNoError();
    const textAfterRestore = await this.story.page.$eval('tw-passage', p => p.innerText);
    if (this.text != textAfterRestore) {
      throw new Error(`Passage text mismatch after restore:\n`
        + `<<<<<<<< EXPECTED\n`
        + this.text
        + `\n========\n`
        + textAfterRestore
        + `\n>>>>>>>> ACTUAL`);
    }
    this.story.currentKnot = this;
  }

  anyDescendant(predicate) {
    const stack = [this];
    while (stack.length) {
      const knot = stack.shift();
      if (predicate(knot)) return true;
      const newObjs = Object.values(knot.children).filter(k => k);
      Array.prototype.push.apply(stack, newObjs);
    }
    return false;
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

  transcript() {
    const path = [this];
    let parent = this.parent;
    while (parent) {
      path.unshift(parent);
      parent = parent.parent;
    }
    return path.map((knot, i, path) => {
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
    const passage = await this.story.page.$('tw-passage');
    if (!passage) {
      const errorMessage = await this.story.page.$eval('tw-story', el => el.innerText);
      throw new Error(`Twine reported an error: ${errorMessage}`);
    }
  }
}