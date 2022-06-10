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

const test = require('tape');
const Game = require('./Game');

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
        console.log(game.currentKnot.transcript());
        t.end();
    });

    t.test('Flora path 1', async t => {
        await game.restart();
        await game.walk([
            'Play as Flora',
            'You’re in the dining car.',
            'You observe in disgust.',
            'partnered up with?',
            'odd.',
            'What exactly are we hunting?',
            `What is that necklace you're wearing?`,
            `Holy`,
            `How will we find the vampire when we get to Schattental?`,
            `Castle`,
            `Do you have a vampire book I could read?`,
            `Homework`,
            `Why is your skin so pale?`,
            `Bloody`,
            `You push your plate away.`,
            `Maybe you are more alone than you realized.`,
            `You walk out of the car without looking back.`,
            `Someone offers their lighter.`,
            `He’s friendly enough.`,
            `You tell him everything.`,
            `You take a shaky drag on your cigarette.`,
            `You agree, but not tonight.`,
            `head back inside.`,
            `We’ve reached the mountains.`,
            `You’re not quite ready for sleep.`,
        ]);
        await game.assertText(`END OF PROTOTYPE`);
        t.end();
    });
});
