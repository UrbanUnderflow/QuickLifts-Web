// dev-check-filterPartnersByType.js
//
// Small standalone sanity check for the partner type filter logic.
// Run with:
//   cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
//   node web/lib/partners/dev-check-filterPartnersByType.js

const partners = [
  { id: '1', name: 'brand@example.com', type: 'brand', onboardingStage: 'active' },
  { id: '2', name: 'gym@example.com', type: 'gym', onboardingStage: 'active' },
  { id: '3', name: 'run@example.com', type: 'runClub', onboardingStage: 'invited' },
];

const filterPartnersByType = (rows, filter) => {
  if (filter === 'all') return rows;
  return rows.filter((p) => p.type === filter);
};

console.log('All:', filterPartnersByType(partners, 'all').map((p) => p.id));
console.log('Brand:', filterPartnersByType(partners, 'brand').map((p) => p.id));
console.log('Gym:', filterPartnersByType(partners, 'gym').map((p) => p.id));
console.log('Run Club:', filterPartnersByType(partners, 'runClub').map((p) => p.id));
