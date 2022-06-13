/*
Walk a particular sequence of choices:
  Verify some text.
  Verify some hidden state.
  Diff against a blessed transcript.
*/

const test = require('tape');
const Story = require('./Story');

test('Blessed Paths', async t => {
  const story = new Story();
  await story.setup();

  t.teardown(async () => {
    await story.teardown();
  });

  t.test('Cass path 1', async t => {
    await story.restart();
    await story.walk([
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
      `The stake is good for a close-quarters situation.`,
      `You attend to one of the thoughts.`,
    ]);
    t.match(story.currentKnot.text, /END OF PROTOTYPE/);
    t.end();
  });

  t.test('Flora path 1', async t => {
    await story.restart();
    await story.walk([
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
    t.match(story.currentKnot.text, /END OF PROTOTYPE/);
    t.end();
  });
});
