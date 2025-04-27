import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the shape of the loading state
interface LoadingState {
  isLoading: boolean;
  message: string | null; // Optional message to display
}

// Define the initial state
const initialState: LoadingState = {
  isLoading: false,
  message: null,
};

// Define payload structure for showing the loader (optional message)
interface ShowLoaderPayload {
  message?: string;
}

const loadingSlice = createSlice({
  name: 'loading',
  initialState,
  reducers: {
    // Action to show the loader
    showLoader: (state, action: PayloadAction<ShowLoaderPayload | undefined>) => {
      state.isLoading = true;
      state.message = action?.payload?.message ?? 'Loading...'; // Default message if no payload or no message in payload
    },
    // Action to hide the loader
    hideLoader: (state) => {
      state.isLoading = false;
      state.message = null; // Clear message on hide
    },
  },
});

// Export the actions
export const { showLoader, hideLoader } = loadingSlice.actions;

// Export the reducer
export default loadingSlice.reducer; 