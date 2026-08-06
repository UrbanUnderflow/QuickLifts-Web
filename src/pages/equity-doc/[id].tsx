import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth, db, getFirebaseModeRequestHeaders } from '../../api/firebase/config';
import { Download, Loader2, FileText, AlertCircle } from 'lucide-react';
import { formatEquityContentForPdf } from '../../lib/equityDocumentFormatting';

interface EquityDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  createdAt: Timestamp | Date | string;
  requiresSignature?: boolean;
  signingRequestId?: string;
  needsResendSignature?: boolean;
  autoSigned?: boolean;
}

const AUTO_EXECUTED_DOC_TYPES = ['board_consent', 'stockholder_consent', 'eip'];

const isAutoExecutedCompanyDoc = (document?: Pick<EquityDocument, 'documentType'> | null) =>
  Boolean(document?.documentType && AUTO_EXECUTED_DOC_TYPES.includes(document.documentType));

const formatDate = (date: Timestamp | Date | string | undefined): string => {
  if (!date) return 'N/A';
  const d = date instanceof Timestamp ? date.toDate() : date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Note: Signature lines are controlled by the AI-generated document content itself (based on requiresSignature flag during generation)
const generatePdf = (document: EquityDocument) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title} - Pulse Intelligence Labs</title>
        <style>
          @page { margin: 1in; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #111; max-width: 8.5in; margin: 0 auto; padding: 40px; }
          h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 24px; text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 12px; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 24px; margin-bottom: 12px; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; }
          h4 { font-size: 12pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; }
          p { margin-bottom: 12px; text-align: justify; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
          .document-date { font-size: 10pt; color: #666; margin-bottom: 20px; }
          ul, ol { margin: 12px 0; padding-left: 24px; }
          ul { list-style-type: disc; }
          ol { list-style-type: decimal; }
          li { margin-bottom: 8px; }
          hr { border: none; border-top: 1px solid #999; margin: 20px 0; }
          strong { font-weight: bold; }
          em { font-style: italic; }
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; text-align: center; break-inside: avoid; page-break-inside: avoid; }
          .footer p { margin: 0 0 6px 0; text-align: center; }
          .footer .confidential { color: #999; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
          <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
        </div>
        <h1>${document.title}</h1>
        <div class="content">${formatEquityContentForPdf(document.content)}</div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
          <p class="confidential">CONFIDENTIAL - This document contains proprietary information.</p>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }
};

const EquityDocSharePage: React.FC = () => {
  const router = useRouter();
  const { id, requestId } = router.query;
  const [document, setDocument] = useState<EquityDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!router.isReady || !id || typeof id !== 'string') return;
      try {
        setLoading(true);
        setError(null);

        const scopedRequestId = typeof requestId === 'string' ? requestId : null;
        if (scopedRequestId) {
          const query = new URLSearchParams({ documentId: id, requestId: scopedRequestId });
          const response = await fetch(`/.netlify/functions/get-equity-document-preview?${query.toString()}`, {
            headers: getFirebaseModeRequestHeaders(),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result?.success || !result?.document) {
            throw new Error(result?.error || 'This document preview link is unavailable.');
          }
          setDocument(result.document as EquityDocument);
          return;
        }

        // Equity records are intentionally admin-only. Wait until Firebase has
        // restored the signed-in user in this new tab before attempting the read.
        await auth.authStateReady();
        if (!auth.currentUser) {
          throw new Error('Sign in with an admin account to preview this equity document.');
        }
        await auth.currentUser.getIdToken();

        const documentRef = doc(db, 'equity-documents', id);
        const documentSnapshot = await getDoc(documentRef);
        if (!documentSnapshot.exists()) {
          throw new Error('Document not found.');
        }
        const data = documentSnapshot.data();
        setDocument({ id: documentSnapshot.id, ...(data as any) } as EquityDocument);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [id, requestId, router.isReady]);

  return (
    <>
      <Head>
        <title>{document ? document.title : 'Equity Document'} | Pulse</title>
      </Head>
      <div className="min-h-screen bg-[#0a0a0b] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#E0FE10]" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl border border-red-800 bg-red-900/20 text-red-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          ) : document ? (
            <div className="bg-[#1a1e24] rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="p-6 border-b border-zinc-800 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-[#E0FE10]" />
                    <h1 className="text-xl font-semibold">{document.title}</h1>
                  </div>
                  <p className="text-zinc-500 text-sm">Created: {formatDate(document.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {document.requiresSignature && !isAutoExecutedCompanyDoc(document) && document.signingRequestId && (
                    <button
                      onClick={() => window.open(`/sign/${document.signingRequestId}`, '_blank')}
                      className="px-4 py-2 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-500 transition-colors"
                    >
                      Sign
                    </button>
                  )}
                  <button
                    onClick={() => generatePdf(document)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E0FE10] text-black font-medium hover:bg-[#d4f00f] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="whitespace-pre-wrap text-zinc-200 text-sm leading-relaxed">
                  {document.content}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default EquityDocSharePage;
