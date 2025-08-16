import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';
import { CoachModel } from '../types/Coach';
import { db } from '../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

interface Props {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
}

const CoachProtectedRoute: React.FC<Props> = ({ 
  children, 
  requiresActiveSubscription = false 
}) => {
  const currentUser = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);

  useEffect(() => {
    const checkCoachAccess = async () => {
      // If no user, redirect to home
      if (!currentUser) {
        router.push('/');
        return;
      }

      // Check if user has coach role
      if (currentUser.role !== 'coach') {
        router.push('/');
        return;
      }

      try {
        // Fetch coach profile
        const coachDoc = await getDoc(doc(db, 'coaches', currentUser.id));
        
        if (!coachDoc.exists()) {
          // User has coach role but no coach profile - redirect to setup
          router.push('/coach/setup');
          return;
        }

        const coachData = new CoachModel(coachDoc.id, coachDoc.data() as any);
        setCoachProfile(coachData);

        // Check subscription requirements
        if (requiresActiveSubscription) {
          const hasActiveSubscription = 
            coachData.subscriptionStatus === 'active' || 
            coachData.subscriptionStatus === 'partner'; // Partners don't need paid subscription

          if (!hasActiveSubscription) {
            // Redirect to subscription page
            router.push('/coach/subscription-required');
            return;
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Error checking coach access:', error);
        router.push('/');
      }
    };

    checkCoachAccess();
  }, [currentUser, router, requiresActiveSubscription]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
          <div className="text-white text-lg">Verifying coach access...</div>
        </div>
      </div>
    );
  }

  // If we get here, user is authenticated and authorized
  return <>{children}</>;
};

export default CoachProtectedRoute;
