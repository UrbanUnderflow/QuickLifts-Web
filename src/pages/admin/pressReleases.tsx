import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, onSnapshot, updateDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Calendar, RefreshCw, Clock, FileText, ChevronRight, AlertCircle, CheckCircle, AlertTriangle, ArrowUpRight, Edit2, Trash2, Loader2, CalendarCheck2 } from 'lucide-react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import axios from 'axios';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Types
interface FunctionMetadata {
  id: string;
  lastRunAt: number;
  lastRunStatus: 'success' | 'error' | 'in_progress';
  lastRunError?: string;
  lastResultId?: string;
  runCount: number;
  nextScheduledRun?: number;
  schedule?: string;
}

interface PressRelease {
  id: string;
  title: string;
  summary?: string;
  content: string;
  generatedAt?: number;
  publishedAt?: Timestamp | Date;
  status: 'draft' | 'published' | 'archived' | 'error';
  kpiSnapshotId?: string;
  githubPrUrl?: string;
  mdxPath?: string;
  imageUrl?: string;
  tags?: string[];
  createdAt: Timestamp | Date;
  snapshotDate?: Timestamp | Date;
  metrics?: { [key: string]: number | string };
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
  return dateObject.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Status badge component
const StatusBadge: React.FC<{ status: PressRelease['status'] }> = ({ status }) => {
  let bgColor, textColor, borderColor;
  switch (status) {
    case 'published':
      bgColor = 'bg-green-900/30'; textColor = 'text-green-400'; borderColor = 'border-green-800'; break;
    case 'archived':
      bgColor = 'bg-gray-700/30'; textColor = 'text-gray-400'; borderColor = 'border-gray-600'; break;
    case 'error':
      bgColor = 'bg-red-900/30'; textColor = 'text-red-400'; borderColor = 'border-red-800'; break;
    case 'draft':
    default:
      bgColor = 'bg-yellow-900/30'; textColor = 'text-yellow-400'; borderColor = 'border-yellow-800'; break;
  }
  return (
    <span className={`px-2 py-1 ${bgColor} ${textColor} rounded-full text-xs font-medium border ${borderColor}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Updated PressReleaseCard component
interface PressReleaseCardProps {
  release: PressRelease;
  onClick: () => void;
  isSelected: boolean;
}

const PressReleaseCard: React.FC<PressReleaseCardProps> = ({ release, onClick, isSelected }) => {
  return (
    <li
      onClick={onClick}
      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
        isSelected
          ? 'bg-[#2a2f36] border-[#d7ff00]/50'
          : 'bg-[#262a30] border-gray-700 hover:bg-[#2a2f36] hover:border-gray-600'
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-medium text-white truncate pr-2">{release.title}</h3>
        <StatusBadge status={release.status} />
      </div>
      <p className="text-xs text-gray-400">
        Created: {formatDate(release.createdAt)}
        {release.publishedAt && ` | Published: ${formatDate(release.publishedAt)}`}
        {release.snapshotDate && ` | Metrics Date: ${formatDate(release.snapshotDate)}`}
      </p>
    </li>
  );
};

const PressReleasesAdmin: React.FC = () => {
  const [functionMetadata, setFunctionMetadata] = useState<FunctionMetadata | null>(null);
  const [lastPressRelease, setLastPressRelease] = useState<PressRelease | null>(null);
  const [recentPressReleases, setRecentPressReleases] = useState<PressRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringRelease, setTriggeringRelease] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pressReleases, setPressReleases] = useState<PressRelease[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [isGeneratingKpi, setIsGeneratingKpi] = useState(false);
  const [kpiStatusMessage, setKpiStatusMessage] = useState<string | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<PressRelease | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  
  // Load function metadata and recent press releases
  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch function metadata
      const metadataRef = doc(db, 'functionMetadata', 'draftPress');
      const metadataSnap = await getDoc(metadataRef);
      
      if (metadataSnap.exists()) {
        const metadata = metadataSnap.data() as FunctionMetadata;
        setFunctionMetadata(metadata);
        
        // If we have a last result ID, fetch that press release
        if (metadata.lastResultId) {
          const releaseRef = doc(db, 'pressReleases', metadata.lastResultId);
          const releaseSnap = await getDoc(releaseRef);
          
          if (releaseSnap.exists()) {
            setLastPressRelease(releaseSnap.data() as PressRelease);
          }
        }
      }
      
      // Fetch recent press releases
      const releasesQuery = query(
        collection(db, 'pressReleases'),
        orderBy('generatedAt', 'desc'),
        limit(5)
      );
      
      const releasesSnap = await getDocs(releasesQuery);
      const releases = releasesSnap.docs.map(doc => ({ 
        ...doc.data(),
        id: doc.id 
      })) as PressRelease[];
      
      setRecentPressReleases(releases);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load data. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Trigger a new press release generation
  const triggerPressRelease = async () => {
    try {
      setTriggeringRelease(true);
      setMessage({
        type: 'info',
        text: 'Triggering press release generation...'
      });
      
      // Get current user ID token for authentication
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('You must be logged in to trigger a press release');
      }
      
      const idToken = await user.getIdToken();
      
      // Call the Netlify function
      const response = await axios.post('/.netlify/functions/triggerDraftPress', {}, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      
      const result = response.data;
      
      if (result.success) {
        setMessage({
          type: 'success',
          text: 'Press release generated successfully! Refresh to see the new data.'
        });
        
        // Reload data after a short delay
        setTimeout(() => {
          loadData();
        }, 2000);
      } else {
        setMessage({
          type: 'error',
          text: `Failed to generate press release: ${result.error || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('Error triggering press release:', error);
      setMessage({
        type: 'error',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTriggeringRelease(false);
    }
  };

  // Handle manual press release generation
  const handleGeneratePressRelease = async () => {
    setGenerating(true);
    setGenerationMessage(null);
    setError(null);

    try {
      console.log("Attempting to call /triggerDraftPress...");
      const response = await axios.post('/.netlify/functions/triggerDraftPress'); 
      console.log("triggerDraftPress response:", response.data);
      if (response.data.success) {
        setGenerationMessage(response.data.message || "Draft press release generated successfully! It might take a moment to appear.");
      } else {
        throw new Error(response.data.error || "Failed to trigger draft generation.");
      }
    } catch (err) {
      console.error("Error triggering press release generation:", err);
      let message = 'An unknown error occurred.';
      if (err instanceof Error) {
          message = err.message;
      } else if (axios.isAxiosError(err) && err.response) {
          message = err.response.data?.error || err.response.data?.message || err.message;
      }
      setError(`Error generating press release: ${message}`);
      setGenerationMessage(`Error: ${message}`);
    } finally {
      setGenerating(false);
      setTimeout(() => setGenerationMessage(null), 5000);
    }
  };

  // Handle manual KPI snapshot generation
  const handleGenerateKpiSnapshot = async () => {
    setIsGeneratingKpi(true);
    setKpiStatusMessage('Generating KPI snapshot...');
    setError(null); // Reset general error

    try {
      console.log("Attempting to call /triggerGenerateKpiSnapshot...");
      // Call the NEW trigger function endpoint
      const response = await axios.post('/.netlify/functions/triggerGenerateKpiSnapshot');
      
      console.log("triggerGenerateKpiSnapshot response:", response.data);

      if (response.data.success) {
        setKpiStatusMessage(response.data.message || "KPI snapshot generated successfully!");
      } else {
        throw new Error(response.data.error || "Failed to generate KPI snapshot.");
      }
    } catch (err) {
      console.error("Error triggering KPI snapshot generation:", err);
      let message = 'An unknown error occurred.';
      if (err instanceof Error) {
          message = err.message;
      } else if (axios.isAxiosError(err) && err.response) {
          message = err.response.data?.error || err.response.data?.message || err.message;
      }
      setKpiStatusMessage(`Error: ${message}`);
    } finally {
      setIsGeneratingKpi(false);
       // Add a small delay before clearing the message
      setTimeout(() => setKpiStatusMessage(null), 5000);
    }
  };

  // Handle viewing a press release
  const handleView = (release: PressRelease) => {
    setSelectedRelease(release);
    setIsEditing(false);
    setEditedTitle(release.title);
    setEditedContent(release.content);
  };

  // Handle starting the edit mode
  const handleEdit = () => {
    if (selectedRelease) {
      setIsEditing(true);
      setEditedTitle(selectedRelease.title);
      setEditedContent(selectedRelease.content);
    }
  };

  // Handle saving edits
  const handleSave = async () => {
    if (!selectedRelease) return;
    setSaving(true);
    setError(null);
    try {
      const releaseRef = doc(db, 'pressReleases', selectedRelease.id);
      await updateDoc(releaseRef, {
        title: editedTitle,
        content: editedContent,
        updatedAt: Timestamp.now()
      });
      setSelectedRelease(prev => prev ? { ...prev, title: editedTitle, content: editedContent } : null);
      setIsEditing(false);
    } catch (err) {
      console.error("Error updating press release: ", err);
      setError(`Failed to save changes. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle publishing a press release
  const handlePublish = async (id: string) => {
    if (!window.confirm("Are you sure you want to publish this press release?")) return;
    
    setError(null);
    try {
      const releaseRef = doc(db, 'pressReleases', id);
      const now = Timestamp.now(); // Use Firestore Timestamp for consistency
      await updateDoc(releaseRef, {
        status: 'published',
        publishedAt: now
      });
      if (selectedRelease?.id === id) {
        setSelectedRelease(prev => prev ? { ...prev, status: 'published', publishedAt: now } : null);
      }
    } catch (err) {
      console.error("Error publishing press release: ", err);
      setError(`Failed to publish press release. ${err instanceof Error ? err.message : ''}`);
    }
  };

  // Handle archiving a press release
  const handleArchive = async (id: string) => {
    if (!window.confirm("Are you sure you want to archive this press release?")) return;
    
    setError(null);
    try {
      const releaseRef = doc(db, 'pressReleases', id);
      await updateDoc(releaseRef, {
        status: 'archived',
      });
      if (selectedRelease?.id === id) {
        setSelectedRelease(prev => prev ? { ...prev, status: 'archived' } : null);
      }
    } catch (err) {
      console.error("Error archiving press release: ", err);
       setError(`Failed to archive press release. ${err instanceof Error ? err.message : ''}`);
    }
  };

  // Handle deleting a press release
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY DELETE this press release?")) return;
    
    setError(null);
    try {
      const releaseRef = doc(db, 'pressReleases', id);
      await deleteDoc(releaseRef);
      if (selectedRelease?.id === id) {
        setSelectedRelease(null);
      }
    } catch (err) {
      console.error("Error deleting press release: ", err);
      setError(`Failed to delete press release. ${err instanceof Error ? err.message : ''}`);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Dismiss message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Press Releases | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up { animation: fadeInUp 0.3s ease-out forwards; }
        `}</style>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 flex items-center">
            <FileText className="mr-3 text-[#d7ff00]" /> Press Releases Management
          </h1>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-gray-800">
            {/* Generate KPI Snapshot Button */}
            <div className="flex flex-col items-start">
              <button
                onClick={handleGenerateKpiSnapshot}
                disabled={isGeneratingKpi}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                  isGeneratingKpi
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-700/80 hover:bg-indigo-600/80 text-white'
                }`}
              >
                {isGeneratingKpi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarCheck2 className="h-4 w-4" />
                )}
                {isGeneratingKpi ? 'Generating KPIs...' : 'Generate KPI Snapshot'}
              </button>
              {kpiStatusMessage && (
                <p className={`mt-1 text-xs ${kpiStatusMessage.startsWith('Error:') ? 'text-red-400' : 'text-indigo-300'}`}>
                  {kpiStatusMessage}
                </p>
              )}
            </div>

            {/* Generate Press Release Button */}
            <div className="flex flex-col items-start">
              <button
                onClick={handleGeneratePressRelease}
                disabled={generating}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm ${
                  generating
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-700/80 hover:bg-purple-600/80 text-white'
                }`}
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {generating ? 'Generating Draft...' : 'Generate Press Release'}
              </button>
              {generationMessage && (
                <p className={`mt-1 text-xs ${generationMessage.startsWith('Error:') ? 'text-red-400' : 'text-purple-300'}`}>
                  {generationMessage}
                </p>
              )}
            </div>
          </div>

          {/* General Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-300 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Press Releases List - NOW USES PressReleaseCard */}
            <div className="lg:col-span-1 bg-[#1a1e24] rounded-xl p-6 shadow-xl border border-gray-800 max-h-[70vh] overflow-y-auto">
              <h2 className="text-lg font-semibold mb-4 text-white">Available Releases</h2>
              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 text-[#d7ff00] animate-spin" />
                </div>
              ) : pressReleases.length === 0 ? (
                <p className="text-gray-400 text-center py-5">No press releases found.</p>
              ) : (
                <ul className="space-y-3">
                  {pressReleases.map((release) => (
                    <PressReleaseCard
                      key={release.id}
                      release={release}
                      onClick={() => handleView(release)}
                      isSelected={selectedRelease?.id === release.id}
                    />
                  ))}
                </ul>
              )}
            </div>

            {/* Press Release Detail / Edit View */}
            <div className="lg:col-span-2 bg-[#1a1e24] rounded-xl p-6 shadow-xl border border-gray-800">
              {selectedRelease ? (
                <div className="flex flex-col h-full">
                  {isEditing ? (
                    // EDIT MODE
                    <>
                      <h2 className="text-lg font-semibold mb-4 text-white">Editing Press Release</h2>
                      <div className="mb-4">
                        <label htmlFor="editTitle" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                        <input
                          type="text"
                          id="editTitle"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white"
                        />
                      </div>
                      <div className="mb-4 flex-grow">
                        <label htmlFor="editContent" className="block text-sm font-medium text-gray-300 mb-1">Content (Markdown)</label>
                        <textarea
                          id="editContent"
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={15}
                          className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-3 mt-4">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${saving ? 'bg-gray-600 text-gray-400' : 'bg-[#d7ff00] hover:bg-[#c8e40d] text-black'}`}
                        >
                          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                          Save Changes
                        </button>
                      </div>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h2 className="text-xl font-semibold mb-1 text-white">{selectedRelease.title}</h2>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                            <StatusBadge status={selectedRelease.status} />
                            <span>Created: {formatDate(selectedRelease.createdAt)}</span>
                            {selectedRelease.publishedAt && <span>Published: {formatDate(selectedRelease.publishedAt)}</span>}
                            {selectedRelease.snapshotDate && <span>Metrics Date: {formatDate(selectedRelease.snapshotDate)}</span>}
                          </div>
                          {selectedRelease.metrics && Object.keys(selectedRelease.metrics).length > 0 && (
                            <div className="mt-3 text-xs text-gray-400 bg-gray-800/50 p-2 rounded inline-block border border-gray-700">
                              <span className="font-medium text-gray-300">Key Metrics: </span>
                              {Object.entries(selectedRelease.metrics)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(' | ')}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-4">
                           {selectedRelease.status === 'draft' && (
                            <button
                              onClick={handleEdit}
                              className="p-2 bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {selectedRelease.status === 'draft' && (
                            <button
                              onClick={() => handlePublish(selectedRelease.id)}
                              className="p-2 bg-green-900/50 hover:bg-green-800/50 text-green-300 rounded-lg transition"
                              title="Publish"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          {selectedRelease.status === 'published' && (
                             <button
                              onClick={() => handleArchive(selectedRelease.id)}
                              className="p-2 bg-yellow-900/50 hover:bg-yellow-800/50 text-yellow-300 rounded-lg transition"
                              title="Archive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                           {selectedRelease.status !== 'published' && (
                             <button
                                onClick={() => handleDelete(selectedRelease.id)}
                                className="p-2 bg-red-900/50 hover:bg-red-800/50 text-red-300 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                          )}
                        </div>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none flex-grow overflow-y-auto bg-[#262a30] p-4 rounded-lg border border-gray-700">
                        <pre className="whitespace-pre-wrap break-words text-gray-300">{selectedRelease.content}</pre>
                      </div>
                      {selectedRelease.status === 'published' && (
                        <div className="mt-4">
                           <Link href={`/press/${selectedRelease.id}`} legacyBehavior>
                              <a target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 underline flex items-center gap-1">
                                View Public Page <ChevronRight className="h-4 w-4"/>
                              </a>
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileText className="h-16 w-16 mb-4" />
                  <p>Select a press release from the list to view or edit its details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Toast Message */}
      {message && (
        <div className={`fixed bottom-4 right-4 py-2 px-4 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in-up z-50 ${ 
          message.type === 'success' 
            ? 'bg-green-800/90 border border-green-700 text-white' 
            : message.type === 'error'
              ? 'bg-red-800/90 border border-red-700 text-white'
              : 'bg-blue-800/90 border border-blue-700 text-white'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-300" />
          ) : message.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-300" />
          ) : (
            <Clock className="h-5 w-5 text-blue-300" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default PressReleasesAdmin; 