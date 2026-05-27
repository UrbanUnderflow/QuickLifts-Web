#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');
const { jsPDF } = require('jspdf');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXPORT_DIR = path.join(ROOT_DIR, 'exports', 'pulse-pil-pepperdine-pitch');
const SLIDES_DIR = path.join(EXPORT_DIR, 'slides');
const OUTPUT_PDF = path.join(EXPORT_DIR, 'Pulse_Intelligence_Labs_Pepperdine_MFC_2026.pdf');
const PUBLIC_PDF = path.join(ROOT_DIR, 'public', 'Pulse_Intelligence_Labs_Pepperdine_MFC_2026.pdf');
const INVESTOR_DOCS_PDF = path.join(ROOT_DIR, 'public', 'investor-docs', 'Pulse_Intelligence_Labs_Pepperdine_MFC_2026.pdf');
const TOTAL_SLIDES = 22;
const VIEWPORT = { width: 2730, height: 1536 };
const DEVICE_SCALE_FACTOR = 1;
const SLIDE_EXTENSION = 'jpg';
const PDF_IMAGE_QUALITY = Number(process.env.PULSE_DECK_JPEG_QUALITY || 82);
const EXTERNAL_BASE_URL = process.env.PULSE_DECK_BASE_URL?.replace(/\/$/, '') || null;

const slideHoldMs = new Map([
  [6, 8200],
  [8, 7000],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });

const waitForServer = async (url, timeoutMs = 240000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const isReady = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode && response.statusCode < 500);
      });

      request.on('error', () => resolve(false));
      request.setTimeout(2500, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (isReady) return;
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const waitForAssets = async (page) => {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await Promise.all(
      Array.from(document.images).map(
        (image) =>
          image.complete ||
          new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          }),
      ),
    );
  });
};

const startNextServer = (port) => {
  const nextBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'next');
  const child = spawn(nextBin, ['dev', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = String(chunk);
    if (/ready|started server|compiled/i.test(text)) process.stdout.write(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = String(chunk);
    if (/error|failed|ready/i.test(text)) process.stderr.write(text);
  });

  return child;
};

const buildPdf = () => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [VIEWPORT.width, VIEWPORT.height],
    compress: true,
  });

  for (let index = 0; index < TOTAL_SLIDES; index += 1) {
    if (index > 0) pdf.addPage([VIEWPORT.width, VIEWPORT.height], 'landscape');

    const slidePath = path.join(SLIDES_DIR, `slide-${String(index + 1).padStart(2, '0')}.${SLIDE_EXTENSION}`);
    const image = fs.readFileSync(slidePath).toString('base64');
    pdf.addImage(
      `data:image/jpeg;base64,${image}`,
      'JPEG',
      0,
      0,
      VIEWPORT.width,
      VIEWPORT.height,
      undefined,
      'MEDIUM',
    );
  }

  fs.writeFileSync(OUTPUT_PDF, Buffer.from(pdf.output('arraybuffer')));
  fs.mkdirSync(path.dirname(INVESTOR_DOCS_PDF), { recursive: true });
  fs.copyFileSync(OUTPUT_PDF, PUBLIC_PDF);
  fs.copyFileSync(OUTPUT_PDF, INVESTOR_DOCS_PDF);
};

const exportDeck = async () => {
  fs.rmSync(SLIDES_DIR, { recursive: true, force: true });
  fs.mkdirSync(SLIDES_DIR, { recursive: true });

  const port = EXTERNAL_BASE_URL ? null : await findFreePort();
  const baseUrl = EXTERNAL_BASE_URL || `http://127.0.0.1:${port}`;
  const server = EXTERNAL_BASE_URL ? null : startNextServer(port);

  let browser;

  const cleanup = async () => {
    if (browser) await browser.close().catch(() => {});
    if (server && !server.killed) server.kill('SIGTERM');
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });

  try {
    await waitForServer(`${baseUrl}/pulse-pil-pepperdine-pitch`);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: 'dark',
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/pulse-pil-pepperdine-pitch`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.addStyleTag({
      content: `
        html, body, #__next { width: 100% !important; height: 100% !important; margin: 0 !important; background: #05070b !important; }
        footer { display: none !important; }
        main { height: 100vh !important; }
        * { scrollbar-width: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        *::-webkit-scrollbar { display: none !important; }
      `,
    });

    await waitForAssets(page);
    await page.waitForTimeout(1800);

    for (let index = 0; index < TOTAL_SLIDES; index += 1) {
      if (index > 0) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(700);
      }

      await waitForAssets(page);
      await page.waitForTimeout(slideHoldMs.get(index) ?? 2200);

      const slidePath = path.join(SLIDES_DIR, `slide-${String(index + 1).padStart(2, '0')}.${SLIDE_EXTENSION}`);
      await page.screenshot({
        path: slidePath,
        fullPage: false,
        type: 'jpeg',
        quality: PDF_IMAGE_QUALITY,
      });
      console.log(`Captured slide ${index + 1}/${TOTAL_SLIDES}`);
    }

    await cleanup();
    buildPdf();

    const stats = fs.statSync(OUTPUT_PDF);
    console.log(`PDF written: ${OUTPUT_PDF}`);
    console.log(`Public download: ${PUBLIC_PDF}`);
    console.log(`Investor docs download: ${INVESTOR_DOCS_PDF}`);
    console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    await cleanup();
    throw error;
  }
};

exportDeck().catch((error) => {
  console.error(error);
  process.exit(1);
});
