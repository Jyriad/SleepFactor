/**
 * Format a Date (or ISO string) as local HH:MM for time-type habit logs.
 * @param {Date|string} dateInput
 * @returns {string}
 */
export function formatLocalTimeHHMM(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
}

/**
 * Calendar date (YYYY-MM-DD) for a timestamp in local timezone.
 * @param {Date|string} dateInput
 * @returns {string}
 */
export function localCalendarDateFromTimestamp(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${y}-${pad(mo)}-${pad(day)}`;
}
