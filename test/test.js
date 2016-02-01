/**
 * @file test
 * @author junmer
 */

/* eslint-env node */

'use strict';

var assert = require('assert');
var isTtf = require('is-ttf');
var fs =  require('fs');
var path = require('path');
var vfs = require('vinyl-fs');
var del = require('del');

var concat = require('../');

var outputPath = path.resolve(__dirname, 'output');
var outputName = 'senty-concated.ttf';

before(function () {
    del(outputPath);
});

it('output is ttf', function (done) {

    var fsOpt = {cwd: __dirname};

    var stream = vfs.src(['fixtures/*.ttf'], fsOpt)
        .pipe(concat(outputName))
        .pipe(vfs.dest('output', fsOpt));


    stream.on('end', function () {

        var output = path.resolve(outputPath, outputName);

        assert(
            isTtf(
                fs.readFileSync(output)
            )
        );

        done();
    });

});
