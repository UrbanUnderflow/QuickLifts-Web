import React, { useEffect } from 'react';
import Image from 'next/image';
import { CheckCircle, ArrowRight, Briefcase, Code, Users, Calendar, ArrowUpRight } from 'lucide-react';
import ReviewArticleLayout from '../../components/review/ReviewArticleLayout';
import { safeTrackMixpanel } from '../../lib/mixpanel';

const businessHighlights = [
  {
    title: "IBM Sports Innovation Program",
    description: "Selected for IBM Startups in collaboration with Hype Sports Innovation program, joining an elite group of sports tech innovators.",
    signal: "Industry validation and strategic partnership potential",
    featured: true
  },
  {
    title: "AcceleratorCon Finalist",
    description: "Selected to present at the Draft Experience, sharing our vision with investors from 500 Global and Plug & Play in New York.",
    signal: "Investor visibility and accelerator pipeline"
  },
  {
    title: "Startup Runway Finalist",
    description: "Selected as a finalist to pitch at the Startup Runway event on December 5th at Valor VC Day.",
    signal: "Continued momentum in competitive pitch circuits"
  },
  {
    title: "TechStars Applications",
    description: "Applied to TechStars NYC and TechStars AI Health in Baltimore accelerator programs.",
    signal: "Pursuing top-tier accelerator validation"
  },
  {
    title: "Atlanta Tech Village Engagement",
    description: "Pitched at Atlanta Tech Village and applied for It Takes A Village pre-accelerator program.",
    signal: "Building local ecosystem relationships"
  }
];

const productHighlights = [
  {
    title: "Rounds Feature Development",
    description: "Built and prepared Rounds for January 2025 launch—time-based synchronized workouts with live chat and community interaction."
  },
  {
    title: "Creator Partnership: Jaidus",
    description: "Partnered with SoulCycle instructor Jaidus to pioneer the Rounds feature with an exclusive community challenge."
  },
  {
    title: "Push Notification System",
    description: "Implemented push notifications for workout check-ins and post-workout community engagement."
  }
];

const metrics = [
  { label: "Active Users", value: "90", change: "+4.7%" },
  { label: "Moves in Library", value: "194", change: "New" },
  { label: "Workouts Completed", value: "417", change: "New" },
  { label: "Revenue", value: "$168", change: "-16%" }
];

