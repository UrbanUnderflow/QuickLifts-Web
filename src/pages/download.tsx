import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const DownloadPage = () => {
  const router = useRouter();
  const { challengeId } = router.query;
  const [countdown, setCountdown] = useState(5);
  
  // Set up a countdown to redirect to app store
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    
    // When countdown reaches 0, redirect based on platform
    if (countdown === 0) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.location.href = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';
      } else {
        window.location.href = 'https://fitwithpulse.ai';
      }
    }
  }, [countdown]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-4">Payment Successful!</h1>
          <p className="text-white/80 mb-8">
            You now have access to this paid Round. Download the app to join and start participating!
          </p>
          
          <div className="flex flex-col gap-4">
            <a
              href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
              className="px-6 py-4 bg-[#E0FE10] text-black rounded-xl font-semibold flex items-center justify-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.0518 12.4614C17.0366 9.57589 19.3953 8.19132 19.4969 8.12914C18.1882 6.23385 16.1621 5.96011 15.4538 5.94162C13.8061 5.77432 12.2094 6.92243 11.373 6.92243C10.5209 6.92243 9.20505 5.95937 7.83798 5.98865C6.07641 6.01792 4.44099 7.01092 3.55677 8.55845C1.74709 11.7021 3.1141 16.3371 4.85717 18.7663C5.73067 19.9582 6.7392 21.2965 8.05432 21.2489C9.33869 21.196 9.81309 20.4139 11.3569 20.4139C12.887 20.4139 13.3291 21.2489 14.6758 21.2175C16.0659 21.196 16.9341 20.0095 17.7752 18.8071C18.7721 17.4396 19.1666 16.0864 19.1827 16.0126C19.1506 16.0021 17.0718 15.2155 17.0518 12.4614Z" fill="black"/>
                <path d="M14.9006 4.1303C15.6143 3.25679 16.0936 2.07869 15.9758 0.884766C14.9704 0.927331 13.7234 1.56557 12.9825 2.42328C12.3164 3.18439 11.7461 4.40331 11.8799 5.56293C13.0079 5.64359 14.1708 4.99886 14.9006 4.1303Z" fill="black"/>
              </svg>
              Download on App Store
            </a>
            
            <a
              href="https://fitwithpulse.ai"
              className="px-6 py-4 bg-[#E0FE10] text-black rounded-xl font-semibold flex items-center justify-center gap-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Use Web App
            </a>
          </div>
          
          <p className="text-white/60 mt-6">
            Redirecting in {countdown} seconds...
          </p>
        </div>
        
        <div className="mt-8 text-white/60 text-sm">
          <p>
            If you already have the app installed, simply open it and sign in to access your paid Round.
          </p>
          <p className="mt-2">
            Your Round ID is: <span className="font-mono bg-zinc-900 px-2 py-1 rounded">{challengeId}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;