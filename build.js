/* eslint-env node */
"use strict";

var readline = require("readline"),
    fs = require("fs-extra");

var fluid = require("infusion");
var UglifyJS = require("uglify-js");

var buildIndex = {
    excludes: [
        "jquery.js"
    ],
    localSource: [
        "src/client/css/bagatelle.css",
        "src/auxBuild/restoreJQuery.jsz",
        "src/client/js/bagatelle.js",
        "src/client/js/autocomplete.js",
        "src/client/js/colour.js",
        "src/client/js/renderSVG.js"
    ],
    codeHeader: "",
    codeFooter: "\njQuery.noConflict()",
    copy: [{
        src: "src/client/img/loading-icon.gif",
        dest: "build/img/loading-icon.gif"
    }, {
        src: "src/client/html/bagatelle.html",
        dest: "build/html/bagatelle.html"
    }, {
        src: "src/buildTest/index.html",
        dest: "build/index.html"
    }, {
        src: "data/Life.json",
        dest: "build/data/Life.json"
    }]
};


var readLines = function (filename) {
    var lines = [];
    var togo = fluid.promise();
    var rl = readline.createInterface({
        input: fs.createReadStream(filename),
        terminal: false
    });
    rl.on("line", function (line) {
        lines.push(line);
    });
    rl.on("close", function () {
        togo.resolve(lines);
    });
    rl.on("error", function (error) {
        togo.reject(error);
    });
    return togo;
};

var filesToContentHash = function (allFiles, extension) {
    var extFiles = allFiles.filter(function (file) {
        return file.endsWith(extension);
    });
    var hash = fluid.transform(fluid.arrayToHash(extFiles), function (troo, filename) {
        return fs.readFileSync(filename, "utf-8");
    });
    return hash;
};

var computeAllFiles = function (buildIndex, nodeFiles) {
    var withExcludes = nodeFiles.filter(function (oneFile) {
        return !buildIndex.excludes.some(function (oneExclude) {
            return oneFile.indexOf(oneExclude) !== -1;
        });
    });
    return withExcludes.concat(buildIndex.localSource);
};

var buildFromFiles = function (buildIndex, nodeFiles) {
    var allFiles = computeAllFiles(buildIndex, nodeFiles);
    nodeFiles.concat(buildIndex.localSource);

    var jsHash = filesToContentHash(allFiles, ".js");
    var fullJsHash = fluid.extend({header: buildIndex.codeHeader}, jsHash, {footer: buildIndex.codeFooter});
    fluid.log("Minifying " + Object.keys(fullJsHash).length + " JS files ... ");
    var minified = UglifyJS.minify(fullJsHash, {
        mangle: false,
        sourceMap: {
            filename: "bagatelle.js",
            url: "bagatelle.js.map"
        }
    });
    fs.removeSync("build");
    fs.ensureDirSync("build/js");
    fs.writeFileSync("build/js/bagatelle-all.js", minified.code);
    fs.writeFileSync("build/js/bagatelle-all.js.map", minified.map);

    var cssHash = filesToContentHash(allFiles, ".css");
    var cssConcat = String.prototype.concat.apply("", Object.values(cssHash));

    fs.ensureDirSync("build/css");
    fs.writeFileSync("build/css/bagatelle-all.css", cssConcat);
    buildIndex.copy.forEach(function (oneCopy) {
        fs.copySync(oneCopy.src, oneCopy.dest);
    });
    fluid.log("Copied " + (buildIndex.copy.length + 3) + " files to " + fs.realpathSync("build"));
};

fluid.setLogging(true);

var linesPromise = readLines("gh-pages-nm.txt");

linesPromise.then(function (lines) {
    buildFromFiles(buildIndex, lines);
}, function (error) {
    console.log(error);
});
