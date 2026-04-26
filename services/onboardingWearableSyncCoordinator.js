import { enableSelectedMetrics } from './onboardingWearableMetricsService';

const syncJobsByUser = new Map();

export function startOnboardingWearableSync(userId, metrics) {
  if (!userId) return null;

  const existing = syncJobsByUser.get(userId);
  if (existing?.status === 'running') {
    return existing.promise;
  }

  const job = {
    status: 'running',
    result: null,
    startedAt: Date.now(),
    promise: null,
  };

  job.promise = (async () => {
    try {
      const result = await enableSelectedMetrics(userId, metrics);
      job.status = result?.success ? 'success' : 'failed';
      job.result = result;
      return result;
    } catch (error) {
      const result = {
        success: false,
        enabledCount: 0,
        metricSyncFailures: [],
        sleepSyncResult: {
          success: false,
          message: error?.message || 'Wearable onboarding sync failed',
        },
      };
      job.status = 'failed';
      job.result = result;
      return result;
    }
  })();

  syncJobsByUser.set(userId, job);
  return job.promise;
}

export function getOnboardingWearableSyncState(userId) {
  if (!userId) return null;
  const job = syncJobsByUser.get(userId);
  if (!job) return null;
  return {
    status: job.status,
    result: job.result,
    startedAt: job.startedAt,
  };
}

export async function waitForOnboardingWearableSync(userId, timeoutMs = 7000) {
  if (!userId) return null;
  const job = syncJobsByUser.get(userId);
  if (!job?.promise) return null;

  if (job.status !== 'running') return job.result;

  const timeoutResult = { timedOut: true };
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(timeoutResult), Math.max(250, timeoutMs));
  });

  const result = await Promise.race([job.promise, timeoutPromise]);
  return result === timeoutResult ? timeoutResult : result;
}
