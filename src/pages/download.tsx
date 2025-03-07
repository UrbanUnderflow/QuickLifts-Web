import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const DownloadPage = () => {
  const router = useRouter();
  const { challengeId } = router.query;
  const [countdown, setCountdown] = useState(5);
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
    
    // Countdown for automatic redirect
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to the challenge page
          router.push(`/round/${challengeId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [challengeId, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-md w-full text-center">
        <div className="bg-green-500/20 text-green-300 p-3 rounded-full inline-flex mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold mb-4">Payment Successful!</h1>
        <p className="mb-6">
          Thank you for your purchase. You now have access to this fitness round!
        </p>
        
        <div className="mb-8 bg-zinc-900 p-6 rounded-xl">
          <p className="text-zinc-400 mb-2">Redirecting you to your round in {countdown} seconds...</p>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#E0FE10]" 
              style={{ width: `${(countdown / 5) * 100}%`, transition: 'width 1s linear' }}
            ></div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <Link href={`/round/${challengeId}`} passHref>
            <a className="bg-[#E0FE10] text-black py-3 px-6 rounded-xl font-semibold hover:bg-opacity-90 transition-all">
              Go to Round Now
            </a>
          </Link>
          
          <Link href="/discover" passHref>
            <a className="text-zinc-400 hover:text-white transition-colors">
              Return to Discover
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;