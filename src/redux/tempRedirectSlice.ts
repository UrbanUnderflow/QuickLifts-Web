import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TempRedirectState {
  roundIdRedirect: string | null;
  loginRedirectPath: string | null;
}

const initialState: TempRedirectState = {
  roundIdRedirect: null,
  loginRedirectPath: null,
};

const tempRedirectSlice = createSlice({
  name: 'tempRedirect',
  initialState,
  reducers: {
    setRoundIdRedirect(state, action: PayloadAction<string>) {
      state.roundIdRedirect = action.payload;
      state.loginRedirectPath = null;
      console.log('[tempRedirectSlice] Set roundIdRedirect:', action.payload);
    },
    clearRoundIdRedirect(state) {
      state.roundIdRedirect = null;
      console.log('[tempRedirectSlice] Cleared roundIdRedirect');
    },
    setLoginRedirectPath(state, action: PayloadAction<string>) {
      state.loginRedirectPath = action.payload;
      console.log('[tempRedirectSlice] Set loginRedirectPath:', action.payload);
    },
    clearLoginRedirectPath(state) {
      state.loginRedirectPath = null;
      console.log('[tempRedirectSlice] Cleared loginRedirectPath');
    },
  },
});

export const {
  setRoundIdRedirect,
  clearRoundIdRedirect,
  setLoginRedirectPath,
  clearLoginRedirectPath,
} = tempRedirectSlice.actions;

export default tempRedirectSlice.reducer; 