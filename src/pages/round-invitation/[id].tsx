import { GetServerSideProps } from 'next';
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import RoundInvitation from '../../components/RoundInvitation';
import ChallengeMeta from '../../components/ChallengeMeta';
import { SweatlistCollection, Challenge } from '../../api/firebase/workout/types';

const LoadingState = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-white">Loading challenge...</div>
  </div>
);

const ErrorState: React.FC<{ message: string }> = ({ message }) => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-white text-center">
      <h2 className="text-xl font-bold mb-4">Unable to load challenge</h2>
      <p className="text-white/70">{message}</p>
      <button 
        onClick={() => window.location.reload()} 
        className="mt-4 px-4 py-2 bg-[#E0FE10] text-black rounded-lg"
      >
        Try Again
      </button>
    </div>
  </div>
);

interface ChallengePageProps {
  initialCollection?: SweatlistCollection;
  initialError?: string;
}

const ChallengePage: React.FC<ChallengePageProps> = ({ initialCollection, initialError }) => {
  console.log("Component rendering", { 
    initialCollection, 
    initialError,
    pricingInfo: initialCollection?.challenge?.pricingInfo,
    challenge: initialCollection?.challenge 
  });

  const router = useRouter();
  const { id, ttclid } = router.query;
  const [collection, setCollection] = useState<SweatlistCollection | null>(initialCollection || null);
  const [loading, setLoading] = useState(!initialCollection);
  const [error, setError] = useState<string | null>(initialError || null);

  const [isPinVerified, setIsPinVerified] = useState(false);


  useEffect(() => {
    console.log("useEffect triggered", { 
      id, 
      initialCollection,
      pricingInfo: initialCollection?.challenge?.pricingInfo,
      challenge: initialCollection?.challenge 
    });

    const fetchChallenge = async () => {
      if (!id || initialCollection) return;
      
  
      try {
        // Better detection for Netlify Dev environments
        const isLocalDev = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1');
        
        const apiUrl = isLocalDev
          ? `${window.location.protocol}//${window.location.host}/.netlify/functions`
          : 'https://fitwithpulse.ai/.netlify/functions';

        console.log('Using API URL:', apiUrl);
        
        const url = `${apiUrl}/get-challenge-by-id?id=${id}`;

        console.log('Fetching from URL:', url);
  
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response:', errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
      const data = await response.json();
      console.log("Client API Response Data:", data);
      
      // Check if we have the expected data structure
      if (!data || !data.success) {
        const errorMsg = data?.error || 'Failed to fetch challenge';
        console.error('API Error:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!data.collection || !data.collection.challenge) {
        console.error('Invalid challenge data structure:', data);
        throw new Error('Invalid challenge data received');
      }
  
        // Convert the plain object into a Challenge instance
        const processedCollection: SweatlistCollection = {
          ...data.collection,
          createdAt: new Date(data.collection.createdAt),
          updatedAt: new Date(data.collection.updatedAt),
          pin: data.collection.pin,
          challenge: new Challenge({
            id: data.collection.challenge.id,
            title: data.collection.challenge.title,
            subtitle: data.collection.challenge.subtitle,
            introVideos: data.collection.challenge.introVideos,
            status: data.collection.challenge.status || 'draft',
            startDate: new Date(data.collection.challenge.startDate),
            endDate: new Date(data.collection.challenge.endDate),
            createdAt: new Date(data.collection.challenge.createdAt),
            updatedAt: new Date(data.collection.challenge.updatedAt),
            participants: data.collection.challenge.participants || [],
            ownerId: data.collection.challenge.ownerId || [],
            pricingInfo: data.collection.challenge.pricingInfo || { isEnabled: false, amount: 0, currency: 'USD' }
          })
        };
  
        setCollection(processedCollection);
      } catch (err) {
        console.error('Error details:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while loading the challenge');
      } finally {
        setLoading(false);
      }
    };
  
    if (router.isReady && id) {
      fetchChallenge();
    }
  }, [id, router.isReady, initialCollection]);

  useEffect(() => {
    // Fire TikTok InvitePageView event on mount
    if (typeof window !== 'undefined' && window.ttq && collection?.challenge?.id) {
      window.ttq.track('InvitePageView', {
        round_id: collection.challenge.id
      });
    }
  }, [collection?.challenge?.id]);

  if (!router.isReady || loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!collection || !collection.challenge) {
    return <ErrorState message="Challenge not found" />;
  }

  // Show PIN entry if collection has a PIN and it's not verified yet
  if (collection.pin && !isPinVerified) {
    return (
      <PINEntry
        expectedPIN={collection.pin}
        onSuccess={() => setIsPinVerified(true)}
        onError={(message) => setError(message)}
      />
    );
  }

  return (
    <>
      <ChallengeMeta 
        challenge={collection.challenge}
        id={id as string}
      />
      
      <RoundInvitation
        challenge={collection.challenge}
        onClose={() => {
          router.push('/');
        }}
        onJoinChallenge={async (challenge) => {
          try {
            // Add your join challenge logic here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            router.push('/');
          } catch (error) {
            console.error('Error joining challenge:', error);
            setError('Failed to join challenge. Please try again.');
          }
        }}
        ttclid={typeof ttclid === 'string' ? ttclid : undefined}
      />
    </>
  );
};

export const getServerSideProps: GetServerSideProps<ChallengePageProps> = async ({ params, res, req }) => {
  try {
    console.log("getServerSideProps starting", params);  // Add this

    const id = params?.id as string;
    if (!id) {
      return { props: { initialError: 'Challenge ID is required' } };
    }

    // Set cache-control headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=59'
    );

    // Determine the base URL based on the request host
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const isLocalDev = host?.includes('localhost') || host?.includes('127.0.0.1');
    
    const apiUrl = isLocalDev
      ? `${protocol}://${host}/.netlify/functions`
      : 'https://fitwithpulse.ai/.netlify/functions';
    
    console.log("SSR Using API URL:", apiUrl);
    
    const url = `${apiUrl}/get-challenge-by-id?id=${id}`;
    console.log("SSR Fetching from URL:", url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch challenge');
    }

    const data = await response.json();
    
    // Debug logs for API response
    console.log("API Raw Response:", {
      success: data.success,
      hasCollection: !!data.collection,
      hasChallenge: !!data.collection?.challenge,
      pricingInfo: data.collection?.challenge?.pricingInfo,
      fullResponse: data
    });

    if (!data.success || !data.collection) {
      return {
        props: {
          initialError: 'Challenge not found'
        }
      };
    }

    console.log(data);
    // Return a plain object instead of a Challenge instance
    const processedCollection = {
      ...data.collection,
      createdAt: new Date(data.collection.createdAt).toISOString(),
      updatedAt: new Date(data.collection.updatedAt).toISOString(),
      pin: data.collection.pin ?? null,
      challenge: {
        id: data.collection.challenge.id,
        title: data.collection.challenge.title,
        subtitle: data.collection.challenge.subtitle,
        pricingInfo: data.collection.challenge.pricingInfo || { isEnabled: false, amount: 0, currency: 'USD' },
        introVideos: data.collection.challenge.introVideos || [],
        status: data.collection.challenge.status || 'draft',
        startDate: new Date(data.collection.challenge.startDate).toISOString(),
        endDate: new Date(data.collection.challenge.endDate).toISOString(),
        createdAt: new Date(data.collection.challenge.createdAt).toISOString(),
        updatedAt: new Date(data.collection.challenge.updatedAt).toISOString(),
        participants: data.collection.challenge.participants || [],
        ownerId: data.collection.challenge.ownerId || []
      }
    };

    // Move debug log here after removing non-serializable data
    console.log("Processed Collection:", {
      hasPricingInfo: !!data.collection.challenge.pricingInfo,
      pricingInfo: data.collection.challenge.pricingInfo,
      processedPricingInfo: processedCollection.challenge.pricingInfo
    });

    return {
      props: {
        initialCollection: processedCollection
      }
    };
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return {
      props: {
        initialError: 'Failed to load challenge'
      }
    };
  }
};

