import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';

const UserMenu: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const auth = getAuth();

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
      await signOut(auth);
      dispatch(setUser(null));
    } catch (error) {
      console.error('Error signing out:', error);
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
          className="absolute top-full right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 z-50 overflow-hidden"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="px-4 py-2 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer" onClick={handleSignOut}>
            <span className="text-white">Sign Out</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;