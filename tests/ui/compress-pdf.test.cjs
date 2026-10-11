// Run against the public directory: python3 -m http.server 3057 --directory public
// PDF_COMPRESS_BASE_URL may point to a preview or the deployed static utility.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const sharp = require('sharp');
const { PDFDocument, StandardFonts, PDFName, PDFRawStream } = require('../../public/compress-pdf/vendor/pdf-lib.min.js');
const base = process.env.PDF_COMPRESS_BASE_URL || 'http://localhost:3057';
const fs = require('node:fs/promises');
const path = require('node:path');
const outputDir = process.env.PDF_COMPRESS_TEST_OUTPUT;
async function fixtures() {
  const width = 2400, height = 1600;
  const pixels = Buffer.alloc(width * height * 3);
  let seed = 42;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const offset = (y * width + x) * 3, noise = seed % 30;
    pixels[offset] = Math.min(255, x / width * 210 + noise);
    pixels[offset + 1] = Math.min(255, y / height * 210 + noise);
    pixels[offset + 2] = 110 + noise;
  }
  const jpg = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const img = await doc.embedJpg(jpg);
  for (let i = 0; i < 2; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Compression verification page ${i + 1}`, { x: 40, y: 735, size: 21, font });
    page.drawImage(img, { x: 40, y: 290, width: 532, height: 354 });
    page.drawRectangle({ x: 40, y: 260, width: 532, height: 2 });
  }
  const field = doc.getForm().createTextField('preserved-field');
  field.setText('Keep this value');
  field.addToPage(doc.getPage(1), { x: 40, y: 200, width: 250, height: 30 });
  const photo = await doc.save({ useObjectStreams: false });
  const smallDoc = await PDFDocument.create(); smallDoc.addPage().drawText('Already small');
  const small = await smallDoc.save();
  const signedDoc = await PDFDocument.load(small);
  signedDoc.context.register(signedDoc.context.obj({ Type: 'Sig', ByteRange: [0, 1, 2, 3] }));
  const signed = await signedDoc.save();
  const png = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const pngDoc = await PDFDocument.create(); const pngImage = await pngDoc.embedPng(png);
  pngDoc.addPage().drawImage(pngImage, { x: 0, y: 0, width: 500, height: 333 });
  return { photo, small, signed, png: await pngDoc.save() };
}
async function compress(page, buffer, level = 'balanced') {
  return page.evaluate(({ input, level }) => new Promise((resolve, reject) => {
    const worker = new Worker('/compress-pdf/compression-worker.js');
    const bytes = Uint8Array.from(atob(input), (x) => x.charCodeAt(0));
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.onmessage = ({ data }) => {
      if (data.type === 'error') { worker.terminate(); resolve(data); }
      if (data.type === 'result') {
        const bytes = new Uint8Array(data.buffer);
        let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        worker.terminate(); resolve({ ...data, buffer: btoa(binary) });
      }
    };
    worker.postMessage({ buffer: bytes.buffer, level }, [bytes.buffer]);
  }), { input: Buffer.from(buffer).toString('base64'), level });
}
test('PDF utility: compression fidelity, upload/drop/download, cancellation, and mobile', { timeout: 180000 }, async () => {
  const fixture = await fixtures();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/compress-pdf/`);
    await page.getByRole('button', { name: 'Browse files' }).waitFor();
    if (outputDir) { await fs.mkdir(outputDir, { recursive: true }); await page.screenshot({ path: path.join(outputDir, 'compress-pdf-desktop.png'), fullPage: true }); }
    const sizes = [];
    for (const level of ['gentle', 'balanced', 'strong']) {
      const result = await compress(page, fixture.photo, level);
      assert.equal(result.type, 'result'); assert.ok(result.imagesOptimized > 0);
      const output = Buffer.from(result.buffer, 'base64'); sizes.push(output.length);
      assert.ok(output.length < fixture.photo.length * .65, 'Photo PDF materially smaller');
      const reopened = await PDFDocument.load(output);
      assert.equal(reopened.getPageCount(), 2);
      assert.equal(reopened.getForm().getTextField('preserved-field').getText(), 'Keep this value');
      const original = await PDFDocument.load(fixture.photo);
      for (let i = 0; i < 2; i++) {
        assert.deepEqual(reopened.getPage(i).getSize(), original.getPage(i).getSize());
        const getContents = (d) => d.getPage(i).node.Contents().asArray().map((ref) => Buffer.from(d.context.lookup(ref).contents).toString('base64'));
        assert.deepEqual(getContents(reopened), getContents(original), 'Text and vector page streams are unchanged');
      }
      if (level === 'balanced' && outputDir) await fs.writeFile(path.join(outputDir, 'compressed-test.pdf'), output);
    }
    assert.ok(sizes[0] > sizes[1] && sizes[1] > sizes[2], 'Compression levels produce progressively smaller images');
    const png = await compress(page, fixture.png); assert.equal(png.type, 'result'); assert.ok(png.imagesOptimized > 0);
    const signed = await compress(page, fixture.signed); assert.equal(signed.type, 'error'); assert.match(signed.message, /signature/);
    const malformed = await compress(page, Buffer.from('%PDF-1.7\nnot a PDF')); assert.equal(malformed.type, 'error');
    const first = await compress(page, fixture.small); const second = await compress(page, Buffer.from(first.buffer, 'base64'));
    assert.equal(second.unchanged, true); assert.deepEqual(Buffer.from(second.buffer, 'base64'), Buffer.from(first.buffer, 'base64'));
    await page.locator('#file-input').setInputFiles({ name: 'not-a-pdf.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.getByRole('alert').filter({ hasText: 'Please choose a PDF' }).waitFor();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Browse files' }).click();
    await (await chooserPromise).setFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from(fixture.photo) });
    await page.getByRole('button', { name: 'Compress PDF', exact: true }).click();
    await page.getByRole('link', { name: 'Download compressed PDF' }).waitFor();
    const downloadPromise = page.waitForEvent('download'); await page.locator('#download').click(); const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'test-compressed.pdf');
    const downloaded = await fs.readFile(await download.path()); assert.equal((await PDFDocument.load(downloaded)).getPageCount(), 2);
    if (outputDir) await page.screenshot({ path: path.join(outputDir, 'compress-pdf-result.png'), fullPage: true });
    await page.getByRole('button', { name: 'Compress another PDF' }).click();
    await page.evaluate((data) => { const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(data), x => x.charCodeAt(0))], 'dropped.pdf', { type: 'application/pdf' })); document.getElementById('dropzone').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer })); }, Buffer.from(fixture.photo).toString('base64'));
    await page.getByRole('heading', { name: 'dropped.pdf' }).waitFor();
    await page.getByRole('button', { name: 'Compress PDF', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Compress PDF', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remove file' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (outputDir) await page.screenshot({ path: path.join(outputDir, 'compress-pdf-mobile.png'), fullPage: true });
    const rendered = await page.evaluate(async ({ original, compressed }) => {
      const pdfjs = await import('/vendor/pdfjs-5.6.205/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs-5.6.205/pdf.worker.min.mjs';
      document.body.innerHTML = '<div id=compare style="display:flex;gap:20px;background:white;padding:20px"></div>';
      const text = [];
      for (const encoded of [original, compressed]) {
        const pdf = await pdfjs.getDocument({ data: Uint8Array.from(atob(encoded), x => x.charCodeAt(0)), isEvalSupported: false }).promise;
        const p = await pdf.getPage(1);
        text.push((await p.getTextContent()).items.map(x => x.str).join(' '));
        const viewport = p.getViewport({ scale: .8 });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        document.getElementById('compare').append(canvas);
        await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        await pdf.destroy();
      }
      return text;
    }, { original: Buffer.from(fixture.photo).toString('base64'), compressed: downloaded.toString('base64') });
    assert.equal(rendered[0], rendered[1]); assert.match(rendered[1], /Compression verification page 1/);
    await page.setViewportSize({ width: 1100, height: 730 });
    if (outputDir) await page.screenshot({ path: path.join(outputDir, 'pdf-render-comparison.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ original: fixture.photo.length, gentle: sizes[0], balanced: sizes[1], strong: sizes[2], pngImagesOptimized: png.imagesOptimized }));
  } finally { await browser.close(); }
});
