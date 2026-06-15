import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../hooks/useUser';
import { CoachModel } from '../types/Coach';
import { auth, db } from '../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { pulseCheckProvisioningService } from '../api/firebase/pulsecheckProvisioning/service';

interface Props {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
}

const CoachProtectedRoute: React.FC<Props> = ({ 
  children, 
  requiresActiveSubscription = false 
}) => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [_coachProfile, setCoachProfile] = useState<CoachModel | null>(null);

  useEffect(() => {
    const checkCoachAccess = async () => {
      // Wait for auth to finish initializing to avoid false redirects
      if (userLoading) {
        return;
      }
      // If no user, send them to the coach login and return them here after.
      // `!auth.currentUser` also catches the sign-out race where Redux still
      // holds a stale user but Firebase auth has already cleared — without it,
      // the coach-doc read below throws and bounces to the marketing home.
      if (!currentUser || !auth.currentUser) {
        const dest = router.asPath || '/coach/dashboard';
        router.replace(`/coach/login?redirect=${encodeURIComponent(dest)}`);
        return;
      }

      // PulseCheck staff (head coaches, team admins, performance staff) are
      // provisioned via team memberships and never get a legacy `coaches` doc.
      const hasPulseCheckStaffAccess = async () => {
        try {
          const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
          return memberships.some((m) => m.role && m.role !== 'athlete');
        } catch (membershipError) {
          console.error('Error checking PulseCheck staff access:', membershipError);
          return false;
        }
      };

      try {
        // Fetch coach profile first (source of truth for coach access)
        const coachDoc = await getDoc(doc(db, 'coaches', currentUser.id));

        if (!coachDoc.exists()) {
          if (await hasPulseCheckStaffAccess()) {
            setLoading(false);
            return;
          }
          // If no profile exists, fall back to role to decide where to go
          if (currentUser.role === 'coach') {
            // Coach role but missing profile → send to setup
            router.push('/coach/setup');
            return;
          } else {
            // Not a coach and no coach profile → home
            router.push('/');
            return;
          }
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
        // On sign-out, Firebase auth clears before the Redux `currentUser` flips
        // to null, so the coach-doc read fails with permission-denied here. Don't
        // bounce to the marketing home — send them to the coach login.
        if (!auth.currentUser) {
          router.replace('/coach/login');
          return;
        }
        if (await hasPulseCheckStaffAccess()) {
          setLoading(false);
          return;
        }
        router.push('/');
      }
    };

    checkCoachAccess();
  }, [currentUser, router, requiresActiveSubscription, userLoading]);

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
