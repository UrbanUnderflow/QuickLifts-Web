// src/redux/devModeSlice.ts
import { createSlice } from '@reduxjs/toolkit';

// Get initial state from localStorage if available
const getInitialState = () => {
  if (typeof window !== 'undefined') {
    const savedMode = window.localStorage.getItem('devMode');
    return {
      isDevelopment: savedMode ? JSON.parse(savedMode) : false,
      dopplerConfig: savedMode ? 'dev_backend' : 'prd_backend'
    };
  }
  return {
    isDevelopment: false,
    dopplerConfig: 'prd_backend'
  };
};

const devModeSlice = createSlice({
  name: 'devMode',
  initialState: getInitialState(),
  reducers: {
    toggleDevMode: (state) => {
      state.isDevelopment = !state.isDevelopment;
      state.dopplerConfig = state.isDevelopment ? 'dev_backend' : 'prd_backend';
      
      // Save to localStorage when toggled, only on client side
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('devMode', JSON.stringify(state.isDevelopment));
        window.localStorage.setItem('dopplerConfig', state.dopplerConfig);
        
        // NOTE: Reload is now handled in the DevModeToggle component
        // to prevent double reloads and allow for proper Firebase initialization
      }
    }
  }
});

export const { toggleDevMode } = devModeSlice.actions;
export default devModeSlice.reducer;