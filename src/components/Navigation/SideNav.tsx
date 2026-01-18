import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { FaEnvelope, FaPlusSquare, FaBars, FaCog, FaSignOutAlt, FaInfoCircle, FaHome, FaUserTie, FaBrain, FaUsers, FaChartLine, FaUserFriends, FaInbox } from 'react-icons/fa';
import { useUser } from '../../hooks/useUser';
import { signOut } from '../../api/firebase/auth/methods';
import ProfilePhoto from '../pulsecheck/ProfilePhoto';
import { SelectedRootTabs } from '../../types/DashboardTypes';
import { motion, AnimatePresence } from 'framer-motion';

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
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full group
        ${isActive 
          ? 'text-white' 
          : 'text-zinc-400 hover:text-white'
        }
      `}
    >
      {/* Active indicator glow */}
      {isActive && (
        <motion.div 
          layoutId="activeNavGlow"
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(224,254,16,0.1), transparent)',
            border: '1px solid rgba(224,254,16,0.2)'
          }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}
      
      {/* Hover background */}
      <div className={`absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'hidden' : ''}`} />
      
      <span className={`relative text-2xl ${isActive ? 'text-[#E0FE10]' : ''} transition-colors flex items-center justify-center`}>
        {icon}
      </span>
      <span className="relative hidden lg:block text-base font-medium">
        {label}
      </span>
      
      {/* Active dot indicator for collapsed sidebar */}
      {isActive && (
        <motion.div 
          layoutId="activeNavDot"
          className="lg:hidden absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-[#E0FE10]"
        />
      )}
    </motion.button>
  );
};

const SideNav: React.FC<SideNavProps> = ({ selectedTab, onTabChange, onAbout }) => {
  const router = useRouter();
  const currentPath = router.pathname;
  const currentAsPath = router.asPath || router.pathname;
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
  // PulseCheck includes /PulseCheck, /PulseCheck/* and legacy /PulseCheckChat
  const isPulseCheckPage =
    currentAsPath.startsWith('/PulseCheck') ||
    currentPath.startsWith('/PulseCheck') ||
    currentAsPath.startsWith('/PulseCheckChat') ||
    currentPath === '/PulseCheckChat';
  const isCoachPage = currentAsPath.startsWith('/coach') || currentPath.startsWith('/coach');
  const isCreatePage = currentPath === '/create';
  const isPulseCheckNora = isPulseCheckPage && currentAsPath.includes('section=nora');

  // Define navigation items dynamically based on current page
  const navItems = isCoachPage ? [
    // Coach Dashboard navigation (Mental Training is in top tabs, not sidebar)
    { 
      icon: <FaUsers />, 
      label: 'Dashboard', 
      href: '/coach/dashboard',
      isActive: currentPath === '/coach/dashboard' || currentPath === '/coach/mental-training',
    },
    {
      icon: <FaUserFriends />,
      label: 'Referrals',
      href: '/coach/referrals',
      isActive: currentPath === '/coach/referrals',
    },
    {
      icon: <FaUserTie />,
      label: 'Staff',
      href: '/coach/staff',
      isActive: currentPath === '/coach/staff',
    },
    { 
      icon: <FaInbox />, 
      label: 'Inbox', 
      href: '/coach/inbox',
      isActive: currentPath === '/coach/inbox',
    },
  ] : isPulseCheckPage ? [
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
      icon: <FaBrain />,
      label: 'Nora',
      href: '/PulseCheck?section=nora',
      onClick: () => {
        router.push('/PulseCheck?section=nora');
      },
      isActive: isPulseCheckNora,
    },
    {
      icon: <FaUserTie />,
      label: 'Coach',
      href: '/coach/dashboard',
      onClick: () => {
        router.push('/coach/dashboard');
      },
      isActive: currentAsPath.startsWith('/coach'),
    },
    { 
      icon: <FaEnvelope />, 
      label: 'Messages', 
      href: '/messages',
      tab: SelectedRootTabs.Messages
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
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-20 lg:w-64 z-40 flex-col">
        {/* Solid dark background with chromatic edge */}
        <div className="absolute inset-0 bg-[#0d0d0f] border-r border-zinc-800/80">
          {/* Chromatic edge glow */}
          <div 
            className="absolute top-0 right-0 bottom-0 w-[1px]"
            style={{ 
              background: 'linear-gradient(180deg, rgba(224,254,16,0.4), rgba(59,130,246,0.25), rgba(139,92,246,0.2), transparent)' 
            }}
          />
        </div>
        
        {/* Logo/Brand */}
        <div className="relative p-6 mb-4">
          {/* Large screens: full logo with glow */}
          <div className="hidden lg:block">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="relative"
            >
              {/* Logo glow */}
              {(isPulseCheckPage || isCoachPage) && (
                <div className="absolute -inset-2 bg-[#E0FE10]/10 rounded-xl blur-xl" />
              )}
              {isCoachPage ? (
                <div className="relative flex items-center gap-2">
                  <img src="/pulseIcon.png" alt="Pulse" className="h-8 w-8" />
                  <span className="text-white font-bold text-lg">Coach</span>
                </div>
              ) : (
                <img 
                  src={isPulseCheckPage ? '/pulseCheckIcon.png' : '/pulse-logo-white.svg'} 
                  alt={isPulseCheckPage ? 'PulseCheck' : 'Pulse'} 
                  className="relative h-8 w-auto" 
                />
              )}
            </motion.div>
          </div>
          {/* Small screens: icon only */}
          <div className="lg:hidden flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              {/* Icon glow */}
              <div className="absolute -inset-2 bg-[#E0FE10]/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
              <img 
                src={isCoachPage ? '/pulseIcon.png' : isPulseCheckPage ? '/pulseCheckIcon.png' : '/pulseIcon.png'} 
                alt={isCoachPage ? 'Coach' : isPulseCheckPage ? 'PulseCheck' : 'Pulse'} 
                className="relative w-10 h-10" 
              />
            </motion.div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="relative flex-1 flex flex-col gap-1 px-3">
          {navItems.map((item, index) => {
            // Determine if this item is active
            const isActive =
              typeof (item as any).isActive === 'boolean'
                ? (item as any).isActive
                : isCreatePage
                ? (item.tab === SelectedRootTabs.Create && currentPath === '/create') || currentPath === item.href
                : isHomePage && selectedTab && item.tab
                ? selectedTab === item.tab
                : currentPath === item.href || currentAsPath === item.href;

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
            <motion.button
              onClick={() => {
                if (isCreatePage) {
                  // On /create page, deep-link to home with Profile selected (since onTabChange isn't available here)
                  router.push('/?tab=profile');
                } else if (isHomePage && onTabChange) {
                  onTabChange(SelectedRootTabs.Profile);
                } else {
                  // Navigate to home page and select Profile (query-based deep link works even without onTabChange)
                  router.push('/?tab=profile');
                }
              }}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`
                relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full group
                ${isHomePage && selectedTab === SelectedRootTabs.Profile
                  ? 'text-white' 
                  : 'text-zinc-400 hover:text-white'
                }
              `}
            >
              {/* Active indicator glow */}
              {isHomePage && selectedTab === SelectedRootTabs.Profile && (
                <motion.div 
                  layoutId="activeNavGlow"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(224,254,16,0.1), transparent)',
                    border: '1px solid rgba(224,254,16,0.2)'
                  }}
                />
              )}
              
              {/* Hover background */}
              <div className={`absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity ${isHomePage && selectedTab === SelectedRootTabs.Profile ? 'hidden' : ''}`} />
              
              <span className="relative text-2xl flex items-center justify-center">
                {currentUser.profileImage?.profileImageURL ? (
                  <div className="relative">
                    {/* Profile glow when active */}
                    {isHomePage && selectedTab === SelectedRootTabs.Profile && (
                      <div className="absolute -inset-1 rounded-full bg-[#E0FE10]/30 blur" />
                    )}
                    <img
                      src={currentUser.profileImage.profileImageURL}
                      alt="Profile"
                      className={`relative w-7 h-7 rounded-full object-cover border-2 ${
                        isHomePage && selectedTab === SelectedRootTabs.Profile 
                          ? 'border-[#E0FE10]' 
                          : 'border-transparent group-hover:border-white/30'
                      } transition-all`}
                    />
                  </div>
                ) : (
                  <div className={`relative w-7 h-7 rounded-full flex items-center justify-center ${
                    isHomePage && selectedTab === SelectedRootTabs.Profile 
                      ? 'bg-[#E0FE10]/20 border border-[#E0FE10]/50' 
                      : 'bg-zinc-700 border border-transparent group-hover:border-white/20'
                  } transition-all`}>
                    <span className={`text-xs font-semibold ${
                      isHomePage && selectedTab === SelectedRootTabs.Profile ? 'text-[#E0FE10]' : 'text-white'
                    }`}>
                      {currentUser.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </span>
              <span className="relative hidden lg:block text-base font-medium">
                Profile
              </span>
            </motion.button>
          )}
        </div>

        {/* Bottom Section - More Menu */}
        <div className="relative p-3 border-t border-zinc-800/80">
          <motion.button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            className="relative flex items-center gap-4 px-3 py-3 rounded-xl transition-all w-full text-zinc-400 hover:text-white group"
          >
            {/* Hover background */}
            <div className="absolute inset-0 rounded-xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <FaBars className="relative text-2xl" />
            <span className="relative hidden lg:block text-base font-medium">More</span>
          </motion.button>

          {/* More Dropdown Menu - Premium Glassmorphic */}
          <AnimatePresence>
            {showMoreMenu && (
              <>
                {/* Backdrop */}
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowMoreMenu(false)}
                />
                
                {/* Menu */}
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute bottom-full left-3 mb-2 w-56 z-50 overflow-hidden"
                >
                  {/* Glow effect */}
                  <div className="absolute -inset-1 bg-[#E0FE10]/10 rounded-2xl blur-xl" />
                  
                  {/* Glass card */}
                  <div className="relative rounded-xl backdrop-blur-xl bg-zinc-900/90 border border-white/10 overflow-hidden">
                    {/* Chromatic top line */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-[1px] opacity-60"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.5), transparent)' }}
                    />
                    
                    {/* App Switcher - Show available apps */}
                    {isCoachPage ? (
                      <>
                        <motion.button
                          onClick={() => {
                            router.push('/PulseCheck');
                            setShowMoreMenu(false);
                          }}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-white transition-colors"
                        >
                          <div className="relative">
                            <div className="absolute -inset-1 bg-[#E0FE10]/20 rounded-lg blur opacity-50" />
                            <img src="/pulseCheckIcon.png" alt="PulseCheck" className="relative w-5 h-5" />
                          </div>
                          <span className="font-medium">PulseCheck</span>
                        </motion.button>
                        <div className="border-t border-white/5" />
                        <motion.button
                          onClick={() => {
                            router.push('/');
                            setShowMoreMenu(false);
                          }}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-white transition-colors"
                        >
                          <div className="relative">
                            <div className="absolute -inset-1 bg-[#E0FE10]/20 rounded-lg blur opacity-50" />
                            <img src="/pulseIcon.png" alt="Pulse" className="relative w-5 h-5" />
                          </div>
                          <span className="font-medium">Pulse Home</span>
                        </motion.button>
                      </>
                    ) : (
                      <motion.button
                        onClick={() => {
                          if (isPulseCheckPage) {
                            router.push('/');
                          } else {
                            router.push('/PulseCheck');
                          }
                          setShowMoreMenu(false);
                        }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white transition-colors"
                      >
                        <div className="relative">
                          <div className="absolute -inset-1 bg-[#E0FE10]/20 rounded-lg blur opacity-50" />
                          <img 
                            src={isPulseCheckPage ? '/pulseIcon.png' : '/pulseCheckIcon.png'} 
                            alt={isPulseCheckPage ? 'Pulse' : 'PulseCheck'} 
                            className="relative w-5 h-5" 
                          />
                        </div>
                        <span className="font-medium">{isPulseCheckPage ? 'Pulse' : 'PulseCheck'}</span>
                      </motion.button>
                    )}
                    
                    <div className="border-t border-white/5" />
                    
                    {onAbout && (
                      <>
                        <motion.button
                          onClick={() => {
                            onAbout();
                            setShowMoreMenu(false);
                          }}
                          whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-white transition-colors"
                        >
                          <FaInfoCircle className="text-lg text-zinc-400" />
                          <span>About</span>
                        </motion.button>
                        
                        <div className="border-t border-white/5" />
                      </>
                    )}
                    
                    <motion.button
                      onClick={() => {
                        router.push('/settings');
                        setShowMoreMenu(false);
                      }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white transition-colors"
                    >
                      <FaCog className="text-lg text-zinc-400" />
                      <span>Settings</span>
                    </motion.button>
                    
                    <div className="border-t border-white/5" />
                    
                    <motion.button
                      onClick={() => {
                        handleSignOut();
                        setShowMoreMenu(false);
                      }}
                      whileHover={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white hover:text-red-400 transition-colors"
                    >
                      <FaSignOutAlt className="text-lg text-zinc-400" />
                      <span>Sign Out</span>
                    </motion.button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 z-40">
        {/* Solid dark background with chromatic edge */}
        <div className="absolute inset-0 bg-[#0d0d0f] border-t border-zinc-800/80">
          {/* Chromatic top line */}
          <div 
            className="absolute top-0 left-0 right-0 h-[1px] opacity-50"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(224,254,16,0.5), transparent)' }}
          />
        </div>
        
        {isCoachPage ? (
          /* Coach-specific mobile navigation */
          <div className="relative h-full flex items-center justify-around px-2">
            <motion.button
              onClick={() => router.push('/coach/dashboard')}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                currentPath === '/coach/dashboard' ? 'text-[#E0FE10]' : 'text-zinc-400'
              }`}
            >
              {currentPath === '/coach/dashboard' && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              <FaUsers className="relative text-2xl" />
            </motion.button>
            
            <motion.button
              onClick={() => router.push('/coach/referrals')}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                currentPath === '/coach/referrals' ? 'text-[#E0FE10]' : 'text-zinc-400'
              }`}
            >
              {currentPath === '/coach/referrals' && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              <FaUserFriends className="relative text-2xl" />
            </motion.button>
            
            <motion.button
              onClick={() => router.push('/coach/inbox')}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                currentPath === '/coach/inbox' ? 'text-[#E0FE10]' : 'text-zinc-400'
              }`}
            >
              {currentPath === '/coach/inbox' && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              <FaInbox className="relative text-2xl" />
            </motion.button>
            
            <motion.button
              onClick={() => router.push('/coach/profile')}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                currentPath === '/coach/profile' ? 'text-[#E0FE10]' : 'text-zinc-400'
              }`}
            >
              {currentPath === '/coach/profile' && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              {currentUser?.profileImage?.profileImageURL ? (
                <img
                  src={currentUser.profileImage.profileImageURL}
                  alt="Profile"
                  className={`relative w-8 h-8 rounded-full object-cover border-2 ${
                    currentPath === '/coach/profile'
                      ? 'border-[#E0FE10] shadow-[0_0_10px_rgba(224,254,16,0.4)]' 
                      : 'border-transparent'
                  } transition-all`}
                />
              ) : (
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  currentPath === '/coach/profile'
                    ? 'bg-[#E0FE10]/20 border-2 border-[#E0FE10] shadow-[0_0_10px_rgba(224,254,16,0.4)]' 
                    : 'bg-zinc-700 border-2 border-transparent'
                }`}>
                  <span className={`text-sm font-semibold ${
                    currentPath === '/coach/profile' ? 'text-[#E0FE10]' : 'text-white'
                  }`}>
                    {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </motion.button>
          </div>
        ) : (
          /* Default mobile navigation */
          <div className="relative h-full flex items-center justify-around px-2">
            {/* Home icon - goes to PulseCheck chat or Pulse Discover */}
            <motion.button
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
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                (isPulseCheckPage && currentPath === '/PulseCheck') || 
                (isHomePage && selectedTab === SelectedRootTabs.Discover)
                  ? 'text-[#E0FE10]' 
                  : 'text-zinc-400'
              }`}
            >
              {/* Active glow */}
              {((isPulseCheckPage && currentPath === '/PulseCheck') || 
                (isHomePage && selectedTab === SelectedRootTabs.Discover)) && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              <FaHome className="relative text-2xl" />
            </motion.button>
            
            <motion.button
              onClick={() => {
                // Always route directly to messages page
                router.push('/messages');
              }}
              whileTap={{ scale: 0.9 }}
              className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                (isHomePage && selectedTab === SelectedRootTabs.Messages) || currentPath === '/messages'
                  ? 'text-[#E0FE10]' 
                  : 'text-zinc-400'
              }`}
            >
              {/* Active glow */}
              {((isHomePage && selectedTab === SelectedRootTabs.Messages) || currentPath === '/messages') && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              <FaEnvelope className="relative text-2xl" />
            </motion.button>
            
            {isPulseCheckPage ? (
              <motion.button
                onClick={() => {
                  router.push('/coach/dashboard');
                }}
                whileTap={{ scale: 0.9 }}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                  currentAsPath.startsWith('/coach')
                    ? 'text-[#E0FE10]' 
                    : 'text-zinc-400'
                }`}
                aria-label="Coach Dashboard"
              >
                {/* Active glow */}
                {currentAsPath.startsWith('/coach') && (
                  <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
                )}
                <FaUserTie className="relative text-2xl" />
              </motion.button>
            ) : (
              <motion.button
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
                whileTap={{ scale: 0.9 }}
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl transition-colors ${
                  currentPath === '/create' || (isHomePage && selectedTab === SelectedRootTabs.Create)
                    ? 'text-[#E0FE10]' 
                    : 'text-zinc-400'
                }`}
                aria-label="Create"
              >
                {/* Active glow */}
                {(currentPath === '/create' || (isHomePage && selectedTab === SelectedRootTabs.Create)) && (
                  <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
                )}
                <FaPlusSquare className="relative text-2xl" />
              </motion.button>
            )}
            
            <motion.button
              onClick={() => {
                if (isCreatePage) {
                  // On /create page, deep-link to home with Profile selected
                  router.push('/?tab=profile');
                } else if (isHomePage && onTabChange) {
                  onTabChange(SelectedRootTabs.Profile);
                } else {
                  // Navigate to home page and select Profile (query-based deep link works even without onTabChange)
                  router.push('/?tab=profile');
                }
              }}
              whileTap={{ scale: 0.9 }}
              className="relative flex flex-col items-center justify-center p-2"
            >
              {/* Active glow */}
              {isHomePage && selectedTab === SelectedRootTabs.Profile && (
                <div className="absolute inset-0 bg-[#E0FE10]/10 rounded-xl blur" />
              )}
              {currentUser?.profileImage?.profileImageURL ? (
                <img
                  src={currentUser.profileImage.profileImageURL}
                  alt="Profile"
                  className={`relative w-8 h-8 rounded-full object-cover border-2 ${
                    isHomePage && selectedTab === SelectedRootTabs.Profile 
                      ? 'border-[#E0FE10] shadow-[0_0_10px_rgba(224,254,16,0.4)]' 
                      : 'border-transparent'
                  } transition-all`}
                />
              ) : (
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isHomePage && selectedTab === SelectedRootTabs.Profile 
                    ? 'bg-[#E0FE10]/20 border-2 border-[#E0FE10] shadow-[0_0_10px_rgba(224,254,16,0.4)]' 
                    : 'bg-zinc-700 border-2 border-transparent'
                }`}>
                  <span className={`text-sm font-semibold ${
                    isHomePage && selectedTab === SelectedRootTabs.Profile ? 'text-[#E0FE10]' : 'text-white'
                  }`}>
                    {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </motion.button>
          </div>
        )}
      </nav>
    </>
  );
};

export default SideNav;
