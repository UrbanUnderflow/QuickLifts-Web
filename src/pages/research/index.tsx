import React, { useEffect, useState } from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PageHead from '../../components/PageHead';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import {
  applyResearchArticleListOverride,
  getLocalResearchArticleListItems,
} from '../../content/research/mental-game-white-paper';

// ─── Research categories ───────────────────────────────────────────
const categories = [
  'All',
  'Metabolic Health',
  'Performance Science',
  'Clinical Safety',
  'Technology',
  'Wearables',
  'Nutrition',
  'Recovery',
];

const FEATURED_IMAGE_BY_SLUG: Record<string, string> = {
  'training-the-mental-game-a-simulation-based-architecture-for-mental-performance-in-sport':
    '/research-training-mental-game-white-paper.webp',
  'ai-supported-escalation-human-clinical-handoff-and-return-to-training-pathways':
    '/auntedna-mark.png',
};

// ─── Article interface ─────────────────────────────────────────────
interface Article {
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  category: string;
  readTime: string;
  excerpt: string;
  featured: boolean;
  featuredImage?: string;
  contentType?: 'article' | 'white-paper';
  visibility?: 'public' | 'unlisted';
  listed?: boolean;
  status: 'draft' | 'published' | 'archived';
  createdAt: Timestamp;
  publishedAt?: Timestamp;
}

type FirestoreRestField = {
  stringValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
};

type FirestoreRestDocument = {
  name?: string;
  fields?: Record<string, FirestoreRestField>;
};

const normalizeArticle = (id: string, data: Omit<Article, 'slug'>): Article => ({
  ...applyResearchArticleListOverride({
    ...data,
    // The Firestore document ID is the canonical route segment for /research/[slug].
    slug: id,
  }),
});

const isBrowserLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const restString = (field?: FirestoreRestField) => field?.stringValue || '';
const restBoolean = (field?: FirestoreRestField) => field?.booleanValue === true;
const restTimestamp = (field?: FirestoreRestField) =>
  field?.timestampValue ? Timestamp.fromDate(new Date(field.timestampValue)) : undefined;

const normalizeRestArticle = (document: FirestoreRestDocument): Article | null => {
  const slug = document.name?.split('/').pop();
  const fields = document.fields;
  if (!slug || !fields) return null;

  const publishedAt = restTimestamp(fields.publishedAt);
  const createdAt = restTimestamp(fields.createdAt) || publishedAt || Timestamp.now();
  const status = restString(fields.status) as Article['status'];

  return {
    slug,
    title: restString(fields.title),
    subtitle: restString(fields.subtitle),
    author: restString(fields.author),
    category: restString(fields.category),
    readTime: restString(fields.readTime),
    excerpt: restString(fields.excerpt),
    featured: restBoolean(fields.featured),
    featuredImage: restString(fields.featuredImage) || undefined,
    contentType: (restString(fields.contentType) || 'article') as Article['contentType'],
    visibility: (restString(fields.visibility) || 'public') as Article['visibility'],
    listed: fields.listed?.booleanValue,
    status,
    createdAt,
    publishedAt,
  };
};

