import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../redux/store';
import { showToast } from '../redux/toastSlice';
import { User } from '../api/firebase/user';
import { userService } from '../api/firebase/user/service';
import SignInModal from './SignInModal';

interface FollowButtonProps {
  targetUser: User;
  onFollowSuccess?: (isFollowing: boolean) => void;
}

interface FollowStatus {
  isFollowing: boolean;
  status: string;
}

const FollowButton: React.FC<FollowButtonProps> = ({ targetUser, onFollowSuccess }) => {
  const dispatch = useDispatch();
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [followStatus, setFollowStatus] = useState<FollowStatus>({ isFollowing: false, status: 'notFollowing' });
  const [isLoading, setIsLoading] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'follow' | null>(null);

  // Fetch follow status when component mounts or currentUser changes
  useEffect(() => {
    const fetchFollowStatus = async () => {
      if (!currentUser || !targetUser || currentUser.id === targetUser.id) {
        return;
      }

      try {
        const result = await userService.getFollowStatus(targetUser.id);
        setFollowStatus({
          isFollowing: result.isFollowing,
          status: result.status
        });
      } catch (error) {
        console.error('Error fetching follow status:', error);
      }
    };

    fetchFollowStatus();
  }, [currentUser, targetUser]);

  const handleFollowClick = async () => {
    // If user is not signed in, show sign-in modal
    if (!currentUser) {
      setPendingAction('follow');
      setShowSignInModal(true);
      return;
    }

    // If user is trying to follow themselves, do nothing
    if (currentUser.id === targetUser.id) {
      return;
    }

    setIsLoading(true);

    try {
      const isCurrentlyFollowing = followStatus.isFollowing;
      
      if (isCurrentlyFollowing) {
        // Unfollow user
        await userService.unfollowUser(targetUser.id);
        setFollowStatus({
          isFollowing: false,
          status: 'notFollowing'
        });
        
        dispatch(showToast({
          message: `You unfollowed ${targetUser.displayName}`,
          type: 'success',
          duration: 3000
        }));
      } else {
        // Follow user
        await userService.followUser(targetUser);
        setFollowStatus({
          isFollowing: true,
          status: 'accepted'
        });
        
        dispatch(showToast({
          message: `You are now following ${targetUser.displayName}!`,
          type: 'success',
          duration: 3000
        }));
      }

      // Call success callback
      onFollowSuccess?.(!isCurrentlyFollowing);

    } catch (error) {
      console.error('Error updating follow status:', error);
      dispatch(showToast({
        message: 'Failed to update follow status. Please try again.',
        type: 'error',
        duration: 3000
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInSuccess = async () => {
    setShowSignInModal(false);
    
    // Show welcome toast
    dispatch(showToast({
      message: 'Welcome! You can now follow users.',
      type: 'success',
      duration: 3000
    }));
    
    // If there was a pending follow action, execute it after sign-in
    if (pendingAction === 'follow') {
      setPendingAction(null);
      // Wait a bit for the user state to update, then trigger follow
      setTimeout(() => {
        handleFollowClick();
      }, 1000); // Increased delay to let toast show first
    }
  };

  // Don't show button if viewing own profile
  if (currentUser && currentUser.id === targetUser.id) {
    return null;
  }

  const getButtonText = () => {
    if (isLoading) return 'Loading...';
    if (!currentUser) return 'Follow';
    if (followStatus.status === 'pending') return 'Pending';
    if (followStatus.isFollowing) return 'Following';
    return 'Follow';
  };

  const getButtonStyle = () => {
    const baseStyle = 'px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2';
    
    if (isLoading) {
      return `${baseStyle} bg-gray-600 text-gray-300 cursor-not-allowed`;
    }
    
    if (followStatus.isFollowing) {
      return `${baseStyle} bg-green-600 text-white hover:bg-green-700 border border-green-600`;
    }
    
    return `${baseStyle} bg-transparent text-white border border-gray-400 hover:bg-white hover:text-black`;
  };

  return (
    <>
      <button
        onClick={handleFollowClick}
        disabled={isLoading}
        className={getButtonStyle()}
      >
        {followStatus.isFollowing && (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {getButtonText()}
      </button>

      {showSignInModal && (
        <SignInModal
          isVisible={showSignInModal}
          onClose={() => {
            setShowSignInModal(false);
            setPendingAction(null);
          }}
          onSignInSuccess={handleSignInSuccess}
          onSignUpSuccess={handleSignInSuccess}
        />
      )}
    </>
  );
};

export default FollowButton;
