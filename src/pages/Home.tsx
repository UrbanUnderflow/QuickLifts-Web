import React from 'react';
import HomeContent from './HomeContent';


const Home: React.FC = () => {

  return (
    <div className="home">
      <div className="h-screen relative flex flex-col">
      <div className="flex justify-between items-center pt-10">
          <HomeContent />
        </div>
      </div>
    </div>
  );
};

export default Home;