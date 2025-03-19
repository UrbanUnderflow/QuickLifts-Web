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
      <title>{`Join ${challenge.title} | Pulse`}</title>
      <meta name="description" content={enrichedDescription} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={`Join ${challenge.title} | Pulse`} />
      <meta property="og:description" content={enrichedDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://fitwithpulse.ai/challenge/${id}`} />
      <meta property="og:site_name" content="Pulse Fitness" />
      <meta property="og:image" content={`https://fitwithpulse.ai${previewImageUrl}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${challenge.title} preview`} />
      
      {/* Deep Linking Meta Tags */}
      <meta property="al:ios:app_store_id" content="6451497729" />
      <meta property="al:ios:app_name" content="Pulse: Community Workouts" />
      <meta property="al:ios:url" content={deepLinkUrl} />
      
      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@fitwithpulse" />
      <meta name="twitter:creator" content="@fitwithpulse" />
      <meta name="twitter:title" content={`Join ${challenge.title} | Pulse`} />
      <meta name="twitter:description" content={enrichedDescription} />
      <meta name="twitter:image" content={`https://fitwithpulse.ai${previewImageUrl}`} />
      <meta name="twitter:image:alt" content={`${challenge.title} preview`} />
      
      {/* Additional Meta Tags */}
      <link rel="canonical" href={`https://fitwithpulse.ai/challenge/${id}`} />
      <meta name="theme-color" content="#E0FE10" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    </Head>
  );
};

export default ChallengeMeta;