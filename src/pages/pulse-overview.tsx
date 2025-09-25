import React from 'react';

const PulseOverviewPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <header className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-8 w-auto" />
          </a>
          <h1 className="text-3xl font-bold">Pulse — 2 Minute Overview</h1>
          <p className="text-zinc-400 mt-2">Quick product walkthrough</p>
        </header>

        <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-xl">
          <video
            className="w-full h-auto"
            src="/Pulse-2-Min-Overview.mp4"
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <a
            href="/Pulse-2-Min-Overview.mp4"
            className="text-[#E0FE10] hover:text-lime-400 transition-colors"
            download
          >
            Download video
          </a>
          <a
            href="/coach"
            className="inline-flex items-center gap-2 bg-[#E0FE10] text-black font-semibold px-4 py-2 rounded-lg hover:bg-lime-400 transition-colors"
          >
            Learn about Pulse Coach
          </a>
        </div>
      </div>
    </div>
  );
};

export default PulseOverviewPage;


