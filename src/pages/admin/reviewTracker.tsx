import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { 
  Calendar, 
  Plus, 
  Mail, 
  Edit3, 
  Trash2, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Send,
  Eye
} from 'lucide-react';
import { reviewContextService } from '../../api/firebase/reviewContext/service';
import { 
  WeeklyContext, 
  DraftReview, 
  ReviewContextSummary,
  getCurrentWeekOfMonth,
  getCurrentMonthName,
  getCurrentMonthYear 
} from '../../api/firebase/reviewContext/types';

const ReviewTracker: React.FC = () => {
  const router = useRouter();

  // State
  const [weeklyContexts, setWeeklyContexts] = useState<WeeklyContext[]>([]);
  const [drafts, setDrafts] = useState<DraftReview[]>([]);
  const [summaries, setSummaries] = useState<ReviewContextSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI State
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthYear());
  const [showAddContext, setShowAddContext] = useState(false);
  const [newContextContent, setNewContextContent] = useState('');
  const [editingContext, setEditingContext] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set([getCurrentMonthYear()]));
  const [selectedDraft, setSelectedDraft] = useState<DraftReview | null>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Handle URL parameters (from email link)
  useEffect(() => {
    if (router.isReady) {
      const { action, week, month, year } = router.query;
      if (action === 'add') {
        setShowAddContext(true);
        // Clear the URL params without navigation
        router.replace('/admin/reviewTracker', undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load data with graceful fallbacks for empty collections
      let contextsData: WeeklyContext[] = [];
      let draftsData: DraftReview[] = [];
      let summariesData: ReviewContextSummary[] = [];

      try {
        contextsData = await reviewContextService.fetchAllWeeklyContext();
      } catch (e) {
        console.log('Weekly contexts fetch failed, using empty array');
      }

      try {
        draftsData = await reviewContextService.fetchAllDrafts();
      } catch (e) {
        console.log('Drafts fetch failed, using empty array');
      }

      try {
        summariesData = await reviewContextService.getReviewSummaries();
      } catch (e) {
        console.log('Summaries fetch failed, using empty array');
      }

      setWeeklyContexts(contextsData);
      setDrafts(draftsData);
      setSummaries(summariesData);
    } catch (err) {
      console.error('Error loading review data:', err);
      setError('Failed to load review data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  // Add new context
  const handleAddContext = async () => {
    if (!newContextContent.trim()) return;
    
    try {
      setSavingContext(true);
      await reviewContextService.addWeeklyContext(newContextContent.trim(), 'manual');
      setNewContextContent('');
      setShowAddContext(false);
      await loadData();
    } catch (err) {
      console.error('Error adding context:', err);
      setError('Failed to add context');
    } finally {
      setSavingContext(false);
    }
  };

  // Update context
  const handleUpdateContext = async (id: string) => {
    if (!editContent.trim()) return;
    
    try {
      await reviewContextService.updateWeeklyContext(id, editContent.trim());
      setEditingContext(null);
      setEditContent('');
      await loadData();
    } catch (err) {
      console.error('Error updating context:', err);
      setError('Failed to update context');
    }
  };

  // Delete context
  const handleDeleteContext = async (id: string) => {
    if (!confirm('Are you sure you want to delete this weekly context?')) return;
    
    try {
      await reviewContextService.deleteWeeklyContext(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting context:', err);
      setError('Failed to delete context');
    }
  };

  // Generate draft
  const handleGenerateDraft = async (monthYear: string) => {
    try {
      setGeneratingDraft(true);
      setError(null);
      const [year, month] = monthYear.split('-').map(Number);
      const draft = await reviewContextService.generateDraftFromContext(year, month);
      // Redirect to the draft preview page
      router.push(`/review/draft/${draft.id}`);
    } catch (err: any) {
      console.error('Error generating draft:', err);
      setError(err?.message || 'Failed to generate draft. Make sure you have weekly updates for this month.');
      setGeneratingDraft(false);
    }
  };

  // Toggle month expansion
  const toggleMonth = (monthYear: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthYear)) {
      newExpanded.delete(monthYear);
    } else {
      newExpanded.add(monthYear);
    }
    setExpandedMonths(newExpanded);
  };

  // Send test email via Netlify function
  const handleSendTestEmail = async (type: 'weekly-checkin' | 'draft-reminder') => {
    try {
      setSendingEmail(type);
      setError(null);
      
      // Use Netlify function endpoint
      const endpoint = type === 'weekly-checkin' 
        ? '/.netlify/functions/trigger-review-checkin'
        : '/api/review/send-draft-reminder'; // Draft reminder uses API route for now
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to send email');
      }
      
      alert(`✅ ${type === 'weekly-checkin' ? 'Weekly check-in' : 'Draft reminder'} email sent successfully!`);
    } catch (err: any) {
      console.error('Error sending test email:', err);
      setError(err?.message || 'Failed to send test email');
    } finally {
      setSendingEmail(null);
    }
  };

  // Get contexts for a specific month
  const getContextsForMonth = (monthYear: string): WeeklyContext[] => {
    const [year, month] = monthYear.split('-').map(Number);
    return weeklyContexts.filter(ctx => ctx.year === year && ctx.month === month);
  };

  // Get draft for a specific month
  const getDraftForMonth = (monthYear: string): DraftReview | undefined => {
    return drafts.find(d => d.monthYear === monthYear);
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  // Get month label from monthYear string
  const getMonthLabel = (monthYear: string): string => {
    const [year, month] = monthYear.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  // Get status badge
  const getStatusBadge = (summary: ReviewContextSummary) => {
    if (summary.draftStatus === 'published') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
          <CheckCircle size={12} />
          Published
        </span>
      );
    }
    if (summary.draftStatus === 'ready') {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
          <Eye size={12} />
          Ready
        </span>
      );
    }
    if (summary.hasDraft) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
          <Edit3 size={12} />
          Draft
        </span>
      );
    }
    if (summary.weekCount > 0) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs">
          <Clock size={12} />
          {summary.weekCount} weeks
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs">
        <AlertCircle size={12} />
        No data
      </span>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Review Tracker | Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#0d1117] text-white">
        {/* Header */}
        <div className="border-b border-gray-800 bg-[#161b22]">
          <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-2">Review Progress Tracker</h1>
                <p className="text-gray-400">Track weekly progress and manage monthly reviews</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleGenerateDraft(getCurrentMonthYear())}
                  disabled={generatingDraft || weeklyContexts.filter(ctx => {
                    const [year, month] = getCurrentMonthYear().split('-').map(Number);
                    return ctx.year === year && ctx.month === month;
                  }).length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingDraft ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      AI Writing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate {getCurrentMonthName()} Review
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAddContext(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg font-medium hover:bg-[#c4ec00] transition-colors"
                >
                  <Plus size={18} />
                  Add Weekly Update
                </button>
              </div>
            </div>

            {/* Current Week Info */}
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1e24] rounded-lg border border-gray-700">
                <Calendar size={14} className="text-[#d7ff00]" />
                <span className="text-gray-300">Week {getCurrentWeekOfMonth()} of {getCurrentMonthName()} {new Date().getFullYear()}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1e24] rounded-lg border border-gray-700">
                <FileText size={14} className="text-blue-400" />
                <span className="text-gray-300">{weeklyContexts.length} weekly update{weeklyContexts.length !== 1 ? 's' : ''}</span>
              </div>
              
              {/* Quick Email Actions */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-500 mr-2">Quick Send:</span>
                <button
                  onClick={() => handleSendTestEmail('weekly-checkin')}
                  disabled={sendingEmail !== null}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-lg text-sm hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                  title="Send weekly check-in email to tre@fitwithpulse.ai"
                >
                  {sendingEmail === 'weekly-checkin' ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                  ) : (
                    <Mail size={14} />
                  )}
                  Weekly Check-in
                </button>
                <button
                  onClick={() => handleSendTestEmail('draft-reminder')}
                  disabled={sendingEmail !== null}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-lg text-sm hover:bg-amber-600/30 transition-colors disabled:opacity-50"
                  title="Send draft review reminder email"
                >
                  {sendingEmail === 'draft-reminder' ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-400"></div>
                  ) : (
                    <Send size={14} />
                  )}
                  Draft Reminder
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Email Automation Panel */}
          <div className="mb-8 p-6 bg-gradient-to-br from-[#1a1e24] to-[#161b22] rounded-xl border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                  <Mail size={20} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Email Automation</h3>
                  <p className="text-sm text-gray-400">Manage weekly check-ins and draft reminders</p>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {/* Weekly Check-in */}
              <div className="p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-sm font-medium text-white">Weekly Check-in</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Sends an email asking how your week went. Replies are automatically captured as context.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Auto: Fridays 9am EST</span>
                  <button
                    onClick={() => handleSendTestEmail('weekly-checkin')}
                    disabled={sendingEmail !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {sendingEmail === 'weekly-checkin' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        Send Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Draft Reminder */}
              <div className="p-4 bg-[#0d1117] rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                  <span className="text-sm font-medium text-white">Draft Reminder</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  Sends an email with a link to the generated draft review for final review before publishing.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Auto: 2 days before 1st Monday</span>
                  <button
                    onClick={() => handleSendTestEmail('draft-reminder')}
                    disabled={sendingEmail !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors disabled:opacity-50"
                  >
                    {sendingEmail === 'draft-reminder' ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700/50">
              <p className="text-xs text-gray-500">
                📧 Emails are sent to <span className="text-gray-400">tre@fitwithpulse.ai</span> • 
                Reply to weekly check-ins to automatically add context for your monthly review
              </p>
            </div>
          </div>

          {/* Add Context Modal */}
          {showAddContext && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-[#161b22] rounded-xl border border-gray-700 p-6 w-full max-w-2xl mx-4">
                <h2 className="text-xl font-semibold mb-4">Add Weekly Update</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Week {getCurrentWeekOfMonth()} of {getCurrentMonthName()} {new Date().getFullYear()}
                </p>
                <textarea
                  value={newContextContent}
                  onChange={(e) => setNewContextContent(e.target.value)}
                  placeholder="What happened this week? Key achievements, challenges, metrics, learnings..."
                  className="w-full h-48 bg-[#0d1117] border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-[#d7ff00]"
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowAddContext(false);
                      setNewContextContent('');
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContext}
                    disabled={!newContextContent.trim() || savingContext}
                    className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg font-medium hover:bg-[#c4ec00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingContext ? 'Saving...' : 'Save Update'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Draft Preview Modal */}
          {selectedDraft && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-[#161b22] rounded-xl border border-gray-700 p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">{selectedDraft.title}</h2>
                  <button
                    onClick={() => setSelectedDraft(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="prose prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-300 text-sm font-sans bg-[#0d1117] p-4 rounded-lg">
                    {selectedDraft.description}
                  </pre>
                </div>
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setSelectedDraft(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Edit3 size={16} />
                    Edit Draft
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    <Send size={16} />
                    Publish
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d7ff00]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Generate list of recent months if no summaries */}
              {summaries.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 mb-4">No review data yet</p>
                  <button
                    onClick={() => setShowAddContext(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg font-medium"
                  >
                    <Plus size={18} />
                    Add your first weekly update
                  </button>
                </div>
              ) : (
                summaries.map((summary) => {
                  const isExpanded = expandedMonths.has(summary.monthYear);
                  const contexts = getContextsForMonth(summary.monthYear);
                  const draft = getDraftForMonth(summary.monthYear);

                  return (
                    <div
                      key={summary.monthYear}
                      className="bg-[#161b22] rounded-xl border border-gray-700 overflow-hidden"
                    >
                      {/* Month Header */}
                      <div
                        onClick={() => toggleMonth(summary.monthYear)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#1a1e24] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#d7ff00]/20 to-blue-500/20 flex items-center justify-center">
                            <Calendar size={20} className="text-[#d7ff00]" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{getMonthLabel(summary.monthYear)}</h3>
                            <p className="text-sm text-gray-400">
                              {summary.weekCount} weekly update{summary.weekCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(summary)}
                          {isExpanded ? (
                            <ChevronUp size={20} className="text-gray-400" />
                          ) : (
                            <ChevronDown size={20} className="text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-gray-700 p-4">
                          {/* Weekly Contexts */}
                          {contexts.length > 0 ? (
                            <div className="space-y-3 mb-4">
                              <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                                Weekly Updates
                              </h4>
                              {contexts.map((ctx) => (
                                <div
                                  key={ctx.id}
                                  className="bg-[#0d1117] rounded-lg p-4 border border-gray-800"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-grow">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs px-2 py-0.5 bg-gray-800 rounded text-gray-400">
                                          Week {ctx.weekNumber}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {ctx.source === 'email' ? (
                                            <span className="flex items-center gap-1">
                                              <Mail size={10} /> via Email
                                            </span>
                                          ) : (
                                            'Manual entry'
                                          )}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          {formatDate(ctx.createdAt)}
                                        </span>
                                      </div>
                                      
                                      {editingContext === ctx.id ? (
                                        <div>
                                          <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full h-32 bg-[#161b22] border border-gray-700 rounded-lg p-3 text-white text-sm resize-none focus:outline-none focus:border-[#d7ff00]"
                                          />
                                          <div className="flex gap-2 mt-2">
                                            <button
                                              onClick={() => handleUpdateContext(ctx.id)}
                                              className="px-3 py-1 text-sm bg-[#d7ff00] text-black rounded font-medium"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() => {
                                                setEditingContext(null);
                                                setEditContent('');
                                              }}
                                              className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                                          {ctx.content}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {editingContext !== ctx.id && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            setEditingContext(ctx.id);
                                            setEditContent(ctx.content);
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                                        >
                                          <Edit3 size={14} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteContext(ctx.id)}
                                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm mb-4">No weekly updates for this month</p>
                          )}

                          {/* Draft Section */}
                          <div className="pt-4 border-t border-gray-700">
                            {draft ? (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FileText size={18} className="text-blue-400" />
                                  <div>
                                    <p className="font-medium">{draft.title}</p>
                                    <p className="text-xs text-gray-500">
                                      Last updated {formatDate(draft.updatedAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setSelectedDraft(draft)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition-colors"
                                  >
                                    <Eye size={14} />
                                    Preview
                                  </button>
                                </div>
                              </div>
                            ) : contexts.length > 0 ? (
                              <button
                                onClick={() => handleGenerateDraft(summary.monthYear)}
                                disabled={generatingDraft}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {generatingDraft ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    AI Writing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={16} />
                                    Generate Draft Review
                                  </>
                                )}
                              </button>
                            ) : (
                              <p className="text-gray-500 text-sm">
                                Add weekly updates to generate a draft review
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default ReviewTracker;

