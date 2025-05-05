import React from 'react';

/**
 * PressBody component used to render press release content
 * This component wraps press release content with appropriate styles
 */
const PressBody = ({ children }) => {
  return (
    <div className="prose prose-lg prose-invert max-w-none">
      {children}
    </div>
  );
};

export default PressBody; 