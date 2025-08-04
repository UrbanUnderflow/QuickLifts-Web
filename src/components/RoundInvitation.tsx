import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Flag, Users, Play, ChevronDown } from 'lucide-react';
import { ChallengeInvitationProps, PricingInfo } from '../api/firebase/workout/types';
import ChallengeCTA from './ChallengeCTA';
import {IntroVideo} from '../api/firebase/workout'
import { useRouter } from 'next/router';
import { useUser } from '../hooks/useUser';
import { useDispatch } from 'react-redux';
import { getAuth } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { setUser } from '../redux/userSlice';

const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', { 
    month: 'long',
    day: 'numeric'
  });
};

const getDurationInDays = (startDateString: string | Date, endDateString: string | Date): number => {
  const startDate = typeof startDateString === 'string' ? new Date(startDateString) : startDateString;
  const endDate = typeof endDateString === 'string' ? new Date(endDateString) : endDateString;
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

interface DetailTileProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const DetailTile: React.FC<DetailTileProps> = ({ title, value, icon }) => (
  <div className="flex-1 p-4 bg-zinc-900 rounded-xl">
    <div className="flex flex-col items-center gap-2">
      {icon}
      <div className="flex flex-col items-center">
        <span className="text-lg font-semibold text-white">{value}</span>
        <span className="text-sm text-white/70">{title}</span>
      </div>
    </div>
  </div>
);


interface VideoPreviewProps {
  introVideos?: IntroVideo[];
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ introVideos }) => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hostId = params.get('id');
    if (hostId) setCurrentUserId(hostId);
  }, []);
 
  const videoUrl = introVideos?.find(video => video.userId === currentUserId)?.videoUrl;
 
  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current) {
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Autoplay failed:', error);
        }
      }
    };
    
    if (videoUrl) {
      playVideo();
    }
  }, [videoUrl]);

  if (!videoUrl) {
    return (
      <div className="relative bg-black rounded-xl h-48 mb-8 flex items-center justify-center">
        <Play className="w-8 h-8 text-white/90" />
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-xl h-48 mb-8 overflow-hidden">
     <video
       ref={videoRef}
       className="w-full h-full object-cover"
       src={videoUrl}
       controls={isPlaying}
       playsInline
       autoPlay
       muted
     >
     </video>
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 cursor-pointer"
          onClick={() => {
            videoRef.current?.play();
            setIsPlaying(true);
          }}
        >
          <Play className="w-8 h-8 text-white/90" />
        </div>
      )}
    </div>
  );
};

interface HostSectionProps {
  userId: string;
}

