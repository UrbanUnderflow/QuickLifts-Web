import React, { useState } from 'react';
import Head from 'next/head';
import { Play, RotateCcw } from 'lucide-react';
import { BaselineAssessmentModal } from '../../components/mentaltraining';

const DEMO_SPORT = "Men's physique";

const MentalSkillsStartingPointDemoPage: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [completed, setCompleted] = useState(false);

  return (
    <>
      <Head>
        <title>Mental Skills Starting Point | PulseCheck Screen Demo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <main className="min-h-screen bg-[#05080d] px-5 py-10 text-white sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl flex-col items-center justify-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">PulseCheck screen demo</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Mental Skills Starting Point</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
            Walk through the complete interactive starting point using a {DEMO_SPORT} sport context. This demo keeps the result in the session and does not save an athlete record.
          </p>

          {completed ? (
            <button
              type="button"
              onClick={() => {
                setCompleted(false);
                setIsOpen(true);
              }}
              className="mt-8 inline-flex h-14 items-center justify-center gap-3 bg-teal-300 px-6 text-base font-black text-slate-950"
            >
              <RotateCcw className="h-5 w-5" />
              Run the Starting Point again
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="mt-8 inline-flex h-14 items-center justify-center gap-3 bg-teal-300 px-6 text-base font-black text-slate-950"
            >
              <Play className="h-5 w-5 fill-current" />
              Open Starting Point
            </button>
          )}
        </div>
      </main>

      <BaselineAssessmentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        athleteId="screen-demo-athlete"
        athleteName="Demo Athlete"
        sportName={DEMO_SPORT}
        persist={false}
        onComplete={() => {
          setIsOpen(false);
          setCompleted(true);
        }}
      />
    </>
  );
};

export default MentalSkillsStartingPointDemoPage;
