import React from 'react';

export type Section = 'home' | 'creator' | 'subscribe' | 'support' | 'contact';

interface HeaderProps {
  onSectionChange: (section: Section) => void;
  currentSection: Section;
  toggleMobileMenu: () => void;
  setIsSignInModalVisible: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onSectionChange,
  currentSection,
  toggleMobileMenu,
  setIsSignInModalVisible,
}) => {
  const getClassName = (section: Section) => {
    return `text-base font-medium capitalize ${
      currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'
    }`;
  };

  return (
    <div className="pt-10 px-8 sm:px-24 w-full">
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center text-white font-bold">
          <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-12" />
        </div>

        {/* Desktop Menu */}
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
          <a href="mailto:pulsefitnessapp@gmail.com" className={getClassName('contact')}>
            Contact Us
          </a>
          <button 
            onClick={setIsSignInModalVisible}
            className="text-base font-medium text-gray-700 hover:text-[#14B8A6]"
          >
            Sign In
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="sm:hidden">
          <button onClick={toggleMobileMenu} aria-label="Toggle Mobile Menu">
            <img src="/menu-icon.svg" alt="Menu" className="h-12" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;