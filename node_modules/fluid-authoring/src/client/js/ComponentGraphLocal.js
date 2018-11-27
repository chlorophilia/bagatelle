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

    // A variety of componentGraph which binds to the local instantiator

    fluid.defaults("fluid.author.componentGraph.local", {
        gradeNames: ["fluid.author.componentGraph"],
        listeners: {
            "onCreate.populateComponents": "fluid.author.componentGraph.populateLocalComponents",
            "{instantiator}.events.onComponentAttach": {
                funcName: "fluid.author.componentGraph.localComponentAttach",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.3"] // component, path, created
            },
            "{instantiator}.events.onComponentClear": {
                funcName: "fluid.author.componentGraph.localComponentClear",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.3"] // component, path, created
            }
        },
        invokers: {
            renderGradeName: "fluid.identity",
            renderPath: "fluid.identity",
            destroyTargetComponent: "fluid.destroyComponent({arguments}.0)"
        }
    });

    // Utility function required because of FLUID-6130
    fluid.destroyComponent = function (component) {
        component.destroy();
    };

    fluid.author.componentGraph.populateLocalComponents = function (that) {
        var instantiator = fluid.globalInstantiator;
        fluid.each(instantiator.idToShadow, function (shadow) {
            fluid.author.componentGraph.mapComponent(that, shadow);
        });
    };

    fluid.author.componentGraph.localComponentAttach = function (that, component, path, created) {
        if (created) {
            var shadow = fluid.globalInstantiator.idToShadow[component.id];
            fluid.author.componentGraph.mapComponent(that, shadow);
        }
    };

    fluid.author.componentGraph.localComponentClear = function (that, component, path, created) {
        if (created) {
            var shadow = fluid.globalInstantiator.idToShadow[component.id];
            fluid.author.componentGraph.unmapComponent(that, shadow);
        }
    };

    fluid.defaults("fluid.author.componentGraphPanel.popup.local", {
        gradeNames: "fluid.author.componentGraphPanel.popup",
        distributeOptions: {
            record: "fluid.author.componentGraph.local",
            target: "{that fluid.author.componentGraph}.options.gradeNames"
        }
    });

})(jQuery, fluid_3_0_0);
