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
        <div className="flex items-center justify-between pt-10 px-6 sm:px-24">
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
         <div className="fixed inset-0 bg-black/80 z-10 backdrop-blur-sm transition-opacity duration-300">
         <div 
           className={`fixed inset-y-0 right-0 w-80 bg-zinc-900 border-l border-zinc-800 shadow-xl transform transition-transform duration-300 ${
             isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
           }`}
           onClick={(e) => e.stopPropagation()}
         >
           <div className="p-8 flex flex-col gap-8">
             <button 
               onClick={() => setIsSignInModalVisible(true)}
               className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg hover:bg-[#c8e60e] transition-colors"
             >
               Sign In
             </button>
             
             <div className="space-y-6">
               <button 
                 className="w-full text-left text-lg font-medium text-white hover:text-[#E0FE10] transition-colors"
                 onClick={() => handleSectionChange('home')}
               >
                 Features
               </button>
               <button 
                 className="w-full text-left text-lg font-medium text-white hover:text-[#E0FE10] transition-colors"
                 onClick={() => handleSectionChange('creator')}
               >
                 Creators
               </button>
               <button 
                 className="w-full text-left text-lg font-medium text-white hover:text-[#E0FE10] transition-colors"
                 onClick={() => handleSectionChange('support')}
               >
                 Support
               </button>
               <button 
                 className="w-full text-left text-lg font-medium text-white hover:text-[#E0FE10] transition-colors"
                 onClick={() => {
                   setIsMobileMenuOpen(false);
                   window.location.href = 'mailto:pulsefitnessapp@gmail.com';
                 }}
               >
                 Contact Us
               </button>
             </div>
           </div>
         </div>
        </div>
        )}

       {/* SignIn Modal */}
        <SignInModal
                  isVisible={isSignInModalVisible}
                  closable={true}
                  onClose={() => setIsSignInModalVisible(false)}
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