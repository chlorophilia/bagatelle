/*
Copyright 2016 Raising the Floor - International
Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.
You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

(function ($, fluid) {
    "use strict";

    // This WANTS to be a "containerRenderingView" but it can't be a very good one under this model. It needs a "parentContainer" which
    // exists at construct time but it can't - since it is rendered by the parent's construct-time renderer. Therefore we have to
    // construct these in a separate pass.
    // NEW current plan: Subcomponents such as this will render strictly later than the construct-time of the parent. Therefore we HOPE
    // that their construct-time rendering can bind to the already rendered "parentContainer" produced by "elements".
    fluid.defaults("fluid.author.structureView", {
        gradeNames: ["fluid.newViewComponent", "fluid.author.containerRenderingView", "fluid.author.domReadBounds",
            "fluid.plainAriaLabels"],
        mergePolicy: {
            bindingRootReference: "noexpand"
        },
        // Clients must override this with an IoC reference to a view component in the scope of which browser event binding will occur
        bindingRootReference: "fluid.mustBeOverridden",
        selectors: {
            row: ".fld-author-row",
            mutableParent: ".fld-author-structureView-mutableParent",
            // This is a "fake selector" that will not be operated by the DOM binder, but instead will be string templated by getRowPathElement
            // Note that https://sites.google.com/site/chandrasekhardutta/home/jquery-performance-analysis-of-selectors suggests that this selector form helps a lot - or at least it did in the 70s!
            findRowByPath: "td[data-structureView-rowPath=\"%rowPath\"]"
        },
        // The distance in ems that each successive nested level will be indented - should be the width of the dropdown triangle encoded in CSS
        rowPaddingOffset: 1.1,
        highlightChanges: true,
        highlightChangeColor: "rgb(255, 255, 100)",
        highlightChangeDuration: 2000,
        markup: {
            container: "<table class=\"fld-author-structureView\" data-structureView-id=\"%componentId\"><tbody class=\"fld-author-structureView-mutableParent\">%rows</tbody></table>",
            rowMarkup: "<tr><td class=\"fld-author-row %rowClass\" style=\"padding-left: %padding\" data-structureView-rowPath=\"%rowPath\" aria-label=\"%label\">%element</td></tr>",
            elementMarkup: "%expander%key<span id=\"%valueId\"><span class=\"flc-inlineEdit-text\">%value</span></span>",
            expanderClosed: "<span class=\"fl-author-expander fl-author-expander-closed\" tabindex=\"0\" aria-label=\"%label\"></span>",
            expanderOpen: "<span class=\"fl-author-expander fl-author-expander-open\" tabindex=\"0\" aria-label=\"%label\"></span>"
        },
        events: {
            // Cascaded recursively from parent for updates
            onRefreshView: null,
            // Fires upwards when component's bounds have changed
            invalidateLayout: null,
            createValueComponent: null,
            // Fired when a change has occurred which will be highlighted
            onHighlightChange: null,
            onMarkupUpdated: null
        },
        members: {
            // A lookup of model path to early row information (including valueId, the id in the DOM of the container for the value, and rowType)
            pathToRowInfo: {},
            // A lookup of model path to the member name of the corresponding value component (maintained by DynamicComponentIndexer)
            pathToValueComponent: {}
        },
        components: {
            selectable: {
                type: "fluid.keys.linearSelectable",
                options: {
                    components: {
                        hostComponent: "{fluid.author.structureView}"
                    },
                    selectablesSelectorName: "row",
                    listeners: {
                        "{fluid.author.structureView}.events.onMarkupUpdated": "{that}.events.onSelectablesUpdated.fire()",
                        "{fluid.author.structureView}.events.onCreate": "{that}.events.onSelectablesUpdated.fire()"
                    }
                }
            }
        },
        dynamicComponents: {
            valueComponents: {
                type: "fluid.author.structureViewValue",
                createOnEvent: "createValueComponent",
                container: "{arguments}.0",
                options: "{arguments}.1"
            }
        },
        model: {
            // hostModel: maps the model area proper which is being imaged
            // layout: updated by domReadBounds
            expansionModel: null,
            rowCount: 0
        },
        invokers: {
            renderInnerMarkup: {
                funcName: "fluid.author.structureView.renderInnerMarkup",
                args: ["{that}", "{that}.model", "{that}.options.markup", "{that}.options.rowPaddingOffset"]
            },
            updateInnerMarkup: "fluid.author.structureView.updateInnerMarkup({that})",
            renderMarkup: "fluid.author.structureView.renderMarkup({that}, {that}.options.markup, {that}.renderInnerMarkup)",
            // Cannot be event-driven since may operate during startup
            pullModel: "fluid.identity()",
            createValueComponents: "fluid.author.structureView.createValueComponents({that})",
            hostModelChanged: "fluid.author.structureView.hostModelChanged({that}, {arguments}.0, {arguments}.1)",
            viewValueChanged: "fluid.author.structureView.viewValueChanged({that}, {arguments}.0)",
            // Fired with a jQuery which will be animated to indicate it represents a changed value
            highlightChange: "fluid.author.structureView.highlightChange({that}, {arguments}.0)",
            getRowPathElement: "fluid.author.structureView.getRowPathElement({that}, {arguments}.0)"
        },
        listeners: {
            "onRefreshView.render": "{that}.updateInnerMarkup",
            "onRefreshView.createValueComponents": {
                func: "{that}.createValueComponents",
                priority: "after:render"
            },
            "onCreate.bindEvents": "fluid.author.structureView.bindEvents",
            "onCreate.createValueComponents": {
                func: "{that}.createValueComponents",
                priority: "after:bindEvents"
            }
        },
        modelListeners: {
            expansionModel: {
                func: "{that}.updateInnerMarkup",
                excludeSource: "init"
            },
            layout: {
                func: "{that}.events.invalidateLayout.fire",
                includeSource: "DOM"
            },
            hostModel: {
                func: "{that}.hostModelChanged",
                args: ["{change}.value", "{change}.oldValue"],
                excludeSource: "init"
            }
        }
    });

    // We determine that there has been a structural change requiring complete rerendering if there is a creation or removal of
    // a direct child of an expanded row
    fluid.author.structureView.expandedChildChange = function (newValue, oldValue) {
        var togo = false;
        var diffOptions = {changes: 0, unchanged: 0, changeMap: {}}; // TODO: Stupid undocumented diff options format
        fluid.model.diff(newValue, oldValue, diffOptions);
        if (typeof(diffOptions.changeMap) === "string") { // Should not occur since we already made a typeCode check in the parent function
            togo = true;
        } else {
            fluid.each(diffOptions.changeMap, function (value) {
                if (typeof(value) === "string") {
                    togo = true;
                }
            });
        }
        return togo;
    };

    fluid.author.getAttribute = function (element, attribute) {
        return element.getAttribute ? element.getAttribute(attribute) : null;
    };

    // Approach mirroring https://shoehornwithteeth.com/ramblings/2014/02/compute-a-dom-elements-effective-background-colour/
    fluid.author.getBackgroundColor = function (element) {
        var property = window.getComputedStyle(element).backgroundColor;
        return property === "rgba(0, 0, 0, 0)" || property === "transparent" ? null : property;
    };

    fluid.author.findParentAttribute = function (element, getter) {
        var parent = fluid.findAncestor(element, getter);
        return parent ? getter(parent) : parent;
    };

    // Parses an rgb color string as dispensed from the browser's computed color styles (rgba values will be accepted, but the transparency value will be discarded)
    // Return an array of numbers
    fluid.author.parseRGB = function (rgbString) {
        var rgb = rgbString.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d?(?:\.\d+)?)\s*)?\)$/);
        return [+rgb[1], +rgb[2], +rgb[3]];
    };

    fluid.author.structureView.getRowPathElement = function (structureView, rowPath) {
        var findRowByPath = structureView.options.selectors.findRowByPath;
        var expanded = fluid.stringTemplate(findRowByPath, {
            rowPath: fluid.author.escapePathForAttribute(rowPath)
        });
        return structureView.container.find(expanded);
    };

    // Strategy note: evaluated the jQuery UI Color plugin https://api.jqueryui.com/color-animation/ but it feels that 700 lines of code
    // is too much to bring in just for some color animations! However, it does seem desirable to integrate with the standard jQuery
    // scheme for animations, with all its infrastructure for queuing, configuration and cancellation, etc. Therefore we animate
    // a custom, synthetic property named "highlightProgress" between 0 and 2 and perform the actual update in manual code.
    fluid.author.structureView.highlightChange = function (structureView, element) {
        var backColor = fluid.author.findParentAttribute(element, fluid.author.getBackgroundColor);
        fluid.log("back color " + backColor);
        var startColor = fluid.author.parseRGB(backColor);
        var endColor = fluid.author.parseRGB(structureView.options.highlightChangeColor);
        element.stop(true, true);
        element.animate({"highlightProgress": 1}, {
            easing: "linear",
            duration: structureView.options.highlightChangeDuration,
            step: function (progress) {
                endColor[3] = 1 - progress;
                element.css({backgroundColor: "rgba(" + endColor.join(", ") + ")"});
            },
            complete: function () {
                element[0].highlightProgress = 0;
            }
        });
    };

    fluid.author.structureView.updateLeafValue = function (structureView, valueComponent, path, newValue) {
        // ABSURD that InlineEdit doesn't participate in any model relationship (FLUID-6098)
        var rendered = fluid.author.structureView.primitiveToString(newValue);
        valueComponent.updateModelValue(rendered, "structureView");
        structureView.readBounds();
    };

    fluid.author.getChangeMap = function (newValue, oldValue) {
        var diffOptions = {changes: 0, unchanged: 0, changeMap: {}}; // TODO: Stupid undocumented diff options format
        fluid.model.diff(newValue, oldValue, diffOptions);
        return diffOptions.changeMap;
    };

    // We determine that there has been a structural change requiring complete rerendering if there is a creation or removal of
    // a direct child of an expanded row
    // Should only be called with changeMapValue which is of type Object
    fluid.author.expandedChildChange = function (changeMapValue) {
        return fluid.find(changeMapValue, function (value) {
            return typeof(value) === "string" ? true : undefined;
        }, false);
    };

    // Again, insane function to compensate for InlineEdit's prehistoric neglect of its ChangeApplier
    fluid.author.structureView.viewValueChanged = function (structureView, valueView) {
        var valuePath = valueView.options.structureViewPath;
        fluid.log("View value changed to ", valueView.model, " at path " + valuePath);
        var parsedValue = fluid.author.structureView.stringToPrimitive(valueView.model.value);
        structureView.applier.change("hostModel." + valuePath, parsedValue, "ADD", "ui");
    };

    fluid.author.structureView.hostModelChanged = function (structureView, newModel, oldModel) {
        fluid.log("HOST MODEL CHANGED for ", structureView, " new model ", newModel, " old model ", oldModel);
        var changeMap = fluid.author.getChangeMap(newModel, oldModel);
        fluid.log("changeMap: ", changeMap);
        var changedLeafMap = {};
        var globalInvalidation = false;
        var changedRowPaths = [];
        fluid.each(structureView.pathToRowInfo, function (rowInfo, path) {
            var changeMapValue = fluid.get(changeMap, path);
            if (changeMapValue === "DELETE") {
                globalInvalidation = true;
            } else if (changeMapValue) {
                changedRowPaths.push(path);
            }
            if (rowInfo.rowType === "primitive") {
                if (changeMapValue) {
                    changedLeafMap[path] = true;
                }
            } else { // it is "rowHeader" for a complex value
                if (typeof(changeMapValue) === "string") {
                    fluid.log("Change of type code, global invalidation");
                    globalInvalidation = true;
                } else {
                    if (rowInfo.expanded) {
                        globalInvalidation = fluid.author.expandedChildChange(changeMapValue);
                    }
                }
            }
        });
        if (globalInvalidation) { // TODO: One day we will track such changes more finely, and highlight appropriately, etc.
            structureView.updateInnerMarkup();
        } else {
            fluid.each(changedLeafMap, function (troo, path) {
                var newValue = fluid.get(newModel, path);
                fluid.log("UPDATING leaf value at path " + path + " to " + newValue);
                var valueComponent = structureView[structureView.pathToValueComponent[path]];
                fluid.author.structureView.updateLeafValue(structureView, valueComponent, path, newValue);
            });
            if (structureView.options.highlightChanges) {
                fluid.each(changedRowPaths, function (path) {
                    var rowPathElement = structureView.getRowPathElement(path);
                    structureView.highlightChange(rowPathElement);
                });
                if (changedRowPaths.length > 0) {
                    structureView.events.onHighlightChange.fire(structureView);
                }
            }
        }
    };

    // Ensures - i) only one execution of binding per instance of "bindingRootReference", ii) binding is scoped to the container of that component
    fluid.author.structureView.bindEvents = function (structureView) {
        var parsed = fluid.parseContextReference(structureView.options.bindingRootReference);
        var bindingRoot = fluid.resolveContext(parsed.context, structureView, true);
        // Bizarre and simple-minded scheme for constructing a "per-tree singleton"
        if (!bindingRoot.structureViewBinder) {
            var binderPath = fluid.pathForComponent(bindingRoot).concat(["structureViewBinder"]);
            fluid.construct(binderPath, {
                type: "fluid.author.structureViewBinder",
                bindingRootElement: bindingRoot.container
            });
        }
    };

    fluid.defaults("fluid.author.structureViewBinder", {
        gradeNames: ["fluid.component", "fluid.keys.activatable"],
        // Override with a DOM element holding the required root
        bindingRootElement: "fluid.mustBeOverridden",
        activatableKeysets: fluid.keys.activatable.defaultKeysets,
        invokers: {
            findStructureView: "fluid.author.getAttribute({arguments}.0, data-structureView-id)",
            findRowPath: "fluid.author.getAttribute({arguments}.0, data-structureView-rowPath)",
            expanderClick: "fluid.author.structureViewBinder.expanderClick({arguments}.0, {that})"
        },
        listeners: {
            "onCreate.bindEvents": "fluid.author.structureViewBinder.bindEvents"
        }
    });

    fluid.author.structureView.findComponent = function (element, getter) {
        var id = fluid.author.findParentAttribute(element, getter);
        return id ? fluid.globalInstantiator.idToShadow[id].that : null;
    };

    // Escape a model path into a form suitable to appear as an HTML attribute - the path "" is represented as "."
    fluid.author.escapePathForAttribute = function (path) {
        return path === "" ? "." : path;
    };

    // Undo the effect of escapePathForAttribute
    fluid.author.unescapePathForAttribute = function (path) {
        return path === "." ? "" : path;
    };

    fluid.author.segsToReadable = function (renderPath, localSegs) {
        return renderPath(localSegs).join(" dot ");
    };

    fluid.author.pathSegsToReadable = function (segs) {
        return segs.length === 0 ? " root path" : " path " + fluid.author.segsToReadable(fluid.identity, segs) + " ";
    };

    fluid.author.structureViewBinder.expanderClick = function (event, structureViewBinder) {
        // YEAH WE HAVE DONE THIS GARBAGE AND INSTANCE-FREE (minus the path construction/parsing)
        var structureView = fluid.author.structureView.findComponent(event.target, structureViewBinder.findStructureView);
        var rowPath = fluid.author.unescapePathForAttribute(fluid.author.findParentAttribute(event.target, structureViewBinder.findRowPath));
        fluid.log("Received expander click for component ", structureView, " row path ", rowPath);
        var expansionPath = rowPath === "" ? "expansionModel" : "expansionModel." + rowPath;
        var isExpanded = fluid.get(structureView.model, expansionPath);
        if (isExpanded) {
            structureView.applier.change(expansionPath, undefined, "DELETE");
        } else {
            structureView.applier.change(expansionPath, {}, "ADD");
        }
    };

    fluid.author.structureViewBinder.bindEvents = function (structureViewBinder) {
        var bindingContainer = structureViewBinder.options.bindingRootElement;
        bindingContainer.on("click", ".fl-author-expander", structureViewBinder.expanderClick);
        fluid.keys.bindFilterKeys({
            container: bindingContainer,
            filterSelector: ".fl-author-expander",
            keysets: structureViewBinder.options.activatableKeysets,
            handler: structureViewBinder.expanderClick
        });
    };

    fluid.author.structureView.pullModel = function (structureView) {
        // TODO: Some miraculous way of constructing zero-cost proxies, or else initialising this member through intelligent ginger flooding
        var model = fluid.getForComponent(structureView, "pullModel")();
        if (model !== undefined) {
            var applier = fluid.getForComponent(structureView, "applier");
            applier.change("hostModel", model);
        }
    };

    fluid.author.structureView.updateInnerMarkup = function (structureView) {
        // TODO: expansion point here for more graceful incremental markup generation
        if (structureView.dom) {
            var newMarkup = structureView.renderInnerMarkup();
            structureView.locate("mutableParent").html(newMarkup);
            structureView.readBounds();
            structureView.events.onMarkupUpdated.fire(structureView);
        }
    };

    fluid.author.structureView.primitiveToString = function (object) {
        return object === undefined ? "undefined" : JSON.stringify(object);
    };

    fluid.author.structureView.stringToPrimitive = function (string) {
        return string === "undefined" ? undefined : JSON.parse(string);
    };

    // Model is the local model, expansionModel is the full expansion model
    // We construct "rowInfo" records since we can't really bear the thought of constructing a full component for each one
    fluid.author.structureView.modelToRowInfo = function (model, segs, expansionModel, depth, rows) {
        var isExpanded = fluid.get(expansionModel, segs);
        var pushRow = function (rowInfo) {
            rowInfo.depth = depth;
            rowInfo.expanded = isExpanded;
            rowInfo.key = segs.length === 0 ? null : segs[segs.length - 1];
            if (rowInfo.rowType === "primitive") {
                rowInfo.valueId = fluid.allocateGuid();
            }
            rowInfo.segs = segs;
            rowInfo.path = fluid.pathUtil.composeSegments.apply(null, segs);
            rows.push(rowInfo);
        };
        if (fluid.isPrimitive(model)) {
            var modelRender = fluid.author.structureView.primitiveToString(model);
            pushRow({
                value: modelRender,
                rowType: "primitive"
            });
        } else {
            if (fluid.isArrayable(model)) {
                pushRow({
                    value: "Array[" + model.length + "]",
                    rowType: "typeHeader"
                });
            } else {
                pushRow({
                    value: "Object",
                    rowType: "typeHeader"
                });
            }
            if (isExpanded) {
                fluid.each(model, function (value, key) {
                    fluid.author.structureView.modelToRowInfo(value, segs.concat([key]), expansionModel, depth + 1, rows);
                });
            }
        }
    };

    fluid.defaults("fluid.author.structureViewValue", {
        gradeNames: ["fluid.inlineEdit", "fluid.indexedDynamicComponent", "fluid.viewComponent"],
        dynamicIndexTarget: "{fluid.author.structureView}",
        dynamicIndexTargetPath: "pathToValueComponent",
        dynamicIndexKeyPath: "options.structureViewPath",
        styles: {
            displayView: "",
            text: ""
        },
        strings: {
            defaultViewText: ""
        },
        listeners: {
            modelChanged: "{fluid.author.structureView}.viewValueChanged({that})"
        },
        // Horrifically bugged since these just accumulate endlessly
        useTooltip: false
    });



    fluid.author.structureView.createValueComponents = function (structureView) {
        fluid.each(structureView.pathToValueComponent, function (valueComponentName) {
            structureView[valueComponentName].destroy();
        });
        fluid.each(structureView.pathToRowInfo, function (rowInfo, path) {
            if (rowInfo.valueId) {
                structureView.events.createValueComponent.fire("#" + rowInfo.valueId, {
                    structureViewPath: path
                });
            }
        });
    };

    fluid.author.structureView.renderExpanderMarkup = function (row, markup, pathLabel) {
        if (row.rowType === "typeHeader") {
            var options = row.expanded ? {
                template: markup.expanderOpen,
                label: "unexpand"
            } : {
                template: markup.expanderClosed,
                label: "expand"
            };
            return fluid.stringTemplate(options.template, {
                label: options.label + pathLabel
            });
        } else {
            return "";
        }
    };

    fluid.author.structureView.renderInnerMarkup = function (structureView, model, markup, rowPaddingOffset) {
        var rows = [];
        structureView.pathToRowInfo = {};
        fluid.author.structureView.modelToRowInfo(model.hostModel, [], model.expansionModel, 0, rows);
        // TODO: appalling binding to onCreate-rendered label which will not even be available on startup
        var structureLabel = fluid.get(structureView, "plainAriaLabels.container") || "";
        var renderedRows = fluid.transform(rows, function (row) {
            // Abominable side-effect to update lookup. We dream minute by minute of the new renderer
            structureView.pathToRowInfo[row.path] = {
                valueId: row.valueId,
                rowType: row.rowType
            };
            var pathLabel = fluid.author.pathSegsToReadable(row.segs) + " of " + structureLabel;
            var elementTerms = {
                expander: fluid.author.structureView.renderExpanderMarkup(row, markup, pathLabel),
                key: (row.key === null ? "" : row.key + ": "),
                valueId: row.valueId || "", // oh for a renderer
                value: row.value
            };
            var element = fluid.stringTemplate(markup.elementMarkup, elementTerms);
            var expanderText = row.rowType === "typeHeader" ? (row.expanded ? "expanded" : "unexpanded") : "leaf";
            var terms = {
                rowClass: "fl-structureView-row-" + row.rowType,
                element: element,
                // encoding hack to allow transporting empty path through system
                rowPath: fluid.XMLEncode(fluid.author.escapePathForAttribute(row.path)),
                label: expanderText + pathLabel,
                padding: row.depth * rowPaddingOffset + "em"
            };
            return fluid.stringTemplate(markup.rowMarkup, terms);
        });
        structureView.applier.change("rowCount", rows.length);
        return renderedRows.join("");
    };

    fluid.author.structureView.renderMarkup = function (structureView, markup, renderInnerMarkup) {
        // TODO: This pathway executes during startup - cannot use events
        fluid.author.structureView.pullModel(structureView);
        var rows = renderInnerMarkup();
        var containerMarkup = fluid.stringTemplate(markup.container, {
            rows: rows,
            componentId: structureView.id
        });
        return containerMarkup;
    };

})(jQuery, fluid_3_0_0);
