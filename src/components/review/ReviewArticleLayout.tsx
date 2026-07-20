import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import PageHead from '../PageHead';

const ReadingProgress: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(scrollPercent);
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 z-[60] h-[3px] bg-transparent">
      <div
        className="h-full bg-[#E0FE10] transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

interface ReviewArticleLayoutProps {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  pageOgImage?: string;
  pageOgUrl?: string;
  downloadHref?: string;
  downloadLabel?: string;
  headerActions?: React.ReactNode;
  /**
   * 'light' — the classic stone/white article look (default).
   * 'editorial' — the FitClub dark editorial system: photo hero,
   * charcoal cards, lime accent, auto-numbered sections. Used for
   * generated investor updates so they come out designed.
   */
  theme?: 'light' | 'editorial';
}

const ReviewArticleLayout: React.FC<ReviewArticleLayoutProps> = ({
  metaTitle,
  metaDescription,
  eyebrow,
  title,
  description,
  children,
  pageOgImage,
  pageOgUrl,
  downloadHref = '/PIL_Investor_Deck_2026.pdf',
  downloadLabel = 'Download PDF',
  headerActions,
  theme = 'light',
}) => {
  const dark = theme === 'editorial';
  return (
  <>
    <PageHead
      metaData={{
        pageId: 'review-article',
        pageTitle: metaTitle,
        metaDescription,
        ogTitle: metaTitle,
        ogDescription: metaDescription,
        lastUpdated: new Date().toISOString(),
      }}
      pageOgUrl={pageOgUrl || 'https://fitwithpulse.ai/review'}
      pageOgImage={pageOgImage || `/og-image.png?title=${encodeURIComponent(title)}`}
    />

    <ReadingProgress />

    <div
      className={
        dark
          ? 'review-article review-article--editorial min-h-screen bg-[#020408] text-white/75'
          : 'review-article min-h-screen bg-[#FAFAF7] text-stone-700'
      }
    >
      <nav
        className={
          dark
            ? 'sticky top-0 z-50 border-b border-white/10 bg-[#020408]/85 backdrop-blur-md'
            : 'sticky top-0 z-50 border-b border-stone-200/60 bg-[#FAFAF7]/90 backdrop-blur-md'
        }
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img src={dark ? '/pulse-logo-white.svg' : '/pulse-logo.svg'} alt="Pulse" className="h-8" />
          </Link>

          <div className="hidden items-center gap-8 sm:flex">
            <Link href="/review" className={dark ? 'text-sm font-semibold text-white' : 'text-sm font-semibold text-stone-900'}>
              Investor Updates
            </Link>
            <Link href="/research" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Research
            </Link>
            <Link href="/" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Home
            </Link>
            <Link href="/about" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              About
            </Link>
          </div>

          <div className="sm:hidden">
            <Link href="/review" className={dark ? 'text-sm text-white/55 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              ← Updates
            </Link>
          </div>
        </div>
      </nav>

      {dark && (
        <header className="relative flex min-h-[72vh] items-end overflow-hidden">
          <img
            src="/review/editorial-hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(2,4,8,0.55) 0%, rgba(2,4,8,0.15) 30%, rgba(2,4,8,0.6) 65%, #020408 100%)',
            }}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 md:px-8">
            <div className="mb-8">
              <Link
                href="/review"
                className="inline-block rounded-full border border-white/20 bg-black/40 px-4 py-2 font-mono text-xs font-bold tracking-[0.12em] text-white/70 backdrop-blur-md transition-colors hover:text-white"
              >
                ← All Investor Updates
              </Link>
            </div>
            <p className="mb-6 font-mono text-xs font-bold uppercase tracking-[0.32em] text-white/60">
              {eyebrow}
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[1.0] tracking-[-0.03em] text-white md:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">
              {description}
            </p>
            {(downloadHref || headerActions) && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {downloadHref && (
                  <a
                    href={downloadHref}
                    download
                    className="inline-flex items-center gap-2 rounded-full bg-[#E0FE10] px-5 py-3 text-sm font-bold text-black"
                  >
                    <Download size={16} />
                    {downloadLabel}
                  </a>
                )}
                {headerActions}
              </div>
            )}
          </div>
        </header>
      )}

      {!dark && (
      <header className="mx-auto max-w-6xl px-6 pb-12 pt-16 md:px-8 md:pb-16 md:pt-24">
        <div className="mb-6">
          <Link href="/review" className="text-sm text-stone-500 transition-colors hover:text-stone-900">
            ← All Investor Updates
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
            {eyebrow}
          </p>
          <h1
            className="mb-6 max-w-4xl text-4xl font-bold tracking-tight text-stone-900 md:text-5xl lg:text-6xl"
            style={{ fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
          >
            {title}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <p className="text-lg leading-relaxed text-stone-500 md:text-xl">
            {description}
          </p>
        </motion.div>

        {(downloadHref || headerActions) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            {downloadHref && (
              <a
                href={downloadHref}
                download
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700"
              >
                <Download size={16} />
                {downloadLabel}
              </a>
            )}
            {headerActions}
          </motion.div>
        )}
      </header>
      )}

      <main>{children}</main>

      <footer className={dark ? 'border-t border-white/10 bg-[#020408]' : 'border-t border-stone-200 bg-[#FAFAF7]'}>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center md:px-8">
          <div>
            <img src={dark ? '/pulse-logo-white.svg' : '/pulse-logo.svg'} alt="Pulse" className="mb-3 h-6" />
            <p className="text-sm text-stone-400">
              © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/review" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Investor Updates
            </Link>
            <Link href="/research" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Research
            </Link>
            <Link href="/" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Home
            </Link>
            <Link href="/press" className={dark ? 'text-sm text-white/50 transition-colors hover:text-white' : 'text-sm text-stone-500 transition-colors hover:text-stone-900'}>
              Press Kit
            </Link>
          </div>
        </div>
      </footer>
    </div>

    <style jsx global>{`
      .review-article [class*='backdrop-blur'] {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      .review-article [class*='shadow-lg'],
      .review-article [class*='shadow-gray-'],
      .review-article [class*='shadow-amber-'],
      .review-article [class*='shadow-emerald-'],
      .review-article [class*='shadow-purple-'],
      .review-article [class*='shadow-blue-'],
      .review-article [class*='shadow-indigo-'] {
        box-shadow: none !important;
      }

      .review-article [class*='rounded-2xl'] {
        border-radius: 1.75rem !important;
      }

      .review-article [class*='rounded-xl'] {
        border-radius: 1.25rem !important;
      }

      .review-article [class*='rounded-lg'] {
        border-radius: 0.95rem !important;
      }

      .review-article [class*='bg-white/60'],
      .review-article [class*='bg-white/50'],
      .review-article [class*='bg-white/40'],
      .review-article [class*='bg-gray-50/60'],
      .review-article [class*='bg-gray-50/80'],
      .review-article [class*='bg-gray-50 border'],
      .review-article [class*='bg-gray-50 border-t'],
      .review-article [class*='bg-gray-50 border-b'] {
        background: rgba(255, 255, 255, 0.84) !important;
        border-color: rgba(214, 211, 209, 0.85) !important;
      }

      .review-article [class*='from-amber-50/80'],
      .review-article [class*='from-yellow-50/60'],
      .review-article [class*='from-orange-50/60'] {
        background: linear-gradient(135deg, rgba(255, 248, 235, 0.96), rgba(255, 252, 245, 0.92)) !important;
        border-color: rgba(245, 158, 11, 0.3) !important;
      }

      .review-article [class*='from-emerald-50/80'],
      .review-article [class*='from-teal-50/60'] {
        background: linear-gradient(135deg, rgba(239, 250, 245, 0.96), rgba(248, 252, 250, 0.92)) !important;
        border-color: rgba(16, 185, 129, 0.24) !important;
      }

      .review-article [class*='from-blue-50/80'],
      .review-article [class*='from-sky-50/40'] {
        background: linear-gradient(135deg, rgba(241, 247, 255, 0.96), rgba(249, 251, 255, 0.92)) !important;
        border-color: rgba(59, 130, 246, 0.22) !important;
      }

      .review-article [class*='from-indigo-50/80'],
      .review-article [class*='from-purple-50/80'],
      .review-article [class*='to-indigo-50/60'],
      .review-article [class*='to-purple-50/60'] {
        background: linear-gradient(135deg, rgba(246, 244, 255, 0.96), rgba(251, 249, 255, 0.92)) !important;
        border-color: rgba(129, 140, 248, 0.24) !important;
      }

      .review-article [class*='from-gray-50/80'],
      .review-article [class*='to-gray-100/60'] {
        background: linear-gradient(135deg, rgba(250, 250, 249, 0.98), rgba(245, 245, 244, 0.9)) !important;
        border-color: rgba(214, 211, 209, 0.8) !important;
      }

      .review-article [class*='text-gray-900'] {
        color: #1c1917 !important;
      }

      .review-article [class*='text-gray-800'],
      .review-article [class*='text-gray-700'] {
        color: #44403c !important;
      }

      .review-article [class*='text-gray-600'] {
        color: #78716c !important;
      }

      .review-article [class*='text-gray-500'],
      .review-article [class*='text-gray-400'] {
        color: #a8a29e !important;
      }

      .review-article [class*='border-gray-200'],
      .review-article [class*='border-gray-200/50'],
      .review-article [class*='border-gray-200/60'],
      .review-article [class*='border-gray-300'] {
        border-color: rgba(214, 211, 209, 0.85) !important;
      }
    `}</style>

    <style jsx global>{`
      /* ---------- Editorial (dark) content re-theme ----------
         Generated investor updates render with the same Tailwind
         classes as the light article; this scope flips them into the
         FitClub editorial system without touching the renderers. */

      .review-article--editorial main {
        counter-reset: editorial-section;
      }

      .review-article--editorial main h2 {
        color: #ffffff !important;
        font-weight: 900 !important;
      }

      .review-article--editorial main h3 {
        color: rgba(255, 255, 255, 0.92) !important;
        font-weight: 800 !important;
      }

      .review-article--editorial main p,
      .review-article--editorial main li {
        color: rgba(255, 255, 255, 0.7) !important;
      }

      .review-article--editorial main strong {
        color: #ffffff !important;
      }

      .review-article--editorial main a {
        color: #ffffff !important;
        text-decoration-color: rgba(224, 254, 16, 0.6) !important;
      }
      .review-article--editorial main a:hover {
        text-decoration-color: #e0fe10 !important;
      }

      .review-article--editorial main ul {
        list-style: none !important;
        padding-left: 0 !important;
      }
      .review-article--editorial main ul > li {
        position: relative;
        padding-left: 26px;
        list-style: none !important;
      }
      .review-article--editorial main ul > li::before {
        content: '';
        position: absolute;
        left: 2px;
        top: 0.72em;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #e0fe10;
      }
      .review-article--editorial main ul > li::marker {
        content: '';
      }

      /* Light cards -> charcoal glass */
      .review-article--editorial main [class*='bg-white'],
      .review-article--editorial main [class*='bg-gray-50'],
      .review-article--editorial main [class*='bg-stone-50'] {
        background: rgba(17, 18, 21, 0.78) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
      .review-article--editorial main [class*='border-stone-2'],
      .review-article--editorial main [class*='border-stone-3'],
      .review-article--editorial main [class*='border-gray-2'] {
        border-color: rgba(255, 255, 255, 0.1) !important;
      }

      /* Stone text scale -> white scale */
      .review-article--editorial main [class*='text-stone-9'],
      .review-article--editorial main [class*='text-stone-8'],
      .review-article--editorial main [class*='text-gray-9'] {
        color: #ffffff !important;
      }
      .review-article--editorial main [class*='text-stone-7'],
      .review-article--editorial main [class*='text-stone-6'],
      .review-article--editorial main [class*='text-gray-7'],
      .review-article--editorial main [class*='text-gray-6'] {
        color: rgba(255, 255, 255, 0.7) !important;
      }
      .review-article--editorial main [class*='text-stone-5'],
      .review-article--editorial main [class*='text-stone-4'],
      .review-article--editorial main [class*='text-gray-5'],
      .review-article--editorial main [class*='text-gray-4'] {
        color: rgba(255, 255, 255, 0.45) !important;
      }

      /* Light tinted gradients -> neutral charcoal */
      .review-article--editorial main [class*='from-amber-50'],
      .review-article--editorial main [class*='from-yellow-50'],
      .review-article--editorial main [class*='from-orange-50'],
      .review-article--editorial main [class*='from-emerald-50'],
      .review-article--editorial main [class*='from-teal-50'],
      .review-article--editorial main [class*='from-blue-50'],
      .review-article--editorial main [class*='from-sky-50'],
      .review-article--editorial main [class*='from-indigo-50'],
      .review-article--editorial main [class*='from-purple-50'],
      .review-article--editorial main [class*='from-gray-50'] {
        background: rgba(17, 18, 21, 0.78) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
      }

      /* Blockquotes get the host-note serif voice */
      .review-article--editorial main blockquote {
        font-family: Georgia, 'Times New Roman', serif !important;
        font-style: italic;
        color: rgba(255, 255, 255, 0.85) !important;
        border-left: 2px solid #e0fe10 !important;
      }

      /* Images: hairline + deep shadow like the phone rails */
      .review-article--editorial main img {
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
      }
    `}</style>
  </>
  );
};

export default ReviewArticleLayout;
