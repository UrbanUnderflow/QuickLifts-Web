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
const GLOBAL_DEFAULT_OG_IMAGE = "/pulse-logo.svg"; // Assumes pulse-logo.svg is in /public

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
  const ogImage = metaData?.ogImage || GLOBAL_DEFAULT_OG_IMAGE;
  const ogUrl = metaData?.ogUrl || pageOgUrl; // ogUrl from metaData takes precedence, then pageOgUrl prop
  const ogType = metaData?.ogType || 'website';

  // Twitter tags follow a similar pattern, falling back to OG tags if specific Twitter tags are not present
  const twitterCard = metaData?.twitterCard || 'summary_large_image';
  const twitterTitle = metaData?.twitterTitle || ogTitle;
  const twitterDescription = metaData?.twitterDescription || ogDescription;
  const twitterImage = metaData?.twitterImage || ogImage;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* OpenGraph Meta Tags */}
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta property="og:url" content={ogUrl} />
      <meta property="og:type" content={ogType} />

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