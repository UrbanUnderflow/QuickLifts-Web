import React from 'react';

export default function StartupRunway() {
  const handleMeetingRequest = () => {
    window.location.href = 'mailto:tre@fitwithpulse.ai?subject=Meeting Request with Tremaine';
  };

  const handleAppRating = () => {
    window.location.href = 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729';
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl w-full text-center space-y-12">
        {/* Logo */}
        <div className="mb-8">
          <img 
            src="/pulse-logo.svg" 
            alt="Pulse Logo" 
            className="h-12 mx-auto"
          />
        </div>

        {/* Header Section */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900">
            Startup Runway: Connect with Pulse
          </h1>
          <p className="text-xl text-gray-600">
            Join us in revolutionizing the fitness community experience
          </p>
        </div>

        {/* Main Buttons */}
        <div className="space-y-4">
          <button
            onClick={handleAppRating}
            className="w-full sm:w-96 bg-black text-white rounded-full py-4 px-8 text-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Download & Rate Pulse on iOS
          </button>

          <button
            onClick={handleMeetingRequest}
            className="w-full sm:w-96 bg-[#E0FE10] text-black rounded-full py-4 px-8 text-lg font-semibold hover:bg-[#c8e60e] transition-colors"
          >
            Request a Meeting with Tremaine
          </button>
        </div>

        {/* Social Media Links */}
        <div className="flex justify-center space-x-6">
          <a
            href="https://instagram.com/fitwithpulse"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>

          <a
            href="https://www.youtube.com/channel/UCR0J7cBpg3UlSaoy3JsQ-FQ"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}