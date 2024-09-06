import React, { useState } from 'react';
import FAQ from '../components/FAQ';
import PartnerJoinModal from '../components/PartnerJoinModal';



const Checklist = () => {
    const [isModalOpen, setModalOpen] = useState(false);

  
    const closeModal = () => {
      setModalOpen(false);
    };


    const faqData = [
        {
          question: "How does the revenue-sharing model work?",
          answer: "As a content creator on Pulse, you'll be directly compensated for the impact your content makes within the community. The more engagement and value your content generates, the more you'll earn through our revenue-sharing system."
        },
        {
          question: "What kind of content can I create on Pulse?",
          answer: "Pulse welcomes a wide range of fitness content, including workouts, exercise demonstrations, progress updates, and informative videos. Our Creators Hub provides the tools and support you need to craft engaging and impactful content."
        },
        {
          question: "Do I need to be a certified fitness professional to become a Sweat Equity Partner?",
          answer: "While professional certifications are valuable, they're not a requirement to become a content creator on Pulse. We welcome fitness enthusiasts from all backgrounds who have unique ideas, techniques, and experiences to share."
        },
        {
          question: "How does Pulse ensure the quality and safety of the content shared on the platform?",
          answer: "Pulse uses our AI model to moderate all content, along with a dedicated team that reviews and moderates content before it is released to ensure it meets our community guidelines and safety standards."
        },
        {
          question: "Can I connect with other fitness content creators on Pulse?",
          answer: "Absolutely! Pulse fosters a thriving community of like-minded individuals passionate about fitness. You'll have opportunities to connect, collaborate, and learn from other content creators within the platform."
        },
        {
          question: "Is there a cost to become a Sweat Equity Partner with Pulse?",
          answer: "Yes, there is an annual subscription fee to become a Sweat Equity Partner on Pulse. However, we offer a 30-day free trial for new partners to explore the platform and its benefits."
        },
      ];

    return (
      <div className="w-full relative bg-white">
        {/* Main Content */}
        <div className="px-4 sm:px-8">
          <div className="bg-white mb-64">

            {/* Badge and phone image */}
            <div className="flex flex-col sm:flex-row mt-10 p-0 sm:px-20 justify-center items-center mx-auto space-x-0 sm:space-x-1">
              <div
                className="relative w-full h-auto mb-10 overflow-hidden group cursor-pointer"
                onClick={() => window.location.href = "https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729"}
              >
                <img
                  src="/HowToGetStarted.svg"
                  alt="Phone"
                  className="w-full sm:w-[541px] h-auto object-contain"
                />
              </div>

              <div className="relative w-full h-auto mb-10 overflow-hidden group">
                <img src="/checklistPhone.svg" alt="Phone" className="w-full sm:w-[681px] h-auto object-contain" />
                <div className="absolute inset-0 transition-opacity duration-300 ease-in-out flex justify-end items-start opacity-0 group-hover:opacity-100">
                  <div className="w-full h-full bg-gray-500 opacity-60"></div>
                  <a href="https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729" className="absolute right-0 bottom-0 m-8 bg-clear text-white py-4 px-6 border border-white rounded-full flex items-center justify-center font-bold hover:bg-[#e6fd54] hover:text-black hover:border-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black">
                    Download App
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7"></path></svg>
                  </a>
                </div>
              </div>
            </div>

            {/* Section: Why Become a Partner */}
            <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
              {/* Section Title */}
              <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
                  <div className="text-zinc-600 text-3xl sm:text-4xl font-normal font-['Thunder'] uppercase leading-9">Start Here</div>
                  <div className="w-full max-w-[791.1px] text-black text-[32px] sm:text-[64px] font-medium font-['Thunder'] leading-[40px] sm:leading-[79px]">
                      Complete these checklist items to get started and learn how to use the app.
                  </div>
              </div>

              {/* Checklist */}
              <div className="self-stretch items-center gap-10">

                {/* Account Creation */}
                <div className="flex items-center gap-4">
                  {/* For larger screens */}
                  <img src="/step1.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain hidden sm:block" />
                  {/* For smaller screens */}
                  <img src="/step1Mobile.png" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain sm:hidden" />
                </div>

                {/* Spacer */}
                <div className="h-8 sm:h-16"></div>

                {/* Profile Setup */}
                <div className="flex items-center gap-4">
                  {/* For larger screens */}
                  <img src="/step2.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain hidden sm:block" />
                  {/* For smaller screens */}
                  <img src="/step2Mobile.png" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain sm:hidden" />
                </div>


                {/* Spacer */}
                <div className="h-8 sm:h-16"></div>

                {/* First Content Upload */}
                <div className="flex items-center gap-4">
                  {/* For larger screens */}
                  <img src="/step3.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain hidden sm:block" />
                  {/* For smaller screens */}
                  <img src="/step3Mobile.png" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain sm:hidden" />
                </div>

                {/* Spacer */}
                <div className="h-8 sm:h-16"></div>

                {/* Community Engagement */}
                <div className="flex items-center gap-4">
                  {/* For larger screens */}
                  <img src="/step4.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain hidden sm:block" />
                  {/* For smaller screens */}
                  <img src="/step4Mobile.png" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain sm:hidden" />
                </div>

                {/* Spacer */}
                <div className="h-8 sm:h-16"></div>

                {/* Start a Workout */}
                <div className="flex items-center gap-4">
                  {/* For larger screens */}
                  <img src="/step5.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain hidden sm:block" />
                  {/* For smaller screens */}
                  <img src="/step5Mobile.svg" alt="Phone" className="w-full sm:w-h h-[450px] sm:h-[450px] object-contain sm:hidden" />
                </div>
            
                {/* Spacer */}
                <div className="h-8 sm:h-16"></div>

              </div>         
            </div>

            {/* FAQ Section */}
            <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
              <div>
                  <FAQ title="Frequently Asked Questions" items={faqData} />
              </div>
            </div>
          </div>
        </div>

        <PartnerJoinModal isOpen={isModalOpen} closeModal={closeModal} />

      </div>
      
    );
};

export default Checklist;