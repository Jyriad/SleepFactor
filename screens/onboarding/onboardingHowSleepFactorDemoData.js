/**
 * Demo scatter for onboarding: three batches of 7 days.
 * Week 1: wide cloud, no clear slope (not a fake “negative” diagonal).
 * Week 2: starts to suggest an upward relationship.
 * Week 3: clearer positive correlation, but points still vary (not glued to the line).
 */
export const WEEK1_DEMO = [
  { x: 1.4, y: 56 },
  { x: 8.5, y: 53 },
  { x: 2.3, y: 49 },
  { x: 7.2, y: 58 },
  { x: 4.6, y: 51 },
  { x: 5.9, y: 60 },
  { x: 3.1, y: 48 },
];

export const WEEK2_DEMO = [
  { x: 1.5, y: 47 },
  { x: 8.2, y: 78 },
  { x: 2.3, y: 52 },
  { x: 7.1, y: 73 },
  { x: 5.0, y: 63 },
  { x: 3.9, y: 57 },
  { x: 6.8, y: 71 },
];

export const WEEK3_DEMO = [
  { x: 4.2, y: 58 },
  { x: 5.8, y: 71 },
  { x: 3.2, y: 52 },
  { x: 7.9, y: 74 },
  { x: 6.2, y: 67 },
  { x: 2.1, y: 46 },
  { x: 8.2, y: 77 },
];

export const FULL_DEMO_POINTS = [...WEEK1_DEMO, ...WEEK2_DEMO, ...WEEK3_DEMO];
