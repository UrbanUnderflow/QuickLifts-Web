import type { NextPage } from 'next';
import React, { useState } from 'react';
import { FaBrain, FaUsers, FaChartLine, FaArrowRight, FaCheck, FaBolt, FaHeart, FaComments, FaCalendar, FaShield, FaMobile } from 'react-icons/fa6';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import CoachProductModal from '../../components/CoachProductModal';

const CoachProductPage: NextPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/PulseCheck/coach" />

      {/* Hero */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-16 left-16 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 right-24 w-80 h-80 bg-[#E0FE10]/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-[#E0FE10]/20 backdrop-blur-sm border border-purple-500/30 rounded-full mb-6">
            <FaBrain className="h-4 w-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-medium">PulseCheck for Coaches</span>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
            Elevate your athletes' 
            <span className="bg-gradient-to-r from-purple-400 to-[#E0FE10] bg-clip-text text-transparent"> mental game</span>
          </h1>
          <p className="text-zinc-300 text-lg sm:text-xl max-w-3xl mx-auto mb-8">
            Give your athletes access to AI-powered mental performance coaching, mood tracking, and personalized insights. 
            Help them build mental resilience alongside physical strength.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/20 transition-all"
            >
              Get Started for Your Athletes
              <FaArrowRight className="h-5 w-5" />
            </button>
            <a 
              href="mailto:pulsefitnessapp@gmail.com?subject=PulseCheck%20Coach%20Demo" 
              className="inline-flex items-center gap-3 bg-zinc-900/80 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
            >
              Schedule a Demo
            </a>
          </div>
        </div>
      </section>

      {/* What is PulseCheck */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-[#E0FE10]/20 border border-purple-500/30 rounded-full mb-6">
              <FaBrain className="h-4 w-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">What is PulseCheck?</span>
            </div>
            <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">Mental performance coaching, powered by AI</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              PulseCheck combines AI-driven insights with evidence-based mental performance strategies to help athletes 
              overcome mental barriers, build confidence, and perform at their peak.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaBrain className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">AI Mental Coach</h3>
              <p className="text-zinc-400">
                24/7 access to an AI coach trained on sports psychology, helping athletes work through mental blocks, 
                anxiety, and performance issues.
              </p>
            </div>

            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaHeart className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Mood & Wellness Tracking</h3>
              <p className="text-zinc-400">
                Daily check-ins help athletes track their mental state, identify patterns, and build 
                self-awareness around their emotional well-being.
              </p>
            </div>

            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaChartLine className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Performance Insights</h3>
              <p className="text-zinc-400">
                Get insights into how mental state correlates with physical performance, helping optimize 
                training and competition strategies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits for Coaches */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">Why coaches choose PulseCheck</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Support your athletes' complete development with tools that complement your physical training expertise.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FaUsers className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Holistic Athlete Development</h3>
                    <p className="text-zinc-400">
                      Address both physical and mental aspects of performance. Help athletes build mental resilience 
                      that translates to better results in training and competition.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FaComments className="h-6 w-6 text-black" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Better Athlete Communication</h3>
                    <p className="text-zinc-400">
                      Athletes learn to articulate their mental state and challenges, leading to more productive 
                      coaching conversations and targeted interventions.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FaChartLine className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Data-Driven Insights</h3>
                    <p className="text-zinc-400">
                      Access aggregated insights about your athletes' mental wellness trends, helping you 
                      identify when additional support might be needed.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FaShield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Professional Support</h3>
                    <p className="text-zinc-400">
                      Provide athletes with professional-grade mental performance tools without needing to become 
                      a sports psychologist yourself.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-sm border border-zinc-700 rounded-3xl p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">What your athletes get</h3>
                  <p className="text-zinc-400">Complete mental performance package</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">24/7 AI mental performance coach</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">Daily mood & wellness tracking</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">Personalized mental training plans</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">Performance correlation insights</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">Stress & anxiety management tools</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                    <span className="text-white">Goal setting & motivation tracking</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-700">
                  <div className="text-center">
                    <div className="text-sm text-zinc-400 mb-1">Plus full access to</div>
                    <div className="text-lg font-bold text-white">Pulse fitness tracking & community</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="mb-12">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-[#E0FE10]/20 border border-purple-500/30 rounded-full mb-6">
              <FaBolt className="h-4 w-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">Simple Pricing</span>
            </div>
            <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">One plan. Complete access.</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Give your athletes everything they need for mental performance excellence.
            </p>
          </div>

          <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-sm border border-zinc-700 rounded-3xl p-8 max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">Coach Subscription</h3>
              <p className="text-zinc-400 mb-6">Perfect for coaches with teams of any size</p>
              
              <div className="mb-6">
                <div className="text-4xl font-bold text-white mb-2">$24.99/month</div>
                <div className="text-zinc-400 text-sm">per coach • unlimited athletes</div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-700 rounded-2xl p-6 mb-6">
                <div className="text-sm text-zinc-400 mb-2">Annual option</div>
                <div className="text-2xl font-bold text-[#E0FE10] mb-1">$249/year</div>
                <div className="text-sm text-green-400">Save $50 (16% off)</div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">All athletes get full access</span>
              </div>
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">Coach dashboard & insights</span>
              </div>
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">Team mood & wellness tracking</span>
              </div>
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">Direct athlete communication</span>
              </div>
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">Booking system integration</span>
              </div>
              <div className="flex items-center gap-3">
                <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                <span className="text-white">Priority support</span>
              </div>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-[#E0FE10] text-black px-6 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/20 transition-all"
            >
              Start Your Coach Subscription
            </button>
          </div>

          <p className="text-zinc-400 text-sm mt-8 max-w-2xl mx-auto">
            Your athletes get free access to both Pulse fitness tracking and PulseCheck mental performance coaching. 
            No additional charges, no per-athlete fees.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">How it works</h2>
            <p className="text-zinc-400 text-lg max-w-3xl mx-auto">
              Get your team started with mental performance coaching in three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Subscribe & Setup</h3>
              <p className="text-zinc-400">
                Sign up for your coach subscription and set up your team dashboard. Invite your athletes to join your team.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-black">
                2
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Athletes Get Access</h3>
              <p className="text-zinc-400">
                Your athletes download the Pulse app and get immediate access to both fitness tracking and mental performance coaching.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Monitor & Support</h3>
              <p className="text-zinc-400">
                Use your coach dashboard to monitor team wellness trends and provide targeted support when needed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile App Preview */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-purple-950/20 to-zinc-900"></div>
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-[#E0FE10]/20 border border-purple-500/30 rounded-full mb-6">
                <FaMobile className="h-4 w-4 text-purple-400" />
                <span className="text-purple-300 text-sm font-medium">Mobile App</span>
              </div>
              <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">
                Available on iOS, with Android coming soon
              </h2>
              <p className="text-zinc-400 text-lg mb-8">
                Your athletes can access their mental performance coach anytime, anywhere. 
                Seamlessly integrated with fitness tracking for a complete performance picture.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                  <span className="text-white">Native iOS app with full features</span>
                </div>
                <div className="flex items-center gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                  <span className="text-white">Works offline for basic features</span>
                </div>
                <div className="flex items-center gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                  <span className="text-white">Push notifications for check-ins</span>
                </div>
                <div className="flex items-center gap-3">
                  <FaCheck className="h-5 w-5 text-[#E0FE10]" />
                  <span className="text-white">Syncs with Apple Health & fitness apps</span>
                </div>
              </div>

              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-600 px-6 py-3 rounded-xl font-semibold transition-all"
              >
                <FaMobile className="h-5 w-5" />
                Download iOS App
              </a>
            </div>

            <div className="text-center">
              <div className="bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 backdrop-blur-sm border border-zinc-700 rounded-3xl p-8">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-[#E0FE10] rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FaBrain className="h-12 w-12 text-black" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">PulseCheck AI Coach</h3>
                <p className="text-zinc-400 mb-6">
                  "How are you feeling about tomorrow's competition? Let's work through any concerns and build your confidence."
                </p>
                <div className="bg-zinc-900/50 rounded-2xl p-4">
                  <div className="text-sm text-zinc-400 mb-2">Available 24/7 for your athletes</div>
                  <div className="text-white font-semibold">Personalized • Private • Professional</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <CoachProductModal isOpen={isModalOpen} closeModal={() => setIsModalOpen(false)} />
    </div>
  );
};

export default CoachProductPage;
