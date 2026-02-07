import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Download, Loader2, FileText, AlertCircle, StickyNote, X, Trash2, ArrowDown } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

interface LegalDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  createdAt: Timestamp | Date;
  requiresSignature?: boolean;
}

type NoteColorKey = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';

const NOTE_COLORS: { key: NoteColorKey; bg: string; icon: string; tooltipBg: string; tooltipText: string }[] = [
  { key: 'yellow', bg: 'bg-yellow-400', icon: 'text-yellow-800', tooltipBg: 'bg-yellow-100', tooltipText: 'text-yellow-900' },
  { key: 'pink', bg: 'bg-pink-400', icon: 'text-pink-800', tooltipBg: 'bg-pink-100', tooltipText: 'text-pink-900' },
  { key: 'blue', bg: 'bg-blue-400', icon: 'text-blue-800', tooltipBg: 'bg-blue-100', tooltipText: 'text-blue-900' },
  { key: 'green', bg: 'bg-green-400', icon: 'text-green-800', tooltipBg: 'bg-green-100', tooltipText: 'text-green-900' },
  { key: 'purple', bg: 'bg-purple-400', icon: 'text-purple-800', tooltipBg: 'bg-purple-100', tooltipText: 'text-purple-900' },
];

const getNoteColorStyles = (colorKey: NoteColorKey | undefined) => {
  const row = NOTE_COLORS.find((c) => c.key === (colorKey || 'yellow')) ?? NOTE_COLORS[0];
  return row;
};

interface DocumentNote {
  id: string;
  documentId: string;
  authorName: string;
  content: string;
  xPercent: number; // Position as percentage of container width
  yOffset: number; // Position as pixels from top of content
  createdAt: Timestamp | Date;
  authorKey?: string; // Local key to identify the author for deletion
  color?: NoteColorKey; // Sticky note color
}

