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
story.state.cassInventory = [];
story.state.floraInventory = [];

window.Inventory = class Inventory {
    static add(inv, item) {
        inv.push(item); // TODO dedupe as a set
    }

    static has(inv, item) {
        return inv.includes(item);
    }
}

// Conversations must be stored as POJOs in the story state
// or save/restore won't work properly.
window.Convo = class Convo {
    static create(prefix) {
        return {
            prefix,
            topicBank: {},
            unvisitedTopics: []
        };
    }

    static addTopic(convo, key, topic) {
        convo.topicBank[key] = topic;
        convo.unvisitedTopics = Array.from(new Set(convo.unvisitedTopics).add(key));
    }

    // List of topics, for the player driving the conversation
    static topicMenu(convo) {
        const options = convo.unvisitedTopics
            .map(key => [key, convo.topicBank[key]]);
        return Convo.buildMenu(convo, options);
    }

    // List of keys, for the player on the receiving end
    static keyMenu(convo) {
        const options = convo.unvisitedTopics
            .map(key => [key, key]);
        return Convo.buildMenu(convo, options);
    }

    static buildMenu(convo, options) {
        const listItems = options.map(entry => (
            `<li>
                <a href="javascript:void(0)"
                    data-passage="${convo.prefix}${entry[0]}"
                    data-topic-key="${entry[0]}"
                >${entry[1]}</a>
                </li>`
        ));
        $(() =>
            $('[data-topic-key]').one('click', (evt) => {
                convo.unvisitedTopics = Array.from(new Set(convo.unvisitedTopics).delete($(evt.target).data('topic-key')));
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