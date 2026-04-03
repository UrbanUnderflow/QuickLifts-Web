import React, { useEffect, useState } from 'react';
import type { GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Edit3, FileText, Loader2, Plus } from 'lucide-react';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { collection, getDocs } from 'firebase/firestore';
import PageHead from '../../components/PageHead';
import { db } from '../../api/firebase/config';
import { reviewContextService } from '../../api/firebase/reviewContext/service';
import { DraftReview } from '../../api/firebase/reviewContext/types';
import type { DraftReviewFormat } from '../../api/firebase/reviewContext/types';
import { useUser } from '../../hooks/useUser';
import { adminMethods } from '../../api/firebase/admin/methods';

interface Review {
  id: string;
  title: string;
  description: string;
  date: string;
  reviewType: 'month' | 'year' | 'quarter';
  isDraft?: boolean;
  draftId?: string;
}

interface ReviewsIndexProps {
  reviews: Review[];
}

interface AuthorProfileOption {
  id: string;
  name: string;
  title: string;
}

type ReviewFilter = 'All' | 'Year in Review' | 'Quarterly' | 'Monthly' | 'Drafts';
type CreateReviewType = 'month' | 'quarter' | 'year';
type CreateReviewFormat = DraftReviewFormat;

const reviewFilters: ReviewFilter[] = ['All', 'Year in Review', 'Quarterly', 'Monthly', 'Drafts'];
const createReviewTypes: CreateReviewType[] = ['month', 'quarter', 'year'];
const createReviewFormats: CreateReviewFormat[] = ['investor-update', 'article'];

const getCurrentMonthValue = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getCurrentYearValue = (): string => String(new Date().getFullYear());

const getCurrentQuarterValue = (): string => String(Math.ceil((new Date().getMonth() + 1) / 3));

const getQuarterNumber = (date: string): number => Math.ceil(parseInt(date.substring(5, 7), 10) / 3);

const formatMonthYear = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

const getReviewPeriodLabel = (review: Review): string => {
  if (review.reviewType === 'year') {
    return `${review.date.substring(0, 4)} Year in Review`;
  }

  if (review.reviewType === 'quarter') {
    return `Q${getQuarterNumber(review.date)} ${review.date.substring(0, 4)}`;
  }

  return formatMonthYear(review.date);
};

const getReviewTypeLabel = (review: Review): string => {
  if (review.isDraft) {
    return 'Draft';
  }

  if (review.reviewType === 'year') {
    return 'Year in Review';
  }

  if (review.reviewType === 'quarter') {
    return 'Quarterly Update';
  }

  return 'Monthly Update';
};

const matchesFilter = (review: Review, filter: ReviewFilter): boolean => {
  if (filter === 'All') {
    return true;
  }

  if (filter === 'Drafts') {
    return Boolean(review.isDraft);
  }

  if (filter === 'Year in Review') {
    return review.reviewType === 'year';
  }

  if (filter === 'Quarterly') {
    return review.reviewType === 'quarter';
  }

  return review.reviewType === 'month' && !review.isDraft;
};

