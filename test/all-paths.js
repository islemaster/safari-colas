const puppeteer = require('puppeteer');
const path = require('path');
const { kill } = require('process');
const _ = require('lodash');

function seconds(n) {
    return new Promise(r => setTimeout(r, 1000 * n));
}

function indent(string, spaces) {
  if (typeof string === 'undefined') string = 'undefined';
  if (string === null) string = 'null';
  string = string.toString();
  return ' '.repeat(spaces) + string.replace(/\n/g, '\n' + ' '.repeat(spaces));
}

// Build a tree of paths through the game

(async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    // devtools: true,
    // slowMo: 250,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file:${path.join(__dirname, '..', 'main.html')}`);

    let currentKnot = null;
    const passageCounts = {};

    async function clickLink(targetText) {
        const passage = await page.$('tw-passage');
        const links = await passage.$$('a');
        for (let link of links) {
          const linkText = await link.evaluate(l => l.innerText);
          if (targetText === linkText) {
              await link.click();
              return;
          }
        }

        const passageText = await passage.evaluate(p => p.innerText);
        throw new Error(`Expected to find a link with text "${targetText}" but none was found in passage:\n\n${passageText}`);
    }

    async function assertPassageText(expectedText) {
      const actualText = await page.$eval('tw-passage', p => p.innerText);
      if (actualText != expectedText) {
        throw new Error(`Passage mismatch:\n<<<<<<<< EXPECTED\n${indent(expectedText, 2)}\n========\n${indent(actualText, 2)}\n>>>>>>>> ACTUAL`);
      }
    }

    async function assertNoError() {
      const passage = await page.$('tw-passage');
      if (!passage) {
        const errorMessage = await page.$eval('tw-story', el => el.innerText);
        throw new Error(errorMessage);
      }
    }

    class Knot {
        parent = null;
        linkText = null;
        children = [];

        constructor(parent, linkText) {
          this.parent = parent;
          this.linkText = linkText;
        }

        name() {
          let name = '';
          if (this.linkText) {
            name += this.linkText + ' => ';
          }
          name += this.passageName ? this.passageName : 'UnvisitedPassage';
          return name;
        }

        path() {
          let result = '';
          let steps = [];
          let p = this.parent;
          while (p) {
            steps.unshift(p);
            p = p.parent;
          }
          return steps.map(knot => knot.name()).join('\n');
        }

        async visit() {
          await this.navigateToKnot();
          await this.captureFromDom();
          passageCounts[this.passageName] = passageCounts[this.passageName] || 0;
          passageCounts[this.passageName]++;
        }

        async navigateToKnot() {
          // console.log(`Navigating to ${this.name()}`);
          if (currentKnot === this) {
            return;
          }

          try {
            if (this.saveHash) {
              // We've already been here, just restore the save.
              // console.log(`  Restoring ${this.name()} from saveHash ${this.saveHash}`);
              await page.evaluate((h) => window.story.restore(h), this.saveHash);
              await assertNoError();
              await assertPassageText(this.text);
            } else {
              // Make sure we're on the parent knot
              if (currentKnot !== this.parent) {
                // console.log(`  Restoring to parent knot [${this.parent.name()}] from saveHash ${this.parent.saveHash}`);
                let restoreResult = await page.evaluate((h) => window.story.restore(h), this.parent.saveHash);
                await assertNoError();
                await assertPassageText(this.parent.text);
              }
 
              await clickLink(this.linkText);
              await assertNoError();
            }
            
            currentKnot = this;
          } catch (err) {
            throw new Error(`Error navigating to passage [${this.name()}]\n${indent(err.toString(), 2)}\n  Story backtrace:\n${indent(this.path(), 4)}`);
          }
        }

        async captureFromDom() {
          const passage = await page.$('tw-passage');
          this.passageName = await passage.evaluate(() => window.passage.name);
          this.text = await passage.evaluate(p => p.innerText);
          this.html = await passage.evaluate(p => p.innerHTML);
          this.state = await passage.evaluate(() => window.story.state);
          this.saveHash = await passage.evaluate(p => window.story.saveHash());
          this.isAnEnding = await passage.evaluate(p => !!$(p).find('.ending').length);
      
          if (!this.isAnEnding) {
            // Find all links
            const links = await passage.$$('a');
            const linkTexts = await Promise.all(links.map(l => l.evaluate(l => l.innerText)));
            this.children = linkTexts.map(l => new Knot(this, l));

            if (this.children.length === 0) {
              throw new Error(`Found a dead end: ${this.name()}\n${this.path()}`);
            }
          }
        }

        matchesAnyAncestor() {
            let p = this.parent;
            while (p) {
              if (p.passageName == this.passageName && p.html == this.html) return true;
              p = p.parent;
            }
            return false;
        }

        printTree(startDepth = 0) {
          if (this.passageName) {
            console.log(' '.repeat(startDepth) + this.name() + ' ' + JSON.stringify(this.state));
            for (let child of this.children) {
              child.printTree(startDepth + 2);
           }
          }
        }
    }

    function matchesPastKnot(newKnot) {
      const KNOT_EQUALITY_PROPS = ['passageName', 'html', 'state'];
      const stack = [root];
      while (stack.length) {
        const knot = stack.shift();
        if (
          knot !== newKnot
          && _.isEqual(_.pick(knot, KNOT_EQUALITY_PROPS), _.pick(newKnot, KNOT_EQUALITY_PROPS))
        ) {
          return true;
        }
        Array.prototype.push.apply(stack, knot.children);
      }
      return false;

    }

    const root = new Knot();
    await root.captureFromDom();
    currentKnot = root;
    const unvisited = [...root.children];
    let visits = 0;
    while (unvisited.length > 0 && visits < 2000) {
        visits++;
        const knot = unvisited.shift();
        await knot.visit();
        if (!matchesPastKnot(knot)) {
          Array.prototype.unshift.apply(unvisited, knot.children);
        }
        
        if (visits % 10 === 0) {
          process.stderr.clearLine(0);
          process.stderr.cursorTo(0);
          process.stderr.write(`Visited ${visits} knots. `);
        }
    }
    process.stderr.write(`\nDone\n`);

    root.printTree();
    console.log(passageCounts);
    console.log(`Visited ${visits} knots.`);

  } catch (err) {
    console.error('Error during execution');
    console.error(err);
  }
  await browser.close();
})();