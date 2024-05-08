import React from 'react';

const Support: React.FC = () => {
  return (
    <div className="px-4 sm:px-8">
      <div className="mb-48 bg-white">
        {/* Title Section */}
        <div className="max-w-[1052.76px] mx-auto text-center my-10 mb-64 mt-20">
          <div>
            <span className="text-black text-[76px] sm:text-[76px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Get the Help You Need</span>
          </div>
          <div>
            <span className="text-black text-[46px] sm:text-[46px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Explore resources to use the app effectively</span>
          </div>
        </div>

        {/* Support Content Section */}
        <div className="max-w-[1052.76px] mx-auto flex flex-col sm:flex-row gap-8">
          {/* FAQ Section */}
          <div className="flex-1">
            <h2 className="text-black text-2xl font-bold font-['HK Grotesk']">Frequently Asked Questions</h2>
            <ul className="mt-4 space-y-2">
              <li><a href="#faq1" className="text-blue-500 hover:underline">How do I create a workout?</a></li>
              <li><a href="#faq2" className="text-blue-500 hover:underline">Can I share my workout progress?</a></li>
              <li><a href="#faq3" className="text-blue-500 hover:underline">Where can I find the best workouts?</a></li>
              <li><a href="#faq4" className="text-blue-500 hover:underline">Is the app available on all platforms?</a></li>
            </ul>
          </div>

          {/* Video Guides Section */}
          <div className="flex-1">
            <h2 className="text-black text-2xl font-bold font-['HK Grotesk']">Video Guides</h2>
            <ul className="mt-4 space-y-2">
              <li><a href="#guide1" className="text-blue-500 hover:underline">Getting Started</a></li>
              <li><a href="#guide2" className="text-blue-500 hover:underline">Navigating the Community</a></li>
              <li><a href="#guide3" className="text-blue-500 hover:underline">Tracking Your Progress</a></li>
              <li><a href="#guide4" className="text-blue-500 hover:underline">Creating a Custom Workout</a></li>
            </ul>
          </div>
        </div>

        {/* Additional Support Resources */}
        <div className="max-w-[1052.76px] mx-auto mt-16">
          <h2 className="text-black text-2xl font-bold font-['HK Grotesk']">Additional Support Resources</h2>
          <ul className="mt-4 space-y-2">
            <li><a href="#resource1" className="text-blue-500 hover:underline">In-Depth User Guide</a></li>
            <li><a href="#resource2" className="text-blue-500 hover:underline">Troubleshooting Issues</a></li>
            <li><a href="#resource3" className="text-blue-500 hover:underline">Contact Support</a></li>
            <li><a href="#resource4" className="text-blue-500 hover:underline">Feedback & Suggestions</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Support;
