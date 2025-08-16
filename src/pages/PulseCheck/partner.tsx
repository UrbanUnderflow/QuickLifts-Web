import type { NextPage } from 'next';
import React, { useState } from 'react';
import { FaBolt, FaCoins, FaHandshake, FaChartLine, FaArrowRight, FaClock, FaUsers, FaDiagramProject, FaCircleCheck } from 'react-icons/fa6';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import PartnerJoinModal from '../../components/PartnerJoinModal';

const PartnerPage: NextPage = () => {
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/PulseCheck/partner" />

      {/* Hero */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-blue-950/20 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-16 left-16 w-80 h-80 bg-[#E0FE10]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 right-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-blue-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6">
            <FaHandshake className="h-4 w-4 text-[#E0FE10]" />
            <span className="text-[#E0FE10] text-sm font-medium">PulseCheck Coach Partnership</span>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">Grow your program. Earn recurring revenue.</h1>
          <p className="text-zinc-300 text-lg sm:text-xl max-w-3xl mx-auto">
            Bring your athletes to Pulse + PulseCheck and earn 40% revenue share from day one, plus referral bonuses when you bring other coaches to the platform.
          </p>
          <div className="mt-10 inline-flex flex-col sm:flex-row items-center gap-4">
            <button onClick={() => setIsPartnerModalOpen(true)} className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all">
              Get Started
              <FaArrowRight className="h-5 w-5" />
            </button>
            <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Coach%20Partnership" className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg transition-all">
              Talk to the Team
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative py-16 sm:py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-[#E0FE10]/20 to-lime-400/20 border border-[#E0FE10]/30 rounded-full">
              <FaBolt className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Simple Pricing</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 border border-[#E0FE10]/30 rounded-3xl p-8">
              <h3 className="text-white text-2xl font-bold mb-3">Per Athlete Subscription</h3>
              <p className="text-zinc-400 mb-6">One price includes both Pulse and PulseCheck.</p>
              <div className="flex items-end gap-2">
                <span className="text-white text-5xl font-extrabold tracking-tight">$12.99</span>
                <span className="text-zinc-400 mb-2">/ month per athlete</span>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-3xl p-8">
              <h3 className="text-white text-2xl font-bold mb-3">Payouts & Tracking</h3>
              <p className="text-zinc-400 mb-4">Automated monthly payouts with a simple dashboard to track active athletes and earnings.</p>
              <div className="flex items-center gap-3 text-blue-300">
                <FaClock className="h-5 w-5" />
                <span>Paid monthly • Transparent reporting</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partnership Tiers */}
      <section className="relative py-16 sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-green-950/10 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-green-500/20 backdrop-blur-sm border border-[#E0FE10]/30 rounded-full mb-6">
              <FaCoins className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Partnership Structure</span>
            </div>
            <h2 className="text-white text-4xl lg:text-5xl font-bold">Partner with Pulse</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Coach Partnership */}
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 border border-[#E0FE10]/30 rounded-3xl p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E0FE10] to-lime-400 flex items-center justify-center">
                  <FaUsers className="text-black text-lg" />
                </div>
                <h3 className="text-white text-3xl font-bold">Coach Partnership</h3>
              </div>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-[#E0FE10] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Revenue split:</div>
                    <div className="text-zinc-300">
                      <span className="text-[#E0FE10] font-bold">60% Pulse / 40% Coach</span> from day one
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-[#E0FE10] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Your athletes only:</div>
                    <div className="text-zinc-300">
                      Earn revenue share exclusively from athletes you personally bring to the platform
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-[#E0FE10] mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Monthly payouts:</div>
                    <div className="text-zinc-300">
                      Automated monthly payments with transparent tracking dashboard
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-900/60 border border-[#E0FE10]/20 rounded-2xl p-6">
                <div className="text-zinc-400 text-sm font-medium mb-2">Revenue Example</div>
                <div className="text-zinc-300 leading-relaxed">
                  <span className="text-white font-semibold">200 athletes</span> × $12.99 = $2,598/mo<br/>
                  <span className="text-white font-semibold">40%</span> to coach = <span className="text-[#E0FE10] font-bold text-xl">$1,039/mo</span> recurring
                </div>
              </div>
            </div>

            {/* Coach Referral Program */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-3xl p-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <FaDiagramProject className="text-white text-lg" />
                </div>
                <h3 className="text-white text-3xl font-bold">Coach Referral Program</h3>
              </div>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-blue-300 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Bring other coaches:</div>
                    <div className="text-zinc-300">
                      Refer coaches to the platform and earn from their success
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-blue-300 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Network bonus:</div>
                    <div className="text-zinc-300">
                      <span className="text-blue-300 font-bold">20% revenue share</span> from coaches you refer (Pulse gets 80%, you get 20%)
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <FaCircleCheck className="text-blue-300 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-semibold text-lg mb-2">Compounding income:</div>
                    <div className="text-zinc-300">
                      Earn from every athlete that your referred coaches bring in
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-zinc-900/60 border border-blue-400/20 rounded-2xl p-6">
                <div className="text-zinc-400 text-sm font-medium mb-2">Referral Example</div>
                <div className="text-zinc-300 leading-relaxed">
                  Coach you refer has <span className="text-white font-semibold">100 athletes</span> = $1,299/mo<br/>
                  You get 20% = $260/mo<br/>
                  <span className="text-white font-semibold">Your referral bonus</span> = <span className="text-blue-300 font-bold text-xl">$260/mo</span>
                  <div className="text-sm text-zinc-400 mt-2">Per coach you refer to the platform</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Network Effect Mechanics */}
      <section className="relative py-16 sm:py-24 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-full mb-6">
              <FaDiagramProject className="h-4 w-4 text-purple-300" />
              <span className="text-purple-200 text-sm font-medium">Network Effect</span>
            </div>
            <h2 className="text-white text-4xl lg:text-5xl font-bold">How the network creates compounding earnings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/20 rounded-3xl p-6">
              <h3 className="text-white text-xl font-semibold mb-2">Invite Links</h3>
              <p className="text-zinc-400">Every coach gets a unique link/code to invite both athletes and other coaches.</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/20 rounded-3xl p-6">
              <h3 className="text-white text-xl font-semibold mb-2">Aligned Incentives</h3>
              <p className="text-zinc-400">Coaches earn 40% from their own athletes. Referring coaches earn an additional 20% when they bring other coaches to the platform.</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/20 rounded-3xl p-6">
              <h3 className="text-white text-xl font-semibold mb-2">Monthly Payouts</h3>
              <p className="text-zinc-400">Payouts occur monthly and are tracked in a simple, transparent dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why This Works */}
      <section className="relative py-16 sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-blue-950/10 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-[#E0FE10]/20 to-blue-500/20 border border-[#E0FE10]/30 rounded-full mb-6">
              <FaHandshake className="h-4 w-4 text-[#E0FE10]" />
              <span className="text-[#E0FE10] text-sm font-medium">Why This Works</span>
            </div>
            <h2 className="text-white text-3xl sm:text-4xl lg:text-5xl font-bold">Immediate wins. Long-term recurring income.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-[#E0FE10]/10 to-lime-400/10 border border-[#E0FE10]/20 rounded-3xl p-6">
              <h4 className="text-white font-semibold mb-2">Immediate Revenue</h4>
              <p className="text-zinc-400">Start earning <span className="text-white font-medium">40% from day one</span>—no waiting periods or complex terms.</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-400/20 rounded-3xl p-6">
              <h4 className="text-white font-semibold mb-2">Recurring Revenue</h4>
              <p className="text-zinc-400">Transparent revenue splits ensure <span className="text-white font-medium">predictable monthly income</span> as you grow.</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-400/20 rounded-3xl p-6">
              <h4 className="text-white font-semibold mb-2">Referral Bonus</h4>
              <p className="text-zinc-400">Earn an additional <span className="text-white font-medium">20% revenue share</span> for every coach you refer to the platform.</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-400/20 rounded-3xl p-6">
              <h4 className="text-white font-semibold mb-2">Premium Value</h4>
              <p className="text-zinc-400">Premium pricing at <span className="text-white font-medium">$12.99/mo</span> includes both Pulse + PulseCheck—strong value proposition for athletes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-24 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/80 to-blue-950/40"></div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h3 className="text-white text-3xl sm:text-4xl font-bold mb-4">Ready to partner with PulseCheck?</h3>
          <p className="text-zinc-300 text-lg mb-8">Whether you're a top coach with a large audience or a growing coach building your roster, we'll set you up for success.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => setIsPartnerModalOpen(true)} className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all">
              Apply to Partner
              <FaArrowRight className="h-5 w-5" />
            </button>
            <a href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Coach%20Partnership" className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg transition-all">
              Book an Intro Call
            </a>
          </div>
        </div>
      </section>

      <Footer />

      <PartnerJoinModal isOpen={isPartnerModalOpen} closeModal={() => setIsPartnerModalOpen(false)} />
    </div>
  );
};

export default PartnerPage;
