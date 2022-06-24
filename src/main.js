// Global story properties
story.title = 'Safari Colas'
story.FLORA = 'Flora'
story.CASSIA = 'Cass'

/**
 * Checks the url for whether to turn on developer mode.
 * Falls back on a default value if not.
 * Can set in URL with ?dev=true or ?dev=1
 * Or unset with ?dev=false or ?dev=0
 */
const DEVELOPER_MODE = (() => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('dev')) {
    try {
      return !!JSON.parse(urlParams.get('dev'));
    } catch { /* ignore if unparseable */ }
  }
  // Default if no queryparam is set
  return true;
})();

let devPanel = DEVELOPER_MODE ? createDevPanel() : null;

// The util namespace holds our helper functions
window.util = window.util || {};

// After initial load: Do extra UI setup.
$(() => {
  // Character watermark
  $('tw-story').append('<div id="character-watermark"></div>');

  // Don't start background fades until after initial load
  $('body').css('transition', 'background-color 2s ease-in-out 0.5s');
});

// Fixups after each passage transition
$(window).on('sm.passage.shown', () => {
  // Enables back/forward buttons for every passage
  story.checkpoint();

  // Update the character name watermark.
  $('#character-watermark').text(story.state.playerCharacter === story.FLORA ? 'Flora' : 'Cassia');

  // Fix rendering so we get a paragraph at the top of the passage every time.
  $('tw-passage').html(paragraphFix($('tw-passage').html()));

  // Update the developer panel.
  if (DEVELOPER_MODE) {
    if (window.passage.name !== 'Start') devPanel.autosave();
    devPanel.render();
  }
});

// State
story.state.playerCharacter = null;

window.Inventory = class Inventory {
  constructor(key) {
    this.key = key;
    story.state.inventories ||= {};
    story.state.inventories[key] ||= {};
  }

  add(item) {
    story.state.inventories ||= {};
    story.state.inventories[this.key] ||= {};
    story.state.inventories[this.key][item] = true;
  }

  has(item) {
    return !!(story.state.inventories?.[this.key]?.[item]);
  }
}
window.FloraInventory = new Inventory('Flora');
window.CassInventory = new Inventory('Cass');

// Conversations must be stored as POJOs in the story state
// or save/restore won't work properly.
class Conversation {
  constructor(prefix) {
    this.prefix = prefix;
  }

  addTopic(key, topic) {
    story.state.conversations ||= {};
    story.state.conversations[this.prefix] ||= {};
    story.state.conversations[this.prefix][key] = topic || key;
  }

  // List of topics, for the player driving the conversation
  topicMenu() {
    const options = Object.entries(story.state.conversations[this.prefix]);
    const listItems = options.map(([key, topic]) => (
      `<li>
                <a href="javascript:void(0)"
                    data-passage="${this.prefix}/${key}"
                    data-topic-key="${key}"
                >${topic}</a>
                </li>`
    ));
    $(() =>
      $('[data-topic-key]').one('click', (evt) => {
        const clickedTopic = $(evt.target).data('topic-key');
        delete story.state.conversations[this.prefix][clickedTopic];
      })
    );
    return `<ul>${listItems.join('')}</ul>`;
  }

  // List of keys, for the player on the receiving end
  keyMenu() {
    const options = Object.keys(story.state.conversations[this.prefix]).map(k => [k, k]);
    const list = options.map(([key, topic]) => (
      `<a href="javascript:void(0)"
        data-passage="${this.prefix}/${key}"
        data-topic-key="${key}"
      >${topic}</a>`
    )).join(` &middot; `);
    $(() =>
      $('[data-topic-key]').one('click', (evt) => {
        const clickedTopic = $(evt.target).data('topic-key');
        delete story.state.conversations[this.prefix][clickedTopic];
      })
    );
    return `<center>${list}</center>`;
  }

  /** Cleans up game state, which converges knots and makes testing easier. */
  cleanup() {
    delete story.state.conversations[this.prefix];
  }
}
window.Convo = prefix => new Conversation(prefix);

function slugify(text) {
  return text.toLowerCase()
    .replace(/^[^a-z0-9]+/, '') // Drop leading non-word characters
    .replace(/[^a-z0-9]+$/, '') // Drop trailing non-word characters
    .replace(/[^a-z0-9]+/g, '-'); // Replace other non-word characters with hyphens
}

/**
 * There seems to be a bug in Twine/Snowman that doesn't always balance
 * tags in rendered content. This is a workaround.
 * @param {string} html 
 * @returns 
 */
function paragraphFix(html) {
  // Rendered content _should_ always open with a paragraph tag.
  // If it doesn't, we've proabbly hit this bug and we should restore
  // the opening and closing paragraph tags.
  if ('<p' !== html.slice(0, 2)) {
    html = `<p>${html}</p>`;
  }
  return html;
}

/**
 * Creates a link. When clicked, the link is replaced with the provided
 * html. Optionally you can specify additional code to run when the
 * link is clicked.
 * @param {htmlString} linkText The initial content of the link.
 * @param {htmlString} expandedText The content after the link is clicked.
 * @param {function?} onClick Optional additional callback to run when the link is clicked.
 * @returns The initial link.
 */
window.inlineExpander = function (linkText, expandedText, onClick) {
  const id = `inline-expand-${slugify(linkText)}`;
  $(() => $(`#${id}`).one('click', event => {
    $(event.target).replaceWith(expandedText);
    if (typeof onClick === 'function') onClick();
  }));
  return `
    <a href="javascript:void(0)" id="${id}">${linkText}</a>
    `;
}

window.passageAppender = function (linkText, passageName) {
  const id = `append-passage-${slugify(linkText)}`;
  $(() => $(`#${id}`).one('click', event => {
    $(event.target).replaceWith(`<span class="link-like">${linkText}</span>`);
    // Fade existing paragraphs a bit
    $(`.passage p`).addClass('faded-text');
    let content = paragraphFix(story.render(passageName));
    $('.passage').append(`<div>${content}</div>`);
  }));
  return `
    <a href="javascript:void(0)" id="${id}">${linkText}</a>
    `;
}

util.continuation = function (text, nextPassage) {
  $(() => {
    $('#continuation').click(event => {
      let content = story.render(nextPassage);
      $('.passage').append(`<p>${content}</p>`)
      event.target.remove()
    })
  })
  return `
    <a href="javascript:void(0)" id="continuation">${text}</a>
    `;
}

/**
 * Change the background color behind the page.
 * @param {string} color Any valid CSS color string.
 */
util.background = function (color) {
  $('body').css('backgroundColor', color);
};
