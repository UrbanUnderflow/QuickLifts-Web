import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { FileText, Download, Trash2, Loader2, Sparkles, Clock, AlertCircle, CheckCircle, RefreshCw, Eye, ChevronUp, Edit3, ClipboardCheck, X, AlertTriangle, CheckCircle2, Send, Mail, Check, PenTool, Share2, Copy, Paperclip, Link2 } from 'lucide-react';
import { applyDocumentPatches, type DocumentPatch } from '../../utils/documentPatches';
import { formatDiagram, previewFormattedDiagram, extractSectionHeaders, insertDiagramIntoDocument } from '../../utils/diagramFormatter';

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
  signingRequestIds?: string[];
  requiresSignature?: boolean;
  // Exhibits - other documents attached as exhibits
  exhibits?: string[];
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
  signerRole?: string;
  stakeholderId?: string;
  signingGroupId?: string;
  signingOrder?: number;
  signatureData?: {
    typedName: string;
    signatureFont: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
  };
}

type SignerRow = {
  id: string;
  role: string;
  stakeholderId?: string;
  name: string;
  email: string;
  signingRequestId?: string;
};

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
  { id: 'system-design', label: 'System Design', icon: '🏗️' },
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
  const [requiresSignatureChecked, setRequiresSignatureChecked] = useState<boolean>(SIGNATURE_REQUIRED_TYPES.includes('nda'));
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<LegalDocument | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editRequiresSignature, setEditRequiresSignature] = useState<boolean>(false);
  const [isRevising, setIsRevising] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [revisionDebugInfo, setRevisionDebugInfo] = useState<{
    excerptsUsed?: string[];
    excerptCounts?: { first: number; retry?: number };
    patchCounts?: { first: number; retry?: number };
    patchFailures?: Array<{ attempt: 'first' | 'retry'; failures: Array<{ patchIndex: number; reason: string }> }>;
    mode?: 'patches' | 'full' | 'error';
  } | null>(null);
  const [showRevisionDebug, setShowRevisionDebug] = useState(false);
  
  // Diagram Insert State
  const [showDiagramSection, setShowDiagramSection] = useState(false);
  const [diagramInput, setDiagramInput] = useState('');
  const [diagramPosition, setDiagramPosition] = useState<'start' | 'end' | string>('end');
  const [diagramPreview, setDiagramPreview] = useState('');
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [contentManuallyModified, setContentManuallyModified] = useState(false);

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditingDocument, setAuditingDocument] = useState<LegalDocument | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Signing Modal State
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [signingDocument, setSigningDocument] = useState<LegalDocument | null>(null);
  const [signers, setSigners] = useState<SignerRow[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Stakeholders for signer prefill (equity stakeholders are a good global address book)
  const [stakeholderDirectory, setStakeholderDirectory] = useState<{ id: string; name: string; email: string }[]>([]);

  // Exhibits Modal State
  const [isExhibitsModalOpen, setIsExhibitsModalOpen] = useState(false);
  const [exhibitsDocument, setExhibitsDocument] = useState<LegalDocument | null>(null);
  const [selectedExhibits, setSelectedExhibits] = useState<string[]>([]);
  const [isSavingExhibits, setIsSavingExhibits] = useState(false);

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

      // Load stakeholder directory for signer prefill (best-effort)
      try {
        const stakeQ = query(collection(db, 'equity-stakeholders'), orderBy('createdAt', 'desc'));
        const stakeSnap = await getDocs(stakeQ);
        const directory = stakeSnap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter((s: any) => typeof s.email === 'string' && s.email.length > 0)
          .map((s: any) => ({ id: s.id, name: s.name || s.email, email: s.email }))
          .slice(0, 200);
        setStakeholderDirectory(directory);
      } catch {
        // ignore
      }
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

  // Get signing requests for a document
  const getSigningRequestsForDocument = (documentId: string): SigningRequest[] => {
    return signingRequests.filter(r => r.legalDocumentId === documentId);
  };

  const buildDefaultSignersForLegalDoc = (doc: LegalDocument): SignerRow[] => {
    const existing = getSigningRequestsForDocument(doc.id);

    const makeRow = (row: Omit<SignerRow, 'id'>): SignerRow => {
      const existingReq = existing.find(r => r.recipientEmail?.toLowerCase() === row.email?.toLowerCase() && r.signerRole === row.role);
      return {
        id: `${row.role}-${row.email || Math.random().toString(36).slice(2)}`,
        ...row,
        signingRequestId: existingReq?.id,
      };
    };

    // Start with a single signer by default (user can add more)
    if (existing.length > 0) {
      return existing.map((r, idx) => makeRow({
        role: r.signerRole || `Signer ${idx + 1}`,
        stakeholderId: r.stakeholderId,
        name: r.recipientName,
        email: r.recipientEmail,
        signingRequestId: r.id,
      } as any));
    }

    return [makeRow({ role: 'Recipient', name: '', email: '' })];
  };

  useEffect(() => {
    loadDocuments();
    loadSigningRequests();
  }, [loadDocuments, loadSigningRequests]);

  // Default signature checkbox based on document type (user can override)
  useEffect(() => {
    setRequiresSignatureChecked(SIGNATURE_REQUIRED_TYPES.includes(selectedType));
  }, [selectedType]);

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
        requiresSignature: requiresSignatureChecked,
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
          documentId: docRef.id,
          requiresSignature: requiresSignatureChecked
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
        requiresSignature: requiresSignatureChecked,
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
    setEditRequiresSignature(Boolean(document.requiresSignature ?? SIGNATURE_REQUIRED_TYPES.includes(document.documentType)));
    setEditError(null);
    setRevisionDebugInfo(null);
    setShowRevisionDebug(false);
    // Reset diagram state
    setShowDiagramSection(false);
    setDiagramInput('');
    setDiagramPosition('end');
    setDiagramPreview('');
    setContentManuallyModified(false);
    // Extract section headers for insertion position dropdown
    setAvailableHeaders(extractSectionHeaders(document.content));
    setIsEditModalOpen(true);
  };

  // Handle diagram input change and auto-preview
  const handleDiagramInputChange = (value: string) => {
    setDiagramInput(value);
    // Auto-generate preview when input changes
    if (value.trim()) {
      const preview = previewFormattedDiagram(value);
      setDiagramPreview(preview);
    } else {
      setDiagramPreview('');
    }
  };

  // Insert formatted diagram into the document
  const handleInsertDiagram = () => {
    if (!editingDocument || !diagramInput.trim()) {
      return;
    }
    
    const formattedDiagram = formatDiagram(diagramInput);
    
    const position = diagramPosition === 'start' || diagramPosition === 'end' 
      ? diagramPosition 
      : { afterHeader: diagramPosition };
    
    const newContent = insertDiagramIntoDocument(
      editingDocument.content,
      formattedDiagram,
      position
    );
    
    // Verify content actually changed
    if (newContent === editingDocument.content) {
      setMessage({ type: 'error', text: 'Diagram insertion failed. Please check the insertion position and try again.' });
      return;
    }
    
    // Update the editing document with new content
    setEditingDocument({
      ...editingDocument,
      content: newContent,
    });
    
    // Mark that content was manually modified (so save doesn't call AI revision)
    setContentManuallyModified(true);
    
    // Clear diagram input after insertion
    setDiagramInput('');
    setDiagramPreview('');
    setShowDiagramSection(false);
    
    setMessage({ type: 'success', text: 'Diagram inserted into document. Click Save to apply changes.' });
  };

  // Build small excerpts for patch-based revision (reduce tokens + latency)
  const buildRevisionExcerpts = (fullText: string, revisionInstructions: string, options?: { maxSections?: number; includeIntroOutro?: boolean }): string[] => {
    const maxSections = Math.max(1, options?.maxSections ?? 3);
    const includeIntroOutro = options?.includeIntroOutro ?? false;

    const text = String(fullText || '');
    const prompt = String(revisionInstructions || '');
    const lowerText = text.toLowerCase();
    const lowerPrompt = prompt.toLowerCase();

    // Split into sections by markdown H2 headers. Keep header in each section.
    // If no headers exist, fall back to chunking.
    const headerMatches = [...text.matchAll(/^##\s+.+$/gm)];
    const sections: { start: number; end: number; content: string; header: string }[] = [];

    if (headerMatches.length > 0) {
      for (let i = 0; i < headerMatches.length; i++) {
        const start = headerMatches[i].index ?? 0;
        const end = i + 1 < headerMatches.length ? (headerMatches[i + 1].index ?? text.length) : text.length;
        const content = text.slice(start, end).trim();
        const header = (headerMatches[i][0] || '').trim();
        if (content) sections.push({ start, end, content, header });
      }
    } else {
      // Chunk into ~2500 char blocks if the doc isn't structured with headers.
      const CHUNK = 2500;
      for (let i = 0; i < text.length; i += CHUNK) {
        const content = text.slice(i, i + CHUNK).trim();
        if (content) sections.push({ start: i, end: Math.min(text.length, i + CHUNK), content, header: `CHUNK_${Math.floor(i / CHUNK) + 1}` });
      }
    }

    // Keyword scoring
    const rawTokens = lowerPrompt
      .replace(/[^a-z0-9\s\-\.\#]/g, ' ')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);
    const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with', 'by', 'be', 'is', 'are', 'as', 'at', 'from', 'it', 'this', 'that', 'these', 'those']);
    const keywords = Array.from(new Set(rawTokens.filter(t => t.length >= 3 && !stop.has(t)))).slice(0, 24);

    const numberHints = (lowerPrompt.match(/\b(section\s+)?(\d{1,3})\b/g) || [])
      .map(m => m.replace(/section\s+/g, '').trim())
      .filter(Boolean);

    const scored = sections.map((s, idx) => {
      const lowerSection = s.content.toLowerCase();
      let score = 0;
      for (const k of keywords) {
        if (!k) continue;
        // Weight header hits a bit higher
        if (s.header.toLowerCase().includes(k)) score += 4;
        const occurrences = (lowerSection.match(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
        score += Math.min(10, occurrences);
      }
      for (const n of numberHints) {
        if (!n) continue;
        if (s.header.toLowerCase().includes(n)) score += 6;
        if (lowerSection.includes(` ${n}.`) || lowerSection.includes(`\n${n}.`) || lowerSection.includes(`#${n}`)) score += 4;
      }
      // Slight bias toward earlier sections when uncertain
      score += Math.max(0, 2 - Math.floor(idx / 3));
      return { idx, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const pickedIdxs = new Set<number>();
    for (const s of scored) {
      if (pickedIdxs.size >= maxSections) break;
      if (s.score <= 0 && pickedIdxs.size > 0) break;
      pickedIdxs.add(s.idx);
      // Include a neighbor section for anchor stability when possible
      if (pickedIdxs.size < maxSections) {
        if (s.idx - 1 >= 0) pickedIdxs.add(s.idx - 1);
        if (s.idx + 1 < sections.length) pickedIdxs.add(s.idx + 1);
      }
      if (pickedIdxs.size >= maxSections) break;
    }

    const idxs = Array.from(pickedIdxs).sort((a, b) => a - b).slice(0, Math.max(maxSections, 1));
    const excerpts = idxs.map(i => sections[i]?.content).filter(Boolean) as string[];

    if (includeIntroOutro) {
      const intro = text.slice(0, 1200).trim();
      const outro = text.slice(Math.max(0, text.length - 1200)).trim();
      if (intro && !excerpts.some(e => e.startsWith(intro.slice(0, 80)))) excerpts.unshift(intro);
      if (outro && !excerpts.some(e => e.includes(outro.slice(-80)))) excerpts.push(outro);
    }

    // If the doc is tiny, just return it (patch mode still works).
    if (text.length <= 6000) return [text];

    // Ensure we never accidentally send the whole doc for big inputs.
    // If excerpts got too large, trim each excerpt to 4000 chars.
    return excerpts.map(e => (e.length > 4000 ? e.slice(0, 4000) : e));
  };

  // Handle Document Revision
  const handleRevise = async () => {
    if (!editingDocument) {
      setMessage({ type: 'error', text: 'No document selected' });
      return;
    }

    // Allow saving if either title changed, revision prompt provided, signature changed, or content manually modified
    const titleChanged = editTitle.trim() !== editingDocument.title;
    const hasRevisionPrompt = editPrompt.trim().length > 0;
    const signatureChanged =
      Boolean(editRequiresSignature) !== Boolean(editingDocument.requiresSignature ?? SIGNATURE_REQUIRED_TYPES.includes(editingDocument.documentType));

    if (!titleChanged && !hasRevisionPrompt && !signatureChanged && !contentManuallyModified) {
      setMessage({ type: 'error', text: 'Please enter a new title, revision instructions, change signature requirement, or insert a diagram' });
      return;
    }

    setIsRevising(true);
    setEditError(null);

    try {
      let newContent = editingDocument.content;
      
      // Only call API if there's a revision prompt AND content wasn't manually modified
      // (If content was manually modified via diagram insert, we just save the new content directly)
      if (hasRevisionPrompt && !contentManuallyModified) {
        const requestOnce = async (payload: any) => {
          const response = await fetch('/.netlify/functions/revise-legal-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          // Handle non-JSON responses (e.g., timeouts, server errors)
          let result: any;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              result = await response.json();
            } catch (parseError) {
              const text = await response.text();
              throw new Error(`Server returned invalid JSON. Response: ${text.substring(0, 200)}`);
            }
          } else {
            const text = await response.text();
            throw new Error(`Server error (${response.status}): ${text.substring(0, 200)}`);
          }

          if (!response.ok) {
            throw new Error(result.error || `Failed to revise document (HTTP ${response.status})`);
          }
          return result;
        };

        const basePayload = {
          documentId: editingDocument.id,
          revisionPrompt: editPrompt,
          documentType: editingDocument.documentType,
          originalPrompt: editingDocument.prompt,
          requiresSignature: editRequiresSignature,
        };

        // Attempt 1: patch-mode with small excerpts
        const excerpts1 = buildRevisionExcerpts(editingDocument.content, editPrompt, { maxSections: 3, includeIntroOutro: false });
        let result: any;
        let debugInfo: typeof revisionDebugInfo = {
          excerptsUsed: excerpts1.map((e, i) => `Excerpt ${i + 1}: ${e.substring(0, 100)}...`),
          excerptCounts: { first: excerpts1.length },
          mode: 'patches',
        };
        
        try {
          result = await requestOnce({ ...basePayload, mode: 'patches', excerpts: excerpts1 });
        } catch (e) {
          // If the request itself failed (timeout/server), let it bubble up
          setRevisionDebugInfo({ ...debugInfo, mode: 'error' });
          throw e;
        }

        // If patch-mode returns patches, apply locally; otherwise fall back to full content response.
        if (Array.isArray(result?.patches) && result.patches.length > 0) {
          const patches = result.patches as DocumentPatch[];
          const applied = applyDocumentPatches(editingDocument.content, patches);
          debugInfo.patchCounts = { first: patches.length };

          if (applied.failures.length === 0) {
            newContent = applied.text;
            setRevisionDebugInfo(debugInfo);
          } else {
            // Automatic retry once with more context (more sections + intro/outro)
            const excerpts2 = buildRevisionExcerpts(editingDocument.content, editPrompt, { maxSections: 6, includeIntroOutro: true });
            debugInfo.excerptCounts = { first: debugInfo.excerptCounts?.first ?? 0, retry: excerpts2.length };
            debugInfo.excerptsUsed = [
              ...(debugInfo.excerptsUsed || []),
              ...excerpts2.map((e, i) => `Retry Excerpt ${i + 1}: ${e.substring(0, 100)}...`),
            ];
            debugInfo.patchFailures = [{
              attempt: 'first',
              failures: applied.failures.slice(0, 10).map(f => ({ patchIndex: f.patchIndex, reason: f.reason })),
            }];
            
            const retry = await requestOnce({ ...basePayload, mode: 'patches', excerpts: excerpts2 });
            if (Array.isArray(retry?.patches) && retry.patches.length > 0) {
              const retryApplied = applyDocumentPatches(editingDocument.content, retry.patches as DocumentPatch[]);
              debugInfo.patchCounts = { ...debugInfo.patchCounts, retry: retry.patches.length };
              
              if (retryApplied.failures.length === 0) {
                newContent = retryApplied.text;
                setRevisionDebugInfo(debugInfo);
              } else {
                debugInfo.patchFailures.push({
                  attempt: 'retry',
                  failures: retryApplied.failures.slice(0, 10).map(f => ({ patchIndex: f.patchIndex, reason: f.reason })),
                });
                setRevisionDebugInfo(debugInfo);
                // Graceful failure: include limited diagnostics in console (dev only)
                if (process.env.NODE_ENV === 'development') {
                  // eslint-disable-next-line no-console
                  console.warn('[legalDocuments] Patch apply failed', {
                    failures: retryApplied.failures.slice(0, 5),
                    firstAttemptFailures: applied.failures.slice(0, 5),
                  });
                }
                throw new Error('Could not apply AI changes to the document. Try a more specific revision instruction (e.g., name the exact section header) and retry.');
              }
            } else if (typeof retry?.content === 'string' && retry.content.trim().length > 0) {
              // Back-compat: full revised content
              debugInfo.mode = 'full';
              setRevisionDebugInfo(debugInfo);
              newContent = retry.content;
            } else {
              setRevisionDebugInfo(debugInfo);
              throw new Error('AI did not return a usable patch or revised content.');
            }
          }
        } else if (typeof result?.content === 'string' && result.content.trim().length > 0) {
          // Back-compat: full revised content
          debugInfo.mode = 'full';
          setRevisionDebugInfo(debugInfo);
          newContent = result.content;
        } else {
          setRevisionDebugInfo(debugInfo);
          throw new Error('AI did not return a usable patch or revised content.');
        }
      }

      // Update document with revised content and/or new title
      const revisionHistory = editingDocument.revisionHistory || [];
      const updateData: {
        title: string;
        updatedAt: Timestamp;
        content?: string;
        revisionHistory?: Array<{ prompt: string; timestamp: Timestamp }>;
        requiresSignature?: boolean;
      } = {
        title: editTitle.trim(),
        updatedAt: Timestamp.now(),
      };
      updateData.requiresSignature = Boolean(editRequiresSignature);
      
      // Update content if there's a revision prompt OR if content was manually modified (e.g., diagram inserted)
      if (hasRevisionPrompt || contentManuallyModified) {
        updateData.content = newContent;
      }
      
      // Only update revision history if there's an actual revision prompt
      if (hasRevisionPrompt) {
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

      setMessage({ type: 'success', text: hasRevisionPrompt && !contentManuallyModified ? 'Document revised successfully!' : 'Saved successfully!' });
      setIsEditModalOpen(false);
      setEditingDocument(null);
      setEditPrompt('');
      setEditTitle('');
      setEditRequiresSignature(false);
      setContentManuallyModified(false);
      loadDocuments();
    } catch (error) {
      console.error('Error revising document:', error);
      let errorMessage = 'Failed to revise document';
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('pattern') || error.message.includes('invalid') || error.message.includes('permission')) {
          errorMessage = `Firestore error: ${error.message}. Please check that all fields are valid.`;
        }
      }
      setMessage({ type: 'error', text: errorMessage });
      setEditError(errorMessage);
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
    setSigners(buildDefaultSignersForLegalDoc(document));
    setIsSigningModalOpen(true);
  };

  // Send document for signature
  const handleSendForSignature = async () => {
    if (!signingDocument) return;

    const normalized = signers.map(s => ({
      ...s,
      name: (s.name || '').trim(),
      email: (s.email || '').trim().toLowerCase(),
    }));

    if (normalized.length === 0 || normalized.some(s => !s.name || !s.email)) {
      setMessage({ type: 'error', text: 'Please fill in name and email for all signers' });
      return;
    }

    setIsSending(true);

    try {
      const signingGroupId = `${signingDocument.id}-${Date.now()}`;
      const signingRequestIds: string[] = [];

      for (let i = 0; i < normalized.length; i++) {
        const signer = normalized[i];

        let requestId = signer.signingRequestId;
        if (!requestId) {
          const requestData: any = {
        documentType: signingDocument.documentType,
        documentName: signingDocument.title,
            recipientName: signer.name,
            recipientEmail: signer.email,
        status: 'pending',
        createdAt: serverTimestamp(),
        legalDocumentId: signingDocument.id,
        documentContent: signingDocument.content,
            signerRole: signer.role,
            stakeholderId: signer.stakeholderId || null,
            signingGroupId,
            signingOrder: i + 1,
      };

      const docRef = await addDoc(collection(db, 'signingRequests'), requestData);
          requestId = docRef.id;
        }

        signingRequestIds.push(requestId);

      const response = await fetch('/.netlify/functions/send-signing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            documentId: requestId,
          documentName: signingDocument.title,
          documentType: signingDocument.documentType,
            recipientName: signer.name,
            recipientEmail: signer.email,
        }),
      });

      if (!response.ok) {
          throw new Error(`Failed to send email to ${signer.email}`);
        }
      }

      // Update the legal document with signing request IDs
      await updateDoc(doc(db, 'legal-documents', signingDocument.id), {
        signingRequestId: signingRequestIds[0],
        signingRequestIds,
        updatedAt: Timestamp.now(),
      });

      setMessage({ type: 'success', text: `Document sent to ${signingRequestIds.length} signer(s)!` });
      setIsSigningModalOpen(false);
      setSigningDocument(null);
      setSigners([]);
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

  // Check if a document requires signature (explicit flag preferred; fallback for legacy docs)
  const requiresSignature = (document: LegalDocument): boolean => {
    return Boolean(document.requiresSignature ?? SIGNATURE_REQUIRED_TYPES.includes(document.documentType));
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

  // Open Exhibits Modal
  const openExhibitsModal = (document: LegalDocument) => {
    setExhibitsDocument(document);
    setSelectedExhibits(document.exhibits || []);
    setIsExhibitsModalOpen(true);
  };

  // Toggle exhibit selection
  const toggleExhibit = (exhibitId: string) => {
    setSelectedExhibits(prev => 
      prev.includes(exhibitId) 
        ? prev.filter(id => id !== exhibitId)
        : [...prev, exhibitId]
    );
  };

  // Save exhibits to document
  const handleSaveExhibits = async () => {
    if (!exhibitsDocument) return;

    setIsSavingExhibits(true);
    try {
      await updateDoc(doc(db, 'legal-documents', exhibitsDocument.id), {
        exhibits: selectedExhibits,
        updatedAt: Timestamp.now()
      });

      setMessage({ type: 'success', text: `${selectedExhibits.length} exhibit(s) attached successfully!` });
      setIsExhibitsModalOpen(false);
      setExhibitsDocument(null);
      loadDocuments();
    } catch (error) {
      console.error('Error saving exhibits:', error);
      setMessage({ type: 'error', text: 'Failed to save exhibits' });
    } finally {
      setIsSavingExhibits(false);
    }
  };

  // Get exhibit documents for a document
  const getExhibitDocuments = (documentId: string): LegalDocument[] => {
    const document = documents.find(d => d.id === documentId);
    if (!document?.exhibits?.length) return [];
    return documents.filter(d => document.exhibits?.includes(d.id));
  };

  // Check if document is a project/planning type (not legal)
  const isProjectDocument = (docType: string): boolean => {
    return ['custom', 'proposal', 'system-design'].includes(docType);
  };

  // Improved content formatter that properly handles markdown
  const formatContentForPdf = (content: string, isProject: boolean = false): string => {
    // Normalize line endings
    let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // First, extract and preserve code blocks (for ASCII diagrams)
    const codeBlocks: string[] = [];
    const codeBlockPlaceholder = '___CODE_BLOCK___';
    result = result.replace(/```[\s\S]*?```/g, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `${codeBlockPlaceholder}${index}${codeBlockPlaceholder}`;
    });
    
    // Also detect and preserve ASCII diagrams that are NOT in code blocks
    // Look for patterns like box-drawing characters, numbered items with boxes, etc.
    const allLines = result.split('\n');
    const diagramBlocks: Array<{ start: number; end: number; placeholder: string }> = [];
    let diagramStart = -1;
    let diagramLines: string[] = [];
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];
      const trimmed = line.trim();
      
      // Check if this line looks like part of an ASCII diagram
      // More lenient detection - any line with box chars, or patterns like "DATA →", or numbered items with vertical bars
      const hasBoxChars = /[┌┐└┘│─├┤┬┴┼]/.test(line) || /^[\+\|][\-\|]+[\+\|]/.test(trimmed);
      const hasDiagramTitle = /(DATA\s*→|DELIVERY\s*LOOP|Implementation\s+Diagram)/i.test(trimmed);
      const hasNumberedBox = /^\d+\)\s+.*\|/.test(trimmed) || /^\|\s*\d+\)/.test(trimmed);
      const hasBoxStructure = /^\|[\s\S]*\|$/.test(trimmed) && trimmed.length > 10;
      
      if (hasBoxChars || hasDiagramTitle || hasNumberedBox || hasBoxStructure) {
        if (diagramStart === -1) {
          diagramStart = i;
          diagramLines = [];
        }
        diagramLines.push(line);
      } else if (diagramStart !== -1) {
        // We were in a diagram but hit a non-diagram line
        // If we have at least 5 lines, it's probably a diagram
        if (diagramLines.length >= 5) {
          const diagramContent = diagramLines.join('\n');
          const index = codeBlocks.length;
          codeBlocks.push(diagramContent);
          diagramBlocks.push({ 
            start: diagramStart, 
            end: i - 1, 
            placeholder: `${codeBlockPlaceholder}${index}${codeBlockPlaceholder}` 
          });
        }
        diagramStart = -1;
        diagramLines = [];
      }
    }
    
    // Handle diagram at end of document
    if (diagramStart !== -1 && diagramLines.length >= 5) {
      const diagramContent = diagramLines.join('\n');
      const index = codeBlocks.length;
      codeBlocks.push(diagramContent);
      diagramBlocks.push({ 
        start: diagramStart, 
        end: allLines.length - 1, 
        placeholder: `${codeBlockPlaceholder}${index}${codeBlockPlaceholder}` 
      });
    }
    
    // Replace detected diagram blocks with placeholders (in reverse order to preserve indices)
    const newLines = [...allLines];
    for (let i = diagramBlocks.length - 1; i >= 0; i--) {
      const block = diagramBlocks[i];
      newLines.splice(block.start, block.end - block.start + 1, block.placeholder);
    }
    result = newLines.join('\n');
    
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
      
      // Check for code block placeholder
      const codeBlockMatch = line.match(new RegExp(`${codeBlockPlaceholder}(\\d+)${codeBlockPlaceholder}`));
      if (codeBlockMatch) {
        // Close any open list
        if (inList) {
          processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
          inList = false;
          listType = null;
        }
        
        // Extract code block content (remove ``` markers)
        const codeBlockIndex = parseInt(codeBlockMatch[1], 10);
        const codeBlockContent = codeBlocks[codeBlockIndex];
        const codeContent = codeBlockContent
          .replace(/^```[\s\n]*/, '')  // Remove opening ```
          .replace(/[\s\n]*```$/, '')  // Remove closing ```
          .replace(/&/g, '&amp;')      // Escape HTML entities
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        // Wrap in <pre> tag with monospace styling
        processedLines.push(`<pre class="ascii-diagram">${codeContent}</pre>`);
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
      
      // Check for bullet points (-, •, *, en-dash, em-dash). Allow missing space after marker.
      // Examples:
      // - Item
      // •Item
      // * Item
      // – Item
      // — Item
      const bulletMatch = trimmedLine.match(/^([-•*]|–|—)\s*(.+)$/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) processedLines.push(listType === 'ol' ? '</ol>' : '</ul>');
          processedLines.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        processedLines.push(`<li>${bulletMatch[2]}</li>`);
        continue;
      }
      
      // Check for numbered lists:
      // 1. Item
      // 1) Item
      // a. Item
      // i. Item
      const numberedMatch = trimmedLine.match(/^([0-9]+|[a-z]|[ivxlc]+)[\.\)]\s+(.+)$/i);
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
      
      // If line has box-drawing characters, preserve it with monospace (even if not in a full diagram block)
      // This catches individual diagram lines that might have been missed by the block detection
      if (/[┌┐└┘│─├┤┬┴┼]/.test(line) || /^[\+\|][\-\|]+[\+\|]/.test(trimmedLine) || /^\|[\s\S]*\|$/.test(trimmedLine)) {
        const escapedLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        processedLines.push(`<pre class="ascii-diagram" style="margin: 0; padding: 4px 0; background: transparent; border: none;">${escapedLine}</pre>`);
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

  // Generate PDF from document content
  const generatePdf = (document: LegalDocument) => {
    const includeSignature = requiresSignature(document);
    const isProject = isProjectDocument(document.documentType);
    const exhibitDocs = getExhibitDocuments(document.id);
    
    // Use different styling based on document type
    const html = isProject 
      ? generateProjectStylePdf(document, includeSignature, exhibitDocs)
      : generateLegalStylePdf(document, includeSignature, exhibitDocs);

    // Create a new window and write HTML directly
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // Write the HTML content immediately
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Function to clean up and print
      const cleanupAndPrint = () => {
        // Remove any "about:blank" text from the document
        try {
          const walker = printWindow.document.createTreeWalker(
            printWindow.document.body,
            NodeFilter.SHOW_TEXT,
            null
          );
          let node;
          while (node = walker.nextNode()) {
            if (node.textContent && node.textContent.includes('about:blank')) {
              node.textContent = node.textContent.replace(/about:blank/gi, '');
            }
          }
        } catch (e) {
          // Ignore errors
        }
        
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 100);
      };
      
      // Wait for the document to be ready, then print
      if (printWindow.document.readyState === 'complete') {
        cleanupAndPrint();
      } else {
        printWindow.addEventListener('load', cleanupAndPrint, { once: true });
        // Fallback timeout
        setTimeout(cleanupAndPrint, 1000);
      }
    }
  };

  // Generate exhibits HTML for PDF
  const generateExhibitsHtml = (exhibits: LegalDocument[]): string => {
    if (!exhibits.length) return '';
    
    return exhibits.map((exhibit, index) => `
      <div class="exhibit" style="page-break-before: always;">
        <div class="exhibit-header" style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333;">
          <h2 style="font-size: 18pt; margin: 0;">EXHIBIT ${String.fromCharCode(65 + index)}</h2>
          <p style="font-size: 12pt; color: #666; margin-top: 8px;">${exhibit.title}</p>
        </div>
        <div class="exhibit-content">
          ${formatContentForPdf(exhibit.content, false)}
        </div>
      </div>
    `).join('\n');
  };

  // Project/Planning style PDF (modern, readable)
  const generateProjectStylePdf = (document: LegalDocument, includeSignature: boolean, exhibits: LegalDocument[] = []): string => {
    const exhibitsHtml = generateExhibitsHtml(exhibits);
    const hasExhibits = exhibits.length > 0;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.title} - Pulse Intelligence Labs</title>
          <style>
            @page {
              margin: 0.75in 1in;
              /* Remove browser-added headers and footers (date, URL, etc.) */
              @top-left { content: ""; }
              @top-center { content: ""; }
              @top-right { content: ""; }
              @bottom-left { content: ""; }
              @bottom-center { content: ""; }
              @bottom-right { content: ""; }
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
              text-align: center;
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
            .exhibits-reference {
              margin-top: 40px;
              padding: 16px;
              background: #f5f5f5;
              border-radius: 8px;
            }
            .exhibits-reference h3 {
              margin-top: 0;
              color: #333;
            }
            .exhibits-reference ul {
              margin-bottom: 0;
            }
            .ascii-diagram {
              font-family: 'Courier New', Courier, monospace;
              font-size: 9pt;
              line-height: 1.4;
              white-space: pre;
              overflow-x: auto;
              background: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 16px;
              margin: 20px 0;
              color: #222;
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
          <script>
            // Remove any "about:blank" text from the page
            (function() {
              function removeAboutBlank() {
                try {
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );
                  let node;
                  while (node = walker.nextNode()) {
                    if (node.textContent && node.textContent.includes('about:blank')) {
                      node.textContent = node.textContent.replace(/about:blank/gi, '');
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              if (document.readyState === 'complete') {
                removeAboutBlank();
              } else {
                window.addEventListener('load', removeAboutBlank);
                document.addEventListener('DOMContentLoaded', removeAboutBlank);
              }
            })();
          </script>
        </head>
        <body>
          <div class="header">
            <div class="company-name">Pulse Intelligence Labs, Inc.</div>
            <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
          </div>
          
          <h1>${document.title}</h1>
          
          <div class="content">
            ${formatContentForPdf(document.content, true)}
          </div>
        
        ${hasExhibits ? `
          <div class="exhibits-reference">
            <h3>Exhibits</h3>
            <ul>
              ${exhibits.map((ex, i) => `<li><strong>Exhibit ${String.fromCharCode(65 + i)}:</strong> ${ex.title}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
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
          
          ${exhibitsHtml}
        </body>
      </html>
    `;
  };

  // Legal style PDF (formal, contract-style)
  const generateLegalStylePdf = (document: LegalDocument, includeSignature: boolean, exhibits: LegalDocument[] = []): string => {
    const exhibitsHtml = generateExhibitsHtml(exhibits);
    const hasExhibits = exhibits.length > 0;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${document.title} - Pulse Intelligence Labs</title>
          <style>
            @page {
              margin: 1in;
              /* Remove browser-added headers and footers (date, URL, etc.) */
              @top-left { content: ""; }
              @top-center { content: ""; }
              @top-right { content: ""; }
              @bottom-left { content: ""; }
              @bottom-center { content: ""; }
              @bottom-right { content: ""; }
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
            .exhibits-reference {
              margin-top: 40px;
              padding: 16px;
              border: 1px solid #ccc;
            }
            .exhibits-reference h3 {
              margin-top: 0;
              text-transform: uppercase;
              font-size: 12pt;
            }
            .ascii-diagram {
              font-family: 'Courier New', Courier, monospace;
              font-size: 9pt;
              line-height: 1.4;
              white-space: pre;
              overflow-x: auto;
              background: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 4px;
              padding: 16px;
              margin: 20px 0;
              color: #222;
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
          <script>
            // Remove any "about:blank" text from the page
            (function() {
              function removeAboutBlank() {
                try {
                  const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                  );
                  let node;
                  while (node = walker.nextNode()) {
                    if (node.textContent && node.textContent.includes('about:blank')) {
                      node.textContent = node.textContent.replace(/about:blank/gi, '');
                    }
                  }
                } catch (e) {
                  // Ignore errors
                }
              }
              
              if (document.readyState === 'complete') {
                removeAboutBlank();
              } else {
                window.addEventListener('load', removeAboutBlank);
                document.addEventListener('DOMContentLoaded', removeAboutBlank);
              }
            })();
          </script>
        </head>
        <body>
          <div class="header">
            <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
            <div class="document-date">Created: ${formatDate(document.createdAt)}</div>
          </div>
          
          <h1>${document.title}</h1>
          
          <div class="content">
            ${formatContentForPdf(document.content, false)}
          </div>
        
        ${hasExhibits ? `
          <div class="exhibits-reference">
            <h3>Exhibits</h3>
            <p>The following exhibits are attached hereto and incorporated herein by reference:</p>
            <ul>
              ${exhibits.map((ex, i) => `<li><strong>Exhibit ${String.fromCharCode(65 + i)}:</strong> ${ex.title}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
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
          
          ${exhibitsHtml}
        </body>
      </html>
    `;
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

            {/* Signature Requirement Toggle */}
            <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700">
              <div>
                <p className="text-sm font-medium text-white">Requires signature</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  When enabled, the PDF includes signature lines and e-signing tools are available.
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requiresSignatureChecked}
                  onChange={(e) => setRequiresSignatureChecked(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-12 h-7 rounded-full transition-colors ${requiresSignatureChecked ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-1 ${requiresSignatureChecked ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
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
                  const signingRequestsForDoc = getSigningRequestsForDocument(document.id);
                  const signingRequest = signingRequestsForDoc[0];
                  const needsSignature = requiresSignature(document);
                  
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
                              {signingRequestsForDoc.length > 1
                                ? `Sent to: ${signingRequestsForDoc.length} signers`
                                : `Sent to: ${signingRequest.recipientEmail}`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4 flex-wrap justify-end">
                        {document.status === 'completed' && (
                          <>
                            <button
                              onClick={() => window.open(`/legal-doc/${document.id}`, '_blank')}
                              className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
                            >
                              <Eye className="w-4 h-4" />
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
                              onClick={() => openExhibitsModal(document)}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                document.exhibits?.length
                                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                  : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                              }`}
                            >
                              <Paperclip className="w-4 h-4" />
                              Exhibits {document.exhibits?.length ? `(${document.exhibits.length})` : ''}
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
                        <div className="prose prose-invert prose-sm max-w-none max-h-96 overflow-y-auto">
                          <div
                            className="text-zinc-200 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: formatContentForPdf(document.content, true) }}
                          />
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
              {editError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-xl text-sm text-red-300">
                  {editError}
                </div>
              )}

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

              {/* Requires Signature */}
              <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-white">Requires signature</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Controls whether the PDF includes signature lines and whether e-signing tools are enabled.
                  </p>
                </div>
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editRequiresSignature}
                    onChange={(e) => setEditRequiresSignature(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-12 h-7 rounded-full transition-colors ${editRequiresSignature ? 'bg-orange-600' : 'bg-zinc-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform mt-1 ${editRequiresSignature ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Document Content <span className="text-zinc-500 font-normal">(editable)</span>
                </label>
                <textarea
                  value={editingDocument.content}
                  onChange={(e) => {
                    setEditingDocument({
                      ...editingDocument,
                      content: e.target.value,
                    });
                    setContentManuallyModified(true);
                  }}
                  className="w-full h-64 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-sm whitespace-pre-wrap"
                  placeholder="Document content will appear here..."
                />
                <p className="text-xs text-zinc-500 mt-2">
                  You can edit the document content directly here. Changes will be saved when you click "Save".
                </p>
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

              {/* Insert Diagram Section */}
              <div className="mt-4 border-t border-zinc-700 pt-4">
                <button
                  onClick={() => setShowDiagramSection(!showDiagramSection)}
                  className="flex items-center justify-between w-full text-left text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    Insert Diagram
                    <span className="text-xs text-zinc-500 font-normal">(ASCII box diagrams)</span>
                  </span>
                  <ChevronUp className={`w-4 h-4 transition-transform ${showDiagramSection ? '' : 'rotate-180'}`} />
                </button>
                
                {showDiagramSection && (
                  <div className="mt-4 space-y-4">
                    {/* Diagram Input */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Paste Your Diagram
                      </label>
                      <textarea
                        value={diagramInput}
                        onChange={(e) => handleDiagramInputChange(e.target.value)}
                        placeholder={`Paste your ASCII box diagram here. Example:

┌────────────┐
│ 1) Data Sources │
│ • Item one       │
│ • Item two       │
└────────────┘
       │
       v
┌────────────┐
│ 2) Next Step    │
└────────────┘`}
                        className="w-full h-48 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-none font-mono text-xs"
                      />
                      <p className="text-xs text-zinc-500 mt-2">
                        Paste your text-based diagram above. It will be automatically formatted with proper alignment and wrapped in a code block.
                      </p>
                    </div>

                    {/* Insert Position */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        Insert Position
                      </label>
                      <select
                        value={diagramPosition}
                        onChange={(e) => setDiagramPosition(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        <option value="end">At the end of document</option>
                        <option value="start">At the beginning of document</option>
                        {availableHeaders.length > 0 && (
                          <optgroup label="After section header">
                            {availableHeaders.map((header, idx) => (
                              <option key={idx} value={header}>
                                After: {header.length > 40 ? header.substring(0, 40) + '...' : header}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Diagram Preview */}
                    {diagramPreview && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                          Formatted Preview
                        </label>
                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-700 overflow-x-auto">
                          <pre className="text-xs text-green-400 font-mono whitespace-pre">
                            {diagramPreview}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Insert Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleInsertDiagram}
                        disabled={!diagramInput.trim()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          diagramInput.trim()
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        <span>📊</span>
                        Insert Diagram
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Revision Debug (Dev Only) */}
              {process.env.NODE_ENV === 'development' && revisionDebugInfo && (
                <div className="mt-4 border-t border-zinc-700 pt-4">
                  <button
                    onClick={() => setShowRevisionDebug(!showRevisionDebug)}
                    className="flex items-center justify-between w-full text-left text-sm font-medium text-zinc-400 hover:text-zinc-300 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">DEV</span>
                      Revision Debug Info
                    </span>
                    <ChevronUp className={`w-4 h-4 transition-transform ${showRevisionDebug ? '' : 'rotate-180'}`} />
                  </button>
                  
                  {showRevisionDebug && (
                    <div className="mt-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1">Mode:</p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {revisionDebugInfo.mode === 'patches' ? '✅ Patch-based' : revisionDebugInfo.mode === 'full' ? '📄 Full document' : '❌ Error'}
                        </p>
                      </div>
                      
                      {revisionDebugInfo.excerptCounts && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-400 mb-1">Excerpts Used:</p>
                          <p className="text-xs text-zinc-500">
                            First attempt: {revisionDebugInfo.excerptCounts.first} excerpt{revisionDebugInfo.excerptCounts.first !== 1 ? 's' : ''}
                            {revisionDebugInfo.excerptCounts.retry !== undefined && (
                              <> • Retry: {revisionDebugInfo.excerptCounts.retry} excerpt{revisionDebugInfo.excerptCounts.retry !== 1 ? 's' : ''}</>
                            )}
                          </p>
                        </div>
                      )}
                      
                      {revisionDebugInfo.patchCounts && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-400 mb-1">Patches Generated:</p>
                          <p className="text-xs text-zinc-500">
                            First attempt: {revisionDebugInfo.patchCounts.first} patch{revisionDebugInfo.patchCounts.first !== 1 ? 'es' : ''}
                            {revisionDebugInfo.patchCounts.retry !== undefined && (
                              <> • Retry: {revisionDebugInfo.patchCounts.retry} patch{revisionDebugInfo.patchCounts.retry !== 1 ? 'es' : ''}</>
                            )}
                          </p>
                        </div>
                      )}
                      
                      {revisionDebugInfo.excerptsUsed && revisionDebugInfo.excerptsUsed.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-zinc-400 mb-1">Excerpt Previews:</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {revisionDebugInfo.excerptsUsed.map((excerpt, idx) => (
                              <p key={idx} className="text-xs text-zinc-600 font-mono break-words">
                                {excerpt}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {revisionDebugInfo.patchFailures && revisionDebugInfo.patchFailures.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-1">Patch Failures:</p>
                          <div className="space-y-2">
                            {revisionDebugInfo.patchFailures.map((failure, idx) => (
                              <div key={idx} className="p-2 bg-red-900/20 rounded border border-red-800/50">
                                <p className="text-xs font-semibold text-red-300 mb-1">
                                  {failure.attempt === 'first' ? 'First Attempt' : 'Retry Attempt'}:
                                </p>
                                <div className="space-y-1">
                                  {failure.failures.slice(0, 5).map((f, fIdx) => (
                                    <p key={fIdx} className="text-xs text-red-400 font-mono">
                                      Patch #{f.patchIndex}: {f.reason}
                                    </p>
                                  ))}
                                  {failure.failures.length > 5 && (
                                    <p className="text-xs text-red-500 italic">
                                      ... and {failure.failures.length - 5} more
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                disabled={
                  isRevising ||
                  (!editPrompt.trim() &&
                    !contentManuallyModified &&
                    editTitle.trim() === editingDocument?.title &&
                    editRequiresSignature === Boolean(editingDocument?.requiresSignature ?? SIGNATURE_REQUIRED_TYPES.includes(editingDocument?.documentType || '')))
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isRevising ||
                  (!editPrompt.trim() &&
                    !contentManuallyModified &&
                    editTitle.trim() === editingDocument?.title &&
                    editRequiresSignature === Boolean(editingDocument?.requiresSignature ?? SIGNATURE_REQUIRED_TYPES.includes(editingDocument?.documentType || '')))
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isRevising ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editPrompt.trim() && !contentManuallyModified ? 'Revising...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {editPrompt.trim() && !contentManuallyModified ? 'Apply Changes' : 'Save'}
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
                  setSigners([]);
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

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-300">Signers</p>
                  <button
                    onClick={() => {
                      setSigners(prev => [
                        ...prev,
                        { id: `manual-${Date.now()}`, role: 'Signer', name: '', email: '' }
                      ]);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    + Add Signer
                  </button>
                </div>

                {signers.map((s, idx) => (
                  <div key={s.id} className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-700 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {s.role || `Signer ${idx + 1}`}
                        </span>
                        {s.signingRequestId ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/30 text-blue-300 border border-blue-800">
                            Existing link
                          </span>
                        ) : null}
                      </div>
                      <button
                        onClick={() => setSigners(prev => prev.filter(x => x.id !== s.id))}
                        className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Remove signer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                <div>
                      <label className="block text-xs text-zinc-400 mb-1">Stakeholder (optional)</label>
                      <select
                        value={s.stakeholderId || ''}
                        onChange={(e) => {
                          const stakeholderId = e.target.value || undefined;
                          const sh = stakeholderDirectory.find(st => st.id === stakeholderId);
                          setSigners(prev => prev.map(x => x.id === s.id ? {
                            ...x,
                            stakeholderId,
                            name: sh?.name || x.name,
                            email: sh?.email || x.email,
                          } : (x)));
                        }}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                      >
                        <option value="">Manual entry</option>
                        {stakeholderDirectory.map(st => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Name</label>
                  <input
                    type="text"
                          value={s.name}
                          onChange={(e) => setSigners(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                    placeholder="Enter the signer's full name"
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                <div>
                        <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <input
                    type="email"
                          value={s.email}
                          onChange={(e) => setSigners(prev => prev.map(x => x.id === s.id ? { ...x, email: e.target.value } : x))}
                    placeholder="Enter email address"
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                <p className="text-blue-400 text-sm flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Each signer will receive an email with a secure signing link. Existing links will be re-sent.
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
                  setSigners([]);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendForSignature}
                disabled={isSending || signers.length === 0 || signers.some(s => !s.name.trim() || !s.email.trim())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSending || signers.length === 0 || signers.some(s => !s.name.trim() || !s.email.trim())
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
                    Send to {signers.length} signer{signers.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exhibits Modal */}
      {isExhibitsModalOpen && exhibitsDocument && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-cyan-400" />
                  Attach Exhibits
                </h2>
                <p className="text-sm text-zinc-400 mt-1">{exhibitsDocument.title}</p>
              </div>
              <button
                onClick={() => {
                  setIsExhibitsModalOpen(false);
                  setExhibitsDocument(null);
                  setSelectedExhibits([]);
                }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-zinc-400 mb-4">
                Select documents to attach as exhibits. When you download the PDF, these will be included as Exhibit A, B, C, etc.
              </p>

              {documents.filter(d => d.id !== exhibitsDocument.id && d.status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No other documents available to attach as exhibits.</p>
                  <p className="text-sm mt-1">Generate more documents first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents
                    .filter(d => d.id !== exhibitsDocument.id && d.status === 'completed')
                    .map((doc, index) => {
                      const isSelected = selectedExhibits.includes(doc.id);
                      const exhibitIndex = selectedExhibits.indexOf(doc.id);
                      
                      return (
                        <button
                          key={doc.id}
                          onClick={() => toggleExhibit(doc.id)}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                            isSelected
                              ? 'bg-cyan-900/30 border-cyan-600'
                              : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                            isSelected
                              ? 'bg-cyan-600 text-white'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {isSelected ? String.fromCharCode(65 + exhibitIndex) : (index + 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                              {doc.title}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {DOCUMENT_TYPES.find(t => t.id === doc.documentType)?.label || doc.documentType} • {formatDate(doc.createdAt)}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-cyan-600 border-cyan-600'
                              : 'border-zinc-600'
                          }`}>
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {selectedExhibits.length > 0 && (
                <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-800 rounded-xl">
                  <p className="text-cyan-400 text-sm flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    <span>
                      <strong>{selectedExhibits.length}</strong> exhibit{selectedExhibits.length !== 1 ? 's' : ''} will be attached to this document.
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => {
                  setIsExhibitsModalOpen(false);
                  setExhibitsDocument(null);
                  setSelectedExhibits([]);
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExhibits}
                disabled={isSavingExhibits}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSavingExhibits
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-cyan-500'
                }`}
              >
                {isSavingExhibits ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Paperclip className="w-4 h-4" />
                    Save Exhibits
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