interface PINEntryProps {
  expectedPIN: string;
  onSuccess: () => void;
  onError: (message: string) => void;
}

const PINEntry: React.FC<PINEntryProps> = ({ expectedPIN, onSuccess, onError }) => {
  const [pin, setPin] = useState<string[]>(Array(6).fill(''));
  const [showError, setShowError] = useState(false);
  const [showEnterButton, setShowEnterButton] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow numbers

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // If we have a value, move to next input
    if (value && index < 8) {
      inputRefs.current[index + 1]?.focus();
    }

    // Show enter button when all digits are filled
    setShowEnterButton(newPin.every(digit => digit !== ''));
    setShowError(false);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      // Move to previous input on backspace if current input is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const validatePIN = () => {
    const enteredPIN = pin.join('');
    if (enteredPIN === expectedPIN) {
      onSuccess();
    } else {
      setShowError(true);
      onError('Incorrect PIN. Please try again.');
      // Clear PIN and focus first input
      setPin(Array(6).fill(''));
      inputRefs.current[0]?.focus();
      setShowEnterButton(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Enter Round PIN
        </h2>
        
        <div className="mb-8">
          <div className="flex justify-center gap-2 mb-4">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  if (inputRefs.current) {
                    inputRefs.current[index] = el;
                  }
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`
                  w-10 h-12 
                  text-center text-xl font-bold
                  bg-zinc-900 
                  border-2 ${showError ? 'border-red-500' : 'border-[#E0FE10]'}
                  text-white 
                  rounded-lg 
                  focus:outline-none 
                  focus:border-[#E0FE10] 
                  transition-colors
                `}
              />
            ))}
          </div>

          {showError && (
            <p className="text-red-500 text-center text-sm mt-2">
              Incorrect PIN. Please try again.
            </p>
          )}
        </div>

        {showEnterButton && (
          <button
            onClick={validatePIN}
            className="w-full py-3 bg-[#E0FE10] text-black rounded-lg font-bold 
                     hover:bg-opacity-90 transition-opacity"
          >
            Enter
          </button>
        )}
      </div>
    </div>
  );
};

export default ChallengePage;


