import React, { useEffect } from 'react';
import Head from 'next/head';
import PageHead from '../PageHead';
import { ClubLandingPageProps, RoundPreview } from '../../api/firebase/club/landingPage';
import ClubInvitePage, { ClubInvite } from './ClubInvitePage';
import { CLUB_TYPE_LABELS } from './theme';
import {
  buildClubAppDeepLink,
  buildClubInstallPath,
  buildClubOneLink,
  buildClubWebFallbackUrl,
} from '../../utils/clubLinks';
import { appLinks, openIOSAppOrStore, platformDetection } from '../../utils/platformDetection';
import {
  trackClubInstallPageViewed,
  trackClubInstallStoreTapped,
  trackClubOpenInAppTapped,
  trackClubShareLinkCopied,
} from '../../lib/clubShareAnalytics';

type ClubData = NonNullable<ClubLandingPageProps['clubData']>;

type ClubInstallLandingProps = {
  clubData: ClubData;
  creatorData?: ClubLandingPageProps['creatorData'];
  totalWorkoutsCompleted?: number;
  allRounds?: RoundPreview[];
  pageUrl: string;
  sharedBy?: string | null;
  eventId?: string | null;
};

const DEFAULT_FWB_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/groupChat%2F07DKCy5qnETYlmwn49NOupCsWKa2%2F83ADC15C-DBBE-4F67-BE2B-0E627709264F.jpg?alt=media&token=dcd172b6-20d1-431b-971c-4c732b096983';

const buildNameLines = (name: string): Pick<ClubInvite, 'nameLine1' | 'nameLine2'> => {
  const normalizedName = (name || '').trim();
  if (!normalizedName) {
    return {
      nameLine1: 'Pulse',
      nameLine2: 'Club',
    };
  }

  const explicitLines = normalizedName
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (explicitLines.length >= 2) {
    return {
      nameLine1: explicitLines[0],
      nameLine2: explicitLines.slice(1).join(' '),
    };
  }

  if (normalizedName === 'Fitness With Benefits(FWB)') {
    return {
      nameLine1: 'Fitness With',
      nameLine2: 'Benefits(FWB)',
    };
  }

  const words = normalizedName.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return {
      nameLine1: normalizedName,
      nameLine2: '',
    };
  }

  const splitIndex = Math.ceil(words.length / 2);
  return {
    nameLine1: words.slice(0, splitIndex).join(' '),
    nameLine2: words.slice(splitIndex).join(' '),
  };
};

const buildInitials = (displayName: string): string => {
  const parts = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return 'PC';
  }

  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const buildCreatorUsername = (creatorData?: ClubLandingPageProps['creatorData'], clubData?: ClubData): string => {
  const rawUsername =
    creatorData?.username ||
    creatorData?.displayName ||
    clubData?.creatorInfo?.username ||
    clubData?.creatorInfo?.displayName ||
    'pulseclub';

  return rawUsername.replace(/^@/, '').trim() || 'pulseclub';
};

