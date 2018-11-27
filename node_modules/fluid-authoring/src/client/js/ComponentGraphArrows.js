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


    // A mixin grade for fluid.author.componentGraph that manages interaction with SVG arrows
    fluid.defaults("fluid.author.componentGraphSVGArrows", {
        distributeOptions: {
            record: "{svgPane}.container",
            target: "{that fluid.author.svgArrow}.options.parentContainer"
        },
        dynamicComponents: {
            arrows: {
                type: "fluid.author.svgArrow",
                createOnEvent: "createArrow",
                options: "{arguments}.0"
            }
        }
    });

    fluid.author.vectorToPolar = function (start, end) {
        var dx = end[0] - start[0], dy = end[1] - start[1];
        return {
            length: Math.sqrt(dx * dx + dy * dy),
            angle: Math.atan2(dy, dx)
        };
    };

    fluid.defaults("fluid.author.svgArrow", {
        gradeNames: ["fluid.newViewComponent", "fluid.author.containerSVGRenderingView"],
        markup: {
            arrow: "<polygon xmlns=\"http://www.w3.org/2000/svg\" class=\"fld-author-arrow\" points=\"%points\" transform=\"%transform\"/>",
            transform: "translate(%startX %startY) rotate(%angle)"
        },
        model: {
            arrowGeometry: {
                length: "{that}.model.polar.length",
                width: 10,
                headWidth: 20,
                headHeight: 20,
                angle: "{that}.model.polar.angle",
                start: [100, 100],
                end: [200, 200]
            }
        },
        modelRelay: {
            "endsToPolar": {
                target: "polar",
                singleTransform: {
                    type: "fluid.transforms.free",
                    func: "fluid.author.vectorToPolar",
                    args: ["{that}.model.arrowGeometry.start", "{that}.model.arrowGeometry.end"]
                }
            },
            "geometryToTransform": {
                target: "arrowTransform",
                singleTransform: {
                    type: "fluid.transforms.stringTemplate",
                    template: "{that}.options.markup.transform",
                    terms: {
                        startX: "{that}.model.arrowGeometry.start.0",
                        startY: "{that}.model.arrowGeometry.start.1",
                        angle: 0
                    }
                }
            },
            "geometryToPoints": {
                target: "arrowPoints",
                singleTransform: {
                    type: "fluid.transforms.free",
                    func: "fluid.author.svgArrow.renderArrowPoints",
                    args: ["{that}.model.arrowGeometry.width", "{that}.model.arrowGeometry.headWidth",
                           "{that}.model.arrowGeometry.length", "{that}.model.arrowGeometry.headHeight",
                           "{that}.model.arrowGeometry.angle"]
                }
            }
        },
        invokers: {
            renderMarkup: {
                funcName: "fluid.stringTemplate",
                args: ["{that}.options.markup.arrow", {
                    points: "{that}.model.arrowPoints",
                    transform: "{that}.model.arrowTransform"
                }]
            }
        },
        modelListeners: {
            "arrowPoints": {
                excludeSource: "init", // necessary to avoid triggering double evaluation of container with faulty framework
                "this": "{that}.container",
                method: "attr",
                args: ["points", "{change}.value"]
            },
            "arrowTransform": {
                excludeSource: "init",
                "this": "{that}.container",
                method: "attr",
                args: ["transform", "{change}.value"]
            }
        }
    });

    fluid.author.svgArrow.renderArrowPoints = function (width, headWidth, length, headHeight, angle) {
        var w = width / 2,
            hw = headWidth / 2,
            hp = length - headHeight,
            c = Math.cos(angle),
            s = Math.sin(angle);
        var points = [
            [-w / s, 0],
            [w / s, 0],
            [hp * c + w * s, hp * s - w * c],
            [hp * c + hw * s, hp * s - hw * c],
            [length * c, length * s],
            [hp * c - hw * s, hp * s + hw * c],
            [hp * c - w * s, hp * s + w * c]
        ];
        return fluid.author.pointsToSVG(points);
    };


    // Mixin grade to bind arrow component into context between two ComponentView instances within a ComponentGraph
    fluid.defaults("fluid.author.arrowForComponentView", {
        components: {
            sourceView: {
                expander: {
                    func: "{componentGraph}.idToView",
                    args: "{arrowForComponentView}.options.sourceId"
                }
            },
            parentView: {
                expander: {
                    func: "{componentGraph}.idToView",
                    args: "{arrowForComponentView}.options.parentId"
                }
            }
        },
        model: {
            arrowGeometry: {
                start: "{that}.model.arrowLayout.start",
                end: "{that}.model.arrowLayout.end"
            }
        },
        listeners: {
            "{sourceView}.events.onDestroy": "{that}.destroy",
            "{parentView}.events.onDestroy": "{that}.destroy"
        },
        modelRelay: {
            arrowLayout: {
                target: "arrowLayout",
                singleTransform: {
                    type: "fluid.transforms.free",
                    func: "fluid.author.routeArrow",
                    args: ["{componentGraph}", "{that}", "{that}.sourceView.model.layout", "{that}.parentView.model.layout"]
                }
            }
        }
    });



    fluid.author.routeArrow = function (componentGraph, arrow, sourceLayout, parentLayout) {
        var sourceLeft = fluid.get(sourceLayout, "left");
        var parentLeft = fluid.get(parentLayout, "left");
        // As well as standard framework relay timing issues, initial layout is asynchronous
        if (typeof(sourceLeft) !== "number" || typeof(parentLeft) !== "number") {
            return {};
        }
        var sourceId = arrow.sourceView.options.rawComponentId, parentId = arrow.parentView.options.rawComponentId;
        var parentShadow = componentGraph.idToShadow[parentId];
        var childComponent = componentGraph.idToShadow[sourceId].that;
        var childPosition = fluid.author.componentGraph.childPosition(parentShadow.memberToChild, childComponent);
        return {
            start: [parentLayout.left + parentLayout.width * (childPosition.index + 1) / (childPosition.children.length + 1),
                parentLayout.top + parentLayout.height - 0.5],
            end: [sourceLayout.left + sourceLayout.width / 2, sourceLayout.top]
        };
    };

    fluid.author.componentGraph.makeArrowComponentOptions = function (componentGraph, sourceId, path) {
        var coords = fluid.author.componentGraph.getCoordinates(componentGraph, path);
        return {
            gradeNames: "fluid.author.arrowForComponentView",
            sourceId: sourceId,
            parentId: coords.parentId
        };
    };

    // TODO: Consolidate with updateComponentView
    fluid.author.componentGraph.updateArrow = function (componentGraph, idPath, path) {
        var id = idPath[1]; // segment 0 is "idToPath"
        if (path === undefined) {
            var viewComponent = componentGraph.idToView(id);
            viewComponent.destroy();
        } else {
// TODO: Moved up into componentGraph.updateComponentVIew to avoid race
        }
    };

})(jQuery, fluid_3_0_0);
