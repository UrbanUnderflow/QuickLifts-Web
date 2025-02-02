import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Crown, Award, Flame, Sunrise, Heart, TrendingUp } from 'lucide-react';
import { workoutService, Challenge, UserChallenge, SweatlistCollection } from '../../../api/firebase/workout';


// --- Shareable Analytics View ---
// This view will be rendered off-screen (hidden) and snapped to an image in a 3:4 ratio.
interface ShareableAnalyticsViewProps {
  participants: UserChallenge[];
  analyticsText: string;
}
const ShareableAnalyticsView: React.FC<ShareableAnalyticsViewProps> = ({ participants, analyticsText }) => {
  return (
    <div className="w-[300px] h-[400px] bg-zinc-900 text-white p-4 rounded-lg flex flex-col">
      {/* Podium Section */}
      <div className="flex justify-center items-end space-x-4 mb-4">
        {participants[1] && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-gray-400 overflow-hidden">
              <img
                src={participants[1].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[1].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-gray-400 font-bold">{participants[1].pulsePoints.totalPoints}</div>
          </div>
        )}
        {participants[0] && (
          <div className="text-center -mb-4">
            <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-yellow-400 overflow-hidden">
              <img
                src={participants[0].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[0].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-yellow-400 font-bold">{participants[0].pulsePoints.totalPoints}</div>
          </div>
        )}
        {participants[2] && (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-amber-700 overflow-hidden">
              <img
                src={participants[2].profileImage?.profileImageURL || '/default-avatar.png'}
                alt={participants[2].username}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-amber-700 font-bold">{participants[2].pulsePoints.totalPoints}</div>
          </div>
        )}
      </div>
      {/* Analytics Text */}
      <div className="text-center text-xl font-bold mb-2">{analyticsText}</div>
      <div className="text-center text-sm text-gray-400">Challenge Wrap-up</div>
      <div className="mt-auto text-center text-xs text-gray-500">Powered by QuickLifts</div>
    </div>
  );
};

// --- Activity View for Share Sheet ---
interface ActivityViewProps {
  activityItems: any[];
  applicationActivities?: any[];
}
const ActivityView: React.FC<ActivityViewProps> = ({ activityItems, applicationActivities }) => {
  // This component wraps the native share sheet. In a web context, you can use navigator.share if available.
  useEffect(() => {
    if (navigator.share) {
      navigator
        .share({
          title: 'Round Wrap-up',
          text: 'Check out my round wrap-up results!',
          url: activityItems[0], // our share image data URL
        })
        .catch((error) => console.error('Error sharing', error));
    } else {
      // Fallback: For now, just log
      console.log('Native share not supported.');
    }
  }, [activityItems]);
  return <div />;
};

// --- Main RoundWrapup Component ---
const RoundWrapup: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<UserChallenge[]>([]);
  const [rankedParticipants, setRankedParticipants] = useState<UserChallenge[]>([]);
  const [topEarlyRiser, setTopEarlyRiser] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [topStreakHolder, setTopStreakHolder] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [mostEncouraging, setMostEncouraging] = useState<{ user: UserChallenge; count: number } | null>(null);
  const [biggestComeback, setBiggestComeback] = useState<{ user: UserChallenge; improvement: number } | null>(null);
  const [shareItems, setShareItems] = useState<any[]>([]);
  const [activeSheet, setActiveSheet] = useState<boolean>(false);
  const router = useRouter();
  const { id } = router.query;

  // A ref for the shareable analytics view snapshot
  const shareableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch challenge and participants
        const collection: SweatlistCollection = await workoutService.getCollectionById("cevWHBlBk7VobANRUsmC");
        const participantsResponse = await workoutService.getUserChallengesByChallengeId("cevWHBlBk7VobANRUsmC");
        setChallenge(collection.challenge || null);
        setParticipants(participantsResponse.userChallenges || []);
      } catch (error) {
        console.error('Error fetching round data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // When participants update, calculate rankings and superlatives
  useEffect(() => {
    if (participants.length > 0) {
      const sorted = [...participants].sort((a, b) => b.pulsePoints.totalPoints - a.pulsePoints.totalPoints);
      setRankedParticipants(sorted);

      const earlyRisers = participants.map((p) => ({
        user: p,
        count: p.completedWorkouts.filter((w: any) => new Date(w.completedAt).getHours() < 8).length,
      }));
      setTopEarlyRiser(earlyRisers.sort((a, b) => b.count - a.count)[0]);

      const streaks = participants.map((p) => ({ user: p, count: p.currentStreak }));
      setTopStreakHolder(streaks.sort((a, b) => b.count - a.count)[0]);

      const encouraging = participants.map((p) => ({ user: p, count: p.encouragedUsers.length }));
      setMostEncouraging(encouraging.sort((a, b) => b.count - a.count)[0]);

      // Biggest comeback (using mock logic)
      const comeback = participants.map((p) => ({
        user: p,
        improvement: Math.floor(Math.random() * 100),
      }));
      setBiggestComeback(comeback.sort((a, b) => b.improvement - a.improvement)[0]);
    }
  }, [participants]);

  // Helper: capture snapshot of shareable view using html2canvas
  const generateShareableImage = async (): Promise<string | null> => {
    if (shareableRef.current) {
      const canvas = await html2canvas(shareableRef.current);
      return canvas.toDataURL('image/png');
    }
    return null;
  };

  // shareRound uses the shareable view to generate an image then triggers share
  const shareRound = async () => {
    const imageUrl = await generateShareableImage();
    if (imageUrl) {
      setShareItems([imageUrl]);
      setActiveSheet(true);
    } else {
      console.error('Failed to generate shareable image.');
    }
  };

  // Compute analytics text
  const analyticsText =
    rankedParticipants.length > 0
      ? `Top Score: ${rankedParticipants[0].pulsePoints.totalPoints} pts`
      : 'Challenge Wrap-up';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-900 text-white">
        Loading wrap-up...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6 relative">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Round Complete! 🎉</h1>
        <h2 className="text-xl text-zinc-400">{challenge?.title}</h2>
      </div>

      {/* Podium Section */}
      <div className="mb-12">
        <div className="flex justify-center items-end space-x-4">
          {rankedParticipants[1] && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-gray-400 overflow-hidden">
                <img
                  src={rankedParticipants[1].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[1].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-gray-400 font-bold">{rankedParticipants[1].pulsePoints.totalPoints}</div>
            </div>
          )}
          {rankedParticipants[0] && (
            <div className="text-center -mb-4">
              <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <div className="w-24 h-24 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-yellow-400 overflow-hidden">
                <img
                  src={rankedParticipants[0].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[0].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-yellow-400 font-bold">{rankedParticipants[0].pulsePoints.totalPoints}</div>
            </div>
          )}
          {rankedParticipants[2] && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-zinc-800 border-2 border-amber-700 overflow-hidden">
                <img
                  src={rankedParticipants[2].profileImage?.profileImageURL || '/default-avatar.png'}
                  alt={rankedParticipants[2].username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-amber-700 font-bold">{rankedParticipants[2].pulsePoints.totalPoints}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="mb-12">
        <div className="mb-4 px-4 text-left">
          <h3 className="text-xl font-bold">Your Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <div className="flex space-x-4 px-4">
            {/* Day Streak */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Flame className="w-8 h-8 text-orange-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === 'currentUserId')?.currentStreak) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Day Streak</div>
            </div>
            {/* Completion */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <TrendingUp className="w-8 h-8 text-primaryGreen" />
              </div>
              <div className="text-center text-2xl font-bold">
                {challenge ? Math.floor(((participants.find(p => p.userId === 'currentUserId')?.completedWorkouts.length || 0) / challenge.durationInDays) * 100) : 0}%
              </div>
              <div className="text-center text-sm text-gray-400">Completion</div>
            </div>
            {/* Encouraged */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Heart className="w-8 h-8 text-purple-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === 'currentUserId')?.encouragedUsers.length) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Encouraged</div>
            </div>
            {/* Check-ins */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <span className="w-8 h-8 flex items-center justify-center text-green-400 font-bold">✓</span>
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === 'currentUserId')?.checkIns.length) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Check-ins</div>
            </div>
            {/* Pulse Points */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Award className="w-8 h-8 text-blue-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(participants.find(p => p.userId === 'currentUserId')?.pulsePoints.totalPoints) || 0}
              </div>
              <div className="text-center text-sm text-gray-400">Pulse Points</div>
            </div>
            {/* Rank */}
            <div className="w-32 p-4 bg-zinc-800 rounded-lg">
              <div className="flex justify-center">
                <Crown className="w-8 h-8 text-yellow-400" />
              </div>
              <div className="text-center text-2xl font-bold">
                {(() => {
                  const sorted = [...participants].sort((a, b) => b.pulsePoints.totalPoints - a.pulsePoints.totalPoints);
                  const currentUser = participants.find(p => p.userId === 'currentUserId');
                  const rank = sorted.findIndex(p => p.userId === (currentUser ? currentUser.userId : '')) + 1;
                  return rank > 0 ? `#${rank}` : '-';
                })()}
              </div>
              <div className="text-center text-sm text-gray-400">Rank</div>
            </div>
          </div>
        </div>
      </div>

      {/* Superlatives Section */}
      <div className="mb-12 px-4">
        <h3 className="text-2xl font-bold mb-6">Round Highlights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mostEncouraging && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <Heart className="w-6 h-6 text-red-400 mr-2" />
                <span className="font-bold">Most Encouraging</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={mostEncouraging.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={mostEncouraging.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{mostEncouraging.user.username}</div>
                  <div className="text-sm text-zinc-400">{mostEncouraging.count} encouragements</div>
                </div>
              </div>
            </div>
          )}

          {topStreakHolder && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <Flame className="w-6 h-6 text-orange-400 mr-2" />
                <span className="font-bold">Streak Master</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={topStreakHolder.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={topStreakHolder.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{topStreakHolder.user.username}</div>
                  <div className="text-sm text-zinc-400">{topStreakHolder.count} day streak</div>
                </div>
              </div>
            </div>
          )}

          {topEarlyRiser && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <Sunrise className="w-6 h-6 text-yellow-400 mr-2" />
                <span className="font-bold">Early Bird</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={topEarlyRiser.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={topEarlyRiser.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{topEarlyRiser.user.username}</div>
                  <div className="text-sm text-zinc-400">{topEarlyRiser.count} early workouts</div>
                </div>
              </div>
            </div>
          )}

          {biggestComeback && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-400 mr-2" />
                <span className="font-bold">Biggest Comeback</span>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-zinc-700 overflow-hidden mr-3">
                  <img
                    src={biggestComeback.user.profileImage?.profileImageURL || '/default-avatar.png'}
                    alt={biggestComeback.user.username}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold">{biggestComeback.user.username}</div>
                  <div className="text-sm text-zinc-400">+{biggestComeback.improvement}% improvement</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Points Distribution Chart */}
      <div className="mb-12 px-4">
        <h3 className="text-2xl font-bold mb-6">Points Distribution</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <BarChart data={rankedParticipants}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="username" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="pulsePoints.totalPoints" fill="#E0FE10" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hidden shareable view for snapshot */}
      <div className="absolute top-0 left-0 -z-10 opacity-0">
        <ShareableAnalyticsView participants={participants} analyticsText={analyticsText} />
      </div>

      {/* When shareItems is set and activeSheet is true, render the ActivityView */}
      {activeSheet && shareItems.length > 0 && <ActivityView activityItems={shareItems} />}
    </div>
  );
};

export default RoundWrapup;
