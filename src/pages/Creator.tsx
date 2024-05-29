import React, { useState } from 'react';
import FAQ from '../components/FAQ';
import PartnerJoinModal from '../components/PartnerJoinModal';

const Creators = () => {
    const [videoPlaying, setVideoPlaying] = React.useState(false);

    const [isModalOpen, setModalOpen] = useState(false);

    const openModal = () => {
      setModalOpen(true);
    };

    const closeModal = () => {
      setModalOpen(false);
    };

    const handleVideoPlay = () => {
        setVideoPlaying(true);
        const videoElement = document.getElementById("creatorVideo") as HTMLVideoElement;
        videoElement.play();
    };

    const faqData = [
        {
          question: "How does the revenue-sharing model work?",
          answer: " As a content creator on Pulse, you'll be directly compensated for the impact your content makes within the community. The more engagement and value your content generates, the more you'll earn through our revenue-sharing system."
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
          answer: "Pulse uses our AI model to moderated all the content, in addition to our dedicated team that reviews and moderates content before it is released on the platform to ensure it meets our community guidelines and safety standards. We also provide resources and support to help content creators produce high-quality, safe, and effective fitness content."
        },
        {
          question: "Can I connect with other fitness content creators on Pulse?",
          answer: "Absolutely! Pulse fosters a thriving community of like-minded individuals passionate about fitness. You'll have opportunities to connect, collaborate, and learn from other content creators within the platform."
        },
        {
          question: "Is there a cost to become a Sweat Equity Partner with Pulse?",
          answer: "Yes, there is an annual subscription fee to become a Sweat Equity Partner on Pulse. This fee helps support the platform's growth, maintenance, and the resources provided to content creators. However, we offer a 30-day free trial to new partners to explore the platform and it's benefits."
        },
      ];

  return (
    <div className="w-full relative bg-white">
      {/* Main Content */}
      <div className="px-4 sm:px-8">
        <div className="bg-white mb-64">
          {/* Title Section */}
          <div className="max-w-[1052.76px] mx-auto text-center my-10 mt-20">
            <span className="text-black text-[56px] sm:text-[93.93px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Join our </span>
            <span className="text-orange-500 text-[56px] sm:text-[93.93px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide">Sweat Equity Partner Program</span>
            <span className="text-black text-[56px] sm:text-[93.93px] font-normal font-['Thunder'] leading-[60px] sm:leading-[107.08px] tracking-wide"> and earn money</span>
          </div>

          {/* New Box Section with Play Button and Video */}
          <div className="relative max-w-[887.5px] h-[561.14px] mx-auto mt-0 mb-64 bg-zinc-100 rounded-xl border-2 border-black/opacity-5 overflow-hidden">
              {!videoPlaying && (
                  <button onClick={handleVideoPlay} className="absolute inset-0 w-full h-full flex items-center justify-center z-10 cursor-pointer focus:outline-none">
                      <div className="w-16 h-16 bg-white rounded-full border border-black/opacity-5 shadow-lg flex items-center justify-center">
                          <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                              <polygon points="9.5,7.5 16.5,12 9.5,16.5" />
                          </svg>
                      </div>
                  </button>
              )}
              <video
                id="creatorVideo"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: videoPlaying ? 'none' : 'blur(8px)' }}
                loop
                poster="/ThisIsPulseThumb.png"
              >
                <source src="/ThisIsPulse.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              {!videoPlaying && <div className="absolute inset-0 bg-black opacity-25"></div>}
          </div>

        {/* New Section: Why Become a Partner */}
        <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
          {/* Section Title */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="text-zinc-600 text-3xl sm:text-4xl font-normal font-['Thunder'] uppercase leading-9">Why Become a Sweat Equity Partner</div>
            <div className="w-full max-w-[791.1px] text-black text-[40px] sm:text-[64px] font-medium font-['Thunder'] leading-[45px] sm:leading-[79px]">Experience the benefits of belonging, support, personal growth while earning</div>
          </div>

          {/* Benefits */}
          <div className="self-stretch border-t border-b border-zinc-200 flex flex-col sm:flex-row items-center gap-5">
            {/* Earn Money */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-xl font-medium font-['HK Grotesk']">Earn Money</div>
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Monetize your content and earn revenue based on your contributions.</div>
            </div>

            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Flexibility */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2 items-center">
              <div className="self-stretch text-black text-xl font-medium font-['HK Grotesk']">Flexibility</div>
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Work on your own schedule and create content that resonates with your audience.</div>
            </div>

            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Recognition */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-xl font-medium font-['HK Grotesk']">Recognition</div>
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Join a vibrant community of content creators, share experiences, and collaborate on projects.</div>
            </div>
          </div>

          {/* More Benefits */}
          <div className="self-stretch border-t border-b border-zinc-200 flex flex-col sm:flex-row items-center gap-5">
            {/* Exclusive Opportunities */}
            <div className="w-full sm:w-[371.44px] h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-xl font-['HK Grotesk']">Exclusive Opportunities</div>
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Gain exposure for your work and build your personal brand on our platform</div>
            </div>
            <div className="hidden sm:block w-[22.83px] h-44"></div>

            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Community */}
            <div className="w-full sm:w-[371.44px] h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-xl font-['HK Grotesk'] leading-normal">Community</div>
              <div className="self-stretch text-black text-base font-['HK Grotesk'] leading-normal">Access to exclusive events, sponsorships, and promotional opportunities.</div>
            </div>
          </div>

          {/* Call to Action: Join as a Partner */}
          <div className="w-full sm:w-[249px] h-auto p-4 sm:p-6 rounded-[32px] border border-black flex justify-center items-center gap-4 sm:gap-6" onClick={openModal}>
            <div className="text-black text-sm sm:text-base font-semibold font-['HK Grotesk'] uppercase">Join as a partner</div>
            <img src="/arrow-up-right.svg" alt="Arrow Up Right" className="w-4 h-4" />
          </div>
        </div>

        {/* New Section: Pricing */}
        <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-64">
            {/* Title */}
            <div className="w-[539px]">
                <span className="text-stone-500 text-[40px] sm:text-[102px] font-medium font-['Thunder'] leading-[50px] sm:leading-[133px]">Enroll in the </span>
                <span className="text-black text-[40px] sm:text-[102px] font-medium font-['Thunder'] leading-[50px] sm:leading-[133px]">Sweat Equity Partnership Program</span>
            </div>

            {/* Circle Button */}
            <div className="flex items-center w-64 h-16 sm:h-24 bg-black rounded-full justify-between">
                <span className="text-white ml-10">Start Enrollment</span>
                <img src="/arrow-down-left.svg" alt="Arrow Down Left" className="w-6 sm:w-8 h-6 sm:h-8 text-white mr-10" />
            </div>
        </div>

        {/* New Section: Sweat Equity Partner Criteria */}
        <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
          {/* Section Title */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="w-full max-w-[791.1px] text-black text-[40px] sm:text-[64px] font-medium font-['Thunder'] leading-[45px] sm:leading-[79px]">To become a Sweat Equity Partner, you must meet the following criteria</div>
          </div>

          {/* Criteria */}
          <div className="self-stretch border-t border-b border-zinc-200 flex flex-col sm:flex-row items-center gap-5">
            {/* US/Canada based */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Be based in the US or Canada(we plan to expand our program to other countries soon!)</div>
            </div>
            <div className="hidden sm:block w-[22.83px] h-44"></div>

            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Register */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Be a registered user on the platform</div>
            </div>
            <div className="hidden sm:block w-[22.83px] h-44"></div>

            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Comply */}
            <div className="grow h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Comply with community  <br /> guidelines and terms of service</div>
            </div>
          </div>

          {/* More Criteria */}
          <div className="self-stretch border-t border-b border-zinc-200 flex flex-col sm:flex-row items-center gap-5">
            {/* Passion */}
            <div className="w-full sm:w-[371.44px] h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-base font-normal font-['HK Grotesk'] leading-normal">Have a passion for fitness! Your genuine love for health and wellness should shine through in your content.</div>
            </div>
            
            <div className="px-5 hidden sm:block">
                <img src="/astricks.svg" alt="astricks" className="w-[120px] h-[120px] " />
            </div>

            {/* Positivity */}
            <div className="w-full sm:w-[371.44px] h-auto px-[18px] py-6 flex flex-col gap-2">
              <div className="self-stretch text-black text-base font-['HK Grotesk'] leading-normal">Be positive and uplifting to your audience.</div>
            </div>
          </div>
        </div>

        {/* New Section: How We Support Partner */}
        <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
          {/* Section Title */}
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="text-zinc-600 text-3xl sm:text-4xl font-normal font-['Thunder'] uppercase leading-9">Support and Resources for Partners</div>
            <div className="w-full max-w-[791.1px] text-black text-[40px] sm:text-[64px] font-medium font-['Thunder'] leading-[45px] sm:leading-[79px]">We're committed to helping our partners succeed. Here's how we support you</div>
          </div>

        {/* App Features Section */}
        <div className="flex flex-col gap-8 mt-16 items-center justify-center mb-40">
          {/* Grid for App Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {/* First Feature */}
            <div className="flex flex-col gap-2">
              <div className="w-5 h-5"></div>
               {/* Feature Image Placeholder */}
              <div className="w-[405px] h-[373.87px] bg-gray-50">
                <img src="/creators-hub-phone.png" alt="Feature 1" className="w-full h-full object-cover" />
              </div>
              <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Creator's Hub</div>
              <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Engage your audience with conent such as exercises, workouts, and videos of your self performing exercises you've created or others have.</div>
            </div>

            {/* Second Feature */}
            <div className="flex flex-col gap-2">
              <div className="w-5 h-5"></div>
               {/* Feature Image Placeholder */}
              <div className="w-[405px] h-[373.87px] bg-gray-50">
                <img src="/analytics-dashboard-phone.png" alt="Feature 2" className="w-full h-full object-cover" />
              </div>
              <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Analytics Dashboard</div>
              <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">Get insights on how your doing. Know who exactly is engaging with your content, and your compensation for the engagement is broken down. Monthly payouts are issued through here once your wallet is holding $25 or higher</div>
            </div>

            {/* Third Feature */}
            <div className="flex flex-col gap-2">
              <div className="w-5 h-5"></div>
               {/* Feature Image Placeholder */}
              <div className="w-[405px] h-[373.87px] bg-gray-50">
                <img src="/send-workout-phone.png" alt="Feature 3" className="w-full h-full object-cover" />
              </div>
              <div className="text-black text-[22.5px] font-bold font-['HK Grotesk'] leading-loose">Send Workouts</div>
              <div className="w-[319px] text-neutral-600 text-base font-normal font-['HK Grotesk'] leading-tight">The send workout features allows our creators to capture the attention of folks and grown their audience. </div>
            </div>
          </div>
        </div>

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

export default Creators;
