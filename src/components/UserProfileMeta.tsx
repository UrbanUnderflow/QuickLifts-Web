import React from 'react';
import { Helmet } from 'react-helmet-async';

interface UserProfileMetaProps {
  userData: {
    displayName: string;
    bio?: string;
    username: string;
  };
  bio: string;
  username: string;
}

const UserProfileMeta: React.FC<UserProfileMetaProps> = ({ userData, bio, username }) => {
  return (
    <Helmet>
      <title>{`${userData.displayName}'s Profile | Pulse`}</title>
      <meta property="og:title" content={`${userData.displayName}'s Profile | Pulse`} />
      <meta property="og:description" content={bio} />
      <meta property="og:url" content={`https://fitwithpulse.ai/${username}`} />
      <meta property="og:type" content="profile" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${userData.displayName}'s Profile | Pulse`} />
      <meta name="twitter:description" content={bio} />
      <link rel="canonical" href={`https://fitwithpulse.ai/${username}`} />
    </Helmet>
  );
};

export default UserProfileMeta;
