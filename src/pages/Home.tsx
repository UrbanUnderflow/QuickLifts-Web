import React, { useState } from 'react';
import Header, { Section } from '../components/Header'; // Import Section type from Header.tsx
import HomeContent from '../pages/HomeContent';
import Footer from '../components/Footer';
import Creator from '../pages/Creator';
import Subscribe from './Subscribe';
import Support from './Support';

const Home: React.FC = () => {
  // State to keep track of the selected section
  const [currentSection, setCurrentSection] = useState<Section>('home');

  // Function to handle switching sections
  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
  };

  return (
    <div className="home">
      <div className="h-screen relative flex flex-col" style={{ backgroundColor: '' }}>
        <div className="relative w-full">
          {/* Pass the section change handler to the header */}
          <Header onSectionChange={handleSectionChange} currentSection={currentSection} />
        </div>

        {/* Conditionally render sections based on currentSection */}
        {currentSection === 'home' && <HomeContent />}
        {currentSection === 'creator' && <Creator />}
        {currentSection === 'subscribe' && <Subscribe />}
        {/* {currentSection === 'support' && <Support />} */}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default Home;
