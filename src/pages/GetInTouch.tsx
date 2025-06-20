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
              <h2 className="text-white text-4xl font-bold mb-6">About Me</h2>
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
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
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
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
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

      {/* Morning Mobility Challenge Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-8 text-center">
          <h2 className="text-white text-4xl font-bold mb-8">Join the Morning Mobility Challenge</h2>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 max-w-3xl mx-auto">
            Start your day with purpose and movement. Our Morning Mobility Challenge is designed to help you 
            build a sustainable morning routine that sets the tone for a productive, energized day.
          </p>
          
          <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
            {/* QR Code */}
            <div className="bg-white p-8 rounded-2xl shadow-2xl">
              <img 
                src="/MorningMobilityQR.png" 
                alt="Morning Mobility Challenge QR Code" 
                className="w-64 h-64 mx-auto"
              />
              <p className="text-zinc-800 font-semibold mt-4">Scan to join the challenge</p>
            </div>
            
            {/* Challenge Info */}
            <div className="max-w-md text-left">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Scan the QR Code</h3>
                    <p className="text-zinc-400">Use your phone's camera to scan the QR code and get instant access to the challenge.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Download Pulse</h3>
                    <p className="text-zinc-400">Join our community platform and connect with others on the same journey.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-black font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-2">Start Moving</h3>
                    <p className="text-zinc-400">Begin your daily mobility routine and track your progress with the community.</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <a 
                  href="https://fitwithpuls.onelink.me/kSfU?pid=user_share&c=round_share&af_referrer_customer_id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&deep_link_value=round&roundId=pP7O9mx3LIwc3NIbZbSk&id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&sharedBy=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&af_og_title=Morning%20Mobility%20Challenge&af_og_description=Join%20me%20in%20this%20fitness%20challenge%20on%20Pulse!%20%F0%9F%8F%8B%EF%B8%8F%E2%80%8D%E2%99%82%EF%B8%8F%20Apr%2017,%202025%20-%20Apr%2024,%202025&af_og_image=https://fitwithpulse.ai/round-preview.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-[#E0FE10] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/20 transform hover:-translate-y-1"
                >
                  🏋️‍♂️ Join Challenge Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                
                <a 
                  href="/morning-mobility-challenge" 
                  className="inline-flex items-center justify-center gap-2 border-2 border-[#E0FE10] text-[#E0FE10] px-6 py-3 rounded-lg font-semibold hover:bg-[#E0FE10] hover:text-black transition-colors duration-300"
                >
                  Learn More About the Challenge
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-white text-4xl font-bold mb-8">Ready to Connect?</h2>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12">
            Whether you're interested in partnerships, have feedback about Pulse, or just want to chat about 
            the future of fitness technology, I'm always excited to connect with fellow innovators and fitness enthusiasts.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a 
              href="mailto:tre@fitwithpulse.ai"
              className="inline-flex items-center justify-center gap-2 bg-[#E0FE10] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#E0FE10]/90 transition-colors duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send an Email
            </a>
            
            <a 
              href="/morning-mobility-challenge"
              className="inline-flex items-center justify-center gap-2 border-2 border-[#E0FE10] text-[#E0FE10] px-8 py-4 rounded-lg font-semibold hover:bg-[#E0FE10] hover:text-black transition-colors duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Join the Challenge
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GetInTouch; 