const HostSection: React.FC<HostSectionProps> = ({ userId }) => {
  const router = useRouter();
  const [hostData, setHostData] = useState<{ 
    username?: string; 
    profileImage?: { profileImageURL: string } | null 
  }>({});

  useEffect(() => {
    const fetchHostData = async () => {
      try {
        const apiUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:8888/.netlify/functions'
          : 'https://fitwithpulse.ai/.netlify/functions';
  
        const response = await fetch(`${apiUrl}/get-user-by-id?id=${userId}`);
        const data = await response.json();
        
        console.log('API Response:', data);
        
        if (data.success) {
          setHostData({
            username: data.user.username,
            profileImage: data.user.profileImage  // Use the whole profileImage object
          });
        }
      } catch (error) {
        console.error('Error fetching host data:', error);
      }
    };
  
    if (userId) {
      fetchHostData();
    }
  }, [userId]);

  if (!hostData.username) return null;

  return (
    <div 
      className="flex items-center justify-center gap-3 mb-8 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => router.push(`/profile/${hostData.username}`)}
      role="button"
      aria-label={`View ${hostData.username}'s profile`}
    >
      <div className="flex items-center gap-2">
        {hostData.profileImage?.profileImageURL ? (
          <img 
            src={hostData.profileImage.profileImageURL}
            alt={hostData.username}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
            <Users className="w-6 h-6 text-zinc-400" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-sm text-white/70">Hosted by</span>
          <span className="font-medium">{hostData.username}</span>
        </div>
      </div>
    </div>
  );
};

const UserBadge: React.FC = () => {
  const currentUser = useUser();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const auth = getAuth();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      dispatch(setUser(null));
      setIsMenuOpen(false);
      
      // Clear the localStorage flag so user sees marketing content instead of dashboard
      localStorage.removeItem('pulse_has_seen_marketing');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative" ref={menuRef}>
      <div 
        className="inline-flex items-center gap-1.5 bg-zinc-800/80 backdrop-blur-sm rounded-full px-2 py-1 cursor-pointer hover:bg-zinc-700/80 transition-colors mb-6"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        role="button"
        aria-label={`User menu for ${currentUser.username}`}
      >
        {currentUser.profileImage?.profileImageURL ? (
          <img 
            src={currentUser.profileImage.profileImageURL}
            alt={currentUser.username}
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        )}
        <span className="text-xs text-white/90">Signed in as {currentUser.username}</span>
        <ChevronDown 
          className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${
            isMenuOpen ? 'rotate-180' : ''
          }`} 
        />
      </div>

      {isMenuOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 z-50 overflow-hidden">
          <div 
            className="px-4 py-2 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer"
            onClick={() => {
              router.push(`/profile/${currentUser.username}`);
              setIsMenuOpen(false);
            }}
          >
            <span className="text-white">View Profile</span>
          </div>
          <div 
            className="px-4 py-2 hover:bg-zinc-700 transition-colors duration-200 cursor-pointer"
            onClick={handleSignOut}
          >
            <span className="text-white">Sign Out</span>
          </div>
        </div>
      )}
    </div>
  );
};

const RoundInvitation: React.FC<ChallengeInvitationProps> = ({ challenge, ttclid }) => {
  const router = useRouter();
  const currentUser = useUser();
  const [hostId, setHostId] = useState<string>('');

  console.log("RoundInvitation Render:", {
    hasPricingInfo: !!challenge.pricingInfo,
    pricingInfo: challenge.pricingInfo,
    fullChallenge: challenge
  });

  // Ensure we have valid Date objects
  const startDate = new Date(challenge.startDate);
  const endDate = new Date(challenge.endDate);
  
  // Ensure participants is always an array
  const participantsCount = challenge.participants?.length ?? 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setHostId(id);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* User Badge */}
        <div className="flex justify-center">
          <UserBadge />
        </div>
        
        {/* Header Section */}
        <div className="text-center space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white/90">
            You're invited to participate in this Round 🎉
          </h2>
          {challenge.pricingInfo?.isEnabled && (
            <div className="flex justify-center">
              <PricingBadge pricingInfo={challenge.pricingInfo} />
            </div>
          )}
          <h1 className="text-3xl font-bold">{challenge.title}</h1>
          <p className="text-white/70">{challenge.subtitle}</p>
        </div>

        {/* Host Section */}
        {hostId && <HostSection userId={hostId} />}

        {/* Only show VideoPreview if there are introVideos */}
        {challenge.introVideos && challenge.introVideos.length > 0 && (
          <VideoPreview introVideos={challenge.introVideos} />
        )}
        
        {/* Challenge Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <DetailTile 
            title="Duration" 
            value={`${getDurationInDays(startDate, endDate)} Days`}
            icon={<Calendar className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Start Date" 
            value={formatDate(startDate)}
            icon={<Clock className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="End Date" 
            value={formatDate(endDate)}
            icon={<Flag className="w-6 h-6 text-[#E0FE10]" />}
          />
          <DetailTile 
            title="Participants" 
            value={participantsCount}
            icon={<Users className="w-6 h-6 text-[#E0FE10]" />}
          />
        </div>

        {/* Add the CTA component and pass ttclid */}
        <ChallengeCTA challenge={challenge} ttclid={ttclid} />
      </div>
    </div>
  );
};

// Inside RoundInvitation.tsx, add this new component
const PricingBadge = ({ pricingInfo }: { pricingInfo: PricingInfo }) => {
  if (!pricingInfo || !pricingInfo.isEnabled) return null;
  
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: pricingInfo.currency,
    minimumFractionDigits: 2
  });
  
  // Convert amount from cents to dollars
  const amountInDollars = pricingInfo.amount / 100;
  
  return (
    <div className="bg-zinc-800 rounded-full px-4 py-1 inline-flex items-center mb-4">
      <span className="text-[#E0FE10] mr-1">Premium Round</span>
      <span className="text-white font-semibold">{formatter.format(amountInDollars)}</span>
    </div>
  );
};


export default RoundInvitation;