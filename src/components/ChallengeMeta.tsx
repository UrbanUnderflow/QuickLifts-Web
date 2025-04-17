// components/ChallengeMeta.tsx
import React from 'react';
import Head from 'next/head';
import { Challenge } from '../api/firebase/workout/types';  // Correct import path

interface ChallengeMetaProps {
  challenge: Challenge;
  id: string;
}

const ChallengeMeta: React.FC<ChallengeMetaProps> = ({ challenge, id }) => {
  // Format dates for meta description
  const startDate = new Date(challenge.startDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });
  const endDate = new Date(challenge.endDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  const enrichedDescription = `${challenge.subtitle} • ${startDate} - ${endDate} • Join the challenge now!`;

  const deepLinkUrl = `pulse://rounds?linkType=round&roundId=${id}`;
  
  // Use static image from public directory
  const previewImageUrl = '/round-preview.png'; // Make sure this file exists in public/

  return (
    <Head>
      <title key="title">{`Join ${challenge.title} | Pulse`}</title>
      <meta key="description" name="description" content={enrichedDescription} />
      
      {/* Open Graph Meta Tags */}
      <meta key="og:title" property="og:title" content={`Join ${challenge.title} | Pulse`} />
      <meta key="og:description" property="og:description" content={enrichedDescription} />
      <meta key="og:type" property="og:type" content="website" />
      <meta key="og:url" property="og:url" content={`https://fitwithpulse.ai/challenge/${id}`} />
      <meta key="og:site_name" property="og:site_name" content="Pulse Fitness" />
      <meta key="og:image" property="og:image" content={`https://fitwithpulse.ai${previewImageUrl}`} />
      <meta key="og:image:width" property="og:image:width" content="1200" />
      <meta key="og:image:height" property="og:image:height" content="630" />
      <meta key="og:image:alt" property="og:image:alt" content={`${challenge.title} preview`} />
      
      {/* Deep Linking Meta Tags */}
      <meta key="al:ios:app_store_id" property="al:ios:app_store_id" content="6451497729" />
      <meta key="al:ios:app_name" property="al:ios:app_name" content="Pulse: Community Workouts" />
      <meta key="al:ios:url" property="al:ios:url" content={deepLinkUrl} />
      
      {/* Twitter Meta Tags */}
      <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
      <meta key="twitter:site" name="twitter:site" content="@fitwithpulse" />
      <meta key="twitter:creator" name="twitter:creator" content="@fitwithpulse" />
      <meta key="twitter:title" name="twitter:title" content={`Join ${challenge.title} | Pulse`} />
      <meta key="twitter:description" name="twitter:description" content={enrichedDescription} />
      <meta key="twitter:image" name="twitter:image" content={`https://fitwithpulse.ai${previewImageUrl}`} />
      <meta key="twitter:image:alt" name="twitter:image:alt" content={`${challenge.title} preview`} />
      
      {/* Additional Meta Tags */}
      <link key="canonical" rel="canonical" href={`https://fitwithpulse.ai/challenge/${id}`} />
      <meta key="theme-color" name="theme-color" content="#E0FE10" />
      <meta key="mobile-web-app-capable" name="mobile-web-app-capable" content="yes" />
      <meta key="apple-mobile-web-app-capable" name="apple-mobile-web-app-capable" content="yes" />
      <meta key="apple-mobile-web-app-status-bar-style" name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    </Head>
  );
};

export default ChallengeMeta;