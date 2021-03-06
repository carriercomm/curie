Curie.Controllers.Layout.Basic = function () {

    var appView = new AppView();
    var loginView = new LoginModalView();

    var packListViews = [];

    appView.render();

    var popupView = new PopupView({ el : appView.$("#popupView")});
    var sidebarView = new SidebarView({ el : appView.$("#sidebarView")});
    sidebarView.render();

    var renderPackListView = function(collection) {
        var newView = new PackListView({ collection: collection });
        packListViews.push(newView);
        newView.render();
        sidebarView.addPackListView(newView);
    }

    var showPopup = function(objType, objId, draftEmailTo) {

        var obj;
        if (objId && objId != '') {
            obj = curie.cache.add(objType, { id : objId });
        } else {
            if (objType.prototype.newInstance) {
                obj = objType.prototype.newInstance();
                if (draftEmailTo) {
                    obj.set("to", [{email : draftEmailTo}]);
                }
            } else {
                console.error("Can't create new instance for", objType.constructor.typeName);
                return;
            }
        }

        var viewClass;
        var subview;

        if (objType == Curie.Models.Message) {
            //viewClass = MessageView;
            viewClass = ThreadView;
            subview = new viewClass({ model : new Curie.Models.Thread().withMessages([obj]) });
        } else if (objType == Curie.Models.Thread) {
            viewClass = ThreadView;
        } else if (objType == Curie.Models.Draft) {
            viewClass = Curie.Views.DraftView;
        } else {
            console.error("Unknown obj type. Can't show a popup with", objType, objId);
            return;
        }

        subview = subview || new viewClass({ model : obj });
        subview.render();
        if (objId) {
            //popupView.hide();
            obj.fetch({
                success : function() {
                    //popupView.hide().render(subview);
                    popupView.render(subview);
                    popupView.$(".content").stop().css("opacity", 1);
                }
            });
            popupView.$(".content").animate({opacity : 0.3});
        } else {
            popupView.hide().render(subview);
        }

        curie.state.set("localHotkeysKeyListener", subview);
    }

    var updateTitle = function() {
        var activePack = curie.state.get("activePack");
        if (activePack) {
            var unread = activePack.get("unread");
            var name = activePack.get("name");
            document.title = ((unread && unread > 0) ? "(" + unread +") " : "") + name + " - Curie";
        } else {
            document.title = "Curie";
        }

    }

    curie.state.on({

        "search:show" : appView.showSearch,
        "search:hide" : appView.hideSearch,

        "labels:show" : appView.showLabels,
        "labels:hide" : appView.hideLabels,

        "hotkey:esc" : appView.hideSearch,

        "navigate:activePack" : popupView.hide,
        "draft:new" : sidebarView.toggleDraftLink,

        "connection:established" : sidebarView.hideAlert,
        "connection:error" : sidebarView.showAlert,

        "fetch:done" : sidebarView.updateLastFetchTime,

        "login:fail" : loginView.shake,
        "login:show" : loginView.show,

        "change:activePack" : function(state, pack) {
            console.info("active pack is", pack);
            updateTitle();
            _.each(packListViews, function(view) {
                view.updateActive(pack);
            });
            //FIXME: race condition when opening pack and message at the same time
            popupView.hide();
        },
        "change:selectedPack" : function(state, pack) {
            _.values(packListViews).each(function(view) {
                view.updateSelected(pack);
            });
        },
        "message:show:type" : function(type) {
            console.info(popupView.getSubview());
            popupView && popupView.getSubview() && popupView.getSubview().showBodyType(type);
        }
    });

    curie.state.account.on("change", sidebarView.updateAccountInfo);

    curie.state.on("login:success", appView.showMainBlock);
    curie.state.on("login:success", loginView.hide);

    curie.state.on("hotkey:esc", appView.hideSearch);
    curie.state.on("hotkey:esc", function() {
        if (popupView.$el.is(":visible")) {
            curie.state.trigger("navigate:activePack");
        }
    });

    //FIXME
    //stateModel.on("message:show:type", this.changeBodyTypeHotkey, this);


    _.extend(this, {
        showPopup : showPopup,
        renderPackListView : renderPackListView,
        updateTitle : updateTitle
    });
}
