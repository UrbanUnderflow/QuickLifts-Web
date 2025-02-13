import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, Dumbbell } from 'lucide-react';
import { WorkoutSummary, WorkoutRating } from '../../../../api/firebase/workout/types';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { userService } from '../../../../api/firebase/user/service';
import { workoutService } from '../../../../api/firebase/workout/service';
import { getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../../../../api/firebase/config';

interface WorkoutSummaryViewProps {
  initialSummaryData: WorkoutSummary | null;
  error: string | null;
}

const WorkoutSummaryView: React.FC<WorkoutSummaryViewProps> = ({ initialSummaryData, error: serverError }) => {
  const router = useRouter();
  const { username, id: workoutId, summaryId } = router.query;

  const [summary, setSummary] = useState<WorkoutSummary | null>(initialSummaryData);
  const [loading, setLoading] = useState(!initialSummaryData);
  const [error, setError] = useState<string | null>(serverError);
  const [showSummary, setShowSummary] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [totalExercises, setTotalExercises] = useState(0);

  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8888/.netlify/functions'
    : 'https://fitwithpulse.ai/.netlify/functions';

  useEffect(() => {
    const fetchSummary = async () => {
      if (!username || !workoutId || !summaryId) return;

      try {
        console.log('Fetching summary for:', { username, workoutId, summaryId });
        
        const user = await userService.getUserByUsername(username as string);
        if (!user) {
          setError('User not found');
          return;
        }

        const workoutSummary = await workoutService.fetchWorkoutSummary(
          user.id,
          workoutId as string,
          summaryId as string
        );

        if (workoutSummary) {
          setSummary(workoutSummary);
        } else {
          setError('Workout summary not found');
        }
      } catch (err) {
        console.error('Error fetching workout summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load workout summary');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [username, workoutId, summaryId]);

  useEffect(() => {
    // Animate in the summary
    setShowSummary(true);
    
    // Set initial values
    setTotalTime(summary?.duration || 0);
    setTotalExercises(summary?.exercisesCompleted.length || 0);
  }, [summary]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error || !summary) {
    return <div className="flex items-center justify-center min-h-screen">
      {error || 'Summary not found'}
    </div>;
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Congratulations Header */}
        <div className={`text-center space-y-4 mb-12 transition-opacity duration-600 
          ${showSummary ? 'opacity-100' : 'opacity-0'}`}>
          <div className="inline-block">
            <CheckCircle className="w-16 h-16 text-[#E0FE10]" />
          </div>
          <h1 className="text-3xl font-bold">Workout Complete!</h1>
        </div>

        {/* Workout Stats */}
        <div className="space-y-4 mb-8">
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            title="Total Time"
            value={`${totalTime > 120 ? '2 hours +' : `${totalTime} mins`}`}
            delay={0.4}
            show={showSummary}
          />
          
          <StatCard
            icon={<Dumbbell className="w-6 h-6" />}
            title="Exercises Completed"
            value={totalExercises.toString()}
            delay={0.6}
            show={showSummary}
          />

          {summary.pulsePoints && summary.pulsePoints.totalPoints > 0 && (
            <StatCard
              icon="🏆"
              title="Round Score"
              value={summary.pulsePoints.totalPoints.toString()}
              delay={0.6}
              show={showSummary}
            />
          )}
        </div>

        {/* Rating Card */}
        <RatingCard 
          show={showSummary} 
          initialRating={summary.workoutRating || WorkoutRating.JustRight}
          onRatingChange={(rating) => {
            // Handle rating change
          }}
        />

        {/* Check-in Section */}
        <CheckInSection 
          show={showSummary}
          onCheckInComplete={() => {
            // Handle check-in complete
          }}
        />

        {/* Exercise Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Completed Moves</h2>
          <button 
            onClick={() => {/* Show calculation modal */}}
            className="text-sm font-bold text-[#E0FE10] mb-4"
          >
            What is your progress rating?
          </button>
          <ExerciseCards 
            exercises={summary.exercisesCompleted}
            show={showSummary}
          />
        </div>

        {/* Insight Card */}
        <InsightCard 
          show={showSummary}
          insight={summary.aiInsight}
          recommendations={summary.recommendations}
        />

        {/* Done Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-zinc-900">
          <button
            onClick={() => {
                router.push(`/`);
            }}
            className="w-full bg-[#E0FE10] text-black py-4 rounded-full font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// StatCard Component
interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  delay: number;
  show: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, delay, show }) => {
  return (
    <div 
      className={`flex items-center space-x-4 p-4 bg-zinc-800 rounded-xl transition-opacity duration-600
        ${show ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      <div className="text-[#E0FE10]">{icon}</div>
      <div>
        <div className="text-zinc-400 text-sm">{title}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
};

interface RatingCardProps {
  show: boolean;
  initialRating: WorkoutRating | null;
  onRatingChange: (rating: WorkoutRating) => void;
}

const RatingCard: React.FC<RatingCardProps> = ({ show, initialRating, onRatingChange }) => {
  const [selectedRating, setSelectedRating] = useState<WorkoutRating | null>(initialRating);

  const handleRatingSelect = (rating: WorkoutRating) => {
    setSelectedRating(rating);
    onRatingChange(rating);
  };

  const RatingButton: React.FC<{ 
    rating: WorkoutRating; 
    label: string; 
    emoji: string;
  }> = ({ rating, label, emoji }) => (
    <button
      onClick={() => handleRatingSelect(rating)}
      className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors
        ${selectedRating === rating 
          ? 'bg-[#E0FE10] text-zinc-900' 
          : 'bg-zinc-800 text-white hover:bg-zinc-700'
        }`}
    >
      {label} {emoji}
    </button>
  );

  return (
    <div 
      className={`mb-8 transition-opacity duration-600 ${show ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: '0.8s' }}
    >
      <h2 className="text-xl font-bold text-center mb-4">
        How was the workout?
      </h2>
      <div className="flex gap-2">
        <RatingButton 
          rating={WorkoutRating.TooEasy} 
          label="Too Easy" 
          emoji="😅" 
        />
        <RatingButton 
          rating={WorkoutRating.JustRight} 
          label="Just Right" 
          emoji="🙌" 
        />
        <RatingButton 
          rating={WorkoutRating.TooHard} 
          label="Too Hard" 
          emoji="😖" 
        />
      </div>
    </div>
  );
};

// CheckInSection Component
interface CheckInSectionProps {
  show: boolean;
  onCheckInComplete: () => void;
}

const CheckInSection: React.FC<CheckInSectionProps> = ({ show, onCheckInComplete }) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [gymLocation, setGymLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitCheckIn = async () => {
    if (!selectedImage) {
      alert('Please select an image for your check-in');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement check-in submission logic
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
      onCheckInComplete();
    } catch (error) {
      console.error('Failed to submit check-in:', error);
      alert('Failed to submit check-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`mb-8 transition-opacity duration-600 ${show ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: '1s' }}
    >
      <h2 className="text-xl font-bold mb-4">Post Workout Check-in</h2>
      
      {/* Image Selection */}
      <div className="mb-4">
        {imagePreview ? (
          <div className="relative">
            <img 
              src={imagePreview} 
              alt="Check-in preview" 
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              onClick={() => {
                setSelectedImage(null);
                setImagePreview(null);
              }}
              className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-2">📷</div>
              <div className="text-sm">Camera</div>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-2">🖼️</div>
              <div className="text-sm">Gallery</div>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      {/* Caption Input */}
      <input
        type="text"
        placeholder="Add a caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full p-4 mb-4 bg-zinc-800 rounded-lg text-white placeholder:text-zinc-500"
      />

      {/* Gym Location */}
      <button
        onClick={() => {/* TODO: Implement location picker */}}
        className="w-full p-4 mb-4 bg-zinc-800 rounded-lg text-left hover:bg-zinc-700 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span>{gymLocation || 'Tag your gym location'}</span>
          <span>📍</span>
        </div>
      </button>

      {/* Submit Button */}
      <button
        onClick={handleSubmitCheckIn}
        disabled={!selectedImage || isSubmitting}
        className={`w-full py-4 rounded-lg font-medium transition-colors
          ${selectedImage && !isSubmitting
            ? 'bg-[#E0FE10] text-black hover:bg-[#E0FE10]/90'
            : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
          }`}
      >
        {isSubmitting ? 'Posting...' : 'Post Check-in'}
      </button>
    </div>
  );
};

// ExerciseCards Component
interface ExerciseCardsProps {
  exercises: any[]; // Replace with proper exercise type
  show: boolean;
}

const ExerciseCards: React.FC<ExerciseCardsProps> = ({ exercises, show }) => {
  return (
    <div 
      className={`space-y-4 transition-opacity duration-600 ${show ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: '1.2s' }}
    >
      {exercises.map((exercise, index) => (
        <div 
          key={exercise.id || index}
          className="p-4 bg-zinc-800 rounded-lg"
        >
          <div className="flex items-center gap-4">
            {exercise.videos?.[0]?.gifURL && (
              <img
                src={exercise.videos[0].gifURL}
                alt={exercise.name}
                className="w-16 h-16 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-exercise.gif';
                }}
              />
            )}
            <div>
              <h3 className="font-bold">{exercise.name}</h3>
              <p className="text-sm text-zinc-400">
                {exercise.logs?.map((log: any) => 
                  `${log.sets}x${log.reps} (${log.weight}lbs)`
                ).join(', ')}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// InsightCard Component
interface InsightCardProps {
  show: boolean;
  insight: string | null;
  recommendations: string[];
}

const InsightCard: React.FC<InsightCardProps> = ({ show, insight, recommendations }) => {
  return (
    <div 
      className={`bg-zinc-800 rounded-lg p-6 mb-24 transition-opacity duration-600 
        ${show ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDelay: '1.4s' }}
    >
      {/* Workout Insight */}
      <h2 className="text-2xl font-bold mb-4">Workout Insight</h2>
      <p className="text-zinc-300 mb-6">
        {insight || "Insights currently not available."}
      </p>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <>
          <h3 className="text-lg font-bold mb-4">Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="text-[#E0FE10] mt-1">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <p className="text-zinc-300">{recommendation}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Add types for the workout summary
interface PulsePoints {
  totalPoints: number;
}

interface Exercise {
  id: string;
  name: string;
  videos?: {
    gifURL: string;
  }[];
  logs?: {
    sets: number;
    reps: number;
    weight: number;
  }[];
}

interface WorkoutSummaryType {
  id: string;
  duration: number;
  exercisesCompleted: Exercise[];
  workoutRating: WorkoutRating | null;
  pulsePoints?: PulsePoints;
  aiInsight: string | null;
  recommendations: string[];
}

export default WorkoutSummaryView;