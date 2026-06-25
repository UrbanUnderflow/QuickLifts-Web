import React from 'react';
import Head from 'next/head';

interface MetaProps {
  title: string;
  description: string;
  url: string;
  image?: string;
}

// Generate dynamic OG image URL based on page title
const generateDynamicOgImage = (title: string, _subtitle?: string): string => {
  const baseUrl = 'https://fitwithpulse.ai/og-image.png';
  const params = new URLSearchParams({ title });
  // NOTE: intentionally not sending subtitle. Social previews should be title-only.
  // (subtitle is accepted for backwards compat but omitted from the URL)
  return `${baseUrl}?${params.toString()}`;
};

const Meta: React.FC<MetaProps> = ({ title, description, url, image }) => {
  // Ensure image is always an absolute URL
  // If no specific image is set, generate a dynamic branded OG image
  let ogImage = image;
  if (ogImage && !ogImage.startsWith('http')) {
    ogImage = `https://fitwithpulse.ai${ogImage}`;
  } else if (!ogImage) {
    // Generate dynamic OG image with page title
    ogImage = generateDynamicOgImage(title, description);
  }

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} key="description" />

      {/* Open Graph / Facebook Meta Tags */}
      <meta property="og:title" content={title} key="og:title" />
      <meta property="og:description" content={description} key="og:description" />
      {ogImage && <meta property="og:image" content={ogImage} key="og:image" />}
      {ogImage && <meta property="og:image:type" content="image/png" key="og:image:type" />}
      {ogImage && <meta property="og:image:width" content="1200" key="og:image:width" />}
      {ogImage && <meta property="og:image:height" content="630" key="og:image:height" />}
      {ogImage && <meta property="og:image:alt" content={title} key="og:image:alt" />}
      <meta property="og:url" content={url} key="og:url" />
      <meta property="og:type" content="website" key="og:type" />
      <meta property="og:site_name" content="Pulse Intelligence Labs" key="og:site_name" />

      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
      <meta name="twitter:title" content={title} key="twitter:title" />
      <meta name="twitter:description" content={description} key="twitter:description" />
      {ogImage && <meta name="twitter:image" content={ogImage} key="twitter:image" />}
      {ogImage && <meta name="twitter:image:alt" content={title} key="twitter:image:alt" />}

      {/* Additional Meta Tags */}
      <link rel="canonical" href={url} key="canonical" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <meta name="theme-color" content="#E0FE10" />
    </Head>
  );
};

export default Meta;
