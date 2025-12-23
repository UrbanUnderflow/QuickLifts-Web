import React, { useState } from 'react';
import Header, { Section } from './Header';
import CoachTopNav from './CoachTopNav';
import CoachProtectedRoute from './CoachProtectedRoute';

interface Props {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
}

const CoachLayout: React.FC<Props> = ({ 
  children, 
  requiresActiveSubscription = true 
}) => {
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const setIsSignInModalVisible = () => {
    // For coach layout, we might not need sign in modal since they're already authenticated
    // But we need to provide this function to satisfy the Header props
    console.log('Sign in modal triggered from coach layout');
  };

  return (
    <CoachProtectedRoute requiresActiveSubscription={requiresActiveSubscription}>
      <div className="min-h-screen bg-black text-white">
        <Header 
          onSectionChange={handleSectionChange}
          currentSection={currentSection}
          toggleMobileMenu={toggleMobileMenu}
          setIsSignInModalVisible={setIsSignInModalVisible}
          theme="dark"
          hideNav={true}
        />
        <CoachTopNav />
        
        <main className="pt-16">
          {children}
        </main>
      </div>
    </CoachProtectedRoute>
  );
};

export default CoachLayout;
