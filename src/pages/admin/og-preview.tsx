import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  Image as ImageIcon,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

/* ─── Defaults ──────────────────────────────────────────────────── */
const EMPTY_STATE = {
  pageUrl: '',
  slug: '',
  title: '',
  description: '',
  ogImage: '',
};

/* ─── Component ────────────────────────────────────────────────── */
const OgPreviewTool: React.FC = () => {
  const [pageUrl, setPageUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [previewNonce, setPreviewNonce] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);

  // Fetch state
  const [fetching, setFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fetchMessage, setFetchMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  /* ── Derived ─────────────────────────────────────────────────── */
  const normalizedPageUrl = useMemo(() => {
    const raw = pageUrl.trim();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return `https://${raw}`;
  }, [pageUrl]);

  // Use the fetched OG image, or fall back to the slug-based Netlify function
  const resolvedOgImage = useMemo(() => {
    if (ogImage) return ogImage;
    if (!slug.trim()) return '';
    return `https://fitwithpulse.ai/.netlify/functions/og-article?slug=${encodeURIComponent(slug.trim())}`;
  }, [ogImage, slug]);

  const previewImageUrl = useMemo(() => {
    if (!resolvedOgImage) return '';
    const divider = resolvedOgImage.includes('?') ? '&' : '?';
    return `${resolvedOgImage}${divider}v=${previewNonce}`;
  }, [resolvedOgImage, previewNonce]);

  const ogTags = useMemo(() => {
    if (!title && !description && !resolvedOgImage) return [];
    return [
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:image" content="${resolvedOgImage}" />`,
      `<meta property="og:url" content="${normalizedPageUrl}" />`,
      `<meta property="og:type" content="article" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${resolvedOgImage}" />`,
    ];
  }, [description, resolvedOgImage, normalizedPageUrl, title]);

  /* ── Clear everything ────────────────────────────────────────── */
  const clearForm = useCallback(() => {
    abortRef.current?.abort();
    setPageUrl('');
    setSlug('');
    setTitle('');
    setDescription('');
    setOgImage('');
    setImageError(null);
    setFetchStatus('idle');
    setFetchMessage('');
    setFetching(false);
    urlInputRef.current?.focus();
  }, []);

  /* ── Parse OG tags from HTML ─────────────────────────────────── */
  const parseOgFromHtml = useCallback((html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const getMeta = (property: string): string => {
      const el =
        doc.querySelector(`meta[property="${property}"]`) ||
        doc.querySelector(`meta[name="${property}"]`);
      return el?.getAttribute('content') || '';
    };

    let ogTitle = getMeta('og:title');
    let ogDescription = getMeta('og:description');
    let ogImage = getMeta('og:image');
    const ogUrl = getMeta('og:url');
    const twitterImage = getMeta('twitter:image');

    // ── Fallback: extract from __NEXT_DATA__ JSON ────────────
    // In dev mode, Next.js doesn't SSR <Head> tags from page components,
    // so the meta tags only show _app defaults. But the getServerSideProps
    // data (including ogMeta and articleData) IS always in __NEXT_DATA__.
    const isGenericDefault =
      !ogTitle ||
      ogTitle === 'Pulse Community Fitness' ||
      ogImage?.includes('og-image.png?title=Pulse');

    if (isGenericDefault) {
      try {
        const nextDataEl = doc.querySelector('#__NEXT_DATA__');
        if (nextDataEl?.textContent) {
          const nextData = JSON.parse(nextDataEl.textContent);
          const props = nextData?.props?.pageProps;

          // Prefer ogMeta (set by getServerSideProps)
          if (props?.ogMeta) {
            ogTitle = props.ogMeta.title || ogTitle;
            ogDescription = props.ogMeta.description || ogDescription;
            ogImage = props.ogMeta.image || ogImage;
          }
          // Fallback to articleData fields
          else if (props?.articleData) {
            const a = props.articleData;
            ogTitle = a.title || ogTitle;
            ogDescription = a.excerpt || a.subtitle || ogDescription;
            ogImage = a.featuredImage || ogImage;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
      url: ogUrl,
      twitterImage,
    };
  }, []);

  /* ── Fetch OG data from a URL ────────────────────────────────── */
  const fetchOgData = useCallback(
    async (url: string) => {
      if (!url.trim()) return;

      const normalized = url.startsWith('http') ? url : `https://${url}`;

      // Abort previous fetch
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFetching(true);
      setFetchStatus('idle');
      setFetchMessage('Fetching page meta tags…');

      try {
        // Use a CORS proxy or fetch directly if same-origin
        // For fitwithpulse.ai pages, we can fetch directly via Next.js API
        const proxyUrl = `/api/og-fetch?url=${encodeURIComponent(normalized)}`;
        let html = '';

        try {
          const res = await fetch(proxyUrl, { signal: controller.signal });
          if (res.ok) {
            html = await res.text();
          }
        } catch {
          // If the API route doesn't exist, try fetching directly
          // (will only work for same-origin)
        }

        // Fallback: direct fetch (works for same-origin in dev)
        if (!html) {
          const res = await fetch(normalized, { signal: controller.signal });
          html = await res.text();
        }

        if (controller.signal.aborted) return;

        const og = parseOgFromHtml(html);

        if (og.title || og.description || og.image) {
          setTitle(og.title || '');
          setDescription(og.description || '');
          setOgImage(og.image || og.twitterImage || '');

          // Extract slug from URL
          const urlObj = new URL(normalized);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          const lastSegment = pathParts[pathParts.length - 1] || '';
          setSlug(lastSegment);

          setFetchStatus('success');
          setFetchMessage(
            `Found: ${og.title ? '✓ title' : '✗ title'}, ${og.description ? '✓ desc' : '✗ desc'}, ${og.image ? '✓ image' : '✗ image'}`
          );
          setPreviewNonce((p) => p + 1);
        } else {
          setFetchStatus('error');
          setFetchMessage('No OG tags found on this page.');
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setFetchStatus('error');
        setFetchMessage(`Failed to fetch: ${err?.message || 'Unknown error'}`);
      } finally {
        if (!controller.signal.aborted) setFetching(false);
      }
    },
    [parseOgFromHtml]
  );

  /* ── Auto-clear when URL is emptied ──────────────────────────── */
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setPageUrl(val);

      if (!val.trim()) {
        // URL was cleared — reset everything
        setSlug('');
        setTitle('');
        setDescription('');
        setOgImage('');
        setImageError(null);
        setFetchStatus('idle');
        setFetchMessage('');
        setFetching(false);
        abortRef.current?.abort();
      }
    },
    []
  );

  /* ── Auto-fetch on paste ─────────────────────────────────────── */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text').trim();
      if (pasted && (pasted.startsWith('http://') || pasted.startsWith('https://') || pasted.includes('.'))) {
        // Small delay to let the input value update
        setTimeout(() => fetchOgData(pasted), 100);
      }
    },
    [fetchOgData]
  );

  /* ── External debug links ────────────────────────────────────── */
  const facebookDebugUrl = `https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(normalizedPageUrl)}`;
  const twitterDebugUrl = `https://cards-dev.twitter.com/validator?url=${encodeURIComponent(normalizedPageUrl)}`;
  const linkedInDebugUrl = `https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(normalizedPageUrl)}`;

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (_) { }
  };

  const hasContent = !!(title || description || resolvedOgImage || pageUrl);

  return (
    <AdminRouteGuard>
      <Head>
        <title>OG Preview Tester | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#0a0a0b] text-white p-8">
        <div className="max-w-6xl w-full mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[#E0FE10]/15 border border-[#E0FE10]/20 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-[#E0FE10]" />
                </span>
                OG Preview Tester
              </h1>
              <p className="text-zinc-400 mt-2">
                Paste a URL to auto-fetch its Open Graph tags. See exactly what iMessage, WhatsApp, and Twitter will show.
              </p>
            </div>

            {hasContent && (
              <button
                onClick={clearForm}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Left panel: Inputs ──────────────────────────── */}
            <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="space-y-4">
                {/* Page URL */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Page URL</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={urlInputRef}
                        value={pageUrl}
                        onChange={handleUrlChange}
                        onPaste={handlePaste}
                        className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/30 focus:border-[#E0FE10]/40 transition-all pr-10"
                        placeholder="Paste a URL here to auto-fetch OG tags…"
                        autoFocus
                      />
                      {pageUrl && (
                        <button
                          onClick={clearForm}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Clear"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {normalizedPageUrl && (
                      <button
                        onClick={() => handleCopy(normalizedPageUrl)}
                        className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Fetch status indicator */}
                  {(fetching || fetchMessage) && (
                    <div
                      className={`mt-2 flex items-center gap-2 text-xs ${fetchStatus === 'success'
                        ? 'text-emerald-400'
                        : fetchStatus === 'error'
                          ? 'text-red-400'
                          : 'text-zinc-400'
                        }`}
                    >
                      {fetching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : fetchStatus === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : fetchStatus === 'error' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : null}
                      {fetchMessage}
                      {normalizedPageUrl && !fetching && (
                        <button
                          onClick={() => fetchOgData(normalizedPageUrl)}
                          className="ml-auto text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                          title="Re-fetch OG tags"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Re-fetch
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Research Slug</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="agile-is-dead"
                  />
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="Article title will auto-fill when you paste a URL"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 min-h-[90px] transition-all"
                    placeholder="Description will auto-fill when you paste a URL"
                  />
                </div>

                {/* OG Image URL */}
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">OG Image URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={resolvedOgImage}
                      onChange={(e) => setOgImage(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-white/10 transition-all text-sm"
                      placeholder="Image URL will auto-fill from OG tags"
                    />
                    {resolvedOgImage && (
                      <button
                        onClick={() => handleCopy(resolvedOgImage)}
                        className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors"
                        title="Copy image URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* External debug tools */}
                {normalizedPageUrl && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <a
                      href={facebookDebugUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Facebook Debugger
                    </a>
                    <a
                      href={twitterDebugUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Twitter Validator
                    </a>
                    <a
                      href={linkedInDebugUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      LinkedIn Inspector
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right panel: Preview ────────────────────────── */}
            <div className="rounded-2xl bg-zinc-900/40 border border-white/10 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="w-5 h-5 text-zinc-300" />
                <h2 className="text-lg font-semibold">Preview</h2>
              </div>

              {/* Image preview */}
              {previewImageUrl ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
                    <img
                      key={previewImageUrl}
                      src={previewImageUrl}
                      alt="OG Preview"
                      className="w-full h-auto"
                      onError={() =>
                        setImageError('Preview image failed to load. Try refreshing the image.')
                      }
                      onLoad={() => setImageError(null)}
                    />
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => setPreviewNonce((prev) => prev + 1)}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh Image
                    </button>
                    <a
                      href={previewImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Open Image
                    </a>
                    {imageError && <span className="text-xs text-red-400">{imageError}</span>}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-700 bg-black/30 flex flex-col items-center justify-center h-48 text-center">
                  <ImageIcon className="w-10 h-10 text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-500">
                    Paste a URL to see the preview image
                  </p>
                </div>
              )}

              {/* Link preview card mockup */}
              {(title || description) && (
                <div className="mt-5 rounded-xl border border-white/10 bg-zinc-800/50 overflow-hidden">
                  <div className="text-xs text-zinc-500 px-4 pt-3 uppercase tracking-wide font-medium">
                    Link Preview
                  </div>
                  {previewImageUrl && (
                    <div className="mt-2 mx-4 rounded-lg overflow-hidden">
                      <img src={previewImageUrl} alt="" className="w-full h-32 object-cover" />
                    </div>
                  )}
                  <div className="p-4 pt-2.5">
                    <p className="text-xs text-zinc-500 truncate">
                      {normalizedPageUrl ? new URL(normalizedPageUrl).hostname : 'fitwithpulse.ai'}
                    </p>
                    <p className="text-sm font-semibold text-white mt-1 line-clamp-2">
                      {title || 'No title'}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                      {description || 'No description'}
                    </p>
                  </div>
                </div>
              )}

              {/* Meta tag snippet */}
              {ogTags.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-zinc-300">Meta Tag Snippet</h3>
                    <button
                      onClick={() => handleCopy(ogTags.join('\n'))}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <pre className="text-xs text-zinc-400 bg-zinc-950/60 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {ogTags.join('\n')}
                  </pre>
                </div>
              )}

              {!hasContent && (
                <div className="mt-6 flex items-start gap-2 text-xs text-zinc-500">
                  <LinkIcon className="w-4 h-4 mt-0.5" />
                  <span>
                    Paste any URL into the Page URL field to automatically fetch and display its Open
                    Graph tags.
                  </span>
                </div>
              )}

              {hasContent && (
                <div className="mt-6 flex items-start gap-2 text-xs text-zinc-500">
                  <LinkIcon className="w-4 h-4 mt-0.5" />
                  <span>
                    If a preview looks cached, append a query string like{' '}
                    <span className="text-zinc-300">?v=2</span> to the page URL before re-scraping.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default OgPreviewTool;
