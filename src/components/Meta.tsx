import React from 'react';
import Head from 'next/head';

interface MetaProps {
  title: string;
  description: string;
  url: string;
  image?: string;
}

// Generate dynamic OG image URL based on page title
const generateDynamicOgImage = (title: string, subtitle?: string): string => {
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
      <meta name="description" content={description} />

      {/* Open Graph / Facebook Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:secure_url" content={ogImage} />}
      {ogImage && <meta property="og:image:type" content="image/png" />}
      {ogImage && <meta property="og:image:width" content="1200" />}
      {ogImage && <meta property="og:image:height" content="630" />}
      {ogImage && <meta property="og:image:alt" content={title} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Pulse Fitness" />

      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}
      {ogImage && <meta name="twitter:image:alt" content={title} />}

      {/* Additional Meta Tags */}
      <link rel="canonical" href={url} />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <meta name="theme-color" content="#E0FE10" />
    </Head>
  );
};

export default Meta;