/* Local-only PDF optimization. Text, page content, fonts, and forms stay intact. */
let busy = false;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_PIXELS = 16 * 1024 * 1024;
const SETTINGS = {
  gentle: { quality: 0.9, maxDimension: 3000 },
  balanced: { quality: 0.72, maxDimension: 1800 },
  strong: { quality: 0.55, maxDimension: 1200 },
};

function progress(value, label) {
  self.postMessage({ type: 'progress', value, label });
}

// Read JPEG dimensions before asking the browser to allocate decoded pixels.
function jpegDimensions(bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 217 || marker === 218) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ([192, 193, 194].includes(marker) && length >= 8) {
      return { height: bytes[offset + 3] * 256 + bytes[offset + 4], width: bytes[offset + 5] * 256 + bytes[offset + 6] };
    }
    offset += length;
  }
  return null;
}

// Bound decompression output; pdf-lib's unbounded decoder also omits predictors.
async function inflateBounded(bytes, expectedLength) {
  if (typeof DecompressionStream === 'undefined') return null;
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const result = new Uint8Array(expectedLength);
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > expectedLength) {
        await reader.cancel();
        return null;
      }
      result.set(value, offset);
      offset += value.length;
    }
    return offset === expectedLength ? result : null;
  } finally {
    reader.releaseLock();
  }
}

function undoPredictor(bytes, width, height, channels, predictor) {
  const rowLength = width * channels;
  if (predictor === 1) return bytes;
  if (predictor === 2) {
    const result = bytes.slice();
    for (let row = 0; row < height; row++) {
      const start = row * rowLength;
      for (let column = channels; column < rowLength; column++) result[start + column] = (result[start + column] + result[start + column - channels]) & 255;
    }
    return result;
  }
  if (predictor < 10 || predictor > 15 || bytes.length !== (rowLength + 1) * height) return null;
  const result = new Uint8Array(rowLength * height);
  for (let row = 0; row < height; row++) {
    const inputStart = row * (rowLength + 1);
    const outputStart = row * rowLength;
    const filter = bytes[inputStart];
    if (filter > 4) return null;
    for (let column = 0; column < rowLength; column++) {
      const left = column >= channels ? result[outputStart + column - channels] : 0;
      const up = row > 0 ? result[outputStart + column - rowLength] : 0;
      const upperLeft = row > 0 && column >= channels ? result[outputStart + column - rowLength - channels] : 0;
      let adjustment = 0;
      if (filter === 1) adjustment = left;
      else if (filter === 2) adjustment = up;
      else if (filter === 3) adjustment = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const prediction = left + up - upperLeft;
        const dl = Math.abs(prediction - left), du = Math.abs(prediction - up), dul = Math.abs(prediction - upperLeft);
        adjustment = dl <= du && dl <= dul ? left : du <= dul ? up : upperLeft;
      }
      result[outputStart + column] = (bytes[inputStart + 1 + column] + adjustment) & 255;
    }
  }
  return result;
}

async function optimizeImage(doc, ref, stream, settings, lib) {
  const { PDFName, PDFNumber, PDFDict, PDFRawStream } = lib;
  const name = (key) => PDFName.of(key);
  const dict = stream.dict;
  const lookup = (key) => dict.lookup(name(key));
  const number = (key) => { const value = lookup(key); return value instanceof PDFNumber ? value.asNumber() : null; };
  if (String(lookup('Subtype')) !== '/Image') return false;
  // Preserve transparency, color conversion, and nonstandard decoding untouched.
  if (['SMask', 'Mask', 'ImageMask', 'Decode', 'SMaskInData', 'Alternates', 'OPI'].some((key) => dict.has(name(key)))) return false;
  const color = String(lookup('ColorSpace'));
  if (color !== '/DeviceRGB' && color !== '/DeviceGray') return false;
  if (number('BitsPerComponent') !== 8) return false;
  const width = number('Width');
  const height = number('Height');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS || width > 16384 || height > 16384) return false;
  if (stream.contents.length < 4096) return false;
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return false;
  const filter = String(lookup('Filter'));
  const params = lookup('DecodeParms');
  const channels = color === '/DeviceRGB' ? 3 : 1;
  let predictor = 1;
  // Predictor geometry must match the image; unsupported decoding stays intact.
  if (params && String(params) !== 'null') {
    if (!(params instanceof PDFDict)) return false;
    if (filter === '/DCTDecode') return false;
    const parameter = (key, fallback) => {
      const value = params.lookup(name(key));
      return value === undefined ? fallback : value instanceof PDFNumber ? value.asNumber() : NaN;
    };
    predictor = parameter('Predictor', 1);
    if (![1, 2, 10, 11, 12, 13, 14, 15].includes(predictor)) return false;
    if (predictor !== 1 && (filter !== '/FlateDecode' || parameter('Colors', 1) !== channels || parameter('Columns', 1) !== width || parameter('BitsPerComponent', 8) !== 8)) return false;
  }
  let bitmap;
  let sourceCanvas;
  let targetCanvas;
  try {
    if (filter === '/DCTDecode') {
      const dimensions = jpegDimensions(stream.contents);
      if (!dimensions || dimensions.width !== width || dimensions.height !== height) return false;
      bitmap = await createImageBitmap(new Blob([stream.contents], { type: 'image/jpeg' }), { imageOrientation: 'none' });
      if (bitmap.width !== width || bitmap.height !== height) return false;
    } else if (filter === '/FlateDecode' || !dict.has(name('Filter'))) {
      const expected = width * height * channels;
      const inflatedLength = expected + (predictor >= 10 ? height : 0);
      const decoded = filter === '/FlateDecode' ? await inflateBounded(stream.contents, inflatedLength) : stream.contents;
      const pixels = decoded ? undoPredictor(decoded, width, height, channels, predictor) : null;
      if (!pixels || pixels.length !== expected) return false;
      sourceCanvas = new OffscreenCanvas(width, height);
      const context = sourceCanvas.getContext('2d');
      if (!context) return false;
      const image = context.createImageData(width, height);
      for (let pixel = 0, sample = 0; pixel < width * height; pixel++, sample += channels) {
        const out = pixel * 4;
        image.data[out] = pixels[sample];
        image.data[out + 1] = pixels[sample + (channels === 3 ? 1 : 0)];
        image.data[out + 2] = pixels[sample + (channels === 3 ? 2 : 0)];
        image.data[out + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      bitmap = sourceCanvas;
    } else return false;
    const scale = Math.min(1, settings.maxDimension / Math.max(width, height));
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    targetCanvas = new OffscreenCanvas(outputWidth, outputHeight);
    const context = targetCanvas.getContext('2d');
    if (!context) return false;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, outputWidth, outputHeight);
    const encoded = await targetCanvas.convertToBlob({ type: 'image/jpeg', quality: settings.quality });
    if (encoded.type !== 'image/jpeg' || encoded.size + 128 >= stream.contents.length) return false;
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const replacement = dict.clone(doc.context);
    replacement.set(name('Width'), PDFNumber.of(outputWidth));
    replacement.set(name('Height'), PDFNumber.of(outputHeight));
    replacement.set(name('ColorSpace'), name('DeviceRGB'));
    replacement.set(name('Filter'), name('DCTDecode'));
    replacement.delete(name('DecodeParms'));
    replacement.delete(name('Length'));
    doc.context.assign(ref, PDFRawStream.of(replacement, bytes));
    return true;
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    if (sourceCanvas) { sourceCanvas.width = 1; sourceCanvas.height = 1; }
    if (targetCanvas) { targetCanvas.width = 1; targetCanvas.height = 1; }
  }
}