// Get or generate a unique author key stored in localStorage
const getAuthorKey = (): string => {
  if (typeof window === 'undefined') return '';
  const STORAGE_KEY = 'document-notes-author-key';
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = `author_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
};

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

// Check if document is a project/planning type (not legal)
const isProjectDocument = (docType: string): boolean => {
  return ['custom', 'proposal', 'system-design'].includes(docType);
};

// Get export format based on document type
const getExportFormat = (docType: string): 'pdf' | 'xlsx' | 'docx' => {
  if (docType === 'spreadsheet') return 'xlsx';
  if (docType === 'word-doc') return 'docx';
  return 'pdf';
};

// Export document as Word-compatible format (.rtf - Rich Text Format)
// RTF is universally compatible with Word, Pages, LibreOffice, etc.
const exportAsDocx = (document: LegalDocument & { id: string }) => {
  const lines = document.content.split('\n');
  let rtfContent = '';

  // RTF Header
  rtfContent += '{\\rtf1\\ansi\\deff0';
  rtfContent += '{\\fonttbl{\\f0\\fswiss\\fcharset0 Calibri;}{\\f1\\fswiss\\fcharset0 Arial;}}';
  rtfContent += '{\\colortbl;\\red0\\green0\\blue0;}';
  rtfContent += '\\viewkind4\\uc1\\pard\\f0\\fs22 ';

  // Document Title
  rtfContent += '\\pard\\qc\\b\\fs36 ' + escapeRtf(document.title) + '\\b0\\par\\par';
  rtfContent += '\\pard\\ql\\fs22 ';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      rtfContent += '\\par ';
      continue;
    }

    // Headers (## or ### or ####)
    if (trimmedLine.startsWith('## ')) {
      const headerText = trimmedLine.replace(/^##\s*/, '');
      rtfContent += '\\par\\b\\fs28 ' + escapeRtf(headerText) + '\\b0\\fs22\\par ';
      continue;
    }
    if (trimmedLine.startsWith('### ')) {
      const headerText = trimmedLine.replace(/^###\s*/, '');
      rtfContent += '\\par\\b\\fs24 ' + escapeRtf(headerText) + '\\b0\\fs22\\par ';
      continue;
    }
    if (trimmedLine.startsWith('#### ')) {
      const headerText = trimmedLine.replace(/^####\s*/, '');
      rtfContent += '\\par\\b\\fs22 ' + escapeRtf(headerText) + '\\b0\\par ';
      continue;
    }

    // Bullet points
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
      const bulletText = trimmedLine.replace(/^[-•*]\s*/, '');
      rtfContent += '\\pard\\li720\\fi-360\\bullet  ' + formatRtfText(bulletText) + '\\par ';
      rtfContent += '\\pard\\ql ';
      continue;
    }

    // Horizontal rule
    if (trimmedLine === '---' || trimmedLine === '***') {
      rtfContent += '\\par\\pard\\brdrb\\brdrs\\brdrw10\\brsp20 \\par\\pard\\ql ';
      continue;
    }

    // Regular paragraph with inline formatting
    rtfContent += formatRtfText(trimmedLine) + '\\par ';
  }

  // RTF Footer
  rtfContent += '}';

  const blob = new Blob([rtfContent], { type: 'application/rtf' });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `${document.title.replace(/[^a-zA-Z0-9]/g, '_')}.rtf`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper function to escape RTF special characters (for plain text only)
const escapeRtf = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
};

// Helper function to format inline RTF text (bold, italic)
// This escapes text first, then applies RTF formatting
const formatRtfText = (text: string): string => {
  // First escape any special characters in the raw text
  let result = escapeRtf(text);

  // Bold: **text** -> \b text\b0
  result = result.replace(/\*\*([^*]+)\*\*/g, '\\b $1\\b0 ');
  // Italic: *text* -> \i text\i0
  result = result.replace(/\*([^*]+)\*/g, '\\i $1\\i0 ');

  return result;
};

// Export document as Excel (.xlsx) format - creates CSV that Excel can open
const exportAsXlsx = (document: LegalDocument & { id: string }) => {
  // Parse markdown tables from content
  const content = document.content;
  const lines = content.split('\n');
  const csvRows: string[] = [];

  // Add document title as first row
  csvRows.push(`"${document.title}"`);
  csvRows.push('');

  let inTable = false;
  let isHeaderSeparator = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this is a markdown table row (contains |)
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      inTable = true;

      // Skip header separator rows (|---|---|)
      if (/^\|[\s\-:]+\|/.test(trimmedLine) && trimmedLine.includes('---')) {
        isHeaderSeparator = true;
        continue;
      }

      // Extract cells from table row
      const cells = trimmedLine
        .slice(1, -1) // Remove leading and trailing |
        .split('|')
        .map(cell => `"${cell.trim().replace(/"/g, '""')}"`);

      csvRows.push(cells.join(','));
    } else if (inTable && !trimmedLine) {
      // Empty line ends table
      inTable = false;
      csvRows.push('');
    } else if (!inTable && trimmedLine) {
      // Non-table content - add as single cell
      if (trimmedLine.startsWith('##')) {
        // Section header
        csvRows.push('');
        csvRows.push(`"${trimmedLine.replace(/^#+\s*/, '')}"`);
      } else if (!trimmedLine.startsWith('|')) {
        // Regular text - wrap in quotes
        csvRows.push(`"${trimmedLine.replace(/"/g, '""')}"`);
      }
    }
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `${document.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Data → Decisions Delivery Loop Flowchart Component
const DataDeliveryLoopFlowchart: React.FC = () => {
  const steps = [
    {
      number: 1,
      title: 'Data Integration Layer',
      desc: 'Connectors & APIs for enterprise data sources (ERP, schedules, program systems)',
      color: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      iconBg: 'bg-blue-500'
    },
    {
      number: 2,
      title: 'ETL Pipeline Engine',
      desc: 'Automated ingestion, validation rules, transformation & lineage tracking',
      color: 'from-purple-500/20 to-purple-600/10',
      borderColor: 'border-purple-500/30',
      iconBg: 'bg-purple-500'
    },
    {
      number: 3,
      title: 'Unified Data Repository',
      desc: 'Normalized data warehouse with canonical schemas & version control',
      color: 'from-cyan-500/20 to-cyan-600/10',
      borderColor: 'border-cyan-500/30',
      iconBg: 'bg-cyan-500'
    },
    {
      number: 4,
      title: 'Analytics Engine',
      desc: 'Computed KPIs, trend models, forecasting algorithms & risk scoring',
      color: 'from-amber-500/20 to-amber-600/10',
      borderColor: 'border-amber-500/30',
      iconBg: 'bg-amber-500'
    },
    {
      number: 5,
      title: 'Visualization Layer',
      desc: 'Dashboard UI, report generation & decision-support interfaces',
      color: 'from-emerald-500/20 to-emerald-600/10',
      borderColor: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500'
    },
    {
      number: 6,
      title: 'Configuration & Tuning Interface',
      desc: 'Admin portal for pipeline adjustments, model parameters & feedback ingestion',
      color: 'from-rose-500/20 to-rose-600/10',
      borderColor: 'border-rose-500/30',
      iconBg: 'bg-rose-500'
    }
  ];

  return (
    <div className="my-8 p-6 rounded-2xl bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 border border-zinc-700/50">
      <h3 className="text-xl font-bold text-[#d7ff00] mb-6 text-center">
        TECHNICAL SYSTEM ARCHITECTURE
        <span className="block text-sm font-normal text-zinc-400 mt-1">Data-to-Decision Platform Layers</span>
      </h3>

      <div className="flex flex-col items-center gap-2">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Step Card */}
            <div
              className={`w-full max-w-md p-4 rounded-xl bg-gradient-to-r ${step.color} border ${step.borderColor} backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
            >
              <div className="flex items-start gap-3">
                {/* Step Number */}
                <div className={`flex-shrink-0 w-8 h-8 ${step.iconBg} rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                  {step.number}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm mb-1">{step.title}</h4>
                  <p className="text-xs text-zinc-300">{step.desc}</p>
                </div>
              </div>
            </div>

            {/* Connector Arrow */}
            {index < steps.length - 1 && (
              <div className="flex flex-col items-center py-1">
                <div className="w-0.5 h-3 bg-gradient-to-b from-zinc-500 to-zinc-600"></div>
                <ArrowDown className="w-4 h-4 text-zinc-500" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Feedback Loop Indicator */}
      <div className="mt-6 pt-4 border-t border-zinc-700/50">
        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
          <div className="w-8 h-0.5 bg-gradient-to-r from-transparent to-zinc-500"></div>
          <span className="text-center">↻ Feedback loop: Configuration interface enables runtime adjustments to pipelines & models</span>
          <div className="w-8 h-0.5 bg-gradient-to-l from-transparent to-zinc-500"></div>
        </div>
      </div>
    </div>
  );
};

// Improved content formatter that properly handles markdown
const formatContentForPdf = (content: string): string => {
  // Normalize line endings
  let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Handle code blocks first (triple backticks) - preserve them as-is
  const codeBlocks: string[] = [];
  result = result.replace(/```([\s\S]*?)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    // Escape HTML in code blocks and wrap in pre/code
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    codeBlocks.push(`<pre class="code-block"><code>${escapedCode}</code></pre>`);
    return placeholder;
  });

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

    // Check if this is a code block placeholder - pass through unchanged
    if (trimmedLine.match(/^__CODE_BLOCK_\d+__$/)) {
      if (inList) {
        processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
        listType = null;
      }
      processedLines.push(trimmedLine);
      continue;
    }

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

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    result = result.replace(`__CODE_BLOCK_${index}__`, block);
    // Also handle if it got wrapped in a paragraph
    result = result.replace(`<p>__CODE_BLOCK_${index}__</p>`, block);
  });

  // Remove empty paragraphs
  result = result.replace(/<p><\/p>/g, '');

  // Merge consecutive empty lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
};

