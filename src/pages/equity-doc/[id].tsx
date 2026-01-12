import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Download, Loader2, FileText, AlertCircle } from 'lucide-react';

interface EquityDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  createdAt: Timestamp | Date;
  requiresSignature?: boolean;
  signingRequestId?: string;
}

const formatDate = (date: Timestamp | Date | undefined): string => {
  if (!date) return 'N/A';
  const d = date instanceof Timestamp ? date.toDate() : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Improved content formatter that properly handles markdown
const formatContentForPdf = (content: string): string => {
  // Normalize line endings
  let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Convert **bold** to <strong>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert *italic* to <em>
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert headers (must be done before other processing)
  result = result.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  result = result.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  result = result.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  result = result.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  
  // Convert horizontal rules
  result = result.replace(/^---+$/gm, '<hr>');
  
  // Process the content line by line for better list handling
  const lines = result.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines but close lists
    if (!trimmedLine) {
      if (inList) {
        processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      processedLines.push('');
      continue;
    }
    
    // Check for bullet points (-, •, *)
    const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        processedLines.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      processedLines.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }
    
    // Check for numbered lists (1., 2., a., b., i., ii., etc.)
    const numberedMatch = trimmedLine.match(/^([0-9]+|[a-z]|[ivxlc]+)\.\s+(.+)$/i);
    if (numberedMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        processedLines.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      processedLines.push(`<li>${numberedMatch[2]}</li>`);
      continue;
    }
    
    // Close list if we hit non-list content
    if (inList) {
      processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }
    
    // Pass through headers and hr unchanged
    if (trimmedLine.startsWith('<h') || trimmedLine === '<hr>') {
      processedLines.push(trimmedLine);
      continue;
    }
    
    // Regular text becomes a paragraph
    processedLines.push(`<p>${trimmedLine}</p>`);
  }
  
  // Close any open list
  if (inList) {
    processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
  }
  
  // Join and clean up
  result = processedLines.join('\n');
  
  // Remove empty paragraphs
  result = result.replace(/<p><\/p>/g, '');
  
  // Merge consecutive empty lines
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result;
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
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 9pt; color: #666; text-align: center; }
          .confidential { font-size: 9pt; color: #999; text-align: center; margin-top: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
          <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
        </div>
        <h1>${document.title}</h1>
        <div class="content">${formatContentForPdf(document.content)}</div>
        <div class="footer"><p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p></div>
        <div class="confidential">CONFIDENTIAL - This document contains proprietary information.</div>
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
  const { id } = router.query;
  const [document, setDocument] = useState<EquityDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!id || typeof id !== 'string') return;
      try {
        setLoading(true);
        const docRef = doc(db, 'equity-documents', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError('Document not found');
          return;
        }
        const data = docSnap.data();
        setDocument({ id: docSnap.id, ...(data as any) } as EquityDocument);
      } catch (err) {
        console.error('Error fetching document:', err);
        setError('Failed to load document');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [id]);

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
                  {document.requiresSignature && document.signingRequestId && (
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

