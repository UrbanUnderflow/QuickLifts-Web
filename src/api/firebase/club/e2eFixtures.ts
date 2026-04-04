import type { ClubLandingPageProps, RoundPreview } from './landingPage';

const isClubLandingFixtureEnabled = (): boolean => process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';

const E2E_HERO_IMAGE = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop';
const E2E_LOGO_IMAGE = 'https://images.unsplash.com/photo-1541534401786-2077eed87a72?q=80&w=800&auto=format&fit=crop';

const E2E_ROUNDS: RoundPreview[] = [
  {
    id: 'e2e-round-strength',
    title: 'Launch Week Strength',
    subtitle: 'A guided strength block built for creator club momentum.',
    workoutCount: 12,
    participantCount: 84,
    isActive: true,
  },
  {
    id: 'e2e-round-hyrox',
    title: 'Cardio Builder',
    subtitle: 'Intervals, leaderboard energy, and a clean handoff into the app.',
    workoutCount: 8,
    participantCount: 57,
    isActive: true,
  },
  {
    id: 'e2e-round-recovery',
    title: 'Recovery Reset',
    subtitle: 'Mobility and recovery sessions for members coming in mid-cycle.',
    workoutCount: 5,
    participantCount: 36,
    isActive: false,
  },
];

export const getClubLandingPageFixture = ({
  clubId,
  fixtureName,
}: {
  clubId?: string;
  fixtureName?: string | null;
}): ClubLandingPageProps | null => {
  if (!isClubLandingFixtureEnabled()) {
    return null;
  }

  if (fixtureName !== 'creator-club-install') {
    return null;
  }

  const resolvedClubId = clubId || 'e2e-creator-club';

  return {
    clubData: {
      id: resolvedClubId,
      name: 'E2E Creator Club',
      description: 'A premium creator club designed to validate mobile install-first onboarding.',
      coverImageURL: E2E_HERO_IMAGE,
      logoURL: E2E_LOGO_IMAGE,
      creatorId: 'e2e-creator',
      creatorInfo: {
        id: 'e2e-creator',
        displayName: 'Coach Nova',
        username: 'coachnova',
      },
      memberCount: 128,
      accentColor: '#22D3EE',
      secondaryColor: '#0B1120',
      pinnedRoundIds: ['e2e-round-strength'],
      features: {},
      tagline: 'Train together. Stay locked in. Open the club in Pulse.',
      clubType: 'creator',
      landingPageConfig: {
        heroTitle: 'E2E Creator Club',
        heroSubtitle: 'Install Pulse to unlock the creator club experience on your phone.',
        heroImage: E2E_HERO_IMAGE,
        aboutText: 'This fixture mirrors the branded install-first creator club path we want for mobile shares.',
        features: ['Chat', 'Challenges', 'Leaderboard', 'Community'],
      },
    },
    creatorData: {
      id: 'e2e-creator',
      displayName: 'Coach Nova',
      username: 'coachnova',
      profileImage: {
        profileImageURL: E2E_LOGO_IMAGE,
      },
    },
    totalWorkoutsCompleted: 482,
    allRounds: E2E_ROUNDS,
  };
};
