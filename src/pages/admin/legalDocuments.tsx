import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { FileText, Download, Trash2, Loader2, Sparkles, Clock, AlertCircle, CheckCircle, RefreshCw, Eye, ChevronUp, Edit3, ClipboardCheck, X, AlertTriangle, CheckCircle2, Send, Mail, Check, PenTool, Share2, Copy } from 'lucide-react';

// Types
interface LegalDocument {
  id: string;
  title: string;
  prompt: string;
  content: string;
  documentType: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  revisionHistory?: { prompt: string; timestamp: Timestamp | Date }[];
  // Signing-related fields
  signingRequestId?: string;
  requiresSignature?: boolean;
}

interface SigningRequest {
  id: string;
  documentType: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed';
  createdAt: Timestamp;
  sentAt?: Timestamp;
  viewedAt?: Timestamp;
  signedAt?: Timestamp;
  legalDocumentId?: string; // Link back to the legal document
  documentContent?: string; // Store the document content for signing
  signatureData?: {
    typedName: string;
    signatureFont: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
  };
}

interface AuditResult {
  overallStatus: 'ready' | 'needs-work' | 'critical-issues';
  score: number;
  summary: string;
  criticalIssues: string[];
  missingElements: string[];
  recommendations: string[];
  strengths: string[];
}

// Document types that typically require signatures
const SIGNATURE_REQUIRED_TYPES = ['nda', 'contractor', 'employment', 'ip-assignment', 'advisor', 'safe', 'partnership', 'license'];

// Predefined document type templates for common legal documents
const DOCUMENT_TYPES = [
  { id: 'nda', label: 'Non-Disclosure Agreement (NDA)', icon: '🔒' },
  { id: 'terms', label: 'Terms of Service', icon: '📜' },
  { id: 'privacy', label: 'Privacy Policy', icon: '🛡️' },
  { id: 'contractor', label: 'Contractor Agreement', icon: '👤' },
  { id: 'employment', label: 'Employment Agreement', icon: '💼' },
  { id: 'ip-assignment', label: 'IP Assignment Agreement', icon: '💡' },
  { id: 'advisor', label: 'Advisor Agreement', icon: '🤝' },
  { id: 'safe', label: 'SAFE Agreement', icon: '💰' },
  { id: 'partnership', label: 'Partnership Agreement', icon: '🤝' },
  { id: 'license', label: 'License Agreement', icon: '📄' },
  { id: 'proposal', label: 'Proposal Document', icon: '📋' },
  { id: 'custom', label: 'Custom Document', icon: '✏️' },
];

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

// Status badge component
const StatusBadge: React.FC<{ status: LegalDocument['status'] }> = ({ status }) => {
  const configs = {
    completed: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800', icon: CheckCircle },
    generating: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: Loader2 },
    error: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800', icon: AlertCircle },
  };
  const config = configs[status] || configs.generating;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 ${config.bg} ${config.text} rounded-full text-xs font-medium border ${config.border}`}>
      <Icon className={`w-3 h-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Audit Status Badge
