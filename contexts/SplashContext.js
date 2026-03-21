import React, { createContext, useContext } from 'react';

const SplashContext = createContext(null);

export function useSplash() {
  const ctx = useContext(SplashContext);
  return ctx;
}

export default SplashContext;
