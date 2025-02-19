import React from 'react';

interface Props {
  progress: number;
}

const ProgressBar: React.FC<Props> = ({ progress }) => {
  return (
    <div className="w-full bg-zinc-800 rounded-full h-4 overflow-hidden">
      <div 
        className="bg-[#E0FE10] h-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      >
      </div>
    </div>
  );
};

export default ProgressBar;