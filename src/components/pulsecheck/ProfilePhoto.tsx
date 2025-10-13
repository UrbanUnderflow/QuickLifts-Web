import React from 'react';
import { useUser } from '../../hooks/useUser';
import { useRouter } from 'next/router';
import { SelectedRootTabs } from '../../types/DashboardTypes';

interface ProfilePhotoProps {
  onTabChange?: (tab: SelectedRootTabs) => void;
}

const ProfilePhoto: React.FC<ProfilePhotoProps> = ({ onTabChange }) => {
  const currentUser = useUser();
  const router = useRouter();
  const currentPath = router.pathname;
  const isHomePage = currentPath === '/';

  const handleProfileClick = () => {
    if (isHomePage && onTabChange) {
      // If on home page, use tab navigation to show private profile
      onTabChange(SelectedRootTabs.Profile);
    } else {
      // Otherwise, navigate to home and trigger profile tab
      router.push('/');
      setTimeout(() => {
        // This will be picked up when the home page loads
        window.dispatchEvent(new CustomEvent('showProfile'));
      }, 100);
    }
  };

  if (!currentUser) return null;

  const profileImageUrl = currentUser.profileImage?.profileImageURL;
  const initial = currentUser.username?.[0]?.toUpperCase() || currentUser.displayName?.[0]?.toUpperCase() || 'U';

  return (
    <button
      onClick={handleProfileClick}
      className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-zinc-700 hover:ring-2 hover:ring-[#E0FE10] transition-all duration-200 flex-shrink-0 relative"
      aria-label="Go to profile"
    >
      {profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt="Profile"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to initial if image fails to load
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : (
        <span className="text-white text-sm font-semibold">
          {initial}
        </span>
      )}
      {profileImageUrl && (
        <span className="hidden text-white text-sm font-semibold">
          {initial}
        </span>
      )}
    </button>
  );
};

export default ProfilePhoto;

