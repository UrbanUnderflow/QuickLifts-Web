// BottomNav.tsx

import React from 'react';
import { SelectedRootTabs } from '../../types/DashboardTypes';
import { useUser } from '../../hooks/useUser'; // Import useUser hook
import { useRouter } from 'next/navigation';

interface BottomNavProps {
  selectedTab: SelectedRootTabs;
  onTabChange: (tab: SelectedRootTabs) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ selectedTab, onTabChange }) => {
  // Log which tabs we're hiding
  console.log('[BottomNav] Hiding Search and Messages tabs');

  const currentUser = useUser(); // Use the hook
  const router = useRouter();

  const allTabs = [
    {
      id: SelectedRootTabs.Discover,
      label: 'Discover',
      icon: '/discover-icon.svg',
      selectedIcon: '/discover-icon-selected.svg',
    },
    {
      id: SelectedRootTabs.Search,
      label: 'Search',
      icon: '/search-icon.svg',
      selectedIcon: '/search-icon-selected.svg',
      hidden: true, // Hide Search tab
    },
    {
      id: SelectedRootTabs.Create,
      label: '',
      icon: '/create-icon.svg',
      selectedIcon: '/create-icon.svg',
    },
    {
      id: SelectedRootTabs.Messages,
      label: 'Message',
      icon: '/message-icon.svg',
      selectedIcon: '/message-icon-selected.svg',
      hidden: true, // Hide Messages tab
    },
    {
      id: SelectedRootTabs.Profile,
      label: 'Profile',
      // We'll treat the icon/selectedIcon as backups 
      // (in case userService.currentUser is null).
      icon: '/profile-icon.svg',
      selectedIcon: '/profile-icon-selected.svg',
      href: '#', 
      current: selectedTab === SelectedRootTabs.Profile, 
      showUsername: !!currentUser?.username, 
      username: currentUser?.username || ''
    },
  ];

  // Filter out hidden tabs
  const tabs = allTabs.filter(tab => !tab.hidden);

  // Function to determine if Profile tab should be rendered
  const shouldRenderProfileTab = () => {
    const currentUser = useUser(); // Use the hook again for consistency
    return currentUser && currentUser.username;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-800/80 backdrop-blur-sm border-t border-zinc-700">
      <div className="max-w-md mx-auto px-8 py-4 flex justify-between items-center">
        {tabs.map((tab) => {
          const isSelected = selectedTab === tab.id;

          // If this is the Profile tab, we might want to show the user's actual photo
          const isProfileTab = (tab.id === SelectedRootTabs.Profile);

          // Attempt to fetch current user's image
          const hasProfileImage =
            currentUser &&
            currentUser.profileImage &&
            currentUser.profileImage.profileImageURL;

          return (
            <button
              key={tab.id}
              className="flex flex-col items-center gap-1"
              onClick={() => onTabChange(tab.id)}
            >
              {tab.id === SelectedRootTabs.Create ? (
                // Center "Create" button with highlight
                <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center -mt-6">
                  <img src={tab.icon} alt={tab.label} className="w-6 h-6" />
                </div>
              ) : (
                <>
                  {/* If this is the Profile tab and we have a user image, show it */}
                 {isProfileTab && hasProfileImage ? (
                    <img
                        src={currentUser.profileImage.profileImageURL}
                        alt="User profile"
                        className={`w-6 h-6 rounded-full object-cover
                        ${isSelected ? 'ring-2 ring-[#E0FE10]' : ''}
                        `}
                        onError={(e) => {
                        console.error('Error loading profile image:', e);
                        e.currentTarget.src = tab.icon; // Fallback to default icon
                        }}
                    />
                    ) : (
                    <img
                        src={isSelected ? tab.selectedIcon : tab.icon}
                        alt={tab.label}
                        className="w-6 h-6"
                    />
                    )}

                  {/* Label or blank if it's the "Create" tab */}
                  {tab.label && (
                    <span
                      className={`text-xs ${
                        isSelected ? 'text-[#E0FE10]' : 'text-zinc-400'
                      }`}
                    >
                      {tab.label}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;