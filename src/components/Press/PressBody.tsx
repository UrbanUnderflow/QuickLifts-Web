import React from 'react';

interface PressBodyProps {
  children: React.ReactNode;
}

/**
 * PressBody component for rendering press release content in MDX
 * This component adds styling and structure to press release content
 */
const PressBody: React.FC<PressBodyProps> = ({ children }) => {
  return (
    <div className="prose prose-invert prose-lg max-w-none">
      {/* Custom styling for press releases */}
      <div className="text-zinc-300 leading-relaxed">
        {children}
      </div>
    </div>
  );
};

export default PressBody; 