// Generate flowchart HTML for PDF (technical system architecture)
const generateFlowchartHtmlForPdf = (): string => {
  const steps = [
    { number: 1, title: 'Data Integration Layer', desc: 'Connectors & APIs for enterprise data sources (ERP, schedules, program systems)' },
    { number: 2, title: 'ETL Pipeline Engine', desc: 'Automated ingestion, validation rules, transformation & lineage tracking' },
    { number: 3, title: 'Unified Data Repository', desc: 'Normalized data warehouse with canonical schemas & version control' },
    { number: 4, title: 'Analytics Engine', desc: 'Computed KPIs, trend models, forecasting algorithms & risk scoring' },
    { number: 5, title: 'Visualization Layer', desc: 'Dashboard UI, report generation & decision-support interfaces' },
    { number: 6, title: 'Configuration & Tuning Interface', desc: 'Admin portal for pipeline adjustments, model parameters & feedback ingestion' }
  ];

  let html = `
    <div style="margin: 16px 0; padding: 16px; border: 1px solid #333; page-break-inside: avoid;">
      <h3 style="text-align: center; font-size: 11pt; font-weight: 700; margin: 0 0 14px 0; color: #000; border-bottom: 1px solid #333; padding-bottom: 8px;">
        TECHNICAL SYSTEM ARCHITECTURE<br>
        <span style="font-size: 9pt; font-weight: 400; color: #555;">Data-to-Decision Platform Layers</span>
      </h3>
  `;

  steps.forEach((step, index) => {
    // Step box
    html += `
      <div style="max-width: 400px; margin: 0 auto; padding: 8px 12px; border: 1px solid #333; background: #fff;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="flex-shrink: 0; width: 20px; height: 20px; background: #333; border-radius: 50%; color: white; font-weight: 700; font-size: 9px; display: flex; align-items: center; justify-content: center;">${step.number}</div>
          <div>
            <span style="font-weight: 700; font-size: 9pt; color: #000;">${step.title}</span><br>
            <span style="font-size: 7pt; color: #555;">${step.desc}</span>
          </div>
        </div>
      </div>
    `;

    // Down arrow between steps
    if (index < steps.length - 1) {
      html += `
        <div style="text-align: center; line-height: 1; padding: 2px 0;">
          <span style="font-size: 14pt; color: #333;">↓</span>
        </div>
      `;
    }
  });

  html += `
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; text-align: center; font-size: 7pt; color: #555; font-style: italic;">
        ↻ Feedback loop: Configuration interface enables runtime adjustments to pipelines & models
      </div>
    </div>
  `;

  return html;
};

