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

    /** A variant of fluid.viewComponent that bypasses the wacky "initView" and variant signature
     * workflow, sourcing instead its "container" from an option of that name, so that this argument
     * can participate in standard ginger resolution. This enables useful results such as a component
     * which can render its own container into the DOM on startup, whilst the container remains immutable.
     */
    fluid.defaults("fluid.newViewComponent", {
        gradeNames: ["fluid.modelComponent"],
        members: {
            // 3rd argument is throwaway to force evaluation of container
            dom: "@expand:fluid.initDomBinder({that}, {that}.options.selectors, {that}.container)",
            container: "@expand:fluid.container({that}.options.container)"
        }
    });

    // "Stopgap new renderer" support

    fluid.registerNamespace("fluid.author");

    fluid.author.renderContainer = function (that, renderMarkup, parentContainer) {
        var containerMarkup = renderMarkup();
        var container = $(containerMarkup);
        if (typeof(parentContainer) === "function") {
            parentContainer = parentContainer();
        }
        parentContainer.append(container);
        return container;
    };

    fluid.defaults("fluid.author.containerRenderingView", {
        gradeNames: "fluid.newViewComponent",
        invokers: {
            renderMarkup: "fluid.identity({that}.options.markup.container)"
        },
        container: "@expand:fluid.author.renderContainer({that}, {that}.renderMarkup, {that}.options.parentContainer)",
        // The DOM element which to which this component should append its markup on startup
        parentContainer: "fluid.notImplemented", // must be overridden
        listeners: {
            "onDestroy.removeMarkup": {
                "this": "{that}.container",
                method: "remove",
                args: [],
                priority: "last"
            }
        }
    });

    fluid.defaults("fluid.author.containerSVGRenderingView", {
        gradeNames: "fluid.author.containerRenderingView",
        container: "@expand:fluid.author.renderSVGContainer({that}, {that}.renderMarkup, {that}.options.parentContainer)"
    });

    // Modelised layout support

    fluid.author.numberToCSS = function (element, value, property) {
        if (typeof(value) === "number") {
            element.css(property, value);
        }
    };

    // A component with model-bound fields left, top, width, height which map to the equivalent CSS properties
    fluid.defaults("fluid.author.domPositioning", {
        modelListeners: {
            "layout.left":   "fluid.author.numberToCSS({that}.container, {change}.value, left)",
            "layout.top":    "fluid.author.numberToCSS({that}.container, {change}.value, top)"
        }
    });

    fluid.defaults("fluid.author.domSizing", {
        modelListeners: {
            "layout.width": {
                funcName: "fluid.author.numberToCSS",
                args: ["{that}.container", "{change}.value", "width"],
                excludeSource: "DOM"
            },
            "layout.height": {
                funcName: "fluid.author.numberToCSS",
                args: ["{that}.container", "{change}.value", "height"],
                excludeSource: "DOM"
            }
        }
    });

    // Will read the DOM bounds into model fields layout.width, layout.height using one of two strategies -
    // "full" will read all child nodes and compute the bounding box which covers all of their actual positions
    // "element" will just use the standard outerWidth/outerHeight dimensions supplied by jQuery
    fluid.defaults("fluid.author.domReadBounds", {
        domReadBounds: {
            width: "full", // or "element"
            height: "full"
        },
        invokers: {
            readBounds: "fluid.author.domReadBounds.readBounds({that})"
        }
    });

    /** Compute the minimum bounding rectangle covering all of an array of rectangles, with fields `left`, `right`,
     * `bottom` and `top`.
     * @param rects {Array of Rectangle} An array of rectangles
     * @return {Rectangle} The minimum rectangle bounding all of the supplied rectangle
     */
    fluid.author.boundingRect = function (rects) {
        return {
            left: Math.min.apply(null, fluid.getMembers(rects, "left")),
            right: Math.max.apply(null, fluid.getMembers(rects, "right")),
            bottom: Math.max.apply(null, fluid.getMembers(rects, "bottom")),
            top: Math.min.apply(null, fluid.getMembers(rects, "top"))
        };
    };

    fluid.author.domReadBounds.readBounds = function (that) {
        var width = that.container.outerWidth();
        var height = that.container.outerHeight();
        var childRects = fluid.transform(that.container.children(), function (child) {
            return child.getBoundingClientRect();
        });
        var bounds = fluid.author.boundingRect(childRects);
        var fullWidth = that.options.domReadBounds.width === "full",
            fullHeight = that.options.domReadBounds.height === "full";
        that.applier.change("layout", {
            width: fullWidth ? bounds.right - bounds.left : width,
            height: fullHeight ? bounds.bottom - bounds.top : height
        }, "ADD", "DOM");
    };

    // SVG support

    // Sets an SVG attribute on a node created via fluid.author.renderSVGContainer
    // See http://stackoverflow.com/a/10974727
    // TODO: currently unused
    fluid.author.setSVGAttribute = function (jElement, attribute, value) {
        var element = jElement.documentElement;
        element.setAttribute(attribute, value);
    };

    fluid.author.renderSVGContainer = function (that, renderMarkup, parentContainer) {
        var containerMarkup = renderMarkup();
        // Approach taken from http://stackoverflow.com/a/36507333
        var container = $.parseXML(containerMarkup);
        var element = container.documentElement;
        parentContainer.append(element);
        return element;
    };

    fluid.author.pointsToSVG = function (points) {
        return fluid.transform(points, function (point) {
            // Add half-pixel to align rendering
            return (0.5 + point[0]) + "," + (0.5 + point[1]);
        }).join(" ");
    };


    fluid.defaults("fluid.author.svgPane", {
        gradeNames: ["fluid.newViewComponent", "fluid.author.containerRenderingView"],
        markup: {
            container: "<svg></svg>"
        }
    });

})(jQuery, fluid_3_0_0);
