import React from 'react';
import HomeContent from './HomeContent';


const Home: React.FC = () => {
  
  return (
    <div className="home">
      <div className="h-screen relative flex flex-col">
        <div className="flex items-center justify-between pt-10 px-6 sm:px-24">
          <HomeContent />
          </div>
      </div>
    </div>
  );
};

export default Home;