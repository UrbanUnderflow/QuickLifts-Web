import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import Head from 'next/head';
import { FileText, Send, Check, Clock, Download, Eye, Trash2, Plus, X, Mail, RefreshCw } from 'lucide-react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface DocumentTemplate {
  id: string;
  name: string;
  type: 'advisor' | 'contractor';
  recipientName: string;
  description: string;
}

interface SigningRequest {
  id: string;
  documentType: 'advisor' | 'contractor';
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed';
  createdAt: Timestamp;
  sentAt?: Timestamp;
  viewedAt?: Timestamp;
  signedAt?: Timestamp;
  signatureData?: {
    typedName: string;
    signatureFont: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
  };
  documentHash?: string;
}

// Pre-defined document templates
const documentTemplates: DocumentTemplate[] = [
  {
    id: 'test-document',
    name: 'Test Document',
    type: 'advisor',
    recipientName: 'Test User',
    description: '⚠️ Test document for verifying signing flow - DELETE after testing'
  },
  {
    id: 'bobby-advisor',
    name: 'Independent Advisor Agreement',
    type: 'advisor',
    recipientName: 'Bobby Nweke',
    description: 'Advisory / Trial Contractor Agreement for Chief of Staff role'
  },
  {
    id: 'lola-contractor',
    name: 'Independent Contractor Agreement',
    type: 'contractor',
    recipientName: 'Lola',
    description: 'Design contractor agreement with $100/month retainer'
  }
];

