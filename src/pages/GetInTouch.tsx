import type { NextPage } from 'next';
import React from 'react';
import Footer from '../components/Footer/Footer';
import PageHead from '../components/PageHead';
import { useScrollFade } from '../hooks/useScrollFade';

const GetInTouch: NextPage = () => {
  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead
        metaData={{
          pageId: "get-in-touch",
          pageTitle: "Get In Touch - Pulse",
          metaDescription: "Let's make fitness impossible to quit.",
          ogImage: "/pulse-social-card.jpg",
          ogUrl: "https://fitwithpulse.ai/GetInTouch",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/GetInTouch"
      />

      {/* Hero Section */}
      <section ref={useScrollFade()} className="relative min-h-screen flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-1000"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 animate-fade-in-up animation-delay-300">
            Let's Connect
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Get In Touch
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            Let's make fitness impossible to quit.
          </p>
        </div>
      </section>

      {/* Bio Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-white text-4xl font-bold mb-6">About The Founder</h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                I'm passionate about revolutionizing the fitness industry through technology and community.
                As the founder of Pulse, I believe that fitness is more powerful when it's shared, and that
                everyone deserves access to tools that make their wellness journey engaging and sustainable.
              </p>
              <p className="text-zinc-400 text-lg leading-relaxed">
                My mission is to create platforms that not only track your progress but inspire you to
                push beyond your limits while connecting with like-minded individuals who share your commitment
                to health and wellness.
              </p>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Whether you're interested in partnerships, collaborations, or just want to share your
                fitness journey, I'd love to hear from you.
              </p>
            </div>

            {/* Profile Image */}
            <div className="flex justify-center">
              <div className="w-80 h-80 rounded-2xl overflow-hidden border-2 border-[#E0FE10]/20 hover:border-[#E0FE10]/40 transition-colors duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20">
                <img
                  src="/TremaineFounder.jpg"
                  alt="Tremaine Grant - Founder & CEO of Pulse"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Methods Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-900">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-center text-white text-4xl font-bold mb-16">Ways to Connect</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Email */}
            <a href="mailto:tre@fitwithpulse.ai" className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-8 text-center group cursor-pointer transform hover:-translate-y-2 block">
              <div className="mb-4">
                <div className="w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-[#E0FE10]/20 transition-colors duration-300">
                  <svg className="w-8 h-8 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Email</h3>
              <p className="text-zinc-400 mb-4">For business inquiries and partnerships</p>
              <span className="text-[#E0FE10] group-hover:text-white transition-colors duration-300">
                tre@fitwithpulse.ai
              </span>
            </a>

            {/* LinkedIn */}
            <a href="https://linkedin.com/in/tremainegrant" target="_blank" rel="noopener noreferrer" className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-8 text-center group cursor-pointer transform hover:-translate-y-2 block">
              <div className="mb-4">
                <div className="w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-[#E0FE10]/20 transition-colors duration-300">
                  <svg className="w-8 h-8 text-[#E0FE10]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">LinkedIn</h3>
              <p className="text-zinc-400 mb-4">Connect professionally</p>
              <span className="text-[#E0FE10] group-hover:text-white transition-colors duration-300">
                Connect with me
              </span>
            </a>

            {/* Instagram */}
            <a href="https://instagram.com/fitwithpulse" target="_blank" rel="noopener noreferrer" className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-8 text-center group cursor-pointer transform hover:-translate-y-2 block">
              <div className="mb-4">
                <div className="w-16 h-16 bg-[#E0FE10]/10 rounded-full flex items-center justify-center mx-auto group-hover:bg-[#E0FE10]/20 transition-colors duration-300">
                  <svg className="w-8 h-8 text-[#E0FE10]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-white text-xl font-semibold mb-2">Instagram</h3>
              <p className="text-zinc-400 mb-4">Follow for fitness inspiration</p>
              <span className="text-[#E0FE10] group-hover:text-white transition-colors duration-300">
                @fitwithpulse
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Schedule a Meeting Section */}
      <section ref={useScrollFade()} className="py-24 bg-zinc-950 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E0FE10]/[0.03] rounded-full filter blur-[120px]"></div>
        </div>

        <div className="max-w-3xl mx-auto px-8 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-white text-4xl font-bold mb-4">Let's Talk</h2>
            <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto">
              Want to discuss partnerships, investment opportunities, or how Pulse can work for you?
              Book a 1-on-1 session — I'd love to connect.
            </p>
          </div>

          {/* Calendly Card */}
          <div className="relative group mx-auto max-w-lg">
            {/* Animated gradient border */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[#E0FE10]/60 via-[#E0FE10]/20 to-[#E0FE10]/60 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-sm"></div>
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[#E0FE10]/40 via-transparent to-[#E0FE10]/40 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative bg-zinc-900/90 backdrop-blur-xl rounded-2xl p-10 border border-zinc-700/50 group-hover:border-transparent transition-all duration-500">
              {/* Calendar Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <svg className="w-10 h-10 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-white text-2xl font-bold text-center mb-2">Book a 1-on-1</h3>
              <p className="text-zinc-400 text-center mb-8">
                30 minutes · Video call · Free
              </p>

              {/* CTA Button */}
              <a
                href="https://calendly.com/tre-aqo7/1-on-1"
                target="_blank"
                rel="noopener noreferrer"
                id="calendly-booking-button"
                className="w-full inline-flex items-center justify-center gap-3 bg-[#E0FE10] text-black px-8 py-4 rounded-xl font-semibold text-lg hover:bg-[#d4f00e] transition-all duration-300 hover:shadow-xl hover:shadow-[#E0FE10]/25 transform hover:-translate-y-1 active:translate-y-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Schedule a Meeting
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>

              <p className="text-zinc-500 text-sm text-center mt-4">
                Pick a time that works for you — powered by Calendly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Discover Creator Workouts Section */}
      <section ref={useScrollFade()} className="py-24 bg-zinc-900 relative overflow-hidden">
        {/* Background accents */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-500/[0.04] rounded-full filter blur-[100px]"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-[#E0FE10]/[0.03] rounded-full filter blur-[100px]"></div>
        </div>

        <div className="max-w-5xl mx-auto px-8 relative z-10">
          <div className="text-center mb-16">
            <span className="text-[#E0FE10] uppercase tracking-wider text-sm font-semibold mb-4 block">The Pulse App</span>
            <h2 className="text-white text-4xl sm:text-5xl font-bold mb-6">Discover Creator Workouts</h2>
            <p className="text-zinc-400 text-xl leading-relaxed max-w-2xl mx-auto">
              Follow fitness creators, join community workout rounds, and track your progress — all in one app.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Card 1 */}
            <div className="bg-zinc-800/40 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/30 hover:border-[#E0FE10]/30 transition-all duration-500 group hover:-translate-y-2">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-7 h-7 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-3">Creator-Led Workouts</h3>
              <p className="text-zinc-400 leading-relaxed">Browse and follow workouts designed by top fitness creators. Find your style and your community.</p>
            </div>

            {/* Card 2 */}
            <div className="bg-zinc-800/40 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/30 hover:border-[#E0FE10]/30 transition-all duration-500 group hover:-translate-y-2">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-7 h-7 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-3">Community Rounds</h3>
              <p className="text-zinc-400 leading-relaxed">Join fitness challenges with friends and creators. Push each other to stay consistent and accountable.</p>
            </div>

            {/* Card 3 */}
            <div className="bg-zinc-800/40 backdrop-blur-sm rounded-2xl p-8 border border-zinc-700/30 hover:border-[#E0FE10]/30 transition-all duration-500 group hover:-translate-y-2">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#E0FE10]/20 to-[#E0FE10]/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-7 h-7 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-white text-xl font-bold mb-3">Real-Time Tracking</h3>
              <p className="text-zinc-400 leading-relaxed">Log workouts, track runs with GPS, and sync with Apple Watch. Your data, beautifully visualized.</p>
            </div>
          </div>

          {/* Download Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <a
              href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"
              target="_blank"
              rel="noopener noreferrer"
              id="app-store-download"
              className="inline-flex items-center gap-3 bg-white text-black px-7 py-4 rounded-xl font-semibold text-lg hover:bg-zinc-100 transition-all duration-300 hover:shadow-xl hover:shadow-white/10 transform hover:-translate-y-1"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for iOS
            </a>

            <a
              href="/download"
              id="android-download"
              className="inline-flex items-center gap-3 border-2 border-zinc-600 text-white px-7 py-4 rounded-xl font-semibold text-lg hover:border-[#E0FE10] hover:text-[#E0FE10] transition-all duration-300 transform hover:-translate-y-1"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.341a.998.998 0 010-1.412l2.829-2.829-2.829-2.829a.998.998 0 111.412-1.412l3.535 3.535a1 1 0 010 1.414l-3.535 3.535a.997.997 0 01-1.412-.002zM6.477 15.341a.998.998 0 000-1.412L3.648 11.1l2.829-2.829a.998.998 0 10-1.412-1.412L1.53 10.394a1 1 0 000 1.414l3.535 3.535a.997.997 0 001.412-.002zM14.58 5.546l-5.656 13.418a1 1 0 001.838.776l5.656-13.418a1 1 0 00-1.838-.776z" />
              </svg>
              Coming Soon on Android
            </a>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-white text-4xl font-bold mb-8">Ready to Connect?</h2>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            Whether you're interested in partnerships, have feedback about Pulse, or just want to chat about
            the future of fitness technology — I'm always excited to connect with fellow innovators and fitness enthusiasts.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a
              href="mailto:tre@fitwithpulse.ai"
              className="inline-flex items-center justify-center gap-2 bg-[#E0FE10] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#E0FE10]/90 transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 transform hover:-translate-y-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send an Email
            </a>

            <a
              href="https://calendly.com/tre-aqo7/1-on-1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 border-2 border-[#E0FE10] text-[#E0FE10] px-8 py-4 rounded-lg font-semibold hover:bg-[#E0FE10] hover:text-black transition-all duration-300 transform hover:-translate-y-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book a Meeting
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GetInTouch; 