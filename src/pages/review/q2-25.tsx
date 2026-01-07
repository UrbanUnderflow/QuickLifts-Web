import React, { useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import mixpanel from 'mixpanel-browser';
import { 
  ArrowUpRight, 
  ArrowLeft, 
  Trophy, 
  Users, 
  Star, 
  Activity, 
  Target, 
  Zap, 
  Award,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Mail,
  Calendar,
  Download
} from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

// Q2 Overall Key Metrics
const q2OverallMetrics = [
  {
    label: "Subscribed Members",
    currentValue: 144,
    previousValue: 126,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Unique Moves Added",
    currentValue: 556,
    previousValue: 354,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Total Workouts Logged",
    currentValue: 3180,
    previousValue: 980,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Earnings",
    currentValue: 1105,
    previousValue: 1147,
    isCurrency: true,
    showGrowth: true
  }
];

// Morning Mobility Round Metrics
const morningMobilityMetrics = [
  {
    label: "Challenge Participants",
    currentValue: 83,
    previousValue: 35,
    isCurrency: false,
    showGrowth: true
  },
  {
    label: "Workouts Completed (in Round)",
    currentValue: 1630,
    previousValue: 940,
    isCurrency: false,
    showGrowth: true
  }
];

const stageWins = [
  {
    title: "Audience Favorite Award",
    event: "ReBrand Pitch",
    icon: Award,
    color: "amber"
  },
  {
    title: "Audience Choice + New Advisor",
    event: "1 Million Cups",
    icon: Users,
    color: "purple"
  },
  {
    title: "Men's Health Day Keynote",
    event: "BrickHouse Gym",
    icon: Target,
    color: "emerald"
  }
];

const priorities = [
  { id: 1, title: "Mobility Round Success", target: "Complete end-to-end Mobility Round with full user engagement and retention metrics" },
  { id: 2, title: "Creator Payment System", target: "End-to-end payment system for creators and prize winners + Stripe integration" },
  { id: 3, title: "Nutrition Logging Integration", target: "Add nutrition logging to enable end-to-end Rounds (Nutrition + Cardio + Lifting)" },
  { id: 4, title: "Pulse Programming AI", target: "AI chatbot collaboration for creating full Rounds in 5-10 minutes vs hours" },
  { id: 5, title: "Multiplayer Training Experience", target: "Unlock end-to-end training for both Multiplayer Rounds and One-on-One trainer-client sessions" }
];

const Q2Review2025 = () => {
  useEffect(() => {
    // Track page view in Mixpanel
    mixpanel.track('Review Page Viewed', {
      review_type: 'quarter',
      review_period: 'Q2 2025',
      review_title: 'Q2 2025: The Breakout Round',
      page_url: window.location.href,
    });
    console.log('[Mixpanel] Tracked: Review Page Viewed - Q2 2025');
  }, []);

  return (
    <>
      <Head>
        <title>Q2 2025: The Breakout Round | Pulse</title>
        <meta name="description" content="Pulse Q2 2025: Morning Mobility proved the model—83 participants, 65% from referrals, 1,630 workouts. The creator-led community flywheel is real." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-purple-100/20 to-transparent rounded-full blur-3xl" />
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
            Q2 2025 • April - June
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            The Breakout Round
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            Morning Mobility proved the model—83 participants, 65% from referrals, 1,630 workouts completed. The creator-led community flywheel is real.
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

        {/* Morning Mobility - Featured */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 backdrop-blur-xl border border-emerald-200/60 shadow-lg shadow-emerald-100/40">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400" />
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Users size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                      Key Validation
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Morning Mobility Round</h2>
                </div>
              </div>
              
              <p className="text-gray-700 leading-relaxed">
                Our 90-day challenge validated the social loop. Referrals drove 65% of participants, proving that creator-led communities bring their networks with them.
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Activity size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Q2 Overall Key Metrics
              </h2>
            </div>
            
            <p className="text-gray-600 mb-8">
              Continued platform growth across key user and activity metrics.
            </p>

            <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
              <MetricsGrid metrics={q2OverallMetrics} />
            </div>
          </div>
        </div>

        {/* Stage Wins */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Stage Wins & Third-Party Validation
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {stageWins.map((win, index) => (
              <div 
                key={index}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${
                  win.color === 'amber' ? 'from-amber-50/80 to-orange-50/60 border-amber-200/60' :
                  win.color === 'purple' ? 'from-purple-50/80 to-indigo-50/60 border-purple-200/60' :
                  'from-emerald-50/80 to-teal-50/60 border-emerald-200/60'
                } backdrop-blur-xl border shadow-lg p-6`}
              >
                <win.icon size={24} className={`mb-3 ${
                  win.color === 'amber' ? 'text-amber-600' :
                  win.color === 'purple' ? 'text-purple-600' :
                  'text-emerald-600'
                }`} />
                <h3 className="font-semibold text-gray-900 mb-1">{win.title}</h3>
                <p className="text-gray-600 text-sm">{win.event}</p>
              </div>
            ))}
          </div>

          <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
            <h4 className="font-semibold text-gray-900 mb-3">Additional Validation</h4>
            <ul className="space-y-2 text-gray-600 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                Selected to pitch at Atlanta Ventures Health & Wellness Meetup (June)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                Added SoulCycle & Solidcore creators to 100 Coaches pipeline
              </li>
            </ul>
          </div>
        </div>

        {/* Morning Mobility Round */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Morning Mobility Round: Our Breakthrough</h2>
            </div>
            
            <p className="text-gray-600 mb-6">
              Our breakout success demonstrating social loop and creator multiplier effect.
            </p>
            
            <MetricsGrid metrics={morningMobilityMetrics} />
            
            <div className="mt-6 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 rounded-xl p-5 border border-purple-200/50">
              <h4 className="font-semibold text-purple-900 mb-3">Key Achievements</h4>
              <ul className="space-y-2 text-purple-800 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                  83 total participants joined with 65.2% coming through referrals
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                  Over 1,630 workouts completed, demonstrating sustained user activity
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-purple-500 mt-0.5 flex-shrink-0" />
                  Challenge format validates our creator-led community approach
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* What We Nailed */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-lime-600 flex items-center justify-center">
              <Star size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              What We Nailed (April 1 – May 15)
            </h2>
          </div>
          
          <div className="space-y-4">
            {[
              { color: 'emerald', title: 'Challenge Activation', items: ['Morning Mobility Challenge live → 68 organic joins'], insight: 'Validates social loop & creator multiplier' },
              { color: 'blue', title: 'Virality Engine', items: ['User referrals and social sharing features driving organic growth'], insight: 'Users are successfully bringing in new members without paid advertising' },
              { color: 'purple', title: 'Growth Stack', items: ['Brevo (115k import + flows) • TikTok pixel → 1M impr / $0.47 CAC'], insight: 'Scalable retargeting & lifecycle comms' },
              { color: 'amber', title: 'Brand + IP', items: ['Pulse Programming™ launch • TM filed • provisional patent'], insight: 'Defensible moat; investor signal' }
            ].map((section, index) => (
              <div 
                key={index}
                className={`bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 border-l-4 ${
                  section.color === 'emerald' ? 'border-l-emerald-500' :
                  section.color === 'blue' ? 'border-l-blue-500' :
                  section.color === 'purple' ? 'border-l-purple-500' :
                  'border-l-amber-500'
                }`}
              >
                <h3 className="font-semibold text-gray-900 mb-2">{section.title}</h3>
                <ul className="text-gray-600 text-sm mb-2">
                  {section.items.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
                <p className={`text-xs font-medium ${
                  section.color === 'emerald' ? 'text-emerald-600' :
                  section.color === 'blue' ? 'text-blue-600' :
                  section.color === 'purple' ? 'text-purple-600' :
                  'text-amber-600'
                }`}>💡 {section.insight}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Talent Upgrades */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Users size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Talent Upgrades
            </h2>
          </div>

          {/* Chief of Staff */}
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/60 backdrop-blur-xl border border-blue-200/60 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <img 
                src="/bobbyAdvisor.jpg" 
                alt="Bobby Nweke" 
                className="w-16 h-16 rounded-xl object-cover"
              />
              <div>
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Chief of Staff</span>
                <h3 className="font-bold text-gray-900">Bobby Nweke</h3>
                <p className="text-sm text-gray-600">Harvard / ex-TED coach • Strategic storytelling & operational excellence</p>
              </div>
            </div>
          </div>

          {/* New Advisors */}
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-lg shadow-gray-200/30">
            <h3 className="font-semibold text-gray-900 mb-6">New Advisory Board</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { name: 'Valerie Alexander', role: 'Happiness, Inclusion & Bias', img: '/Val.jpg', desc: '#1 Amazon Seller, TED talk creator (500k+ views)' },
                { name: 'DeRay Mckesson', role: 'Community Building', img: '/Deray.png', desc: 'Renowned civil rights activist and community organizer' },
                { name: 'Marques Zak', role: 'Marketing and Growth', img: '/zak.jpg', desc: 'PepsiCo & AmEx executive, Ad Hall of Achievement inductee' }
              ].map((advisor, index) => (
                <div key={index} className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50">
                  <div className="flex items-center gap-3 mb-3">
                    <img 
                      src={advisor.img} 
                      alt={advisor.name} 
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{advisor.name}</h4>
                      <p className="text-xs text-blue-600">{advisor.role}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">{advisor.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Extra Wins */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
                <Zap size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Extra Wins</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Investor Dataroom v2 with live K-factor dashboard",
                "Pulse PR-Ops AI agent drafting releases & investor notes",
                "iOS crash-free sessions ↑ to 99.3%",
                "First Apple Watch HR streaming inside Sweat Sync Live",
                "Stripe Connect revenue-share ledger live",
                "Admin Tools CMS • 100 Coaches CRM • Pulse Check app inception"
              ].map((win, index) => (
                <div key={index} className="flex items-start gap-3 bg-gray-50/80 backdrop-blur-sm rounded-lg p-3">
                  <CheckCircle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{win}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Q3 Priorities */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Top-5 Priorities for Q3
            </h2>
          </div>
          
          <div className="space-y-3">
            {priorities.map((priority) => (
              <div 
                key={priority.id}
                className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/70 hover:shadow-lg hover:shadow-gray-200/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {priority.id}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{priority.title}</h3>
                    <p className="text-sm text-gray-600">{priority.target}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Resources & Next Steps</h2>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
                <h3 className="font-semibold text-gray-900 mb-2">📊 Investor Dataroom</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Financials, market analysis, and pitch deck.
                </p>
                <a 
                  href="/investor" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  View Dataroom
                  <ArrowUpRight size={14} />
                </a>
              </div>
              
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
                <h3 className="font-semibold text-gray-900 mb-2">📰 Press Kit</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Media resources, assets, and press releases.
                </p>
                <a 
                  href="/press" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Access Press Kit
                  <ArrowUpRight size={14} />
                </a>
              </div>
            </div>

            <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50">
              <h4 className="font-semibold text-gray-900 mb-3">Get in Touch</h4>
              <div className="flex flex-wrap gap-3">
                <a 
                  href="mailto:hello@fitwithpulse.ai" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Mail size={14} />
                  hello@fitwithpulse.ai
                </a>
                <a 
                  href="https://calendly.com/tre-aqo7/30min" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Calendar size={14} />
                  Schedule a Call
                </a>
              </div>
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

export default Q2Review2025;
