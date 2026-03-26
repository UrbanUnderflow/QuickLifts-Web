import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import { db } from '../../api/firebase/config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ArrowLeft, ExternalLink, Link as LinkIcon, Copy, Pencil, Trash2, RefreshCw } from 'lucide-react';
import {
  buildPublicShortLink,
  normalizeShortLinkDestination,
  normalizeShortLinkSlug,
} from '../../lib/shortLinks';

type ShortLinkRecord = {
  id: string;
  slug: string;
  label?: string | null;
  destinationUrl: string;
  isActive: boolean;
  createdAt?: any;
  createdByUserId?: string | null;
  createdByEmail?: string | null;
  updatedAt?: any;
  updatedByUserId?: string | null;
  updatedByEmail?: string | null;
  clickCount?: number;
  lastClickedAt?: any;
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://fitwithpulse.ai';
};

const formatTimestamp = (value: any) => {
  if (!value) return 'Just now';

  try {
    const date =
      typeof value?.toDate === 'function'
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Just now';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Just now';
  }
};

const shortLinksCollection = collection(db, 'shortLinks');

const ShortLinksAdminPage: React.FC = () => {
  const currentUser = useUser();
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shortLinks, setShortLinks] = useState<ShortLinkRecord[]>([]);

  const normalizedSlug = useMemo(() => normalizeShortLinkSlug(slug), [slug]);
  const shortLinkUrl = useMemo(() => {
    if (!normalizedSlug) return '';
    return buildPublicShortLink(normalizedSlug, getBaseUrl());
  }, [normalizedSlug]);

  const activeCount = useMemo(() => shortLinks.filter((item) => item.isActive).length, [shortLinks]);

  const loadShortLinks = async () => {
    setLoading(true);
    try {
      const shortLinksQuery = query(shortLinksCollection, orderBy('updatedAt', 'desc'), limit(100));
      const snapshot = await getDocs(shortLinksQuery);
      const rows: ShortLinkRecord[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as any),
      }));
      setShortLinks(rows);
    } catch (error: any) {
      console.error('Failed to load short links:', error);
      setToast(error?.message || 'Failed to load short links');
      setTimeout(() => setToast(null), 2200);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShortLinks();
  }, []);

  const resetForm = () => {
    setSlug('');
    setLabel('');
    setDestinationUrl('');
    setIsActive(true);
    setEditingSlug(null);
  };

  const copyToClipboard = async (text: string, success = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(success);
    } catch {
      setToast('Copy failed');
    } finally {
      setTimeout(() => setToast(null), 1800);
    }
  };

  const generateSlug = () => {
    const suggestion = normalizeShortLinkSlug(label || destinationUrl);
    setSlug(suggestion);
  };

  const saveShortLink = async () => {
    if (!normalizedSlug) {
      setToast('Enter a short slug');
      setTimeout(() => setToast(null), 1800);
      return;
    }

    setSaving(true);

    try {
      const normalizedDestination = normalizeShortLinkDestination(destinationUrl);
      const targetDocRef = doc(db, 'shortLinks', normalizedSlug);
      const targetDocSnap = await getDoc(targetDocRef);
      const currentDocRef = editingSlug ? doc(db, 'shortLinks', editingSlug) : null;
      const currentDocSnap = currentDocRef ? await getDoc(currentDocRef) : null;
      const currentDocData = currentDocSnap?.exists() ? currentDocSnap.data() : null;

      if (!editingSlug && targetDocSnap.exists()) {
        throw new Error(`The short link /go/${normalizedSlug} already exists.`);
      }

      if (editingSlug && editingSlug !== normalizedSlug && targetDocSnap.exists()) {
        throw new Error(`The short link /go/${normalizedSlug} already exists.`);
      }

      const nowPayload = {
        updatedAt: serverTimestamp(),
        updatedByUserId: currentUser?.id || null,
        updatedByEmail: currentUser?.email || null,
      };

      const payload = {
        id: normalizedSlug,
        slug: normalizedSlug,
        label: label.trim() || null,
        destinationUrl: normalizedDestination,
        isActive,
        ...nowPayload,
        createdAt: currentDocData?.createdAt || serverTimestamp(),
        createdByUserId: currentDocData?.createdByUserId || currentUser?.id || null,
        createdByEmail: currentDocData?.createdByEmail || currentUser?.email || null,
        clickCount: typeof currentDocData?.clickCount === 'number' ? currentDocData.clickCount : 0,
        ...(currentDocData?.lastClickedAt ? { lastClickedAt: currentDocData.lastClickedAt } : {}),
      };

      await setDoc(targetDocRef, payload, { merge: true });

      if (editingSlug && editingSlug !== normalizedSlug) {
        await deleteDoc(doc(db, 'shortLinks', editingSlug));
      }

      setToast(editingSlug ? 'Short link updated' : 'Short link created');
      setTimeout(() => setToast(null), 1800);
      resetForm();
      await loadShortLinks();
    } catch (error: any) {
      console.error('Failed to save short link:', error);
      setToast(error?.message || 'Failed to save short link');
      setTimeout(() => setToast(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const editShortLink = (item: ShortLinkRecord) => {
    setEditingSlug(item.slug);
    setSlug(item.slug);
    setLabel(item.label || '');
    setDestinationUrl(item.destinationUrl || '');
    setIsActive(Boolean(item.isActive));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteShortLinkRecord = async (item: ShortLinkRecord) => {
    const shouldDelete = window.confirm(`Delete /go/${item.slug}? This will stop that short link from working.`);
    if (!shouldDelete) return;

    setDeletingSlug(item.slug);

    try {
      await deleteDoc(doc(db, 'shortLinks', item.slug));
      if (editingSlug === item.slug) resetForm();
      setToast('Short link deleted');
      setTimeout(() => setToast(null), 1800);
      await loadShortLinks();
    } catch (error: any) {
      console.error('Failed to delete short link:', error);
      setToast(error?.message || 'Failed to delete short link');
      setTimeout(() => setToast(null), 2400);
    } finally {
      setDeletingSlug(null);
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-black text-white">
        <Head>
          <title>Short Links - Admin Dashboard</title>
        </Head>

        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/admin" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back to dashboard
                </Link>
              </div>
              <h1 className="text-3xl font-bold mt-3 flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-[#1a1e24] border border-zinc-800 flex items-center justify-center text-[#d7ff00]">
                  <LinkIcon className="w-5 h-5" />
                </span>
                Short Links
              </h1>
              <p className="text-zinc-400 text-sm mt-2">
                Create branded link shortening redirects like <code className="text-zinc-200">/go/trailer</code>, edit them anytime, and send people anywhere.
              </p>
            </div>

            <button
              onClick={loadShortLinks}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-[#1a1e24] text-white hover:bg-[#262a30] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {toast && (
            <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200">
              {toast}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-5">
              <div className="text-zinc-400 text-sm">Total short links</div>
              <div className="text-3xl font-bold mt-2">{shortLinks.length}</div>
            </div>
            <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-5">
              <div className="text-zinc-400 text-sm">Active</div>
              <div className="text-3xl font-bold mt-2 text-[#d7ff00]">{activeCount}</div>
            </div>
            <div className="bg-[#1a1e24] border border-zinc-800 rounded-xl p-5">
              <div className="text-zinc-400 text-sm">Inactive</div>
              <div className="text-3xl font-bold mt-2">{shortLinks.length - activeCount}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
            <div className="bg-[#1a1e24] border border-zinc-800 rounded-2xl p-6 h-fit">
              <div className="text-lg font-semibold mb-1">
                {editingSlug ? 'Edit short link' : 'Create short link'}
              </div>
              <p className="text-sm text-zinc-400 mb-5">
                Use a memorable slug and point it to any public URL or internal path.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Label</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Trailer launch"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Short slug</label>
                  <div className="flex gap-2">
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="trailer"
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                    />
                    <button
                      onClick={generateSlug}
                      className="px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
                    >
                      Generate
                    </button>
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">
                    Normalized as: <span className="text-zinc-300">{normalizedSlug || '—'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Destination URL</label>
                  <input
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://fitwithpulse.ai/research or /creator"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                  />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-white">Active redirect</div>
                      <div className="text-xs text-zinc-500 mt-1">Turn this off to pause the short link without deleting it.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActive((prev) => !prev)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#E0FE10] text-black'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}
                    >
                      {isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Short link preview</label>
                  <div className="flex items-center gap-2">
                    <input
                      value={shortLinkUrl}
                      readOnly
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white"
                    />
                    <button
                      disabled={!shortLinkUrl}
                      onClick={() => shortLinkUrl && copyToClipboard(shortLinkUrl, 'Short link copied')}
                      className="bg-[#E0FE10] text-black px-4 py-3 rounded-lg font-semibold hover:bg-lime-400 disabled:opacity-50"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={saveShortLink}
                    disabled={saving}
                    className="bg-[#E0FE10] text-black px-4 py-3 rounded-lg font-semibold hover:bg-lime-400 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingSlug ? 'Save changes' : 'Create short link'}
                  </button>

                  {editingSlug && (
                    <button
                      onClick={resetForm}
                      className="px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-[#1a1e24] border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <div className="text-lg font-semibold">Saved short links</div>
                  <div className="text-sm text-zinc-400 mt-1">
                    {loading ? 'Loading...' : `${shortLinks.length} saved`}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {!loading && shortLinks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950 px-5 py-10 text-center text-zinc-500">
                    No short links yet. Create your first one from the panel on the left.
                  </div>
                )}

                {shortLinks.map((item) => {
                  const publicUrl = buildPublicShortLink(item.slug, getBaseUrl());
                  const isDeleting = deletingSlug === item.slug;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">
                              {item.label || `/go/${item.slug}`}
                            </h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                              item.isActive
                                ? 'bg-lime-500/15 text-lime-300 border border-lime-500/20'
                                : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                            }`}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-[#d7ff00] break-all">{publicUrl}</div>
                          <div className="mt-3 text-sm text-zinc-400 break-all">
                            Destination: <span className="text-zinc-200">{item.destinationUrl}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
                            <span>Updated {formatTimestamp(item.updatedAt)}</span>
                            <span>By {item.updatedByEmail || item.createdByEmail || 'Unknown'}</span>
                            <span>{item.clickCount || 0} clicks</span>
                            <span>Last click {item.lastClickedAt ? formatTimestamp(item.lastClickedAt) : 'Never'}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button
                            onClick={() => editShortLink(item)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => copyToClipboard(publicUrl, 'Short link copied')}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </a>
                          <button
                            onClick={() => deleteShortLinkRecord(item)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-900/60 bg-red-950/40 hover:bg-red-950/70 text-sm text-red-200 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default ShortLinksAdminPage;
