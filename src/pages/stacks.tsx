import React from 'react';
import type { NextPage, GetServerSideProps } from 'next';
import { useScrollFade } from '../hooks/useScrollFade';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface StacksPageProps {
  metaData: SerializablePageMetaData | null;
}

const StacksPage: NextPage<StacksPageProps> = ({ metaData }) => {
  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/stacks"
      />

      {/* Hero Section */}
      <main ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Phone Frame Container (Left) */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/myStacks.mp4"
                poster="/sample-stacks-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Introducing Stacks
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Build Your Workout, Train When Ready
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Stacks are your custom workout builder. Combine your favorite Moves into 
            a complete training session, save it for later, and share it with the 
            community. From quick HIIT sessions to full-body strength training, Stacks let 
            you create the perfect routine.
          </p>
        </div>
      </main>

      {/* Creation Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Create Your Perfect Workout
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            Combine Moves into complete routines
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Building a Stack is simple. Choose Moves from your library or the 
            community, arrange them in the perfect order, and customize sets and 
            reps. Your Stack is ready whenever you are – today, tomorrow, or next week.
          </p>
        </div>

        {/* Stack Creation Demo */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/createstack.mp4"
                poster="/create-stack-poster.jpg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section ref={useScrollFade()} className="py-20 px-8 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-white text-4xl font-bold text-center mb-16">
            Everything you need to create perfect workouts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🎯</div>
              <h3 className="text-white text-xl font-semibold mb-2">Customize</h3>
              <p className="text-zinc-400">
                Set your own reps, sets, and weights for each Move in your Stack
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🔄</div>
              <h3 className="text-white text-xl font-semibold mb-2">Save</h3>
              <p className="text-zinc-400">
                Store your Stack for future use and easy access anytime
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">📱</div>
              <h3 className="text-white text-xl font-semibold mb-2">Guide</h3>
              <p className="text-zinc-400">
                Follow along with video demonstrations for each Move
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">⏱️</div>
              <h3 className="text-white text-xl font-semibold mb-2">Time</h3>
              <p className="text-zinc-400">
                Track your workout duration and rest periods between sets
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🤝</div>
              <h3 className="text-white text-xl font-semibold mb-2">Share</h3>
              <p className="text-zinc-400">
                Share your favorite Stacks with the community
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">📊</div>
              <h3 className="text-white text-xl font-semibold mb-2">Track</h3>
              <p className="text-zinc-400">
                Log your progress and see improvements over time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Progression Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/stack-progress.mp4"
                poster="/stack-progress-poster.jpg"
              />
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Track Your Progress
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            See your improvement over time
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Every time you complete a Stack, your progress is logged. Watch your 
            strength increase, track your personal bests, and celebrate your 
            achievements with the community.
          </p>
        </div>
      </section>

      {/* Call to Action */}
      <section ref={useScrollFade()} className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to build your first Stack?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Join the Pulse community and start creating your perfect workouts today.
        </p>
        <a 
          href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
          className="bg-[#E0FE10] text-black px-12 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors"
        >
          Download Now
        </a>
      </section>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<StacksPageProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('stacks');
  } catch (error) {
    console.error("Error fetching page meta data for stacks page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default StacksPage;