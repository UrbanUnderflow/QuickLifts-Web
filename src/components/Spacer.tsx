import React from 'react';

// How to use
{/* <div>
  <SomeComponent />
  <Spacer size={24} />
  <AnotherComponent />
  <Spacer /> {/* Uses default 16px */}
   {/*<Spacer size={48} />
  {/* Component that only spaces on mobile */}
   {/*<Spacer size={32} className="md:hidden" />
</div> */}

interface SpacerProps {
  size?: number;  // Size in pixels
  className?: string;  // Optional additional classes
}

const Spacer: React.FC<SpacerProps> = ({ size = 16, className = '' }) => {
  return (
    <div 
      style={{ height: `${size}px` }}
      className={className}
      aria-hidden="true"
    />
  );
};

export default Spacer;