/**
 * Compact GIF89a encoder for pixel art (no worker).
 * Accepts RGBA frames as Uint8Array / Uint8ClampedArray (width * height * 4).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.GifEncoder = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function u16(n) {
        return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
    }

    function strBytes(s) {
        var out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    }

    function concat(parts) {
        var total = 0;
        for (var i = 0; i < parts.length; i++) total += parts[i].length;
        var out = new Uint8Array(total);
        var offset = 0;
        for (var j = 0; j < parts.length; j++) {
            out.set(parts[j], offset);
            offset += parts[j].length;
        }
        return out;
    }

    function asSubBlocks(bytes) {
        var chunks = [];
        var i = 0;
        while (i < bytes.length) {
            var n = Math.min(255, bytes.length - i);
            var block = new Uint8Array(n + 1);
            block[0] = n;
            block.set(bytes.subarray(i, i + n), 1);
            chunks.push(block);
            i += n;
        }
        chunks.push(new Uint8Array([0]));
        return concat(chunks);
    }

    function lzwEncode(minCodeSize, indexStream) {
        var clearCode = 1 << minCodeSize;
        var eoiCode = clearCode + 1;
        var codeSize = minCodeSize + 1;
        var nextCode = eoiCode + 1;
        var table = new Map();

        var out = [];
        var bitBuf = 0;
        var bitCount = 0;

        function writeCode(code, size) {
            bitBuf |= (code << bitCount);
            bitCount += size;
            while (bitCount >= 8) {
                out.push(bitBuf & 0xff);
                bitBuf >>= 8;
                bitCount -= 8;
            }
        }

        function resetTable() {
            table = new Map();
            codeSize = minCodeSize + 1;
            nextCode = eoiCode + 1;
        }

        writeCode(clearCode, codeSize);

        if (indexStream.length === 0) {
            writeCode(eoiCode, codeSize);
            if (bitCount > 0) out.push(bitBuf & 0xff);
            return new Uint8Array(out);
        }

        var prefix = indexStream[0];
        for (var i = 1; i < indexStream.length; i++) {
            var k = indexStream[i];
            var key = (prefix << 8) | k;
            if (table.has(key)) {
                prefix = table.get(key);
            } else {
                writeCode(prefix, codeSize);
                if (nextCode < 4096) {
                    table.set(key, nextCode);
                    if (nextCode === (1 << codeSize) && codeSize < 12) {
                        codeSize++;
                    }
                    nextCode++;
                } else {
                    writeCode(clearCode, codeSize);
                    resetTable();
                }
                prefix = k;
            }
        }

        writeCode(prefix, codeSize);
        writeCode(eoiCode, codeSize);
        if (bitCount > 0) out.push(bitBuf & 0xff);
        return new Uint8Array(out);
    }

    function colorKey(r, g, b) {
        return (r << 16) | (g << 8) | b;
    }

    function nearestIndex(r, g, b, palette, start) {
        var best = start;
        var bestD = Infinity;
        for (var i = start; i < palette.length; i++) {
            var dr = r - palette[i][0];
            var dg = g - palette[i][1];
            var db = b - palette[i][2];
            var d = dr * dr + dg * dg + db * db;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        return best;
    }

    function buildPalette(frames, width, height, useTransparent) {
        var palette = [];
        var map = new Map();
        var transparentIndex = 0;
        var start = 0;

        if (useTransparent) {
            palette.push([0, 0, 0]);
            start = 1;
        }

        var maxColors = 256;
        var pixelCount = width * height;

        for (var f = 0; f < frames.length; f++) {
            var data = frames[f];
            for (var p = 0; p < pixelCount; p++) {
                var i = p * 4;
                var a = data[i + 3];
                if (useTransparent && a < 128) continue;
                var r = data[i];
                var g = data[i + 1];
                var b = data[i + 2];
                var key = colorKey(r, g, b);
                if (map.has(key)) continue;
                if (palette.length < maxColors) {
                    map.set(key, palette.length);
                    palette.push([r, g, b]);
                } else {
                    map.set(key, nearestIndex(r, g, b, palette, start));
                }
            }
        }

        if (palette.length === start) {
            palette.push([0, 0, 0]);
        }

        return {
            palette: palette,
            colorMap: map,
            transparentIndex: transparentIndex,
            start: start
        };
    }

    function indexFrame(data, width, height, paletteInfo, useTransparent) {
        var pixelCount = width * height;
        var indexed = new Uint8Array(pixelCount);
        var map = paletteInfo.colorMap;
        var palette = paletteInfo.palette;
        var start = paletteInfo.start;
        for (var p = 0; p < pixelCount; p++) {
            var i = p * 4;
            if (useTransparent && data[i + 3] < 128) {
                indexed[p] = paletteInfo.transparentIndex;
                continue;
            }
            var key = colorKey(data[i], data[i + 1], data[i + 2]);
            var idx = map.get(key);
            if (idx === undefined) {
                idx = nearestIndex(data[i], data[i + 1], data[i + 2], palette, start);
            }
            indexed[p] = idx;
        }
        return indexed;
    }

    /**
     * @param {Array<Uint8Array|Uint8ClampedArray>} frames RGBA buffers
     * @param {number} width
     * @param {number} height
     * @param {{delay?: number, loop?: number, transparent?: boolean}} [options]
     *   delay is in GIF centiseconds (1/100s). loop 0 = forever.
     * @returns {Uint8Array}
     */
    function encode(frames, width, height, options) {
        options = options || {};
        var delay = options.delay != null ? options.delay : 25;
        var loop = options.loop != null ? options.loop : 0;
        var useTransparent = options.transparent !== false;

        if (!frames || !frames.length) {
            throw new Error('GIF needs at least one frame');
        }

        var paletteInfo = buildPalette(frames, width, height, useTransparent);
        var palette = paletteInfo.palette.slice();

        var palBits = 1;
        while ((1 << palBits) < palette.length) palBits++;
        var tableSize = 1 << palBits;
        while (palette.length < tableSize) palette.push([0, 0, 0]);

        var minCodeSize = Math.max(2, palBits);
        var parts = [];

        function emit(bytes) {
            parts.push(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        }

        emit(strBytes('GIF89a'));
        emit(u16(width));
        emit(u16(height));
        var packed = 0x80 | (7 << 4) | (palBits - 1);
        emit([packed, 0, 0]);

        var palBytes = new Uint8Array(tableSize * 3);
        for (var i = 0; i < tableSize; i++) {
            palBytes[i * 3] = palette[i][0];
            palBytes[i * 3 + 1] = palette[i][1];
            palBytes[i * 3 + 2] = palette[i][2];
        }
        emit(palBytes);

        emit([0x21, 0xff, 0x0b]);
        emit(strBytes('NETSCAPE2.0'));
        emit([0x03, 0x01]);
        emit(u16(loop));
        emit([0x00]);

        for (var f = 0; f < frames.length; f++) {
            var indexed = indexFrame(
                frames[f],
                width,
                height,
                paletteInfo,
                useTransparent
            );

            var transFlag = useTransparent ? 1 : 0;
            var disposal = useTransparent ? 2 : 1;
            var gcePacked = (disposal << 2) | transFlag;
            emit([0x21, 0xf9, 0x04, gcePacked]);
            emit(u16(delay));
            emit([useTransparent ? paletteInfo.transparentIndex : 0, 0x00]);

            emit([0x2c]);
            emit(u16(0));
            emit(u16(0));
            emit(u16(width));
            emit(u16(height));
            emit([0x00]);

            var lzw = lzwEncode(minCodeSize, indexed);
            emit([minCodeSize]);
            emit(asSubBlocks(lzw));
        }

        emit([0x3b]);
        return concat(parts);
    }

    return { encode: encode };
});
