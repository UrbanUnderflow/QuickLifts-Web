import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../hooks/useUser';
import { CoachModel } from '../types/Coach';
import { auth, db } from '../api/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { pulseCheckProvisioningService } from '../api/firebase/pulsecheckProvisioning/service';
import {
  isActivePulseCheckTeamMembership,
  type PulseCheckTeamMembership,
} from '../api/firebase/pulsecheckProvisioning/types';

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
  const [accessError, setAccessError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const redirectPath = (router.asPath || router.pathname || '/coach/dashboard').split('?')[0].split('#')[0] || '/coach/dashboard';
  const routePathname = router.pathname;

  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      setAccessError(null);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setAccessError('Coach access is taking longer than expected. Refresh the session or sign in again.');
      setLoading(false);
    }, 12000);

    const finishLoading = () => {
      if (cancelled) return;
      window.clearTimeout(timeoutId);
      setLoading(false);
    };

    const checkCoachAccess = async () => {
      setAccessError(null);
      // If no user, send them to the coach login and return them here after.
      // `!auth.currentUser` also catches the sign-out race where Redux still
      // holds a stale user but Firebase auth has already cleared — without it,
      // the coach-doc read below throws and bounces to the marketing home.
      if (!currentUser || !auth.currentUser) {
        const dest = redirectPath;
        window.clearTimeout(timeoutId);
        router.replace(`/coach/login?redirect=${encodeURIComponent(dest)}`);
        return;
      }

      // PulseCheck staff (head coaches, team admins, performance staff) are
      // provisioned via team memberships and never get a legacy `coaches` doc.
      const hasPulseCheckStaffAccess = async () => {
        try {
          const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
          const staffRoles = new Set<PulseCheckTeamMembership['role']>([
            'team-admin',
            'coach',
            'performance-staff',
            'support-staff',
          ]);
          const candidates = memberships.filter(
            (membership) =>
              membership.userId === currentUser.id &&
              Boolean(membership.teamId) &&
              Boolean(membership.organizationId) &&
              staffRoles.has(membership.role) &&
              isActivePulseCheckTeamMembership(membership)
          );
          const validated = await Promise.all(
            candidates.map(async (membership) => {
              const [team, organization] = await Promise.all([
                pulseCheckProvisioningService.getTeam(membership.teamId),
                pulseCheckProvisioningService.getOrganization(membership.organizationId),
              ]);
              return Boolean(
                team &&
                  organization &&
                  team.id === membership.teamId &&
                  team.organizationId === membership.organizationId &&
                  team.status === 'active' &&
                  organization.status === 'active'
              );
            })
          );
          return validated.some(Boolean);
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
            finishLoading();
            return;
          }
          // If no profile exists, fall back to role to decide where to go
          if (currentUser.role === 'coach') {
            // Coach role but missing profile → send to setup
            window.clearTimeout(timeoutId);
            router.push('/coach/setup');
            return;
          } else {
            // Not a coach and no coach profile → home
            window.clearTimeout(timeoutId);
            router.push('/');
            return;
          }
        }

        const rawCoachData = coachDoc.data() as Record<string, any>;
        const legacyCoachIsActive =
          (!rawCoachData.status || rawCoachData.status === 'active') &&
          !rawCoachData.revokedAt &&
          rawCoachData.disabled !== true &&
          rawCoachData.isActive !== false &&
          (!rawCoachData.userId || rawCoachData.userId === currentUser.id);
        if (!legacyCoachIsActive) {
          if (await hasPulseCheckStaffAccess()) {
            finishLoading();
            return;
          }
          window.clearTimeout(timeoutId);
          router.push('/');
          return;
        }

        const coachData = new CoachModel(coachDoc.id, rawCoachData as any);
        setCoachProfile(coachData);

        // Check subscription requirements
        if (requiresActiveSubscription) {
          const hasActiveSubscription = 
            coachData.subscriptionStatus === 'active' || 
            coachData.subscriptionStatus === 'partner'; // Partners don't need paid subscription

          if (!hasActiveSubscription) {
            // Redirect to subscription page
            window.clearTimeout(timeoutId);
            router.push('/coach/subscription-required');
            return;
          }
        }

        finishLoading();
      } catch (error) {
        console.error('Error checking coach access:', error);
        // On sign-out, Firebase auth clears before the Redux `currentUser` flips
        // to null, so the coach-doc read fails with permission-denied here. Don't
        // bounce to the marketing home — send them to the coach login.
        if (!auth.currentUser) {
          window.clearTimeout(timeoutId);
          router.replace('/coach/login');
          return;
        }
        if (await hasPulseCheckStaffAccess()) {
          finishLoading();
          return;
        }
        window.clearTimeout(timeoutId);
        router.push('/');
      }
    };

    checkCoachAccess();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [currentUser?.id, currentUser?.role, redirectPath, requiresActiveSubscription, retryNonce, routePathname, userLoading]);

  if (loading || accessError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="max-w-sm px-6 text-center">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
              <div className="text-white text-lg">Verifying coach access...</div>
            </>
          ) : (
            <>
              <div className="text-white text-lg font-semibold">We could not verify coach access.</div>
              <p className="mt-2 text-sm text-zinc-400">{accessError}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setAccessError(null);
                    setRetryNonce((value) => value + 1);
                  }}
                  className="rounded-lg bg-[#E0FE10] px-4 py-2 text-sm font-semibold text-black"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => router.replace(`/coach/login?redirect=${encodeURIComponent(redirectPath)}`)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200"
                >
                  Sign in again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // If we get here, user is authenticated and authorized
  return <>{children}</>;
};

export default CoachProtectedRoute;