const ClubInstallLanding: React.FC<ClubInstallLandingProps> = ({
  clubData,
  creatorData,
  totalWorkoutsCompleted = 0,
  allRounds = [],
  pageUrl,
  sharedBy,
  eventId,
}) => {
  const config = clubData.landingPageConfig || {};
  const clubName = config.heroTitle || clubData.name || 'Pulse Club';
  const { nameLine1, nameLine2 } = buildNameLines(clubName);
  const creatorDisplayName =
    creatorData?.displayName ||
    creatorData?.username ||
    clubData.creatorInfo?.displayName ||
    clubData.creatorInfo?.username ||
    'Pulse Coach';
  const creatorUsername = buildCreatorUsername(creatorData, clubData);
  const creatorInitials = buildInitials(creatorDisplayName);
  const accentColor = clubData.accentColor || '#FF6B35';
  const coverImageURL = config.heroImage || clubData.coverImageURL || DEFAULT_FWB_IMAGE;
  const tagline = clubData.tagline || 'Fitness with the benefit of community';
  const description =
    config.aboutText ||
    clubData.description ||
    'A social track club built to elevate your workouts and connect you with motivated peers. Expert guidance, social accountability, and results-driven challenges - all in one app.';
  const clubType =
    CLUB_TYPE_LABELS[clubData.clubType || ''] ||
    (typeof clubData.clubType === 'string' && clubData.clubType.trim()) ||
    'Track Club';
  const workoutsCompleted = Math.max(
    1,
    totalWorkoutsCompleted || allRounds.reduce((count, round) => count + (round.workoutCount || 0), 0)
  );

  const installFallbackPath = buildClubInstallPath(clubData.id, {
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
    web: true,
  });

  const shareInviteDeepLink = buildClubOneLink({
    clubId: clubData.id,
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
    fallbackPath: installFallbackPath,
    pid: 'creator_club_install',
    campaign: 'creator_club_install',
    title: `Join ${clubName} on Pulse`,
    description: tagline,
    imageUrl: coverImageURL,
  });
  const openInviteDeepLink = buildClubOneLink({
    sharedBy: sharedBy || undefined,
    clubId: clubData.id,
    eventId: eventId || undefined,
    fallbackPath: null,
    pid: 'creator_club_install_open',
    campaign: 'creator_club_install_open',
    title: `Join ${clubName} on Pulse`,
    description: tagline,
    imageUrl: coverImageURL,
  });
  const appDeepLink = buildClubAppDeepLink(clubData.id, {
    sharedBy: sharedBy || undefined,
    eventId: eventId || undefined,
  });

  const clubInvite: ClubInvite = {
    name: clubName,
    nameLine1,
    nameLine2,
    tagline,
    description,
    coverImageURL,
    accentColor,
    clubType,
    memberCount: Math.max(1, clubData.memberCount ?? 1),
    workoutsCompleted,
    creatorDisplayName,
    creatorUsername,
    creatorInitials,
    inviteDeepLink: shareInviteDeepLink,
    openInviteDeepLink,
    webFallbackURL: buildClubWebFallbackUrl(clubData.id, {
      sharedBy: sharedBy || undefined,
      eventId: eventId || undefined,
    }),
  };

  useEffect(() => {
    trackClubInstallPageViewed({
      clubId: clubData.id,
      sharedBy,
      eventId,
      source: 'club_install_page',
      platform: platformDetection.getPlatform(),
    });
  }, [clubData.id, eventId, sharedBy]);

  const handleStoreTap = (store: 'ios' | 'android') => {
    trackClubInstallStoreTapped(
      {
        clubId: clubData.id,
        sharedBy,
        eventId,
        source: 'club_install_page',
        platform: platformDetection.getPlatform(),
      },
      store
    );
  };

  const handleOpenInvite = () => {
    const platform = platformDetection.getPlatform();

    trackClubOpenInAppTapped({
      clubId: clubData.id,
      sharedBy,
      eventId,
      source: 'club_install_page',
      platform,
    });

    if (typeof window !== 'undefined') {
      if (platform === 'ios') {
        openIOSAppOrStore(appDeepLink, appLinks.appStoreUrl);
        return;
      }

      window.location.href = platform === 'desktop' ? clubInvite.inviteDeepLink : clubInvite.openInviteDeepLink || clubInvite.inviteDeepLink;
    }
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: clubInvite.name,
          text: `Join ${clubInvite.name} on Pulse.`,
          url: shareInviteDeepLink,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareInviteDeepLink);
      }

      trackClubShareLinkCopied({
        clubId: clubData.id,
        sharedBy,
        eventId,
        source: 'club_install_page_share',
        platform: platformDetection.getPlatform(),
      });
    } catch (error) {
      console.error('[ClubInstallLanding] Failed to share invite link:', error);
    }
  };

  return (
    <>
      <Head>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <PageHead
        themeColor="#080808"
        pageOgUrl={pageUrl}
        metaData={{
          pageId: clubData.id,
          pageTitle: `${clubInvite.name} | Join on Pulse`,
          metaDescription: `Open Pulse to join ${clubInvite.name}.`,
          ogTitle: `${clubInvite.name} | Join on Pulse`,
          ogDescription: clubInvite.tagline,
          ogImage: clubInvite.coverImageURL,
          ogUrl: pageUrl,
          twitterTitle: `${clubInvite.name} | Join on Pulse`,
          twitterDescription: clubInvite.tagline,
          twitterImage: clubInvite.coverImageURL,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgImage={clubInvite.coverImageURL}
      />

      <ClubInvitePage
        club={clubInvite}
        onOpenInvite={handleOpenInvite}
        onShare={handleShare}
        onStoreTap={handleStoreTap}
      />
    </>
  );
};

export default ClubInstallLanding;
