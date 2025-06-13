import React from 'react';
import Head from 'next/head';

interface MetaProps {
  title: string;
  description: string;
  url: string;
  image?: string;
}

const Meta: React.FC<MetaProps> = ({ title, description, url, image }) => {
  const defaultImage = 'https://fitwithpulse.ai/GetStarted.png'; // Fallback to "GetStarted.png"
  
  // Ensure image is always an absolute URL
  let ogImage = image || defaultImage;
  if (ogImage && !ogImage.startsWith('http')) {
    ogImage = `https://fitwithpulse.ai${ogImage}`;
  }

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph / Facebook Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Pulse Fitness" />

      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional Meta Tags */}
      <link rel="canonical" href={url} />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <meta name="theme-color" content="#E0FE10" />
    </Head>
  );
};

export default Meta;