const AuditStatusBadge: React.FC<{ status: AuditResult['overallStatus']; score: number }> = ({ status, score }) => {
  const configs = {
    'ready': { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800', icon: CheckCircle2, label: 'Ready to Send' },
    'needs-work': { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: AlertTriangle, label: 'Needs Work' },
    'critical-issues': { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800', icon: AlertCircle, label: 'Critical Issues' },
  };
  const config = configs[status] || configs['needs-work'];
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 ${config.bg} ${config.text} rounded-lg border ${config.border}`}>
      <Icon className="w-5 h-5" />
      <div>
        <div className="font-semibold">{config.label}</div>
        <div className="text-xs opacity-75">Score: {score}/100</div>
      </div>
    </div>
  );
};

const LegalDocumentsAdmin: React.FC = () => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedType, setSelectedType] = useState('nda');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<LegalDocument | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditingDocument, setAuditingDocument] = useState<LegalDocument | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Signing Modal State
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [signingDocument, setSigningDocument] = useState<LegalDocument | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Load documents from Firestore
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'legal-documents'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LegalDocument[];
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
      setMessage({ type: 'error', text: 'Failed to load documents' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load signing requests from Firestore
  const loadSigningRequests = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'signingRequests'),
        where('legalDocumentId', '!=', null),
        orderBy('legalDocumentId'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SigningRequest[];
      setSigningRequests(requests);
    } catch (error) {
      console.error('Error loading signing requests:', error);
      // Try without the compound query if index doesn't exist
      try {
        const fallbackQ = query(
          collection(db, 'signingRequests'),
          orderBy('createdAt', 'desc')
        );
        const fallbackSnapshot = await getDocs(fallbackQ);
        const requests = fallbackSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as SigningRequest))
          .filter(r => r.legalDocumentId);
        setSigningRequests(requests);
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
      }
    }
  }, []);

  // Get signing request for a document
  const getSigningRequestForDocument = (documentId: string): SigningRequest | undefined => {
    return signingRequests.find(r => r.legalDocumentId === documentId);
  };

  useEffect(() => {
    loadDocuments();
    loadSigningRequests();
  }, [loadDocuments, loadSigningRequests]);

  // Generate document using AI
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setMessage({ type: 'error', text: 'Please enter a prompt for the document' });
      return;
    }

    setGenerating(true);
    setMessage(null);

    try {
      // Create placeholder document in Firestore
      const docType = DOCUMENT_TYPES.find(t => t.id === selectedType);
      const docRef = await addDoc(collection(db, 'legal-documents'), {
        title: `${docType?.label || 'Legal Document'} - ${new Date().toLocaleDateString()}`,
        prompt: prompt,
        content: '',
        documentType: selectedType,
        createdAt: Timestamp.now(),
        status: 'generating'
      });

      // Call API to generate document
      const response = await fetch('/api/admin/generate-legal-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          documentType: selectedType,
          documentId: docRef.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate document');
      }

      // Update document with generated content
      await updateDoc(doc(db, 'legal-documents', docRef.id), {
        title: result.title || `${docType?.label || 'Legal Document'} - ${new Date().toLocaleDateString()}`,
        content: result.content,
        status: 'completed'
      });

      setMessage({ type: 'success', text: 'Document generated successfully!' });
      setPrompt('');
      loadDocuments();
    } catch (error) {
      console.error('Error generating document:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to generate document' });
    } finally {
      setGenerating(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (document: LegalDocument) => {
    setEditingDocument(document);
    setEditPrompt('');
    setEditTitle(document.title);
    setIsEditModalOpen(true);
  };

  // Handle Document Revision
  const handleRevise = async () => {
    if (!editingDocument) {
      setMessage({ type: 'error', text: 'No document selected' });
      return;
    }

    // Allow saving if either title changed OR revision prompt provided
    const titleChanged = editTitle.trim() !== editingDocument.title;
    const hasRevisionPrompt = editPrompt.trim().length > 0;

    if (!titleChanged && !hasRevisionPrompt) {
      setMessage({ type: 'error', text: 'Please enter a new title or revision instructions' });
      return;
    }

    setIsRevising(true);

    try {
      let newContent = editingDocument.content;
      
      // Only call API if there's a revision prompt
      if (hasRevisionPrompt) {
        const response = await fetch('/api/admin/revise-legal-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: editingDocument.id,
            currentContent: editingDocument.content,
            revisionPrompt: editPrompt,
            documentType: editingDocument.documentType,
            originalPrompt: editingDocument.prompt
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to revise document');
        }
        
        newContent = result.content;
      }

      // Update document with revised content and/or new title
      const revisionHistory = editingDocument.revisionHistory || [];
      const updateData: {
        title: string;
        updatedAt: Timestamp;
        content?: string;
        revisionHistory?: Array<{ prompt: string; timestamp: Timestamp }>;
      } = {
        title: editTitle.trim(),
        updatedAt: Timestamp.now(),
      };
      
      if (hasRevisionPrompt) {
        updateData.content = newContent;
        // Convert existing revision history timestamps to Timestamp if needed
        const convertedHistory = revisionHistory.map(rev => ({
          prompt: rev.prompt,
          timestamp: rev.timestamp instanceof Timestamp 
            ? rev.timestamp 
            : Timestamp.fromDate(rev.timestamp instanceof Date ? rev.timestamp : new Date(rev.timestamp))
        }));
        updateData.revisionHistory = [...convertedHistory, { prompt: editPrompt, timestamp: Timestamp.now() }];
      }

      await updateDoc(doc(db, 'legal-documents', editingDocument.id), updateData);

      setMessage({ type: 'success', text: hasRevisionPrompt ? 'Document revised successfully!' : 'Title updated successfully!' });
      setIsEditModalOpen(false);
      setEditingDocument(null);
      setEditPrompt('');
      setEditTitle('');
      loadDocuments();
    } catch (error) {
      console.error('Error revising document:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to revise document' });
    } finally {
      setIsRevising(false);
    }
  };

  // Open Audit Modal
  const openAuditModal = async (document: LegalDocument) => {
    setAuditingDocument(document);
    setAuditResult(null);
    setIsAuditModalOpen(true);
    setIsAuditing(true);

    try {
      const response = await fetch('/api/admin/audit-legal-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          content: document.content,
          documentType: document.documentType,
          title: document.title
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to audit document');
      }

      setAuditResult(result.audit);
    } catch (error) {
      console.error('Error auditing document:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to audit document' });
      setIsAuditModalOpen(false);
    } finally {
      setIsAuditing(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    setDeletingId(docId);
    try {
      await deleteDoc(doc(db, 'legal-documents', docId));
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setMessage({ type: 'success', text: 'Document deleted successfully' });
    } catch (error) {
      console.error('Error deleting document:', error);
      setMessage({ type: 'error', text: 'Failed to delete document' });
    } finally {
      setDeletingId(null);
    }
  };

  // Open Signing Modal
  const openSigningModal = (document: LegalDocument) => {
    setSigningDocument(document);
    setRecipientName('');
    setRecipientEmail('');
    setIsSigningModalOpen(true);
  };

  // Send document for signature
  const handleSendForSignature = async () => {
    if (!signingDocument || !recipientEmail.trim() || !recipientName.trim()) {
      setMessage({ type: 'error', text: 'Please enter recipient name and email' });
      return;
    }

    setIsSending(true);

    try {
      // Create signing request in Firestore
      const requestData = {
        documentType: signingDocument.documentType,
        documentName: signingDocument.title,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.toLowerCase().trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        legalDocumentId: signingDocument.id,
        documentContent: signingDocument.content,
      };

      const docRef = await addDoc(collection(db, 'signingRequests'), requestData);

      // Update the legal document with the signing request ID
      await updateDoc(doc(db, 'legal-documents', signingDocument.id), {
        signingRequestId: docRef.id,
        requiresSignature: true,
      });

      // Send email via Netlify function
      const response = await fetch('/.netlify/functions/send-signing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docRef.id,
          documentName: signingDocument.title,
          documentType: signingDocument.documentType,
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.toLowerCase().trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setMessage({ type: 'success', text: 'Document sent for signature!' });
      setIsSigningModalOpen(false);
      setSigningDocument(null);
      setRecipientName('');
      setRecipientEmail('');
      loadDocuments();
      loadSigningRequests();
    } catch (error) {
      console.error('Error sending document for signature:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send document' });
    } finally {
      setIsSending(false);
    }
  };

  // Get signing status badge
  const getSigningStatusBadge = (status: SigningRequest['status']) => {
    const configs = {
      pending: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800', icon: Clock, label: 'Pending' },
      sent: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800', icon: Mail, label: 'Sent' },
      viewed: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800', icon: Eye, label: 'Viewed' },
      signed: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800', icon: Check, label: 'Signed' },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 ${config.bg} ${config.text} rounded-full text-xs font-medium border ${config.border}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  // Check if document type requires signature
  const requiresSignature = (documentType: string): boolean => {
    return SIGNATURE_REQUIRED_TYPES.includes(documentType);
  };

  // Copy shareable link to clipboard
  const handleShareDocument = async (document: LegalDocument) => {
    const shareUrl = `${window.location.origin}/legal-doc/${document.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLinkId(document.id);
      setMessage({ type: 'success', text: 'Shareable link copied to clipboard!' });
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedLinkId(null);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      setMessage({ type: 'error', text: 'Failed to copy link. Please try again.' });
    }
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

  // Preview document in modal
  const togglePreview = (docId: string) => {
    setExpandedDoc(expandedDoc === docId ? null : docId);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Legal Document Generator | Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-7 h-7 text-[#d7ff00]" />
                Legal Document Generator
              </h1>
              <p className="text-zinc-400 mt-1">
                Generate professional legal documents using AI
              </p>
            </div>
            <button
              onClick={loadDocuments}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Message Banner */}
          {message && (
            <div className={`mb-6 p-4 rounded-xl border ${
              message.type === 'success' 
                ? 'bg-green-900/20 border-green-800 text-green-400'
                : message.type === 'error'
                ? 'bg-red-900/20 border-red-800 text-red-400'
                : 'bg-blue-900/20 border-blue-800 text-blue-400'
            }`}>
              <div className="flex items-center gap-2">
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
                 message.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
                 <AlertCircle className="w-5 h-5" />}
                {message.text}
              </div>
            </div>
          )}

          {/* Generation Form */}
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#d7ff00]" />
              Generate New Document
            </h2>
            
            {/* Document Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Document Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {DOCUMENT_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedType === type.id
                        ? 'bg-[#d7ff00] text-black font-medium'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span className="truncate">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Document Details & Instructions
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the specifics of your document. For example: 'Create an NDA between Pulse Intelligence Labs and [Company Name] for a potential partnership discussion. The agreement should be mutual, have a 2-year term, and include standard confidentiality provisions.'"
                className="w-full h-40 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors resize-none"
              />
              <p className="text-xs text-zinc-500 mt-2">
                Be specific about parties involved, terms, duration, and any special clauses you need.
              </p>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl font-semibold transition-all ${
                generating || !prompt.trim()
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Document...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Document
                </>
              )}
            </button>
          </div>

          {/* Documents Table */}
          <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-zinc-400" />
                Generated Documents
                <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">
                  {documents.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#d7ff00]" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                <FileText className="w-12 h-12 mb-4 opacity-50" />
                <p>No documents generated yet</p>
                <p className="text-sm">Use the form above to generate your first document</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {documents.map((document) => {
                  const signingRequest = getSigningRequestForDocument(document.id);
                  const needsSignature = requiresSignature(document.documentType);
                  
                  return (
                  <div key={document.id} className="p-4 hover:bg-zinc-900/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-medium text-white truncate">
                            {document.title}
                          </h3>
                          <StatusBadge status={document.status} />
                          {document.updatedAt && (
                            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                              Revised
                            </span>
                          )}
                          {signingRequest && getSigningStatusBadge(signingRequest.status)}
                          {needsSignature && !signingRequest && document.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-800">
                              <PenTool className="w-3 h-3" />
                              Signature Required
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-zinc-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(document.createdAt)}
                          </span>
                          <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs">
                            {DOCUMENT_TYPES.find(t => t.id === document.documentType)?.label || document.documentType}
                          </span>
                          {signingRequest && (
                            <span className="text-xs text-zinc-500">
                              Sent to: {signingRequest.recipientEmail}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4 flex-wrap justify-end">
                        {document.status === 'completed' && (
                          <>
                            <button
                              onClick={() => togglePreview(document.id)}
                              className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                            >
                              {expandedDoc === document.id ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                              Preview
                            </button>
                            <button
                              onClick={() => openEditModal(document)}
                              className="flex items-center gap-1 px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded-lg text-sm transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => openAuditModal(document)}
                              className="flex items-center gap-1 px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 rounded-lg text-sm transition-colors"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                              Audit
                            </button>
                            
                            {/* Signing Actions */}
                            {signingRequest?.status === 'signed' ? (
                              <button
                                onClick={() => window.open(`/sign/${signingRequest.id}?download=true`, '_blank')}
                                className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download Signed
                              </button>
                            ) : needsSignature && !signingRequest ? (
                              <button
                                onClick={() => openSigningModal(document)}
                                className="flex items-center gap-1 px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors"
                              >
                                <Send className="w-4 h-4" />
                                Send for Signature
                              </button>
                            ) : signingRequest ? (
                              <button
                                onClick={() => window.open(`/sign/${signingRequest.id}`, '_blank')}
                                className="flex items-center gap-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                View Signing Page
                              </button>
                            ) : null}
                            
                            <button
                              onClick={() => handleShareDocument(document)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                copiedLinkId === document.id
                                  ? 'bg-green-600 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {copiedLinkId === document.id ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Share2 className="w-4 h-4" />
                                  Share
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => generatePdf(document)}
                              className="flex items-center gap-1 px-3 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg text-sm font-medium transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download PDF
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(document.id)}
                          disabled={deletingId === document.id}
                          className="flex items-center gap-1 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                        >
                          {deletingId === document.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Preview */}
                    {expandedDoc === document.id && document.status === 'completed' && (
                      <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                        <div className="prose prose-invert prose-sm max-w-none">
                          <div className="text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed max-h-96 overflow-y-auto">
                            {document.content}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-700">
                          <p className="text-xs text-zinc-500">
                            <strong>Original Prompt:</strong> {document.prompt}
                          </p>
                          {document.revisionHistory && document.revisionHistory.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-zinc-400 font-medium">Revision History:</p>
                              {document.revisionHistory.map((rev, idx) => (
                                <p key={idx} className="text-xs text-zinc-500 mt-1">
                                  • {rev.prompt}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {document.status === 'error' && document.errorMessage && (
                      <div className="mt-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
                        {document.errorMessage}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="mt-8 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">📋 Document Generation Tips</h3>
            <ul className="text-sm text-zinc-500 space-y-1">
              <li>• <strong>Be specific</strong> - Include party names, dates, and specific terms you need</li>
              <li>• <strong>Use Edit</strong> - Refine documents with revision prompts without starting over</li>
              <li>• <strong>Run Audit</strong> - Check for missing elements before sending for signatures</li>
              <li>• <strong>Review before use</strong> - AI-generated documents should be reviewed by legal counsel</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-400" />
                  Edit Document
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{editingDocument.title}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Document Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Document Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter document title"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Current Document Preview
                </label>
                <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700 max-h-40 overflow-y-auto">
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap line-clamp-6">
                    {editingDocument.content.substring(0, 500)}...
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Revision Instructions <span className="text-zinc-500 font-normal">(optional if only updating title)</span>
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Describe the changes you want to make. For example: 'Change the confidentiality period from 2 years to 5 years. Add a clause about mutual non-solicitation of employees. Replace [Company Name] with Acme Corporation.'"
                  className="w-full h-40 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Be specific about what sections to change, what to add, or what to remove. Leave empty to only update the title.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevise}
                disabled={isRevising || (!editPrompt.trim() && editTitle.trim() === editingDocument?.title)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isRevising || (!editPrompt.trim() && editTitle.trim() === editingDocument?.title)
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isRevising ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editPrompt.trim() ? 'Revising...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {editPrompt.trim() ? 'Apply Changes' : 'Save Title'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {isAuditModalOpen && auditingDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-purple-400" />
                  Document Audit
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{auditingDocument.title}</p>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {isAuditing ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-12 h-12 animate-spin text-purple-400 mb-4" />
                  <p className="text-zinc-400">Analyzing document...</p>
                  <p className="text-sm text-zinc-500 mt-1">This may take a moment</p>
                </div>
              ) : auditResult ? (
                <div className="space-y-6">
                  {/* Overall Status */}
                  <div className="flex items-center justify-between">
                    <AuditStatusBadge status={auditResult.overallStatus} score={auditResult.score} />
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-700">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-2">Summary</h3>
                    <p className="text-sm text-zinc-400">{auditResult.summary}</p>
                  </div>

                  {/* Critical Issues */}
                  {auditResult.criticalIssues.length > 0 && (
                    <div className="p-4 bg-red-900/20 rounded-xl border border-red-800">
                      <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Critical Issues ({auditResult.criticalIssues.length})
                      </h3>
                      <ul className="space-y-2">
                        {auditResult.criticalIssues.map((issue, idx) => (
                          <li key={idx} className="text-sm text-red-300 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing Elements */}
                  {auditResult.missingElements.length > 0 && (
                    <div className="p-4 bg-yellow-900/20 rounded-xl border border-yellow-800">
                      <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Missing Elements ({auditResult.missingElements.length})
                      </h3>
                      <ul className="space-y-2">
                        {auditResult.missingElements.map((element, idx) => (
                          <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">•</span>
                            {element}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {auditResult.recommendations.length > 0 && (
                    <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-800">
                      <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Recommendations
                      </h3>
                      <ul className="space-y-2">
                        {auditResult.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-blue-300 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Strengths */}
                  {auditResult.strengths.length > 0 && (
                    <div className="p-4 bg-green-900/20 rounded-xl border border-green-800">
                      <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Strengths
                      </h3>
                      <ul className="space-y-2">
                        {auditResult.strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 p-6 border-t border-zinc-700">
              <p className="text-xs text-zinc-500">
                This audit is AI-generated. Always have legal counsel review important documents.
              </p>
              <div className="flex items-center gap-3">
                {auditResult && (auditResult.criticalIssues.length > 0 || auditResult.missingElements.length > 0) && (
                  <button
                    onClick={() => {
                      setIsAuditModalOpen(false);
                      openEditModal(auditingDocument);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Document
                  </button>
                )}
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send for Signature Modal */}
      {isSigningModalOpen && signingDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-400" />
                  Send for Signature
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{signingDocument.title}</p>
              </div>
              <button
                onClick={() => {
                  setIsSigningModalOpen(false);
                  setSigningDocument(null);
                  setRecipientName('');
                  setRecipientEmail('');
                }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="bg-zinc-900/50 rounded-xl p-4 mb-6 border border-zinc-700">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-[#d7ff00]" />
                  <div>
                    <p className="text-white font-medium">{signingDocument.title}</p>
                    <p className="text-zinc-500 text-sm">
                      {DOCUMENT_TYPES.find(t => t.id === signingDocument.documentType)?.label || signingDocument.documentType}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Enter the signer's full name"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                <p className="text-blue-400 text-sm flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    An email will be sent to the recipient with a link to review and sign the document electronically.
                  </span>
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => {
                  setIsSigningModalOpen(false);
                  setSigningDocument(null);
                  setRecipientName('');
                  setRecipientEmail('');
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendForSignature}
                disabled={isSending || !recipientEmail.trim() || !recipientName.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSending || !recipientEmail.trim() || !recipientName.trim()
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-500'
                }`}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Document
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default LegalDocumentsAdmin;
