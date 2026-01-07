import React, { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import confetti from 'canvas-confetti';
import mixpanel from 'mixpanel-browser';
import {
  ArrowLeft,
  CheckCircle,
  ArrowRight,
  Code,
  Briefcase,
  Download,
  ArrowUpRight,
  Sparkles,
  Users,
  UserPlus,
  Smartphone,
  TrendingUp,
  UsersRound,
  Trophy,
  Rocket,
  Activity,
  GraduationCap,
  Target,
  Zap,
  Layers
} from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

// Q4 Overall Key Metrics (pulled into the Year in Review page as the leading section)
const q4OverallMetrics = [
  {
    label: "Subscribed Members",
    currentValue: 106,
    previousValue: 116,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Unique Moves Added",
    currentValue: 680,
    previousValue: 612,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Logged",
    currentValue: 5100,
    previousValue: 4200,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings",
    currentValue: 307,
    previousValue: 589,
    isCurrency: true,
    showGrowth: true
  }
];

const q4BusinessHighlights: { title: string; description: string; signal: string; featured?: boolean }[] = [
  {
    title: "Founder University Completed",
    description: "Accepted and graduated from Jason Calacanis's Founder University program.",
    signal: "Validation from one of the most respected startup programs in the ecosystem",
    featured: true
  },
  {
    title: "Pulse Intelligence Labs, Inc.",
    description: "Incorporated as a Delaware C-Corp, formalizing our entity structure for institutional investment.",
    signal: "Fundable structure ready for growth"
  },
  {
    title: "Instantly.ai Outreach Engine",
    description: "Added Instantly.ai to our outreach toolkit for automated creator and partnership recruiting at scale.",
    signal: "More top-of-funnel conversations without brute-force manual outreach"
  }
];

const q4ProductShipped = [
  {
    title: "AI Round Builder",
    description: "Prompts generate complete Rounds in minutes. Creators describe their vision, AI builds the structure.",
    icon: Zap
  },
  {
    title: "Round Templates",
    description: "CapCut-style templates: select moves, apply a template, instant Round. Build time reduced from hours to minutes.",
    icon: Layers
  }
];

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

const yearBusinessHighlights = [
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

const yearProductHighlights = [
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
    // Track page view in Mixpanel
    mixpanel.track('Review Page Viewed', {
      review_type: 'year',
      review_period: '2025 Year in Review',
      review_title: 'Q4 2025 + Year in Review',
      page_url: window.location.href,
    });
    console.log('[Mixpanel] Tracked: Review Page Viewed - 2025 Year in Review');

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
        <title>2025 Review: Q4 + Year in Review | Pulse</title>
        <meta name="description" content="Pulse 2025: Q4 From Bootcamp to Breakthrough, followed by the full year in review—creator-led fitness, validated business model, and positioned for scale." />
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

        {/* Header (Lead with Q4, then roll into full year) */}
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
            Q4 2025 + Year in Review
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Q4 2025: From Bootcamp to Breakthrough
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            Founder University graduate. LAUNCH investment closed. AWS Retreat selected. AI Round Builder shipped. Then: the full 2025 year in review.
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

        {/* CEO Address */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                  From the Founder
                </p>
                <h2 className="text-2xl font-bold text-gray-900">
                  2025 Reflections & What's Next
                </h2>
              </div>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              A personal message on what we learned this year and where we're headed in 2026.
            </p>

            <div className="relative overflow-hidden rounded-xl border border-gray-200/60 bg-black max-w-2xl mx-auto aspect-video">
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src="https://www.youtube.com/embed/o9wROBfANY4"
                title="2025 Reflections & What's Next"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Highlights
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* LAUNCH Investment */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/80 to-yellow-50/60 backdrop-blur-xl border border-amber-200/60 shadow-lg shadow-amber-100/40">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Trophy size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-500" />
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        Key Milestone
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">LAUNCH Investment</h3>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Closed strategic investment from Jason Calacanis and the LAUNCH team, deepening our relationship with one of tech's most respected networks.
                </p>
              </div>
            </div>

            {/* AWS Retreat */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 backdrop-blur-xl border border-emerald-200/60 shadow-lg shadow-emerald-100/40">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Rocket size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                        Key Milestone
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">AWS Founder Retreat</h3>
                  </div>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">
                  Q3's <a href="https://aws.amazon.com/startups/lp/aws-impact-bootcamps" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-800">Bootcamp</a> paid off. Selected for the exclusive Retreat with investor meetings, up to $50K grant, and a guaranteed Techstars interview.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lowlights (lead into metrics) */}
        <div className="relative max-w-4xl mx-auto px-6 pb-6">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
              Lowlights
            </h2>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              No new Rounds launched in Q4
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Q4 was a build quarter. We shipped core creation tooling, but without a new Round live, subscribers churned. The upside: we enter 2026 with faster Round creation, new creators building, and an aggressive recruiting strategy.
            </p>
          </div>
        </div>

        {/* Q4 Key Metrics */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Q4 Overall Key Metrics
              </h2>
            </div>
            
            <p className="text-xl md:text-2xl text-gray-800 leading-relaxed mb-10 font-medium">
              Here’s where the quarter landed across subscribers, engagement, and revenue.
            </p>

            <div className="bg-gray-50/60 backdrop-blur-sm border border-gray-200/30 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Supporting Metrics</p>
              <MetricsGrid metrics={q4OverallMetrics} />
            </div>
          </div>
        </div>

        {/* Q4 Business Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Q4 Business Development
            </h2>
          </div>
          
          <div className="space-y-4">
            {q4BusinessHighlights.map((item, index) => (
              <div 
                key={index}
                className={`bg-white/50 backdrop-blur-lg border rounded-xl p-5 ${
                  item.featured 
                    ? 'border-amber-300 bg-gradient-to-r from-amber-50/80 to-yellow-50/60 border-l-4 border-l-amber-500' 
                    : 'border-gray-200/50 border-l-4 border-l-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle size={18} className={`mt-0.5 flex-shrink-0 ${item.featured ? 'text-amber-600' : 'text-gray-400'}`} />
                  <div>
                    {item.featured && (
                      <span className="inline-block text-xs font-semibold text-amber-700 bg-amber-200 px-2 py-0.5 rounded mb-2 uppercase tracking-wide">
                        Key Milestone
                      </span>
                    )}
                    <h3 className={`font-semibold mb-1 ${item.featured ? 'text-lg text-gray-900' : 'text-gray-900'}`}>
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{item.description}</p>
                    <p className="text-gray-500 text-xs italic">Signal: {item.signal}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Q4 Product Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Q4 Product Development: Shipped
            </h2>
          </div>

          <p className="text-gray-600 mb-6">
            Following through on Q3 priorities—AI Round Builder and Templates are live.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            {q4ProductShipped.map((item, index) => (
              <div 
                key={index}
                className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-lg shadow-gray-200/30"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                  <item.icon size={20} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.description}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  <CheckCircle size={12} />
                  Shipped
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How You Can Help */}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/60 backdrop-blur-xl border border-purple-200/60 rounded-2xl p-8 shadow-lg shadow-purple-100/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                How You Can Help
              </h2>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              As we scale in 2026, we're seeking connections that can help accelerate our growth:
            </p>
            
            <div className="space-y-4">
              <div className="bg-white/60 backdrop-blur-sm border border-purple-200/50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                    <Target size={14} className="text-purple-600" />
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-gray-900 mb-2">Investor Intros</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      Introductions to investors aligned with creator economy, fitness tech, and marketplace businesses.
                    </p>
                    
                    <div className="bg-purple-50/50 border border-purple-100/60 rounded-lg p-4">
                      <p className="text-xs font-medium text-purple-900 uppercase tracking-wider mb-3">
                        Priority Funds (open to others aligned with our mission)
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Uncork Capital</span> — Top-tier seed fund, strong consumer + marketplace history
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">True Ventures</span> — Founder-first, long-term partner, great for network-effect businesses
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Hustle Fund</span> — Fast-moving, strong distribution thesis, Launch-friendly
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">NFX</span> — Network effects, marketplaces, creator platforms (very strong conceptual fit)
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Precursor Ventures</span> — Elite pre-seed/seed signal, great co-lead and momentum builder
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Soma Capital</span>
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Serena Ventures</span>
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Courtside Ventures</span>
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Forerunner Ventures</span>
                        </li>
                        <li className="text-gray-700">
                          <span className="font-semibold text-gray-900">Sapphire Sport</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm border border-purple-200/50 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                    <Briefcase size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Brand Partnerships</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Connections to fitness brands, wellness companies, and athletic partners interested in reaching our engaged community.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-purple-200/40">
              <p className="text-sm text-gray-500 italic">
                If you can make an introduction, please reach out — every connection helps us grow faster.
              </p>
            </div>
          </div>
        </div>

        {/* Divider into full year */}
        <div className="relative max-w-4xl mx-auto px-6 pb-6">
          <div className="border-t border-gray-200/60 pt-10">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Full Year in Review
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              2025: Proving Creator-Led Fitness Works
            </h2>
          </div>
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
            {yearBusinessHighlights.map((item, index) => (
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
              {yearProductHighlights.map((item, index) => (
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
              Entering 2026 focused on creator acquisition, partnerships, product expansion, and scalable distribution.
            </p>
            
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Creator Acquisition
              </span>
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Strategic Partnerships
              </span>
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Product Expansion
              </span>
              <span className="px-4 py-2 bg-gray-100/80 backdrop-blur-sm border border-gray-200/60 rounded-full text-sm font-medium text-gray-700">
                Scalable Distribution
              </span>
            </div>

            <div className="relative mb-8 overflow-hidden rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-sky-50/40 backdrop-blur-sm shadow-lg shadow-blue-100/30">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500" />
              <div className="p-5">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Product: Launching Run
                </h4>
                <p className="text-gray-700 leading-relaxed">
                  We’re launching <span className="font-medium text-gray-900">Run</span> as a new category to compete with platforms like Strava—built around Pulse’s differentiator:
                  <span className="font-medium text-gray-900"> creator-led runs</span>. Creators host the experience, community follows, and participation turns into subscriptions.
                </p>
              </div>
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
