// utils/metrics.ts
export const retentionMatrix = [
  // Week 0 1 2 3 4 5 6 7
  [100, 78, 65, 58, 53, 50, 47, 45], // Jan cohort
  [100, 79, 67, 61, 57, 54, 51, 49], // Feb
  [100, 82, 70, 64, 59, 56, 53, 51], // Mar
  [100, 84, 72, 66, 61, 58, 55, 53], // Apr
  [100, 86, 74, 68, 63, 60, 57, 55], // May
];

export const kFactorSeries = [
  { month: 'Jan', k: 0.22 },
  { month: 'Feb', k: 0.34 },
  { month: 'Mar', k: 0.41 },
  { month: 'Apr', k: 0.49 },
  { month: 'May', k: 0.57 },
];

export const unitEconomics = [
  { month: 'Jan', cac: 14.2, payback: 7.8 },
  { month: 'Feb', cac: 12.1, payback: 6.5 },
  { month: 'Mar', cac: 10.4, payback: 5.6 },
  { month: 'Apr', cac: 9.7, payback: 4.9 },
  { month: 'May', cac: 9.2, payback: 4.4 },
]; 