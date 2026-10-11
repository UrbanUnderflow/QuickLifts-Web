# PDF compression utility

Standalone static utility at `/compress-pdf`. Next rewrites and Netlify redirects serve `public/compress-pdf/index.html` without the app authentication, analytics, or payment shell. No PDF bytes are uploaded or persisted. Processing runs in a dedicated Web Worker; cancel terminates it. Files are limited to 50 MiB. Downloads use revocable in-memory blob URLs.

## Compression

Vendored pdf-lib 1.17.1 (MIT license included) rewrites object streams and selectively recompresses supported embedded images using browser JPEG encoding. Gentle/Balanced/Strong use quality 0.90/0.72/0.55 and longest dimensions 3000/1800/1200 px. Page streams, text, vectors, and field values are preserved; image quality is lossy. This is an independent implementation, not Smallpdf's proprietary engine, and compression ratios depend on the PDF.

Unsupported color spaces, custom decoding, transparency masks, and unsupported image filters are preserved. Per-image decoding is bounded to 16 megapixels. Password-protected and signature-bearing PDFs receive a clear error. If rewriting increases file size, the original is returned byte-for-byte and the UI says so. Browser image support varies; images that cannot be safely processed are preserved.

## Validation

Run a local Next server, or serve `public/` as a static directory, then:

```sh
PDF_COMPRESS_BASE_URL=http://127.0.0.1:3058 node --test tests/ui/compress-pdf.test.cjs tests/ui/compress-pdf-worker.test.cjs
```

The test generates synthetic image-heavy and text PDFs, checks all levels, unchanged page streams, page dimensions and form values, renders original/result with PDF.js, compares extracted text, exercises real UI selection, drop, download, cancellation, invalid input, signature handling, original fallback, and mobile overflow. Optional `PDF_COMPRESS_TEST_OUTPUT` saves visual QA screenshots and a synthetic compressed PDF.

Before declaring production complete, verify the intended domain, the exact `/compress-pdf` route, all four scripts/styles including the worker's vendored library, and upload/compress/download in the deployed browser. A static preview is not production deployment. Preserve unrelated dirty source changes and the existing Netlify functions, schedules, edge configuration, and assets when deploying.
