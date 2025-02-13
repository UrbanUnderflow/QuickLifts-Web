// src/redux/devModeSlice.ts
import { createSlice } from '@reduxjs/toolkit';

// Get initial state from localStorage if available
const getInitialState = () => {
  if (typeof window !== 'undefined') {
    const savedMode = window.localStorage.getItem('devMode');
    return {
      isDevelopment: savedMode ? JSON.parse(savedMode) : false
    };
  }
  return {
    isDevelopment: false
  };
};

const devModeSlice = createSlice({
  name: 'devMode',
  initialState: getInitialState(),
  reducers: {
    toggleDevMode: (state) => {
      state.isDevelopment = !state.isDevelopment;
      // Save to localStorage when toggled, only on client side
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('devMode', JSON.stringify(state.isDevelopment));
      }
    }
  }
});

export const { toggleDevMode } = devModeSlice.actions;
export default devModeSlice.reducer;