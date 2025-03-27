import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Globe } from 'lucide-react';

const DownloadPage = () => {
  const router = useRouter();
  const { challengeId } = router.query;
  const [challenge, setChallenge] = useState<any>(null);
  
  useEffect(() => {
    if (!challengeId) return;

    // Fetch challenge details if needed
    const fetchChallengeDetails = async () => {
      try {
        // You can implement this based on your data model
        // For now we'll just use a placeholder
        setChallenge({
          id: challengeId,
          title: 'Your Fitness Round'
        });
      } catch (err) {
        console.error('Error fetching challenge:', err);
      }
    };

    fetchChallengeDetails();
  }, [challengeId]);

  // Function to open the app or App Store
  const openIOSApp = (challengeId: string) => {
    const appScheme = `quicklifts://round/${challengeId}`;
    const appStoreUrl = 'https://apps.apple.com/us/app/quicklifts/id6446042442';
    
    window.location.href = appScheme;
    
    const timeout = setTimeout(() => {
      window.location.href = appStoreUrl;
    }, 500);
    
    window.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearTimeout(timeout);
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-2xl w-full">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="bg-green-500/20 text-green-300 p-4 rounded-full inline-flex mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-zinc-400 text-lg">
            Your round is ready to begin
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-zinc-900 rounded-2xl p-8 mb-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - App Info */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[#E0FE10]">Your Fitness Journey Starts Here</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-zinc-800 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Track Your Progress</h3>
                    <p className="text-sm text-zinc-400">Monitor your daily workouts and track your improvements over time</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-zinc-800 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Daily Workouts</h3>
                    <p className="text-sm text-zinc-400">Access your personalized workout program day by day</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="bg-zinc-800 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E0FE10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">Progress Analytics</h3>
                    <p className="text-sm text-zinc-400">View detailed analytics and insights about your fitness journey</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Access Options */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-[#E0FE10]">Choose How to Access Your Round</h2>
              <div className="space-y-4">
                {/* iOS App Option */}
                <button
                  onClick={() => openIOSApp(challengeId as string)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 p-6 rounded-xl flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-zinc-700 p-3 rounded-lg">
                      <Download className="h-6 w-6 text-[#E0FE10]" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium">iOS App</h3>
                      <p className="text-sm text-zinc-400">Download the Pulse app</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-[#E0FE10] transition-colors" />
                </button>

                {/* Web App Option */}
                <Link 
                  href={`/round/${challengeId}`}
                  className="block w-full bg-zinc-800 hover:bg-zinc-700 p-6 rounded-xl"
                >
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center space-x-4">
                      <div className="bg-zinc-700 p-3 rounded-lg">
                        <Globe className="h-6 w-6 text-[#E0FE10]" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium">Web App</h3>
                        <p className="text-sm text-zinc-400">Access via browser</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-[#E0FE10] transition-colors" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <Link 
            href="/discover"
            className="text-zinc-400 hover:text-white transition-colors text-sm"
          >
            Return to Discover
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;