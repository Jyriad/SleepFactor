/**
 * Dev-only sleep diagnostics. Filter Metro / Xcode log for: [SleepDebug]
 */

export function sleepDebugLog(phase, payload) {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  try {
    console.log('[SleepDebug]', phase, payload);
  } catch (_) {}
}
