import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { Image as ImageIcon, Link as LinkIcon, Copy, ExternalLink } from 'lucide-react';

const DEFAULT_SLUG = 'the-system';
const DEFAULT_PAGE_URL = `https://fitwithpulse.ai/research/${DEFAULT_SLUG}`;
const DEFAULT_TITLE =
  'The System: What Bodybuilding Taught Me About Glucose, Glycogen, Insulin, and Stress';
const DEFAULT_DESCRIPTION =
  'Bodybuilding is applied physiology at its most extreme. The same systems we manipulate for aesthetics are the exact systems that break down in metabolic disease.';

const OgPreviewTool: React.FC = () => {
  const [pageUrl, setPageUrl] = useState(DEFAULT_PAGE_URL);
  const [slug, setSlug] = useState(DEFAULT_SLUG);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);

  const ogImageUrl = useMemo(() => {
    const safeSlug = slug.trim() || DEFAULT_SLUG;
    return `https://fitwithpulse.ai/.netlify/functions/og-article?slug=${encodeURIComponent(safeSlug)}`;
  }, [slug]);

  const ogTags = useMemo(() => {
    return [
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:image" content="${ogImageUrl}" />`,
      `<meta property="og:url" content="${pageUrl}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${ogImageUrl}" />`,
    ];
  }, [description, ogImageUrl, pageUrl, title]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) {}
  };

  const facebookDebugUrl = `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(pageUrl)}`;
  const twitterDebugUrl = `https://cards-dev.twitter.com/validator?url=${encodeURIComponent(pageUrl)}`;
  const linkedInDebugUrl = `https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(pageUrl)}`;

  return (
    <AdminRouteGuard>
      <Head>
        <title>OG Preview Tester | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#E0FE10]/15 border border-[#E0FE10]/20 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-[#E0FE10]" />
                </span>
                OG Preview Tester
              </h1>
              <p className="text-zinc-400 mt-2">
                Generate and validate Open Graph previews for Pulse pages and research articles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Page URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={pageUrl}
                      onChange={(e) => setPageUrl(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                    />
                    <button
                      onClick={() => handleCopy(pageUrl)}
                      className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                      title="Copy URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Research Slug (optional)</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                    placeholder="the-system"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Uses <span className="text-zinc-300">/public/research-{`{slug}`}-featured.png</span> if present.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 min-h-[90px]"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Image URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={ogImageUrl}
                      readOnly
                      className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white"
                    />
                    <button
                      onClick={() => handleCopy(ogImageUrl)}
                      className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
                      title="Copy image URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <a
                    href={facebookDebugUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Facebook Debugger
                  </a>
                  <a
                    href={twitterDebugUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Twitter Validator
                  </a>
                  <a
                    href={linkedInDebugUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    LinkedIn Inspector
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-zinc-300" />
                <h2 className="text-lg font-semibold">Preview</h2>
              </div>

              <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                <img src={ogImageUrl} alt="OG Preview" className="w-full h-auto" />
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-300">Meta Tag Snippet</h3>
                  <button
                    onClick={() => handleCopy(ogTags.join('\n'))}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <pre className="text-xs text-zinc-400 bg-zinc-950/60 border border-white/10 rounded-lg p-3 overflow-x-auto">
                  {ogTags.join('\n')}
                </pre>
              </div>

              <div className="mt-6 flex items-start gap-2 text-xs text-zinc-500">
                <LinkIcon className="w-4 h-4 mt-0.5" />
                <span>
                  If a preview looks cached, append a query string like <span className="text-zinc-300">?v=2</span> to
                  the page URL before re-scraping.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default OgPreviewTool;
