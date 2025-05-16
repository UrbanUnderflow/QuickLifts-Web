import type { NextPage, GetServerSideProps } from 'next';
import React from 'react';
import Footer from '../components/Footer/Footer';
import FAQ from '../components/FAQ';
import { useScrollFade } from '../hooks/useScrollFade';
import PageHead from '../components/PageHead';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string; 
}

interface AboutPageProps {
  metaData: SerializablePageMetaData | null;
}

const AboutPage: NextPage<AboutPageProps> = ({ metaData }) => {

  const scrollToElement = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const faqData = [
    {
      question: "What is the Fitness Collective?",
      answer: "The Fitness Collective transcends a typical fitness community. While communities foster connection and support, a collective goes further, empowering its members to shape the very thing they're a part of. They contribute with user-generated content (exercises, videos, workouts), democratized influence, shared knowledge. <br /><br /><b>Think of it this way:</b> A community consumes, a collective creates. The Fitness Collective is where fitness lovers can not only find support and inspiration but also leave their own unique mark on the platform they love."
    },
    {
      question: "How does Pulse track my progress?",
      answer: "Pulse tracks your progress by allowing you to log your workouts through statistics and videos. <br /> <br />Pulse AI takes this information and applies a score called a <b>Work Score</b> to your sessions that you can easily focus on improving one session at a time."
    },
    {
      question: "Is Pulse available for both iOS and Android?",
      answer: "We are currently only on iOS, but you can use the web app on Android devices <a className='text-blue-500 hover:text-blue-700 focus:text-blue-700' href='https://fitwithpulse.ai/dashboard'>here</a>"
    },
    {
      question: "How do I get started?",
      answer: "Getting started is as easy as just downloading the app! <br /><br /> <a className='text-blue-500 hover:text-blue-700 focus:text-blue-700' href='https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729'>Download Now</a>"
    },
    {
      question: "How do I find and follow other users?",
      answer: "Our workouts are your gateway to connection. See community members in action as you exercise. Discover new people to follow and get inspired with every rep."
    },
    {
      question: "Can I create and share my own workouts?",
      answer: "Yes! You can create your own exercises, workouts, and shoot your own videos to share with the collective. You can also share your workouts with friends and family directly."
    },
    {
      question: "Are there community challenges or events?",
      answer: "Yes! We have in-app and real-world challenges, but you have to stay connected to catch them!"
    },
    {
      question: "Can I export my workout data?",
      answer: "Absolutely! Your data is yours, and we make it easy to take it with you anywhere you decide to go."
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-900">
      <PageHead 
        metaData={metaData}
        pageOgUrl="https://fitwithpulse.ai/about"
      />

      {/* What is Pulse Section */}
      <section ref={useScrollFade()} className="relative min-h-screen flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden animate-gradient-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-1000"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer animate-fade-in-up animation-delay-300">
            What is Pulse
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Pulse: Community Fitness
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            A platform where fitness enthusiasts create, share, and grow together. 
            Pulse transforms solo workouts into shared experiences and individual progress 
            into collective inspiration.
          </p>
          <div className="flex flex-wrap justify-center gap-6 animate-fade-in-up animation-delay-1200">
            <div className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-500 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-1 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/0 via-[#E0FE10]/5 to-[#E0FE10]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer"></div>
              <h3 className="text-white text-xl font-semibold mb-2">Create</h3>
              <p className="text-zinc-400">Share exercises & routines</p>
            </div>
            <div className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-500 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-1 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/0 via-[#E0FE10]/5 to-[#E0FE10]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer"></div>
              <h3 className="text-white text-xl font-semibold mb-2">Connect</h3>
              <p className="text-zinc-400">Join challenges & motivate others</p>
            </div>
            <div className="bg-zinc-800/50 hover:bg-zinc-800 transition-all duration-500 hover:shadow-lg hover:shadow-[#E0FE10]/20 rounded-xl p-6 max-w-[280px] cursor-pointer transform hover:-translate-y-1 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#E0FE10]/0 via-[#E0FE10]/5 to-[#E0FE10]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-shimmer"></div>
              <h3 className="text-white text-xl font-semibold mb-2">Grow</h3>
              <p className="text-zinc-400">Track progress & celebrate wins</p>
            </div>
          </div>
        </div>
      </section>

      {/* Hierarchy Flowchart Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-center text-white text-3xl font-bold mb-16">The Pulse Ecosystem</h2>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative">
            {/* Connecting lines */}
            <div className="hidden md:block absolute inset-0 z-0">
              <div className="absolute top-1/2 left-1/4 right-3/4 h-1 bg-gradient-to-r from-[#E0FE10] to-[#E0FE10]/70 transform -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 right-1/4 h-1 bg-gradient-to-r from-[#E0FE10]/70 to-[#E0FE10]/40 transform -translate-y-1/2"></div>
            </div>
            
            {/* Mobile connecting lines */}
            <div className="md:hidden absolute left-1/2 top-[22%] bottom-[78%] w-1 bg-gradient-to-b from-[#E0FE10] to-[#E0FE10]/70 transform -translate-x-1/2"></div>
            <div className="md:hidden absolute left-1/2 top-[55%] bottom-[45%] w-1 bg-gradient-to-b from-[#E0FE10]/70 to-[#E0FE10]/40 transform -translate-x-1/2"></div>
            
            {/* Move Card */}
            <div 
              onClick={() => scrollToElement('move-section')}
              className="bg-zinc-900/80 rounded-xl p-6 w-full md:w-[30%] relative z-10 border border-[#E0FE10] hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-[#E0FE10] flex items-center justify-center font-bold text-black">1</div>
              <h3 className="text-[#E0FE10] text-2xl font-bold mb-3">Move</h3>
              <p className="text-zinc-400">The foundation: short video clips of exercises that form the building blocks of your fitness journey.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-[#E0FE10]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
            
            {/* Stack Card */}
            <div 
              onClick={() => scrollToElement('stack-section')}
              className="bg-zinc-900/80 rounded-xl p-6 w-full md:w-[30%] relative z-10 border border-[#E0FE10]/70 hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-[#E0FE10]/70 flex items-center justify-center font-bold text-black">2</div>
              <h3 className="text-[#E0FE10]/70 text-2xl font-bold mb-3">Stack</h3>
              <p className="text-zinc-400">Combine Moves to create complete workout routines that you can share or follow.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-[#E0FE10]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
            
            {/* Round Card */}
            <div 
              onClick={() => scrollToElement('round-section')}
              className="bg-zinc-900/80 rounded-xl p-6 w-full md:w-[30%] relative z-10 border border-[#E0FE10]/40 hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all duration-300 group cursor-pointer"
            >
              <div className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-[#E0FE10]/40 flex items-center justify-center font-bold text-black">3</div>
              <h3 className="text-[#E0FE10]/40 text-2xl font-bold mb-3">Round</h3>
              <p className="text-zinc-400">Join community fitness challenges where members work out, compete, and support each other.</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-6 h-6 text-[#E0FE10]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Moves Section */}
      <section id="move-section" ref={useScrollFade()} className="min-h-screen flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="relative w-[300px] sm:w-[380px] group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10] group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/ThisIsPulseNoSound.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
            The Foundation
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Everything starts with a <span className="text-[#E0FE10]">Move</span>
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            A Move is the fundamental building block of Pulse. It's a 5-30 second video clip of a lift, stretch, exercise, or movement that is used to build a workout. Build your library of movements from basic exercises to complex variations, each Move you create becomes part of yours or maybe someone else fitness journey.
          </p>
        </div>
      </section>

      {/* Stacks Section */}
      <section id="stack-section" ref={useScrollFade()} className="min-h-screen bg-black flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="max-w-xl lg:order-1">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
            Build The Blocks
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-4xl sm:text-5xl font-bold mb-6">
            <span className="text-[#E0FE10]">Stack</span> your Moves into workouts
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Combine your Moves into powerful workouts called Stacks. Create personalized routines that target your goals, share them with the community, or discover Stacks created by others. Each Stack is a curated collection of Moves designed to challenge and inspire.
          </p>
        </div>
        <div className="relative w-[300px] sm:w-[380px] lg:order-2 group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10] group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/stack.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
      </section>

      {/* Community Section */}
      <section id="round-section" ref={useScrollFade()} className="min-h-screen bg-zinc-900 flex flex-col lg:flex-row items-center justify-center gap-20 p-8">
        <div className="relative w-[300px] sm:w-[380px] group">
          <div className="relative aspect-[9/19.5] rounded-[3rem] p-[2px] transition-transform duration-500 transform group-hover:scale-105">
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[#E0FE10] group-hover:border-4 transition-all duration-300" />
            <div className="relative h-full w-full rounded-[3rem] overflow-hidden bg-zinc-900">
              <video
                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-300"
                autoPlay
                loop
                muted
                playsInline
                src="/rounds.mp4"
                poster="/sample-round-poster.jpg"
              />
            </div>
          </div>
          <div className="absolute -z-10 inset-0 rounded-[3rem] bg-[#E0FE10]/20 blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
        </div>
        <div className="max-w-xl">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
            The Community
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-6xl font-bold mb-6">
            Join a <span className="text-[#E0FE10]">Round</span> and compete together
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Participate in community fitness challenges called Rounds where multiple people work out together. Chat, support, and check in with fellow participants as you compete for points. Earn rewards by completing workouts and engaging with your fellow Rounders in these time-based challenges that build community and accountability.
          </p>
        </div>
      </section>

      {/* Why Choose Pulse Section */}
      <section ref={useScrollFade()} className="min-h-screen bg-black py-20">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Why Choose Pulse
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold">
              Not Just Another Fitness App: <br /><span className="text-[#E0FE10]">With Pulse, You Shape The Experience</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
            <div className="hover:bg-zinc-900/50 p-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/10 cursor-pointer">
              <h4 className="text-white text-xl font-semibold mb-4 group relative inline-block">
                User-Generated Content
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E0FE10] transition-all duration-300 group-hover:w-full"></span>
              </h4>
              <p className="text-zinc-400">Unlike platforms with fixed workout libraries, Pulse lets you create and share your own exercises and routines. For trainers, this means a powerful tool to scale your influence and showcase your expertise to a wider audience.</p>
            </div>
            <div className="hover:bg-zinc-900/50 p-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/10 cursor-pointer">
              <h4 className="text-white text-xl font-semibold mb-4 group relative inline-block">
                Community Challenges
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E0FE10] transition-all duration-300 group-hover:w-full"></span>
              </h4>
              <p className="text-zinc-400">Our Rounds feature turns fitness into a social experience. Trainers can create branded competitions to keep clients engaged, while fitness enthusiasts can find accountability partners that make showing up feel effortless.</p>
            </div>
            <div className="hover:bg-zinc-900/50 p-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/10 cursor-pointer">
              <h4 className="text-white text-xl font-semibold mb-4 group relative inline-block">
                Data-Driven Growth
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#E0FE10] transition-all duration-300 group-hover:w-full"></span>
              </h4>
              <p className="text-zinc-400">We track meaningful metrics with our Work Score system that matters for lasting change. Get actionable insights that both trainers and clients can use to optimize workouts and celebrate real progress.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section ref={useScrollFade()} className="bg-zinc-900 py-20">
        <FAQ title="Frequently Asked Questions" 
        items={faqData}
        theme="dark"
         />
      </section>

      <Footer />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<AboutPageProps> = async (context) => {
  let rawMetaData: FirestorePageMetaData | null = null;
  try {
    rawMetaData = await adminMethods.getPageMetaData('about');
  } catch (error) {
    console.error("Error fetching page meta data for about page:", error);
  }

  let serializableMetaData: SerializablePageMetaData | null = null;
  if (rawMetaData) {
    serializableMetaData = {
      ...rawMetaData,
      lastUpdated: rawMetaData.lastUpdated.toDate().toISOString(),
    };
  }

  return {
    props: {
      metaData: serializableMetaData,
    },
  };
};

export default AboutPage;