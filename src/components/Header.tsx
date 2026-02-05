import React from 'react';
import Link from 'next/link';

export type Section = 'home' | 'creator' | 'subscribe' | 'support' | 'contact';
export type Theme = 'light' | 'dark';

interface HeaderProps {
  onSectionChange: (section: Section) => void;
  currentSection: Section;
  toggleMobileMenu: () => void;
  setIsSignInModalVisible: () => void;
  theme?: Theme;
  hideNav?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onSectionChange,
  currentSection,
  toggleMobileMenu,
  setIsSignInModalVisible,
  theme = 'light',
  hideNav = false
}) => {
  const getClassName = (section: Section) => {
    if (theme === 'dark') {
      return `text-base font-medium capitalize ${
        currentSection === section ? 'text-[#E0FE10] font-bold' : 'text-white'
      }`;
    }
    return `text-base font-medium capitalize ${
      currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'
    }`;
  };

  return (
    <div className="pt-10 px-8 sm:px-24 w-full">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center text-white font-bold">
          <img 
            src={theme === 'dark' ? "/PulseWhite.png" : "/pulse-logo.svg"} 
            alt="Pulse Logo" 
            className="h-12" 
          />
        </div>

        {/* Desktop Menu - Only show when hideNav is false */}
        {!hideNav && (
          <div className="hidden sm:flex relative w-[570px] h-[39px] p-2.5 justify-center items-center gap-10">
            <button className={getClassName('home')} onClick={() => onSectionChange('home')}>
              Features
            </button>
            <button className={getClassName('creator')} onClick={() => onSectionChange('creator')}>
              Creators
            </button>
            <button className={getClassName('support')} onClick={() => onSectionChange('support')}>
              Support
            </button>
            <Link
              href="/research"
              className={`text-base font-medium capitalize ${
                theme === 'dark' ? 'text-white hover:text-[#E0FE10]' : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Research
            </Link>
            <a href="mailto:pulsefitnessapp@gmail.com" className={getClassName('contact')}>
              Contact Us
            </a>
            <div className={theme === 'dark' ? 'text-white' : 'text-gray-700'}>|</div>
            <button 
              onClick={setIsSignInModalVisible}
              className={`text-base font-medium ${
                theme === 'dark' 
                  ? 'text-white hover:text-[#E0FE10]' 
                  : 'text-gray-700 hover:text-[#14B8A6]'
              }`}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Mobile Menu Toggle - Only show when hideNav is false */}
        {!hideNav && (
          <div className="sm:hidden">
            <button onClick={toggleMobileMenu} aria-label="Toggle Mobile Menu">
              <img 
                src={theme === 'dark' ? "/menu-icon-white.svg" : "/menu-icon.svg"} 
                alt="Menu" 
                className="h-12" 
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;