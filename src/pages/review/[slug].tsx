import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Activity, ArrowLeft, ArrowRight, Briefcase, Calendar, Code, Edit3, Loader2 } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import PageHead from '../../components/PageHead';
import ReviewArticleLayout from '../../components/review/ReviewArticleLayout';
import { db } from '../../api/firebase/config';
import { reviewContextService } from '../../api/firebase/reviewContext/service';
import { DraftReview } from '../../api/firebase/reviewContext/types';
import type { DraftReviewFormat } from '../../api/firebase/reviewContext/types';
import { useUser } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';

interface AuthorProfileOption {
  id: string;
  name: string;
  title: string;
}

type CreateReviewType = 'month' | 'quarter' | 'year';
type CreateReviewFormat = DraftReviewFormat;

const createReviewTypes: CreateReviewType[] = ['month', 'quarter', 'year'];
const createReviewFormats: CreateReviewFormat[] = ['investor-update', 'article'];

const getPreferredAuthorProfile = (profiles: AuthorProfileOption[]): AuthorProfileOption | null =>
  profiles.find((profile) => profile.name === 'Tremaine') || profiles[0] || null;

const getYearOptions = (): string[] => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
};

const getDraftFormatLabel = (formatStyle: DraftReviewFormat): string =>
  formatStyle === 'article' ? 'Article' : 'Investor Update';

const citationPattern = /\[\[\[([\s\S]*?)\]\]\]/g;

