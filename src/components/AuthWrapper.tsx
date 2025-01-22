import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { setUser, setLoading } from '../redux/userSlice';
import { userService } from '../api/firebase/user';

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const auth = getAuth();

  useEffect(() => {
    dispatch(setLoading(true));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const firestoreUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
          dispatch(setUser(firestoreUser));
          userService.currentUser = firestoreUser;
        } catch (error) {
          console.error('Error fetching user data:', error);
          dispatch(setUser(null));
        }
      } else {
        dispatch(setUser(null));
        userService.currentUser = null;
      }
      dispatch(setLoading(false));
    });

    return () => unsubscribe();
  }, [dispatch, auth]);

  return <>{children}</>;
};

export default AuthWrapper;