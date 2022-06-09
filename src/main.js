// Global story properties
story.title = 'Safari Colas'
story.FLORA = 'Flora'
story.CASSIA = 'Cass'

// The util namespace holds our helper functions
window.util = window.util || {};

// Enables back/forward buttons for every passage
$(window).on('sm.passage.shown', () => story.checkpoint());

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
        return this.buildMenu(options);
    }

    // List of keys, for the player on the receiving end
    keyMenu() {
        const options = Object.keys(story.state.conversations[this.prefix]).map(k => [k, k]);
        return this.buildMenu(options);
    }

    buildMenu(options) {
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

    /** Cleans up game state, which converges knots and makes testing easier. */
    cleanup() {
        delete story.state.conversations[this.prefix];
    }
}
window.Convo = prefix => new Conversation(prefix);


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