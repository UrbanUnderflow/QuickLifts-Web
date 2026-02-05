import React from 'react';
import type { NextPage } from 'next';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PageHead from '../../components/PageHead';

// ─── Research categories ───────────────────────────────────────────
const categories = [
  'All',
  'Metabolic Health',
  'Performance Science',
  'Technology',
  'Wearables',
];

// ─── Article data ──────────────────────────────────────────────────
interface Article {
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  date: string;
  category: string;
  readTime: string;
  excerpt: string;
  featured?: boolean;
}

const articles: Article[] = [
  {
    slug: 'the-system',
    title: 'What Bodybuilding Taught Me About Glucose, Glycogen, Insulin, and Stress',
    subtitle: 'The System',
    author: 'Tremaine',
    date: 'Feb 5, 2026',
    category: 'Metabolic Health',
    readTime: '22 min read',
    excerpt:
      'Bodybuilding, at its core, is not about lifting weights or eating chicken and rice. It\'s about surgically manipulating biological systems. The same systems we manipulate for aesthetics and performance are the exact systems that break down in metabolic disease.',
    featured: true,
  },
];

// ─── Article card component ────────────────────────────────────────
const ArticleCard: React.FC<{ article: Article; index: number }> = ({ article, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/research/${article.slug}`} className="block group">
        <article className="py-8 border-b border-stone-200 transition-colors duration-300 group-hover:border-stone-400">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left: content */}
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium text-stone-500">{article.category}</span>
                <span className="text-stone-300">·</span>
                <span className="text-sm text-stone-400">{article.date}</span>
              </div>

              <h3 className="text-xl md:text-2xl font-semibold text-stone-900 mb-2 group-hover:text-stone-700 transition-colors duration-300 leading-tight">
                {article.title}
              </h3>

              <p className="text-base text-stone-500 leading-relaxed line-clamp-3">
                {article.excerpt}
              </p>
            </div>

            {/* Right: meta */}
            <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-2 flex-shrink-0">
              <span className="text-sm text-stone-400">{article.readTime}</span>
              <span className="text-sm text-stone-400">By {article.author}</span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
};

// ─── Featured article card ─────────────────────────────────────────
const FeaturedArticleCard: React.FC<{ article: Article }> = ({ article }) => {
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
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Featured
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-sm text-stone-400">{article.category}</span>
              <span className="text-stone-300">·</span>
              <span className="text-sm text-stone-400">{article.date}</span>
            </div>

            {/* Featured Image */}
            {article.slug === 'the-system' && (
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-stone-100 group-hover:shadow-lg transition-shadow duration-300">
                <img
                  src="/research-the-system-featured.png"
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-widest" style={{ letterSpacing: '0.15em' }}>
                {article.subtitle}
              </p>
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
                Read article
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

  const filteredArticles = activeCategory === 'All'
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  const featuredArticle = filteredArticles.find((a) => a.featured);
  const remainingArticles = filteredArticles.filter((a) => !a.featured);

  return (
    <>
      <PageHead
        metaData={{
          pageId: 'research',
          pageTitle: 'Research – Pulse',
          metaDescription:
            'Articles, whitepapers, and deep dives from the Pulse team on metabolic health, performance science, wearable technology, and the future of fitness.',
          ogTitle: 'Research – Pulse',
          ogDescription:
            'Articles, whitepapers, and deep dives from the Pulse team on metabolic health, performance science, wearable technology, and the future of fitness.',
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
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat
                    ? 'bg-stone-900 text-white'
                    : 'bg-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </div>

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
                No articles in this category yet. Check back soon.
              </p>
            </motion.div>
          ) : null}
        </div>

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
