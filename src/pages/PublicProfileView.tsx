import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface User {
  id: string;
  displayName: string;
  username: string;
  bio?: string;
  profileImage?: {
    profileImageURL?: string;
  };
  followerCount: number;
  followingCount: number;
  bodyWeight?: number;
  workoutCount: number;
  creator?: {
    type?: string[];
    instagramHandle?: string;
    twitterHandle?: string;
    youtubeUrl?: string;
  };
}

// Add to existing interfaces
interface FollowRequest {
  fromUser: {
    id: string;
    username: string;
    displayName: string;
  };
  toUser: {
    id: string;
    username: string;
    displayName: string;
  };
  status: string;
}

const TABS = {
  STATS: 'stats',
  ACTIVITY: 'activity',
  WORKOUTS: 'workouts',
  CHECKLIST: 'checklist'
} as const;

type TabType = typeof TABS[keyof typeof TABS];

export default function ProfileView() {
  const { username } = useParams<{ username: string }>();
  const [selectedTab, setSelectedTab] = useState<TabType>(TABS.ACTIVITY);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [followers, setFollowers] = useState<FollowRequest[]>([]);
  const [following, setFollowing] = useState<FollowRequest[]>([]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`https://fitwithpulse.ai/.netlify/functions/get-user-profile?username=${username}`);
        if (!response.ok) {
          throw new Error('Profile not found');
        }
        const data = await response.json();
        if (data.success) {
          setUser(data.user);
        } else {
          throw new Error(data.error || 'Failed to load profile');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchUserProfile();
    }
  }, [username]);

  useEffect(() => {
    const fetchFollowData = async (userId: string) => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          fetch(`https://fitwithpulse.ai/.netlify/functions/get-followers?userId=${userId}`),
          fetch(`https://fitwithpulse.ai/.netlify/functions/get-following?userId=${userId}`)
        ]);

        if (!followersRes.ok || !followingRes.ok) {
          throw new Error('Failed to fetch follow data');
        }

        const followersData = await followersRes.json();
        const followingData = await followingRes.json();

        if (followersData.success && followingData.success) {
          setFollowers(followersData.followers);
          setFollowing(followingData.following);
        }
      } catch (error) {
        console.error('Error fetching follow data:', error);
      }
    };

    if (user?.id) {
      fetchFollowData(user.id);
    }
  }, [user?.id]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error || !user) {
    return <div className="flex items-center justify-center min-h-screen">Profile not found</div>;
  }

  const socialLinks = {
    instagram: user.creator?.instagramHandle,
    twitter: user.creator?.twitterHandle,
    youtube: user.creator?.youtubeUrl
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="relative">
        <div className="h-48 bg-gradient-to-b from-zinc-800 to-zinc-900" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-24">
            <div className="relative inline-block">
              <img 
                src={user.profileImage?.profileImageURL || "/api/placeholder/96/96"}
                alt={user.displayName}
                className="w-24 h-24 rounded-full border-4 border-zinc-900"
              />
            </div>

            <div className="mt-4 text-white">
              <h1 className="text-2xl font-bold">{user.displayName}</h1>
              <p className="text-zinc-400">@{user.username}</p>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-zinc-400">
                <span>{followers.length} followers</span>
                <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                <span>{following.length} following</span>
              </div>

              <p className="mt-4 text-zinc-300">{user.bio}</p>

              <div className="mt-4 flex gap-6">
                {Object.entries(socialLinks).map(([platform, handle]) => (
                  handle && (
                    <a 
                      key={platform}
                      href={getSocialLink(platform, handle)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-white transition-colors"
                    >
                      {platform}
                    </a>
                  )
                ))}
              </div>
            </div>

            <div className="mt-8 border-b border-zinc-700">
              <nav className="flex gap-8">
                {Object.values(TABS).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedTab(tab)}
                    className={`pb-4 px-2 text-sm font-medium transition-colors relative 
                      ${selectedTab === tab ? 'text-white' : 'text-zinc-400 hover:text-zinc-300'}`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {selectedTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-8">
              {selectedTab === TABS.STATS && (
                <div className="grid grid-cols-2 gap-4 text-white">
                  {/* <div className="p-4 bg-zinc-800 rounded-lg">
                    <div className="text-2xl font-bold">
                      {user.bodyWeight?.[user.bodyWeight.length - 1]?.newWeight || 0} lbs
                    </div>
                    <div className="text-zinc-400">Body Weight</div>
                  </div> */}
                  <div className="p-4 bg-zinc-800 rounded-lg">
                    <div className="text-2xl font-bold">{user.workoutCount || 0}</div>
                    <div className="text-zinc-400">Workouts</div>
                  </div>
                </div>
              )}
              {selectedTab === TABS.ACTIVITY && (
                <div className="text-zinc-400">
                  Activity feed coming soon...
                </div>
              )}
              {selectedTab === TABS.WORKOUTS && (
                <div className="text-zinc-400">
                  Workouts library coming soon...
                </div>
              )}
              {selectedTab === TABS.CHECKLIST && (
                <div className="text-zinc-400">
                  Onboarding checklist coming soon...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSocialLink(platform: string, handle: string): string {
  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'youtube':
      return handle; // Assuming full URL is stored
    default:
      return '#';
  }
}