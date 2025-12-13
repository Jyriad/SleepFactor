// Date utility functions

/**
 * Format date for display (e.g., "Mon, July 20th")
 */
export const formatDate = (date) => {
  const d = new Date(date);
  const options = { weekday: 'short', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('en-US', options);
};

/**
 * Format date range for sleep night display
 * "Night of Mon, July 20th to Tuesday, July 21st"
 */
export const formatDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startOptions = { weekday: 'short', month: 'long', day: 'numeric' };
  const endOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  
  const startStr = start.toLocaleDateString('en-US', startOptions);
  const endStr = end.toLocaleDateString('en-US', endOptions);
  
  return `Night of ${startStr} to ${endStr}`;
};

/**
 * Get today's date as YYYY-MM-DD string
 */
export const getToday = () => {
  const today = new Date();
  return formatDateForDB(today);
};

/**
 * Format date as YYYY-MM-DD for database
 */
export const formatDateForDB = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if date is today
 */
export const isToday = (date) => {
  const today = getToday();
  const checkDate = typeof date === 'string' ? date : formatDateForDB(date);
  return today === checkDate;
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1, date2) => {
  const d1 = typeof date1 === 'string' ? date1 : formatDateForDB(date1);
  const d2 = typeof date2 === 'string' ? date2 : formatDateForDB(date2);
  return d1 === d2;
};

/**
 * Get array of dates for date selector
 * Returns array of { date: string, dayName: string, dayNumber: number }
 * Always returns 5 dates: today + 4 days before (today is always the last item)
 */
export const getDatesArray = () => {
  const today = new Date();
  const dates = [];
  
  // Get 4 days before today, then today (5 dates total)
  for (let i = -4; i <= 0; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = date.getDate();
    const dateStr = formatDateForDB(date);
    
    dates.push({
      date: dateStr,
      dayName,
      dayNumber,
      fullDate: date,
    });
  }
  
  return dates;
};

/**
 * Format date for date selector display (e.g., "Mon 20")
 */
export const formatDateSelector = (date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = d.getDate();
  return { dayName, dayNumber };
};

/**
 * Get yesterday's date as YYYY-MM-DD string
 */
export const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateForDB(yesterday);
};

/**
 * Format date for homepage title display
 * Returns "Today", "Yesterday", or "Mon 15 Jan" format
 */
export const formatDateTitle = (date) => {
  const dateStr = typeof date === 'string' ? date : formatDateForDB(date);
  const today = getToday();
  const yesterday = getYesterday();

  if (dateStr === today) {
    return 'Today';
  } else if (dateStr === yesterday) {
    return 'Yesterday';
  } else {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    return `${dayName} ${dayNumber} ${monthName}`;
  }
};

/**
 * Format time ago from a date
 * Returns human-readable time ago string (e.g., "2 hours ago", "just now")
 */
export const formatTimeAgo = (date) => {
  if (!date) return '';

  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    // For older dates, show the actual date
    return past.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
};

