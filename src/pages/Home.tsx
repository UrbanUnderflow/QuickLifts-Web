import React, { useState } from 'react';
import Header, { Section } from '../components/Header';
import HomeContent from './HomeContent';
import Footer from '../components/Footer/Footer';
import Creator from './Creator';
import Subscribe from './Subscribe';

const Home: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false); // Close the panel upon section change
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Function to get class names for buttons based on the active section
  const getMenuItemClassName = (section: Section) => {
    return `text-base font-medium capitalize ${
      currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'
    }`;
  };

  return (
    <div className="home">
      <div className="h-screen relative flex flex-col">
        <div className="relative w-full">
          <Header onSectionChange={handleSectionChange} currentSection={currentSection} toggleMobileMenu={toggleMobileMenu} />
        </div>

        {/* Conditionally render sections based on currentSection */}
        {currentSection === 'home' && <HomeContent />}
        {currentSection === 'creator' && <Creator />}
        {currentSection === 'subscribe' && <Subscribe />}

        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-25 z-10 transition-opacity duration-300 ease-in-out" onMouseDown={() => setIsMobileMenuOpen(false)}>
            {/* Side Panel */}
            <div className={`fixed inset-y-0 right-0 w-64 bg-white shadow-md transform transition-transform duration-300 ease-in-out z-20 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onMouseDown={(e) => e.stopPropagation()}>
              <div className="p-4 flex flex-col gap-6">
                <button className={getMenuItemClassName('home')} onClick={() => handleSectionChange('home')}>Features</button>
                <button className={getMenuItemClassName('creator')} onClick={() => handleSectionChange('creator')}>Creators</button>
                {/* <button className={getMenuItemClassName('subscribe')} onClick={() => handleSectionChange('subscribe')}>Subscribe</button> */}
                <button className={getMenuItemClassName('contact')} onClick={() => { setIsMobileMenuOpen(false); window.location.href = 'mailto:pulsefitnessapp@gmail.com'; }}>Contact Us</button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
};

export default Home;
