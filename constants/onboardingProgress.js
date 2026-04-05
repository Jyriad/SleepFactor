/**
 * Single ordered list of onboarding “steps” for progress UI (not every stack route).
 * Education counts as 4 steps (one per mini-slide).
 */
export const ONBOARDING_TOTAL_STEPS = 16;

/** @type {Record<string, number | { type: 'education' }>} */
export const ONBOARDING_ROUTE_STEP = {
  OnboardingIntroStat: 1,
  OnboardingGoalQuiz: 2,
  OnboardingHowSleepFactorWorks: 3,
  OnboardingHowSleepFactorPlot: 4,
  OnboardingLetsGetSetup: 5,
  OnboardingHealthLab: 6,
  OnboardingConnectedSuccess: 7,
  OnboardingNewBeginning: 8,
  OnboardingStarterHabits: 9,
  OnboardingWearableMetrics: 10,
  OnboardingSleepFactorEducation: { type: 'education' },
  OnboardingNotification: 15,
  OnboardingClosing: 16,
};

/**
 * @param {string} routeName
 * @param {{ educationSlideIndex?: number }} [opts] 0-based index for OnboardingSleepFactorEducation (0..3)
 * @returns {{ currentStep: number, totalSteps: number, progress: number }}
 */
export function getOnboardingProgress(routeName, opts = {}) {
  const totalSteps = ONBOARDING_TOTAL_STEPS;
  const entry = ONBOARDING_ROUTE_STEP[routeName];
  if (entry == null) {
    return { currentStep: 1, totalSteps, progress: 1 / totalSteps };
  }
  if (typeof entry === 'object' && entry.type === 'education') {
    const i = Math.min(Math.max(opts.educationSlideIndex ?? 0, 0), 3);
    const currentStep = 11 + i;
    return { currentStep, totalSteps, progress: currentStep / totalSteps };
  }
  return { currentStep: entry, totalSteps, progress: entry / totalSteps };
}
