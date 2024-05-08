import React from 'react';
import FAQ from '../components/FAQ';

const HomeContent = () => {
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
      answer: "We are currently only on iOS, but Android is coming soon!"
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
    <>
      <div className="flex flex-col sm:flex-row mt-10 p-0 sm:px-20 justify-center items-center mx-auto space-x-0 sm:space-x-1">
        <div
          className="relative w-full h-auto mb-10 overflow-hidden group cursor-pointer"
          onClick={() => window.location.href = "https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"}
        >
          <img
            src="/welcomeBadge.png"
            alt="Phone"
            className="w-[541px] h-auto object-contain"
          />
        </div>

        <div className="relative w-full h-auto mb-10 overflow-hidden group">
          <img src="/phoneimage1.png" alt="Phone" className="w-[681px] h-auto object-contain" />
          <div className="absolute inset-0 transition-opacity duration-300 ease-in-out flex justify-end items-start opacity-0 group-hover:opacity-100">
            <div className="w-full h-full bg-gray-500 opacity-60"></div>
            <a href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729" className="absolute right-0 bottom-0 m-8 bg-clear text-white py-4 px-6 border border-white rounded-full flex items-center justify-center font-bold hover:bg-[#e6fd54] hover:text-black hover:border-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black">
              Download App
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7"></path></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:px-20 mb-40 justify-center items-center mx-auto space-x-0 sm:space-x-5">
        <div className="mt-0 sm:mt-0 flex justify-center sm:justify-start">
          <img src="/person1.svg" alt="Person 1" className="hidden md:block w-full md:w-[400px] h-[405px]" />
        </div>
        <div className="mt-0 sm:mt-0 flex justify-center sm:justify-start">
          <img src="/person2.svg" alt="Person 2" className="hidden md:block w-full md:w-[400px] h-[405px]" />
        </div>
        <div className="mt-0 sm:mt-0 flex justify-center sm:justify-start">
          <img src="/person3.svg" alt="Person 3" className="hidden md:block w-full md:w-[400px] h-[405px]" />
        </div>
      </div>

      <div className="bg-white text-gray-800">
        <div className="sm:justify-around px-5 sm:px-20 items-start mx-auto">
          <div className="text-left py-5">
            <h2 className="text-2xl font-bold uppercase">Why Choose Pulse</h2>
          </div>
          <div className="text-left pb-10">
            <h3 className="text-4xl font-extrabold">
              A User-Driven Fitness Community: <br />Collective Content, Support, and Growth
            </h3>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-around p-5 sm:p-20 items-start mx-auto">
          <div className="sm:w-1/3 mb-6 sm:mb-0">
            <h4 className="text-xl font-semibold mb-2">Growth over perfection pledge</h4>
            <p>We celebrate milestones and acknowledge that perfection is when we continue to push ourselves beyond what feels comfortable,</p>
          </div>
          <div className="px-10">
            <img src="/astricks.svg" alt="astricks" className="hidden md:block w-[22px] md:w-[22px] h-[176px]" />
          </div>
          <div className="sm:w-1/3 mb-6 sm:mb-0">
            <h4 className="text-xl font-semibold mb-2">We show up</h4>
            <p>60 percent of the battle is simply just showing up at the gym with a plan. If we can get in the room, we can achieve our best, so we pledge to workout, share, and encourage others along the way.</p>
          </div>
          <div className="px-10">
            <img src="/astricks.svg" alt="astricks" className="hidden md:block w-[22px] md:w-[22px] h-[176px]" />
          </div>
          <div className="sm:w-1/3 mb-6 sm:mb-0">
            <h4 className="text-xl font-semibold mb-2">Progress over pressure</h4>
            <p>We track what matters for lasting change – strength, endurance, mobility, not just what the scale says.</p>
            <a href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729" className="mt-8 w-48 bg-[#e6fd54] text-black py-4 px-4 rounded-full flex items-center">
              Download App
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-col bg-[#fafafa] sm:flex-row px-5 sm:px-20 justify-center items-center mx-auto space-x-0 sm:space-x-5">
        <div className="mt-0 m-0 p-0 sm:mt-0 flex justify-center sm:justify-start">
          <img src="/socialBanner.svg" alt="social" className="hidden md:block w-full md:w-full h-[624px]" />
        </div>
      </div>

      <div className="">
        <div className="mt-0 sm:mt-0 flex justify-center sm:justify-start">
          <img src="/socialreel.svg" alt="social" className="hidden md:block w-[1640px] md:w-[1640px] h-[624px]" />
        </div>
      </div>

      <div>
        <FAQ title="Frequently Asked Questions" items={faqData} />
      </div>

    </>
  );
};

export default HomeContent;
