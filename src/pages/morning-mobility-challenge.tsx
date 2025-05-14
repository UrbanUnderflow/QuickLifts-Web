import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { useScrollFade } from '../hooks/useScrollFade';
// Import Swiper for testimonials
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/autoplay';
import { useRouter } from 'next/router';
import { trackEvent } from '../lib/analytics';
import mixpanel from 'mixpanel-browser';

// Helper stubs (replace with your actual implementations or imports)
function getReferral(): string {
  // Example: return from query param or localStorage
  return '';
}
function getUTM(param: string): string {
  // Example: parse from URL
  return '';
}
function sha256(str: string): string {
  // You need to implement or import a SHA-256 hash function here
  return str;
}
function throttle<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let last = 0;
  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - last > wait) {
      last = now;
      fn.apply(this, args);
    }
  } as T;
}

declare global {
  interface Window {
    ttq?: {
      track: (event: string, params?: Record<string, any>) => void;
    };
    deepFired?: boolean;
  }
}

const MorningMobilityChallengePage: NextPage = () => {
  // Add countdown timer state
  const [daysLeft, setDaysLeft] = useState(12);
  const router = useRouter();
  
  // Update countdown timer (for demo purposes)
  useEffect(() => {
    // In production, calculate the actual days remaining until May 6, 2025
    const startDate = new Date('2025-05-06T00:00:00');
    const today = new Date();
    const timeLeft = startDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
    
    if (daysRemaining > 0) {
      setDaysLeft(daysRemaining);
    } else {
      setDaysLeft(0);
    }
  }, []);

  useEffect(() => {
    // Track Page View on load
    const distinctId = mixpanel.get_distinct_id();
    trackEvent(distinctId, 'PageView - Morning Mobility Challenge', {
      page_path: window.location.pathname,
    });

    // 1. Track primary CTA clicks (DEPRECATED - Replaced by trackEvent below)
    // document.querySelectorAll('.join-btn').forEach(btn => {
    //   btn.addEventListener('click', () => {
    //     if (window.ttq) {
    //       window.ttq.track('ClickCTA', {
    //         referral_code: getReferral() || 'none',
    //         utm_campaign: getUTM('utm_campaign')
    //       });
    //     }
    //   });
    // });

    // 3. Optional: fire a second PageView for deep scroll
    const onScroll = throttle(() => {
      if (window.scrollY > 1200 && !window.deepFired) {
        // Use trackEvent for deep scroll
        const distinctId = mixpanel.get_distinct_id();
        trackEvent(distinctId, 'Scroll - Deep View', {
          page_path: window.location.pathname,
        });
        
        // Original TikTok tracking (keep if still needed alongside main analytics)
        if (window.ttq) {
          window.ttq.track('PageDeepView');
        }
        window.deepFired = true;
      }
    }, 1000);

    window.addEventListener('scroll', onScroll);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900">
      <Head>
        <title>Morning Mobility Challenge – Win $1,000 | Pulse Fitness</title>
        <meta 
          name="description" 
          content="90-day mobility challenge by Pulse. Improve flexibility in 10 min/day and compete for a $1,000 cash prize." 
        />
        <meta property="og:title" content="Morning Mobility Challenge – Win $1,000 | Pulse Fitness" />
        <meta 
          property="og:description" 
          content="90-day mobility challenge by Pulse. Improve flexibility in 10 min/day and compete for a $1,000 cash prize." 
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/MorningMobilityChallenge.png" />
      </Head>

      {/* Hero Section */}
      <main ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        {/* Phone Frame Container (Left) */}
        <div className="relative w-[300px] sm:w-[380px]">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px]">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10]" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                src="/morningmobility.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="max-w-xl">
          {/* Added countdown ribbon */}
          <div className="bg-[#FF6B35] text-white px-5 py-2 rounded-lg inline-block mb-6 transform -rotate-2 font-bold">
            {daysLeft > 0 ? `Challenge starts in ${daysLeft} days!` : "Challenge is live!"}
          </div>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-[#E0FE10] text-black px-3 py-1 rounded-full text-sm font-semibold">
              $1,000 PRIZE
            </div>
            <div className="bg-zinc-800 text-white px-3 py-1 rounded-full text-sm">
              May 6 - August 3, 2025
            </div>
          </div>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Morning Mobility Challenge
          </h1>
          
          {/* Updated benefit-focused copy */}
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            <strong className="text-white">Win $1,000 while improving flexibility in just 10 minutes a day.</strong> Boost 
            mobility, reduce stiffness, and compete for $1,000—all before breakfast. Join a community 
            of motivated individuals committed to improving flexibility, reducing pain, and 
            establishing a consistent morning routine.
          </p>
          
          {/* Dynamic Join the Challenge button with ttclid */}
          <button
            type="button"
            className="join-btn bg-[#E0FE10] text-black px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 inline-flex items-center hover:brightness-110 hover:-translate-y-1 hover:shadow-lg"
            onClick={async () => {
              let ttclid = '';
              if (
                typeof window !== 'undefined' &&
                window.ttq &&
                typeof (window.ttq as any).instance === 'function'
              ) {
                try {
                  const user = (window.ttq as any).instance('D03A763C77UE0J0RV17G').getUser();
                  ttclid = user && user.ttclid ? user.ttclid : '';
                } catch (e) {
                  ttclid = '';
                }
              }
              const baseUrl = '/round-invitation/Kel8IL0kWpbie4PXRVgZ?id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&sharedBy=Bq6zlqIlSdPUGki6gsv6X9TdVtG3';
              const url = ttclid ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}ttclid=${ttclid}` : baseUrl;
              // Track "Join Challenge" click (Hero)
              const distinctId = mixpanel.get_distinct_id();
              trackEvent(distinctId, 'Click - Join Challenge CTA', {
                location: 'hero',
                target_url: url,
              });

              if (router && router.push) {
                router.push(url);
              } else {
                window.location.href = url;
              }
            }}
          >
            Join the Challenge
            <svg className="w-5 h-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </main>

      {/* How It Works Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">1</div>
              <h3 className="text-white text-2xl font-bold mb-4">Join the Round</h3>
              <p className="text-zinc-400">Download the Pulse app and join the "Morning Mobility Challenge" Round from the Discover tab.</p>
            </div>
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">2</div>
              <h3 className="text-white text-2xl font-bold mb-4">Complete Workouts</h3>
              <p className="text-zinc-400">Follow the daily mobility workouts and tap "Complete" in the app to earn points.</p>
            </div>
            <div className="bg-zinc-900 p-8 rounded-xl">
              <div className="w-16 h-16 bg-[#E0FE10] text-black rounded-full flex items-center justify-center text-2xl font-bold mb-6">3</div>
              <h3 className="text-white text-2xl font-bold mb-4">Win Prizes</h3>
              <p className="text-zinc-400">Climb the leaderboard by consistently completing workouts and referring friends. The top participant wins $1,000!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section with Swiper */}
      <section ref={useScrollFade()} className="py-16 bg-zinc-800">
        <div className="container mx-auto px-8">
          <div className="max-w-4xl mx-auto">
            <Swiper
              spaceBetween={20}
              slidesPerView={1}
              centeredSlides={true}
              loop={true}
              autoplay={{
                delay: 4000,
                disableOnInteraction: true,
                pauseOnMouseEnter: true
              }}
              pagination={{
                clickable: true,
                bulletActiveClass: 'swiper-pagination-bullet-active bg-[#E0FE10]'
              }}
              breakpoints={{
                640: {
                  slidesPerView: 1
                },
                768: {
                  slidesPerView: 2
                },
                1024: {
                  slidesPerView: 3
                }
              }}
              className="testimonial-swiper py-8"
            >
              <SwiperSlide>
                <div className="bg-zinc-900 p-6 rounded-xl h-full">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">AR</div>
                    <div>
                      <div className="text-white font-semibold">Alex R.</div>
                      <div className="text-zinc-400 text-sm">Member since 2024</div>
                    </div>
                    <div className="ml-auto flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg key={star} className="w-5 h-5 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-white">"My hip pain is gone after 3 weeks! I've tried many routines but this one actually stuck."</p>
                </div>
              </SwiperSlide>
              
              <SwiperSlide>
                <div className="bg-zinc-900 p-6 rounded-xl h-full">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">CM</div>
                    <div>
                      <div className="text-white font-semibold">Cassidy M.</div>
                      <div className="text-zinc-400 text-sm">Member since 2023</div>
                    </div>
                    <div className="ml-auto flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg key={star} className="w-5 h-5 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-white">"Gamified workouts finally made me stick to a routine. I've never been this consistent with anything fitness-related!"</p>
                </div>
              </SwiperSlide>
              
              <SwiperSlide>
                <div className="bg-zinc-900 p-6 rounded-xl h-full">
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="flex justify-center mb-2">
                        {[1, 2, 3, 4].map(star => (
                          <svg key={star} className="w-6 h-6 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <svg className="w-6 h-6 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                      <div className="text-white font-bold text-xl mb-1">4.8★ on App Store</div>
                      <p className="text-zinc-400 text-sm">500+ Active Users</p>
                      <div className="mt-2 bg-zinc-800 rounded-lg px-3 py-1 inline-block">
                        <p className="text-white text-xs">Featured on Product Hunt</p>
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
              
              <SwiperSlide>
                <div className="bg-zinc-900 p-6 rounded-xl h-full">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-4">JD</div>
                    <div>
                      <div className="text-white font-semibold">Jamie D.</div>
                      <div className="text-zinc-400 text-sm">Member since 2024</div>
                    </div>
                    <div className="ml-auto flex">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg key={star} className="w-5 h-5 text-[#E0FE10]" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-white">"These morning workouts have completely transformed my energy levels throughout the day. I'm hooked!"</p>
                </div>
              </SwiperSlide>
            </Swiper>
          </div>
        </div>
      </section>

      {/* Earn Points */}
      <section className="py-20 bg-zinc-900">
      <div className="container mx-auto px-8">
        <h2 className="text-white text-4xl font-bold text-center mb-4">How To Earn Points</h2>
        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-3">Multiple ways to earn points and climb the leaderboard.</p>
        <p className="text-[#E0FE10] text-center max-w-2xl mx-auto mb-16">Current leader: 3,780 points – Think you can beat that?</p>
        
        <div className="bg-zinc-800 rounded-xl overflow-hidden max-w-3xl mx-auto shadow-xl">
          {/* Points Items */}
          <div className="divide-y divide-zinc-700">
            {/* Base Completion */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#E0FE10] rounded-full flex items-center justify-center text-black flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">Base Completion</h3>
                <p className="text-zinc-400">Earn 100 points every time you complete a workout in the challenge.</p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="text-[#E0FE10] font-bold text-2xl">100</span>
                <span className="text-[#E0FE10] font-medium block text-right">points</span>
              </div>
            </div>
            
            {/* First Completion Bonus */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#FFC107] rounded-full flex items-center justify-center text-black flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">First Completion Bonus</h3>
                <p className="text-zinc-400">Get a special one-time bonus for completing your first workout in the challenge.</p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="text-[#FFC107] font-bold text-2xl">50</span>
                <span className="text-[#FFC107] font-medium block text-right">points</span>
              </div>
            </div>
            
            {/* Streak Bonus */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#FF5722] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">Streak Bonus</h3>
                <p className="text-zinc-400">Build a streak by completing workouts on consecutive days to earn bonus points.</p>
              </div>
              <div className="ml-4 flex-shrink-0 text-right">
                <span className="text-[#FF5722] font-bold text-2xl block">25</span>
                <span className="block">
                  <span className="text-[#FF5722] font-medium">points </span>
                  <span className="text-zinc-400 text-sm">(per day)</span>
                </span>
              </div>
            </div>
            
            {/* Check-in Bonus */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#3B82F6] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">Check-in Bonus</h3>
                <p className="text-zinc-400">Earn extra points by completing your check-in at the end of your workout, on the summary screen.</p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="text-[#3B82F6] font-bold text-2xl">25</span>
                <span className="text-[#3B82F6] font-medium block text-right">points</span>
              </div>
            </div>
            
            {/* Invitation Bonus */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#9333EA] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">Invitation Bonus</h3>
                <p className="text-zinc-400">Receive bonus points when someone you invite joins the challenge.</p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="text-[#9333EA] font-bold text-2xl">25</span>
                <span className="text-[#9333EA] font-medium block text-right">points</span>
              </div>
            </div>
            
            {/* Social Share Bonus */}
            <div className="flex items-center p-5 hover:bg-zinc-750 transition-colors">
              <div className="w-14 h-14 bg-[#EC4899] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                </svg>
              </div>
              <div className="ml-5 flex-1">
                <h3 className="text-white text-xl font-semibold">Social Share Bonus</h3>
                <p className="text-zinc-400">Post your check-in on Instagram and tag @fitwithpulse to earn extra points when we repost it.</p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="text-[#EC4899] font-bold text-2xl">5</span>
                <span className="text-[#EC4899] font-medium block text-right">points</span>
              </div>
            </div>
          </div>
          
          {/* Points Example */}
          <div className="bg-zinc-900 p-6 border-t border-zinc-700">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-[#E0FE10] rounded-full flex items-center justify-center text-black flex-shrink-0 mr-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-[#E0FE10] text-xl font-bold">Points Example</h4>
            </div>
            
            <p className="text-zinc-400 mb-4">
              If you complete your first workout, maintain a 3-day streak, do your check-in, invite a 
              friend who joins, and get your Instagram story reposted, you'd earn:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">Base completion</span>
                <span className="text-white font-semibold">100 points</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">First workout bonus</span>
                <span className="text-white font-semibold">50 points</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">3-day streak bonus</span>
                <span className="text-white font-semibold">75 points</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">Check-in bonus</span>
                <span className="text-white font-semibold">25 points</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">Invitation bonus</span>
                <span className="text-white font-semibold">25 points</span>
              </div>
              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-lg">
                <span className="text-zinc-300">Social share bonus</span>
                <span className="text-white font-semibold">5 points</span>
              </div>
            </div>
            
            <div className="bg-[#1E293B] p-4 rounded-xl flex items-center justify-between">
              <span className="text-white font-semibold">TOTAL:</span>
              <span className="text-[#E0FE10] text-2xl font-bold">280 points</span>
            </div>
          </div>
        </div>
      </div>
    </section>

      
      {/* Official Rules Section - Now with accordion */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-4">Official Rules</h2>
          <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-6">Morning Mobility Challenge – Official Rules (Version 1.0)</p>
          
          <div className="max-w-4xl mx-auto bg-zinc-900 rounded-xl p-6">
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">1. Sponsor - Pulse Fitness Collective, Inc.</summary>
              <p className="text-zinc-400 pt-2 pl-4">Pulse Fitness Collective, Inc. ("Pulse"), 1234 Peachtree St NE, Suite 500, Atlanta, GA 30309. This promotion is in no way sponsored, endorsed, or administered by Apple Inc., Google LLC, Meta Platforms, or TikTok.</p>
            </details>
            
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">2. Eligibility - US/Canada residents 18+, Pulse account required</summary>
              <div className="pt-2 pl-4">
                <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                  <li>Open to natural persons 18 years or older at the time of entry.</li>
                  <li>Must be a legal resident of the United States or Canada (excluding Quebec).</li>
                  <li>Must have a valid Pulse account (free trial or paid).</li>
                  <li>Employees, contractors, and immediate family members of Pulse are not eligible to win prize money.</li>
                </ul>
              </div>
            </details>
            
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">3. Contest Period - May 6 to August 3, 2025</summary>
              <p className="text-zinc-400 pt-2 pl-4">Begins 12:01 AM ET 6 May 2025 and ends 11:59 PM ET 3 August 2025 ("Contest Period"). All challenge activity and point totals must be recorded in‑app within this window.</p>
            </details>
            
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">4. How to Enter - Download app and join the Round</summary>
              <div className="pt-2 pl-4">
                <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                  <li>Download or open the Pulse app.</li>
                  <li>Join the "Morning Mobility Challenge" Round from the Discover tab.</li>
                  <li>Complete mobility workouts and referral tasks to earn points.</li>
                  <li>Track each completed workout in the app by tapping Complete.</li>
                  <li>Manual entries or outside timers will not be counted.</li>
                </ul>
              </div>
            </details>
            
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">5. Scoring & Winner Selection - Points system and leaderboard</summary>
              <div className="pt-2 pl-4 space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-1">Points System</h4>
                  <ul className="text-zinc-400 list-disc pl-5 space-y-1">
                    <li>+10 pts per completed Mobility Challenge workout (daily limit 1)</li>
                    <li>+5 pts per successful referral who joins the Round</li>
                    <li>+2 pts for posting a workout video recap within the Round feed</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Leaderboard</h4>
                  <p className="text-zinc-400">Points update in real‑time inside the Round leaderboard.</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Winner</h4>
                  <p className="text-zinc-400">The eligible participant with the highest verified point total at the Contest end date will be the Grand‑Prize Winner.</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Tie‑breaker</h4>
                  <p className="text-zinc-400">Earliest time stamp of final point‑earning activity wins.</p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-1">Verification</h4>
                  <p className="text-zinc-400">Pulse will audit workout logs and may request proof (video or Apple Health data). Failure to verify within 7 days forfeits the prize.</p>
                </div>
              </div>
            </details>
            
            <details className="mb-4">
              <summary className="text-white font-semibold cursor-pointer py-2">Sections 6-13: Prize, Taxes, Publicity, Code of Conduct, Limitation of Liability, etc.</summary>
              <div className="pt-2 pl-4 space-y-4">
                <div>
                  <h3 className="text-[#E0FE10] font-semibold mb-2">6. Prize</h3>
                  <p className="text-zinc-400">One (1) Grand Prize: USD $1,000, awarded via PayPal or ACH within 14 days of winner verification. Approximate Retail Value (ARV): $1,000.</p>
                </div>
                
                <div>
                  <h3 className="text-[#E0FE10] font-semibold mb-2">7. Taxes</h3>
                  <p className="text-zinc-400">Prize winner is solely responsible for any federal, state, or local taxes. U.S. winners will receive an IRS Form 1099‑MISC if cumulative prizes exceed $600 in a calendar year and must submit a completed Form W‑9 before funds are released.</p>
                </div>
                
                {/* Additional rules sections removed for brevity in this example */}
                
                <div>
                  <h3 className="text-[#E0FE10] font-semibold mb-2">13. Contact</h3>
                  <p className="text-zinc-400">Questions? Email hello@fitwithpulse.ai with subject line "Mobility Challenge Rules".</p>
                </div>
              </div>
            </details>
            
            <div className="mt-4 text-center">
              <a 
                href="/rules-full.pdf" 
                className="text-[#E0FE10] font-semibold hover:underline"
              >
                Download Full Official Rules PDF
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="join-now" ref={useScrollFade()} className="py-20 bg-zinc-900">
        <div className="container mx-auto px-8 text-center">
          <h2 className="text-white text-5xl font-bold mb-6">Ready to transform your mornings?</h2>
          <p className="text-zinc-400 text-xl max-w-2xl mx-auto mb-10">
            Join the Morning Mobility Challenge today and start your journey towards better mobility, consistency, and a chance to win $1,000.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              type="button"
              className="join-btn bg-[#E0FE10] text-black px-8 py-4 rounded-full text-lg font-semibold transition-all duration-300 hover:brightness-110 hover:-translate-y-1 hover:shadow-lg"
              onClick={async () => {
                let ttclid = '';
                if (
                  typeof window !== 'undefined' &&
                  window.ttq &&
                  typeof (window.ttq as any).instance === 'function'
                ) {
                  try {
                    const user = (window.ttq as any).instance('D03A763C77UE0J0RV17G').getUser();
                    ttclid = user && user.ttclid ? user.ttclid : '';
                  } catch (e) {
                    ttclid = '';
                  }
                }
                const baseUrl = '/round-invitation/Kel8IL0kWpbie4PXRVgZ?id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&sharedBy=Bq6zlqIlSdPUGki6gsv6X9TdVtG3';
                const url = ttclid ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}ttclid=${ttclid}` : baseUrl;
                // Track "Join Challenge" click (Bottom CTA)
                const distinctId = mixpanel.get_distinct_id();
                trackEvent(distinctId, 'Click - Join Challenge CTA', {
                  location: 'bottom_cta',
                  target_url: url,
                });

                if (router && router.push) {
                  router.push(url);
                } else {
                  window.location.href = url;
                }
              }}
            >
              Join the Challenge
            </button>
            <a 
              href="https://apps.apple.com/ag/app/pulse-community-fitness/id6451497729"
              className="bg-zinc-800 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
              onClick={() => {
                // Track "Download App" click (Bottom CTA)
                const distinctId = mixpanel.get_distinct_id();
                trackEvent(distinctId, 'Click - Download App', {
                  location: 'bottom_cta',
                  target_url: 'https://apps.apple.com/ag/app/pulse-community-fitness/id6451497729',
                });
              }}
            >
              <span>Download App</span>
              <div className="flex items-center">
                <img src="/applelogo.png" alt="Download on App Store" className="h-6" />
              </div>
            </a>
          </div>
        </div>
      </section>
      
      {/* FAQ Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="container mx-auto px-8">
          <h2 className="text-white text-4xl font-bold text-center mb-16">Frequently Asked Questions</h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">Do I need any special equipment?</h3>
              <p className="text-zinc-400">No special equipment is required! All mobility workouts can be done with just your bodyweight and a small amount of floor space.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">How long are the mobility workouts?</h3>
              <p className="text-zinc-400">Each mobility workout takes approximately 10-15 minutes to complete, perfect for fitting into your morning routine.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">What if I miss a day?</h3>
              <p className="text-zinc-400">While consistency is encouraged, missing a day won't disqualify you. The challenge is designed to accommodate real life, so just pick up where you left off!</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">How is the winner determined?</h3>
              <p className="text-zinc-400">The participant with the highest total points at the end of the 90-day challenge period will win the $1,000 grand prize. Points are earned through daily workouts, referrals, and posting videos.</p>
            </div>
            
            <div className="bg-zinc-900 p-6 rounded-xl">
              <h3 className="text-white text-xl font-semibold mb-2">Can I join after the start date?</h3>
              <p className="text-zinc-400">Yes! You can join the challenge at any point during the contest period. However, for the best chance at winning, we recommend joining as early as possible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky CTA Bar */}
      <div className="fixed bottom-4 left-0 right-0 mx-auto max-w-lg px-4 z-50">
        <div className="bg-zinc-800 rounded-full p-2 flex justify-between shadow-xl">
          <a 
            href="#join-now"
            className="bg-[#E0FE10] text-black px-5 py-3 rounded-full font-semibold hover:brightness-110 transition-all flex-1 text-center mr-2"
          >
            Join Now
          </a>
          <a 
            href="https://apps.apple.com/ag/app/pulse-community-fitness/id6451497729"
            className="bg-zinc-700 text-white px-5 py-3 rounded-full font-semibold hover:bg-zinc-600 transition-colors flex items-center justify-center"
            onClick={() => {
              // Track "Download App" click (Sticky Bar)
              const distinctId = mixpanel.get_distinct_id();
              trackEvent(distinctId, 'Click - Download App', {
                location: 'sticky_bar',
                target_url: 'https://apps.apple.com/ag/app/pulse-community-fitness/id6451497729',
              });
            }}
          >
            <span className="mr-2">Download</span>
            <div className="flex items-center">
              <img src="/applelogo.png" alt="Download on App Store" className="h-5" />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default MorningMobilityChallengePage;