const Nov24Review = () => {
  useEffect(() => {
    safeTrackMixpanel('Review Page Viewed', {
      review_type: 'month',
      review_period: 'November 2024',
      review_title: 'November 2024: Month in Review',
      page_url: window.location.href,
    });
  }, []);

  return (
    <ReviewArticleLayout
      metaTitle="November 2024: Month in Review | Pulse"
      metaDescription="Pulse November 2024 - Shifting from building code to building community. IBM Sports Innovation, AcceleratorCon, and Rounds feature development."
      eyebrow="November 2024"
      title="Shifting From Building Code to Building Community"
      description="November marks a pivotal shift—moving beyond the building phase to deeply engaging with our community and future partners. From prestigious tech accelerator programs to vibrant community partnerships, we're fostering meaningful dialogues about the future of social fitness."
    >
      <div className="hidden" aria-hidden="true">
        <h1>Shifting From Building Code to Building Community</h1>
        <p data-description="true">
          November marks a pivotal shift—moving beyond the building phase to deeply engaging with our community and future partners. From prestigious tech accelerator programs to vibrant community partnerships, we're fostering meaningful dialogues about the future of social fitness.
        </p>
      </div>

        {/* Key Metrics */}
        <div className="max-w-3xl mx-auto px-6 pb-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                <p className="text-sm text-gray-600">{metric.label}</p>
                <p className={`text-xs mt-1 ${metric.change.startsWith('+') ? 'text-green-600' : metric.change.startsWith('-') ? 'text-red-500' : 'text-gray-500'}`}>
                  {metric.change}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Business Development */}
        <div className="max-w-3xl mx-auto px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <Briefcase size={20} className="text-gray-700" />
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Business Development
            </h2>
          </div>
          
          <div className="space-y-6">
            {businessHighlights.map((item, index) => (
              <div 
                key={index}
                className={`pl-6 py-2 ${
                  item.featured 
                    ? 'border-l-4 border-yellow-500 bg-yellow-50 -ml-6 pl-10 py-6 rounded-r-lg' 
                    : 'border-l-2 border-gray-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className={`mt-0.5 flex-shrink-0 ${item.featured ? 'text-yellow-600' : 'text-gray-900'}`} />
                  <div>
                    {item.featured && (
                      <span className="inline-block text-xs font-semibold text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded mb-2 uppercase tracking-wide">
                        Key Milestone
                      </span>
                    )}
                    <h3 className={`font-semibold mb-1 ${item.featured ? 'text-xl text-gray-900' : 'text-lg text-gray-900'}`}>
                      {item.title}
                    </h3>
                    <p className="text-gray-700 mb-2">
                      {item.description}
                    </p>
                    <p className="text-sm text-gray-500 italic">
                      Signal: {item.signal}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Product Development */}
        <div className="bg-gray-50 border-t border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-8">
              <Code size={20} className="text-gray-700" />
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Product Development
              </h2>
            </div>
            
            <div className="grid gap-6">
              {productHighlights.map((item, index) => (
                <div 
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-5"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rounds Feature Preview */}
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <Calendar size={20} className="text-gray-700" />
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Coming January 2025
            </h2>
          </div>
          
          <div className="bg-gray-900 rounded-xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">Introducing: Rounds 🎉</h3>
            <p className="text-gray-300 mb-6">
              Rounds revolutionizes community workouts by enabling real-time interaction and 
              engagement between fitness creators and their audiences.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="font-semibold text-yellow-400 mb-3">Feature Highlights</h4>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li>• Time-based synchronized workouts</li>
                  <li>• Live chat and community interaction</li>
                  <li>• Push notifications for workout check-ins</li>
                  <li>• Post-workout community engagement</li>
                </ul>
              </div>
              <div>
                <Image 
                  src="/roundsPreview.png"
                  alt="Rounds Preview"
                  width={300}
                  height={300}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="font-semibold mb-3">Creator Spotlight: Jaidus</h4>
              <div className="flex gap-4 items-start">
                <Image 
                  src="/jaidus.png"
                  alt="Jaidus"
                  width={80}
                  height={80}
                  className="rounded-lg"
                />
                <p className="text-gray-300 text-sm">
                  We're thrilled to announce our collaboration with SoulCycle instructor and personal 
                  trainer Jaidus, who will be pioneering our Rounds feature with an exclusive community challenge.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Community & Gratitude */}
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-8">
              <Users size={20} className="text-gray-700" />
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Gratitude
              </h2>
            </div>
            
            <p className="text-gray-700 mb-6">
              This month, we've been fortunate to receive incredible support and guidance:
            </p>
            
            <ul className="space-y-3 text-gray-600 text-sm">
              <li>• AcceleratorCon hosts for accepting us as finalists</li>
              <li>• Jordan Sawadogo (500 Global) and Justin Murray (Plug & Play) for Draft Experience interviews</li>
              <li>• Jacey Cadet (Atlanta Tech Village) for valuable pitch feedback</li>
              <li>• Start-Up Runway for December 5th pitch event selection</li>
              <li>• Hype Sports Innovation for IBM program acceptance</li>
              <li>• Jaidus for invaluable feedback on Rounds feature</li>
            </ul>
          </div>
        </div>

        {/* Upcoming Event */}
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-6">
            Upcoming Event
          </h2>
          
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-6">
            <div>
              <p className="text-sm text-gray-500">December 5, 2024</p>
              <h3 className="font-semibold text-gray-900">Startup Showdown Pitch Event</h3>
              <p className="text-sm text-gray-600">Watch us pitch alongside innovative startups</p>
            </div>
            <a 
              href="https://www.tfaforms.com/4990537?tfa_5=a0PJw00000ND1ib"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
            >
              Register
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Learn more about Pulse</p>
                <a 
                  href="https://fitwithpulse.ai" 
                  className="text-gray-900 font-medium hover:underline inline-flex items-center"
                >
                  fitwithpulse.ai
                  <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Download Pulse
              </a>
            </div>
          </div>
        </div>
    </ReviewArticleLayout>
  );
};

export default Nov24Review;
