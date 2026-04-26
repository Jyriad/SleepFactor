/**
 * Demo scatter for onboarding: three batches of 7 days.
 * Week 1: broad, messy cloud with no obvious relationship yet.
 * Week 2: still noisy, with only a faint positive tendency.
 * Week 3: clearer positive pattern, but still with realistic outliers.
 */
export const WEEK1_DEMO = [
  { x: 1.4, y: 63 },
  { x: 2.7, y: 47 },
  { x: 3.5, y: 58 },
  { x: 4.6, y: 44 },
  { x: 5.8, y: 61 },
  { x: 7.0, y: 49 },
  { x: 8.2, y: 56 },
];

export const WEEK2_DEMO = [
  { x: 1.5, y: 48 },
  { x: 2.8, y: 55 },
  { x: 3.6, y: 50 },
  { x: 4.9, y: 58 },
  { x: 5.7, y: 53 },
  { x: 6.9, y: 61 },
  { x: 8.1, y: 57 },
];

export const WEEK3_DEMO = [
  { x: 1.4, y: 46 },
  { x: 2.7, y: 52 },
  { x: 3.5, y: 50 },
  { x: 4.8, y: 58 },
  { x: 5.9, y: 55 },
  { x: 7.0, y: 63 },
  { x: 8.2, y: 59 },
];

export const FULL_DEMO_POINTS = [...WEEK1_DEMO, ...WEEK2_DEMO, ...WEEK3_DEMO];
