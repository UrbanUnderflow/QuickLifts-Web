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
    { name: 'Press Kit', href: '/press-kit' },
    { name: 'Privacy', href: '/privacy' },
    { name: 'Terms', href: '/terms' },
  ];

  const socialLinks = [
    { name: 'Twitter', href: 'https://twitter.com/pulseapp', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
      </svg>
    )},
    { name: 'Instagram', href: 'https://instagram.com/pulseapp', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
      </svg>
    )},
    { name: 'LinkedIn', href: 'https://linkedin.com/company/pulseapp', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
        <rect x="2" y="9" width="4" height="12"></rect>
        <circle cx="4" cy="4" r="2"></circle>
      </svg>
    )},
    { name: 'TikTok', href: 'https://tiktok.com/@pulseapp', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
        <path d="M20 9V4a1 1 0 0 0-1-1h-5"></path>
        <path d="M15 12v3a4 4 0 0 1-4 4H9"></path>
        <line x1="20" y1="9" x2="9" y2="9"></line>
      </svg>
    )}
  ];

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {/* Logo & Company */}
          <div>
            <h2 className="text-white text-2xl font-bold mb-4">Pulse</h2>
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
          <p className="text-zinc-500 text-sm">© {new Date().getFullYear()} Pulse Fitness. All rights reserved.</p>
        </div>
      </div>
      
      {isPopupOpen && <EmailPopup isOpen={isPopupOpen} closePopup={togglePopup} />}
    </footer>
  );
};

export default Footer;




