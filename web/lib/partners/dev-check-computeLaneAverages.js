// dev-check-computeLaneAverages.js
//
// Standalone sanity check for the lane-average logic used by the
// partner onboarding dashboard. Run with:
//   cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
//   node web/lib/partners/dev-check-computeLaneAverages.js

const computeLaneAverages = (partners, lanes) =>
  lanes.map((lane) => {
    const lanePartners = partners
      .filter((p) => p.type === lane.type)
      .map((p) => {
        if (!p.firstRoundCreatedAt) return null;
        const msDiff = p.firstRoundCreatedAt.getTime() - p.invitedAt.getTime();
        if (msDiff <= 0) return 0;
        return msDiff / (1000 * 60 * 60 * 24);
      })
      .filter((v) => v != null && !Number.isNaN(v));

    if (lanePartners.length === 0) {
      return { label: lane.label, value: null };
    }

    const sum = lanePartners.reduce((acc, d) => acc + d, 0);
    return { label: lane.label, value: sum / lanePartners.length };
  });

const mkDate = (daysAgo) => {
  const now = new Date();
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
};

const partners = [
  {
    id: 'brand-1',
    name: 'brand@example.com',
    type: 'brand',
    onboardingStage: 'active',
    invitedAt: mkDate(10),
    firstRoundCreatedAt: mkDate(3),
  },
  {
    id: 'gym-1',
    name: 'gym@example.com',
    type: 'gym',
    onboardingStage: 'active',
    invitedAt: mkDate(5),
    firstRoundCreatedAt: mkDate(2),
  },
  {
    id: 'runclub-1',
    name: 'runclub@example.com',
    type: 'runClub',
    onboardingStage: 'invited',
    invitedAt: mkDate(4),
    firstRoundCreatedAt: null,
  },
];

const lanes = [
  { type: 'brand', label: 'Brand' },
  { type: 'gym', label: 'Gym' },
  { type: 'runClub', label: 'Run Club' },
];

const averages = computeLaneAverages(partners, lanes);
console.log('Lane averages (days):');
console.log(JSON.stringify(averages, null, 2));
