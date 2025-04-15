import React from 'react';
import Head from 'next/head';
import HomeContent from './HomeContent';

const previewImageUrl = '/PulseWeb.png';
const siteUrl = 'https://fitwithpulse.ai';
const title = 'Pulse | Community Workouts & Fitness Challenges';
const description = 'Beat your best, share your victory. Join the Pulse fitness community for AI-powered workouts, challenges, and more!';

const Home: React.FC = () => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:site_name" content="Pulse Fitness" />
        <meta property="og:image" content={`${siteUrl}${previewImageUrl}`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Pulse Fitness Web Preview" />
        {/* Twitter Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@fitwithpulse" />
        <meta name="twitter:creator" content="@fitwithpulse" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}${previewImageUrl}`} />
        <meta name="twitter:image:alt" content="Pulse Fitness Web Preview" />
        {/* Canonical */}
        <link rel="canonical" href={siteUrl} />
        <meta name="theme-color" content="#E0FE10" />
      </Head>
      <div className="h-screen">
        <HomeContent />
      </div>
    </>
  );
};

export default Home;