// Process content for PDF - inserts flowchart after section 3.4 intro, before Enterprise Data Sources
const processContentForPdf = (content: string, documentId: string): string => {
  const flowchartDocId = '1ONnSZeUQqlnfABWSMG3';

  if (documentId === flowchartDocId) {
    // Clean up any old ASCII art remnants first
    let cleanedContent = content
      .replace(/DATA\s*→?\s*DECISIONS\s*DELIVERY\s*LOOP[\s\S]*?(?:model\s*tuning|└─+┴─+┘|↻[^\n]*)/gi, '')
      .replace(/┌[─┐│┘└┴┬├┤┼]+/g, '')
      .replace(/[│┐│┘└┴┬├┤┼]+/g, '')
      .replace(/\n{3,}/g, '\n\n');

    // Look for "Enterprise Data Sources" subsection and insert chart BEFORE it
    // This places the chart after the 3.4 section intro and before the detailed subsections
    const enterprisePattern = /(Enterprise Data Sources)/i;
    const enterpriseMatch = cleanedContent.match(enterprisePattern);

    if (enterpriseMatch) {
      const insertIndex = cleanedContent.indexOf(enterpriseMatch[0]);
      const beforeChart = cleanedContent.substring(0, insertIndex);
      // Skip past "Enterprise Data Sources" text to get the rest
      const afterEnterprise = cleanedContent.substring(insertIndex + enterpriseMatch[0].length);

      return formatContentForPdf(beforeChart) + generateFlowchartHtmlForPdf() + '<h4>Enterprise Data Sources</h4>' + formatContentForPdf(afterEnterprise);
    }

    // Fallback: append chart at the end
    return formatContentForPdf(cleanedContent) + generateFlowchartHtmlForPdf();
  }

  return formatContentForPdf(content);
};

