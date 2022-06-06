// Global story properties
story.title = 'Safari Colas'
story.FLORA = 'Flora'
story.CASSIA = 'Cass'

// The util namespace holds our helper functions
window.util = window.util || {};

// Enables back/forward buttons for every passage
$(window).on('sm.passage.shown', () => story.checkpoint());

// State
story.state.playerCharacter = null
story.state.cassInventory = new Set();
story.state.floraInventory = new Set();

/**
 * Put one in the story state, add topics, and it will
 * print a menu and track which topics are visited.
 */
window.Conversation = class Conversation {
    constructor(prefix) {
        this._prefix = prefix;
        this._topicBank = {};
        this._unvisitedTopics = new Set();
    }

    addTopic(key, topic) {
        this._topicBank[key] = topic;
        this._unvisitedTopics.add(key);
    }

    // List of topics, for the player driving the conversation
    topicMenu() {
        const options = Array.from(this._unvisitedTopics.values())
            .map(key => [key, this._topicBank[key]]);
        return this._buildMenu(options);
    }

    // List of keys, for the player on the receiving end
    keyMenu() {
        const options = Array.from(this._unvisitedTopics.values())
            .map(key => [key, key]);
        return this._buildMenu(options);
    }

    _buildMenu(options) {
        const listItems = options.map(entry => (
            `<li>
                <a href="javascript:void(0)"
                    data-passage="${this._prefix}${entry[0]}"
                    data-topic-key="${entry[0]}"
                >${entry[1]}</a>
                </li>`
        ));
        $(() =>
            $('[data-topic-key]').one('click', (evt) => {
                this._unvisitedTopics.delete($(evt.target).data('topic-key'));
            })
        );
        return `<ul>${listItems.join('')}</ul>`;
    }
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