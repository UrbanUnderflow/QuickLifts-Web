import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { setUser } from '../redux/userSlice';
import { RootState } from '../redux/store';
import { trackEvent } from '../lib/analytics';

const UserMenu: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const router = useRouter();
  const auth = getAuth();
  
  // Get current user from Redux store
  const currentUser = useSelector((state: RootState) => state.user.currentUser);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      console.log('[UserMenu] Starting sign out process...');
      setIsMenuOpen(false); // Close the menu immediately
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear user state in Redux
      dispatch(setUser(null));
      
      // Clear the localStorage flag so user sees marketing content instead of dashboard
      localStorage.removeItem('pulse_has_seen_marketing');
      
      // Redirect to homepage
      await router.push('/');
      
      console.log('[UserMenu] Sign out completed successfully');
    } catch (error) {
      console.error('[UserMenu] Error signing out:', error);
    }
  };

  const handleEarningsClick = () => {
    setIsMenuOpen(false);
    
    // Track earnings navigation from user menu
    if (currentUser?.email) {
      trackEvent(currentUser.email, 'EarningsNavigatedFromMenu', {
        userId: currentUser.id,
        username: currentUser.username,
        source: 'user_menu'
      });
    }
    
    if (currentUser?.username) {
      router.push(`/${currentUser.username}/earnings`);
    }
  };

  const handleProfileClick = () => {
    setIsMenuOpen(false);
    if (currentUser?.username) {
      router.push(`/profile/${currentUser.username}`);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center justify-center hover:bg-zinc-800 rounded-full p-2 transition-colors duration-200"
      >
        <ChevronDown 
          className={`text-white w-6 h-6 transition-transform duration-200 ${
            isMenuOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {isMenuOpen && (
        <div 
          className="absolute top-full right-0 mt-2 w-52 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 z-50 overflow-hidden"
          style={{ transform: 'translateX(-50%)' }}
        >
          {/* Profile Link */}
          <div 
            className="px-4 py-3 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer flex items-center gap-3"
            onClick={handleProfileClick}
          >
            <span className="text-lg">👤</span>
            <span className="text-white">My Profile</span>
          </div>
          
          {/* Earnings Link */}
          <div 
            className="px-4 py-3 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer flex items-center gap-3"
            onClick={handleEarningsClick}
          >
            <span className="text-lg">💰</span>
            <span className="text-white">Earnings</span>
          </div>
          
          {/* Divider */}
          <div className="border-t border-zinc-700"></div>
          
          {/* Sign Out */}
          <div 
            className="px-4 py-3 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer flex items-center gap-3"
            onClick={handleSignOut}
          >
            <span className="text-lg">🚪</span>
            <span className="text-white">Sign Out</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;