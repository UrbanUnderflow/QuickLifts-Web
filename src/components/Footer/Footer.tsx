import React, { useState } from 'react';
import EmailPopup from '../EmailPopup';  // Make sure the path to this import is correct
import Link from 'next/link';

const Footer = () => {
  const [isPopupOpen, setPopupOpen] = useState(false);

  const togglePopup = () => {
    setPopupOpen(!isPopupOpen);
  };

  const footerLinks = [
    { name: 'About', href: '/about' },
    { name: 'Press Kit', href: '/press' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
  ];

  const socialLinks = [
    { name: 'Twitter', href: 'https://twitter.com/fitwithpulse', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
      </svg>
    )},
    { name: 'Instagram', href: 'https://instagram.com/fitwithpulse', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    )},
    { name: 'LinkedIn', href: 'https://linkedin.com/company/fitwithpulse', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
        <rect x="2" y="9" width="4" height="12"></rect>
        <circle cx="4" cy="4" r="2"></circle>
      </svg>
    )},
    { name: 'YouTube', href: 'https://www.youtube.com/@pulsefitnesscollective', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
      </svg>
    )}
  ];

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {/* Logo & Company */}
          <div>
            <img 
              src="/pulse-logo-white.svg" 
              alt="Pulse" 
              className="h-8 w-auto mb-4" 
            />
            <p className="text-zinc-400 mb-6">Building the future of social fitness through community, technology, and shared experiences.</p>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <a 
                  key={link.name}
                  href={link.href} 
                  className="w-10 h-10 rounded-full bg-zinc-900/80 hover:bg-[#E0FE10]/20 flex items-center justify-center text-zinc-400 hover:text-[#E0FE10] transition-colors duration-300"
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label={link.name}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="text-white text-lg font-medium mb-6">Quick Links</h3>
            <ul className="space-y-4">
              {footerLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-zinc-400 hover:text-[#E0FE10] transition-colors duration-300">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Newsletter */}
          <div>
            <h3 className="text-white text-lg font-medium mb-6">Stay Connected</h3>
            <p className="text-zinc-400 mb-6">Get updates on new features, community challenges, and fitness content.</p>
            <button 
              onClick={togglePopup}
              className="px-6 py-3 bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium rounded-lg transition-colors duration-300"
            >
              Subscribe to Updates
            </button>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="border-t border-zinc-800 pt-8 text-center">
          <p className="text-zinc-500 text-sm">© {new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
      </div>
      
      {isPopupOpen && <EmailPopup isOpen={isPopupOpen} closePopup={togglePopup} />}
    </footer>
  );
};

export default Footer;




