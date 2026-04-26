/**
 * Single ordered list of onboarding “steps” for progress UI (not every stack route).
 * Education is one step with progressive reveal cards.
 */
export const ONBOARDING_TOTAL_STEPS = 15;

/** @type {Record<string, number | { type: 'education' }>} */
export const ONBOARDING_ROUTE_STEP = {
  OnboardingIntroStat: 1,
  OnboardingGoalQuiz: 2,
  OnboardingHowSleepFactorWorks: 3,
  OnboardingHowSleepFactorPlot: 4,
  OnboardingLetsGetSetup: 5,
  OnboardingHealthLab: 6,
  OnboardingConnectedSuccess: 7,
  OnboardingNewBeginning: 7,
  OnboardingHabitTypes: 8,
  OnboardingStarterHabits: 9,
  OnboardingSubjectiveMeasures: 10,
  OnboardingWearableMetrics: 11,
  OnboardingPreferences: 12,
  OnboardingSleepFactorEducation: 12,
  OnboardingInsightFound: 13,
  OnboardingNotification: 14,
  OnboardingClosing: 15,
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
  return { currentStep: entry, totalSteps, progress: entry / totalSteps };
}
