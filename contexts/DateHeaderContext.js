import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const DateHeaderContext = createContext(null);

export function DateHeaderProvider({ children }) {
  const [selectedDate, setSelectedDateState] = useState(() => new Date());
  const [loggedDates, setLoggedDates] = useState([]);
  const [datesWithUnsavedChanges, setDatesWithUnsavedChanges] = useState([]);
  const [isHeaderExpanded, setHeaderExpanded] = useState(false);

  const setSelectedDate = useCallback((date) => {
    const dateObj = date instanceof Date ? date : new Date(date);
    setSelectedDateState(dateObj);
  }, []);

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      loggedDates,
      setLoggedDates,
      datesWithUnsavedChanges,
      setDatesWithUnsavedChanges,
      isHeaderExpanded,
      setHeaderExpanded,
    }),
    [
      selectedDate,
      setSelectedDate,
      loggedDates,
      setLoggedDates,
      datesWithUnsavedChanges,
      setDatesWithUnsavedChanges,
      isHeaderExpanded,
      setHeaderExpanded,
    ]
  );

  return (
    <DateHeaderContext.Provider value={value}>
      {children}
    </DateHeaderContext.Provider>
  );
}

export function useDateHeader() {
  const ctx = useContext(DateHeaderContext);
  if (!ctx) return null;
  return ctx;
}

export default DateHeaderContext;
