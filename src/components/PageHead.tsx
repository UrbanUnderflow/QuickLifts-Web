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
  /** Optional page-specific OG/social preview image path (e.g. /wunna-run-og.png). Takes precedence over metaData.ogImage when set. */
  pageOgImage?: string;
}

const GLOBAL_DEFAULT_TITLE = "Pulse Community Fitness";
const GLOBAL_DEFAULT_DESCRIPTION = "Real workouts, Real people, move together.";

/**
 * Generate a dynamic OG image URL via the /og-image.png Netlify function.
 * Produces: black background, short title in white, "PULSE" wordmark below.
 *
 * Extracts a short label from the page title:
 *   "Research – Pulse"                        → "Research"
 *   "Coach Dashboard – Pulse"                 → "Coach"
 *   "Pulse Community Fitness"                 → "Pulse"
 */
const generateDynamicOgImage = (title: string, _subtitle?: string): string => {
  const baseUrl = 'https://fitwithpulse.ai/og-image.png';

  // Try to extract a clean, short label from the title
  let label = title;

  // Strip " – Pulse", " - Pulse", " | Pulse" suffixes
  label = label.replace(/\s*[–\-|]\s*Pulse.*$/i, '').trim();

  // If it's the global default, just use "Pulse"
  if (label === GLOBAL_DEFAULT_TITLE || !label) {
    label = 'Pulse';
  }

  // Take only the first word or two for a clean OG image (max ~20 chars)
  const words = label.split(/\s+/);
  if (label.length > 20) {
    label = words.slice(0, 2).join(' ');
    if (label.length > 20) {
      label = words[0];
    }
  }

  const params = new URLSearchParams({ title: label });
  return `${baseUrl}?${params.toString()}`;
};

const PageHead: React.FC<PageHeadProps> = ({
  metaData,
  pageOgUrl,
  pageOgImage,
}) => {
  const title = metaData?.pageTitle || GLOBAL_DEFAULT_TITLE;
  const description = metaData?.metaDescription || GLOBAL_DEFAULT_DESCRIPTION;
  
  // For OG tags, if specific metaData.ogTitle/Description are missing, 
  // they will try to use the page title/description (which could be from metaData or global defaults).
  const ogTitle = metaData?.ogTitle || title;
  const ogDescription = metaData?.ogDescription || description;
  
  // Ensure ogImage is always an absolute URL
  // pageOgImage (prop) takes precedence, then metaData.ogImage, else generate dynamic image
  let ogImage = pageOgImage || metaData?.ogImage;
  if (ogImage && !ogImage.startsWith('http')) {
    ogImage = `https://fitwithpulse.ai${ogImage}`;
  } else if (!ogImage) {
    // Generate dynamic OG image with page title
    ogImage = generateDynamicOgImage(ogTitle, ogDescription !== GLOBAL_DEFAULT_DESCRIPTION ? ogDescription : undefined);
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

  const isGeneratedOgImage = ogImage?.includes('/og-image.png');

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* OpenGraph Meta Tags (same keys as _app so page-level overrides defaults) */}
      <meta property="og:title" content={ogTitle} key="og:title" />
      <meta property="og:description" content={ogDescription} key="og:description" />
      {ogImage && <meta property="og:image" content={ogImage} key="og:image" />}
      {ogImage && <meta property="og:image:secure_url" content={ogImage} />}
      {ogImage && isGeneratedOgImage && <meta property="og:image:type" content="image/png" />}
      {ogImage && isGeneratedOgImage && <meta property="og:image:width" content="1200" />}
      {ogImage && isGeneratedOgImage && <meta property="og:image:height" content="630" />}
      {ogImage && <meta property="og:image:alt" content={ogTitle} />}
      <meta property="og:url" content={ogUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Pulse Fitness" />

      {/* Twitter Card Tags (same keys as _app so page-level overrides defaults) */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle} key="twitter:title" />
      <meta name="twitter:description" content={twitterDescription} key="twitter:description" />
      {twitterImage && <meta name="twitter:image" content={twitterImage} key="twitter:image" />}
      {twitterImage && <meta name="twitter:image:alt" content={twitterTitle} />}
      
      {/* Additional Meta Tags */}
      <link rel="canonical" href={ogUrl} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#E0FE10" />
      
      {/* Apple Smart App Banner - prompts iOS users to open/download the app */}
      <meta name="apple-itunes-app" content="app-id=6451497729, app-argument=pulse://home" />
    </Head>
  );
};

export default PageHead; 