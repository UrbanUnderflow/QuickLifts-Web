import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store'; // Adjust path if needed

const GlobalLoader: React.FC = () => {
  const { isLoading, message } = useSelector((state: RootState) => state.loading);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Spinner SVG */}
      <svg 
        className="animate-spin h-10 w-10 text-[#DFFD10] mb-4" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          className="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          strokeWidth="4"
        ></circle>
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      
      {/* Optional Loading Message */}
      {message && (
        <p className="text-white text-lg font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default GlobalLoader; 