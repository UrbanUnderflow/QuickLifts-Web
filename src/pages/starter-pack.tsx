
import React from 'react';
import FAQ from '../components/FAQ';
import PartnerJoinModal from '../components/PartnerJoinModal';
import Meta from '../components/Meta'; // Import the Meta component
import Head from 'next/head';

const FAQ_DATA = [
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
  }
];

const Checklist: React.FC = () => {
  const [isModalOpen, setModalOpen] = React.useState(false);

  const siteUrl = 'https://fitwithpulse.ai';
  const pageUrl = `${siteUrl}/checklist`;
  const title = 'Getting Started with Pulse | Your Fitness Journey Begins Here';
  const description =
    'Follow our simple checklist to get started with Pulse. Learn how to create your profile, connect with the fitness community, and begin tracking your workouts.';
  const previewImage = `${siteUrl}/GetStarted.png`;

  const closeModal = () => setModalOpen(false);

  return (
    <div className="w-full relative bg-white">
      <Head>
        {/* Primary Meta Tags */}
        <title>{title}</title>
        <meta name="title" content={title} />
        <meta name="description" content={description} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={previewImage} />
        <meta property="og:site_name" content="Pulse Fitness" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={pageUrl} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        <meta property="twitter:image" content={previewImage} />

        {/* Additional Meta Tags */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="keywords" content="fitness app, workout tracking, fitness community, pulse fitness, getting started, fitness journey" />
        <meta name="author" content="Pulse Fitness" />
        <link rel="canonical" href={pageUrl} />

        {/* Theme Color */}
        <meta name="theme-color" content="#E0FE10" />
      </Head>

      {/* Main Content */}
      <div className="px-4 sm:px-8">
         {/* Meta Component */}
         <Meta title={title} description={description} url={pageUrl} />

        {/* Main Content */}
        <div className="bg-white mb-64">
          {/* Badge and phone image section */}
          <div className="flex flex-col sm:flex-row mt-10 p-0 sm:px-20 justify-center items-center mx-auto space-x-0 sm:space-x-1">
            <div
              className="relative w-full h-auto mb-10 overflow-hidden group cursor-pointer"
              onClick={() =>
                window.location.href =
                  'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729'
              }
            >
              <img
                src="/HowToGetStarted.svg"
                alt="How to get started with Pulse"
                className="w-full sm:w-[541px] h-auto object-contain"
              />
            </div>

            <div className="relative w-full h-auto mb-10 overflow-hidden group">
              <img
                src="/checklistPhone.svg"
                alt="Checklist overview on phone"
                className="w-full sm:w-[681px] h-auto object-contain"
              />
            </div>
          </div>

          {/* Start Here section */}
          <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
            <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
              <div className="text-zinc-600 text-3xl sm:text-4xl font-normal font-['Thunder'] uppercase leading-9">
                Start Here
              </div>
              <div className="w-full max-w-[791.1px] text-black text-[32px] sm:text-[64px] font-medium font-['Thunder'] leading-[40px] sm:leading-[79px]">
                Complete these checklist items to get started and learn how to use the app.
              </div>
            </div>
          </div>

          {/* FAQ section */}
          <div className="w-full max-w-[1240px] mx-auto flex flex-col gap-8 sm:gap-10 mb-40">
            <FAQ title="Frequently Asked Questions" items={FAQ_DATA} />
          </div>
        </div>
      </div>

      <PartnerJoinModal isOpen={isModalOpen} closeModal={closeModal} />
    </div>
  );
};

export default Checklist;