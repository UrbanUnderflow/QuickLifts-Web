
import React from 'react';
import { SelectedRootTabs } from '../../types/DashboardTypes';

interface BottomNavProps {
    selectedTab: SelectedRootTabs;
    onTabChange: (tab: SelectedRootTabs) => void;
  }
  
  const BottomNav: React.FC<BottomNavProps> = ({ selectedTab, onTabChange }) => {
    const tabs = [
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
      },
      {
        id: SelectedRootTabs.Create,
        label: '',
        icon: '/create-icon.svg',
        selectedIcon: '/create-icon.svg',
      },
      {
        id: SelectedRootTabs.Message,
        label: 'Message',
        icon: '/message-icon.svg',
        selectedIcon: '/message-icon-selected.svg',
      },
      {
        id: SelectedRootTabs.Profile,
        label: 'Profile',
        icon: '/profile-icon.svg',
        selectedIcon: '/profile-icon-selected.svg',
      },
    ];
  
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-800/80 backdrop-blur-sm border-t border-zinc-700">
        <div className="max-w-md mx-auto px-8 py-4 flex justify-between items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className="flex flex-col items-center gap-1"
              onClick={() => onTabChange(tab.id)}
            >
              {tab.id === SelectedRootTabs.Create ? (
                <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center -mt-6">
                  <img src={tab.icon} alt={tab.label} className="w-6 h-6" />
                </div>
              ) : (
                <>
                  <img
                    src={selectedTab === tab.id ? tab.selectedIcon : tab.icon}
                    alt={tab.label}
                    className="w-6 h-6"
                  />
                  <span className={`text-xs ${selectedTab === tab.id ? 'text-[#E0FE10]' : 'text-zinc-400'}`}>
                    {tab.label}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

export default BottomNav;