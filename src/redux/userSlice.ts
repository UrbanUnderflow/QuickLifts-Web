import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  currentUser: Record<string, any> | null; // Dictionary representation
  loading: boolean;
}

const initialState: UserState = {
  currentUser: null,
  loading: true,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<any>) => {
      const userData = action.payload;
      if (userData && typeof userData.toDictionary === 'function') {
        // If it looks like our User class instance, convert it
        console.warn('[userSlice] setUser received a User instance, converting to dictionary.');
        state.currentUser = userData.toDictionary();
      } else {
        // Otherwise, assume it's already a plain object or null
        state.currentUser = userData;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    clearUser: (state) => {
      state.currentUser = null;
      state.loading = false;
    },
  },
});

export const { setUser, setLoading, clearUser } = userSlice.actions;
export default userSlice.reducer;