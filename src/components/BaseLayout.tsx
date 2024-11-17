// components/BaseLayout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';

interface BaseLayoutProps {
  children: React.ReactNode;
}

const BaseLayout: React.FC<BaseLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <>
    {isHomePage ? (
        // Default meta tags for home page
        <>
        <title>Pulse: Fitness Collective</title>
        <meta name="description" content="Beat Your Best, Share Your Victory" />
        <meta property="og:title" content="Pulse: Fitness Collective" />
        <meta property="og:description" content="Beat Your Best, Share Your Victory" />
        <meta property="og:image" content="https://fitwithpulse.ai/preview-image.png" />
        <meta property="og:url" content="https://fitwithpulse.ai" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        </>
    ) : (
        // Default meta tags for other pages that can be overridden
        <title>Pulse: Fitness Collective</title>
    )}
      {children}
    </>
  );
};

export default BaseLayout;