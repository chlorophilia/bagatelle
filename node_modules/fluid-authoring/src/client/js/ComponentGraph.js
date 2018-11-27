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
    fluid.setLogging(true);

    fluid.defaults("fluid.author.componentGraphPanel", {
        gradeNames: "fluid.viewComponent",
        selectors: {
            componentGraphHolder: ".flc-author-componentGraphHolder",
            componentGraph: ".fld-author-componentGraph"
        },
        components: {
            graph: {
                type: "fluid.author.componentGraph",
                container: "{componentGraphPanel}.dom.componentGraph",
                options: {
                    gradeNames: "fluid.author.componentGraphSVGArrows",
                    ignorableRoots: {
                        panel: "@expand:fluid.pathForComponent({fluid.author.componentGraphPanel})"
                    },
                    components: {
                        svgPane: {
                            type: "fluid.author.svgPaneInGraphPanel"
                        }
                    }
                },
                createOnEvent: "onMarkupReady"
            }
        }
    });

    fluid.defaults("fluid.author.componentGraphPanel.popup", {
        gradeNames: ["fluid.author.popupPanel", "fluid.author.componentGraphPanel"],
        markup: {
            pane: "<div class=\"flc-author-componentGraphHolder fl-author-scrollingPane\"><div class=\"fld-author-componentGraph\"></div></div>"
        }
    });

    fluid.defaults("fluid.author.componentGraphPanel.fullFrame", {
        gradeNames: ["fluid.author.panePanel", "fluid.author.componentGraphPanel"],
        markup: {
            pane: "<div class=\"flc-author-componentGraphHolder\"><div class=\"fld-author-componentGraph\"></div></div>"
        }
    });

    fluid.defaults("fluid.author.svgPaneInGraphPanel", {
        gradeNames: ["fluid.author.svgPane", "fluid.author.domSizing"],
        parentContainer: "{fluid.author.componentGraphPanel}.dom.componentGraph",
        markup: {
            container: "<svg class=\"fld-author-svgPane\"></svg>"
        },
        model: {
            layout: "{fluid.author.componentGraph}.model.layout"
        }
    });

    fluid.defaults("fluid.author.componentGraph", {
        gradeNames: ["fluid.viewComponent", "fluid.author.viewContainer", "fluid.author.domSizing"],
        events: {
            createComponentView: null,
            createArrow: null,
            invalidateLayout: null,
            doLayout: null,
            onDirectionKey: null
        },
        selectors: {
            // Whilst currently in practice componentViews and selectables match the same elements, we separate them
            // in case there is a future divergence. "selectables" is evaluated by hand from our own records of each
            // individual componentView
            componentViews: ".fld-author-componentView",
            selectables: "{that}.getSelectables"
        },
        keysets: fluid.keys.defaultKeysets.grid,
        components: {
            selectable: {
                type: "fluid.author.graphSelectable",
                options: {

                }
            }
        /* Sketch generalised implementation
            componentViewMapper: {
                type: "fluid.author.componentImager",
                options: {
                    mappingTarget: "{fluid.author.componentGraph}",
                    eventName: "createComponentView",
                    imagedType: "fluid.author.componentView",
                    modelPath: "idToPath"
                }
            },
            arrowMapper: {
            }
        */
        },
        model: {
        // A map of the raw component tree - a mirror of idToPath within the instantiator
        // This is the model state which drives the visible graph layout
        // TODO: We currently ignore injected components
            idToPath: {},
            layout: {
                width: 2000,
                height: 1000
            },
            selectedId: null
        },
        ignorableRoots: {
            "resolveRootComponent": ["resolveRootComponent"]
        },
        ignorableGrades: {
            "instantiator": "fluid.instantiator",
            "resolveRootComponent": "fluid.resolveRootComponent",
            // Hack to avoid endlessly self-reacting as the InlineEdit used by the structureView abuses the tree by creating standalone fluid.tooltip instances
            "tooltip": "fluid.tooltip"
        },
        members: { // A map of raw component ids to the view peer which represents them - managed by DynamicComponentIndexer
            idToViewMember: {},
            // A map of raw component ids to a "shadow" document, holding a representation of the component at member "that"
            // These two managed by mapComponent/componentClear listener
            idToShadow: {},
            pathToId: {} // TODO move to model after checking escaping,
            // rootComponentRecord: computed by doLayout
        },
        modelListeners: {
            updateComponentView: {
                path: "idToPath.*",
                funcName: "fluid.author.componentGraph.updateComponentView",
                args: ["{that}", "{change}.path", "{change}.value"]
            }/*,
            createArrow: {
                path: "idToPath.*",
                funcName: "fluid.author.componentGraph.updateArrow",
                args: ["{that}", "{change}.path", "{change}.value"]
            },
            invalidateLayout: {
                path: "idToPath",
                func: "{that}.events.invalidateLayout.fire",
                priority: "after:createComponentView"
            }*/
        },
        dynamicComponents: {
            componentViews: {
                type: "fluid.author.componentView",
                createOnEvent: "createComponentView",
                options: "{arguments}.0"
            }
        },
        listeners: {
            "invalidateLayout.scheduleLayout": "@expand:fluid.author.debounce({that}.events.doLayout.fire, 1)",
            "doLayout.impl": "fluid.author.componentGraph.doLayout({that})",
            "onCreate.setContainerTabIndex": "fluid.tabindex({that}.container, 0)"
        },
        invokers: {
            idToView: "fluid.author.componentGraph.idToView({that}, {arguments}.0)",
            elementToView: "fluid.author.componentGraph.elementToView({that}, {arguments}.0)",
            getSelectables: "fluid.author.componentGraph.getSelectables({that})"
        },
        boxHeight: 80,
        boxWidth: 200,
        verticalGap: 50,
        horizontalGap: 20
    });

    // Mixin grade for componentView in the context of componentGraph so that we can bind 100% of component options
    // to a single reference
    fluid.defaults("fluid.author.componentViewInGraph", {
        parentContainer: "{fluid.author.componentGraphPanel}.dom.componentGraph",
        // Options for dynamicComponentIndexer
        dynamicIndexTargetPath: "idToViewMember",
        dynamicIndexKeyPath: "options.rawComponentId",
        dynamicIndexTarget: "{fluid.author.componentGraph}"
    });

    fluid.author.componentGraph.childPosition = function (memberToChild, childComponent) {
        var children = fluid.values(memberToChild);
        var childIndex = fluid.find(children, function (child, index) {
            return child === childComponent ? index : undefined;
        });
        return {
            children: children,
            index: childIndex
        };
    };

    fluid.defaults("fluid.author.graphSelectable", {
        gradeNames: "fluid.keys.gridSelectable",
        components: {
            hostComponent: "{fluid.author.componentGraph}"
        },
        invokers: {
            elementToKey: "fluid.author.graphSelectable.elementToId({that}.hostComponent, {arguments}.0)",
            keyToElement: "fluid.author.graphSelectable.idToElement({that}.hostComponent, {arguments}.0)",
            validateKey: "fluid.author.graphSelectable.validateId({that}.hostComponent, {arguments}.0)",
            // oldKey, direction
            directionToKey: "fluid.author.graphSelectable.directionToKey({that}.hostComponent, {arguments}.0, {arguments}.1)"
        },
        selectablesSelectorName: "componentViews",
        listeners: {
            // We piggy-back this onto doLayout because the workflow in modelListeners updateComponentView is hacked and partially asynchronous to avoid model races
            "{that}.hostComponent.events.doLayout": {
                namespace: "updateSelectables",
                func: "{that}.events.onSelectablesUpdated.fire",
                args: "{that}",
                priority: "after:impl"
            },
            "{that}.hostComponent.events.onCreate": "{that}.events.onSelectablesUpdated.fire()"
        }
    });

    fluid.author.graphSelectable.elementToId = function (that, element) {
        var viewComponent = that.elementToView(element);
        return viewComponent ? viewComponent.viewRecord.that.id : null;
    };

    fluid.author.graphSelectable.idToElement = function (that, id) {
        return id ? that.idToView(id).container[0] : null;
    };

    fluid.author.graphSelectable.validateId = function (that, id) {
        if (id && !that.idToView(id)) {
            return that.rootComponentRecord.that.id;
        } else {
            return id;
        }
    };

    fluid.author.graphSelectable.directionToKey = function (that, selectedId, keyDir) {
        if (!selectedId) {
            return;
        }
        var coords = that.idToView(selectedId).viewRecord.coords;
        var shadow = that.idToShadow[selectedId];
        var parentShadow = coords.parentShadow;
        var newComponent, childPosition;
        if (fluid.directionOrientation(keyDir) === "horizontal" && parentShadow) {
            childPosition = fluid.author.componentGraph.childPosition(parentShadow.memberToChild, shadow.that);
            var newIndex = fluid.positiveMod(childPosition.index + fluid.directionSign(keyDir), childPosition.children.length);
            newComponent = childPosition.children[newIndex];
        } else if (keyDir === "down") {
            childPosition = fluid.author.componentGraph.childPosition(shadow.memberToChild);
            newComponent = childPosition.children[0];
        } else if (keyDir === "up") {
            newComponent = parentShadow ? parentShadow.that : null;
        }
        return newComponent ? newComponent.id : selectedId;
    };

    fluid.author.componentGraph.getSelectables = function (that) {
        var nodes = [];
        if (that.model) {
            fluid.each(that.model.idToPath, function (path, id) {
                var viewMember = that[that.idToViewMember[id]];
                if (viewMember) {
                    nodes.push(viewMember.container[0]);
                }
            });
        }
        return $(nodes);
    };

    /** Accepts a (concrete) path into the target component tree and parses it into a collection of useful pre-geometric info,
     * including the path, reference and shadow of its parent, and member name within it
     * @param componentGraph {componentGraph} A componentGraph component
     * @param path {String} The string form of a concrete component path in its tree
     * @param that {Component} The component itself
     * @return {Object} A structure of pre-geometric info:
     *    parsed {Array of String}: Array of path segments of component in tree
     *    parentSegs {Array of String}: Array of path segments of component's parent in tree
     *    memberName {String}: Component's name in its parent, or `undefined` if this is the root component
     *    parentPath {String}: If the component is not the root component, the string form of its parent's path
     *    parentId {String}: If the component is not the root component, the id of its parent
     *    parentShadow {Object}: If the component is not the root component, its parent shadow record
     */
    fluid.author.componentGraph.getCoordinates = function (componentGraph, path, that) {
        var instantiator = fluid.globalInstantiator;
        var parsed = instantiator.parseEL(path);
        var togo = {
            parsed: parsed,
            parentSegs: parsed.slice(0, parsed.length - 1)
        };
        if (parsed.length > 0) {
            togo.memberName = parsed[parsed.length - 1];
            togo.parentPath = instantiator.composeSegments.apply(null, togo.parentSegs);
            togo.parentId = componentGraph.pathToId[togo.parentPath];
            if (togo.parentId) { // It may be missing, if we are racing against ourselves in startup
                togo.parentShadow = componentGraph.idToShadow[togo.parentId];
                togo.childPosition = fluid.author.componentGraph.childPosition(togo.parentShadow.memberToChild, that);
            }
        }
        return togo;
    };

    /** Looks up the id of a target component to the componentView component peering with it
     * @param componentGraph {componentGraph} a componentGraph component
     * @param id {String} The id of a target component
     * @return {Component} The corresponding {componentView} component
     */
    fluid.author.componentGraph.idToView = function (componentGraph, id) {
        var togo = componentGraph[componentGraph.idToViewMember[id]];
        return togo;
    };

    fluid.author.componentGraph.elementToView = function (componentGraph, element) {
        var targetId = element.dataset.targetid;
        return targetId ? componentGraph.idToView(targetId) : null;
    };

    fluid.author.componentGraph.mapComponent = function (componentGraph, shadow) {
        var id = shadow.that.id;
        var coords = fluid.author.componentGraph.getCoordinates(componentGraph, shadow.path, shadow.that);
        if (fluid.author.componentGraph.isIncludedComponent(componentGraph.options, coords.parsed, shadow.that)) {
            componentGraph.idToShadow[id] = shadow;
            componentGraph.pathToId[shadow.path] = id;
            if (coords.parentShadow) {
                fluid.set(coords.parentShadow, ["memberToChild", coords.memberName], shadow.that);
            }
            componentGraph.applier.change(["idToPath", id], shadow.path);
        }
    };

    fluid.author.componentGraph.unmapComponent = function (componentGraph, shadow) {
        var id = shadow.that.id,
            path = shadow.path;
        if (componentGraph.idToShadow[id]) {
            delete componentGraph.idToShadow[id];
            delete componentGraph.pathToId[path];
            var coords = fluid.author.componentGraph.getCoordinates(componentGraph, path, shadow.that);
            if (coords.parentShadow) {
                delete coords.parentShadow.memberToChild[coords.memberName];
            }
            componentGraph.applier.change(["idToPath", id], null, "DELETE");
        }
    };

    // Sorts more nested views to the front
    fluid.author.depthComparator = function (reca, recb) {
        return recb.rowIndex - reca.rowIndex;
    };


    // TODO: Abuse of shadow by writing extra fields - need to shallow clone just the fields we read
    //     childrenWidth: here
    //     memberToChild: mapComponent
    // Read fields:
    //    path, that
    fluid.author.componentGraph.doLayout = function (componentGraph) {
        fluid.log("LAYOUT BEGUN");
        var records = [], rowHeights = [];
        fluid.each(componentGraph.idToViewMember, function (viewMember) {
            records.push(componentGraph[viewMember].viewRecord);
        });
        records.sort(fluid.author.depthComparator);
        var o = componentGraph.options;
        // Phase 1: Moving upwards, accumulate total child width of each tree route
        fluid.each(records, function (record) {
            var shadow = record.shadow;
            var view = componentGraph.idToView(shadow.that.id);
            view.events.onRefreshView.fire();
            view.readBounds();
            var selfWidth = view.model.layout.width;
            var childrenWidth = -o.horizontalGap;
            fluid.each(shadow.memberToChild, function (child) {
                var childShadow = componentGraph.idToShadow[child.id];
                childrenWidth += childShadow.childrenWidth + o.horizontalGap;
            });
            shadow.childrenWidth = Math.max(selfWidth, childrenWidth);
            var rowIndex = record.rowIndex;
            rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] | 0, view.model.layout.height);
        });
        records.reverse();
        // Phase 2: Moving downwards, position children with respect to parents
        var rootLayout = {
        };
        fluid.each(records, function (record, index) {
            var shadow = record.shadow;
            var view = componentGraph.idToView(shadow.that.id);
            if (index === 0) {
                view.applier.change("layout", {
                    left: shadow.childrenWidth / 2 + o.horizontalGap,
                    top: o.verticalGap
                });
                rootLayout.width = shadow.childrenWidth + o.horizontalGap * 2;
            }
            // Start at the extreme position for the window containing all of our children
            var childLeft = view.model.layout.left + (view.model.layout.width - shadow.childrenWidth) / 2;
            // fluid.log("Considering component " + shadow.that.id + " at path " + shadow.path + " with " + fluid.keys(shadow.memberToChild).length + " children");
            // fluid.log("Own view has id " + view.id + ", left of " + view.model.layout.left + " childrenWidth is " + shadow.childrenWidth + " starting childLeft at " + childLeft);
            fluid.each(shadow.memberToChild, function (child /*, member */) {
                // fluid.log("Considering member " + member);
                var childShadow = componentGraph.idToShadow[child.id];
                var childView = componentGraph.idToView(child.id);
                if (!childView) { // It may be still in creation
                    fluid.log("SKIPPING child " + child.id + " since no view");
                    return;
                }
                var thisChildLeft = childLeft + (childShadow.childrenWidth - childView.model.layout.width) / 2;
                childView.applier.change("layout", {
                    left: thisChildLeft,
                    top: view.model.layout.top + rowHeights[record.rowIndex] + o.verticalGap
                });
                // fluid.log("Assigned left of " + childLeft + " to target component id " + child.id + " view id " + childView.id);
                rootLayout.height = childView.model.layout.top + rowHeights[record.rowIndex + 1] + o.verticalGap;
                childLeft += childShadow.childrenWidth + o.horizontalGap;
            });
        });
        componentGraph.rootComponentRecord = records[0];
        componentGraph.applier.change("layout", rootLayout);
        fluid.log("LAYOUT ENDED");
    };

    fluid.author.componentGraph.makeViewComponentOptions = function (componentGraph, id, path) {
        var o = componentGraph.options;
        var options = {
            gradeNames: "fluid.author.componentViewInGraph",
            rawComponentId: id,
            path: path,
            model: {
                layout: {
                    width: o.boxWidth,
                    height: o.boxHeight
                }
            }
        };
        return options;
    };

    /** Invoked by the modelListener to the componentGraph's idToPath model block.
     *  Coordinates creation and destruction of a fluid.author.componentView matching these elements
     *  This general pattern is a candidate for entering the core framework "imaging components into existence"
     * - consisting of the confection of i) A dynamicComponent ii) dynamicComponentIndexer, iii) listener to a model domain coordinating creation and destruction
     * - we also want this to cope with arrays
     */
    fluid.author.componentGraph.updateComponentView = function (componentGraph, idPath, path) {
        var id = idPath[1]; // segment 0 is "idToPath"
        console.log("UpdateComponentView with path " + path);
        if (path === undefined) {
            var viewComponent = componentGraph.idToView(id);
            viewComponent.destroy();
            componentGraph.events.invalidateLayout.fire();
        } else {
            fluid.invokeLater(function () {
                fluid.log("Firing createComponentView for path " + path + " id " + id);
            // Avoid creating a horrific race within the broken model relay system
                var options = fluid.author.componentGraph.makeViewComponentOptions(componentGraph, id, path);
                componentGraph.events.createComponentView.fire(options);

                var arrowOptions = fluid.author.componentGraph.makeArrowComponentOptions(componentGraph, id, path);
                if (arrowOptions.parentId) {
                    componentGraph.events.createArrow.fire(arrowOptions);
                }
                componentGraph.events.invalidateLayout.fire();
            });
        }
    };

    // The current framework allows grades to (legitimately) appear multiple times in the resolved list - but this is not helpful in the UI
    fluid.author.dedupeGrades = function (gradeNames) {
        var gradeHash = {}, outGrades = [];
        fluid.each(gradeNames, function (gradeName) {
            if (!gradeHash[gradeName]) {
                outGrades.push(gradeName);
                gradeHash[gradeName] = true;
            }
        });
        return outGrades;
    };

    fluid.author.computeViewRecord = function (componentGraph, targetId) {
        var togo = Object.create(fluid.author.computeViewRecord.prototype);
        togo.shadow = componentGraph.idToShadow[targetId];
        togo.that = togo.shadow.that;
        togo.coords = fluid.author.componentGraph.getCoordinates(componentGraph, togo.shadow.path, togo.that);
        togo.rowIndex = togo.coords.parsed.length;
        return Object.freeze(togo);
    };

    fluid.defaults("fluid.author.componentView", {
        gradeNames: ["fluid.newViewComponent", "fluid.decoratorViewComponent", "fluid.author.containerRenderingView",
            "fluid.indexedDynamicComponent", "fluid.author.domPositioning", "fluid.author.domReadBounds",
            "fluid.keys.activatable",  "fluid.plainAriaLabels"],
        mergePolicy: {
            elements: "noexpand"
        },
        domReadBounds: {
            height: "element"
        },
        distributeOptions: {
            // This unreasonable hack is currently our best route around FLUID-5028
            source: "{that}.options.optionsHolder",
            target: "{that}.options"
        },
        plainAriaLabels: {
            "container": {
                template: "Child %index of %siblings at path %path id %id with %children children",
                termMap: {
                    path: "@expand:fluid.author.segsToReadable({componentGraph}.renderPath, {that}.viewRecord.coords.parsed)",
                    id: "@expand:fluid.author.idToReadable({that}.viewRecord.that.id)",
                    children: "@expand:fluid.author.childCount({that}.viewRecord)",
                    index: "{that}.viewRecord.coords.childPosition.index",
                    siblings: "{that}.viewRecord.coords.childPosition.children.length"
                }
            }
        },
        elements: {
            grades: {
                title: "grades:",
                sourceFunc: "{componentView}.prepareGradeNames"
            },
            model: {
                title: "model:",
                sourceModelHolder: "{componentView}.viewRecord.that"
            }
        },
        optionsHolder: "{that}.options.rowMaterials.options",
        rowMaterials: "@expand:fluid.author.componentView.collectRowMaterials({that}, {that}.options.elements, {that}.viewRecord)",
        members: {
            // Holds the target component, etc. at a safe location where it will not confuse the current faulty framework
            viewRecord: "@expand:fluid.author.computeViewRecord({componentGraph}, {that}.options.rawComponentId)"
        },
        events: { // Currently we paint ourselves on creation and so there are no local listeners
            onRefreshView: null
        },
        listeners: {
            "onCreate.bindDestroyButton": "fluid.author.componentView.bindDestroyButton({that}, {that}.dom.destroyButton)"
        },
        selectors: {
            container: "",
            destroyButton: ".fld-author-destroy"
        },
        decorators: {
            destroyButton: {
                type: "jQuery",
                method: "click",
                args: ""
            }
        },
        markup: {
            container: "<div class=\"fld-author-componentView\" data-targetId=\"%targetId\" data-ownId=\"%ownId\" tabindex=\"0\">%memberName<table>%childRows</table>%destroyButton</div>",
            memberName: "<div class=\"fld-author-member\">%member</div>",
            destroyButton: "<div class=\"fld-author-destroy\" tabindex=\"0\" aria-label=\"%label\"></div>",
            structureRow: "<tr class=\"%structureRowClass\"><td class=\"%structureTitleClass\">%title</td><td class=\"%structureCellClass fl-structureCell\"></td></tr>"
        },
        invokers: {
            prepareGradeNames: "fluid.author.componentView.prepareGradeNames({componentGraph}.renderGradeName, {that}.viewRecord.that)",
            renderMarkup: {
                funcName: "fluid.author.componentView.renderMarkup",
                args: ["{componentGraph}", "{that}", "{that}.viewRecord.that", "{that}.options.markup",
                    "{that}.plainAriaLabels", "{that}.options.rowMaterials.rowsMarkup"]
            },
            renderMemberName: "fluid.author.componentView.renderMemberName({componentGraph}, {that}, {that}.viewRecord.that, {that}.options.markup)",
            destroyTargetComponent: "{componentGraph}.destroyTargetComponent({that}.viewRecord.that)",
            adjustAriaLabel: "fluid.author.componentView.adjustAriaLabel({that}, {componentGraph}.renderPath, {arguments}.0)"
        }
    });

    fluid.author.idToReadable = function (id) {
        return id.substring(id.indexOf("-") + 1);
    };

    fluid.author.childCount = function (viewRecord) {
        var count = fluid.author.componentGraph.childPosition(viewRecord.shadow.memberToChild).children.length;
        return count === 0 ? "no" : count;
    };

    fluid.author.componentView.adjustAriaLabel = function (componentView, renderPath, ariaLabel) {
        return renderPath(componentView.viewRecord.coords.parsed).length === 0 ? {
            template: "Root component with %children children",
            termMap: {
                children: ariaLabel.termMap.children
            }
        } : ariaLabel;
    };

    fluid.author.componentView.bindDestroyButton = function (componentView, destroyButton) {
        destroyButton.on("click.destroyButton", componentView.destroyTargetComponent);
        fluid.keys.bindFilterKeys({
            container: destroyButton,
            filterSelector: null,
            keysets: componentView.options.activatableKeysets,
            handler: componentView.destroyTargetComponent
        });
    };

    // child components are dynamic so we bypass the DOM binder and return to this ancient technique
    // TODO - is this race-breaking really necessary now?
    fluid.author.makeLocateFunc = function (containerHolder, selector) {
        return function () {
            return $(selector, containerHolder.container);
        };
    };

    fluid.author.componentView.elementToRowMaterials = function (componentView, containerHolder, element, elementKey) {
        var terms = {
            title: element.title,
            structureRowClass: "fld-author-" + elementKey + "Row",
            structureCellClass: "fld-author-" + elementKey + "Cell",
            structureTitleClass: "fld-author-" + elementKey + "Title"
        };
        var markup = fluid.getForComponent(componentView, "options.markup");
        var togo = {
            rowMarkup: fluid.stringTemplate(markup.structureRow, terms),
            structureCellClass: terms.structureCellClass,
            components: {}
        };
        var component = {
            type: "fluid.author.structureInComponentView"
        };
        var options = element.sourceFunc ? {
            gradeNames: "fluid.author.pullingSICV",
            invokers: {
                pullModel: {
                    func: element.sourceFunc
                }
            }
        } : {
            components: {
                modelSource: element.sourceModelHolder
            },
            gradeNames: "fluid.author.modelSyncingSICV"
        };
        options.parentContainer = fluid.author.makeLocateFunc(containerHolder, "." + terms.structureCellClass);
        options.elementKey = elementKey;
        options.selectors = {
            // Pretty awful - this actually lies outside the structureView's container, but we bolt it on so we can animate it
            title: fluid.author.makeLocateFunc(containerHolder, "." + terms.structureTitleClass)
        };
        component.options = options;
        togo.components[elementKey + "Structure"] = component;
        return togo;
    };

    fluid.author.componentView.collectRowMaterials = function (componentView, elements, viewRecord) {
        var rows = [],
            options = {
                components: {}
            };
        fluid.each(elements, function (element, elementKey) {
            if (elementKey === "grades" || elementKey === "model" && fluid.hasGrade(viewRecord.that.options, "fluid.modelComponent")) {
                var materials = fluid.author.componentView.elementToRowMaterials(componentView, componentView, element, elementKey);
                rows.push(materials.rowMarkup);
                $.extend(options.components, materials.components);
            }
        });
        var togo = Object.create(fluid.author.componentView.collectRowMaterials.prototype);
        togo.rowsMarkup = rows.join("");
        togo.options = options;
        return Object.freeze(togo);
    };

    fluid.author.componentView.renderMarkup = function (componentGraph, componentView, that, markupBlock, plainAriaLabels, rowsMarkup) {
        var destroyMarkup = fluid.stringTemplate(markupBlock.destroyButton, {
            label: "destroy " + plainAriaLabels.container
        });
        var containerModel = {
            memberName: fluid.getForComponent(componentView, "renderMemberName")(),
            destroyButton: destroyMarkup,
            childRows: rowsMarkup,
            targetId: that.id,
            ownId: componentView.id
        };
        var containerMarkup = fluid.stringTemplate(markupBlock.container, containerModel);
        return containerMarkup;
    };

    fluid.author.componentView.renderMemberName = function (componentGraph, componentView, that, markupBlock) {
        var shadow = componentGraph.idToShadow[componentView.options.rawComponentId];
        var coords = fluid.author.componentGraph.getCoordinates(componentGraph, shadow.path);
        return coords.memberName === undefined ? "" : fluid.stringTemplate(markupBlock.memberName, {member: coords.memberName});
    };

    fluid.author.componentView.prepareGradeNames = function (renderGradeName, targetComponent) {
        var gradeNames = [targetComponent.typeName].concat(fluid.makeArray(fluid.get(targetComponent, ["options", "gradeNames"])));
        var filteredGrades = fluid.author.filterGrades(gradeNames, fluid.author.ignorableGrades);
        var dedupedGrades = fluid.author.dedupeGrades(filteredGrades);
        var finalGrades = fluid.transform(dedupedGrades, renderGradeName);
        return finalGrades;
    };

    /** Some cross-mixin grades for StructureView */

    fluid.defaults("fluid.author.structureInComponentView", {
        gradeNames: ["fluid.author.structureView", "fluid.plainAriaLabels"],
        bindingRootReference: "{fluid.author.componentGraph}",
        selectors: {
            container: ""
        },
        plainAriaLabels: {
            container: {
                template: "%elementKey of component at path %path",
                termMap: {
                    elementKey: "{that}.options.elementKey",
                    path: "@expand:fluid.author.segsToReadable({componentGraph}.renderPath, {componentView}.viewRecord.coords.parsed)"
                }
            }
        },
        listeners: {
            "{fluid.author.componentView}.events.onRefreshView": {
                // TODO: It's that big multiplicity problem again: https://issues.fluidproject.org/browse/FLUID-5948
                /* namespace: "refreshChildren", */
                func: "{that}.events.onRefreshView.fire",
                args: "{that}"
            }
        },
        events: {
            invalidateLayout: "{fluid.author.componentGraph}.events.invalidateLayout"
        }
    });

    fluid.defaults("fluid.author.pullingSICV", {
        listeners: {
            "{fluid.author.componentView}.events.onRefreshView": {
                priority: "before:render",
                namespace: "pullModel",
                listener: "fluid.author.structureView.pullModel",
                args: ["{that}"]
            }
        }
    });

    fluid.defaults("fluid.author.modelSyncingSICV", {
        model: {
            hostModel: "{that}.modelSource.model"
        },
        components: {
            modelSource: "fluid.mustBeOverridden"
        },
        listeners: {
            onHighlightChange: "{that}.highlightChange({that}.dom.title)"
        }
    });

})(jQuery, fluid_3_0_0);
