/**
 * @file concat ttfs
 * @author junmer
 */

/* eslint-env node */

var through = require('through2');

var isTtf = require('is-ttf');
var path = require('path');
var replaceExt = require('replace-ext');
var ab2b = require('b3b').ab2b;
var b2ab = require('b3b').b2ab;
var bufferToVinyl = require('buffer-to-vinyl');
var objectAssign = require('object-assign');

// fonteditor-core
var TTFReader = require('fonteditor-core').TTFReader;
var TTFWriter = require('fonteditor-core').TTFWriter;
var TTF = require('fonteditor-core').TTF;

/**
 * 从字形信息中取得 代码点
 *
 * @param  {Object} ttf 字体对象
 * @return {Array}     代码点数组
 */
function getUnicodeByGlyf(ttf) {

    var glyf = ttf.glyf;
    var codes = [];

    glyf.forEach(function (g) {
        if (!g.unicode) {
            return;
        }

        if (Array.isArray(g.unicode)) {

            g.unicode.forEach(function (c) {
                codes.push(c);
            });

        }
        else {
            codes.push(g.unicode);
        }

    });

    return codes;
}

/**
 * 删除一些字形
 *
 * @param  {Object} ttf       字体对象
 * @param  {Object} condition 条件
 * @return {Object}           字体对象
 */
function removeGlyf(ttf, condition) {

    var unicodeList = Array.isArray(condition.unicode) ? condition.unicode : [condition.unicode];
    var unicodeHash = {};
    unicodeList.forEach(function (unicode) {
        if (typeof unicode === 'string') {
            unicode = Number('0x' + unicode.slice(1));
        }
        unicodeHash[unicode] = true;
    });

    function hasCode(glyf) {
        if (!glyf.unicode || !glyf.unicode.length) {
            return false;
        }

        for (var i = 0, l = glyf.unicode.length; i < l; i++) {
            if (unicodeHash[glyf.unicode[i]]) {
                return true;
            }
        }
    }

    ttf.glyf = ttf.glyf.filter(function (glyf) {
        return !hasCode(glyf);
    });

    return ttf;
}

/**
 * ttf concat fontmin plugin
 *
 * @param {string} file filename
 * @param {Object} opts opts
 * @param {string} opts.fontName font name
 * @return {Object} stream.Transform instance
 * @api public
 */
module.exports = function (file, opts) {

    if (!file) {
        throw new Error('Missing file option for fontmin-concat');
    }

    opts = objectAssign({hinting: true}, opts);

    var firstFile;
    var fileName;
    var fontMain;

    if (typeof file === 'string') {

        // fix file ext
        file = replaceExt(file, '.ttf');

        // set file name
        fileName = file;

    }
    else if (typeof file.path === 'string') {
        fileName = path.basename(file.path);
        firstFile = bufferToVinyl.file(null, fileName);
    }
    else {
        throw new Error('Missing path in file options for fontmin-concat');
    }


    function bufferContents(file, enc, cb) {

        // ignore empty files
        if (file.isNull()) {
            cb();
            return;
        }

        // check stream
        if (file.isStream()) {
            this.emit('error', new Error('Streaming not supported'));
            cb();
            return;
        }

        // check ttf
        if (!isTtf(file.contents)) {
            cb();
            return;
        }

        // set first file if not already set
        if (!firstFile) {

            firstFile = file;

            // init font main
            var mainTtfObject = new TTFReader(opts).read(b2ab(firstFile.contents));

            fontMain = new TTF(mainTtfObject);

            var fontName = opts.fontName || path.basename(fileName, '.ttf');

            fontMain.setName(fontName);

            cb();

            return;
        }


        // parse font
        var ttfObject = new TTFReader(opts).read(b2ab(file.contents));

        removeGlyf(ttfObject, {
            unicode: getUnicodeByGlyf(fontMain.ttf)
        });

        // merge new glyf
        fontMain.mergeGlyf(ttfObject, objectAssign({adjustGlyf: true}, opts));

        cb();
    }


    function endStream(cb) {
        // no files passed in, no file goes out
        if (!firstFile || !fontMain) {
            cb();
            return;
        }

        var concatdFile;

        // if file opt was a file path
        // clone everything from the first file
        if (typeof file === 'string') {
            concatdFile = firstFile.clone({
                contents: false
            });

            concatdFile.path = path.join(firstFile.base, file);
        }
        else {
            concatdFile = firstFile;
        }


        // set contents
        fontMain.optimize();
        var concatedObj = fontMain.get();

        concatdFile.ttfObject = concatedObj;

        concatdFile.contents = ab2b(
            new TTFWriter(opts).write(concatedObj)
        );

        this.push(concatdFile);

        cb();
    }

    return through.obj(bufferContents, endStream);

};
