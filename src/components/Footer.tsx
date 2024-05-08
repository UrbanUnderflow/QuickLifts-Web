import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white py-10">
      {/* Additional footer content (commented out in your example) */}
      {/* 
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row justify-between items-center">
        <div className="mb-6 lg:mb-0">
          <img src="/pulse-logo.svg" alt="Pulse Logo" className="h-12" />
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <div className="text-center">
            <h5 className="font-bold uppercase">Product</h5>
            <ul className="mt-4 space-y-2">
              <li><a href="#" className="text-gray-600 hover:text-gray-900">Integrations</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900">Pricing</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900">Documentation</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900">Changelog</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="flex mt-6 lg:mt-0">
          <a href="https://twitter.com" className="text-gray-600 hover:text-gray-900 mx-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="..."></path></svg>
          </a>
          <a href="https://facebook.com" className="text-gray-600 hover:text-gray-900 mx-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="..."></path></svg>
          </a>
          <a href="https://linkedin.com" className="text-gray-600 hover:text-gray-900 mx-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="..."></path></svg>
          </a>
        </div>
      </div>
      */}
      <div className="border-t border-gray-200 mt-10 pt-6 text-gray-600 text-center text-sm">
        <p>© {new Date().getFullYear()} Pulse Fitness. All rights reserved.</p>
        <div className="flex justify-center space-x-4">
          <a href="/privacy" className="hover:text-gray-900">Privacy</a>
          <a href="/terms" className="hover:text-gray-900">Terms</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
