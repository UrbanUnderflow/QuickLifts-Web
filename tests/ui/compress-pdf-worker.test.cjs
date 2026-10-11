const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { deflateSync } = require('node:zlib');
const lib = require('../../public/compress-pdf/vendor/pdf-lib.min.js');
const source = fs.readFileSync(path.join(__dirname, '../../public/compress-pdf/compression-worker.js'), 'utf8');

function worker(extra = {}) {
  const messages = [];
  const context = vm.createContext({ ArrayBuffer, Uint8Array, Set, Blob, DecompressionStream, self: { PDFLib: lib, postMessage: (value) => messages.push(value) }, ...extra });
  vm.runInContext(source, context);
  return { context, messages };
}

test('PNG row filters restore exact pixels including previous-row dependencies', () => {
  const { context } = worker();
  const cases = [
    [0, 10, 30, 60, 0, 20, 50, 90],
    [1, 10, 20, 30, 1, 20, 30, 40],
    [2, 10, 30, 60, 2, 10, 20, 30],
    [3, 10, 25, 45, 3, 15, 25, 35],
    [4, 10, 20, 30, 4, 10, 20, 30],
  ];
  for (let predictor = 10; predictor <= 15; predictor++) {
    for (const encoded of cases) assert.deepEqual(Array.from(context.undoPredictor(Uint8Array.from(encoded), 3, 2, 1, predictor)), [10, 30, 60, 20, 50, 90]);
  }
  assert.equal(context.undoPredictor(Uint8Array.from([5, 10, 30, 60]), 3, 1, 1, 15), null);
  assert.equal(context.undoPredictor(Uint8Array.from([0, 10]), 3, 1, 1, 15), null);
});

test('TIFF and PNG predictors use RGB pixel stride and byte wraparound', () => {
  const { context } = worker();
  const encoded = Uint8Array.from([250, 100, 20, 16, 20, 30]);
  assert.deepEqual(Array.from(context.undoPredictor(encoded, 2, 1, 3, 2)), [250, 100, 20, 10, 120, 50]);
  assert.deepEqual(Array.from(context.undoPredictor(Uint8Array.from([1, ...encoded]), 2, 1, 3, 11)), [250, 100, 20, 10, 120, 50]);
  assert.deepEqual(Array.from(encoded), [250, 100, 20, 16, 20, 30]);
});

test('stream inflation rejects oversized and truncated decoded samples', async () => {
  const { context } = worker();
  const compressed = deflateSync(new Uint8Array(10000));
  assert.equal(await context.inflateBounded(compressed, 10), null);
  assert.equal(await context.inflateBounded(compressed, 10001), null);
  assert.equal((await context.inflateBounded(compressed, 10000)).length, 10000);
});

test('soft and explicit image masks are never recompressed independently', async () => {
  for (const kind of ['SMask', 'Mask']) {
    const doc = await lib.PDFDocument.create();
    doc.addPage();
    const mask = doc.context.register(doc.context.stream(new Uint8Array(10000).fill(128), { Type: 'XObject', Subtype: 'Image', Width: 100, Height: 100, BitsPerComponent: 8, ColorSpace: 'DeviceGray' }));
    doc.context.register(doc.context.stream(new Uint8Array(30000).fill(200), { Type: 'XObject', Subtype: 'Image', Width: 100, Height: 100, BitsPerComponent: 8, ColorSpace: 'DeviceRGB', [kind]: mask }));
    let allocations = 0;
    const { context, messages } = worker({ createImageBitmap() {}, OffscreenCanvas: function () { allocations++; throw new Error('Unexpected mask decoding'); } });
    const bytes = await doc.save();
    await context.self.onmessage({ data: { buffer: bytes.buffer, level: 'strong' } });
    assert.equal(messages.at(-1).type, 'result');
    assert.equal(allocations, 0);
  }
});

test('predictor geometry mismatches leave image bytes untouched', async () => {
  const doc = await lib.PDFDocument.create();
  const stream = doc.context.stream(new Uint8Array(5000), { Type: 'XObject', Subtype: 'Image', Width: 100, Height: 100, BitsPerComponent: 8, ColorSpace: 'DeviceRGB', Filter: 'FlateDecode', DecodeParms: { Predictor: 15, Colors: 1, Columns: 100, BitsPerComponent: 8 } });
  const ref = doc.context.register(stream);
  const { context } = worker({ createImageBitmap() {}, OffscreenCanvas() { throw new Error('Unexpected decode'); } });
  assert.equal(await context.optimizeImage(doc, ref, stream, { quality: 0.72, maxDimension: 1800 }, lib), false);
  assert.equal(doc.context.lookup(ref), stream);
});