const sortArticlesByPublishedDate = (articles: Article[]) =>
  [...articles].sort((a, b) => {
    const aTime = a.publishedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.publishedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

const localResearchArticleToArticle = (
  item: ReturnType<typeof getLocalResearchArticleListItems>[number],
): Article => {
  const createdAt = Timestamp.fromDate(new Date(item.createdAt || item.publishedAt));
  const publishedAt = item.publishedAt ? Timestamp.fromDate(new Date(item.publishedAt)) : undefined;

  return {
    slug: item.slug,
    title: item.title,
    subtitle: item.subtitle,
    author: item.author,
    category: item.category,
    readTime: item.readTime,
    excerpt: item.excerpt,
    featured: item.featured,
    featuredImage: item.featuredImage,
    contentType: item.contentType,
    visibility: 'visibility' in item ? item.visibility : undefined,
    listed: 'listed' in item ? item.listed : undefined,
    status: item.status,
    createdAt,
    publishedAt,
  };
};

const mergeLocalResearchArticles = (articles: Article[]) => {
  const remoteSlugs = new Set(articles.map((article) => article.slug));
  const localArticles = getLocalResearchArticleListItems()
    .filter((article) => !remoteSlugs.has(article.slug))
    .map(localResearchArticleToArticle);

  return sortArticlesByPublishedDate([...articles, ...localArticles]);
};

const fetchProductionResearchArticlesFallback = async (): Promise<Article[]> => {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/researchArticles?pageSize=100`,
  );

  if (!response.ok) {
    throw new Error(`Production research fallback failed with ${response.status}`);
  }

  const payload = (await response.json()) as { documents?: FirestoreRestDocument[] };
  const remoteArticles = sortArticlesByPublishedDate(
    (payload.documents || [])
      .map(normalizeRestArticle)
      .filter((article): article is Article => !!article && article.status === 'published'),
  ).map(applyResearchArticleListOverride);

  return mergeLocalResearchArticles(remoteArticles);
};

// ─── Format date from Timestamp ────────────────────────────────────
const formatDate = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const isWhitePaper = (article: Article) => article.contentType === 'white-paper';

const articleMetaLabel = (article: Article) => (isWhitePaper(article) ? 'White Paper' : article.category);

const articleFeaturedImage = (article: Article) => article.featuredImage || FEATURED_IMAGE_BY_SLUG[article.slug];

const readActionLabel = (article: Article) => (isWhitePaper(article) ? 'Read white paper' : 'Read article');

const isListedArticle = (article: Article) =>
  article.visibility !== 'unlisted' && article.listed !== false;

// ─── Article card component ────────────────────────────────────────
const ArticleCard: React.FC<{ article: Article; index: number }> = ({ article, index }) => {
  const featuredImage = articleFeaturedImage(article);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/research/${article.slug}`} className="block group">
        <article className="py-8 border-b border-stone-200 transition-colors duration-300 group-hover:border-stone-400">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Featured image thumbnail */}
            {featuredImage && (
              <div className="w-full md:w-56 lg:w-64 flex-shrink-0 aspect-[16/10] rounded-lg overflow-hidden bg-stone-100 group-hover:shadow-md transition-shadow duration-300">
                <img
                  src={featuredImage}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-sm font-medium text-stone-500">{articleMetaLabel(article)}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-sm text-stone-400">{formatDate(article.publishedAt || article.createdAt)}</span>
                </div>

                <h3 className="text-xl md:text-2xl font-semibold text-stone-900 mb-2 group-hover:text-stone-700 transition-colors duration-300 leading-tight">
                  {article.title}
                </h3>

                <p className="text-base text-stone-500 leading-relaxed line-clamp-3">
                  {article.excerpt}
                </p>

                <div className="flex items-center gap-4 mt-4">
                  <span className="text-sm text-stone-400">By {article.author}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-sm text-stone-400">{article.readTime}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-stone-900 group-hover:text-stone-600 transition-colors ml-auto">
                    {readActionLabel(article)}
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

// ─── Featured article card ─────────────────────────────────────────
const FeaturedArticleCard: React.FC<{ article: Article }> = ({ article }) => {
  const featuredImage = articleFeaturedImage(article);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/research/${article.slug}`} className="block group">
        <article className="relative border-t-2 border-stone-900 pt-8 md:pt-10 transition-all duration-300">
          <div className="flex flex-col gap-6">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Featured
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-sm text-stone-400">{articleMetaLabel(article)}</span>
              <span className="text-stone-300">·</span>
              <span className="text-sm text-stone-400">{formatDate(article.publishedAt || article.createdAt)}</span>
            </div>

            {/* Featured Image */}
            {featuredImage && (
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-stone-100 group-hover:shadow-lg transition-shadow duration-300">
                <img
                  src={featuredImage}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div>
              {article.subtitle && (
                <p className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-widest" style={{ letterSpacing: '0.15em' }}>
                  {article.subtitle}
                </p>
              )}
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-stone-900 leading-tight mb-4 group-hover:text-stone-600 transition-colors duration-300">
                {article.title}
              </h2>
              <p className="text-lg text-stone-500 leading-relaxed max-w-3xl">
                {article.excerpt}
              </p>
            </div>

            {/* Footer row */}
            <div className="flex items-center gap-6 pt-2">
              <span className="text-sm text-stone-400">By {article.author}</span>
              <span className="text-sm text-stone-400">{article.readTime}</span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-stone-900 group-hover:text-stone-600 transition-colors">
                {readActionLabel(article)}
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

// ─── Main Research Page ────────────────────────────────────────────
const ResearchPage: NextPage = () => {
  const [activeCategory, setActiveCategory] = React.useState('All');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch published articles from Firestore
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'researchArticles'));
        let publishedArticles = sortArticlesByPublishedDate(snapshot.docs
          .map(doc => normalizeArticle(doc.id, doc.data() as Omit<Article, 'slug'>))
          .filter(article => article.status === 'published'));
        if (publishedArticles.length === 0 && isBrowserLocalhost()) {
          publishedArticles = await fetchProductionResearchArticlesFallback();
        }
        setArticles(mergeLocalResearchArticles(publishedArticles));
      } catch (error) {
        console.error('[Research] Error fetching articles:', error);
        if (isBrowserLocalhost()) {
          try {
            setArticles(await fetchProductionResearchArticlesFallback());
          } catch (fallbackError) {
            console.error('[Research] Error fetching production fallback articles:', fallbackError);
            setArticles(mergeLocalResearchArticles([]));
          }
        } else {
          setArticles(mergeLocalResearchArticles([]));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const listedArticles = articles.filter(isListedArticle);

  const filteredArticles = activeCategory === 'All'
    ? listedArticles
    : listedArticles.filter((a) => a.category === activeCategory);

  const featuredArticle = filteredArticles.find((a) => a.featured);
  const remainingArticles = filteredArticles.filter((a) => a.slug !== featuredArticle?.slug);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'research',
          pageTitle: 'Research – Pulse',
          metaDescription:
            'Articles, white papers, and deep dives from the Pulse team on metabolic health, performance science, wearable technology, and the future of fitness.',
          ogTitle: 'Research – Pulse',
          ogDescription:
            'Articles, white papers, and deep dives from the Pulse team on metabolic health, performance science, wearable technology, and the future of fitness.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/research"
        pageOgImage="/og-image.png?title=Research"
      />

      <div className="min-h-screen bg-[#FAFAF7]">
        {/* ─── Navigation bar ─────────────────────────────── */}
        <nav className="sticky top-0 z-50 bg-[#FAFAF7]/90 backdrop-blur-md border-b border-stone-200/60">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-3 group">
                <img
                  src="/pulse-logo.svg"
                  alt="Pulse"
                  className="h-8"
                />
              </Link>

              <div className="hidden sm:flex items-center gap-8">
                <Link
                  href="/research"
                  className="text-sm font-semibold text-stone-900"
                >
                  Research
                </Link>
                <Link
                  href="/"
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/about"
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  About
                </Link>
                <Link
                  href="/press"
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Press
                </Link>
              </div>

              {/* Mobile hamburger placeholder */}
              <div className="sm:hidden">
                <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">
                  ← Home
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* ─── Hero section ───────────────────────────────── */}
        <header className="max-w-6xl mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-12 md:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold text-stone-900 mb-6 tracking-tight"
              style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
            >
              Research
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl"
          >
            <p className="text-lg md:text-xl text-stone-500 leading-relaxed">
              Deep dives into the science of metabolic health, performance, wearable
              technology, and the systems that drive the human body. Written by the team
              building Pulse.
            </p>
          </motion.div>
        </header>

        {/* ─── Category filter ────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-6 md:px-8 pb-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-wrap items-center gap-2"
          >
            <span className="text-sm text-stone-400 mr-2">Topics:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${activeCategory === cat
                  ? 'bg-stone-900 text-white'
                  : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </div>

        {/* ─── Loading State ──────────────────────────────── */}
        {loading ? (
          <div className="max-w-6xl mx-auto px-6 md:px-8 pb-24">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="inline-block w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mb-4" />
              <p className="text-stone-400">Loading articles...</p>
            </motion.div>
          </div>
        ) : (
          <>
            {/* ─── Featured article ───────────────────────────── */}
            {featuredArticle && (
              <div className="max-w-6xl mx-auto px-6 md:px-8 pb-12">
                <FeaturedArticleCard article={featuredArticle} />
              </div>
            )}

            {/* ─── Article list ───────────────────────────────── */}
            <div className="max-w-6xl mx-auto px-6 md:px-8 pb-24">
              {remainingArticles.length > 0 ? (
                <div>
                  {remainingArticles.map((article, index) => (
                    <ArticleCard key={article.slug} article={article} index={index} />
                  ))}
                </div>
              ) : !featuredArticle ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <p className="text-stone-400 text-lg">
                    {activeCategory === 'All'
                      ? 'No articles published yet. Check back soon.'
                      : 'No articles in this category yet. Check back soon.'}
                  </p>
                </motion.div>
              ) : null}
            </div>
          </>
        )}

        {/* ─── Footer ─────────────────────────────────────── */}
        <footer className="border-t border-stone-200 bg-[#FAFAF7]">
          <div className="max-w-6xl mx-auto px-6 md:px-8 py-12">
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
                <Link href="/about" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  About
                </Link>
                <Link href="/press" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">
                  Press Kit
                </Link>
                <a
                  href="mailto:pulsefitnessapp@gmail.com"
                  className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default ResearchPage;
