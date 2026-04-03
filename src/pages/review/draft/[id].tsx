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
import { DraftReview, DraftReviewFormat, ReviewMetric, ReviewHighlight } from '../../../api/firebase/reviewContext/types';
import { useUser } from '../../../hooks/useUser';
import { adminMethods } from '../../../api/firebase/admin/methods';
import { safeTrackMixpanel } from '../../../lib/mixpanel';

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

const getDraftFormatLabel = (formatStyle: DraftReviewFormat): string =>
  formatStyle === 'article' ? 'Article' : 'Investor Update';

const parseInlineMarkdown = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={`b-${match.index}`} className="font-bold text-stone-900">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`i-${match.index}`}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <a
          key={`l-${match.index}`}
          href={match[7]}
          className="text-stone-900 underline decoration-stone-300 hover:decoration-stone-900 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[6]}
        </a>
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : [text];
};

const getArticleBodyParagraphs = (draft: DraftReview): string[] => {
  const paragraphs = (draft.articleContent || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && paragraph !== '---');

  if (paragraphs.length === 0) {
    return [];
  }

  const firstParagraph = paragraphs[0];
  const normalizedTitle = draft.title.trim().toLowerCase();
  const boldHeading = firstParagraph.match(/^\*\*(.+)\*\*$/)?.[1]?.trim().toLowerCase();
  const hashHeading = firstParagraph.startsWith('# ') ? firstParagraph.slice(2).trim().toLowerCase() : null;

  if (boldHeading === normalizedTitle || hashHeading === normalizedTitle) {
    return paragraphs.slice(1);
  }

  return paragraphs;
};

const getArticleExcerpt = (draft: DraftReview): string => {
  const paragraphs = getArticleBodyParagraphs(draft);
  const firstParagraph = paragraphs.find((paragraph) =>
    !paragraph.startsWith('**') &&
    !paragraph.startsWith('# ') &&
    !paragraph.startsWith('## ') &&
    !paragraph.startsWith('- ') &&
    !paragraph.startsWith('> '),
  );

  return firstParagraph || draft.description;
};

const getArticleTocItems = (draft: DraftReview): Array<{ id: string; label: string }> => {
  return getArticleBodyParagraphs(draft)
    .map((paragraph) => {
      const boldHeading = paragraph.match(/^\*\*(.+)\*\*$/)?.[1]?.trim();
      const hashHeading = paragraph.startsWith('# ') ? paragraph.slice(2).trim() : null;
      const subHeading = paragraph.startsWith('## ') ? paragraph.slice(3).trim() : null;
      const heading = boldHeading || hashHeading || subHeading;

      if (!heading) {
        return null;
      }

      const id = heading
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      return { id, label: heading };
    })
    .filter(Boolean) as Array<{ id: string; label: string }>;
};