const getReviewFormTarget = (
  reviewType: CreateReviewType,
  monthValue: string,
  quarterValue: string,
  yearValue: string,
): { year: number; month: number; label: string } | null => {
  if (reviewType === 'month') {
    const [year, month] = monthValue.split('-').map(Number);
    if (!year || !month) {
      return null;
    }

    return {
      year,
      month,
      label: new Date(`${monthValue}-01T12:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    };
  }

  const year = Number(yearValue);
  if (!year) {
    return null;
  }

  if (reviewType === 'quarter') {
    const quarter = Number(quarterValue);
    if (!quarter) {
      return null;
    }

    return {
      year,
      month: quarter * 3,
      label: `Q${quarter} ${year}`,
    };
  }

  return {
    year,
    month: 12,
    label: `${year} Year in Review`,
  };
};

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
        </a>,
      );
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length > 0 ? parts : [text];
};

interface CitationSource {
  url: string;
  label: string;
  hostLabel: string;
}

const getHostLabelFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.').filter(Boolean);
    const domainToken = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || hostname;
    return domainToken
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return 'Source';
  }
};

const getCitationTitleFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname)
      .replace(/[-_]+/g, ' ')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!path || path === '/') {
      return parsed.hostname.replace(/^www\./, '');
    }

    return path
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' / ');
  } catch {
    return url;
  }
};

const parseCitationSources = (rawCitationPayload: string): CitationSource[] => {
  const trimmed = rawCitationPayload.trim();
  if (!trimmed) {
    return [];
  }

  const normalizedPayload = trimmed.startsWith('[') ? trimmed : `[${trimmed}]`;
  let rawUrls: string[] = [];

  try {
    const parsed = JSON.parse(normalizedPayload);
    if (Array.isArray(parsed)) {
      rawUrls = parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    rawUrls = normalizedPayload
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return rawUrls.map((url) => ({
    url,
    label: getCitationTitleFromUrl(url),
    hostLabel: getHostLabelFromUrl(url),
  }));
};

const stripCitationMarkup = (text: string): string =>
  text.replace(citationPattern, '').replace(/\s{2,}/g, ' ').trim();

const CitationPill: React.FC<{ sources: CitationSource[] }> = ({ sources }) => {
  if (sources.length === 0) {
    return null;
  }

  const primaryLabel = sources[0].hostLabel;
  const secondaryCount = sources.length - 1;

  return (
    <span className="group relative mx-1 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex items-center rounded-full bg-stone-900/90 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-300"
      >
        <span>{primaryLabel}</span>
        {secondaryCount > 0 && <span className="ml-1 text-stone-300">+{secondaryCount}</span>}
      </button>

      <div className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+12px)] z-30 w-[320px] -translate-x-1/2 opacity-0 transition-all duration-150 group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-[24px] border border-stone-700 bg-[#2B2B2B] text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="text-sm font-medium text-stone-200">Sources</div>
            <div className="text-sm text-stone-400">1/{sources.length}</div>
          </div>

          <div className="space-y-3 p-4">
            {sources.map((source, index) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
                  {source.hostLabel}
                </div>
                <div className="text-base leading-snug text-white">
                  {source.label}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </span>
  );
};

const renderInlineArticleContent = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentIndex = 0;
  citationPattern.lastIndex = 0;

  while ((match = citationPattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-text-${segmentIndex}`}>
          {parseInlineMarkdown(before)}
        </React.Fragment>,
      );
      segmentIndex += 1;
    }

    const sources = parseCitationSources(match[1]);
    if (sources.length > 0) {
      nodes.push(
        <CitationPill key={`${keyPrefix}-citation-${segmentIndex}`} sources={sources} />,
      );
      segmentIndex += 1;
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-tail-${segmentIndex}`}>
        {parseInlineMarkdown(remaining)}
      </React.Fragment>,
    );
  }

  return nodes.length > 0 ? nodes : [text];
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

const getArticleTocItems = (draft: DraftReview): Array<{ id: string; label: string }> =>
  getArticleBodyParagraphs(draft)
    .map((paragraph) => {
      const boldHeading = stripCitationMarkup(paragraph.match(/^\*\*(.+)\*\*$/)?.[1]?.trim() || '');
      const hashHeading = paragraph.startsWith('# ') ? stripCitationMarkup(paragraph.slice(2).trim()) : null;
      const subHeading = paragraph.startsWith('## ') ? stripCitationMarkup(paragraph.slice(3).trim()) : null;
      const heading = boldHeading || hashHeading || subHeading;

      if (!heading) {
        return null;
      }

      return {
        id: heading
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-'),
        label: heading,
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string }>;

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
    const boldHeading = stripCitationMarkup(paragraph.match(/^\*\*(.+)\*\*$/)?.[1]?.trim() || '');

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

    if (paragraph.startsWith('## ')) {
      const heading = stripCitationMarkup(paragraph.slice(3).trim());
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

    if (paragraph.startsWith('# ')) {
      const heading = stripCitationMarkup(paragraph.slice(2).trim());
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

    if (paragraph.startsWith('- ')) {
      const items = paragraph.split('\n').filter((line) => line.startsWith('- '));
      return (
        <ul key={key} className="list-disc list-inside text-lg text-stone-700 leading-[1.85] mb-6 space-y-2">
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{renderInlineArticleContent(item.substring(2), `${key}-bullet-${itemIndex}`)}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={key} className="text-lg text-stone-700 leading-[1.85] mb-6">
        {renderInlineArticleContent(paragraph, key)}
      </p>
    );
  });
};

const PublishedStructuredReview: React.FC<{ draft: DraftReview; isAdmin: boolean; onEdit: () => void }> = ({ draft, isAdmin, onEdit }) => (
  <ReviewArticleLayout
    metaTitle={`${draft.title} – Pulse`}
    metaDescription={draft.description}
    eyebrow={draft.getDisplaySubtitle()}
    title={draft.title}
    description={draft.description}
    pageOgUrl={`https://fitwithpulse.ai/review/${draft.id}`}
    downloadHref={undefined}
    headerActions={
      isAdmin ? (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        >
          <Edit3 size={16} />
          Edit Review
        </button>
      ) : undefined
    }
  >
    <div className="mx-auto max-w-6xl px-6 pb-16 md:px-8">
      {draft.featuredHighlights.length > 0 && (
        <div className="grid gap-4 pb-16 md:grid-cols-2">
          {draft.featuredHighlights.map((highlight, index) => (
            <div
              key={`${highlight.title}-${index}`}
              className="rounded-[28px] border border-stone-200 bg-white p-8"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                Key Milestone
              </p>
              <h2 className="mb-3 text-2xl font-bold tracking-tight text-stone-900">
                {highlight.title}
              </h2>
              <p className="text-base leading-relaxed text-stone-600">
                {highlight.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {draft.metrics.length > 0 && (
        <div className="pb-16">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Activity size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
              Key Metrics
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {draft.metrics.map((metric, index) => (
              <div key={`${metric.label}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{metric.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                  {metric.isCurrency ? `$${metric.currentValue.toLocaleString()}` : metric.currentValue.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.businessHighlights.length > 0 && (
        <div className="pb-16">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900">
              <Briefcase size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
              Business Development
            </h2>
          </div>
          <div className="space-y-4">
            {draft.businessHighlights.map((highlight, index) => (
              <div key={`${highlight.title}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="mb-2 text-xl font-semibold text-stone-900">{highlight.title}</h3>
                <p className="text-base leading-relaxed text-stone-600">{highlight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.productHighlights.length > 0 && (
        <div className="pb-16">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <Code size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
              Product Development
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {draft.productHighlights.map((highlight, index) => (
              <div key={`${highlight.title}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-6">
                <h3 className="mb-2 text-xl font-semibold text-stone-900">{highlight.title}</h3>
                <p className="text-base leading-relaxed text-stone-600">{highlight.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.lookingAhead && draft.lookingAhead.length > 0 && (
        <div className="pb-24">
          <div className="rounded-[28px] border border-stone-200 bg-white p-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-stone-400">
              {draft.reviewType === 'year' ? 'Looking Ahead' : draft.reviewType === 'quarter' ? 'Coming Next Quarter' : 'Coming Next Month'}
            </h2>
            <ul className="space-y-3">
              {draft.lookingAhead.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-3 text-stone-600">
                  <ArrowRight size={16} className="mt-1 text-stone-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  </ReviewArticleLayout>
);

const PublishedArticleReview: React.FC<{ draft: DraftReview; isAdmin: boolean; onEdit: () => void }> = ({ draft, isAdmin, onEdit }) => {
  const [showToc, setShowToc] = useState(false);
  const tocItems = getArticleTocItems(draft);
  const excerpt = getArticleExcerpt(draft);
  const authorName = draft.author || 'Pulse Team';
  const authorTitle = draft.authorTitle || '';

  return (
    <>
      <PageHead
        metaData={{
          pageId: `review-${draft.id}`,
          pageTitle: `${draft.title} – Pulse`,
          metaDescription: draft.description,
          ogTitle: draft.title,
          ogDescription: draft.description,
          lastUpdated: (draft.publishedAt || draft.updatedAt).toISOString(),
        }}
        pageOgUrl={`https://fitwithpulse.ai/review/${draft.id}`}
        pageOgImage={`/og-image.png?title=${encodeURIComponent(draft.title)}`}
      />

      <div className="min-h-screen bg-[#FAFAF7]">
        <nav className="sticky top-0 z-50 bg-[#FAFAF7]/90 backdrop-blur-md border-b border-stone-200/60">
          <div className="max-w-4xl mx-auto px-6 md:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/review" className="flex items-center gap-3 group">
                <img src="/pulse-logo.svg" alt="Pulse" className="h-7" />
                <span className="text-sm text-stone-400 font-medium group-hover:text-stone-600 transition-colors">
                  Investor Updates
                </span>
              </Link>

              <div className="flex items-center gap-4">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    <Edit3 size={14} />
                    Edit Review
                  </button>
                )}
                {tocItems.length > 0 && (
                  <button
                    onClick={() => setShowToc((current) => !current)}
                    className="lg:hidden text-sm text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Contents
                  </button>
                )}
                <Link href="/review" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  All updates
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {tocItems.length > 0 && showToc && (
          <div className="lg:hidden sticky top-16 z-40 bg-[#FAFAF7] border-b border-stone-200 shadow-sm">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <nav className="flex flex-col gap-2">
                {tocItems.map((item) => (
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

        <header className="max-w-4xl mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10 md:pb-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium text-stone-500">{draft.getDisplaySubtitle()}</span>
            <span className="text-stone-300">·</span>
            <span className="text-sm text-stone-400">
              {(draft.publishedAt || draft.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>

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
              <p className="text-xs text-stone-400">{authorTitle || 'Pulse Intelligence Labs'}</p>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <div className="h-px mb-12" style={{ background: 'linear-gradient(90deg, transparent, #E63946 30%, #457B9D 70%, transparent)' }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 md:px-8 relative">
          <div
            className="max-w-3xl mx-auto mb-10"
            style={{ fontFamily: "'Georgia', 'Times New Roman', 'Noto Serif', serif" }}
          >
            <p className="text-xl text-stone-600 leading-[1.85] font-medium">
              {renderInlineArticleContent(excerpt, `excerpt-${draft.id}`)}
            </p>
          </div>

          <div className="flex gap-16">
            {tocItems.length > 0 && (
              <aside className="hidden lg:block w-56 flex-shrink-0">
                <div className="sticky top-24">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">
                    In this article
                  </p>
                  <nav className="flex flex-col gap-1.5">
                    {tocItems.map((item) => (
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
              className={`flex-1 ${tocItems.length > 0 ? 'max-w-[680px]' : 'max-w-3xl mx-auto'}`}
              style={{ fontFamily: "'Georgia', 'Times New Roman', 'Noto Serif', serif" }}
            >
              {renderRawArticleContent(draft)}

              <div className="mt-16 pt-10 border-t border-stone-200">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-base font-bold text-[#E0FE10]">{authorName.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-stone-900 mb-1" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
                      {authorName}
                    </p>
                    <p className="text-sm text-stone-500 leading-relaxed" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
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
      </div>
    </>
  );
};

const PublishedReviewPage: NextPage = () => {
  const router = useRouter();
  const { slug } = router.query;
  const user = useUser();
  const [draft, setDraft] = useState<DraftReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authorProfiles, setAuthorProfiles] = useState<AuthorProfileOption[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editReviewType, setEditReviewType] = useState<CreateReviewType>('month');
  const [editReviewFormat, setEditReviewFormat] = useState<CreateReviewFormat>('investor-update');
  const [editReviewAuthor, setEditReviewAuthor] = useState('Tremaine');
  const [editReviewAuthorTitle, setEditReviewAuthorTitle] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('1');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reviewContext, setReviewContext] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.email) {
        setIsAdmin(false);
        return;
      }

      try {
        const result = await adminMethods.isAdmin(user.email);
        setIsAdmin(result);
      } catch (adminError) {
        console.error('Error checking admin status on published review page:', adminError);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      setAuthorProfiles([]);
      return;
    }

    const loadAuthors = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'authorProfiles'));
        const profiles = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          title: doc.data().title || '',
        })) as AuthorProfileOption[];

        setAuthorProfiles(profiles);
      } catch (loadError) {
        console.error('Error loading author profiles on published review page:', loadError);
      }
    };

    loadAuthors();
  }, [isAdmin]);

  useEffect(() => {
    const loadReview = async () => {
      if (!slug || typeof slug !== 'string') {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const publishedDraft = await reviewContextService.fetchPublishedDraftById(slug);

        if (!publishedDraft) {
          setError('Review not found');
          setDraft(null);
          return;
        }

        setDraft(publishedDraft);
      } catch (fetchError) {
        console.error('Error loading published review:', fetchError);
        setError('Failed to load review');
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [slug]);

  const openEditModal = () => {
    if (!draft) {
      return;
    }

    const [year, month] = draft.monthYear.split('-').map(Number);
    const matchedProfile = authorProfiles.find((profile) => profile.name === draft.author);
    const preferredProfile = getPreferredAuthorProfile(authorProfiles);

    setEditReviewType(draft.reviewType);
    setEditReviewFormat(draft.formatStyle);
    setEditReviewAuthor(draft.author || matchedProfile?.name || preferredProfile?.name || 'Tremaine');
    setEditReviewAuthorTitle(draft.authorTitle || matchedProfile?.title || preferredProfile?.title || '');
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
    setSelectedQuarter(String(Math.ceil(month / 3)));
    setSelectedYear(String(year));
    setReviewContext(draft.formatStyle === 'article' ? draft.articleContent || '' : '');
    setEditError(null);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditError(null);
    setSavingReview(false);
  };

  const handleSaveReview = async () => {
    if (!draft) {
      return;
    }

    const reviewFormTarget = getReviewFormTarget(editReviewType, selectedMonth, selectedQuarter, selectedYear);
    if (!reviewFormTarget) {
      return;
    }

    const { year, month, label } = reviewFormTarget;
    const targetMonthYear = `${year}-${String(month).padStart(2, '0')}`;
    const hasNewContext = Boolean(reviewContext.trim());
    const articleSource = editReviewFormat === 'article'
      ? reviewContext.trim() || draft.articleContent || ''
      : '';
    const hasEditChanges = (
      draft.reviewType !== editReviewType ||
      draft.formatStyle !== editReviewFormat ||
      draft.monthYear !== targetMonthYear ||
      (draft.author || '') !== editReviewAuthor ||
      (draft.authorTitle || '') !== editReviewAuthorTitle
    );

    try {
      setSavingReview(true);
      setEditError(null);

      if (editReviewFormat !== 'article' && hasNewContext) {
        await reviewContextService.addWeeklyContext(
          reviewContext.trim(),
          'manual',
          undefined,
          {
            year,
            month,
            weekNumber: 0,
          },
        );
      }

      if (editReviewFormat === 'article') {
        if (!articleSource) {
          throw new Error('Paste the full article content before saving an article review.');
        }

        await reviewContextService.createArticleDraftFromContent(year, month, articleSource, {
          existingDraftId: draft.id,
          reviewType: editReviewType,
          author: editReviewAuthor,
          authorTitle: editReviewAuthorTitle,
        });
      } else {
        const needsStructuredRegeneration = Boolean(
          hasNewContext ||
          draft.reviewType !== editReviewType ||
          draft.monthYear !== targetMonthYear
        );

        if (needsStructuredRegeneration) {
          await reviewContextService.generateDraftFromContext(year, month, {
            existingDraftId: draft.id,
            reviewType: editReviewType,
            formatStyle: editReviewFormat,
            author: editReviewAuthor,
            authorTitle: editReviewAuthorTitle,
          });
        } else if (hasEditChanges) {
          await reviewContextService.updateDraft(draft.id, {
            formatStyle: editReviewFormat,
            author: editReviewAuthor,
            authorTitle: editReviewAuthorTitle,
          });
        } else {
          closeEditModal();
          return;
        }
      }

      const refreshedDraft = await reviewContextService.fetchPublishedDraftById(draft.id);
      if (refreshedDraft) {
        setDraft(refreshedDraft);
      }
      closeEditModal();
    } catch (saveError: any) {
      console.error('Error saving published review edits:', saveError);
      setEditError(
        `The review could not be updated for ${label}. ${saveError?.message || 'Try again.'}`,
      );
    } finally {
      setSavingReview(false);
    }
  };

  const editModal = showEditModal ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <div className="border-b border-stone-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-stone-900">
            Edit Review Draft
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Update the review type or format here, and add more source context only if you want the review regenerated from new material.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">
              Review type
            </label>
            <div className="flex flex-wrap gap-2">
              {createReviewTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEditReviewType(type)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    editReviewType === type
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {type === 'month' ? 'Monthly' : type === 'quarter' ? 'Quarterly' : 'Year in Review'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="published-review-format" className="mb-2 block text-sm font-medium text-stone-700">
              Format
            </label>
            <select
              id="published-review-format"
              value={editReviewFormat}
              onChange={(event) => setEditReviewFormat(event.target.value as CreateReviewFormat)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
            >
              {createReviewFormats.map((formatStyle) => (
                <option key={formatStyle} value={formatStyle}>
                  {getDraftFormatLabel(formatStyle)}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-stone-500">
              Investor Update keeps the milestone-and-metrics layout. Article renders the review in the same editorial reading style as Research.
            </p>
          </div>

          <div>
            <label htmlFor="published-review-author" className="mb-2 block text-sm font-medium text-stone-700">
              Author
            </label>
            <select
              id="published-review-author"
              value={editReviewAuthor}
              onChange={(event) => {
                const nextAuthor = authorProfiles.find((profile) => profile.name === event.target.value);
                setEditReviewAuthor(event.target.value);
                setEditReviewAuthorTitle(nextAuthor?.title || '');
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
            >
              {authorProfiles.length > 0 ? (
                authorProfiles.map((author) => (
                  <option key={author.id} value={author.name}>
                    {author.name}{author.title ? ` — ${author.title}` : ''}
                  </option>
                ))
              ) : (
                <option value={editReviewAuthor}>{editReviewAuthor || 'Tremaine'}</option>
              )}
            </select>
            {editReviewAuthorTitle && (
              <p className="mt-2 text-xs text-stone-500">
                {editReviewAuthorTitle}
              </p>
            )}
          </div>

          <div>
            {editReviewType === 'month' ? (
              <>
                <label htmlFor="published-review-month" className="mb-2 block text-sm font-medium text-stone-700">
                  Month
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="published-review-month"
                    type="month"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-11 pr-4 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  />
                </div>
              </>
            ) : editReviewType === 'quarter' ? (
              <>
                <label className="mb-2 block text-sm font-medium text-stone-700">
                  Quarter
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={selectedQuarter}
                    onChange={(event) => setSelectedQuarter(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  >
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(event) => setSelectedYear(event.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  >
                    {getYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <label htmlFor="published-review-year" className="mb-2 block text-sm font-medium text-stone-700">
                  Year
                </label>
                <select
                  id="published-review-year"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                >
                  {getYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div>
            <label htmlFor="published-review-context" className="mb-2 block text-sm font-medium text-stone-700">
              {editReviewFormat === 'article'
                ? 'Article content'
                : editReviewType === 'year'
                  ? 'Additional year-in-review context'
                  : editReviewType === 'quarter'
                    ? 'Additional quarterly context'
                    : 'Additional monthly context'}
            </label>
            <textarea
              id="published-review-context"
              value={reviewContext}
              onChange={(event) => setReviewContext(event.target.value)}
              placeholder={
                editReviewFormat === 'article'
                  ? 'Paste the full article exactly as you want it to appear. We will preserve the body copy instead of reformatting it into review blocks.'
                  : editReviewType === 'year'
                    ? 'Optional: paste any new year-in-review notes, metrics, launches, lessons, or context you want folded into a regenerated review.'
                    : editReviewType === 'quarter'
                      ? 'Optional: paste any new quarter-level notes, wins, metrics, launches, or blockers you want folded into a regenerated review.'
                      : 'Optional: paste any new monthly notes, wins, metrics, launches, or feedback you want folded into a regenerated review.'
              }
              className="h-56 w-full resize-none rounded-xl border border-stone-300 bg-white p-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
              autoFocus
            />
            <p className="mt-2 text-xs text-stone-500">
              {editReviewFormat === 'article'
                ? 'Article mode preserves your prose and applies the research-style reading layout around it. Add inline citations with [[[\"https://source-one.com\", \"https://source-two.com\"]]] exactly where you want the source pill to appear.'
                : 'You can change the type or format without adding more context. Paste new notes only when you want the review copy regenerated.'}
            </p>
          </div>

          {editError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {editError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-stone-200 bg-stone-50 px-6 py-4">
          <button
            onClick={closeEditModal}
            className="px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveReview}
            disabled={savingReview}
            className="flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingReview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4" />
                Save Review Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stone-900" />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'review-not-found',
            pageTitle: 'Review Not Found – Pulse',
            metaDescription: 'The requested investor update could not be found.',
            ogTitle: 'Review Not Found – Pulse',
            ogDescription: 'The requested investor update could not be found.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://fitwithpulse.ai/review"
          pageOgImage="/og-image.png?title=Investor%20Updates"
        />
        <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-6">
          <div className="text-center">
            <h1 className="mb-3 text-3xl font-bold text-stone-900">Review not found</h1>
            <p className="mb-6 text-stone-500">{error || 'This investor update is unavailable.'}</p>
            <Link href="/review" className="text-sm font-medium text-stone-900 hover:text-stone-600 transition-colors">
              Back to Investor Updates
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (draft.formatStyle === 'article' && draft.articleContent?.trim()) {
    return (
      <>
        <PublishedArticleReview draft={draft} isAdmin={isAdmin} onEdit={openEditModal} />
        {editModal}
      </>
    );
  }

  return (
    <>
      <PublishedStructuredReview draft={draft} isAdmin={isAdmin} onEdit={openEditModal} />
      {editModal}
    </>
  );
};

export default PublishedReviewPage;
