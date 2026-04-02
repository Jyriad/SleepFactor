/**
 * Max gap between sleep segments (classified stages) to still treat as one session.
 * Used for HealthKit clustering and Health Connect stage splitting so stitched nights
 * from third-party sync don't inflate a single row.
 */
export const SLEEP_SESSION_GAP_MS = 90 * 60 * 1000;
