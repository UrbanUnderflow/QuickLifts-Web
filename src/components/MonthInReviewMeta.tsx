import React from 'react';
import Head from 'next/head';

interface MonthInReviewMetaProps {
  title: string;
  description: string;
  imageUrl?: string;
  pageUrl: string;
}

const MonthInReviewMeta: React.FC<MonthInReviewMetaProps> = ({ title, description, imageUrl, pageUrl }) => {
  const defaultImageUrl = 'https://fitwithpulse.ai/default-month-review.png';
  const metaImageUrl = imageUrl || defaultImageUrl;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={metaImageUrl} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:site_name" content="Pulse Fitness" />
      
      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={metaImageUrl} />
      
      {/* Additional Meta Tags */}
      <link rel="canonical" href={pageUrl} />
      <link rel="preconnect" href="https://fitwithpulse.ai" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
  );
};

export default MonthInReviewMeta;