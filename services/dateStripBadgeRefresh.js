/**
 * Notifies DateHeader week-strip badges to refetch after habit or consumption logs change.
 */
import habitLoggedDatesService from './habitLoggedDatesService';

let refreshNonce = 0;
const listeners = new Set();

export function requestDateStripLoggedRefresh() {
  refreshNonce += 1;
  habitLoggedDatesService.invalidateStripCache();
  listeners.forEach((fn) => {
    try {
      fn(refreshNonce);
    } catch (_) {}
  });
}

export function getDateStripLoggedRefreshNonce() {
  return refreshNonce;
}

export function subscribeDateStripLoggedRefresh(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
