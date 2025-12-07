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
 */
export const getDatesArray = (startDate = null, days = 7) => {
  const start = startDate ? new Date(startDate) : new Date();
  const dates = [];
  
  for (let i = -3; i < days - 3; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    
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

