import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { 
  ArrowLeft, 
  CheckCircle, 
  ArrowRight, 
  Briefcase, 
  Code,
  Download, 
  ArrowUpRight, 
  Sparkles,
  Activity,
  TrendingUp,
  TrendingDown,
  Edit3,
  Send,
  AlertCircle,
  RefreshCw,
  Plus,
  X,
  Trash2,
  Target
} from 'lucide-react';
import { reviewContextService } from '../../../api/firebase/reviewContext/service';
import { DraftReview, ReviewMetric, ReviewHighlight } from '../../../api/firebase/reviewContext/types';
import { useUser } from '../../../hooks/useUser';
import { adminMethods } from '../../../api/firebase/admin/methods';

// Context Type for specific sections
type ContextSection = 'metrics' | 'looking_ahead' | 'business' | 'product' | 'highlights';

// Add Context Button Component
const AddContextButton: React.FC<{ 
  section: ContextSection; 
  label: string;
  onClick: (section: ContextSection) => void;
}> = ({ section, label, onClick }) => (
  <button
    onClick={() => onClick(section)}
    className="flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium transition-colors"
  >
    <Plus size={14} />
    {label}
  </button>
);

// Add Context Modal Component
const AddContextModal: React.FC<{
  section: ContextSection;
  onClose: () => void;
  onSubmit: (context: string, section: ContextSection) => Promise<void>;
  isSubmitting: boolean;
}> = ({ section, onClose, onSubmit, isSubmitting }) => {
  const [content, setContent] = useState('');

  const sectionLabels: Record<ContextSection, { title: string; placeholder: string; examples: string[] }> = {
    metrics: {
      title: 'Add Metrics Context',
      placeholder: 'Enter your metrics for this month...',
      examples: [
        'Subscriber count: 150 (up from 130)',
        'Monthly revenue: $450',
        'New users: 200',
        'Workouts logged: 5,500'
      ]
    },
    looking_ahead: {
      title: 'Add Looking Ahead Context',
      placeholder: 'What are you focusing on next month?',
      examples: [
        'Launch web application',
        'Onboard 3 new creators',
        'Ship Creator Club feature',
        'Apply to accelerator programs'
      ]
    },
    business: {
      title: 'Add Business Development Context',
      placeholder: 'What business milestones or partnerships happened?',
      examples: [
        'Closed investment from LAUNCH',
        'Partnered with SoulCycle',
        'Incorporated as C-Corp',
        'Selected for accelerator program'
      ]
    },
    product: {
      title: 'Add Product Development Context',
      placeholder: 'What features did you ship or improve?',
      examples: [
        'Launched AI Round Builder',
        'Redesigned dashboard for faster starts',
        'Added push notification system',
        'Improved onboarding flow'
      ]
    },
    highlights: {
      title: 'Add Key Milestone Context',
      placeholder: 'What major achievements should be highlighted?',
      examples: [
        'Secured strategic investment',
        'Graduated from Founder University',
        'Hit 2000 total users milestone',
        'First profitable month'
      ]
    }
  };

  const config = sectionLabels[section];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={config.placeholder}
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            autoFocus
          />
          
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">Examples:</p>
            <div className="flex flex-wrap gap-2">
              {config.examples.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setContent(prev => prev ? `${prev}\n${example}` : example)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                >
                  + {example}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(content, section)}
            disabled={!content.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Add & Regenerate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Metrics Grid Component
const MetricsGrid: React.FC<{ metrics: ReviewMetric[] }> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const growth = metric.previousValue 
          ? ((metric.currentValue - metric.previousValue) / metric.previousValue) * 100 
          : 0;
        const isPositive = growth >= 0;
        
        return (
          <div key={index} className="bg-white/60 backdrop-blur-lg border border-gray-200/50 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-gray-500">{metric.label}</span>
              {metric.showGrowth && metric.previousValue !== undefined && metric.previousValue > 0 && (
                <span className={`flex items-center text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
                  {Math.abs(growth).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {metric.isCurrency ? `$${metric.currentValue.toLocaleString()}` : metric.currentValue.toLocaleString()}
            </div>
            {metric.previousValue !== undefined && metric.previousValue > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                from {metric.isCurrency ? `$${metric.previousValue.toLocaleString()}` : metric.previousValue.toLocaleString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Featured Highlight Card
const FeaturedCard: React.FC<{ highlight: ReviewHighlight; color?: 'amber' | 'emerald' }> = ({ highlight, color = 'amber' }) => {
  const colorClasses = {
    amber: {
      bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      icon: 'bg-amber-100 text-amber-600',
      badge: 'text-amber-600',
      bar: 'from-amber-400 via-yellow-400 to-amber-400'
    },
    emerald: {
      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
      border: 'border-emerald-200',
      icon: 'bg-emerald-100 text-emerald-600',
      badge: 'text-emerald-600',
      bar: 'from-emerald-400 via-teal-400 to-emerald-400'
    }
  };
  const c = colorClasses[color];

  return (
    <div className={`relative overflow-hidden rounded-xl ${c.bg} border ${c.border} p-6`}>
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${c.bar}`} />
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${c.icon} flex items-center justify-center`}>
          <Sparkles size={18} />
        </div>
        <div>
          <div className={`flex items-center gap-2 mb-2 ${c.badge}`}>
            <Sparkles size={12} />
            <span className="text-xs font-semibold uppercase tracking-wide">Key Milestone</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{highlight.title}</h3>
          <p className="text-gray-600 text-sm">{highlight.description}</p>
        </div>
      </div>
    </div>
  );
};

// Highlight Item
const HighlightItem: React.FC<{ highlight: ReviewHighlight }> = ({ highlight }) => (
  <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/70 transition-all">
    <div className="flex items-start gap-3">
      <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
      <div>
        <h4 className="font-medium text-gray-900 mb-1">{highlight.title}</h4>
        <p className="text-gray-600 text-sm">{highlight.description}</p>
      </div>
    </div>
  </div>
);

const DraftReviewPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  
  const [draft, setDraft] = useState<DraftReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contextModal, setContextModal] = useState<ContextSection | null>(null);
  const [addingContext, setAddingContext] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Admin-only page
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user || !user.email) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }
      try {
        const result = await adminMethods.isAdmin(user.email);
        setIsAdmin(result);
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (!checkingAdmin && isAdmin && id && typeof id === 'string') {
      loadDraft(id);
    }
  }, [id, checkingAdmin, isAdmin]);

  const loadDraft = async (draftId: string) => {
    try {
      setLoading(true);
      setError(null);
      const draftData = await reviewContextService.fetchDraftById(draftId);
      if (!draftData) {
        setError('Draft not found');
        return;
      }
      setDraft(draftData);
    } catch (err) {
      console.error('Error loading draft:', err);
      setError('Failed to load draft');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    
    // For now, just mark as ready - actual publishing would create a real review page
    try {
      setPublishing(true);
      await reviewContextService.updateDraftStatus(draft.id, 'published');
      // Redirect to reviews page
      router.push('/review');
    } catch (err) {
      console.error('Error publishing:', err);
      setError('Failed to publish review');
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!draft) return;
    const confirmed = window.confirm('Delete this draft? This cannot be undone.');
    if (!confirmed) return;

    try {
      setDeleting(true);
      setError(null);
      await reviewContextService.deleteDraft(draft.id);
      router.push('/review');
    } catch (err: any) {
      console.error('Error deleting draft:', err);
      setError(err?.message || 'Failed to delete draft');
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!draft) return;
    
    try {
      setRegenerating(true);
      setError(null);
      const [year, month] = draft.monthYear.split('-').map(Number);
      // Regenerate will update the existing draft with new context
      const updatedDraft = await reviewContextService.generateDraftFromContext(year, month);
      setDraft(updatedDraft);
    } catch (err: any) {
      console.error('Error regenerating draft:', err);
      setError(err?.message || 'Failed to regenerate draft');
    } finally {
      setRegenerating(false);
    }
  };

  const handleAddContext = async (content: string, section: ContextSection) => {
    if (!draft || !content.trim()) return;
    
    try {
      setAddingContext(true);
      
      const [year, month] = draft.monthYear.split('-').map(Number);
      
      // Format the context with section prefix for AI to understand
      const sectionPrefixes: Record<ContextSection, string> = {
        metrics: '[METRICS]',
        looking_ahead: '[LOOKING AHEAD]',
        business: '[BUSINESS DEVELOPMENT]',
        product: '[PRODUCT DEVELOPMENT]',
        highlights: '[KEY MILESTONE]'
      };
      
      const formattedContent = `${sectionPrefixes[section]} ${content}`;
      
      // Add the context to weekly context (positional params: content, source)
      await reviewContextService.addWeeklyContext(formattedContent, 'manual');
      
      // Regenerate the draft with the new context
      const updatedDraft = await reviewContextService.generateDraftFromContext(year, month);
      setDraft(updatedDraft);
      
      // Close the modal
      setContextModal(null);
    } catch (err: any) {
      console.error('Error adding context:', err);
      setError(err?.message || 'Failed to add context');
    } finally {
      setAddingContext(false);
    }
  };

  // Check if sections need more context
  const needsMetricsContext = draft?.metrics.every(m => m.currentValue === 0) ?? false;
  const needsLookingAheadContext = draft?.lookingAhead?.some(item => item.includes('[Add') || item.includes('upcoming priorities')) ?? false;
  const needsHighlightsContext = (draft?.featuredHighlights.length ?? 0) === 0;
  const needsBusinessContext = (draft?.businessHighlights.length ?? 0) === 0;
  const needsProductContext = (draft?.productHighlights.length ?? 0) === 0;

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">This draft is only available to admins.</p>
          <Link href="/review" className="text-blue-600 hover:underline">
            ← Back to Reviews
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-gray-600 mb-4">{error || 'Draft not found'}</p>
          <Link href="/review" className="text-blue-600 hover:underline">
            ← Back to Reviews
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{draft.title} (Draft) | Pulse</title>
        <meta name="description" content={draft.description} />
        <meta name="robots" content="noindex" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-gray-200/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Draft Banner */}
        <div className="relative bg-amber-500 text-black">
          <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3 size={16} />
              <span className="font-medium">Draft Preview</span>
              <span className="text-amber-800 text-sm">— This review is not published yet</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {regenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    AI Writing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Update Draft
                  </>
                )}
              </button>
              <Link 
                href="/admin/reviewTracker"
                className="px-3 py-1.5 bg-amber-600/50 hover:bg-amber-600 rounded-lg text-sm font-medium transition-colors"
              >
                Edit in Tracker
              </Link>
              <button
                onClick={handleDeleteDraft}
                disabled={deleting || regenerating || publishing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/50 hover:bg-amber-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                title="Delete Draft"
              >
                {deleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : (
                  <>
                    <Send size={14} />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="relative border-b border-gray-200/60 backdrop-blur-sm bg-white/70">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link href="/review" className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors">
              <ArrowLeft size={16} className="mr-2" />
              All Reviews
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            {draft.subtitle || draft.getDisplaySubtitle()}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            {draft.title}
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl">
            {draft.description}
          </p>
          <button
            className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>

        {/* Featured Highlights */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          {draft.featuredHighlights.length > 0 ? (
            <div className={`grid ${draft.featuredHighlights.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
              {draft.featuredHighlights.map((highlight, index) => (
                <FeaturedCard 
                  key={index} 
                  highlight={highlight} 
                  color={index === 0 ? 'amber' : 'emerald'} 
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-gradient-to-br from-amber-50/50 to-yellow-50/30 border border-dashed border-amber-300 rounded-xl">
              <Sparkles size={32} className="mx-auto text-amber-300 mb-2" />
              <p className="text-amber-600 text-sm mb-3">No key milestones identified yet</p>
              <AddContextButton 
                section="highlights" 
                label="Add Key Milestone" 
                onClick={setContextModal} 
              />
            </div>
          )}
        </div>

        {/* Metrics */}
        {draft.metrics.length > 0 && (
          <div className="relative max-w-4xl mx-auto px-6 pb-16">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Activity size={16} className="text-white" />
                </div>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Key Metrics
                </h2>
              </div>
              {needsMetricsContext && (
                <AddContextButton 
                  section="metrics" 
                  label="Add Metrics" 
                  onClick={setContextModal} 
                />
              )}
            </div>
            
            {draft.metricsNote && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {draft.metricsNote}
              </div>
            )}

            <MetricsGrid metrics={draft.metrics} />
          </div>
        )}

        {/* Business Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <Briefcase size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Business Development
              </h2>
            </div>
            {needsBusinessContext && (
              <AddContextButton 
                section="business" 
                label="Add Business Context" 
                onClick={setContextModal} 
              />
            )}
          </div>
          
          {draft.businessHighlights.length > 0 ? (
            <div className="space-y-3">
              {draft.businessHighlights.map((highlight, index) => (
                <HighlightItem key={index} highlight={highlight} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-white/30 border border-dashed border-gray-300 rounded-xl">
              <Briefcase size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">Add business development context to populate this section</p>
            </div>
          )}
        </div>

        {/* Product Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Code size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Product Development
              </h2>
            </div>
            {needsProductContext && (
              <AddContextButton 
                section="product" 
                label="Add Product Context" 
                onClick={setContextModal} 
              />
            )}
          </div>
          
          {draft.productHighlights.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-3">
              {draft.productHighlights.map((highlight, index) => (
                <HighlightItem key={index} highlight={highlight} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-white/30 border border-dashed border-gray-300 rounded-xl">
              <Code size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">Add product development context to populate this section</p>
            </div>
          )}
        </div>

        {/* Looking Ahead */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
                Looking Ahead
              </h2>
              {needsLookingAheadContext && (
                <AddContextButton 
                  section="looking_ahead" 
                  label="Add Priorities" 
                  onClick={setContextModal} 
                />
              )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Coming Next Month
            </h3>
            {draft.lookingAhead && draft.lookingAhead.length > 0 && !needsLookingAheadContext ? (
              <ul className="space-y-2">
                {draft.lookingAhead.map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-600">
                    <ArrowRight size={16} className="text-gray-400" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 text-center">
                <Target size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">Add your priorities for next month</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative border-t border-gray-200/60 backdrop-blur-sm bg-white/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Learn more about Pulse</p>
                <a 
                  href="https://fitwithpulse.ai" 
                  className="text-gray-900 font-medium hover:text-gray-600 transition-colors inline-flex items-center group"
                >
                  fitwithpulse.ai
                  <ArrowUpRight size={16} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20 inline-flex items-center gap-2"
              >
                Download Pulse
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add Context Modal */}
      {contextModal && (
        <AddContextModal
          section={contextModal}
          onClose={() => setContextModal(null)}
          onSubmit={handleAddContext}
          isSubmitting={addingContext}
        />
      )}
    </>
  );
};

export default DraftReviewPage;

