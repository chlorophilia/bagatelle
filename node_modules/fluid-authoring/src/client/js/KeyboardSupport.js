/*
Copyright 2017 Raising the Floor - International
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

(function ($, fluid) {
    "use strict";

    fluid.orientations = ["horizontal", "vertical"];

    fluid.directionAxes = fluid.freezeRecursive({
        "left": "horizontal",
        "right": "horizontal",
        "up": "vertical",
        "down": "vertical"
    });

    fluid.directionSigns = fluid.freezeRecursive({
        "left": -1,
        "right": 1,
        "up": -1,
        "down": 1
    });

    // Identical with GeometricManager.js line 60
    fluid.directionSign = function (direction) {
        return fluid.directionSigns[direction];
    };

    fluid.directionOrientation = function (direction) {
        return fluid.directionAxes[direction];
    };

    fluid.registerNamespace("fluid.keys");

    fluid.keys.printableCharKeys = "abcdefghijklmnopqrstuvwxyz0123456789";

    fluid.keys.generateKeyCodes = function (printableCharKeys) {
        var togo = fluid.copy($.ui.keyCode);
        fluid.each(printableCharKeys, function (c) {
            togo[c] = c.toUpperCase().charCodeAt(0);
        });
        return togo;
    };

    fluid.keyCodes = fluid.keys.generateKeyCodes(fluid.keys.printableCharKeys);

    fluid.keys.noKeyModifiers = fluid.freezeRecursive({
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false
    });

    /** A simple "flat equality" check - members with names given in the first argument will be looked up in the 2nd argument,
     * and the test will pass if their values agree with respect to the JavaScript `===` operator
     * @param tests {Object: String -> Primitive} A hash of checks
     * @param toCheck {Object} An object to be checked
     * @return {Boolean} `true` if the value corresponding to each key in `tests` is present in `toCheck` with a matching value
     */
    fluid.flatEquals = function (tests, toCheck) {
        return !fluid.find(tests, function (testValue, key) {
            return toCheck[key] !== testValue ? true : undefined;
        }, false);
    };

    fluid.registerNamespace("fluid.keys.defaultKeysets");

    /**
     * Default keysets for 2-dimensional motion
     */
    fluid.keys.defaultKeysets.grid = fluid.freezeRecursive({
        cursorKeys: {
            modifiers: fluid.keys.noKeyModifiers,
            up : fluid.keyCodes.UP,
            down : fluid.keyCodes.DOWN,
            right : fluid.keyCodes.RIGHT,
            left : fluid.keyCodes.LEFT
        },
        appleIIKeys: {
            modifiers: fluid.keys.noKeyModifiers,
            up : fluid.keyCodes.i,
            down : fluid.keyCodes.m,
            right : fluid.keyCodes.k,
            left : fluid.keyCodes.j
        }
    });

    /**
     * Default keysets for 1-axis motion, horizontal and vertical separately
     */
    fluid.keys.defaultKeysets.linear = fluid.freezeRecursive({
        horizontal: {
            cursors: {
                modifiers: fluid.keys.noKeyModifiers,
                right : fluid.keyCodes.RIGHT,
                left : fluid.keyCodes.LEFT
            }
        },
        vertical: {
            cursors: {
                modifiers: fluid.keys.noKeyModifiers,
                up : fluid.keyCodes.UP,
                down : fluid.keyCodes.DOWN
            }
        }
    });

    /** Compute `v` modulus `mod` always producing a value in the range [0..mod) (as per the mathematical,
     * rather than computer science definition)
     */
    fluid.positiveMod = function (v, mod) {
        return ((v % mod) + mod) % mod;
    };

    fluid.registerNamespace("fluid.keys.selectable");

    fluid.keys.selectable.processEvent = function (options, evt) {
        var closest = $(event.target).closest(options.filterSelector)[0];
        var mapped = closest && options.elementMapper(closest);
        fluid.log("fluid.keys.selectable.processEvent got mapped value ", mapped, " from event ", evt);
        if (fluid.isValue(mapped)) {
            // Taken from parts of fluid.reorderer.handleDirectionKeyDown in Reorderer.js line 371
            fluid.each(options.keysets, function (keyset) {
                if (fluid.flatEquals(keyset.modifiers, evt)) {
                    var keydir = fluid.keyForValue(keyset, evt.keyCode);
                    if (keydir) {
                        fluid.log("Matched key direction ", keydir, " from set " + fluid.keys(keyset).join(", ") + " firing to handler");
                        evt.stopPropagation();
                        options.handler(keydir, mapped, evt);
                    }
                } else {
                    fluid.log("Evt ", evt, " failed modifiers check, discarded");
                }
            });
        }
    };

   /** @param options {Object} contains members:
     *    container {jQuery} Overall host container for key binding
     *    listenerId {String} An extra id to be applied to form the listener's namespace
     *    filterSelector {String} Selector to be used to filter enclosed elements for binding
     *    keysets {Object: String(Key) -> Keyset} The configured "keysets" object from the target component's options
     *    elementMapper {Function: DOMElement -> Any} Function mapping element which passes filterSelector to event
     *        firer argument. A value of `null` or `undefined` will abort processing by this handler.
     *    handler {Function: (Integer(Direction), Any, DomEvent)} Function accepting a pair of (fluid.direction, elementMapper return, DomEvent)
     *        reporting a successfully decoded direction key event
     */
    fluid.keys.selectable.bindEvents = function (options) {
        options.container.on("keydown.fluid-selectable." + options.listenerId, options.filterSelector, function (evt) {
            fluid.keys.selectable.processEvent(options, evt);
        });
    };

    fluid.defaults("fluid.keys.selectable", {
        gradeNames: "fluid.modelComponent",
        components: {
            // Must be overridden with a reference to a viewComponent to whose selectors/dom binder the "selectablesSelector" will be referred
            hostComponent: "fluid.mustBeOverridden"
        },
        selectablesSelectorName: "selectables",
        selectablesSelector: "@expand:fluid.resolveSelectorName({that}.hostComponent, {that}.options.selectablesSelectorName)",
        events: {
            onSelectablesUpdated: null,
            onHandleFocus: null,
            onHandleKey: null
        },
        model: {
            selectedIndex: null
        },
        listeners: {
            "onSelectablesUpdated.updateCache": "fluid.keys.updateSelectablesCache({that})",
            "onCreate.bindFocusListener": "fluid.keys.bindFocusListener({that})",
            "onCreate.bindKeyListener": "fluid.keys.bindKeyListener({that})",
            "onHandleFocus.impl": "fluid.keys.selectable.handleFocus({that}, {arguments}.0)",
            "onHandleKey.impl": "fluid.keys.selectable.handleKey({that}, {arguments}.0)"
        },
        invokers: {
            getSelectables: "{that}.hostComponent.dom.fastLocate({that}.options.selectablesSelectorName)",
            targetToKey: "fluid.keys.selectable.targetToKey({that}, {arguments}.0)",
            elementToKey: "fluid.notImplemented",
            keyToElement: "fluid.notImplemented",
            validateKey: "fluid.notImplemented",
            directionToKey: "fluid.notImplemented"
        },
        modelListeners: {
            "selectedKey": {
                path: "selectedKey",
                func: "fluid.keys.updateFocusedSelectable",
                args: "{that}"
            }
        }
    });

    fluid.keys.updateSelectablesCache = function (selectableComponent) {
        var options = selectableComponent.options;
        var host = selectableComponent.hostComponent;
        selectableComponent.selectables = host.dom.locate(options.selectablesSelectorName);
        fluid.tabindex(selectableComponent.selectables, 0);
        // At least ensure that the selectable index is valid - in practice we want to do better than this and
        // make sure that it survives list invalidations and even global re-rendering
        selectableComponent.applier.change("selectedKey", selectableComponent.validateKey(
            fluid.get(selectableComponent.model, "selectedKey")));
    };

    fluid.keys.updateFocusedSelectable = function (selectableComponent) {
        var key = selectableComponent.model.selectedKey;
        var newFocused = key === null ? null : selectableComponent.keyToElement(key);
        if (newFocused) {
            console.log("Focusing ", newFocused, " as a result of model change to index " + key);
            fluid.focus(newFocused);
        } else if (selectableComponent.lastFocused) {
            fluid.blur(selectableComponent.lastFocused);
        }
        selectableComponent.lastFocused = newFocused;
    };

    fluid.resolveSelectorName = function (that, selectorName) {
        return typeof(that.options.selectors[selectorName]) === "string" ? that.options.selectors[selectorName] : null;
    };

    fluid.keys.bindFocusListener = function (selectableComponent) {
        var host = selectableComponent.hostComponent;
        var selName = selectableComponent.options.selectablesSelector;
        host.container.on("focus.fluid-selectable." + selectableComponent.id, selName,
            selectableComponent.events.onHandleFocus.fire);
    };

    fluid.keys.selectable.targetToKey = function (selectableComponent, element) {
        var closest = $(element).closest(selectableComponent.options.selectablesSelector, selectableComponent.hostComponent.container)[0];
        return closest ? selectableComponent.elementToKey(closest) : null;
    };

    fluid.keys.selectable.handleFocus = function (selectableComponent, event) {
        var newKey = selectableComponent.targetToKey(event.target);
        selectableComponent.applier.change("selectedKey", newKey);
    };

    fluid.keys.bindKeyListener = function (selectableComponent) {
        var host = selectableComponent.hostComponent;
        var filterSelector = selectableComponent.options.selectablesSelector;
        var keyOptions = {
            container: host.container,
            filterSelector: filterSelector,
            listenerId: selectableComponent.id,
            keysets: selectableComponent.options.selectableKeysets,
            elementMapper: selectableComponent.elementToKey,
            handler: selectableComponent.events.onHandleKey.fire
        };
        fluid.keys.selectable.bindEvents(keyOptions);
    };

    fluid.keys.selectable.handleKey = function (selectableComponent, keyDir) {
        var oldKey = selectableComponent.model.selectedKey;
        if (fluid.isValue(oldKey)) {
            var newKey = selectableComponent.directionToKey(oldKey, keyDir);
            selectableComponent.applier.change("selectedKey", newKey);
        }
    };

    /** An implementation grade which maintains a single linear selectable range of DOM elements (either horizontal or
     * vertical), and mutually relays relevant keystrokes, focus events to a common model field `selectedIndex` holding
     * the integer index of the currently selected element. This is designed to be configured as a subcomponent of
     * the `fluid.viewComponent` (the `hostComponent`) holding the selectable elements. These must all be resolvable
     * by means of a common selector, whose name in this component is defaulted to `selectables`. */

    fluid.defaults("fluid.keys.linearSelectable", {
        gradeNames: "fluid.keys.selectable",
        selectableOrientation: "vertical",
        selectableKeysets: {
            expander: {
                func: "fluid.get",
                args: [fluid.keys.defaultKeysets.linear, "{that}.options.selectableOrientation"]
            }
        },
        invokers: {
            elementToKey: "fluid.keys.selectable.elementToIndex({that}, {arguments}.0)",
            keyToElement: "fluid.keys.selectable.indexToElement({that}, {arguments}.0)",
            validateKey: "fluid.keys.selectable.indexToRange({that}, {arguments}.0)",
            // oldKey, direction
            directionToKey: "fluid.keys.selectable.directionToKey({that}, {arguments}.0, {arguments}.1)"
        }
    });

    fluid.keys.selectable.indexToElement = function (selectableComponent, index) {
        return selectableComponent.selectables[index];
    };

    fluid.keys.selectable.indexToRange = function (selectableComponent, index) {
        return fluid.transforms.limitRange(index, {min: 0, max: selectableComponent.selectables.length - 1});
    };

    fluid.keys.selectable.elementToIndex = function (selectableComponent, element) {
        return $.inArray(element, selectableComponent.selectables);
    };

    fluid.keys.selectable.directionToKey = function (selectableComponent, oldIndex, keyDir) {
        return fluid.positiveMod(oldIndex + fluid.directionSign(keyDir), selectableComponent.selectables.length);
    };


    fluid.defaults("fluid.keys.gridSelectable", {
        gradeNames: "fluid.keys.selectable",
        selectableKeysets: fluid.keys.defaultKeysets.grid
    });


    fluid.registerNamespace("fluid.keys.activatable");

    // Corresponds to fluid.activatable.defaults at jquery.keyboard-a11y.js line 619
    fluid.keys.activatable.defaultKeysets = fluid.freezeRecursive({
        activatable: {
            modifiers: fluid.noKeyModifiers,
            keys: [fluid.keyCodes.SPACE, fluid.keyCodes.ENTER]
        }
    });

    // Regularised version of algorithm in fluid.activatable, together with delegated binding
    fluid.keys.processFilterKeysEvent = function (options, evt) {
        var shouldHandle = fluid.find(options.keysets, function (keyset) {
            return fluid.flatEquals(keyset.modifiers, evt) && keyset.keys.includes(evt.keyCode) ? true : undefined;
        });
        if (shouldHandle) {
            options.handler(evt);
        }
    };

   /** Registers a delegated keydown handler to a selector in a particular container context, which will filter the received
     * events by a "keyset", only passing on those that match to a handler function, which receives the original event
     * as argument.
     * @param options {Object} contains members:
     *    container {jQuery} Overall host container for key binding
     *    filterSelector {String} Selector to be used to filter enclosed elements for binding
     *    keysets {Object: String(Key) -> Keyset} The configured "keysets" object from the target component's options
     *    handler {Function: (DomEvent)} Function reporting a successfully decoded filtered key event
     */
    fluid.keys.bindFilterKeys = function (options) {
        options.container.on("keydown.fluid-filterKeys", options.filterSelector, function (evt) {
            fluid.keys.processFilterKeysEvent(options, evt);
        });
    };

    /** A stopgap mixin grade just locating configuration and defaults - actual functionality is still largely
     * procedural and broken out into separate functions
     */
    fluid.defaults("fluid.keys.activatable", {
        activatableKeysets: fluid.keys.activatable.defaultKeysets
    });

})(jQuery, fluid_3_0_0);
