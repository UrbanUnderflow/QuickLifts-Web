import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../api/firebase/user';

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
  },
});

export const { setUser, setLoading } = userSlice.actions;
export default userSlice.reducer;