// Generate PDF from document content
const generatePdf = (document: LegalDocument & { id: string }) => {
  const includeSignature = Boolean(document.requiresSignature);
  const isProject = isProjectDocument(document.documentType);

  // Use different styling based on document type
  const html = isProject
    ? generateProjectStylePdf(document, includeSignature)
    : generateLegalStylePdf(document, includeSignature);

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

// Project/Planning style PDF (modern, readable)
const generateProjectStylePdf = (document: LegalDocument, includeSignature: boolean): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title} - Pulse Intelligence Labs</title>
        <style>
          @page {
            margin: 0.75in 1in;
            /* Hide browser headers and footers */
            margin-top: 0.5in;
            margin-bottom: 0.5in;
          }
          @media print {
            /* Hide URL and date in print */
            @page {
              margin: 0.75in 1in 0.5in 1in;
            }
            html, body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.7;
            color: #1a1a1a;
            max-width: 8.5in;
            margin: 0 auto;
            padding: 40px;
          }
          h1 {
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 8px;
            color: #111;
            border-bottom: 3px solid #333;
            padding-bottom: 12px;
          }
          h2 {
            font-size: 16pt;
            font-weight: 600;
            margin-top: 28px;
            margin-bottom: 12px;
            color: #222;
            border-bottom: 1px solid #ddd;
            padding-bottom: 6px;
          }
          h3 {
            font-size: 13pt;
            font-weight: 600;
            margin-top: 20px;
            margin-bottom: 8px;
            color: #333;
          }
          h4 {
            font-size: 11pt;
            font-weight: 600;
            margin-top: 16px;
            margin-bottom: 6px;
            color: #444;
          }
          p {
            margin-bottom: 12px;
            text-align: left;
          }
          .header {
            margin-bottom: 30px;
            border-bottom: 1px solid #eee;
            padding-bottom: 16px;
          }
          .company-name {
            font-size: 11pt;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .document-date {
            font-size: 10pt;
            color: #888;
          }
          .content {
            margin-top: 20px;
          }
          ul, ol {
            margin: 12px 0;
            padding-left: 28px;
          }
          ul {
            list-style-type: disc;
          }
          ol {
            list-style-type: decimal;
          }
          li {
            margin-bottom: 8px;
            line-height: 1.6;
          }
          li > ul, li > ol {
            margin-top: 8px;
            margin-bottom: 8px;
          }
          hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 24px 0;
          }
          strong {
            font-weight: 600;
            color: #111;
          }
          em {
            font-style: italic;
          }
          pre, .code-block {
            background: #f5f5f5;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            overflow-x: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
            font-size: 11px;
            line-height: 1.4;
            white-space: pre;
          }
          pre code, .code-block code {
            background: none;
            padding: 0;
            font-family: inherit;
            font-size: inherit;
          }
          .signature-block {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
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
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 9pt;
            color: #888;
            text-align: center;
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
          <div class="company-name">Pulse Intelligence Labs, Inc.</div>
          <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
        </div>
        
        <h1>${document.title}</h1>
        
        <div class="content">
          ${processContentForPdf(document.content, document.id)}
        </div>
      
      ${includeSignature ? `
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
      ` : ''}
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;
};

