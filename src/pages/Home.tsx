import React, { useEffect, useState } from 'react';
import Header, { Section } from '../components/Header';
import HomeContent from './HomeContent';
import Footer from '../components/Footer/Footer';
import Creator from './Creator';
import Subscribe from './Subscribe';
import Support from './Support';
import SignInModal from '../components/SignInModal'; 

const Home: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignInModalVisible, setIsSignInModalVisible] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('p') as Section;
    if (section) {
      setCurrentSection(section);
    }
  }, []);

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
    setIsMobileMenuOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set('p', section);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const getMenuItemClassName = (section: Section) => {
    return `text-base font-medium capitalize ${
      currentSection === section ? 'text-[#14B8A6] font-bold' : 'text-gray-700'
    }`;
  };

  return (
    <div className="home">
      <div className="h-screen relative flex flex-col">
      <div className="flex justify-between items-center pt-10">
          <Header 
            onSectionChange={handleSectionChange} 
            currentSection={currentSection} 
            toggleMobileMenu={toggleMobileMenu} 
            setIsSignInModalVisible={() => setIsSignInModalVisible(true)}
          />
        </div>

        {currentSection === 'home' && <HomeContent />}
        {currentSection === 'creator' && <Creator />}
        {currentSection === 'support' && <Support />}
        {currentSection === 'subscribe' && <Subscribe />}

        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-25 z-10 transition-opacity duration-300 ease-in-out" onMouseDown={() => setIsMobileMenuOpen(false)}>
            <div className={`fixed inset-y-0 right-0 w-64 bg-white shadow-md transform transition-transform duration-300 ease-in-out z-20 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onMouseDown={(e) => e.stopPropagation()}>
              <div className="p-4 flex flex-col gap-6">
                <button className={getMenuItemClassName('home')} onClick={() => handleSectionChange('home')}>Features</button>
                <button className={getMenuItemClassName('creator')} onClick={() => handleSectionChange('creator')}>Creators</button>
                <button className={getMenuItemClassName('support')} onClick={() => handleSectionChange('support')}>Support</button>
                <button className={getMenuItemClassName('contact')} onClick={() => { setIsMobileMenuOpen(false); window.location.href = 'mailto:pulsefitnessapp@gmail.com'; }}>Contact Us</button>
              </div>
            </div>
          </div>
        )}

        {/* SignIn Modal */}
        <SignInModal
          isVisible={isSignInModalVisible}
          onSignInSuccess={() => setIsSignInModalVisible(false)} // Close modal on success
          onSignInError={(error) => console.error('Sign-in error:', error)} // Handle error
          onSignUpSuccess={() => setIsSignInModalVisible(false)} // Close modal on success
          onSignUpError={(error) => console.error('Sign-up error:', error)} // Handle error
          onQuizComplete={() => console.log('Quiz completed')} // Optional
          onQuizSkipped={() => console.log('Quiz skipped')} // Optional
        />
        <Footer />
      </div>
    </div>
  );
};

export default Home;