const getFeaturedCardClasses = (review: Review): string => {
  if (review.isDraft) {
    return 'border-amber-300 bg-amber-50/70';
  }

  if (review.reviewType === 'year') {
    return 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-[#fff9e8]';
  }

  return 'border-stone-200 bg-white/80';
};

const getAccentClasses = (review: Review): string => {
  if (review.isDraft) {
    return 'border-amber-500';
  }

  if (review.reviewType === 'year') {
    return 'border-amber-400';
  }

  return 'border-stone-900';
};

const getDraftStatusClasses = (status: DraftReview['status']): string => {
  if (status === 'published') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (status === 'ready') {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const getDraftTypeLabel = (reviewType: CreateReviewType): string => {
  if (reviewType === 'quarter') {
    return 'Quarterly Review';
  }

  if (reviewType === 'year') {
    return 'Year in Review';
  }

  return 'Monthly Review';
};

const getDraftFormatLabel = (formatStyle: DraftReviewFormat): string =>
  formatStyle === 'article' ? 'Article' : 'Investor Update';

const getPreferredAuthorProfile = (profiles: AuthorProfileOption[]): AuthorProfileOption | null =>
  profiles.find((profile) => profile.name === 'Tremaine') || profiles[0] || null;

const getYearOptions = (): string[] => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
};

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

const FeaturedReviewCard: React.FC<{ review: Review }> = ({ review }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
  >
    <Link href={`/review/${review.id}`} className="block group">
      <article className={`border rounded-[28px] p-8 md:p-10 shadow-sm transition-all duration-300 group-hover:shadow-md ${getFeaturedCardClasses(review)}`}>
        <div className={`border-t-2 pt-8 ${getAccentClasses(review)}`}>
          <div className="flex flex-wrap items-center gap-3 mb-5 text-sm text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              Latest Update
            </span>
            <span className="text-stone-300">·</span>
            <span>{getReviewTypeLabel(review)}</span>
            <span className="text-stone-300">·</span>
            <span>{getReviewPeriodLabel(review)}</span>
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="text-4xl md:text-5xl font-bold tracking-tight text-stone-900">
                  {review.date.substring(0, 4)}
                </span>
                {review.reviewType === 'quarter' && (
                  <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-white">
                    Q{getQuarterNumber(review.date)}
                  </span>
                )}
                {review.isDraft && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-stone-950">
                    <Edit3 size={12} />
                    Draft
                  </span>
                )}
              </div>

              <h2 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-stone-900 transition-colors duration-300 group-hover:text-stone-700 md:text-4xl">
                {review.title}
              </h2>

              <p className="max-w-2xl text-lg leading-relaxed text-stone-500">
                {review.description}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 text-sm font-medium text-stone-900 transition-colors duration-300 group-hover:text-stone-600">
              Open update
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  </motion.div>
);

const ReviewListItem: React.FC<{ review: Review; index: number }> = ({ review, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
  >
    <Link href={`/review/${review.id}`} className="block group">
      <article className="border-b border-stone-200 py-8 transition-colors duration-300 group-hover:border-stone-400">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-10">
          <div className="w-full flex-shrink-0 md:w-44">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              {getReviewTypeLabel(review)}
            </div>
            <div className="mt-2 text-2xl font-bold leading-none tracking-tight text-stone-900">
              {review.date.substring(0, 4)}
            </div>
            <div className="mt-2 text-sm text-stone-500">
              {review.reviewType === 'quarter'
                ? `Q${getQuarterNumber(review.date)}`
                : review.reviewType === 'year'
                  ? 'Annual'
                  : new Date(`${review.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold leading-tight text-stone-900 transition-colors duration-300 group-hover:text-stone-700 md:text-2xl">
                {review.title}
              </h3>
              {review.isDraft && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-950">
                  <Edit3 size={11} />
                  Draft
                </span>
              )}
            </div>

            <p className="max-w-3xl text-base leading-relaxed text-stone-500">
              {review.description}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-stone-900 transition-colors duration-300 group-hover:text-stone-600">
              Read update
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  </motion.div>
);

const ReviewsIndex: NextPage<ReviewsIndexProps> = ({ reviews: staticReviews }) => {
  const user = useUser();
  const [drafts, setDrafts] = useState<DraftReview[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>(staticReviews);
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('All');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [showCreateReviewModal, setShowCreateReviewModal] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [createReviewType, setCreateReviewType] = useState<CreateReviewType>('month');
  const [createReviewFormat, setCreateReviewFormat] = useState<CreateReviewFormat>('investor-update');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarterValue());
  const [selectedYear, setSelectedYear] = useState(getCurrentYearValue());
  const [monthReviewContext, setMonthReviewContext] = useState('');
  const [creatingReview, setCreatingReview] = useState(false);
  const [adminSurfaceError, setAdminSurfaceError] = useState<string | null>(null);

  const applyDraftsToState = (draftData: DraftReview[]) => {
    const unpublishedDrafts = draftData.filter((draft) => draft.status !== 'published');
    setDrafts(unpublishedDrafts);

    const draftReviews: Review[] = unpublishedDrafts.map((draft) => {
      const [year, month] = draft.monthYear.split('-');

      return {
        id: `draft/${draft.id}`,
        title: draft.title,
        description: draft.description,
        date: `${year}-${month}-01`,
        reviewType: draft.reviewType === 'quarter' ? 'quarter' : draft.reviewType === 'year' ? 'year' : 'month',
        isDraft: true,
        draftId: draft.id,
      };
    });

    const merged = [...draftReviews, ...staticReviews];
    merged.sort((a, b) => b.date.localeCompare(a.date));
    setAllReviews(merged);
  };

  const refreshDrafts = async () => {
    const draftData = await reviewContextService.fetchAllDrafts();
    applyDraftsToState(draftData);
  };

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
    if (checkingAdmin || !isAdmin) {
      if (!checkingAdmin && !isAdmin) {
        setAllReviews(staticReviews);
      }
      return;
    }

    const fetchDrafts = async () => {
      try {
        const draftData = await reviewContextService.fetchAllDrafts();
        applyDraftsToState(draftData);
      } catch (err) {
        console.error('Error fetching drafts:', err);
        setAllReviews(staticReviews);
      }
    };

    fetchDrafts();
  }, [staticReviews, isAdmin, checkingAdmin]);

  useEffect(() => {
    if (activeFilter === 'Drafts' && !isAdmin) {
      setActiveFilter('All');
    }
  }, [activeFilter, isAdmin]);

  useEffect(() => {
    if (selectedDraftId && !drafts.some((draft) => draft.id === selectedDraftId)) {
      setSelectedDraftId(null);
    }
  }, [drafts, selectedDraftId]);

  const openCreateReviewModal = () => {
    setEditingDraftId(null);
    setCreateReviewType('month');
    setCreateReviewFormat('investor-update');
    setSelectedMonth(getCurrentMonthValue());
    setSelectedQuarter(getCurrentQuarterValue());
    setSelectedYear(getCurrentYearValue());
    setMonthReviewContext('');
    setAdminSurfaceError(null);
    setShowCreateReviewModal(true);
  };

  const openEditReviewModal = (draft: DraftReview) => {
    const [year, month] = draft.monthYear.split('-').map(Number);
    setEditingDraftId(draft.id);
    setCreateReviewType(draft.reviewType);
    setCreateReviewFormat(draft.formatStyle);
    setSelectedMonth(`${year}-${String(month).padStart(2, '0')}`);
    setSelectedQuarter(String(Math.ceil(month / 3)));
    setSelectedYear(String(year));
    setMonthReviewContext(draft.formatStyle === 'article' ? draft.articleContent || '' : '');
    setAdminSurfaceError(null);
    setShowCreateReviewModal(true);
  };

  const closeCreateReviewModal = () => {
    setShowCreateReviewModal(false);
    setEditingDraftId(null);
    setMonthReviewContext('');
    setAdminSurfaceError(null);
  };

  const selectedDraft = drafts.find((draft) => draft.id === selectedDraftId) || null;
  const editingDraft = drafts.find((draft) => draft.id === editingDraftId) || null;
  const reviewFormTarget = getReviewFormTarget(createReviewType, selectedMonth, selectedQuarter, selectedYear);
  const editingTargetMonthYear = reviewFormTarget
    ? `${reviewFormTarget.year}-${String(reviewFormTarget.month).padStart(2, '0')}`
    : null;
  const hasEditChanges = Boolean(
    editingDraft &&
      reviewFormTarget &&
      (
        editingDraft.reviewType !== createReviewType ||
        editingDraft.formatStyle !== createReviewFormat ||
        editingDraft.monthYear !== editingTargetMonthYear
      ),
  );
  const canSubmitReviewForm = creatingReview
    ? false
    : Boolean(
        reviewFormTarget &&
          (
            monthReviewContext.trim() ||
            !editingDraft ||
            hasEditChanges
          ),
      );

  const handleCreateReview = async () => {
    if (!reviewFormTarget) {
      return;
    }

    const isEditingDraft = Boolean(editingDraft);
    const hasNewContext = Boolean(monthReviewContext.trim());
    const articleSource = createReviewFormat === 'article'
      ? monthReviewContext.trim() || editingDraft?.articleContent || ''
      : '';
    let savedPeriodLabel: string | null = null;

    try {
      setCreatingReview(true);
      setAdminSurfaceError(null);

      if (!isEditingDraft && !hasNewContext) {
        throw new Error('Paste some context before creating a review.');
      }

      const { year, month, label } = reviewFormTarget;
      savedPeriodLabel = label;

      if (createReviewFormat !== 'article' && hasNewContext) {
        await reviewContextService.addWeeklyContext(
          monthReviewContext.trim(),
          'manual',
          undefined,
          {
            year,
            month,
            weekNumber: 0,
          },
        );
      }

      let draftIdToSelect = editingDraft?.id || null;
      const targetMonthYear = `${year}-${String(month).padStart(2, '0')}`;
      const needsStructuredRegeneration = Boolean(
        !editingDraft ||
          hasNewContext ||
          (editingDraft &&
            (
              editingDraft.reviewType !== createReviewType ||
              editingDraft.monthYear !== targetMonthYear
            )),
      );

      if (createReviewFormat === 'article') {
        if (!articleSource) {
          throw new Error('Paste the full article content before saving an article draft.');
        }

        const articleChanged = editingDraft?.articleContent !== articleSource;
        const needsArticleSave = Boolean(
          !editingDraft ||
            articleChanged ||
            editingDraft.reviewType !== createReviewType ||
            editingDraft.monthYear !== targetMonthYear ||
            editingDraft.formatStyle !== 'article',
        );

        if (!needsArticleSave) {
          closeCreateReviewModal();
          return;
        }

        const draft = await reviewContextService.createArticleDraftFromContent(year, month, articleSource, {
          reviewType: createReviewType,
        });
        draftIdToSelect = draft.id;
      } else if (needsStructuredRegeneration) {
        const draft = await reviewContextService.generateDraftFromContext(year, month, {
          reviewType: createReviewType,
          formatStyle: createReviewFormat,
        });
        draftIdToSelect = draft.id;
      } else if (editingDraft && editingDraft.formatStyle !== createReviewFormat) {
        await reviewContextService.updateDraft(editingDraft.id, {
          formatStyle: createReviewFormat,
        });
      } else if (editingDraft) {
        closeCreateReviewModal();
        return;
      }

      await refreshDrafts();
      closeCreateReviewModal();
      if (draftIdToSelect) {
        setSelectedDraftId(draftIdToSelect);
      }
    } catch (error: any) {
      console.error('Error saving review from review index:', error);
      if (savedPeriodLabel) {
        setAdminSurfaceError(
          hasNewContext && createReviewFormat !== 'article'
            ? `Context for ${savedPeriodLabel} was saved, but the draft could not be generated automatically. ${
                error?.message || 'Try again from Review Tracker.'
              }`
            : `The draft could not be updated for ${savedPeriodLabel}. ${
                error?.message || 'Try again from Review Tracker.'
              }`,
        );
      } else {
        setAdminSurfaceError(error?.message || 'Failed to save review draft.');
      }
    } finally {
      setCreatingReview(false);
    }
  };

  const filtersToRender = isAdmin ? reviewFilters : reviewFilters.filter((filter) => filter !== 'Drafts');
  const filteredReviews = allReviews.filter((review) => matchesFilter(review, activeFilter));
  const featuredReview = filteredReviews[0];
  const remainingReviews = filteredReviews.slice(1);
  const publishedReviewCount = allReviews.filter((review) => !review.isDraft).length;
  const draftCount = allReviews.filter((review) => review.isDraft).length;

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'review',
          pageTitle: 'Investor Updates – Pulse',
          metaDescription:
            "A chronological archive of Pulse investor updates, milestones, experiments, and learnings as we build the future of social fitness.",
          ogTitle: 'Investor Updates – Pulse',
          ogDescription:
            "A chronological archive of Pulse investor updates, milestones, experiments, and learnings as we build the future of social fitness.",
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/review"
        pageOgImage="/og-image.png?title=Investor%20Updates"
      />

      <div className="min-h-screen bg-[#FAFAF7]">
        <nav className="sticky top-0 z-50 border-b border-stone-200/60 bg-[#FAFAF7]/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-8">
            <Link href="/" className="flex items-center gap-3">
              <img src="/pulse-logo.svg" alt="Pulse" className="h-8" />
            </Link>

            <div className="hidden items-center gap-8 sm:flex">
              <Link href="/review" className="text-sm font-semibold text-stone-900">
                Investor Updates
              </Link>
              <Link href="/research" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                Research
              </Link>
              <Link href="/" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                Home
              </Link>
              <Link href="/about" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                About
              </Link>
            </div>

            <div className="sm:hidden">
              <Link href="/" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                ← Home
              </Link>
            </div>
          </div>
        </nav>

        <header className="mx-auto max-w-6xl px-6 pb-12 pt-16 md:px-8 md:pb-14 md:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
              Investor Updates
            </p>
            <h1
              className="mb-6 text-5xl font-bold tracking-tight text-stone-900 md:text-6xl lg:text-7xl"
              style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
            >
              Progress, shipped work, and what we&apos;re learning.
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <p className="text-lg leading-relaxed text-stone-500 md:text-xl">
              A running archive of our milestones, experiments, investor notes, and product
              progress as Pulse grows from idea to enduring fitness platform.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-400"
          >
            <span>{publishedReviewCount} published updates</span>
            <span className="hidden text-stone-300 sm:inline">·</span>
            <span>Latest period: {featuredReview ? getReviewPeriodLabel(featuredReview) : 'Coming soon'}</span>
            {isAdmin && draftCount > 0 && (
              <>
                <span className="hidden text-stone-300 sm:inline">·</span>
                <span>{draftCount} draft updates</span>
              </>
            )}
          </motion.div>
        </header>

        <div className="mx-auto max-w-6xl px-6 pb-10 md:px-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-2 text-sm text-stone-400">Views:</span>
            {filtersToRender.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                  activeFilter === filter
                    ? 'bg-stone-900 text-white'
                    : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                {filter}
              </button>
            ))}
          </motion.div>
        </div>

        {isAdmin && !checkingAdmin && (
          <div className="mx-auto max-w-6xl px-6 pb-12 md:px-8">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Admin Surface
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
                  Review Studio
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                  Start a new investor update draft, or jump back into an existing one without
                  leaving the reviews directory.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/admin/reviewTracker"
                  className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  <Edit3 className="h-4 w-4" />
                  Review Tracker
                </Link>
                <button
                  onClick={openCreateReviewModal}
                  className="flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  <Plus className="h-4 w-4" />
                  New Review
                </button>
              </div>
            </div>

            {adminSurfaceError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {adminSurfaceError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-stone-900">Draft Reviews</h3>
                    <span className="text-xs text-stone-400">{drafts.length} total</span>
                  </div>

                  {drafts.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="mx-auto mb-3 h-10 w-10 text-stone-300" />
                      <p className="text-sm text-stone-500">No drafts yet</p>
                      <button
                        onClick={openCreateReviewModal}
                        className="mt-3 text-sm text-stone-600 transition-colors hover:text-stone-900"
                      >
                        Create your first review →
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {drafts.map((draft) => (
                        <li key={draft.id}>
                          <button
                            onClick={() => setSelectedDraftId(draft.id)}
                            className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
                              selectedDraftId === draft.id
                                ? 'border-stone-300 bg-white shadow-md'
                                : 'border-stone-100 bg-stone-50 hover:border-stone-200 hover:bg-white hover:shadow-sm'
                            }`}
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <h4 className="line-clamp-2 text-sm font-medium leading-snug text-stone-900">
                                {draft.title}
                              </h4>
                              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getDraftStatusClasses(draft.status)}`}>
                                {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-500">
                              <span>{getDraftTypeLabel(draft.reviewType)}</span>
                              <span>·</span>
                              <span>{getDraftFormatLabel(draft.formatStyle)}</span>
                              <span>·</span>
                              <span>{draft.getMonthYearLabel()}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="lg:col-span-8">
                {selectedDraft ? (
                  <div className="flex min-h-[420px] flex-col rounded-2xl border border-stone-200 bg-white p-8 shadow-lg">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                          Draft Review
                        </p>
                        <h3 className="text-2xl font-semibold tracking-tight text-stone-900">
                          {selectedDraft.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-stone-500">
                          {selectedDraft.getMonthYearLabel()} · {getDraftTypeLabel(selectedDraft.reviewType)} · {getDraftFormatLabel(selectedDraft.formatStyle)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getDraftStatusClasses(selectedDraft.status)}`}>
                        {selectedDraft.status.charAt(0).toUpperCase() + selectedDraft.status.slice(1)}
                      </span>
                    </div>

                    <p className="mb-6 max-w-3xl text-base leading-relaxed text-stone-600">
                      {selectedDraft.description}
                    </p>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-stone-400">Featured</p>
                        <p className="mt-2 text-2xl font-semibold text-stone-900">
                          {selectedDraft.featuredHighlights.length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-stone-400">Metrics</p>
                        <p className="mt-2 text-2xl font-semibold text-stone-900">
                          {selectedDraft.metrics.length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-stone-400">Updated</p>
                        <p className="mt-2 text-sm font-medium text-stone-900">
                          {selectedDraft.updatedAt.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
                      <Link
                        href={`/review/draft/${selectedDraft.id}`}
                        className="flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                      >
                        Open Draft
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => openEditReviewModal(selectedDraft)}
                        className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <Edit3 className="h-4 w-4" />
                        Edit Review
                      </button>
                      <button
                        onClick={openCreateReviewModal}
                        className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                      >
                        <Plus className="h-4 w-4" />
                        New Review
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-lg">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
                        <FileText className="h-8 w-8 text-stone-400" />
                      </div>
                      <h3 className="mb-1 text-lg font-semibold text-stone-900">No draft selected</h3>
                      <p className="mb-6 text-stone-500">
                        Select a draft from the list or create a new one
                      </p>
                      <button
                        onClick={openCreateReviewModal}
                        className="mx-auto flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                      >
                        <Plus className="h-4 w-4" />
                        New Review
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {featuredReview ? (
          <>
            <div className="mx-auto max-w-6xl px-6 pb-12 md:px-8">
              <FeaturedReviewCard review={featuredReview} />
            </div>

            <div className="mx-auto max-w-6xl px-6 pb-24 md:px-8">
              {remainingReviews.length > 0 && (
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Previous Updates
                </div>
              )}

              {remainingReviews.length > 0 ? (
                <div>
                  {remainingReviews.map((review, index) => (
                    <ReviewListItem key={review.id} review={review} index={index} />
                  ))}
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
                  <p className="text-lg text-stone-400">
                    No additional updates in this view yet.
                  </p>
                </motion.div>
              )}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-6xl px-6 pb-24 md:px-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
              <p className="text-lg text-stone-400">
                No investor updates available in this view yet.
              </p>
            </motion.div>
          </div>
        )}

        <footer className="border-t border-stone-200 bg-[#FAFAF7]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center md:px-8">
            <div>
              <img src="/pulse-logo.svg" alt="Pulse" className="mb-3 h-6" />
              <p className="text-sm text-stone-400">
                © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <Link href="/research" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                Research
              </Link>
              <Link href="/" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                Home
              </Link>
              <Link href="/about" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                About
              </Link>
              <Link href="/press" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
                Press Kit
              </Link>
            </div>
          </div>
        </footer>

        {showCreateReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
              <div className="border-b border-stone-200 px-6 py-5">
                <h2 className="text-xl font-semibold text-stone-900">
                  {editingDraft ? 'Edit Review Draft' : 'Create New Review'}
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {editingDraft
                    ? 'Update the review type or format here, and add more source context only if you want the draft regenerated from new material.'
                    : 'Choose the review type, set the period, paste the raw context you want included, and generate a draft review.'}
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
                        onClick={() => setCreateReviewType(type)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          createReviewType === type
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
                  <label htmlFor="review-format" className="mb-2 block text-sm font-medium text-stone-700">
                    Format
                  </label>
                  <select
                    id="review-format"
                    value={createReviewFormat}
                    onChange={(event) => setCreateReviewFormat(event.target.value as CreateReviewFormat)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                  >
                    {createReviewFormats.map((formatStyle) => (
                      <option key={formatStyle} value={formatStyle}>
                        {getDraftFormatLabel(formatStyle)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-stone-500">
                    Investor Update keeps the milestone-and-metrics layout. Article renders the draft in the same editorial reading style as Research.
                  </p>
                </div>

                <div>
                  {createReviewType === 'month' ? (
                    <>
                      <label htmlFor="review-month" className="mb-2 block text-sm font-medium text-stone-700">
                        Month
                      </label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <input
                          id="review-month"
                          type="month"
                          value={selectedMonth}
                          onChange={(event) => setSelectedMonth(event.target.value)}
                          className="w-full rounded-xl border border-stone-300 bg-white py-3 pl-11 pr-4 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                        />
                      </div>
                    </>
                  ) : createReviewType === 'quarter' ? (
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
                      <label htmlFor="review-year" className="mb-2 block text-sm font-medium text-stone-700">
                        Year
                      </label>
                      <select
                        id="review-year"
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
                  <label htmlFor="review-context" className="mb-2 block text-sm font-medium text-stone-700">
                    {createReviewFormat === 'article'
                      ? 'Article content'
                      : editingDraft
                        ? (createReviewType === 'year' ? 'Additional year-in-review context' : createReviewType === 'quarter' ? 'Additional quarterly context' : 'Additional monthly context')
                        : (createReviewType === 'year' ? 'Year-in-review context' : createReviewType === 'quarter' ? 'Quarterly context' : 'Monthly context')}
                  </label>
                  <textarea
                    id="review-context"
                    value={monthReviewContext}
                    onChange={(event) => setMonthReviewContext(event.target.value)}
                    placeholder={
                      createReviewFormat === 'article'
                        ? 'Paste the full article exactly as you want it to appear. We will preserve the body copy instead of reformatting it into review blocks.'
                        : editingDraft
                          ? (
                              createReviewType === 'year'
                                ? 'Optional: paste any new year-in-review notes, metrics, launches, lessons, or context you want folded into a regenerated draft.'
                                : createReviewType === 'quarter'
                                  ? 'Optional: paste any new quarter-level notes, wins, metrics, launches, or blockers you want folded into a regenerated draft.'
                                  : 'Optional: paste any new monthly notes, wins, metrics, launches, or feedback you want folded into a regenerated draft.'
                            )
                          : (
                              createReviewType === 'year'
                                ? 'Paste rough notes for the full year: major wins, launches, partnerships, metrics, lessons, and what mattered most.'
                                : createReviewType === 'quarter'
                                  ? 'Paste quarter-level notes: wins, metrics, launches, partnerships, customer feedback, blockers, and what defined the quarter.'
                                  : 'Paste rough notes, wins, metrics, launches, customer feedback, blockers, and anything else the draft should pull through.'
                            )
                    }
                    className="h-56 w-full resize-none rounded-xl border border-stone-300 bg-white p-4 text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-stone-500">
                    {createReviewFormat === 'article'
                      ? 'Article mode preserves your prose and applies the research-style reading layout around it.'
                      : editingDraft
                        ? 'You can change the type or format without adding more context. Paste new notes only when you want the draft copy regenerated.'
                        : 'Tip: bullets are fine. Include numbers, partnerships, launches, and what mattered most. The selected format only changes presentation, not what source context is saved.'}
                  </p>
                </div>

                {adminSurfaceError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {adminSurfaceError}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-stone-200 bg-stone-50 px-6 py-4">
                <button
                  onClick={closeCreateReviewModal}
                  className="px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReview}
                  disabled={!canSubmitReviewForm}
                  className="flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingReview ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editingDraft ? 'Saving...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingDraft ? <Edit3 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {editingDraft ? 'Save Review Changes' : 'Create Draft Review'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const getStaticProps: GetStaticProps<ReviewsIndexProps> = async () => {
  try {
    const reviewsDirectory = path.join(process.cwd(), 'src', 'pages', 'review');
    const filenames = fs.readdirSync(reviewsDirectory);

    const monthMap: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };

    const reviews = await Promise.all(
      filenames
        .filter((filename) => filename !== 'index.tsx' && filename !== 'q4-25.tsx' && filename.endsWith('.tsx'))
        .map(async (filename) => {
          const id = filename.replace(/\.tsx$/, '');
          const fullPath = path.join(reviewsDirectory, filename);
          const fileContent = fs.readFileSync(fullPath, 'utf8');

          const dom = new JSDOM(fileContent);
          const document = dom.window.document;

          const title = document.querySelector('h1')?.textContent?.trim() || id;
          const description =
            document.querySelector('[data-description="true"]')?.textContent?.trim() ||
            'Monthly review of our progress and achievements.';

          let date: string;
          let reviewType: 'month' | 'year' | 'quarter';

          if (id === 'yearInReview') {
            date = '2024-12-31';
            reviewType = 'year';
          } else if (id === 'year2025') {
            date = '2025-12-31';
            reviewType = 'year';
          } else if (id.startsWith('q')) {
            reviewType = 'quarter';
            const quarterMatch = id.match(/q([1-4])-(\d+)/);
            const quarter = quarterMatch ? parseInt(quarterMatch[1], 10) : null;
            const yearShort = quarterMatch ? quarterMatch[2] : null;
            const year = yearShort ? `20${yearShort}` : null;

            if (year && quarter) {
              const endMonth = String(quarter * 3).padStart(2, '0');
              const endDay = quarter === 1 || quarter === 4 ? '31' : '30';
              date = `${year}-${endMonth}-${endDay}`;
            } else {
              console.error(`Failed to parse date from quarterly filename: ${filename}. Assigning default date.`);
              date = '1970-01-01';
            }
          } else {
            reviewType = 'month';
            const dateMatch = id.match(/([a-z]+)(\d+)/);
            const monthName = dateMatch ? dateMatch[1] : null;
            const yearShort = dateMatch ? dateMatch[2] : null;
            const monthNumber = monthName ? monthMap[monthName.toLowerCase()] : null;
            const year = yearShort ? `20${yearShort}` : null;

            if (year && monthNumber) {
              date = `${year}-${monthNumber}-01`;
            } else {
              console.error(`Failed to parse date from filename: ${filename}. Assigning default date.`);
              date = '1970-01-01';
            }
          }

          return {
            id,
            title,
            description,
            date,
            reviewType,
          };
        }),
    );

    reviews.sort((a, b) => b.date.localeCompare(a.date));

    return {
      props: {
        reviews,
      },
    };
  } catch (error) {
    console.error('Error reading reviews:', error);
    return {
      props: {
        reviews: [],
      },
    };
  }
};

export default ReviewsIndex;
