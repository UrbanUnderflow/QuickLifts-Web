import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Timestamp } from 'firebase/firestore';
import { Download, Loader2, FileText, AlertCircle } from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  createdAt: Timestamp | Date;
}

// Utility function to format Firestore Timestamps or Dates
const formatDate = (date: Timestamp | Date | undefined): string => {
  if (!date) return 'N/A';
  let dateObject: Date;
  if (date instanceof Timestamp) {
    dateObject = date.toDate();
  } else if (date instanceof Date) {
    dateObject = date;
  } else {
    return 'Invalid Date';
  }
  return dateObject.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Format content for PDF display (convert markdown-like syntax to HTML)
const formatContentForPdf = (content: string): string => {
  return content
    // Convert **bold** to <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Convert headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Convert numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Convert bullet points
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive list items in <ol> or <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Convert double newlines to paragraphs
    .split('\n\n')
    .map(para => {
      if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
};

// Generate PDF from document content
const generatePdf = (document: LegalDocument) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title} - Pulse Intelligence Labs</title>
        <style>
          @page {
            margin: 1in;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #111;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 40px;
          }
          h1 {
            font-size: 18pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 24px;
            text-transform: uppercase;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
          }
          h2 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          h3 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 18px;
            margin-bottom: 8px;
          }
          p {
            margin-bottom: 12px;
            text-align: justify;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .document-date {
            font-size: 10pt;
            color: #666;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          .signature-block {
            margin-top: 60px;
            page-break-inside: avoid;
          }
          .signature-line {
            border-bottom: 1px solid #333;
            width: 250px;
            margin: 40px 0 8px 0;
          }
          .signature-label {
            font-size: 10pt;
            color: #666;
          }
          ul, ol {
            margin: 12px 0;
            padding-left: 24px;
          }
          li {
            margin-bottom: 8px;
          }
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 9pt;
            color: #666;
            text-align: center;
          }
          .confidential {
            font-size: 9pt;
            color: #999;
            text-align: center;
            margin-top: 20px;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
          <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
        </div>
        
        <h1>${document.title}</h1>
        
        <div class="content">
          ${formatContentForPdf(document.content)}
        </div>
        
        <div class="signature-block">
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
            <div style="width: 45%;">
              <div class="signature-line"></div>
              <div class="signature-label">Signature</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Printed Name</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Date</div>
            </div>
            <div style="width: 45%;">
              <div class="signature-line"></div>
              <div class="signature-label">Signature</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Printed Name</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Date</div>
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
        
        <div class="confidential">
          CONFIDENTIAL - This document contains proprietary information.
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

const LegalDocumentSharePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!id || typeof id !== 'string') return;

      try {
        setLoading(true);
        const docRef = doc(db, 'legal-documents', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('Document not found');
          setLoading(false);
          return;
        }

        const data = docSnap.data();
        setDocument({
          id: docSnap.id,
          ...data
        } as LegalDocument);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111417] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#d7ff00]" />
          <p className="text-zinc-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-[#111417] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h1 className="text-xl font-semibold">Document Not Found</h1>
          <p className="text-zinc-400">{error || 'The document you are looking for does not exist or has been removed.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{document.title} | Pulse Intelligence Labs</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#d7ff00]/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#d7ff00]" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{document.title}</h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Created: {formatDate(document.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => generatePdf(document)}
                className="flex items-center gap-2 px-6 py-3 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-xl font-semibold transition-colors"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 p-8">
            <div className="prose prose-invert prose-lg max-w-none">
              <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {document.content}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-zinc-500 text-sm">
            <p>© {new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
            <p className="mt-1">This document contains proprietary information.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LegalDocumentSharePage;
