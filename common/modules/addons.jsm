// Copyright (c) 2011 by Kris Maglione <maglione.k@gmail.com>
//
// This work is licensed for reuse under an MIT license. Details are
// given in the LICENSE.txt file included with this file.
"use strict";

try {

Components.utils.import("resource://dactyl/bootstrap.jsm");
defineModule("addons", {
    exports: ["AddonManager", "Addons", "Addon", "addons"],
    require: ["services"],
    use: ["config", "io", "prefs", "template", "util"]
}, this);

var callResult = function callResult(method) {
    let args = Array.slice(arguments, 1);
    return function (result) { result[method].apply(result, args); };
}

var listener = function listener(action, event)
    function addonListener(install) {
        this.dactyl[install.error ? "echoerr" : "echomsg"](
            "Add-on " + action + " " + event + ": " + (install.name || install.sourceURI.spec) +
            (install.error ? ": " + addonErrors[install.error] : ""));
    }

var AddonListener = Class("AddonListener", {
    init: function init(modules) {
        this.dactyl = modules.dactyl;
    },

    onNewInstall:      function (install) {},
    onExternalInstall: function (addon, existingAddon, needsRestart) {},
    onDownloadStarted:   listener("download", "started"),
    onDownloadEnded:     listener("download", "complete"),
    onDownloadCancelled: listener("download", "cancelled"),
    onDownloadFailed:    listener("download", "failed"),
    onDownloadProgress:  function (install) {},
    onInstallStarted:   function (install) {},
    onInstallEnded:     listener("installation", "complete"),
    onInstallCancelled: listener("installation", "cancelled"),
    onInstallFailed:    listener("installation", "failed")
});

var updateAddons = Class("UpgradeListener", AddonListener, {
    init: function init(addons, modules) {
        init.supercall(this, modules);

        util.assert(!addons.length || addons[0].findUpdates,
                    "Not available on " + config.host + " " + services.runtime.version);

        this.remaining = addons;
        this.upgrade = [];
        this.dactyl.echomsg("Checking updates for addons: " + addons.map(function (a) a.name).join(", "));
        for (let addon in values(addons))
            addon.findUpdates(this, AddonManager.UPDATE_WHEN_USER_REQUESTED, null, null);

    },
    onUpdateAvailable: function (addon, install) {
        this.upgrade.push(addon);
        install.addListener(this);
        install.install();
    },
    onUpdateFinished: function (addon, error) {
        this.remaining = this.remaining.filter(function (a) a != addon);
        if (!this.remaining.length)
            this.dactyl.echomsg(
                this.upgrade.length
                    ? "Installing updates for addons: " + this.upgrade.map(function (i) i.name).join(", ")
                    : "No addon updates found");
    }
});

var actions = {
    delete: {
        name: "extde[lete]",
        description: "Uninstall an extension",
        action: callResult("uninstall"),
        perm: "uninstall"
    },
    enable: {
        name: "exte[nable]",
        description: "Enable an extension",
        action: function (addon) addon.userDisabled = false,
        filter: function ({ item }) item.userDisabled,
        perm: "enable"
    },
    disable: {
        name: "extd[isable]",
        description: "Disable an extension",
        action: function (addon) addon.userDisabled = true,
        filter: function ({ item }) !item.userDisabled,
        perm: "disable"
    },
    rehash: {
        name: "extr[ehash]",
        description: "Reload an extension",
        action: function (addon) {
            dactyl.assert(dactyl.has("Gecko2"), "This command is not useful in this version of " + config.host);
            util.timeout(function () {
                addon.userDisabled = true;
                addon.userDisabled = false;
            });
        },
        get filter() {
            let ids = set(keys(JSON.parse(prefs.get("extensions.bootstrappedAddons", "{}"))));
            return function ({ item }) !item.userDisabled && set.has(ids, item.id);
        },
        perm: "disable"
    },
    toggle: {
        name: "extt[oggle]",
        description: "Toggle an extension's enabled status",
        action: function (addon) addon.userDisabled = !addon.userDisabled
    },
    update: {
        name: "extu[pdate]",
        description: "Update an extension",
        actions: updateAddons,
        perm: "upgrade"
    }
};


var Addon = Class("Addon", {
    init: function init(addon, list) {
        this.addon = addon;
        this.instance = this;
        this.list = list;

        this.nodes = {
            commandTarget: this
        };
        util.xmlToDom(
            <li highlight="Addon" key="row" xmlns:dactyl={NS} xmlns={XHTML}>
                <span highlight="AddonName" key="name">
                </span>
                <span highlight="AddonVersion" key="version"/>
                <span highlight="AddonStatus" key="status"/>
                <span highlight="AddonButtons Buttons">
                    <a highlight="Button" key="enable">On&#xa0;</a>
                    <a highlight="Button" key="disable">Off</a>
                    <a highlight="Button" key="delete">Del</a>
                    <a highlight="Button" key="update">Upd</a>
                </span>
                <span highlight="AddonDescription" key="description"/>
            </li>,
            this.list.document, this.nodes);

        this.update();
    },

    commandAllowed: function commandAllowed(cmd) {
        util.assert(set.has(actions, cmd), "Unknown command");

        let action = actions[cmd];
        if ("perm" in action && !(this.permissions & AddonManager["PERM_CAN_" + action.perm.toUpperCase()]))
            return false;
        if ("filter" in action && !action.filter({ item: this }))
            return false;
        return true;
    },

    command: function command(cmd) {
        util.assert(this.commandAllowed(cmd), "Command not allowed");

        let action = actions[cmd];
        if (action.action)
            action.action.call(this.modules, this);
        else
            action.actions([this], this.list.modules);
    },

    compare: function compare(other) String.localeCompare(this.name, other.name),

    get statusInfo() {
        let info = this.isActive ? <span highlight="Enabled">enabled</span>
                                 : <span highlight="Disabled">disabled</span>;

        let pending;
        if (this.pendingOperations & AddonManager.PENDING_UNINSTALL)
            pending = ["Disabled", "uninstalled"];
        else if (this.pendingOperations & AddonManager.PENDING_DISABLE)
            pending = ["Disabled", "disabled"];
        else if (this.pendingOperations & AddonManager.PENDING_INSTALL)
            pending = ["Enabled", "installed"];
        else if (this.pendingOperations & AddonManager.PENDING_ENABLE)
            pending = ["Enabled", "enabled"];
        else if (this.pendingOperations & AddonManager.PENDING_UPGRADE)
            pending = ["Enabled", "upgraded"];
        if (pending)
            return <>{info}&#xa0;(<span highlight={pending[0]}>{pending[1]}</span>
                                  &#xa0;on restart)</>;
        return info;
    },

    update: function callee() {
        let self = this;
        function update(key, xml) {
            let node = self.nodes[key];
            while (node.firstChild)
                node.removeChild(node.firstChild);
            node.appendChild(util.xmlToDom(<>{xml}</>, self.list.document));
        }

        update("name", template.icon({ icon: this.iconURL }, this.name));
        this.nodes.version.textContent = this.version;
        update("status", this.statusInfo);
        this.nodes.description.textContent = this.description;

        for (let node in values(this.nodes))
            if (node.update && node.update !== callee)
                node.update();
    }
});

["cancelUninstall", "findUpdates", "getResourceURI", "hasResource",
 "isCompatibleWith", "uninstall"].forEach(function (prop) {
     Addon.prototype[prop] = function proxy() this.addon[prop].apply(this.addon, arguments);
});

["aboutURL", "appDisabled", "applyBackgroundUpdates", "blocklistState",
 "contributors", "creator", "description", "developers", "homepageURL",
 "iconURL", "id", "install", "installDate", "isActive", "isCompatible",
 "isPlatformCompatible", "name", "operationsRequiringRestart",
 "optionsURL", "pendingOperations", "pendingUpgrade", "permissions",
 "providesUpdatesSecurely", "releaseNotesURI", "scope", "screenshots",
 "size", "sourceURI", "translators", "type", "updateDate",
 "userDisabled", "version"].forEach(function (prop) {
    Object.defineProperty(Addon.prototype, prop, {
        get: function get_proxy() this.addon[prop],
        set: function set_proxy(val) this.addon[prop] = val
    });
});

var AddonList = Class("AddonList", {
    init: function init(modules, types) {
        this.modules = modules;
        this.nodes = {};
        this.addons = [];
        this.ready = false;

        AddonManager.getAddonsByTypes(types, this.closure(function (addons) {
            addons.forEach(this.closure.addAddon);
            this.ready = true;
            this.update();
        }));
        AddonManager.addAddonListener(this);
    },
    cleanup: function cleanup() {
        AddonManager.removeAddonListener(this);
    },

    message: Class.memoize(function () {

        util.xmlToDom(<ul highlight="Addons" key="list" xmlns={XHTML}>
                        <li highlight="AddonHead">
                            <span>Name</span>
                            <span>Version</span>
                            <span>Status</span>
                            <span/>
                            <span>Description</span>
                        </li>
                      </ul>, this.document, this.nodes);

        return this.nodes.list;
    }),

    addAddon: function addAddon(addon) {
        if (addon.id in this.addons)
            this.update(addon);
        else {
            addon = Addon(addon, this);
            this.addons[addon.id] = addon;

            let index = values(this.addons).sort(function (a, b) a.compare(b))
                                           .indexOf(addon);

            this.nodes.list.insertBefore(addon.nodes.row,
                                         this.nodes.list.childNodes[index + 1]);
            this.update();
        }
    },
    removeAddon: function removeAddon(addon) {
        if (addon.id in this.addons) {
            this.nodes.list.removeChild(this.addons[addon.id].nodes.row);
            delete this.addons[addon.id];
            this.update();
        }
    },

    leave: function leave(stack) {
        if (stack.pop)
            this.cleanup();
    },

    update: function update(addon) {
        if (addon && addon.id in this.addons)
            this.addons[addon.id].update();
        if (this.ready)
            this.modules.commandline.updateOutputHeight(false);
    },

    onDisabled:           function (addon) { this.update(addon); },
    onDisabling:          function (addon) { this.update(addon); },
    onEnabled:            function (addon) { this.update(addon); },
    onEnabling:           function (addon) { this.update(addon); },
    onInstalled:          function (addon) { this.addAddon(addon); },
    onInstalling:         function (addon) { this.update(addon); },
    onUninstalled:        function (addon) { this.removeAddon(addon); },
    onUninstalling:       function (addon) { this.update(addon); },
    onOperationCancelled: function (addon) { this.update(addon); },
    onPropertyChanged: function onPropertyChanged(addon, properties) {}
});

var Addons = Module("addons", {
}, {
}, {
    commands: function (dactyl, modules, window) {
        const { commands, completion } = modules;

        let addonListener = AddonListener(modules);

        commands.add(["exta[dd]"],
            "Install an extension",
            function (args) {
                let url  = args[0];
                let file = io.File(url);
                function install(addonInstall) {
                    addonInstall.addListener(addonListener);
                    addonInstall.install();
                }

                if (!file.exists())
                    AddonManager.getInstallForURL(url,   install, "application/x-xpinstall");
                else if (file.isReadable() && file.isFile())
                    AddonManager.getInstallForFile(file, install, "application/x-xpinstall");
                else if (file.isDirectory())
                    dactyl.echoerr("Cannot install a directory: " + file.path.quote());
                else
                    dactyl.echoerr("E484: Can't open file " + file.path);
            }, {
                argCount: "1",
                completer: function (context) {
                    context.filters.push(function ({ item }) item.isDirectory() || /\.xpi$/.test(item.leafName));
                    completion.file(context);
                },
                literal: 0
            });

        // TODO: handle extension dependencies
        values(actions).forEach(function (command) {
            let perm = command.perm && AddonManager["PERM_CAN_" + command.perm.toUpperCase()];
            function ok(addon) !perm || addon.permissions & perm;

            commands.add([command.name],
                command.description,
                function (args) {
                    let name = args[0];
                    if (args.bang)
                        dactyl.assert(!name, "E488: Trailing characters");
                    else
                        dactyl.assert(name, "E471: Argument required");

                    AddonManager.getAddonsByTypes(["extension"], dactyl.wrapCallback(function (list) {
                        if (!args.bang) {
                            list = list.filter(function (extension) extension.name == name);
                            if (list.length == 0)
                                return void dactyl.echoerr("E475: Invalid argument: " + name);
                            if (!list.every(ok))
                                return void dactyl.echoerr("Permission denied");
                        }
                        if (command.actions)
                            command.actions(list, this.modules);
                        else
                            list.forEach(command.action, this.modules);
                    }));
                }, {
                    argCount: "?", // FIXME: should be "1"
                    bang: true,
                    completer: function (context) {
                        completion.extension(context);
                        context.filters.push(function ({ item }) ok(item));
                        if (command.filter)
                            context.filters.push(command.filter);
                    },
                    literal: 0
                });
        });

        commands.add(["exto[ptions]", "extp[references]"],
            "Open an extension's preference dialog",
            function (args) {
                AddonManager.getAddonsByTypes(["extension"], dactyl.wrapCallback(function (list) {
                    list = list.filter(function (extension) extension.name == args[0]);
                    if (!list.length || !list[0].optionsURL)
                        dactyl.echoerr("E474: Invalid argument");
                    else if (args.bang)
                        window.openDialog(list[0].optionsURL, "_blank", "chrome");
                    else
                        dactyl.open(list[0].optionsURL, { from: "extoptions" });
                }));
            }, {
                argCount: "1",
                bang: true,
                completer: function (context) {
                    completion.extension(context);
                    context.filters.push(function ({ item }) item.isActive && item.optionsURL);
                },
                literal: 0
            });

        commands.add(["addo[ns]", "ao"],
            "List installed extensions",
            function (args) {
                let addons = AddonList(modules, ["extension"]);
                modules.commandline.echo(addons);

                if (modules.commandline.savingOutput)
                    util.waitFor(function () addons.ready);
            });
    }
});

if (!Ci.nsIExtensionManager || !services.extensionManager)
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
else
    var AddonManager = {
        getAddonByID: function (id, callback) {
            callback = callback || util.identity;
            let addon = id;
            if (!isObject(addon))
                addon = services.extensionManager.getItemForID(id);
            if (!addon)
                return callback(null);
            addon = Object.create(addon);

            function getRdfProperty(item, property) {
                let resource = services.rdf.GetResource("urn:mozilla:item:" + item.id);
                let value = "";

                if (resource) {
                    let target = services.extensionManager.datasource.GetTarget(resource,
                        services.rdf.GetResource("http://www.mozilla.org/2004/em-rdf#" + property), true);
                    if (target && target instanceof Ci.nsIRDFLiteral)
                        value = target.Value;
                }

                return value;
            }

            ["aboutURL", "creator", "description", "developers",
             "homepageURL", "installDate", "optionsURL",
             "releaseNotesURI", "updateDate"].forEach(function (item) {
                memoize(addon, item, function (item) getRdfProperty(this, item));
            });

            update(addon, {

                appDisabled: false,

                installLocation: Class.memoize(function () services.extensionManager.getInstallLocation(this.id)),
                getResourceURI: function getResourceURI(path) {
                    let file = this.installLocation.getItemFile(this.id, path);
                    return services.io.newFileURI(file);
                },

                isActive: getRdfProperty(addon, "isDisabled") != "true",

                uninstall: function uninstall() {
                    services.extensionManager.uninstallItem(this.id);
                },

                get userDisabled() getRdfProperty(addon, "userDisabled") === "true",
                set userDisabled(val) {
                    services.extensionManager[val ? "disableItem" : "enableItem"](this.id);
                }
            });

            return callback(addon);
        },
        getAddonsByTypes: function (types, callback) {
            let res = [];
            for (let [, type] in Iterator(types))
                for (let [, item] in Iterator(services.extensionManager
                            .getItemList(Ci.nsIUpdateItem["TYPE_" + type.toUpperCase()], {})))
                    res.push(this.getAddonByID(item));
            return (callback || util.identity)(res);
        },
        getInstallForFile: function (file, callback, mimetype) {
            callback({
                addListener: function () {},
                install: function () {
                    services.extensionManager.installItemFromFile(file, "app-profile");
                }
            });
        },
        getInstallForURL: function (url, callback, mimetype) {
            dactyl.assert(false, "Install by URL not implemented");
        },
    };

var addonErrors = array.toObject([
    [AddonManager.ERROR_NETWORK_FAILURE, "A network error occurred"],
    [AddonManager.ERROR_INCORRECT_HASH,  "The downloaded file did not match the expected hash"],
    [AddonManager.ERROR_CORRUPT_FILE,    "The file appears to be corrupt"],
    [AddonManager.ERROR_FILE_ACCESS,     "There was an error accessing the filesystem"]]);


endModule();

} catch(e){ if (isString(e)) e = Error(e); dump(e.fileName+":"+e.lineNumber+": "+e+"\n" + e.stack); }

// vim: set fdm=marker sw=4 ts=4 et ft=javascript:
