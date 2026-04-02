import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Users, 
  UserPlus, 
  Smartphone, 
  ArrowUpRight,
  Building2,
  Rocket,
  Code,
  Target,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import ReviewArticleLayout from '../../components/review/ReviewArticleLayout';

const yearEndStats = [
  {
    label: "Beta Testers",
    value: "150+",
    icon: Users,
  },
  {
    label: "Team Growth",
    value: "2 New Team Members",
    icon: UserPlus,
  },
  {
    label: "App Updates",
    value: "12",
    icon: Smartphone,
  }
];

const milestones = [
  {
    month: "January",
    title: "Beta Launch",
    description: "Launched our beta version in the App Store with limited features, beginning our journey with early adopters.",
    icon: Rocket,
    featured: true
  },
  {
    month: "April",
    title: "Beta Completion",
    description: "Successfully completed three rounds of beta testing, implementing valuable user feedback.",
    icon: Users,
  },
  {
    month: "May",
    title: "Major Update to 1.0",
    description: "Shipped major update to version 1.0 after incorporating beta testing feedback.",
    icon: Smartphone,
  },
  {
    month: "July",
    title: "Operation Hope",
    description: "Graduated from Operation Hope program in Atlanta, expanding our business knowledge.",
    icon: Building2,
  },
  {
    month: "September",
    title: "Web Development",
    description: "Kicked off web app development and complete website redesign.",
    icon: Code,
  },
  {
    month: "December",
    title: "Rounds Launch",
    description: "Shipped first version of Rounds with successful kickoff event at SoulCycle Buckhead.",
    icon: Users,
  }
];

const YearInReview = () => {
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
    <ReviewArticleLayout
      metaTitle="2024 Year in Review | Pulse"
      metaDescription="Pulse 2024 Year in Review - From beta testing to Rounds launch, a transformative year of building, learning, and growing together."
      eyebrow="Year in Review"
      title="2024: A Year of Building and Growing"
      description="From beta testing to our Rounds launch, 2024 was a transformative year for Pulse. Here's our journey of building, learning, and growing together."
    >
      <div className="hidden" aria-hidden="true">
        <h1>2024: A Year of Building and Growing</h1>
        <p data-description="true">
          From beta testing to our Rounds launch, 2024 was a transformative year for Pulse. Here&apos;s our journey of building, learning, and growing together.
        </p>
      </div>

        {/* Year End Stats */}
        <div className="relative max-w-4xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {yearEndStats.map((stat, _index) => (
              <div
                key={stat.label}
                className="bg-white/60 backdrop-blur-lg border border-gray-200/50 rounded-xl p-5 hover:bg-white/80 hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <stat.icon size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stat.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-100/50 to-transparent" />
          <div className="relative max-w-4xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
                <Rocket size={16} className="text-white" />
              </div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Our Journey Through 2024
              </h2>
            </div>

            <div className="space-y-4">
              {milestones.map((milestone, _index) => (
                <div
                  key={milestone.month}
                  className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                    milestone.featured 
                      ? 'bg-gradient-to-br from-amber-50/80 to-yellow-50/60 backdrop-blur-xl border border-amber-200/60 shadow-lg shadow-amber-100/40' 
                      : 'bg-white/50 backdrop-blur-lg border border-gray-200/50 hover:bg-white/70 hover:shadow-lg hover:shadow-gray-200/30'
                  }`}
                >
                  {milestone.featured && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
                  )}
                  
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                        milestone.featured ? 'bg-amber-100' : 'bg-gray-100'
                      }`}>
                        <milestone.icon size={20} className={milestone.featured ? 'text-amber-600' : 'text-gray-700'} />
                      </div>
                      <div className="flex-grow">
                        {milestone.featured && (
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={14} className="text-amber-500" />
                            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                              Key Milestone
                            </span>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                          {milestone.month}
                        </div>
                        <h3 className={`font-semibold mb-2 ${milestone.featured ? 'text-xl text-gray-900' : 'text-lg text-gray-900'}`}>
                          {milestone.title}
                        </h3>
                        <p className="text-gray-600 leading-relaxed">
                          {milestone.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Looking Ahead Section */}
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-lg shadow-gray-200/30">
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">
              Looking Ahead
            </h2>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              2025 Focus
            </h3>
            <p className="text-gray-600 mb-8">
              Our vision for the upcoming year
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 hover:shadow-lg hover:shadow-gray-200/30 transition-all">
                <div className="w-10 h-10 rounded-lg bg-lime-100 flex items-center justify-center mb-4">
                  <Target size={20} className="text-lime-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Expanding Rounds</h4>
                <p className="text-gray-600 text-sm">
                  Growing our community-driven workouts with new features and partnerships
                </p>
              </div>

              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 hover:shadow-lg hover:shadow-gray-200/30 transition-all">
                <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center mb-4">
                  <Users size={20} className="text-rose-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Creator Network</h4>
                <p className="text-gray-600 text-sm">
                  Building relationships with fitness creators and expanding our content offerings
                </p>
              </div>

              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 hover:shadow-lg hover:shadow-gray-200/30 transition-all">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center mb-4">
                  <Code size={20} className="text-cyan-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Launch Web Application</h4>
                <p className="text-gray-600 text-sm">
                  Ship a fully functional web app to complement our iOS experience
                </p>
              </div>

              <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200/50 hover:shadow-lg hover:shadow-gray-200/30 transition-all">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                  <Rocket size={20} className="text-amber-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Get into Accelerator</h4>
                <p className="text-gray-600 text-sm">
                  Gain entry to a top-tier accelerator program for mentorship and funding
                </p>
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
    </ReviewArticleLayout>
  );
};

export default YearInReview;
