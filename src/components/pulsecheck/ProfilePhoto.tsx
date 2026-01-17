import React from 'react';
import { useUser } from '../../hooks/useUser';
import { useRouter } from 'next/router';
import { SelectedRootTabs } from '../../types/DashboardTypes';
import { motion } from 'framer-motion';

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
    <motion.button
      onClick={handleProfileClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="relative group"
      aria-label="Go to profile"
    >
      {/* Glow effect on hover */}
      <div className="absolute -inset-1 rounded-full bg-[#E0FE10]/20 blur opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Profile container */}
      <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-[#E0FE10]/40 transition-all duration-200">
        {profileImageUrl ? (
          <>
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
            {/* Fallback initial (hidden by default) */}
            <div className="hidden absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {initial}
              </span>
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">
              {initial}
            </span>
          </div>
        )}
        
        {/* Inner shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
      </div>
      
      {/* Online indicator */}
      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#22C55E] border-2 border-[#0a0a0b] shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
    </motion.button>
  );
};

export default ProfilePhoto;
