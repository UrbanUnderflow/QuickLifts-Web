import React, { useEffect, useRef, useState } from 'react';

// Define the types of sections available
export type Section = 'home' | 'creator' | 'subscribe' | 'support' | 'contact';

// Define the props with the section type
interface HeaderProps {
  onSectionChange: (section: Section) => void;
  currentSection: Section;
  toggleMobileMenu: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSectionChange, currentSection, toggleMobileMenu }) => {
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });
  const homeRef = useRef<HTMLButtonElement>(null);
  const creatorRef = useRef<HTMLButtonElement>(null);
  const subscribeRef = useRef<HTMLButtonElement>(null);
  const supportRef = useRef<HTMLButtonElement>(null);
  const contactRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // Mapping section names to their corresponding refs
    const sectionToRefMap: Record<Section, React.RefObject<HTMLButtonElement | HTMLAnchorElement>> = {
      home: homeRef,
      creator: creatorRef,
      subscribe: subscribeRef,
      support: supportRef,
      contact: contactRef,
    };
    const selectedRef = sectionToRefMap[currentSection].current;
    if (selectedRef) {
      const { offsetLeft, offsetWidth } = selectedRef;
      setUnderlineStyle({ left: offsetLeft, width: offsetWidth });
    }
  }, [currentSection]);

  return (
    <div className="pt-10 px-6 sm:px-24 flex justify-between">
      <div className="flex items-center text-white font-bold">
        <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-12" />
      </div>
      {/* Desktop Menu */}
      <div className="hidden sm:flex relative w-[570px] h-[39px] p-2.5 justify-center items-center gap-10">
        <button ref={homeRef} className="text-zinc-800 text-base font-medium capitalize" onClick={() => onSectionChange('home')}>Features</button>
        <button ref={creatorRef} className="text-gray-700 text-base font-medium capitalize" onClick={() => onSectionChange('creator')}>Creators</button>
        <button ref={subscribeRef} className="text-gray-700 text-base font-medium capitalize" onClick={() => onSectionChange('subscribe')}>Subscribe</button>
        <a ref={contactRef} href="mailto:pulsefitnessapp@gmail.com" className="text-gray-700 text-base font-medium capitalize">Contact Us</a>

        {/* Underline */}
        <div className="absolute bottom-0 h-[1.80px] bg-black transition-all duration-300 ease-in-out" style={{ ...underlineStyle }}></div>
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
