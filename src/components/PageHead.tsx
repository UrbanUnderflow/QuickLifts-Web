import React from 'react';
import Head from 'next/head';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types'; // Renamed import

// Define the expected prop type, where lastUpdated is a string
interface SerializablePageMetaDataForHead extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface PageHeadProps {
  metaData?: SerializablePageMetaDataForHead | null; // Updated to use the serializable type
  pageOgUrl: string; // Canonical URL for the current page, should be absolute
  // defaultTitle, defaultDescription, defaultOgImage are removed
}

const GLOBAL_DEFAULT_TITLE = "Pulse Community Fitness";
const GLOBAL_DEFAULT_DESCRIPTION = "Real workouts, Real people, move together.";
const GLOBAL_DEFAULT_OG_IMAGE = "https://fitwithpulse.ai/GetStarted.png"; // Use absolute URL with a proper PNG image

const PageHead: React.FC<PageHeadProps> = ({
  metaData,
  pageOgUrl,
}) => {
  const title = metaData?.pageTitle || GLOBAL_DEFAULT_TITLE;
  const description = metaData?.metaDescription || GLOBAL_DEFAULT_DESCRIPTION;
  
  // For OG tags, if specific metaData.ogTitle/Description are missing, 
  // they will try to use the page title/description (which could be from metaData or global defaults).
  const ogTitle = metaData?.ogTitle || title;
  const ogDescription = metaData?.ogDescription || description;
  
  // Ensure ogImage is always an absolute URL
  let ogImage = metaData?.ogImage || GLOBAL_DEFAULT_OG_IMAGE;
  if (ogImage && !ogImage.startsWith('http')) {
    ogImage = `https://fitwithpulse.ai${ogImage}`;
  }
  
  const ogUrl = metaData?.ogUrl || pageOgUrl; // ogUrl from metaData takes precedence, then pageOgUrl prop
  const ogType = metaData?.ogType || 'website';

  // Twitter tags follow a similar pattern, falling back to OG tags if specific Twitter tags are not present
  const twitterCard = metaData?.twitterCard || 'summary_large_image';
  const twitterTitle = metaData?.twitterTitle || ogTitle;
  const twitterDescription = metaData?.twitterDescription || ogDescription;
  
  // Ensure twitterImage is always an absolute URL
  let twitterImage = metaData?.twitterImage || ogImage;
  if (twitterImage && !twitterImage.startsWith('http')) {
    twitterImage = `https://fitwithpulse.ai${twitterImage}`;
  }

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* OpenGraph Meta Tags */}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:width" content="1200" />}
      {ogImage && <meta property="og:image:height" content="630" />}
      <meta property="og:url" content={ogUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Pulse Fitness" />

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={twitterDescription} />
      {twitterImage && <meta name="twitter:image" content={twitterImage} />}
      
      {/* Add other global tags if needed, e.g., viewport, favicon, etc. */}
      {/* <link rel="icon" href="/favicon.ico" /> */}
    </Head>
  );
};

export default PageHead; 