import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../api/firebase/user';

interface UserState {
  currentUser: User | null;
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
    setUser: (state, action: PayloadAction<User | null>) => {
      state.currentUser = action.payload;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setUser, setLoading } = userSlice.actions;
export default userSlice.reducer;