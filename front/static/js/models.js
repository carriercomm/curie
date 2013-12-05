Curie.Models.Message = Backbone.Model.extend({
    defaults: {
        id : null,

        from : {},
        to : [],
        cc : [],
        bcc : [],

        in_reply_to_mid : null,

        subject : '',

        received : null,
        unread : null,
        labels : [],
        threads : [],

        body : [],

        attachments : []
    },
    urlRoot: "/messages",
    initialize : function() {
    },
}, { typeName : "Message" });


Curie.Models.Draft = Curie.Models.Message.extend({
    urlRoot : "/drafts",

    defaults: {
        currentThread : null
    },

    initialize : function() {
        this.changedByUser = false;
    },

    newInstance : function(options) {
        options = options || {};
        _.extend(options, {
            created : new Date(),
            from : curie.state.account.get("primary"),
        });
        return new Curie.Models.Draft(options);
    },

    inReplyTo : function(message) {
        this.set("to", [message.get("from")]);
        this.set("in_reply_to_mid", message.get("id"));
        this.set("subject", "Re: " + (message.get("subject") || ""));
    }


}, { typeName : "Draft" });


function parseMessage(message) {
    if (message.thread) {
        return curie.cache.add(Curie.Models.Thread, message);
    } else if (message.draft || message.labels.indexOf("draft") > -1) {
        return curie.cache.add(Curie.Models.Draft, message);
    } else {
        return curie.cache.add(Curie.Models.Message, message);
    }
}

Curie.Models.ThreadMessages = Backbone.Collection.extend({
    comparator : function(message) {
        return message.get("received"); // newest goes last
    }
}, { typeName : "ThreadMessages" });


Curie.Models.Messages = Backbone.Collection.extend({
    model : Curie.Models.Message,
    comparator : function(message) {
        return -message.get("received"); // newest goes first
    },
    parse : function(docs, options) {
        var newMessages = docs.map(parseMessage);
        if (options && options.extend) {
            return _.union(this.models, newMessages);
        } else {
            return newMessages;
        }
    },
    
}, { typeName : "Messages" });


Curie.Models.Thread = Backbone.Model.extend({
    urlRoot : "/threads",
    defaults: {
        id : null,
        received : null,
        unread : null,
        last : null,
        labels : [],
        length : 0,
        messages : null,
    },
    initialize : function() {
        if (!this.get("messages")) {
            this.set("messages", new Curie.Models.ThreadMessages());
        }
    },
    withMessages : function(messagesArray) {
        this.get("messages").add(messagesArray);
        return this;
    },
    parse : function(response) {

        this.get("messages").add(response.messages.map(parseMessage)).sort();

        return _.extend(response, {
            messages : this.get("messages"),
        });
    }
}, { typeName : "Thread" });



Curie.Models.PagedMessagesWrapper = Backbone.Model.extend({
    page : 0,
    total : 0,
    initialize : function() {
        this.messages = new Curie.Models.Messages();
        this.ctx = {};
    },
    fetchMessages : function() {
        return this.fetch({update : true});
    },
    fetch : function(options) {
        _.extend(this.ctx, {
            page : this.page
        });
        return Backbone.Model.prototype.fetch.call(this, options);
    },
    nextPage : function() {
        this.page += 1;
        return this.fetchMessages();
    },
    parseMessages : function(docs) {
        return Curie.Models.Messages.prototype.parse(docs);
    },
    parse : function(response) {
        if (response) {
            if (response.docs) {
                this.messages.add(this.parseMessages(response.docs));
            }
            this.page = response.page;
            this.total = response.total;
        }
        return response;
    }
});


Curie.Models.Pack = Curie.Models.PagedMessagesWrapper.extend({
    defaults : {
        id : null,
        name : null,
        unread : null,
    },
    initialize : function() {
        Curie.Models.PagedMessagesWrapper.prototype.initialize.apply(this, arguments);
        this.messages.url = '/packs/' + this.get("name") + '/messages';
        this.total = this.get("size");
    },
    fetchMessages : function(options) {
        this.messages.ctx = {
            page : this.page
        };

        options = options || {};
        _.extend(options, {
            update : true,
            extend : (this.page != 0)
        });
        return this.messages.fetch(options);
    },
}, { typeName : "Pack" });


Curie.Models.SearchResults = Curie.Models.PagedMessagesWrapper.extend({
    url : "/search",
    defaults : {
        id : null,
        query : null,
        size : 0,
        unread : null,
        name : "search",
    },
    initialize: function() {
        Curie.Models.PagedMessagesWrapper.prototype.initialize.apply(this, arguments);

        if (this.get("query")) {
            var query = this.get("query");
            this.ctx = { query : query};
            this.queryHash = utf8_to_b64(query);

            this.setName(query);
        }
    },

    setName : function(query) {
        this.set("name", 'Search for "' + (query || this.get("query")) + '"');
    },

    destroy : function() {
        this.trigger("destroy", this);
    },

}, { typeName : "SearchResults" });


Curie.Models.Packs = Backbone.Collection.extend({
    model: Curie.Models.Pack,
    parse : function(resp, options) {
        return resp.map(function(m) {
            return curie.cache.add(Curie.Models.Pack, m);
        });
    },
}, { typeName : "Packs" });

Curie.Models.Contacts = Backbone.Collection.extend({
    url : "/contacts/from",
});

Curie.Models.ChatHistory = Curie.Models.PagedMessagesWrapper.extend({
    url : "/search/top",
    defaults : {
        query : null,
        size : 0,
        amount : 5,
    },
    initialize: function() {
        Curie.Models.PagedMessagesWrapper.prototype.initialize.apply(this, arguments);

        if (this.get("query")) {
            var query = this.get("query");
            this.ctx = {
                query : query,
                amount : this.get("amount")
            };
            this.queryHash = utf8_to_b64(query);
        }
    },

    destroy : function() {
        this.trigger("destroy", this);
    },

}, { typeName : "ChatHistory" });

Curie.Models.Account = Backbone.Model.extend({
    defaults: {
        primary : {},
        mailboxes : {},
    },
    url: "/account",
});

Curie.Models.Filters = Backbone.Collection.extend({
    url: "/filters",
}, { typeName : "Filters" });

Curie.Models.State = Backbone.Model.extend({
    defaults: {
        activePack : null,
        selectedPack : null,
        localHotkeysKeyListener : new Backbone.Model(), //dummy
    },
    account : new Curie.Models.Account(),

    setPackByName : function(packName) {
        var activePack = (packName == null) ? null : curie.cache.findWhere(Curie.Models.Pack, "name", packName);
        curie.state.set("activePack", activePack);
    }
});