const renderRawArticleContent = (draft: DraftReview): React.ReactNode[] => {
  const paragraphs = [...getArticleBodyParagraphs(draft)];
  const firstParagraphIndex = paragraphs.findIndex((paragraph) =>
    !paragraph.startsWith('**') &&
    !paragraph.startsWith('# ') &&
    !paragraph.startsWith('## ') &&
    !paragraph.startsWith('- ') &&
    !paragraph.startsWith('> '),
  );

  if (firstParagraphIndex >= 0) {
    paragraphs.splice(firstParagraphIndex, 1);
  }

  return paragraphs.map((paragraph, index) => {
    const key = `article-${index}`;
    const boldHeading = paragraph.match(/^\*\*(.+)\*\*$/)?.[1]?.trim();

    if (boldHeading) {
      const id = boldHeading
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      return (
        <h2
          key={key}
          id={id}
          className="scroll-mt-24 text-2xl md:text-3xl font-bold text-stone-900 mt-12 mb-6 leading-tight tracking-tight"
          style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        >
          {parseInlineMarkdown(boldHeading)}
        </h2>
      );
    }

    if (paragraph.startsWith('# ')) {
      const heading = paragraph.slice(2).trim();
      const id = heading
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      return (
        <h2
          key={key}
          id={id}
          className="scroll-mt-24 text-2xl md:text-3xl font-bold text-stone-900 mt-12 mb-6 leading-tight tracking-tight"
          style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        >
          {parseInlineMarkdown(heading)}
        </h2>
      );
    }

    if (paragraph.startsWith('## ')) {
      const heading = paragraph.slice(3).trim();
      const id = heading
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

      return (
        <h3
          key={key}
          id={id}
          className="scroll-mt-24 text-xl md:text-2xl font-bold text-stone-900 mt-10 mb-4 leading-tight"
          style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        >
          {parseInlineMarkdown(heading)}
        </h3>
      );
    }

    if (paragraph.startsWith('> ')) {
      return (
        <blockquote key={key} className="border-l-4 border-[#E0FE10] pl-6 my-8 py-2">
          <p className="text-lg text-stone-600 leading-[1.85] italic">
            {parseInlineMarkdown(paragraph.substring(2))}
          </p>
        </blockquote>
      );
    }

    if (paragraph.startsWith('- ')) {
      const items = paragraph.split('\n').filter((line) => line.startsWith('- '));
      return (
        <ul key={key} className="list-disc list-inside text-lg text-stone-700 leading-[1.85] mb-6 space-y-2">
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{parseInlineMarkdown(item.substring(2))}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={key} className="text-lg text-stone-700 leading-[1.85] mb-6">
        {parseInlineMarkdown(paragraph)}
      </p>
    );
  });
};

const formatDraftDate = (date: Date): string =>
  date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const estimateDraftReadTime = (draft: DraftReview): string => {
  const text = [
    draft.description,
    ...draft.featuredHighlights.map((item) => `${item.title} ${item.description}`),
    ...draft.businessHighlights.map((item) => `${item.title} ${item.description}`),
    ...draft.productHighlights.map((item) => `${item.title} ${item.description}`),
    ...(draft.lookingAhead || []),
    ...draft.metrics.map((metric) => `${metric.label} ${metric.currentValue}`),
  ].join(' ');

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(3, Math.ceil(wordCount / 180))} min read`;
};

const MetricsSnapshot: React.FC<{ metrics: ReviewMetric[] }> = ({ metrics }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    {metrics.map((metric, index) => (
      <div
        key={index}
        className="rounded-2xl border border-stone-200/80 bg-white p-5"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
          {metric.label}
        </p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
          {metric.isCurrency ? `$${metric.currentValue.toLocaleString()}` : metric.currentValue.toLocaleString()}
        </p>
        {metric.previousValue !== undefined && metric.previousValue > 0 && (
          <p className="mt-2 text-sm text-stone-500">
            Previous: {metric.isCurrency ? `$${metric.previousValue.toLocaleString()}` : metric.previousValue.toLocaleString()}
          </p>
        )}
      </div>
    ))}
  </div>
);

const DraftArticleView: React.FC<{
  draft: DraftReview;
  needsMetricsContext: boolean;
  needsLookingAheadContext: boolean;
  needsBusinessContext: boolean;
  needsProductContext: boolean;
  onAddContext: (section: ContextSection) => void;
}> = ({
  draft,
  needsMetricsContext,
  needsLookingAheadContext,
  needsBusinessContext,
  needsProductContext,
  onAddContext,
}) => {
  const [showToc, setShowToc] = useState(false);
  const hasRawArticleContent = Boolean(draft.articleContent?.trim());
  const articleTocItems = hasRawArticleContent ? getArticleTocItems(draft) : [];
  const articleExcerpt = hasRawArticleContent ? getArticleExcerpt(draft) : draft.description;
  const authorName = draft.author || 'Pulse Team';
  const authorTitle = draft.authorTitle || '';

  const sections = [
    {
      id: 'key-milestones',
      label: 'Key Milestones',
      content:
        draft.featuredHighlights.length > 0 ? (
          <div className="space-y-6">
            {draft.featuredHighlights.map((highlight, index) => (
              <div key={`${highlight.title}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-6">
                <p
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400"
                  style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                >
                  Milestone {index + 1}
                </p>
                <h3
                  className="text-2xl font-bold tracking-tight text-stone-900 mb-3"
                  style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                >
                  {highlight.title}
                </h3>
                <p className="text-lg leading-[1.85] text-stone-700">{highlight.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
            <p className="text-stone-400">Add key milestone context to populate this section.</p>
          </div>
        ),
      action: draft.featuredHighlights.length === 0 ? (
        <AddContextButton section="highlights" label="Add Key Milestone" onClick={onAddContext} />
      ) : null,
    },
    {
      id: 'metrics-snapshot',
      label: 'Metrics Snapshot',
      content: (
        <div>
          {draft.metricsNote && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {draft.metricsNote}
            </div>
          )}
          {draft.metrics.length > 0 ? (
            <MetricsSnapshot metrics={draft.metrics} />
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
              <p className="text-stone-400">No metrics available yet.</p>
            </div>
          )}
        </div>
      ),
      action: needsMetricsContext ? (
        <AddContextButton section="metrics" label="Add Metrics" onClick={onAddContext} />
      ) : null,
    },
    {
      id: 'business-momentum',
      label: 'Business Momentum',
      content: draft.businessHighlights.length > 0 ? (
        <div className="space-y-6">
          {draft.businessHighlights.map((highlight, index) => (
            <div key={`${highlight.title}-${index}`}>
              <h3
                className="mb-2 text-xl font-bold tracking-tight text-stone-900"
                style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
              >
                {highlight.title}
              </h3>
              <p className="text-lg leading-[1.85] text-stone-700">{highlight.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
          <p className="text-stone-400">Add business context to populate this section.</p>
        </div>
      ),
      action: needsBusinessContext ? (
        <AddContextButton section="business" label="Add Business Context" onClick={onAddContext} />
      ) : null,
    },
    {
      id: 'product-progress',
      label: 'Product Progress',
      content: draft.productHighlights.length > 0 ? (
        <div className="space-y-6">
          {draft.productHighlights.map((highlight, index) => (
            <div key={`${highlight.title}-${index}`}>
              <h3
                className="mb-2 text-xl font-bold tracking-tight text-stone-900"
                style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
              >
                {highlight.title}
              </h3>
              <p className="text-lg leading-[1.85] text-stone-700">{highlight.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
          <p className="text-stone-400">Add product context to populate this section.</p>
        </div>
      ),
      action: needsProductContext ? (
        <AddContextButton section="product" label="Add Product Context" onClick={onAddContext} />
      ) : null,
    },
    {
      id: 'looking-ahead',
      label: draft.reviewType === 'year' ? 'Looking Ahead' : draft.reviewType === 'quarter' ? 'Coming Next Quarter' : 'Coming Next Month',
      content:
        draft.lookingAhead && draft.lookingAhead.length > 0 && !needsLookingAheadContext ? (
          <ul className="space-y-3 text-lg leading-[1.85] text-stone-700">
            {draft.lookingAhead.map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-3">
                <span className="mt-[0.65rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-stone-900" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-10 text-center">
            <p className="text-stone-400">Add priorities to populate this section.</p>
          </div>
        ),
      action: needsLookingAheadContext ? (
        <AddContextButton section="looking_ahead" label="Add Priorities" onClick={onAddContext} />
      ) : null,
    },
  ] as Array<{ id: string; label: string; content: React.ReactNode; action?: React.ReactNode }>;

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <div className="border-b border-stone-200/60 bg-[#FAFAF7]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/review" className="inline-flex items-center text-sm text-stone-500 hover:text-stone-900 transition-colors">
            <ArrowLeft size={16} className="mr-2" />
            All Investor Updates
          </Link>
        </div>
      </div>

      <header className="max-w-4xl mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10 md:pb-14">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-medium text-stone-500">{getDraftFormatLabel(draft.formatStyle)}</span>
          <span className="text-stone-300">·</span>
          <span className="text-sm text-stone-400">{formatDraftDate(draft.generatedAt)}</span>
        </div>

        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
          {draft.getDisplaySubtitle()}
        </p>

        <h1
          className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-stone-900 leading-[1.08] tracking-tight mb-3"
          style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
        >
          {draft.title}
        </h1>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-[2px] rounded-full bg-stone-300" />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#E0FE10]">{authorName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="mr-2">
            <p className="text-sm font-semibold text-stone-800">{authorName}</p>
            <p className="text-xs text-stone-400">{authorTitle || estimateDraftReadTime(draft)}</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 md:px-8">
        <div className="h-px mb-12" style={{ background: 'linear-gradient(90deg, transparent, #E63946 30%, #457B9D 70%, transparent)' }} />
      </div>

      {hasRawArticleContent && articleTocItems.length > 0 && (
        <>
          <div className="lg:hidden max-w-4xl mx-auto px-6 md:px-8 mb-6">
            <button
              onClick={() => setShowToc((current) => !current)}
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              {showToc ? 'Hide contents' : 'Contents'}
            </button>
          </div>

          {showToc && (
            <div className="lg:hidden sticky top-0 z-30 bg-[#FAFAF7] border-y border-stone-200">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <nav className="flex flex-col gap-2">
                  {articleTocItems.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setShowToc(false)}
                      className="text-sm text-stone-500 hover:text-stone-900 transition-colors py-1"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          )}
        </>
      )}

      <div className="max-w-6xl mx-auto px-6 md:px-8 relative">
        <div
          className="max-w-3xl mx-auto mb-10"
          style={{ fontFamily: "'Georgia', 'Times New Roman', 'Noto Serif', serif" }}
        >
          <p className="text-xl text-stone-600 leading-[1.85] font-medium">
            {articleExcerpt}
          </p>
        </div>

        <div className="flex gap-16">
          {hasRawArticleContent && articleTocItems.length > 0 && (
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">
                  In this article
                </p>
                <nav className="flex flex-col gap-1.5">
                  {articleTocItems.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="text-[13px] text-stone-400 hover:text-stone-800 transition-colors py-1 leading-snug"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          <article
            className={`flex-1 ${hasRawArticleContent && articleTocItems.length > 0 ? 'max-w-[680px]' : 'max-w-3xl mx-auto'}`}
            style={{ fontFamily: "'Georgia', 'Times New Roman', 'Noto Serif', serif" }}
          >
            {hasRawArticleContent ? (
              renderRawArticleContent(draft)
            ) : (
              sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24 mb-14">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <h2
                      className="text-2xl md:text-3xl font-bold text-stone-900 leading-tight tracking-tight"
                      style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                    >
                      {section.label}
                    </h2>
                    {section.action}
                  </div>
                  {section.content}
                </section>
              ))
            )}

            <div className="mt-16 pt-10 border-t border-stone-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-[#E0FE10]">{authorName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p
                    className="text-base font-bold text-stone-900 mb-1"
                    style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                  >
                    {authorName}
                  </p>
                  <p
                    className="text-sm text-stone-500 leading-relaxed"
                    style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
                  >
                    {authorTitle || 'Investor updates from Pulse Intelligence Labs.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 mb-24">
              <Link
                href="/review"
                className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
                style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
              >
                <ArrowLeft size={16} />
                Back to all investor updates
              </Link>
            </div>
          </article>
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-[#FAFAF7]">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <img src="/pulse-logo.svg" alt="Pulse" className="h-6 mb-3" />
              <p className="text-sm text-stone-400">
                © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                Home
              </Link>
              <Link href="/review" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                Investor Updates
              </Link>
              <Link href="/research" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                Research
              </Link>
              <Link href="/about" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                About
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const InvestorUpdateDraftView: React.FC<{
  draft: DraftReview;
  needsMetricsContext: boolean;
  needsLookingAheadContext: boolean;
  needsBusinessContext: boolean;
  needsProductContext: boolean;
  onAddContext: (section: ContextSection) => void;
}> = ({
  draft,
  needsMetricsContext,
  needsLookingAheadContext,
  needsBusinessContext,
  needsProductContext,
  onAddContext,
}) => (
  <>
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-gray-200/40 to-transparent rounded-full blur-3xl" />
      <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
    </div>

    <div className="relative border-b border-gray-200/60 backdrop-blur-sm bg-white/70">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <Link href="/review" className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors">
          <ArrowLeft size={16} className="mr-2" />
          All Investor Updates
        </Link>
      </div>
    </div>

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
            onClick={onAddContext} 
          />
        </div>
      )}
    </div>

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
              onClick={onAddContext} 
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
            onClick={onAddContext} 
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
            onClick={onAddContext} 
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
              onClick={onAddContext} 
            />
          )}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          {draft.reviewType === 'year'
            ? 'Looking Ahead'
            : draft.reviewType === 'quarter'
              ? 'Coming Next Quarter'
              : 'Coming Next Month'}
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
  </>
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
  const [updatingFormat, setUpdatingFormat] = useState(false);
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
      
      safeTrackMixpanel('Review Page Viewed', {
        review_type: 'draft',
        review_period: draftData.getMonthYearLabel(), // e.g., "January 2025"
        review_title: draftData.title,
        review_format: draftData.formatStyle,
        page_url: window.location.href,
        is_admin: true,
      });
    } catch (err) {
      console.error('Error loading draft:', err);
      setError('Failed to load draft');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    
    try {
      setPublishing(true);
      await reviewContextService.publishDraft(draft.id);
      router.push(`/review/${draft.id}`);
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
      const updatedDraft = await reviewContextService.generateDraftFromContext(year, month, {
        reviewType: draft.reviewType,
        formatStyle: draft.formatStyle,
        author: draft.author,
        authorTitle: draft.authorTitle,
      });
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
      
      // Store draft edits against the draft's month so regeneration uses the correct context.
      await reviewContextService.addWeeklyContext(
        formattedContent,
        'manual',
        undefined,
        {
          year,
          month,
          weekNumber: 0,
        }
      );
      
      // Regenerate the draft with the new context
      const updatedDraft = await reviewContextService.generateDraftFromContext(year, month, {
        reviewType: draft.reviewType,
        formatStyle: draft.formatStyle,
        author: draft.author,
        authorTitle: draft.authorTitle,
      });
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
  const needsBusinessContext = (draft?.businessHighlights.length ?? 0) === 0;
  const needsProductContext = (draft?.productHighlights.length ?? 0) === 0;

  const handleFormatStyleChange = async (formatStyle: DraftReviewFormat) => {
    if (!draft || draft.formatStyle === formatStyle) {
      return;
    }

    try {
      setUpdatingFormat(true);
      setError(null);
      await reviewContextService.updateDraft(draft.id, { formatStyle });
      setDraft(new DraftReview({
        ...draft,
        formatStyle,
        updatedAt: new Date(),
      }));
    } catch (err: any) {
      console.error('Error updating draft format:', err);
      setError(err?.message || 'Failed to update draft format');
    } finally {
      setUpdatingFormat(false);
    }
  };

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
            ← Back to Investor Updates
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
            ← Back to Investor Updates
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
      
      <div className={draft.formatStyle === 'article' ? 'min-h-screen bg-[#FAFAF7]' : 'min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100'}>
        <div className="relative bg-amber-500 text-black">
          <div className="max-w-6xl mx-auto px-6 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Edit3 size={16} />
              <span className="font-medium">Draft Preview</span>
              <span className="text-amber-800 text-sm">— This review is not published yet</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg bg-amber-600/50 px-3 py-1.5 text-sm font-medium">
                <span>Format</span>
                <select
                  value={draft.formatStyle}
                  onChange={(event) => handleFormatStyleChange(event.target.value as DraftReviewFormat)}
                  disabled={updatingFormat || regenerating || publishing}
                  className="bg-transparent text-sm font-medium outline-none"
                >
                  <option value="investor-update">Investor Update</option>
                  <option value="article">Article</option>
                </select>
              </label>
              <button
                onClick={handleRegenerate}
                disabled={regenerating || updatingFormat}
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
        {draft.formatStyle === 'article' ? (
          <DraftArticleView
            draft={draft}
            needsMetricsContext={needsMetricsContext}
            needsLookingAheadContext={needsLookingAheadContext}
            needsBusinessContext={needsBusinessContext}
            needsProductContext={needsProductContext}
            onAddContext={setContextModal}
          />
        ) : (
          <InvestorUpdateDraftView
            draft={draft}
            needsMetricsContext={needsMetricsContext}
            needsLookingAheadContext={needsLookingAheadContext}
            needsBusinessContext={needsBusinessContext}
            needsProductContext={needsProductContext}
            onAddContext={setContextModal}
          />
        )}
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
