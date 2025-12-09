import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { collection as fsCollection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../api/firebase/config';
import { SweatlistCollection, Challenge } from '../../api/firebase/workout/types';
import ChallengeMeta from '../../components/ChallengeMeta';

const LoadingState = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-white">Loading round...</div>
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-white text-center">
      <h2 className="text-xl font-bold mb-4">Unable to load round</h2>
      <p className="text-white/70">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-[#E0FE10] text-black rounded-lg"
      >
        Try Again
      </button>
    </div>
  </div>
);

interface RoundLibraryPageState {
  collection: SweatlistCollection | null;
  loading: boolean;
  error: string | null;
}

const RoundLibraryPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query; // This is the originalId from the deep link

  const [state, setState] = useState<RoundLibraryPageState>({
    collection: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchRoundByOriginalId = async () => {
      if (!router.isReady || !id) return;

      const originalId = Array.isArray(id) ? id[0] : id;

      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        let foundCollection: SweatlistCollection | null = null;

        // 1) Try treating originalId as a direct collection document ID
        try {
          const directRef = doc(db, 'sweatlist-collection', originalId);
          const directSnap = await getDoc(directRef);
          if (directSnap.exists()) {
            foundCollection = new SweatlistCollection({
              id: directSnap.id,
              ...directSnap.data(),
            });
          }
        } catch (directError) {
          console.error('[RoundLibrary] Error checking direct collection ID:', directError);
        }

        // 2) If not found, try querying by challenge.originalId
        if (!foundCollection) {
          try {
            const collectionsRef = fsCollection(db, 'sweatlist-collection');
            const q = query(collectionsRef, where('challenge.originalId', '==', originalId));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const docSnap = snapshot.docs[0];
              foundCollection = new SweatlistCollection({
                id: docSnap.id,
                ...docSnap.data(),
              });
            }
          } catch (originalQueryError) {
            console.error('[RoundLibrary] Error querying by challenge.originalId:', originalQueryError);
          }
        }

        // 3) Fallback: query by challenge.id == originalId
        if (!foundCollection) {
          try {
            const collectionsRef = fsCollection(db, 'sweatlist-collection');
            const q = query(collectionsRef, where('challenge.id', '==', originalId));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const docSnap = snapshot.docs[0];
              foundCollection = new SweatlistCollection({
                id: docSnap.id,
                ...docSnap.data(),
              });
            }
          } catch (idQueryError) {
            console.error('[RoundLibrary] Error querying by challenge.id:', idQueryError);
          }
        }

        if (!foundCollection || !foundCollection.challenge) {
          throw new Error('Round template not found. The round may have been removed or is not yet available on web.');
        }

        // Ensure challenge instance is a proper Challenge class (matches other pages)
        const challenge = new Challenge({
          ...foundCollection.challenge,
        });

        const normalizedCollection: SweatlistCollection = new SweatlistCollection({
          ...foundCollection,
          challenge,
        });

        setState({
          collection: normalizedCollection,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('[RoundLibrary] Failed to load round by originalId:', err);
        setState({
          collection: null,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : 'An error occurred while loading this round. Please try again later.',
        });
      }
    };

    fetchRoundByOriginalId();
  }, [router.isReady, id]);

  if (state.loading || !router.isReady) {
    return <LoadingState />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  if (!state.collection || !state.collection.challenge) {
    return <ErrorState message="Round data is missing or incomplete." />;
  }

  const { challenge } = state.collection;

  return (
    <>
      <ChallengeMeta challenge={challenge} id={challenge.originalId || challenge.id} />

      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full grid lg:grid-cols-[1.5fr,1fr] gap-10">
          {/* Left: Round Overview */}
          <section className="space-y-6">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs font-semibold uppercase tracking-wide">
              Your Journey • Round Template
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              {challenge.title}
            </h1>

            {challenge.subtitle && (
              <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
                {challenge.subtitle}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Length</div>
                <div className="text-xl font-semibold mt-1">
                  {challenge.durationInDays ? `${challenge.durationInDays} days` : 'Multi-day'}
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Format</div>
                <div className="text-xl font-semibold mt-1">
                  {challenge.challengeType === 'steps'
                    ? 'Steps Challenge'
                    : challenge.challengeType === 'habit'
                    ? 'Habit Challenge'
                    : 'Workout Program'}
                </div>
              </div>

              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Cohorts</div>
                <div className="text-xl font-semibold mt-1">
                  Live cohorts run inside the Pulse app
                </div>
              </div>
            </div>

            <p className="text-zinc-300 text-sm sm:text-base leading-relaxed pt-2">
              This is a shareable program template for this round. To join a live cohort, look for an
              active invitation link from a host, or tap the share link again from your iOS app to
              start a new cohort with your community.
            </p>
          </section>

          {/* Right: Call to Action */}
          <aside className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Start this round with your crew</h2>
              <p className="text-sm text-zinc-300">
                Host or join live cohorts, track progress, and chat with your community directly in
                the Pulse app.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <a
                href="/download"
                className="block w-full text-center px-4 py-3 rounded-xl bg-[#E0FE10] text-black font-semibold hover:bg-[#e8ff4a] transition-colors"
              >
                Get the Pulse App
              </a>
              <div className="text-xs text-zinc-400 text-center">
                Already have the app installed? Open the original share link on your phone to jump
                into this round.
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
};

export default RoundLibraryPage;


