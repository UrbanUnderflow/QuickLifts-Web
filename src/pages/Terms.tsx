import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useScrollFade } from '../hooks/useScrollFade';

const Terms: NextPage = () => {
  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Moves - The Building Blocks of Your Workout | Pulse</title>
        <meta 
          name="description" 
          content="Record, share, and discover exercises to build your perfect workout Stack." 
        />
        <meta property="og:title" content="Moves - The Building Blocks of Your Workout | Pulse" />
        <meta property="og:description" content="Record, share, and discover exercises to build your perfect workout Stack." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/moves-preview.jpg" />
      </Head>

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
                src="/mymoves.mp4"
                poster="/sample-moves-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Introducing Moves
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            The Building Blocks of Your Perfect Workout
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Moves are your exercise library. Record and save your favorite exercises, 
            then combine them into Stacks to create the perfect workout. Whether you're 
            doing strength training, cardio, or yoga, Moves helps you build and share 
            your fitness journey.
          </p>
        </div>
      </main>

      {/* Record Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4">
            Record Your Progress
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            Capture and share your form
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Use your phone to record exercises, track your form, and share your progress. 
            Each Move you record becomes part of your personal library, ready to be used 
            in your next workout Stack or shared with the community.
          </p>
        </div>

        {/* Move Recording Demo */}
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
                src="/capturemove.mp4"
                poster="/record-move-poster.jpg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section ref={useScrollFade()} className="py-20 px-8 bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-white text-4xl font-bold text-center mb-16">
            Everything you need to build better workouts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">📱</div>
              <h3 className="text-white text-xl font-semibold mb-2">Record</h3>
              <p className="text-zinc-400">
                Use your phone to capture exercises with proper form and technique
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🎯</div>
              <h3 className="text-white text-xl font-semibold mb-2">Organize</h3>
              <p className="text-zinc-400">
                Add details like sets, reps, and weight to track your progress
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🔄</div>
              <h3 className="text-white text-xl font-semibold mb-2">Reuse</h3>
              <p className="text-zinc-400">
                Access your Move library anytime to build new workout Stacks
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">💪</div>
              <h3 className="text-white text-xl font-semibold mb-2">Perfect</h3>
              <p className="text-zinc-400">
                Review your form and track improvements over time
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🤝</div>
              <h3 className="text-white text-xl font-semibold mb-2">Share</h3>
              <p className="text-zinc-400">
                Contribute your Moves to the community and inspire others
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-zinc-800 rounded-xl p-6">
              <div className="text-[#E0FE10] text-2xl mb-4">🔍</div>
              <h3 className="text-white text-xl font-semibold mb-2">Discover</h3>
              <p className="text-zinc-400">
                Find new exercises from the community to enhance your workouts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section ref={useScrollFade()} className="min-h-[50vh] bg-black flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-white text-5xl sm:text-6xl font-bold mb-6">
          Ready to start recording?
        </h2>
        <p className="text-zinc-400 text-xl max-w-2xl mb-10">
          Join the Pulse community and start building your Move library today.
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

export default Terms;