/*
Types of automated tests we might find useful.

Script a sequence of choices to:
  Verify some text.
  Verify some hidden state.
  Diff against a blessed transcript.

Fully explore the game space to:
  Assert no errors.
  Assert no dead ends.
  Diff against a blessed text at every knot (>1000 knots for one conversation)

Explore a subset of the space:
  Same as above but start with a fixed sequence of choices and end with
  a test-defined set of terminal passages.

Tandem testing with two browsers to check that choices and read-aloud prompts
  are correctly synced up.

Check save/load behaviors, back/forward buttons.

Debugging needs when an error is found:
  Backtrace of choices so error can be manually reproduced.
  Savehashes so we can jump to a relevant state.
  Error dump if the error is onscreen.
  State dump to check hidden information.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const test = require('tape');

class Game {
    async setup() {
        this.browser = await puppeteer.launch({
            // headless: false,
            // devtools: true,
            // slowMo: 25,
        });
        this.page = await this.browser.newPage();
        await this.page.goto(`file:${path.join(__dirname, '..', 'main.html')}`);

        // Capture initial saveHash for quick restart
        this.initialSaveHash = await this.page.evaluate(() => window.story.saveHash());
    }

    async teardown() {
        await this.browser.close();
    }

    async restart() {
        await this.page.evaluate((h) => window.story.restore(h), this.initialSaveHash);
    }

    /**
     * Walk a series of links in sequence, with validations.
     * @param {Array.{string]} steps Text of links to click, in order
     */
    async walk(steps) {
        while (steps.length > 0) {
            await this.clickLink(steps.shift());
            await this.assertNoError();
        }
    }

    async clickLink(linkText) {
        const passage = await this.page.$('tw-passage');
        const links = await passage.$$('a');
        for (let link of links) {
          const text = await link.evaluate(l => l.innerText);
          if (linkText === text) {
              await link.click();
              return;
          }
        }

        const passageText = await this.page.$eval('tw-passage', p => p.innerText);
        throw new Error(`Expected a link with text "${linkText}" but none was found in passage:\n\n${passageText}`);
    }

    async assertText(expectedText) {
        const passageText = await this.page.$eval('tw-passage', el => el.innerText);
        if (!passageText.includes(expectedText)) {
            throw new Error(`Expected text "${expectedText}" but it was not found in passage:\n\n${passageText}`);
        }
    }

    async assertNoError() {
        const passage = await this.page.$('tw-passage');
        if (!passage) {
          const errorMessage = await this.page.$eval('tw-story', el => el.innerText);
          throw new Error(`Twine reported an error: ${errorMessage}`);
        }
      }
}

test('Blessed Paths', async t => {
    const game = new Game();
    await game.setup();

    t.teardown(async () => {
        await game.teardown();
    });

    t.test('Cass path 1', async t => {
        await game.restart();
        await game.walk([
            'Play as Cassia',
            `You’re in the dining car.`,
            `a mortal`,
            `Flora is staring.`,
            `isn’t cut out for this after all.`,
            `Flora will too.`,
            `Hunting`,
            `Necklace`,
            `“It’s holy water.”`,
            `Schattental`,
            `“Look for the castle.”`,
            `Book`,
            `“None of your business.”`,
            `dangerous`,
            `simpler that way.`,
            `a family at another table.`,
            `you feel calmer, watching them.`,
            `leave`,
            `It is a memorable face.`,
            `everything is prepared for the hunt.`,
            `The stake is your oldest friend.`, 
            `You attend to one of the thoughts.`,
        ]);
        await game.assertText(`END OF PROTOTYPE`);
        t.end();
    });

    t.test('Flora path 1', async t => {
        await game.restart();
        await game.walk([
            'Play as Flora',
            'You’re in the dining car.'
        ]);
        t.end();
    });
});
