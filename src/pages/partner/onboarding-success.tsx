import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import PageHead from '../../components/PageHead';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import { FaCheckCircle, FaDownload, FaShare, FaArrowRight, FaUsers, FaTachometerAlt, FaDollarSign, FaCrown } from 'react-icons/fa';
import { useUser } from '../../hooks/useUser';

const PartnerOnboardingSuccess: NextPage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user completed partner signup
    if (currentUser) {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleGetStarted = () => {
    if (currentUser && currentUser.role === 'coach') {
      router.push('/coach/dashboard');
    } else {
      // If not a coach yet, something went wrong - redirect to home
      router.push('/');
    }
  };

  const referralCode = 'PARTNER123'; // This would come from the user's data in practice

  const shareMessage = `Join me on Pulse as my athlete! I'm your coach partner on the platform and you'll get access to Pulse + PulseCheck. Use my partner code: ${referralCode}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Pulse!',
          text: shareMessage,
          url: `https://fitwithpulse.ai/coach/${referralCode}`
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareMessage);
      alert('Partner referral message copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading your partner dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/partner/onboarding-success" />
      <Header />

      {/* Success Hero */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-amber-950/20 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-16 left-16 w-80 h-80 bg-[#E0FE10]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Success Icon with Crown */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="w-24 h-24 bg-gradient-to-r from-[#E0FE10] to-amber-400 rounded-full flex items-center justify-center">
              <FaCheckCircle className="h-12 w-12 text-black" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full flex items-center justify-center">
              <FaCrown className="h-4 w-4 text-black" />
            </div>
          </div>

          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Welcome to the Partnership Program!
          </h1>
          
          <p className="text-zinc-300 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
            Congratulations! Your partner application has been submitted and your profile is now active. 
            You're ready to start earning revenue from your athletes with 
            <strong className="text-[#E0FE10]"> no subscription fees</strong> and full access to all features.
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-amber-700/30 rounded-2xl p-6">
              <FaDollarSign className="h-8 w-8 text-amber-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">40%</div>
              <div className="text-zinc-400 text-sm">Revenue Share</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-[#E0FE10]/30 rounded-2xl p-6">
              <FaUsers className="h-8 w-8 text-[#E0FE10] mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">∞</div>
              <div className="text-zinc-400 text-sm">Athletes</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-green-700/30 rounded-2xl p-6">
              <FaCrown className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">FREE</div>
              <div className="text-zinc-400 text-sm">Subscription</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-amber-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all"
            >
                                  <FaTachometerAlt className="h-5 w-5" />
              Access Partner Dashboard
              <FaArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-3 bg-zinc-800 text-white border border-zinc-700 hover:border-zinc-600 px-8 py-4 rounded-2xl font-bold text-lg transition-all"
            >
              <FaShare className="h-5 w-5" />
              Share with Athletes
            </button>
          </div>
        </div>
      </section>

      {/* Partnership Benefits */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl sm:text-4xl font-bold mb-4">Your Partner Benefits</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              As a partner, you get everything a standard coach gets, but with exclusive benefits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Partner Benefits */}
            <div className="bg-gradient-to-br from-amber-900/20 to-zinc-800/50 backdrop-blur-sm border border-amber-700/30 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FaDollarSign className="h-6 w-6 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Partner Exclusive</h3>
              </div>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span><strong>No subscription fees</strong> - Ever!</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span><strong>40% revenue share</strong> from every athlete ($5.20 per athlete/month)</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span><strong>20% referral bonus</strong> from coaches you bring to the platform</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                  <span><strong>Priority support</strong> and direct access to our team</span>
                </li>
              </ul>
            </div>

            {/* Standard Features */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <FaUsers className="h-6 w-6 text-[#E0FE10]" />
                <h3 className="text-xl font-bold text-white">All Standard Features</h3>
              </div>
              <ul className="space-y-3 text-zinc-300">
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-[#E0FE10] flex-shrink-0" />
                  <span>Full coach dashboard & analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-[#E0FE10] flex-shrink-0" />
                  <span>Unlimited athlete management</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-[#E0FE10] flex-shrink-0" />
                  <span>Direct athlete communication</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-[#E0FE10] flex-shrink-0" />
                  <span>Booking system integration</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheckCircle className="h-5 w-5 text-[#E0FE10] flex-shrink-0" />
                  <span>Athlete gets full Pulse + PulseCheck access</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl sm:text-4xl font-bold mb-4">Your Next Steps</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Here's how to get the most out of your partnership and start earning revenue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1: Download App */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaDownload className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">1. Download the App</h3>
              <p className="text-zinc-400 mb-6">
                Get the Pulse app to manage your athletes, track progress, and communicate directly with your community.
              </p>
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:bg-amber-400 transition-colors"
              >
                <FaDownload className="h-4 w-4" />
                Download iOS App
              </a>
            </div>

            {/* Step 2: Invite Athletes */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaUsers className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">2. Invite Your Athletes</h3>
              <p className="text-zinc-400 mb-6">
                Share your partner code with athletes. They pay $12.99/month for full access, and you earn 40% revenue share.
              </p>
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-4">
                <div className="text-white font-mono text-sm">Partner Code:</div>
                <div className="text-[#E0FE10] font-mono text-lg font-bold">{referralCode}</div>
              </div>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 bg-zinc-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-600 transition-colors"
              >
                <FaShare className="h-4 w-4" />
                Share Code
              </button>
            </div>

            {/* Step 3: Access Dashboard */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaTachometerAlt className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">3. Use Your Dashboard</h3>
              <p className="text-zinc-400 mb-6">
                Monitor athlete progress, track earnings, manage bookings, and grow your coaching business through the web dashboard.
              </p>
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:bg-amber-400 transition-colors"
              >
                <FaTachometerAlt className="h-4 w-4" />
                Open Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Potential */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-amber-950/20 to-zinc-900"></div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white text-3xl sm:text-4xl font-bold mb-6">Your Revenue Potential as a Partner</h2>
          <p className="text-zinc-400 text-lg mb-12">
            See how your earnings can grow as you build your athlete community - with no subscription fees!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <div className="text-3xl font-bold text-[#E0FE10] mb-2">25 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$130/month</div>
              <div className="text-zinc-400 text-sm">40% of $324.75 revenue</div>
              <div className="text-amber-400 text-xs mt-1">No fees! Pure profit</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-amber-700/30 rounded-2xl p-6 border-2">
              <div className="text-3xl font-bold text-amber-400 mb-2">100 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$520/month</div>
              <div className="text-zinc-400 text-sm">40% of $1,299 revenue</div>
              <div className="text-amber-400 text-xs mt-1">$6,240/year profit!</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <div className="text-3xl font-bold text-[#E0FE10] mb-2">200 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$1,040/month</div>
              <div className="text-zinc-400 text-sm">40% of $2,598 revenue</div>
              <div className="text-amber-400 text-xs mt-1">$12,480/year profit!</div>
            </div>
          </div>

          <div className="mt-8 p-6 bg-gradient-to-r from-amber-900/20 to-[#E0FE10]/10 border border-amber-700/30 rounded-2xl">
            <p className="text-amber-300 font-semibold mb-2">Partner Advantage:</p>
            <p className="text-zinc-300 text-sm">
              Standard coaches pay $24.99/month subscription fees. As a partner, that's an extra $300/year in your pocket!
              Plus 20% bonus revenue from any coaches you refer to the platform.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PartnerOnboardingSuccess;
