import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { ChevronLeft, BarChart2, Plus } from 'lucide-react';
import { Exercise } from '../../api/firebase/exercise';
import { User } from '../../types/User';

interface ExerciseViewProps {
  initialExerciseData: Exercise | null;
  error: string | null;
}

export default function ExerciseView({ initialExerciseData, error: serverError }: ExerciseViewProps) {
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(initialExerciseData);
  const [videoOwner, setVideoOwner] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(!initialExerciseData);
  const [error, setError] = useState<string | null>(serverError);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  useEffect(() => {
    const fetchExerciseData = async () => {
      if (!router.query.exerciseName || initialExerciseData) return;

      try {
        setIsLoading(true);
        const response = await fetch(
          `${API_BASE_URL}/get-exercise?name=${router.query.exerciseName}`
        );
        if (!response.ok) throw new Error('Exercise not found');
        
        const data = await response.json();
        if (data.success) {
          setExercise(data.exercise);
          if (data.exercise.videos[0]?.userId) {
            const userResponse = await fetch(
              `${API_BASE_URL}/get-user-profile?userId=${data.exercise.videos[0].userId}`
            );
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.success) {
                setVideoOwner(userData.user);
              }
            }
          }
        } else {
          throw new Error(data.error || 'Failed to load exercise');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load exercise');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExerciseData();
  }, [router.query.exerciseName, initialExerciseData]);

  if (isLoading || error || !exercise) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        {isLoading ? 'Loading...' : 'Exercise not found'}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-900">
      {/* Rest of the component implementation... */}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ExerciseViewProps> = async (context) => {
    const { exerciseName } = context.params || {};
  
    if (!exerciseName || typeof exerciseName !== 'string') {
      return {
        redirect: {
          destination: '/',
          permanent: false,
        },
      };
    }
  
    try {
      const API_BASE_URL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8888/.netlify/functions'
        : 'https://fitwithpulse.ai/.netlify/functions';
  
      // Convert hyphens back to spaces and capitalize words for the query
      const formattedName = exerciseName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
  
      const response = await fetch(`${API_BASE_URL}/get-exercise?name=${formattedName}`);
      
      if (!response.ok) {
        throw new Error('Exercise not found');
      }
  
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load exercise');
      }
  
      return {
        props: {
          initialExerciseData: data.exercise,
          error: null
        }
      };
    } catch (error) {
      console.error('Error in getServerSideProps:', error);
      return {
        props: {
          initialExerciseData: null,
          error: error instanceof Error ? error.message : 'Failed to load exercise'
        }
      };
    }
  };