/** Keep source files and the reviewed signing text together. Signature evidence is never imported. */
export function isEquityDocumentLocked(document: any): boolean {
  return Boolean(document && (document.signingRequestId || document.signingRequestIds?.length || document.signedAt
    || document.autoSigned || document.autoSignedAt || document.signatureData || document.approvalStatus === 'approved'));
}

export async function extractEquityUpload(file: File): Promise<{content: string; text: string; dataUrl: string; pageCount: number}> {
  if (!/\.(pdf|txt|html?)$/i.test(file.name) || file.size > 500 * 1024) throw new Error('Choose a PDF, HTML, or text document up to 500 KB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The source file could not be read.'));
    reader.readAsDataURL(file);
  });
  let pages: string[];
  if (/\.pdf$/i.test(file.name)) {
    // Bundled locally so private documents never leave the browser for extraction.
    const moduleUrl = '/vendor/pdfjs-5.6.205/pdf.min.mjs';
    const pdfjs = await import(/* webpackIgnore: true */ moduleUrl);
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs-5.6.205/pdf.worker.min.mjs';
    const pdf = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false}).promise;
    try {
      if (pdf.numPages > 40) throw new Error('Upload a document with 40 pages or fewer.');
      pages = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const text = await page.getTextContent();
        const lines: string[] = [];
        let line = '';
        for (const item of text.items) {
          if (!('str' in item)) continue;
          line += `${line && !/\s$/.test(line) ? ' ' : ''}${item.str}`;
          if (item.hasEOL) {lines.push(line.trimEnd()); line = '';}
        }
        if (line) lines.push(line.trimEnd());
        const pageText = lines.join('\n').trim();
        if (!pageText) throw new Error(`Page ${number} has no readable text. Upload a text-based PDF so every page can be included for signing.`);
        pages.push(pageText);
      }
    } finally {await pdf.destroy();}
  } else {
    const source = await file.text();
    if (/\.html?$/i.test(file.name)) {
      const parsed = new DOMParser().parseFromString(source, 'text/html');
      parsed.querySelectorAll('script,style,noscript').forEach(node => node.remove());
      parsed.querySelectorAll('br').forEach(node => node.replaceWith('\n'));
      parsed.querySelectorAll('p,div,h1,h2,h3,h4,tr,li,section').forEach(node => node.append('\n'));
      pages = [parsed.body.textContent?.trim() || ''];
    } else pages = [source.trim()];
  }
  if (!pages.some(text => text.trim())) throw new Error('The document does not contain readable text.');
  const text = pages.join('\n\n');
  if (new TextEncoder().encode(text).byteLength > 150000) throw new Error('The document text is too large for this signing package.');
  return {content: text, text, dataUrl, pageCount: pages.length};
}
