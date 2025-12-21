import React, { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import confetti from 'canvas-confetti';
import { ArrowLeft, CheckCircle, ArrowRight, Code, Briefcase, Download, ArrowUpRight, Sparkles, Users, UserPlus, Smartphone, TrendingUp, UsersRound } from 'lucide-react';

const yearEndStats = [
  {
    label: "Total Users",
    value: "2,000",
    icon: Users,
  },
  {
    label: "Peak Subscribers",
    value: "144",
    icon: TrendingUp,
  },
  {
    label: "App Updates",
    value: "42",
    icon: Smartphone,
  },
  {
    label: "New Team Member",
    value: "1",
    icon: UserPlus,
  },
  {
    label: "Advisors",
    value: "3",
    icon: UsersRound,
  }
];

const businessHighlights = [
  {
    title: "Strategic Investment from LAUNCH",
    description: "Closed a strategic investment from LAUNCH (Jason Calacanis), validating Pulse's creator-powered fitness marketplace vision.",
    signal: "External credibility and category validation",
    featured: true
  },
  {
    title: "Creator-Led Traction",
    description: "Launched multiple creator-led Rounds in 2025, averaging ~50 new subscribers per Round with fully organic growth.",
    signal: "Distribution advantage without paid acquisition"
  },
  {
    title: "Business Model Clarity",
    description: "Validated a subscription-based revenue model anchored in creator-hosted experiences.",
    signal: "Focus and reduced risk entering 2026"
  },
  {
    title: "Strong Retention & Engagement",
    description: "Achieved strong early retention and engagement driven by live, community-based workouts.",
    signal: "Real usage and community stickiness"
  },
  {
    title: "Strategic Partnerships",
    description: "Launched Rounds feature in partnership with creator Jaidus and SoulCycle Buckhead, validating creator pipeline strategy.",
    signal: "B2B2C potential and leverage-based growth"
  },
  {
    title: "Corporate Infrastructure",
    description: "Incorporated Pulse Intelligence Labs, Inc. as a Delaware C-Corp and formalized IP and financial infrastructure in preparation for growth.",
    signal: "Fundable and operationally mature"
  },
  {
    title: "Provisional Patent Filed",
    description: "Filed provisional patent protecting Pulse's core technology and creator-led fitness marketplace innovations.",
    signal: "Defensible IP and long-term competitive moat"
  }
];

const productHighlights = [
  {
    title: "Full Web App Launch",
    description: "Shipped complete web application at fitwithpulse.ai, expanding platform accessibility beyond mobile.",
  },
  {
    title: "Rounds Feature Launch",
    description: "Built and launched Rounds—creator-hosted group fitness challenges with real-time leaderboards and community engagement.",
  },
  {
    title: "Creator Dashboard & Tools",
    description: "Developed comprehensive creator dashboard with analytics, subscriber management, and content tools.",
  },
  {
    title: "Stripe Integration",
    description: "Built complete payment infrastructure with Stripe Connect for creator payouts, subscription billing, and platform fee processing.",
  },
  {
    title: "Coach Onboarding Flow",
    description: "Shipped streamlined coach onboarding with automated Stripe Connect account creation.",
  },
  {
    title: "AI Workout Generation",
    description: "Launched AI-powered workout generation for personalized training experiences.",
  },
  {
    title: "Subscription Infrastructure",
    description: "Built end-to-end subscription system with RevenueCat integration across iOS and web.",
  }
];

const Year2025Review = () => {
  useEffect(() => {
    // Celebration confetti burst on page load
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      // Launch confetti from the left
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#1f2937', '#374151']
      });
      // Launch confetti from the right
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#1f2937', '#374151']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#1f2937', '#374151']
    });

    // Continuous side confetti
    frame();
  }, []);

  return (
    <>
      <Head>
        <title>2025 Year in Review | Pulse</title>
        <meta name="description" content="Pulse 2025 Year in Review - Creator-led fitness, validated business model, and positioned for scale." />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-gray-200/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-amber-100/20 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Navigation */}
        <div className="relative border-b border-gray-200/60 backdrop-blur-sm bg-white/70">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <Link href="/review" className="inline-flex items-center text-sm text-gray-600 hover:text-black transition-colors">
              <ArrowLeft size={16} className="mr-2" />
              All Reviews
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Year in Review
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            2025: Proving Creator-Led Fitness Works
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            2025 was the year Pulse proved creator-led fitness works, validated the business model, 
            and positioned itself to scale through partnerships and distribution rather than brute-force marketing.
          </p>
          <a
            href="/PulseDeck12_9.pdf"
            download
            className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20"
          >
            <Download size={18} />
            Download PDF
          </a>
        </div>

        {/* Year End Stats */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {yearEndStats.map((stat, index) => (
              <div
                key={stat.label}
                className="bg-white/60 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/80 hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                    <stat.icon size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Business Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <Briefcase size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Business Development
            </h2>
          </div>
          
          <div className="space-y-4">
            {businessHighlights.map((item, index) => (
              <div 
                key={index}
                className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                  item.featured 
                    ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60 backdrop-blur-xl border border-amber-200/60 shadow-lg shadow-amber-100/40' 
                    : 'bg-white/50 backdrop-blur-lg border border-gray-200/50 hover:bg-white/70 hover:shadow-lg hover:shadow-gray-200/30'
                }`}
              >
                {item.featured && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
                )}
                
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      item.featured ? 'bg-amber-100' : 'bg-gray-100'
                    }`}>
                      <CheckCircle size={16} className={item.featured ? 'text-amber-600' : 'text-gray-700'} />
                    </div>
                    <div className="flex-grow">
                      {item.featured && (
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={14} className="text-amber-500" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Key Milestone
                          </span>
                        </div>
                      )}
                      <h3 className={`font-semibold mb-2 ${item.featured ? 'text-xl text-gray-900' : 'text-lg text-gray-900'}`}>
                        {item.title}
                      </h3>
                      <p className="text-gray-600 mb-3 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-sm text-gray-400 italic">
                        Signal: {item.signal}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Development */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Code size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Product Development
              </h2>
            </div>
            
            <p className="text-gray-600 mb-8">
              We ship frequently. Here's what we built in 2025.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              {productHighlights.map((item, index) => (
                <div 
                  key={index}
                  className="group bg-white/60 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/80 hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-300"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle size={14} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-gray-500 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Looking Ahead */}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
              Looking Ahead
            </h2>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              2026 Focus
            </h3>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Entering 2026 focused on creator acquisition, partnerships, and scalable distribution.
            </p>
            
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Creator Acquisition
              </span>
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Strategic Partnerships
              </span>
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Scalable Distribution
              </span>
            </div>
            
            <div className="border-t border-gray-200/60 pt-6">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Monthly Updates</p>
              <p className="text-gray-600">
                Starting January 2026, we'll be releasing monthly updates on the first Monday of each month, 
                providing regular insights into our progress, achievements, and strategic direction.
              </p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="relative border-t border-gray-200/60 backdrop-blur-sm bg-white/50">
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-1">Learn more about Pulse</p>
                <a 
                  href="https://fitwithpulse.ai" 
                  className="text-gray-900 font-medium hover:text-gray-600 transition-colors inline-flex items-center group"
                >
                  fitwithpulse.ai
                  <ArrowUpRight size={16} className="ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all hover:shadow-lg hover:shadow-gray-900/20 inline-flex items-center gap-2"
              >
                Download Pulse
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Year2025Review;
