import React from 'react';
import Head from 'next/head';

interface UserProfileMetaProps {
  userData: {
    displayName: string;
    bio?: string;
    username: string;
    profileImage?: {
      profileImageURL?: string;
    };
  };
  bio: string;
  username: string;
}

const UserProfileMeta: React.FC<UserProfileMetaProps> = ({ userData }) => {
  const title = `${userData.displayName}'s Profile | Pulse`;
  const description = userData.bio || 'Check out this fitness profile on Pulse';
  
  // Ensure image URL is absolute
  let imageUrl = userData.profileImage?.profileImageURL || 'https://fitwithpulse.ai/default-profile.png';
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `https://fitwithpulse.ai${imageUrl}`;
  }
  
  const url = `https://fitwithpulse.ai/${userData.username}`;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:secure_url" content={imageUrl} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="400" />
      <meta property="og:image:height" content="400" />
      <meta property="og:image:alt" content={`${userData.displayName}'s profile picture`} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="profile" />
      <meta property="og:site_name" content="Pulse Fitness" />
      
      {/* Twitter Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={`${userData.displayName}'s profile picture`} />
      
      {/* Additional Meta Tags */}
      <link rel="canonical" href={url} />
      <link rel="preconnect" href="https://fitwithpulse.ai" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#E0FE10" />
    </Head>
  );
};

export default UserProfileMeta;