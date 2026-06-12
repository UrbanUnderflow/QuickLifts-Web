import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { EyeOff, Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { db } from '../../api/firebase/config';

const CONFIG_COLLECTION = 'company-config';
const CONFIG_DOCUMENT = 'creator-moderation';

/**
 * Creator Moderation — the shadow-ban list.
 *
 * Shadow-banned creators are excluded from every RECOMMENDATION surface
 * (FWP Movers row, Move of the Day fallback, workout generation catalog)
 * but their profiles and moves stay fully searchable and viewable in both
 * FitClub and FWP. Quiet, not punitive — the creator is never notified.
 */
const CreatorModerationPage: React.FC = () => {
  const [usernames, setUsernames] = useState<string[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snapshot = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT));
        const list = snapshot.exists()
          ? ((snapshot.data()?.shadowBannedUsernames as string[]) || [])
          : [];
        setUsernames(list.map((u) => u.toLowerCase()).sort());
      } catch (e) {
        console.error('[CreatorModeration] load failed:', e);
        setError('Failed to load the moderation list.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addUsername = () => {
    const username = newUsername.trim().toLowerCase().replace(/^@/, '');
    if (!username) return;
    if (usernames.includes(username)) {
      setError(`@${username} is already shadow-banned.`);
      return;
    }
    setUsernames([...usernames, username].sort());
    setNewUsername('');
    setDirty(true);
    setError(null);
    setMessage(null);
  };

  const removeUsername = (username: string) => {
    setUsernames(usernames.filter((u) => u !== username));
    setDirty(true);
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        doc(db, CONFIG_COLLECTION, CONFIG_DOCUMENT),
        {
          shadowBannedUsernames: usernames,
          updatedAt: Date.now(),
          updatedBy: 'admin UI',
        },
        { merge: true }
      );
      setDirty(false);
      setMessage(`Saved — ${usernames.length} creator${usernames.length === 1 ? '' : 's'} shadow-banned.`);
    } catch (e) {
      console.error('[CreatorModeration] save failed:', e);
      setError('Failed to save. Are you signed in as an admin?');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Creator Moderation · Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to Admin
          </Link>

          <div className="mt-6 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-black/30">
              <EyeOff className="h-6 w-6 text-[#d7ff00]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Creator Moderation</h1>
              <p className="mt-2 max-w-xl text-sm text-zinc-400">
                Shadow-banned creators are removed from every recommendation surface — the FWP
                Movers row, Move of the Day fallback, and AI workout generation — but their
                profiles and moves stay fully searchable and viewable in FitClub and FWP.
                Creators are never notified.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-zinc-800 bg-[#1a1e24] p-6">
            <div className="flex gap-3">
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addUsername()}
                placeholder="username (without @)"
                className="flex-1 rounded-xl border border-zinc-700 bg-[#111417] px-4 py-3 text-sm text-white outline-none transition focus:border-[#d7ff00]"
              />
              <button
                type="button"
                onClick={addUsername}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d7ff00]/40 bg-[#d7ff00]/10 px-4 py-3 text-sm font-medium text-[#d7ff00] transition hover:bg-[#d7ff00]/15"
              >
                <Plus className="h-4 w-4" /> Shadow ban
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : usernames.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-500">
                  No creators are shadow-banned.
                </div>
              ) : (
                usernames.map((username) => (
                  <div
                    key={username}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/25 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <EyeOff className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium">@{username}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUsername(username)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Unban
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm">
                {message && <span className="text-emerald-300">{message}</span>}
                {error && <span className="text-red-300">{error}</span>}
              </div>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d7ff00] px-5 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default CreatorModerationPage;
