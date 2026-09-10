import { formatEquityContentForPdf } from './equityDocumentFormatting';

export interface PreparedDocumentSigner {
  name: string;
  email: string;
  role: string;
  stakeholderId?: string;
}

export const isStrategicDocument = (documentType?: string) =>
  Boolean(documentType?.startsWith('strategic_'));

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] as string));

// Each signing request records one person's assent. Other company signatures
// must come from their own requests and must never be inferred from this one.
export const renderStrategicSigningHtml = (input: {
  title: string;
  content: string;
  recipientName: string;
  recipientEmail: string;
  signerRole?: string;
  signedName?: string;
  signedAt?: string;
}) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title>
<style>
@page { size: letter; margin: 0.75in; }
body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; max-width: 7in; margin: 0 auto; padding: 24px; }
h1,h2,h3,h4 { color: #111; break-after: avoid; }
h1 { font-size: 17pt; } h2 { font-size: 14pt; } h3,h4 { font-size: 12pt; }
p,li { orphans: 2; widows: 2; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; }
td,th { border: 1px solid #ccc; padding: 6px; overflow-wrap: anywhere; }
tr { break-inside: avoid; } th { background: #eee; }
.signature-record { break-inside: avoid; border-top: 1px solid #ccc; margin-top: 32px; padding-top: 16px; }
@media print { body { padding: 0; } }
</style></head><body>
<main>${formatEquityContentForPdf(input.content)}</main>
<section class="signature-record">
<h2>${input.signedName ? 'Electronic signature record' : 'Prepared signature request'}</h2>
<p>Name: ${escapeHtml(input.signedName || input.recipientName)}</p>
<p>Capacity: ${escapeHtml(input.signerRole || 'Authorized signatory')}</p>
<p>Email: ${escapeHtml(input.recipientEmail)}</p>
${input.signedName ? `<p>Signed: ${escapeHtml(input.signedAt || '')}</p>` : '<p>Awaiting signature.</p>'}
</section></body></html>`;
