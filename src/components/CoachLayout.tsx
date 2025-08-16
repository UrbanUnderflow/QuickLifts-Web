import React from 'react';
import Header from './Header';
import Footer from './Footer/Footer';
import CoachNavigation from './CoachNavigation';
import CoachProtectedRoute from './CoachProtectedRoute';

interface Props {
  children: React.ReactNode;
  requiresActiveSubscription?: boolean;
}

const CoachLayout: React.FC<Props> = ({ 
  children, 
  requiresActiveSubscription = true 
}) => {
  return (
    <CoachProtectedRoute requiresActiveSubscription={requiresActiveSubscription}>
      <div className="min-h-screen bg-black text-white">
        <Header />
        <CoachNavigation />
        
        <main className="ml-64 pt-16">
          {children}
        </main>
      </div>
    </CoachProtectedRoute>
  );
};

export default CoachLayout;
