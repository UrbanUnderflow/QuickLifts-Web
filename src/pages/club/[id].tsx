import { GetServerSideProps, type GetServerSidePropsContext } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { clubService } from '../../api/firebase/club/service';
import {
  ClubLandingPageProps,
  fetchClubLandingPageProps,
} from '../../api/firebase/club/landingPage';
import { ClubMemberApp } from '../../components/club/ClubMemberApp';
import { ClubPublicLanding } from '../../components/club/ClubPublicLanding';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { buildClubCheckInPath } from '../../utils/clubLinks';

type MembershipState = 'checking' | 'member' | 'non-member';
type LiveClubData = ClubLandingPageProps['clubData'];

const MOBILE_USER_AGENT_RE = /iphone|ipad|ipod|android|webos|blackberry|windows phone|mobile/i;

const isMobileRequest = (req: GetServerSidePropsContext['req']): boolean => {
  const userAgent = String(req.headers['user-agent'] || '');
  if (!userAgent) {
    return false;
  }

  if (req.headers['sec-ch-ua-mobile'] === '?1') {
    return true;
  }

  return MOBILE_USER_AGENT_RE.test(userAgent);
};

const buildInstallRedirectUrl = (id: string, query: ParsedUrlQuery): string => {
  const installPath = `/club/${encodeURIComponent(id)}/install`;
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (key === 'id' || key === 'web') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string' && entry) {
          params.append(key, entry);
        }
      });
      return;
    }

    if (typeof value === 'string' && value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString ? `${installPath}?${queryString}` : installPath;
};

const ClubPage: React.FC<ClubLandingPageProps> = ({
  clubData,
  creatorData,
  totalWorkoutsCompleted = 0,
  allRounds = [],
  error,
}) => {
  const router = useRouter();
  const currentUser = useUser();
  const isUserLoading = useUserLoading();
  const [membershipState, setMembershipState] = useState<MembershipState>('checking');
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [liveClubData, setLiveClubData] = useState<LiveClubData>(clubData);

  useEffect(() => {
    setLiveClubData(clubData);
  }, [clubData]);

  const isCreator = useMemo(() => {
    return Boolean(currentUser?.id && liveClubData?.creatorId && currentUser.id === liveClubData.creatorId);
  }, [currentUser?.id, liveClubData?.creatorId]);

  useEffect(() => {
    let cancelled = false;

    if (!liveClubData?.id) {
      setMembershipState('non-member');
      return;
    }

    if (!currentUser?.id) {
      setMembershipState('non-member');
      return;
    }

    if (currentUser.id === liveClubData.creatorId) {
      setMembershipState('member');
      return;
    }

    setMembershipState('checking');

    const loadMembership = async () => {
      try {
        const isMember = await clubService.isUserMember(liveClubData.id, currentUser.id);
        if (!cancelled) {
          setMembershipState(isMember ? 'member' : 'non-member');
        }
      } catch (membershipError) {
        console.error('[ClubPage] Failed to load membership state:', membershipError);
        if (!cancelled) {
          setMembershipState('non-member');
        }
      }
    };

    loadMembership();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, liveClubData?.creatorId, liveClubData?.id]);

  const isMember = isCreator || membershipState === 'member';

  const handleJoin = async () => {
    if (!liveClubData?.id) {
      return;
    }

    if (!currentUser?.id || !currentUser.username) {
      await router.push(buildClubCheckInPath(liveClubData.id));
      return;
    }

    setIsJoining(true);

    try {
      const alreadyMember = await clubService.isUserMember(liveClubData.id, currentUser.id);
      await clubService.joinClub(liveClubData.id, currentUser.id, currentUser.toShortUser(), 'manual');

      setMembershipState('member');

      if (!alreadyMember) {
        setLiveClubData((previous: LiveClubData) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            memberCount: (previous.memberCount || 0) + 1,
          };
        });
      }
    } catch (joinError) {
      console.error('[ClubPage] Failed to join club:', joinError);
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!liveClubData?.id || !currentUser?.id) {
      return;
    }

    setIsLeaving(true);

    try {
      await clubService.leaveClub(liveClubData.id, currentUser.id);
      setMembershipState('non-member');
      setLiveClubData((previous: LiveClubData) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          memberCount: Math.max(0, (previous.memberCount || 0) - 1),
        };
      });
    } catch (leaveError) {
      console.error('[ClubPage] Failed to leave club:', leaveError);
    } finally {
      setIsLeaving(false);
    }
  };

  if (error || !liveClubData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E10] text-white">
        <h1 className="text-xl font-semibold">{error || 'Club not found'}</h1>
      </div>
    );
  }

  if (currentUser?.id && membershipState === 'checking' && !isCreator) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0E0E10] text-center text-white">
        <div className="mb-6 h-14 w-14 animate-spin rounded-full border-2 border-transparent border-t-[#E0FE10] border-r-[#E0FE10]" />
        <p className="text-lg font-semibold">Opening your club...</p>
      </div>
    );
  }

  if (isMember) {
    return (
      <ClubMemberApp
        clubData={liveClubData}
        creatorData={creatorData}
        currentUser={currentUser!}
        totalWorkoutsCompleted={totalWorkoutsCompleted}
        allRounds={allRounds}
        isCreator={isCreator}
        onLeave={isCreator ? undefined : handleLeave}
        isLeaving={isLeaving}
      />
    );
  }

  return (
    <div className="relative">
      {isUserLoading && currentUser ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60 backdrop-blur-xl">
          Loading membership...
        </div>
      ) : null}

      <ClubPublicLanding
        clubData={liveClubData}
        creatorData={creatorData}
        totalWorkoutsCompleted={totalWorkoutsCompleted}
        allRounds={allRounds}
        onJoin={handleJoin}
        isJoining={isJoining}
      />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<ClubLandingPageProps> = async ({ params, res, req, query }) => {
  const id = params?.id as string | undefined;
  const forceWeb = query.web === '1';

  if (id && !forceWeb && isMobileRequest(req)) {
    return {
      redirect: {
        destination: buildInstallRedirectUrl(id, query),
        permanent: false,
      },
    };
  }

  const props = await fetchClubLandingPageProps({ clubId: id, res });
  return { props };
};

export default ClubPage;
