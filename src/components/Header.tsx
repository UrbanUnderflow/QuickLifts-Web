import React from 'react';

// Define the types of sections available
export type Section = 'home' | 'creator' | 'subscribe' | 'support' | 'contact';

// Define the props with the section type
interface HeaderProps {
  onSectionChange: (section: Section) => void;
  currentSection: Section;
  toggleMobileMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSectionChange, currentSection, toggleMobileMenu }) => {
  const getClassName = (section: Section) => {
    return `text-base font-medium capitalize ${currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'}`;
  };

  return (
    <div className="pt-10 px-6 sm:px-24 flex justify-between">
      <div className="flex items-center text-white font-bold">
        <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-12" />
      </div>
      {/* Desktop Menu */}
      <div className="hidden sm:flex relative w-[570px] h-[39px] p-2.5 justify-center items-center gap-10">
        <button className={getClassName('home')} onClick={() => onSectionChange('home')}>Features</button>
        <button className={getClassName('creator')} onClick={() => onSectionChange('creator')}>Creators</button>
        {/* <button className={getClassName('subscribe')} onClick={() => onSectionChange('subscribe')}>Subscribe</button> */}
        <a href="mailto:pulsefitnessapp@gmail.com" className={getClassName('contact')}>Contact Us</a>
      </div>

      {/* Mobile Menu Toggle */}
      <div className="sm:hidden flex items-center">
        <button onClick={toggleMobileMenu} aria-label="Toggle Mobile Menu">
          <img src="/menu-icon.svg" alt="Menu" className="h-12" />
        </button>
      </div>
    </div>
  );
};

export default Header;
