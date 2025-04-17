import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState } from 'react';
import { Section } from '../components/Header';
import { useScrollFade } from '../hooks/useScrollFade';

const MorningMobilityChallengePage: NextPage = () => {
  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Morning Mobility Challenge | Pulse Fitness</title>
        <meta 
          name="description" 
          content="Join the Morning Mobility Challenge and win $1,000! Complete daily mobility workouts, earn points, and climb the leaderboard." 
        />
        <meta property="og:title" content="Morning Mobility Challenge | Pulse Fitness" />
        <meta 
          property="og:description" 
          content="Join the Morning Mobility Challenge and win $1,000! Complete daily mobility workouts, earn points, and climb the leaderboard." 
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/mobility-challenge-preview.jpg" />
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
                src="/rounds.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-[#E0FE10] text-black px-3 py-1 rounded-full text-sm font-semibold">
              $1,000 PRIZE
            </div>
            <div className="bg-zinc-800 text-white px-3 py-1 rounded-full text-sm">
              May 1 - July 29, 2025
            </div>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Morning Mobility Challenge
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            Start your mornings right with our 90-day mobility challenge. Complete daily
            mobility workouts, earn points, and compete for the $1,000 grand prize.
            Join a community of motivated individuals committed to improving flexibility,
            reducing pain, and establishing a consistent morning routine.
          </p>
          <a 
            href="#join-now"
            className="bg-[#E0FE10] text-black px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors inline-flex items-center"
          >
            Join the Challenge
            <svg className="w-5 h-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
        </div>
      </main>

      {/* How It Works Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">1</div>
              <h3 className="text-white text-2xl font-bold mb-4">Join the Round</h3>
              <p className="text-zinc-400">Download the Pulse app and join the "Morning Mobility Challenge" Round from the Discover tab.</p>
            </div>
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">2</div>
              <h3 className="text-white text-2xl font-bold mb-4">Complete Workouts</h3>
              <p className="text-zinc-400">Follow the daily mobility workouts and tap "Complete" in the app to earn points.</p>
            </div>
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">3</div>
              <h3 className="text-white text-2xl font-bold mb-4">Win Prizes</h3>
              <p className="text-zinc-400">Climb the leaderboard by consistently completing workouts and referring friends. The top participant wins $1,000!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Points System */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-900">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-4">Earn Points</h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-16">Multiple ways to earn points and climb the leaderboard.</p>
          
          <div className="bg-zinc-800 rounded-xl p-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#E0FE10] rounded-full flex items-center justify-center text-black font-bold">+10</div>
                <div>
                  <h3 className="text-white font-semibold">Complete Daily Workout</h3>
                  <p className="text-zinc-400 text-sm">One mobility workout per day</p>
                </div>
              </div>
              <div className="text-zinc-400">10 points</div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#E0FE10] rounded-full flex items-center justify-center text-black font-bold">+5</div>
                <div>
                  <h3 className="text-white font-semibold">Successful Referral</h3>
                  <p className="text-zinc-400 text-sm">Friend joins the Round</p>
                </div>
              </div>
              <div className="text-zinc-400">5 points</div>
            </div>
            
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#E0FE10] rounded-full flex items-center justify-center text-black font-bold">+2</div>
                <div>
                  <h3 className="text-white font-semibold">Post Workout Video</h3>
                  <p className="text-zinc-400 text-sm">Share in the Round feed</p>
                </div>
              </div>
              <div className="text-zinc-400">2 points</div>
            </div>
          </div>
        </div>
      </section>

      {/* Official Rules Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-4">Official Rules</h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-16">Morning Mobility Challenge – Official Rules (Version 1.0)</p>
          
          <div className="max-w-4xl mx-auto bg-zinc-900 rounded-xl p-8">
            <div className="space-y-8">
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">1. Sponsor</h3>
                <p className="text-zinc-400">Pulse Fitness Collective, Inc. ("Pulse"), 1234 Peachtree St NE, Suite 500, Atlanta, GA 30309. This promotion is in no way sponsored, endorsed, or administered by Apple Inc., Google LLC, Meta Platforms, or TikTok.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">2. Eligibility</h3>
                <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                  <li>Open to natural persons 18 years or older at the time of entry.</li>
                  <li>Must be a legal resident of the United States or Canada (excluding Quebec).</li>
                  <li>Must have a valid Pulse account (free trial or paid).</li>
                  <li>Employees, contractors, and immediate family members of Pulse are not eligible.</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">3. Contest Period</h3>
                <p className="text-zinc-400">Begins 12:01 AM ET 1 May 2025 and ends 11:59 PM ET 29 July 2025 ("Contest Period"). All challenge activity and point totals must be recorded in‑app within this window.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">4. How to Enter</h3>
                <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                  <li>Download or open the Pulse app.</li>
                  <li>Join the "Morning Mobility Challenge" Round from the Discover tab.</li>
                  <li>Complete mobility workouts and referral tasks to earn points.</li>
                  <li>Track each completed workout in the app by tapping Complete.</li>
                  <li>Manual entries or outside timers will not be counted.</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">5. Scoring & Winner Selection</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-medium mb-1">Points System</h4>
                    <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                      <li>+10 pts per completed Mobility Challenge workout (daily limit 1)</li>
                      <li>+5 pts per successful referral who joins the Round</li>
                      <li>+2 pts for posting a workout video recap within the Round feed</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Leaderboard</h4>
                    <p className="text-zinc-400">Points update in real‑time inside the Round leaderboard.</p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Winner</h4>
                    <p className="text-zinc-400">The eligible participant with the highest verified point total at the Contest end date will be the Grand‑Prize Winner.</p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Tie‑breaker</h4>
                    <p className="text-zinc-400">Earliest time stamp of final point‑earning activity wins.</p>
                  </div>
                  <div>
                    <h4 className="text-white font-medium mb-1">Verification</h4>
                    <p className="text-zinc-400">Pulse will audit workout logs and may request proof (video or Apple Health data). Failure to verify within 7 days forfeits the prize.</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">6. Prize</h3>
                <p className="text-zinc-400">One (1) Grand Prize: USD $1,000, awarded via PayPal or ACH within 14 days of winner verification. Approximate Retail Value (ARV): $1,000.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">7. Taxes</h3>
                <p className="text-zinc-400">Prize winner is solely responsible for any federal, state, or local taxes. U.S. winners will receive an IRS Form 1099‑MISC if cumulative prizes exceed $600 in a calendar year and must submit a completed Form W‑9 before funds are released.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">8. Data & Publicity Release</h3>
                <p className="text-zinc-400">By participating, entrants agree Pulse may use their name, likeness, and in‑app workout statistics for promotional purposes in any media worldwide, without additional compensation, unless prohibited by law.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">9. Code of Conduct & Cheating</h3>
                <p className="text-zinc-400">Bots, automated logging, or any attempt to game the points system will result in immediate disqualification at Pulse's sole discretion. Pulse reserves the right to ban accounts for violations of community guidelines.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">10. Limitation of Liability</h3>
                <p className="text-zinc-400">Pulse, its affiliates, and advertising partners are not responsible for lost, late, or corrupted entries, or for any technical malfunctions of the app. Participant assumes all risks of injury or property damage resulting from participation in any workout.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">11. Disputes</h3>
                <p className="text-zinc-400">All disputes will be governed by the laws of the State of Georgia, without regard‑of‑law principles, and will be resolved individually by binding arbitration in Fulton County, GA.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">12. Winner Announcement</h3>
                <p className="text-zinc-400">The verified winner's first name, last initial, and city will be posted in‑app and at fitwithpulse.ai/winners within 30 days of contest end.</p>
              </div>
              
              <div>
                <h3 className="text-[#E0FE10] font-semibold mb-2">13. Contact</h3>
                <p className="text-zinc-400">Questions? Email hello@fitwithpulse.ai with subject line "Mobility Challenge Rules".</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="join-now" ref={useScrollFade()} className="py-20 bg-zinc-900">
        <div className="container mx-auto px-8 text-center">
          <h2 className="text-white text-5xl font-bold mb-6">Ready to transform your mornings?</h2>
          <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-10">
            Join the Morning Mobility Challenge today and start your journey towards better mobility, consistency, and a chance to win $1,000.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://fitwithpulse.ai/challenge/morning-mobility"
              className="bg-[#E0FE10] text-black px-8 py-4 rounded-full text-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors"
            >
              Join the Challenge
            </a>
            <a 
              href="https://apps.apple.com/us/app/pulse-fitness"
              className="bg-zinc-800 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-zinc-700 transition-colors"
            >
              Download App
            </a>
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-16">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">Do I need any special equipment?</h3>
              <p className="text-zinc-400">No special equipment is required! All mobility workouts can be done with just your bodyweight and a small amount of floor space.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">How long are the mobility workouts?</h3>
              <p className="text-zinc-400">Each mobility workout takes approximately 10-15 minutes to complete, perfect for fitting into your morning routine.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">What if I miss a day?</h3>
              <p className="text-zinc-400">While consistency is encouraged, missing a day won't disqualify you. The challenge is designed to accommodate real life, so just pick up where you left off!</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">How is the winner determined?</h3>
              <p className="text-zinc-400">The participant with the highest total points at the end of the 90-day challenge period will win the $1,000 grand prize. Points are earned through daily workouts, referrals, and posting videos.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">Can I join after the start date?</h3>
              <p className="text-zinc-400">Yes! You can join the challenge at any point during the contest period. However, for the best chance at winning, we recommend joining as early as possible.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MorningMobilityChallengePage; 