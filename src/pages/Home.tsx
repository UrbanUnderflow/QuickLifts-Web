import React from 'react';
const Home = () => (
  <div className="h-screen overflow-hidden relative flex flex-col"
       style={{backgroundColor: '#141A1E'}}>
    <div className="pt-10 px-6 sm:px-24 flex justify-between">
      <div className="flex items-center text-white font-bold">
        <img src="/pulse-logo.png" alt="Pulse Logo" className="h-12" />
      </div>
      <div className="text-white font-bold">
        <a href="mailto:pulsefitnessapp@gmail.com" className="text-white">Contact Us</a>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row p-6 sm:p-20">
      <div className="sm:pl-48 pt-10 font-bold text-white text-4xl sm:text-5xl">
        Beat Your Best,<br />Share Your Victory<br />
        <div className="mt-10">
          <button className="px-8 py-2 h-12 text-sm bg-[#E0FE10] text-black font-bold rounded">
            Download Now
          </button>
        </div>
      </div>
      <div className="mt-10 sm:mt-0">
        <img src="/pulse-phone-mobile.png" alt="Phone Mobile" className="w-full md:hidden h-auto" />
        <img src="/pulse-phone.png" alt="Phone" className="hidden md:block w-full md:w-[700px] h-auto" />
      </div>
    </div>

    <footer className="absolute bottom-0 z-20 w-full h-20 bg-black flex items-center justify-center">
      <div className="text-white text-center space-y-2">
        <p>© {new Date().getFullYear()} Pulse Fitness. All rights reserved.</p>
        <div className="flex justify-center space-x-4">
          <a href="/terms" className="text-blue-400 hover:text-blue-600">Terms of Use</a>
          <a href="/privacy" className="text-blue-400 hover:text-blue-600">Privacy Policy</a>
        </div>
      </div>
    </footer>
  </div>
);

export default Home;

