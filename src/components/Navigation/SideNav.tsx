import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { FaEnvelope, FaPlusSquare, FaBars, FaCog, FaSignOutAlt, FaInfoCircle, FaHome } from 'react-icons/fa';
import { useUser } from '../../hooks/useUser';
import { signOut } from '../../api/firebase/auth/methods';
import ProfilePhoto from '../pulsecheck/ProfilePhoto';
import { SelectedRootTabs } from '../../types/DashboardTypes';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  isActive?: boolean;
  onClick?: () => void;
}

interface SideNavProps {
  selectedTab?: SelectedRootTabs;
  onTabChange?: (tab: SelectedRootTabs) => void;
  onAbout?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, href, isActive, onClick }) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center gap-4 px-3 py-3 rounded-lg transition-colors w-full
        ${isActive 
          ? 'font-bold text-white' 
          : 'font-normal text-zinc-400 hover:text-white hover:bg-zinc-800/50'
        }
      `}
    >
      <span className={`text-2xl ${isActive ? 'scale-110' : ''} transition-transform flex items-center justify-center`}>
        {icon}
      </span>
      <span className="hidden lg:block text-base">
        {label}
      </span>
    </button>
  );
};

const SideNav: React.FC<SideNavProps> = ({ selectedTab, onTabChange, onAbout }) => {
  const router = useRouter();
  const currentPath = router.pathname;
  const currentUser = useUser();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isHomePage = currentPath === '/';
  const isPulseCheckPage = currentPath === '/PulseCheck';
  const isCreatePage = currentPath === '/create';

  // Define navigation items dynamically based on current page
  // When on PulseCheck, show Pulse in nav; when on Pulse, show PulseCheck in nav
  const navItems = isPulseCheckPage ? [
    // PulseCheck page navigation
    { 
      icon: <FaHome />, 
      label: 'Home', 
      href: '/PulseCheck',
      onClick: () => {
        router.push('/PulseCheck');
      }
    },
    { 
      icon: <FaEnvelope />, 
      label: 'Messages', 
      href: '/messages',
      tab: SelectedRootTabs.Messages
    },
    { 
      icon: <FaPlusSquare />, 
      label: 'Create',
      tab: SelectedRootTabs.Create,
      onClick: () => {
        router.push('/create');
      }
    },
  ] : [
    // Pulse/Home page navigation
    { 
      icon: <FaHome />, 
      label: 'Home', 
      href: '/',
      tab: SelectedRootTabs.Discover,
      onClick: () => {
        if (isCreatePage) {
          // On /create page, route directly to home
          router.push('/');
        } else if (onTabChange) {
          onTabChange(SelectedRootTabs.Discover);
        } else {
          router.push('/');
        }
      }
    },
    { 
      icon: <FaEnvelope />, 
      label: 'Messages', 
      href: '/messages',
      tab: SelectedRootTabs.Messages,
      onClick: () => {
        // Always route directly to messages page
        router.push('/messages');
      }
    },
    { 
      icon: <FaPlusSquare />, 
      label: 'Create',
      tab: SelectedRootTabs.Create,
      onClick: () => {
        if (isCreatePage) {
          // Already on create page, do nothing
          return;
        } else if (isHomePage && onTabChange) {
          onTabChange(SelectedRootTabs.Create);
        } else {
          // Route to /create page
          router.push('/create');
        }
      }
    },
  ];

  return (
    <>
      {/* Desktop Side Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-20 lg:w-64 border-r border-zinc-800 bg-black z-40 flex-col">
        {/* Logo/Brand */}
        <div className="p-6 mb-4">
          {/* Large screens: full logo */}
          <div className="hidden lg:block">
            <img 
              src={isPulseCheckPage ? '/pulseCheckIcon.png' : '/pulse-logo-white.svg'} 
              alt={isPulseCheckPage ? 'PulseCheck' : 'Pulse'} 
              className="h-8 w-auto" 
            />
          </div>
          {/* Small screens: icon only */}
          <div className="lg:hidden flex items-center justify-center">
            <img 
              src={isPulseCheckPage ? '/pulseCheckIcon.png' : '/pulseIcon.png'} 
              alt={isPulseCheckPage ? 'PulseCheck' : 'Pulse'} 
              className="w-8 h-8" 
            />
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 flex flex-col gap-1 px-3">
          {navItems.map((item, index) => {
            // Determine if this item is active
            const isActive = isCreatePage
              ? (item.tab === SelectedRootTabs.Create && currentPath === '/create') || currentPath === item.href
              : isHomePage && selectedTab && item.tab
              ? selectedTab === item.tab
              : currentPath === item.href;

            return (
              <NavItem
                key={item.href || index}
                icon={item.icon}
                label={item.label}
                href={item.href}
                isActive={isActive}
                onClick={item.onClick}
              />
            );
          })}
          
          {/* Profile Navigation Item */}
          {currentUser && (
            <button
              onClick={() => {
                if (isCreatePage) {
                  // On /create page, route to home and show profile
                  router.push('/');
                  setTimeout(() => {
                    if (onTabChange) onTabChange(SelectedRootTabs.Profile);
                  }, 100);
                } else if (isHomePage && onTabChange) {
                  onTabChange(SelectedRootTabs.Profile);
                } else {
                  // Navigate to home page and trigger profile tab
                  router.push('/');
                  setTimeout(() => {
                    if (onTabChange) onTabChange(SelectedRootTabs.Profile);
                  }, 100);
                }
              }}
              className={`
                flex items-center gap-4 px-3 py-3 rounded-lg transition-colors w-full
                ${isHomePage && selectedTab === SelectedRootTabs.Profile
                  ? 'font-bold text-white' 
                  : 'font-normal text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }
              `}
            >
              <span className="text-2xl flex items-center justify-center">
                {currentUser.profileImage?.profileImageURL ? (
                  <img
                    src={currentUser.profileImage.profileImageURL}
                    alt="Profile"
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                    <span className="text-white text-xs">
                      {currentUser.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </span>
              <span className="hidden lg:block text-base">
                Profile
              </span>
            </button>
          )}
        </div>

        {/* Bottom Section - More Menu */}
        <div className="p-3 border-t border-zinc-800 relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex items-center gap-4 px-3 py-3 rounded-lg transition-colors w-full text-zinc-400 hover:text-white hover:bg-zinc-800/50"
          >
            <FaBars className="text-2xl" />
            <span className="hidden lg:block text-base">More</span>
          </button>

          {/* More Dropdown Menu */}
          {showMoreMenu && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMoreMenu(false)}
              />
              
              {/* Menu */}
              <div className="absolute bottom-full left-3 mb-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                {/* App Switcher - Show opposite app */}
                <button
                  onClick={() => {
                    if (isPulseCheckPage) {
                      router.push('/');
                    } else {
                      router.push('/PulseCheck');
                    }
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <img 
                    src={isPulseCheckPage ? '/pulseIcon.png' : '/pulseCheckIcon.png'} 
                    alt={isPulseCheckPage ? 'Pulse' : 'PulseCheck'} 
                    className="w-5 h-5" 
                  />
                  <span>{isPulseCheckPage ? 'Pulse' : 'PulseCheck'}</span>
                </button>
                
                <div className="border-t border-zinc-800" />
                
                {onAbout && (
                  <>
                    <button
                      onClick={() => {
                        onAbout();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                    >
                      <FaInfoCircle className="text-xl" />
                      <span>About</span>
                    </button>
                    
                    <div className="border-t border-zinc-800" />
                  </>
                )}
                
                <button
                  onClick={() => {
                    router.push('/settings');
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <FaCog className="text-xl" />
                  <span>Settings</span>
                </button>
                
                <div className="border-t border-zinc-800" />
                
                <button
                  onClick={() => {
                    handleSignOut();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-zinc-800 transition-colors"
                >
                  <FaSignOutAlt className="text-xl" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-800 bg-black z-40 flex items-center justify-around px-2">
        {/* Home icon - goes to PulseCheck chat or Pulse Discover */}
        <button
          onClick={() => {
            if (isPulseCheckPage) {
              router.push('/PulseCheck');
            } else if (isCreatePage) {
              // On /create page, route directly to home
              router.push('/');
            } else if (onTabChange) {
              onTabChange(SelectedRootTabs.Discover);
            } else {
              router.push('/');
            }
          }}
          className={`flex flex-col items-center justify-center p-2 ${
            (isPulseCheckPage && currentPath === '/PulseCheck') || 
            (isHomePage && selectedTab === SelectedRootTabs.Discover)
              ? 'text-white' 
              : 'text-zinc-400'
          }`}
        >
          <FaHome className="text-2xl" />
        </button>
        
        <button
          onClick={() => {
            // Always route directly to messages page
            router.push('/messages');
          }}
          className={`flex flex-col items-center justify-center p-2 ${
            (isHomePage && selectedTab === SelectedRootTabs.Messages) || currentPath === '/messages'
              ? 'text-white' 
              : 'text-zinc-400'
          }`}
        >
          <FaEnvelope className="text-2xl" />
        </button>
        
        <button
          onClick={() => {
            if (isCreatePage) {
              // Already on create page, do nothing
              return;
            } else if (isHomePage && onTabChange) {
              onTabChange(SelectedRootTabs.Create);
            } else {
              // Route to /create page
              router.push('/create');
            }
          }}
          className={`flex flex-col items-center justify-center p-2 ${
            currentPath === '/create' || (isHomePage && selectedTab === SelectedRootTabs.Create)
              ? 'text-white' 
              : 'text-zinc-400'
          }`}
        >
          <FaPlusSquare className="text-2xl" />
        </button>
        
        <button
          onClick={() => {
            if (isCreatePage) {
              // On /create page, route to home and show profile
              router.push('/');
              setTimeout(() => {
                if (onTabChange) onTabChange(SelectedRootTabs.Profile);
              }, 100);
            } else if (isHomePage && onTabChange) {
              onTabChange(SelectedRootTabs.Profile);
            } else {
              // Navigate to home page and trigger profile tab
              router.push('/');
              setTimeout(() => {
                if (onTabChange) onTabChange(SelectedRootTabs.Profile);
              }, 100);
            }
          }}
          className="flex flex-col items-center justify-center p-2"
        >
          {currentUser?.profileImage?.profileImageURL ? (
            <img
              src={currentUser.profileImage.profileImageURL}
              alt="Profile"
              className={`w-8 h-8 rounded-full object-cover ${
                isHomePage && selectedTab === SelectedRootTabs.Profile ? 'ring-2 ring-[#E0FE10]' : ''
              }`}
            />
          ) : (
            <div className={`w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center ${
              isHomePage && selectedTab === SelectedRootTabs.Profile ? 'ring-2 ring-[#E0FE10]' : ''
            }`}>
              <span className="text-white text-sm">
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
        </button>
      </nav>
    </>
  );
};

export default SideNav;

