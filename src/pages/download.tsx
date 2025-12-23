import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Globe } from 'lucide-react';
import ChallengeCTA from '../components/ChallengeCTA';

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

  // Function to open the app or App Store using Firebase Dynamic Links
  const openIOSApp = (challengeId: string) => {
    if (!challengeId) return;
    
    // Create the base URL with properly encoded parameters for deep linking
    const baseUrl = `https://www.quickliftsapp.com/?linkType=round&roundId=${challengeId}`;
    const encodedBaseUrl = encodeURIComponent(baseUrl);
    const deepLinkUrl = `https://quicklifts.page.link/?link=${encodedBaseUrl}&apn=com.pulse.fitnessapp&ibi=Tremaine.QuickLifts&isi=6451497729`;
    
    window.location.href = deepLinkUrl;
  };

  // Choose the endpoint based on the environment
  const endpoint = process.env.NODE_ENV === 'development'
    ? 'http://localhost:8888'
    : 'https://fitwithpulse.ai';

  // Construct the web app URL using dynamic values from challenge
  const _webAppUrl = challengeId ? `${endpoint}/round/${challengeId}` : '';

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-2xl w-full">
        {challengeId ? (
          // Existing round-specific UI
          <>
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
              <h2 className="text-xl font-semibold text-[#E0FE10] mb-6">Get Started in 2 Simple Steps</h2>
                
              <div className="space-y-6 mb-8">
                {/* Step 1 */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium mb-2">Download the Pulse app</h3>
                    <a
                      href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 transition-colors px-4 py-2 rounded-lg mb-2"
                    >
                      <svg className="h-5 w-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.0403 12.3792C17.0211 9.57683 19.3328 8.32309 19.4323 8.25709C18.1956 6.46676 16.2302 6.19069 15.5509 6.17543C13.8945 6.00116 12.2944 7.19116 11.4538 7.19116C10.6131 7.19116 9.29943 6.19069 7.91174 6.22123C6.13087 6.25176 4.48897 7.29563 3.58371 8.89069C1.70484 12.1335 3.10724 17.0175 4.9097 19.7895C5.81497 21.149 6.86824 22.6526 8.25593 22.5915C9.61301 22.5305 10.1264 21.7004 11.7827 21.7004C13.4389 21.7004 13.9218 22.5915 15.3401 22.5609C16.7888 22.5305 17.7 21.1796 18.5846 19.8202C19.6379 18.2557 20.0745 16.7217 20.0946 16.6606C20.0543 16.6454 17.0605 15.5863 17.0403 12.3792Z" fill="currentColor"/>
                        <path d="M14.4349 4.25974C15.1756 3.35747 15.6787 2.14162 15.539 0.945923C14.5461 0.995789 13.3265 1.65909 12.5659 2.53601C11.8859 3.30094 11.2809 4.56522 11.4407 5.71574C12.5559 5.80228 13.674 5.16242 14.4349 4.25974Z" fill="currentColor"/>
                      </svg>
                      <span>Download from App Store</span>
                    </a>
                    <p className="text-sm text-zinc-400">Download the Pulse app to get the best experience</p>
                  </div>
                </div>
                
                {/* Step 2 */}
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium mb-2">Access your round</h3>
                    <button
                      onClick={() => challengeId && openIOSApp(challengeId as string)}
                      className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 transition-colors px-4 py-2 rounded-lg mb-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      <span>Launch the App</span>
                    </button>
                    <p className="text-sm text-zinc-400">Open the app to start your round</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center pt-6 border-t border-zinc-800">
                <p className="font-medium mb-3">On a laptop or Android device?</p>
                <Link 
                  href={challengeId ? `/round/${challengeId}` : '#'}
                  className="inline-flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 transition-colors px-6 py-3 rounded-xl"
                >
                  <Globe className="h-5 w-5 text-[#E0FE10]" />
                  <span>Access via Web App</span>
                </Link>
              </div>
            </div>

            {/* Optional: Render ChallengeCTA if challenge is available */}
            {challenge && (
              <div className="hidden">
                <ChallengeCTA challenge={challenge} />
              </div>
            )}
          </>
        ) : (
          // General download splash (no challengeId)
          <>
            <div className="flex flex-col items-center mb-8">
              <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-20 w-20 mb-4" />
              <h1 className="text-3xl font-bold mb-2 text-center">Download Pulse</h1>
              <p className="text-zinc-400 text-lg text-center max-w-xl">
                Create, share, and discover workouts with the Pulse app. Join a vibrant fitness community, track your progress, and get inspired by others. Available now for iOS and on the web.
              </p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-8 flex flex-col items-center mb-8">
              <a
                href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-[#E0FE10] text-black hover:bg-[#d4e900] transition-colors px-6 py-3 rounded-xl font-semibold text-lg mb-4"
              >
                <Download className="h-6 w-6" />
                <span>Download for iOS</span>
              </a>
              <Link
                href="/"
                className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 transition-colors px-6 py-3 rounded-xl text-white font-semibold text-lg"
              >
                <Globe className="h-6 w-6 text-[#E0FE10]" />
                <span>Use the Web App</span>
              </Link>
            </div>
            <div className="text-center">
              <Link 
                href="/"
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                Return to Discover
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DownloadPage;