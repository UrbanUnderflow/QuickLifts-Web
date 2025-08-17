import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from 'next';
import PageHead from '../../components/PageHead';
import Footer from '../../components/Footer/Footer';
import { FaCircleCheck, FaDownload, FaShare, FaArrowRight, FaChartLine, FaUsers, FaCoins } from 'react-icons/fa6';
import { useUser } from '../../hooks/useUser';

const CoachOnboardingSuccess: NextPage = () => {
  const router = useRouter();
  const currentUser = useUser();
  const { session_id } = router.query;
  const [sessionData, setSessionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, you might want to verify the session with Stripe
    // For now, we'll just show success if session_id is present
    if (session_id) {
      setIsLoading(false);
    }
  }, [session_id]);

  const handleGetStarted = () => {
    // Navigate to coach dashboard when it's built
    // For now, navigate to profile or home
    router.push('/');
  };

  const referralCode = 'COACH123'; // This would come from the user's data in practice

  const shareMessage = `Join me on Pulse as my athlete! I'm your coach on the platform and you'll get access to Pulse + PulseCheck. Use my coach code: ${referralCode}`;

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
      alert('Coach referral message copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading your coach dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead pageOgUrl="https://fitwithpulse.ai/coach/onboarding-success" />

      {/* Success Hero */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-green-950/20 to-zinc-900"></div>
        <div className="absolute inset-0">
          <div className="absolute top-16 left-16 w-80 h-80 bg-[#E0FE10]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-16 right-24 w-80 h-80 bg-green-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-8">
            <FaCircleCheck className="h-12 w-12 text-black" />
          </div>

          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Welcome to the Coach Partnership!
          </h1>
          
          <p className="text-zinc-300 text-lg sm:text-xl max-w-2xl mx-auto mb-8">
            Your coach subscription is now active. You're ready to start earning revenue from your athletes and building your fitness community.
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <FaCoins className="h-8 w-8 text-[#E0FE10] mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">40%</div>
              <div className="text-zinc-400 text-sm">Revenue Share</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <FaUsers className="h-8 w-8 text-[#E0FE10] mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">∞</div>
              <div className="text-zinc-400 text-sm">Athletes</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <FaShare className="h-8 w-8 text-[#E0FE10] mx-auto mb-3" />
              <div className="text-2xl font-bold text-white">20%</div>
              <div className="text-zinc-400 text-sm">Referral Bonus</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all"
            >
              <FaChartLine className="h-5 w-5" />
              Access Coach Dashboard
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

      {/* Next Steps */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-white text-3xl sm:text-4xl font-bold mb-4">Your Next Steps</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Here's how to get the most out of your coach partnership and start earning revenue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1: Download App */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6">
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
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:bg-lime-400 transition-colors"
              >
                <FaDownload className="h-4 w-4" />
                Download iOS App
              </a>
            </div>

            {/* Step 2: Invite Athletes */}
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaUsers className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">2. Invite Your Athletes</h3>
              <p className="text-zinc-400 mb-6">
                Share your coach code with athletes. They get access to Pulse + PulseCheck, and you earn 40% revenue share.
              </p>
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-4">
                <div className="text-white font-mono text-sm">Coach Code:</div>
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
              <div className="w-16 h-16 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaChartLine className="h-8 w-8 text-black" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">3. Use Your Dashboard</h3>
              <p className="text-zinc-400 mb-6">
                Monitor athlete progress, track earnings, manage bookings, and grow your coaching business through the web dashboard.
              </p>
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-xl font-semibold hover:bg-lime-400 transition-colors"
              >
                <FaChartLine className="h-4 w-4" />
                Open Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue Potential */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-950/50 to-zinc-900"></div>
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-white text-3xl sm:text-4xl font-bold mb-6">Your Revenue Potential</h2>
          <p className="text-zinc-400 text-lg mb-12">
            See how your earnings can grow as you build your athlete community.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <div className="text-3xl font-bold text-[#E0FE10] mb-2">25 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$130/month</div>
              <div className="text-zinc-400 text-sm">40% of $324.75 revenue</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6 border-[#E0FE10]/30">
              <div className="text-3xl font-bold text-[#E0FE10] mb-2">100 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$520/month</div>
              <div className="text-zinc-400 text-sm">40% of $1,299 revenue</div>
            </div>
            <div className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700 rounded-2xl p-6">
              <div className="text-3xl font-bold text-[#E0FE10] mb-2">200 Athletes</div>
              <div className="text-xl font-semibold text-white mb-1">$1,040/month</div>
              <div className="text-zinc-400 text-sm">40% of $2,598 revenue</div>
            </div>
          </div>

          <p className="text-zinc-400 text-sm mt-8">
            Plus 20% bonus revenue from any coaches you refer to the platform.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachOnboardingSuccess;
