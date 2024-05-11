// pages/Home.tsx
import React, { useState } from 'react';
import Header, { Section } from '../components/Header';
import HomeContent from './HomeContent';
import Footer from '../components/Footer/Footer';
import Creator from './Creator';
import Subscribe from './Subscribe';

const Home: React.FC = () => {
  // State to keep track of the selected section
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Function to handle switching sections
  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false); // Close the panel upon section change
  };

  // Function to toggle the mobile side panel
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
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

        {/* Backdrop covering the whole screen */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-25 z-10 transition-opacity duration-300 ease-in-out" onMouseDown={() => setIsMobileMenuOpen(false)}>
          {/* Side Panel */}
          <div className={`fixed inset-y-0 right-0 w-64 bg-white shadow-md transform transition-transform duration-300 ease-in-out z-20 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onMouseDown={(e) => e.stopPropagation()}>
            <div className="p-4 flex flex-col gap-6">
              <button className="text-zinc-800 text-base font-medium capitalize" onClick={() => handleSectionChange('home')}>Features</button>
              <button className="text-gray-700 text-base font-medium capitalize" onClick={() => handleSectionChange('creator')}>Creators</button>
              <button className="text-gray-700 text-base font-medium capitalize" onClick={() => handleSectionChange('subscribe')}>Subscribe</button>
              <button className="text-gray-700 text-base font-medium capitalize" onClick={() => { setIsMobileMenuOpen(false); window.location.href = 'mailto:pulsefitnessapp@gmail.com'; }}>Contact Us</button>
            </div>
          </div>
        </div>
        )}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default Home;
