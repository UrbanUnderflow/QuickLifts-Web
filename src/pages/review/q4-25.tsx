import React from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { 
  ArrowUpRight, 
  ArrowLeft, 
  Trophy, 
  Activity, 
  Target, 
  Sparkles,
  ArrowRight,
  Mail,
  Calendar,
  GraduationCap,
  Rocket,
  Users,
  CheckCircle,
  Layers,
  Zap,
  Wrench,
  Download
} from 'lucide-react';
import MetricsGrid from '../../components/MetricsGrid';

// Q4 Overall Key Metrics
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

const businessHighlights: { title: string; description: string; signal: string; featured?: boolean }[] = [
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
  }
];

const productShipped = [
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

const Q4Review2025 = () => {
  return (
    <>
      <Head>
        <title>Q4 2025: From Bootcamp to Breakthrough | Pulse</title>
        <meta name="description" content="Pulse Q4 2025: Founder University graduate, LAUNCH investment, AWS Retreat selection, and shipping the AI Round Builder." />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-amber-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-gradient-to-br from-yellow-100/20 to-transparent rounded-full blur-3xl" />
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
            Q4 2025 • October - December
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            From Bootcamp to Breakthrough
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed mb-8 max-w-2xl" data-description="true">
            Founder University graduate. LAUNCH investment closed. AWS Retreat selected. AI Round Builder shipped. Q4 delivered on every front.
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

        {/* Featured Milestones */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
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
                    <h2 className="text-lg font-bold text-gray-900">LAUNCH Investment</h2>
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
                    <h2 className="text-lg font-bold text-gray-900">AWS Founder Retreat</h2>
                  </div>
                </div>
                
                <p className="text-gray-700 text-sm leading-relaxed">
                  Q3's <a href="https://aws.amazon.com/startups/lp/aws-impact-bootcamps" target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline hover:text-emerald-800">Bootcamp</a> paid off. Selected for the exclusive Retreat with investor meetings, up to $50K grant, and a guaranteed Techstars interview.
                </p>
              </div>
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
                Q4 Overall Key Metrics
              </h2>
            </div>
            
            <p className="text-xl md:text-2xl text-gray-800 leading-relaxed mb-10 font-medium">
              No new Rounds launched in Q4 meant subscriber churn. But we enter 2026 with faster Round creation, new creators building, and an aggressive recruiting strategy.
            </p>

            <div className="bg-gray-50/60 backdrop-blur-sm border border-gray-200/30 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-4">Supporting Metrics</p>
              <MetricsGrid metrics={q4OverallMetrics} />
            </div>
          </div>
        </div>

        {/* Business Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Business Development
            </h2>
          </div>
          
          <div className="space-y-4">
            {businessHighlights.map((item, index) => (
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

        {/* Product Development */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Product Development: Shipped
            </h2>
          </div>

          <p className="text-gray-600 mb-6">
            Following through on Q3 priorities—AI Round Builder and Templates are live.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            {productShipped.map((item, index) => (
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

        {/* Toolkit Additions */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
              <Wrench size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Toolkit Additions
            </h2>
          </div>

          <div className="bg-white/50 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <CheckCircle size={18} className="text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Instantly</h3>
                <p className="text-gray-600 text-sm">Added Instantly to our outreach toolkit for creator and partner recruitment at scale.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Looking Ahead - Q1 2026 */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 backdrop-blur-xl border border-indigo-200/60 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Users size={20} className="text-indigo-600" />
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Coming Q1 2026</span>
                <h2 className="text-xl font-bold text-gray-900">Creator Club</h2>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4">
              Direct feedback from creators shaped this priority: they need a way to capture participants from Round to Round in one place.
            </p>
            <p className="text-gray-700">
              Creator Club lets creators intentionally grow their community—turning one-time challengers into long-term members who follow them across every Round they launch.
            </p>
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

export default Q4Review2025;

