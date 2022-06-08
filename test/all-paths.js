const puppeteer = require('puppeteer');
const path = require('path');
const { kill } = require('process');

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

    async function clickLink(targetText) {
        const passage = await page.$('tw-passage');
        const links = await passage.$$('a');
        for (let link of links) {
          const linkText = await link.evaluate(l => l.innerText);
          if (targetText === linkText) {
              await link.click();
              // await seconds(1);
              return;
          }
        }

        const passageText = await passage.evaluate(p => p.innerText);
        throw new Error(`Expected to find a link with text "${targetText}" but none was found in passage:\n\n${passageText}`);
    }

    async function logPassage() {
      const passage = await page.$('tw-passage');
      const passageName = await passage.evaluate(() => window.passage.name);
      const text = await passage.evaluate(p => p.innerText);
      console.log('');
      console.log(`### ${passageName}`);
      console.log(text);
      console.log('');
    }

    async function assertPassageText(expectedText) {
      const passage = await page.$('tw-passage');
      const actualText = await passage.evaluate(p => p.innerText);
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
        }

        async navigateToKnot() {
          console.log(`Navigating to ${this.name()}`);
          if (currentKnot === this) {
            return;
          }

          try {
            if (this.saveHash) {
              // We've already been here, just restore the save.
              console.log(`  Restoring ${this.name()} from saveHash ${this.saveHash}`);
              await page.evaluate((h) => window.story.restore(h), this.saveHash);
              await assertNoError();
              await assertPassageText(this.text);
            } else {
              // Make sure we're on the parent knot
              if (currentKnot !== this.parent) {
                console.log(`  Restoring to parent knot [${this.parent.name()}] from saveHash ${this.parent.saveHash}`);
                let restoreResult = await page.evaluate((h) => window.story.restore(h), this.parent.saveHash);
                await assertNoError();
                await assertPassageText(this.parent.text);
              }
                
              console.log(`  Clicking link [[${this.linkText}]]`);
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
      
          // Find all links
          const links = await passage.$$('a');
          const linkTexts = await Promise.all(links.map(l => l.evaluate(l => l.innerText)));
          this.children = linkTexts.map(l => new Knot(this, l));
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
            console.log(' '.repeat(startDepth) + this.name());
            for (let child of this.children) {
              child.printTree(startDepth + 2);
           }
          }
        }
    }

    function matchesPastKnot(newKnot) {
      const stack = [root];
      while (stack.length) {
        const knot = stack.shift();
        if (knot.passageName == newKnot.passageName && knot.html == newKnot.html && JSON.stringify(knot.state) == JSON.stringify(newKnot.state)) {
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
        if (!knot.matchesAnyAncestor()) {
          Array.prototype.unshift.apply(unvisited, knot.children);
        } else {
          console.info('Already visited this knot');
        }
    }

    root.printTree();
    console.log(`Visited ${visits} knots.`);

  } catch (err) {
    console.error('Error during execution');
    console.error(err);
  }
  await browser.close();
})();