self.onmessage = async ({ data }) => {
  if (busy) return;
  busy = true;
  try {
    if (!(data.buffer instanceof ArrayBuffer) || !data.buffer.byteLength) throw new Error('Choose a PDF file to compress.');
    if (data.buffer.byteLength > MAX_FILE_BYTES) throw new Error('Choose a PDF smaller than 50 MB.');
    if (!Object.prototype.hasOwnProperty.call(SETTINGS, data.level)) throw new Error('Choose a compression level and try again.');
    progress(5, 'Reading your PDF');
    if (!self.PDFLib) importScripts('/compress-pdf/vendor/pdf-lib.min.js');
    const lib = self.PDFLib;
    const original = new Uint8Array(data.buffer);
    let doc;
    try {
      doc = await lib.PDFDocument.load(original, { updateMetadata: false });
    } catch (error) {
      if (/encrypt/i.test(String(error))) throw new Error('This PDF is password protected. Save an unlocked copy, then try again.');
      throw new Error('This PDF could not be opened. Try opening it in a PDF reader and saving a fresh copy.');
    }
    if (doc.isEncrypted) throw new Error('This PDF is password protected. Save an unlocked copy, then try again.');
    const objects = doc.context.enumerateIndirectObjects();
    // A rewrite invalidates signatures, including nested direct signature dictionaries.
    const seen = new Set();
    const containsSignature = (object) => {
      if (!object || seen.has(object)) return false;
      seen.add(object);
      const dictionary = object instanceof lib.PDFRawStream ? object.dict : object;
      if (dictionary instanceof lib.PDFDict) {
        if (dictionary.has(lib.PDFName.of('ByteRange')) || String(dictionary.lookup(lib.PDFName.of('Type'))) === '/Sig' || String(dictionary.lookup(lib.PDFName.of('FT'))) === '/Sig') return true;
        return dictionary.values().some(containsSignature);
      }
      if (object instanceof lib.PDFArray) return object.asArray().some(containsSignature);
      return false;
    };
    if (objects.some(([, object]) => containsSignature(object))) throw new Error('This PDF contains a digital signature. Compress an unsigned copy to keep the signature valid.');
    const pages = doc.getPageCount();
    // Masks are image objects too; protect referenced mask streams independently
    // of their parent so their dimensions and alpha samples remain unchanged.
    const protectedImages = new Set();
    for (const [, object] of objects) {
      if (!(object instanceof lib.PDFRawStream)) continue;
      for (const key of ['SMask', 'Mask']) {
        const mask = object.dict.lookup(lib.PDFName.of(key));
        if (mask instanceof lib.PDFRawStream) protectedImages.add(mask);
      }
    }
    let imagesOptimized = 0;
    for (let index = 0; index < objects.length; index++) {
      const [ref, object] = objects[index];
      if (object instanceof lib.PDFRawStream && !protectedImages.has(object)) {
        try {
          if (await optimizeImage(doc, ref, object, SETTINGS[data.level], lib)) imagesOptimized++;
        } catch (_) {
          // Unsupported or malformed images retain their original stream.
        }
      }
      if (index % 20 === 0) progress(10 + Math.round(index / Math.max(objects.length, 1) * 75), 'Optimizing your PDF');
    }
    progress(90, 'Preparing your download');
    const saved = await doc.save({ useObjectStreams: true, updateFieldAppearances: false, addDefaultPage: false });
    const unchanged = saved.length >= original.length;
    const result = unchanged ? original : saved;
    const buffer = result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength);
    self.postMessage({ type: 'result', buffer, pages, imagesOptimized: unchanged ? 0 : imagesOptimized, unchanged }, [buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'This PDF could not be compressed. Try another file.' });
  } finally {
    busy = false;
  }
};
