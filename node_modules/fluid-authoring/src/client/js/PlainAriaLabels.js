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

    // Very basic utility to generate ARIA labels, too irregular and primitive to be a candidate for the framework
    // in its current condition.
    // This is a horrific mess since labels dependent on markup (and which may be multiple) take a different route
    // to those which are static, since these often need to be IoC resolvable. Naturally a sane renderer will
    // resolve all of this
    fluid.defaults("fluid.plainAriaLabels", {
        mergePolicy: {
            plainAriaLabels: "noexpand"
        },
        members: {
            plainAriaLabels: "@expand:fluid.plainAriaLabels.generateBaseLabels({that}, {that}.options.plainAriaLabels)"
        },
        invokers: {
            generateAriaLabels: "fluid.plainAriaLabels.generateAriaLabels({that})",
            adjustAriaLabel: "fluid.identity"
        },
        listeners: {
            "onCreate.generateAriaLabels": "{that}.generateAriaLabels()"
        }
    });

    fluid.plainAriaLabels.generateBaseLabels = function (that, plainAriaLabels) {
        return fluid.transform(plainAriaLabels, function (label) {
            var expandedTerms = fluid.expandOptions(label.termMap, that);
            return fluid.stringTemplate(label.template, expandedTerms);
        });
    };

    fluid.plainAriaLabels.generateAriaLabels = function (that) {
        fluid.each(that.options.plainAriaLabels, function (label, selName) {
            console.log("Selector " + selName + " for ", that);

            var elements = that.locate(selName);
            fluid.each(elements, function (element) {
                var adjustedLabel = that.adjustAriaLabel(label, selName, element);
                var expandedTerms = fluid.expandOptions(adjustedLabel.termMap, that);
                var expandedTemplate = fluid.stringTemplate(adjustedLabel.template, expandedTerms);
                element.setAttribute("aria-label", expandedTemplate);
            });
        });
    };

})(jQuery, fluid_3_0_0);
