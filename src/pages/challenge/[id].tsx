import { GetServerSideProps } from 'next';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import RoundInvitation from '../../components/RoundInvitation';
import ChallengeMeta from '../../components/ChallengeMeta';
import { SweatlistCollection } from '../../types/SweatlistCollection';

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
  const router = useRouter();
  const { id } = router.query;
  const [collection, setCollection] = useState<SweatlistCollection | null>(initialCollection || null);
  const [loading, setLoading] = useState(!initialCollection);
  const [error, setError] = useState<string | null>(initialError || null);

  useEffect(() => {
    const fetchChallenge = async () => {
      if (!id || initialCollection) return;

      try {
        console.log('Fetching challenge with ID:', id);
        
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8888/.netlify/functions'
          : 'https://fitwithpulse.ai/.netlify/functions';

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
        console.log('Received data:', data);

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch challenge');
        }

        if (!data.collection || !data.collection.challenge) {
          throw new Error('Invalid challenge data received');
        }

        const processedCollection = {
          ...data.collection,
          createdAt: data.collection.createdAt ? new Date(data.collection.createdAt) : new Date(),
          updatedAt: data.collection.updatedAt ? new Date(data.collection.updatedAt) : new Date(),
          challenge: {
            ...data.collection.challenge,
            startDate: data.collection.challenge.startDate ? 
              new Date(data.collection.challenge.startDate) : new Date(),
            endDate: data.collection.challenge.endDate ? 
              new Date(data.collection.challenge.endDate) : new Date(),
            createdAt: data.collection.challenge.createdAt ? 
              new Date(data.collection.challenge.createdAt) : new Date(),
            updatedAt: data.collection.challenge.updatedAt ? 
              new Date(data.collection.challenge.updatedAt) : new Date(),
            participants: data.collection.challenge.participants || []
          }
        };

        console.log('Processed collection:', processedCollection);
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

  if (!router.isReady || loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!collection || !collection.challenge) {
    return <ErrorState message="Challenge not found" />;
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
          console.log('Closing challenge invitation');
          router.push('/');
        }}
        onJoinChallenge={async (challenge) => {
          try {
            console.log('Attempting to join challenge:', challenge);
            // Add your join challenge logic here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            router.push('/');
          } catch (error) {
            console.error('Error joining challenge:', error);
            setError('Failed to join challenge. Please try again.');
          }
        }}
      />
    </>
  );
};

export const getServerSideProps: GetServerSideProps<ChallengePageProps> = async ({ params, res }) => {
  try {
    const id = params?.id as string;
    if (!id) {
      return { props: { initialError: 'Challenge ID is required' } };
    }

    // Set cache-control headers
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=59'
    );

    const response = await fetch(
      `https://fitwithpulse.ai/.netlify/functions/get-challenge-by-id?id=${id}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch challenge');
    }

    const data = await response.json();

    if (!data.success || !data.collection) {
      return {
        props: {
          initialError: 'Challenge not found'
        }
      };
    }

    // Process dates
    const processedCollection = {
      ...data.collection,
      createdAt: new Date(data.collection.createdAt).toISOString(),
      updatedAt: new Date(data.collection.updatedAt).toISOString(),
      challenge: data.collection.challenge ? {
        ...data.collection.challenge,
        startDate: new Date(data.collection.challenge.startDate).toISOString(),
        endDate: new Date(data.collection.challenge.endDate).toISOString(),
        createdAt: new Date(data.collection.challenge.createdAt).toISOString(),
        updatedAt: new Date(data.collection.challenge.updatedAt).toISOString(),
      } : null
    };

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

export default ChallengePage;