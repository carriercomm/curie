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
    } else if (message.draft) {
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
        console.error("Received", response);
        this.messages.add(this.parseMessages(response.docs));
        this.page = response.page;
        this.total = response.total;
        return response;
    }
});


var Pack = Curie.Models.PagedMessagesWrapper.extend({
    defaults : {
        id : null,
        name : null,
        size : null,
        unread : null,
    },
    initialize : function() {
        Curie.Models.PagedMessagesWrapper.prototype.initialize.apply(this, arguments);
        this.messages.url = '/packs/' + this.get("name") + '/messages';
        this.total = this.get("size");
    },
    fetchMessages : function() {
        this.messages.ctx = {
            page : this.page
        };
        return this.messages.fetch({update : true, extend : true});
    },
}, { typeName : "Pack" });


var SearchResults = Curie.Models.PagedMessagesWrapper.extend({
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

        this.ctx = { query : this.get("query") };
        this.queryHash = utf8_to_b64(query);
        this.set("name", this.getName());
    },

    getName : function(query) {
        return 'Search for "' + (query || this.get("query")) + '"';
    },

}, { typeName : "SearchResults" });


var Packs = Backbone.Collection.extend({
    model: Pack,
    parse : function(resp, options) {
        return resp.map(function(m) {
            return curie.cache.add(Pack, m);
        });
    },
});

Curie.Models.Account = Backbone.Model.extend({
    defaults: {
        primary : {},
        mailboxes : {},
    },
    urlRoot: "/account",
});

Curie.Models.State = Backbone.Model.extend({
    defaults: {
        activePack : null,
        selectedPack : null,
    },
    account : new Curie.Models.Account(),

    setPackByName : function(packName) {
        var activePack = (packName == null) ? null : curie.cache.getByProperty(Pack, "name", packName);
        curie.state.set("activePack", activePack);
    }
    
});
