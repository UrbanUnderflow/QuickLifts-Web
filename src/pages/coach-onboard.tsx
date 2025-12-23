import React from 'react';
import { useRouter } from 'next/router';
import { FaUsers, FaCheckCircle, FaEnvelope, FaStar } from 'react-icons/fa';
import { MdDashboard, MdChat, MdAnalytics } from 'react-icons/md';

const CoachOnboardPage: React.FC = () => {
  const router = useRouter();

  const handleRegister = () => {
    // Team-owned invite attribution (separate from coach-to-coach referral kickback links)
    // Accept either ?invite= (preferred) or legacy ?ref= and pass through as ?invite=
    const rawInvite =
      (typeof router.query.invite === 'string' && router.query.invite) ||
      (typeof router.query.ref === 'string' && router.query.ref) ||
      '';
    const invite = rawInvite ? rawInvite.trim() : '';

    const params = new URLSearchParams({ type: 'coach' });
    if (invite) params.set('invite', invite);

    router.push(`/sign-up?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Invitation Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#E0FE10]/5 to-transparent"></div>
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-8">
          <div className="text-center mb-8">
            <FaEnvelope className="text-[#E0FE10] text-4xl mx-auto mb-4" />
            <div className="text-[#E0FE10] text-sm font-medium tracking-wide uppercase">
              Personal Invitation
            </div>
          </div>
        </div>
      </div>

      {/* Main Invitation Card */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Invitation Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              You're Personally Invited
            </h1>
            <div className="w-24 h-1 bg-[#E0FE10] mx-auto mb-6"></div>
            <p className="text-xl text-zinc-300 leading-relaxed">
              We believe you have the expertise and passion to make a significant impact 
              as a coach on the <span className="text-[#E0FE10] font-semibold">Pulse Platform</span>.
            </p>
          </div>

          {/* Personal Message */}
          <div className="bg-zinc-800 rounded-xl p-6 mb-12 border-l-4 border-[#E0FE10]">
            <p className="text-lg text-zinc-200 leading-relaxed italic">
              "We're building the future of fitness coaching, and we want you to be part of it. 
              Your unique approach to training and client relationships would be a perfect fit 
              for our innovative platform that combines cutting-edge AI with personalized coaching."
            </p>
            <div className="mt-4 text-right">
              <div className="text-[#E0FE10] font-semibold">— The Pulse Team</div>
            </div>
          </div>

          {/* What You're Being Invited To */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8 text-center">What You're Being Invited To</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-800 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-[#E0FE10]/20 p-3 rounded-lg flex-shrink-0">
                    <MdChat className="text-[#E0FE10] text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Exclusive PulseCheck AI Access</h3>
                    <p className="text-zinc-300 text-sm">
                      Be among the first coaches to use our AI-powered mental performance platform.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-[#E0FE10]/20 p-3 rounded-lg flex-shrink-0">
                    <MdDashboard className="text-[#E0FE10] text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Advanced Client Dashboard</h3>
                    <p className="text-zinc-300 text-sm">
                      Manage all your athletes with our comprehensive CRM and analytics tools.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-[#E0FE10]/20 p-3 rounded-lg flex-shrink-0">
                    <MdAnalytics className="text-[#E0FE10] text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Performance Insights</h3>
                    <p className="text-zinc-300 text-sm">
                      Get deep analytics on both physical and mental performance metrics.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-[#E0FE10]/20 p-3 rounded-lg flex-shrink-0">
                    <FaUsers className="text-[#E0FE10] text-xl" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Elite Coach Community</h3>
                    <p className="text-zinc-300 text-sm">
                      Join a select group of top-tier coaches shaping the future of fitness.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8 text-center">A Glimpse of Your Coaching Dashboard</h2>
            
            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Your Coaching Command Center</h3>
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-zinc-700 rounded-lg p-4">
                  <div className="text-[#E0FE10] text-2xl font-bold">24</div>
                  <div className="text-zinc-300 text-sm">Active Athletes</div>
                  <div className="w-full bg-zinc-600 rounded-full h-2 mt-2">
                    <div className="bg-[#E0FE10] h-2 rounded-full" style={{ width: '75%' }}></div>
                  </div>
                </div>
                
                <div className="bg-zinc-700 rounded-lg p-4">
                  <div className="text-[#E0FE10] text-2xl font-bold">89%</div>
                  <div className="text-zinc-300 text-sm">Satisfaction Rate</div>
                  <div className="flex mt-2">
                    {[1,2,3,4,5].map(i => (
                      <FaStar key={i} className="text-[#E0FE10] text-sm" />
                    ))}
                  </div>
                </div>
                
                <div className="bg-zinc-700 rounded-lg p-4">
                  <div className="text-[#E0FE10] text-2xl font-bold">156</div>
                  <div className="text-zinc-300 text-sm">Sessions This Week</div>
                  <div className="text-green-400 text-xs mt-1">↗ +12% from last week</div>
                </div>
              </div>
            </div>
          </div>

          {/* Why You Were Selected */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">Why You Were Selected</h2>
            <div className="bg-gradient-to-r from-[#E0FE10]/10 to-transparent rounded-xl p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-semibold mb-4 text-[#E0FE10]">Our Criteria</h3>
                  <ul className="space-y-2 text-zinc-300">
                    <li className="flex items-center">
                      <FaCheckCircle className="text-[#E0FE10] mr-3 flex-shrink-0" />
                      Proven track record with clients
                    </li>
                    <li className="flex items-center">
                      <FaCheckCircle className="text-[#E0FE10] mr-3 flex-shrink-0" />
                      Innovative approach to coaching
                    </li>
                    <li className="flex items-center">
                      <FaCheckCircle className="text-[#E0FE10] mr-3 flex-shrink-0" />
                      Commitment to athlete development
                    </li>
                    <li className="flex items-center">
                      <FaCheckCircle className="text-[#E0FE10] mr-3 flex-shrink-0" />
                      Technology-forward mindset
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-4 text-[#E0FE10]">What This Means</h3>
                  <p className="text-zinc-300 leading-relaxed">
                    You're not just getting access to tools—you're joining an exclusive community 
                    of coaches who are defining the future of fitness. Your expertise will help 
                    shape our platform while you benefit from cutting-edge technology.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RSVP Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-6">Ready to Accept This Invitation?</h2>
            <p className="text-zinc-300 mb-8">
              This invitation is extended to a select few. We'd be honored to have you join us.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleRegister}
                className="bg-[#E0FE10] text-black px-10 py-4 rounded-lg text-lg font-semibold hover:bg-lime-400 transition-colors flex items-center"
              >
                <FaCheckCircle className="mr-3" />
                Accept Invitation
              </button>
              <div className="text-zinc-400 text-sm">
                No obligations • Free to start • Exclusive access
              </div>
            </div>
            
            <p className="text-zinc-500 text-xs mt-6">
              This invitation expires in 7 days. Secure your spot today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachOnboardPage;
