/**
 * Simple trigger so HabitManagementScreen knows to refetch when Add/Edit/Delete habit screens have made changes.
 * Avoids full reload on every tab focus while still refreshing when the list has changed.
 */
let refreshTrigger = 0;

export function requestHabitsRefresh() {
  refreshTrigger += 1;
}

export function getHabitsRefreshTrigger() {
  return refreshTrigger;
}
