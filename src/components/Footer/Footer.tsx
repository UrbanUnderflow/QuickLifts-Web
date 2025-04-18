import React, { useState } from 'react';
import EmailPopup from '../EmailPopup';  // Make sure the path to this import is correct

const Footer = () => {
  const [isPopupOpen, setPopupOpen] = useState(false);

  const togglePopup = () => {
    setPopupOpen(!isPopupOpen);
  };

  return (
    <footer className="bg-zinc-900 py-10">
      {/* Existing content can remain unchanged */}

      <div className="border-t border-zinc-700 mt-10 pt-6 text-zinc-400 text-center text-sm">
        <p>© {new Date().getFullYear()} Pulse Fitness. All rights reserved.</p>
        <div className="flex justify-center space-x-4 mb-4">
          <a href="/privacy" className="hover:text-white">Privacy</a>
          <a href="/terms" className="hover:text-white">Terms</a>
        </div>
        <button className="glisteningButton" onClick={togglePopup}>Stay in the Loop with Pulse</button>
      </div>
      {isPopupOpen && <EmailPopup isOpen={isPopupOpen} closePopup={togglePopup} />}
    </footer>
  );
};

export default Footer;




