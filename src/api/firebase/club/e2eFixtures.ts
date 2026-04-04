import type { ClubLandingPageProps, RoundPreview } from './landingPage';

const isClubLandingFixtureEnabled = (): boolean => process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';

const E2E_HERO_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/quicklifts-dd3f1.appspot.com/o/groupChat%2F07DKCy5qnETYlmwn49NOupCsWKa2%2F83ADC15C-DBBE-4F67-BE2B-0E627709264F.jpg?alt=media&token=dcd172b6-20d1-431b-971c-4c732b096983';
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
      name: 'Fitness With Benefits(FWB)',
      description:
        'A social track club built to elevate your workouts and connect you with motivated peers. Expert guidance, social accountability, and results-driven challenges - all in one app.',
      coverImageURL: E2E_HERO_IMAGE,
      logoURL: E2E_LOGO_IMAGE,
      creatorId: 'e2e-creator',
      creatorInfo: {
        id: 'e2e-creator',
        displayName: 'Nile Jones',
        username: 'nilejones1',
      },
      memberCount: 1,
      accentColor: '#FF6B35',
      secondaryColor: '#0B1120',
      pinnedRoundIds: ['e2e-round-strength'],
      features: {},
      tagline: 'Fitness with the benefit of community',
      clubType: 'trackClub',
      landingPageConfig: {
        heroTitle: 'Fitness With Benefits(FWB)',
        heroSubtitle: 'Fitness with the benefit of community',
        heroImage: E2E_HERO_IMAGE,
        aboutText:
          'A social track club built to elevate your workouts and connect you with motivated peers. Expert guidance, social accountability, and results-driven challenges - all in one app.',
        features: ['Chat', 'Challenges', 'Leaderboard', 'Community'],
      },
    },
    creatorData: {
      id: 'e2e-creator',
      displayName: 'Nile Jones',
      username: 'nilejones1',
      profileImage: {
        profileImageURL: E2E_LOGO_IMAGE,
      },
    },
    totalWorkoutsCompleted: 1,
    allRounds: E2E_ROUNDS,
  };
};