// Legal style PDF (formal, contract-style)
const generateLegalStylePdf = (document: LegalDocument, includeSignature: boolean): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${document.title} - Pulse Intelligence Labs</title>
        <style>
          @page {
            margin: 1in;
            /* Hide browser headers and footers */
            margin-top: 0.75in;
            margin-bottom: 0.5in;
          }
          @media print {
            /* Hide URL and date in print */
            @page {
              margin: 1in 1in 0.5in 1in;
            }
            html, body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
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
          h4 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 14px;
            margin-bottom: 6px;
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
          hr {
            border: none;
            border-top: 1px solid #999;
            margin: 20px 0;
          }
          pre, .code-block {
            background: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 16px;
            margin: 16px 0;
            overflow-x: auto;
            font-family: 'Courier New', Courier, monospace;
            font-size: 10px;
            line-height: 1.3;
            white-space: pre;
          }
          pre code, .code-block code {
            background: none;
            padding: 0;
            font-family: inherit;
            font-size: inherit;
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
          ${processContentForPdf(document.content, document.id)}
        </div>
        
        ${includeSignature ? `
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
        ` : ''}
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
        
        <div class="confidential">
          CONFIDENTIAL - This document contains proprietary information.
        </div>
      </body>
    </html>
  `;
};

const LegalDocumentSharePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is admin
  const currentUserDict = useSelector((state: RootState) => state.user.currentUser);
  const isAdmin = currentUserDict?.role === 'admin';

  // Notes state
  const [notes, setNotes] = useState<DocumentNote[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteFormPosition, setNoteFormPosition] = useState({ x: 0, y: 0, xPercent: 0, yOffset: 0 });
  const [newNoteName, setNewNoteName] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState<NoteColorKey>('yellow');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
  const [localAuthorKey, setLocalAuthorKey] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);
  const hideNoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HIDE_NOTE_DELAY_MS = 2500;

  const scheduleHideNote = (noteId: string) => {
    if (hideNoteTimeoutRef.current) clearTimeout(hideNoteTimeoutRef.current);
    hideNoteTimeoutRef.current = setTimeout(() => {
      setHoveredNoteId((current) => (current === noteId ? null : current));
      hideNoteTimeoutRef.current = null;
    }, HIDE_NOTE_DELAY_MS);
  };

  const cancelHideNote = () => {
    if (hideNoteTimeoutRef.current) {
      clearTimeout(hideNoteTimeoutRef.current);
      hideNoteTimeoutRef.current = null;
    }
  };

  // Get the local author key on mount
  useEffect(() => {
    setLocalAuthorKey(getAuthorKey());
  }, []);

  // Clear hide-note timeout on unmount
  useEffect(() => {
    return () => {
      if (hideNoteTimeoutRef.current) clearTimeout(hideNoteTimeoutRef.current);
    };
  }, []);

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

  // Subscribe to notes for this document
  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    console.log('[DocumentNotes] Setting up subscription for document:', id);

    // Query without orderBy to avoid composite index requirement
    // We'll sort client-side instead
    const notesQuery = query(
      collection(db, 'document-notes'),
      where('documentId', '==', id)
    );

    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      console.log('[DocumentNotes] Received snapshot with', snapshot.docs.length, 'notes');
      const notesData: DocumentNote[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('[DocumentNotes] Note data:', { id: doc.id, xPercent: data.xPercent, yOffset: data.yOffset });
        notesData.push({ id: doc.id, ...data } as DocumentNote);
      });
      // Sort client-side by createdAt
      notesData.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return aTime - bTime;
      });
      setNotes(notesData);
    }, (err) => {
      console.error('[DocumentNotes] Error fetching notes:', err);
    });

    return () => unsubscribe();
  }, [id]);

  // Handle double-click to add note
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!contentRef.current) return;

    const rect = contentRef.current.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yOffset = e.clientY - rect.top + contentRef.current.scrollTop;

    setNoteFormPosition({ x, y, xPercent, yOffset });
    setShowNoteForm(true);
    setNewNoteName('');
    setNewNoteContent('');
    setNewNoteColor('yellow');
  };

  // Save new note
  const handleSaveNote = async () => {
    if (!id || typeof id !== 'string' || !newNoteName.trim() || !newNoteContent.trim()) return;

    setSavingNote(true);
    try {
      const noteData = {
        documentId: id,
        authorName: newNoteName.trim(),
        content: newNoteContent.trim(),
        xPercent: noteFormPosition.xPercent,
        yOffset: noteFormPosition.yOffset,
        createdAt: new Date(),
        authorKey: localAuthorKey, // Store the author key so they can delete their own notes
        color: newNoteColor
      };
      console.log('[DocumentNotes] Saving note:', noteData);
      const docRef = await addDoc(collection(db, 'document-notes'), noteData);
      console.log('[DocumentNotes] Note saved with ID:', docRef.id);
      setShowNoteForm(false);
      setNewNoteName('');
      setNewNoteContent('');
      setNewNoteColor('yellow');
    } catch (err) {
      console.error('[DocumentNotes] Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  // Delete a note (only if author or admin)
  const handleDeleteNote = async (noteId: string) => {
    setDeletingNoteId(noteId);
    try {
      await deleteDoc(doc(db, 'document-notes', noteId));
      console.log('[DocumentNotes] Note deleted:', noteId);
    } catch (err) {
      console.error('[DocumentNotes] Error deleting note:', err);
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Check if current user can delete a note
  const canDeleteNote = (note: DocumentNote): boolean => {
    // Admins can always delete
    if (isAdmin) return true;
    // Author can delete their own notes (matching authorKey)
    if (note.authorKey && note.authorKey === localAuthorKey) return true;
    return false;
  };

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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#d7ff00]/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#d7ff00]" />
                </div>
                <div>
                  {(() => {
                    const titleLines = (document.title || '').split(/\n/).filter(Boolean);
                    const mainTitle = titleLines[0] ?? document.title;
                    const subtitle = titleLines.length > 1 ? titleLines.slice(1).join('\n') : null;
                    return (
                      <>
                        <h1 className="text-2xl font-bold text-white">{mainTitle}</h1>
                        <p className="text-sm text-zinc-400 mt-1">
                          Created: {formatDate(document.createdAt)}
                        </p>
                        {subtitle ? (
                          <p className="text-lg font-bold text-white mt-1">{subtitle}</p>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>
              {(() => {
                const exportFormat = getExportFormat(document.documentType);
                const handleExport = () => {
                  if (exportFormat === 'xlsx') {
                    exportAsXlsx(document);
                  } else if (exportFormat === 'docx') {
                    exportAsDocx(document);
                  } else {
                    generatePdf(document);
                  }
                };
                const buttonLabel = exportFormat === 'xlsx' ? 'Download Excel' :
                  exportFormat === 'docx' ? 'Download Word' :
                    'Download PDF';
                return (
                  <button
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 px-6 py-3 w-full md:w-auto bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-xl font-semibold transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    {buttonLabel}
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Document Content */}
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 p-8 relative">
            {/* Hint for adding notes */}
            <div className="mb-4 pb-4 border-b border-zinc-700/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-yellow-500" />
                Double-click anywhere on the document to add a note
              </p>
              {notes.length > 0 && (
                <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full self-start sm:self-auto">
                  {notes.length} note{notes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div
              ref={contentRef}
              className="document-content relative"
              onDoubleClick={handleDoubleClick}
              style={{ cursor: 'text' }}
            >
              {(() => {
                // Check if this is the document that needs the flowchart
                const flowchartDocId = '1ONnSZeUQqlnfABWSMG3';
                const isFlowchartDoc = id === flowchartDocId;

                if (isFlowchartDoc) {
                  const content = document.content;

                  // Clean up any old ASCII art remnants first
                  let cleanedContent = content
                    .replace(/DATA\s*→?\s*DECISIONS\s*DELIVERY\s*LOOP[\s\S]*?(?:model\s*tuning|└─+┴─+┘|↻[^\n]*)/gi, '')
                    .replace(/┌[─┐│┘└┴┬├┤┼]+/g, '')
                    .replace(/[│┐│┘└┴┬├┤┼]+/g, '')
                    .replace(/\n{3,}/g, '\n\n');

                  // Look for "Enterprise Data Sources" subsection and insert chart BEFORE it
                  // This places the chart after the 3.4 section intro and before the detailed subsections
                  const enterprisePattern = /(Enterprise Data Sources)/i;
                  const enterpriseMatch = cleanedContent.match(enterprisePattern);

                  if (enterpriseMatch) {
                    const insertIndex = cleanedContent.indexOf(enterpriseMatch[0]);
                    const beforeChart = cleanedContent.substring(0, insertIndex);
                    // Skip past "Enterprise Data Sources" text to get the rest of the content
                    const afterEnterprise = cleanedContent.substring(insertIndex + enterpriseMatch[0].length);

                    return (
                      <>
                        <div dangerouslySetInnerHTML={{ __html: formatContentForPdf(beforeChart) }} />
                        <DataDeliveryLoopFlowchart />
                        <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Enterprise Data Sources</h4>
                        <div dangerouslySetInnerHTML={{ __html: formatContentForPdf(afterEnterprise) }} />
                      </>
                    );
                  }

                  // Fallback: append chart at the end
                  return (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: formatContentForPdf(cleanedContent) }} />
                      <DataDeliveryLoopFlowchart />
                    </>
                  );
                }

                // Default rendering for all other documents
                return <div dangerouslySetInnerHTML={{ __html: formatContentForPdf(document.content) }} />;
              })()}

              {/* Render sticky note icons */}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="absolute z-10"
                  style={{
                    left: `${Math.min(Math.max(note.xPercent, 2), 95)}%`,
                    top: `${note.yOffset}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onMouseEnter={() => {
                    cancelHideNote();
                    setHoveredNoteId(note.id);
                  }}
                  onMouseLeave={() => scheduleHideNote(note.id)}
                >
                  {/* Sticky note icon */}
                  {(() => {
                    const styles = getNoteColorStyles(note.color);
                    return (
                      <div
                        className={`w-8 h-8 ${styles.bg} rounded shadow-lg cursor-pointer flex items-center justify-center transform transition-all duration-200 ${hoveredNoteId === note.id ? 'opacity-100 scale-110' : 'opacity-25 hover:opacity-100 hover:scale-110'}`}
                        onMouseEnter={() => {
                          cancelHideNote();
                          setHoveredNoteId(note.id);
                        }}
                      >
                        <StickyNote className={`w-5 h-5 ${styles.icon}`} />
                      </div>
                    );
                  })()}

                  {/* Tooltip on hover */}
                  {hoveredNoteId === note.id && (() => {
                    const styles = getNoteColorStyles(note.color);
                    return (
                      <div
                        className={`absolute z-20 ${styles.tooltipBg} ${styles.tooltipText} rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px]`}
                        style={{
                          left: note.xPercent > 70 ? 'auto' : '100%',
                          right: note.xPercent > 70 ? '100%' : 'auto',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          marginLeft: note.xPercent > 70 ? 0 : '8px',
                          marginRight: note.xPercent > 70 ? '8px' : 0
                        }}
                        onMouseEnter={cancelHideNote}
                        onMouseLeave={() => scheduleHideNote(note.id)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-semibold text-sm">{note.authorName}</div>
                          {canDeleteNote(note) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNote(note.id);
                              }}
                              disabled={deletingNoteId === note.id}
                              className="p-1 hover:bg-red-200 rounded transition-colors text-red-600 hover:text-red-700"
                              title="Delete note"
                            >
                              {deletingNoteId === note.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{note.content}</div>
                        <div className={`text-xs ${styles.tooltipText} opacity-80 mt-2`}>
                          {note.createdAt instanceof Date
                            ? note.createdAt.toLocaleDateString()
                            : (note.createdAt as Timestamp).toDate().toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {/* Note Form Modal */}
            {showNoteForm && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowNoteForm(false);
                }}
              >
                <div
                  className="bg-[#1a1e24] rounded-xl border border-zinc-700 shadow-2xl p-6 w-full max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${getNoteColorStyles(newNoteColor).bg} rounded flex items-center justify-center`}>
                        <StickyNote className={`w-5 h-5 ${getNoteColorStyles(newNoteColor).icon}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-white">Add Note</h3>
                    </div>
                    <button
                      onClick={() => setShowNoteForm(false)}
                      className="p-1 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-zinc-400" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Note color
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {NOTE_COLORS.map(({ key, bg, icon }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewNoteColor(key)}
                            className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center ring-2 transition-all ${newNoteColor === key ? 'ring-white ring-offset-2 ring-offset-[#1a1e24]' : 'ring-transparent hover:ring-zinc-500'
                              }`}
                            title={key.charAt(0).toUpperCase() + key.slice(1)}
                          >
                            <StickyNote className={`w-5 h-5 ${icon}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={newNoteName}
                        onChange={(e) => setNewNoteName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                        Note
                      </label>
                      <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Enter your note or comment..."
                        rows={4}
                        className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowNoteForm(false)}
                        className="flex-1 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNote}
                        disabled={!newNoteName.trim() || !newNoteContent.trim() || savingNote}
                        className="flex-1 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-600 disabled:cursor-not-allowed text-black disabled:text-zinc-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {savingNote ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Add Note'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <style jsx global>{`
              .document-content {
                color: #e4e4e7;
                font-size: 16px;
                line-height: 1.8;
              }
              .document-content h2 {
                font-size: 1.5rem;
                font-weight: 700;
                color: #ffffff;
                margin-top: 2rem;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid #3f3f46;
              }
              .document-content h3 {
                font-size: 1.25rem;
                font-weight: 600;
                color: #ffffff;
                margin-top: 1.5rem;
                margin-bottom: 0.75rem;
              }
              .document-content h4 {
                font-size: 1.1rem;
                font-weight: 600;
                color: #fafafa;
                margin-top: 1.25rem;
                margin-bottom: 0.5rem;
              }
              .document-content p {
                margin-bottom: 1rem;
                color: #d4d4d8;
              }
              .document-content strong {
                font-weight: 600;
                color: #ffffff;
              }
              .document-content em {
                font-style: italic;
                color: #a1a1aa;
              }
              .document-content ul,
              .document-content ol {
                margin: 1rem 0;
                padding-left: 1.75rem;
              }
              .document-content ul {
                list-style-type: disc;
              }
              .document-content ol {
                list-style-type: decimal;
              }
              .document-content li {
                margin-bottom: 0.5rem;
                color: #d4d4d8;
              }
              .document-content li::marker {
                color: #d7ff00;
              }
              .document-content hr {
                border: none;
                border-top: 1px solid #3f3f46;
                margin: 1.5rem 0;
              }
              .document-content pre,
              .document-content .code-block {
                background: linear-gradient(135deg, rgba(39, 39, 42, 0.8) 0%, rgba(24, 24, 27, 0.9) 100%);
                border: 1px solid #3f3f46;
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
                overflow-x: auto;
                font-family: 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.5;
                white-space: pre;
                color: #d7ff00;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
              }
              .document-content pre code,
              .document-content .code-block code {
                background: none;
                padding: 0;
                font-family: inherit;
                font-size: inherit;
                color: inherit;
              }
            `}</style>
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