const DocumentSigningAdmin: React.FC = () => {
  const router = useRouter();
  const [signingRequests, setSigningRequests] = useState<SigningRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchSigningRequests();
  }, []);

  const fetchSigningRequests = async () => {
    try {
      setLoading(true);
      const requestsRef = collection(db, 'signingRequests');
      const q = query(requestsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const requests: SigningRequest[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SigningRequest));
      
      setSigningRequests(requests);
    } catch (error) {
      console.error('Error fetching signing requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendDocument = async () => {
    if (!selectedTemplate || !recipientEmail) return;
    
    setSending(true);
    setSendStatus(null);
    
    try {
      // Create the signing request in Firestore first
      const requestData = {
        documentType: selectedTemplate.type,
        documentName: selectedTemplate.name,
        recipientName: selectedTemplate.recipientName,
        recipientEmail: recipientEmail.toLowerCase().trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'signingRequests'), requestData);
      
      // Send the email via Netlify function
      const response = await fetch('/.netlify/functions/send-signing-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docRef.id,
          documentName: selectedTemplate.name,
          documentType: selectedTemplate.type,
          recipientName: selectedTemplate.recipientName,
          recipientEmail: recipientEmail.toLowerCase().trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send email');
      }
      
      setSendStatus({ type: 'success', message: 'Document sent successfully!' });
      setRecipientEmail('');
      setShowSendModal(false);
      setSelectedTemplate(null);
      fetchSigningRequests();
    } catch (error) {
      console.error('Error sending document:', error);
      setSendStatus({ type: 'error', message: 'Failed to send document. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this signing request?')) return;
    
    try {
      await deleteDoc(doc(db, 'signingRequests', requestId));
      fetchSigningRequests();
    } catch (error) {
      console.error('Error deleting request:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      viewed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      signed: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-3 h-3" />,
      sent: <Mail className="w-3 h-3" />,
      viewed: <Eye className="w-3 h-3" />,
      signed: <Check className="w-3 h-3" />,
    };
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '—';
    return timestamp.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Document Signing | Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#0d1117] text-white p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Document Signing Portal</h1>
              <p className="text-zinc-400">Send, track, and manage legally-binding document signatures</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              ← Back to Admin
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-400 text-sm mb-1">Total Documents</p>
              <p className="text-2xl font-bold">{signingRequests.length}</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-400 text-sm mb-1">Pending</p>
              <p className="text-2xl font-bold text-yellow-400">
                {signingRequests.filter(r => r.status === 'pending' || r.status === 'sent').length}
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-400 text-sm mb-1">Viewed</p>
              <p className="text-2xl font-bold text-purple-400">
                {signingRequests.filter(r => r.status === 'viewed').length}
              </p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-zinc-400 text-sm mb-1">Signed</p>
              <p className="text-2xl font-bold text-green-400">
                {signingRequests.filter(r => r.status === 'signed').length}
              </p>
            </div>
          </div>

          {/* Document Templates */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Documents Requiring Signatures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {documentTemplates.map((template) => {
                const existingRequest = signingRequests.find(
                  r => r.documentType === template.type && r.recipientName === template.recipientName
                );
                
                return (
                  <div
                    key={template.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-5 hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#E0FE10]/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#E0FE10]" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{template.name}</h3>
                          <p className="text-zinc-400 text-sm">{template.recipientName}</p>
                        </div>
                      </div>
                      {existingRequest && getStatusBadge(existingRequest.status)}
                    </div>
                    <p className="text-zinc-500 text-sm mb-4">{template.description}</p>
                    <div className="flex items-center gap-2">
                      {!existingRequest || existingRequest.status !== 'signed' ? (
                        <button
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowSendModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-lg text-sm font-medium transition-colors"
                        >
                          <Send className="w-4 h-4" />
                          {existingRequest ? 'Resend' : 'Send for Signature'}
                        </button>
                      ) : (
                        <a
                          href={`/api/download-signed-document?id=${existingRequest.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download Signed
                        </a>
                      )}
                      {existingRequest && (
                        <button
                          onClick={() => window.open(`/sign/${existingRequest.id}`, '_blank')}
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signing Requests Table */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Signing Requests</h2>
              <button
                onClick={fetchSigningRequests}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            
            {loading ? (
              <div className="p-12 text-center text-zinc-400">Loading...</div>
            ) : signingRequests.length === 0 ? (
              <div className="p-12 text-center text-zinc-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No signing requests yet</p>
                <p className="text-sm mt-1">Send a document above to get started</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-zinc-400 text-sm font-medium">Document</th>
                    <th className="text-left px-6 py-3 text-zinc-400 text-sm font-medium">Recipient</th>
                    <th className="text-left px-6 py-3 text-zinc-400 text-sm font-medium">Status</th>
                    <th className="text-left px-6 py-3 text-zinc-400 text-sm font-medium">Sent</th>
                    <th className="text-left px-6 py-3 text-zinc-400 text-sm font-medium">Signed</th>
                    <th className="text-right px-6 py-3 text-zinc-400 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {signingRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-zinc-800/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-zinc-500" />
                          <span className="text-white">{request.documentName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white">{request.recipientName}</p>
                          <p className="text-zinc-500 text-sm">{request.recipientEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                      <td className="px-6 py-4 text-zinc-400 text-sm">{formatDate(request.sentAt || request.createdAt)}</td>
                      <td className="px-6 py-4 text-zinc-400 text-sm">{formatDate(request.signedAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {request.status === 'signed' && (
                            <button
                              onClick={() => window.open(`/sign/${request.id}?download=true`, '_blank')}
                              className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => window.open(`/sign/${request.id}`, '_blank')}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-zinc-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteRequest(request.id)}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Compliance Note */}
          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <h3 className="text-blue-400 font-medium mb-2">📋 Compliance & Legal Notice</h3>
            <p className="text-zinc-400 text-sm">
              All signatures are legally binding under the ESIGN Act and UETA. Each signature captures: timestamp, 
              IP address, user agent, typed name, and document hash. All data is stored in Firestore for audit purposes.
            </p>
          </div>
        </div>
      </div>

      {/* Send Document Modal */}
      {showSendModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Send Document for Signature</h3>
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setSelectedTemplate(null);
                    setRecipientEmail('');
                    setSendStatus(null);
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
                <p className="text-zinc-400 text-sm mb-1">Document</p>
                <p className="text-white font-medium">{selectedTemplate.name}</p>
                <p className="text-zinc-500 text-sm mt-1">For: {selectedTemplate.recipientName}</p>
              </div>
              
              <div className="mb-6">
                <label className="block text-zinc-400 text-sm mb-2">Recipient Email</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10]"
                />
              </div>
              
              {sendStatus && (
                <div className={`p-3 rounded-lg mb-4 ${
                  sendStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {sendStatus.message}
                </div>
              )}
              
              <button
                onClick={handleSendDocument}
                disabled={!recipientEmail || sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E0FE10] hover:bg-[#c8e60e] disabled:bg-zinc-700 disabled:text-zinc-500 text-black rounded-xl font-medium transition-colors"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
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

export default DocumentSigningAdmin;

