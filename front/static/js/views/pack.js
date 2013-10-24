var PACK_STYLES = {
    LIST : "list",
    COMBINED : "combined",
    TILES : "tiles"
};

var PackView = Backbone.View.extend({
    initialize : function() {

        stateModel.on("change:activePackName", this.changeActivePack, this);
        stateModel.on("showPackAs", this.changePackStyle, this);

        this.model.messages.on("add", this.placeSubview, this);
        this.model.messages.on("reset", this.renderAll, this);
        this.model.messages.on("change", this.rerenderSubview, this);

        this.model.messages.on("sort", this.renderAll, this);

        this.model.groups.on("add", this.addGroup, this);
        this.model.groups.on("reset", this.render, this);


        this.on("move", this.moveMarker, this);
        this.on("mark", this.markSelected, this);

        this.activeStyle = PACK_STYLES.LIST;

        this.showMessageFunction = this.options.showMessageFunction || "showMessage"; // to reverse to a proper link (pack vs search links)

        this.styles = {
            listOld : {
                models : this.model.messages,
                el : $('<div id="messages-list" class="messageList"></div>'),
                selector : ".messageRow",
                idPrefix : "message-row-",
                views : {},
                viewClass : MessageRowView,
            },
            list : {
                models : this.model.messages,
                el : $('<div id="messages" class="messageList"></div>'),
                selector : ".messageRow",
                idPrefix : "message-row-",
                views : {},
                viewClass : WrappedRowView,
            },
            tiles : {
                models : this.model.groups,
                el : $('<div id="pack-groups" class="packGroups"></div>'),
                selector : ".packGroup",
                idPrefix : "message-group-",
                views : {},
                viewClass : MessageGroupView,
            },
            combined : {
                models : this.model.groups,
                el : $('<div id="pack-groups" class="packGroups"></div>'),
                selector : ".packGroup",
                idPrefix : "message-group-",
                views : {},
                viewClass : MessageGroupListView,
            },
        };

        if (this.options.title) {
            _.each(this.styles, function(value, key) {

                var title = $("<div class='lead title'>" + this.options.title + "</div>");
                //var wrapper = $("<div></div>");
                //wrapper.append(title);
                //wrapper.append(value.el);
                value.el.append(title);
            }, this);
        }

        console.info("PackView for " + this.model.get("name") + " initialized");

        this.rootUrl = this.options.rootUrl || window.curie.router.reverse('showPack', { pack : this.model.get("name") })
    },

    getActiveStyle : function() {
        return this.styles[this.activeStyle];
    },

    createSubView : function(model, collection) {
        var style = this.getActiveStyle();
        collection = collection || style.models;

        var modelsWithoutViews = _.filter(collection.models, function(model) {
            return !style.views[model.id]
        }, this);

        _.each(modelsWithoutViews, function(model) {
            style.views[model.id] = new style.viewClass({
                model : model,
                rootUrl : this.rootUrl,
                pack : this.model.get("name"),
            });
            console.info("subview added for " + model.id + " to style " + this.activeStyle, style.views[model.id]);
        }, this);
        return style.views[model.id];
    },

    changePackStyle : function(newStyle) {
        if (newStyle != this.activeStyle && stateModel.get("activePackName") == this.model.get("name")) {

            this.model.groups.sort();

            this.activeStyle = newStyle;
            this.insertElement();
            this.render();
        }
    },

    addGroup : function(model, collection) {
        if (this.activeStyle == PACK_STYLES.COMBINED || this.activeStle == PACK_STYLES.TILES) {
            console.info("Adding group", model);
            this.createSubView(model, collection);
            this.render();
        }
    },

    beforeClose : function() {
        // remove all DOM elements
        _.map(this.styles, function(val, key) {
            val.el.remove();
        }, this);
    },

    insertElement : function() {
        _.map(this.styles, function(val, key) {
            if (this.activeStyle != key) {
                val.el.remove();
            }
        }, this);
        var style = this.getActiveStyle();
        if (!isElementInDOM(style.el)) {
            console.info("adding PackView to DOM: pack=" + this.model.get('name') + ", " + this.activeStyle);
            $("#list", "#packView").html(style.el);
        } else {
            console.info("DOM element for PackView name=" + this.model.get('name') + " is in tree already");
        }
    },

    changeActivePack : function(i, activePackName) {
        var style = this.getActiveStyle();
        if (this.model.get("name") == activePackName) {
            this.insertElement();
        } else if (i && this.model.get("name") != activePackName) {
            console.info("REMOVING pack " + this.model.get("name") + " because active=" + activePackName);
            _.map(this.styles, function(val, key) {
                val.el.remove();
            }, this);
            return;
        }
        this.render();

    },

    placeSubview : function(model, collection) {

        var style = this.getActiveStyle();
        var view = style.views[model.id] || this.createSubView(model);

        var modelIndex = collection.indexOf(model);
        var uiIndex = $("#" + style.idPrefix + model.id, style.el).index();


        if (!view.$el) {
            view.render();
        }

        var squatter = $(style.selector + ":nth-child(" + (modelIndex + 1) + ")", style.el);
        var newRow = view.$el;

        if (uiIndex != modelIndex) {
            console.info(this.model.get("name"), "ui=" + uiIndex, "collection=" + modelIndex, "model=" + model.id);
            $(view.$el, style.el).remove();
        } else {
            return;
        }

        if (squatter.length == 0) {
            style.el.append(newRow);
        } else {
            squatter.before(newRow);
        }
    },

    rerenderSubview : function(model, collection) {
        console.info(model.id);
        var style = this.getActiveStyle();
        var view = style.views[model.id] || this.createSubView(model);
        $(view.$el, style.el).replaceWith(view.render().$el);
    },

    renderAll : function(collection, redrawModel) {
        collection.each(function(model, index) {
            this.placeSubview(model, collection);
        }, this);
    },

    render : function(i, activePackName) {

        var style = this.getActiveStyle();
        this.renderAll(this.model.messages);
//        console.info("settings pack " + this.model.get("name") + " as an activeArrowsListener");
//        stateModel.set("activeArrowsListener", this);
        return this;
    },

    moveMarker : function(m) {
        var style = this.getActiveStyle();
        console.info(style);

        var view = style.views[style.models.models[0].id];
        console.info(view);
        view.set("selected", true);
        if (m == "j") {
        }
    },

    markSelected : function(a) {
    }
});

