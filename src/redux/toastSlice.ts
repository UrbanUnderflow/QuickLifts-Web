import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the shape of the toast state
interface ToastState {
  isVisible: boolean;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning' | 'award';
  duration: number; // Duration in milliseconds
}

// Define the initial state
const initialState: ToastState = {
  isVisible: false,
  message: '',
  type: 'info', // Default type
  duration: 3000, // Default duration 3 seconds
};

// Define payload structure for showing the toast
interface ShowToastPayload {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning' | 'award';
  duration?: number;
}

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    // Action to show the toast
    showToast: (state, action: PayloadAction<ShowToastPayload>) => {
      state.message = action.payload.message;
      state.type = action.payload.type ?? initialState.type; // Use default if not provided
      state.duration = action.payload.duration ?? initialState.duration; // Use default if not provided
      state.isVisible = true;
    },
    // Action to hide the toast
    hideToast: (state) => {
      state.isVisible = false;
      // Optionally reset message/type when hiding
      // state.message = '';
      // state.type = 'info';
    },
  },
});

// Export the actions
export const { showToast, hideToast } = toastSlice.actions;

// Export the reducer
export default toastSlice.reducer; 