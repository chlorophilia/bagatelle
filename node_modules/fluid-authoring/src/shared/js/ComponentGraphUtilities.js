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

    fluid.registerNamespace("fluid.author.componentGraph");

    // TODO: move to includeRoots/excludeRoots/excludeGrades

    fluid.author.componentGraph.isIncludedComponent = function (options, parsedPath, that) {
        var isIgnorablePath = fluid.find_if(options.ignorableRoots, function (ignorableRoot) {
            return fluid.author.isPrefix(ignorableRoot, parsedPath);
        });
        var isIgnorableGrade = fluid.find_if(options.ignorableGrades, function (ignorableGrade) {
            return fluid.hasGrade(that.options, ignorableGrade) || that.typeName === ignorableGrade;
        });
        return !isIgnorablePath && !isIgnorableGrade;
    };

})(jQuery, fluid_3_0_0);
