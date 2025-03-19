import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { User } from '../api/firebase/user/types';

export const useUser = (): User | null => {
  const userDict = useSelector((state: RootState) => state.user.currentUser);
  return userDict ? new User(userDict.id, userDict) : null;
};

export const useUserLoading = () => {
  return useSelector((state: RootState) => state.user.loading);
};