import React, { useEffect, useState } from 'react';
import { Challenge, ChallengeStatus, UserChallenge, SweatlistCollection } from '../../api/firebase/workout/types';
import { userService, User } from '../../api/firebase/user';
import { workoutService } from '../../api/firebase/workout/service';
import { ChatService } from '../../api/firebase/chat/service';
import { useRouter } from 'next/router';
import { Calendar, ChevronDown, Users, Clock, Flag } from 'lucide-react';

interface ChallengeWaitingRoomViewProps {
  viewModel: ChallengeWaitingRoomViewModel;
  initialParticipants: UserChallenge[];
}

export const ChallengeWaitingRoomView: React.FC<ChallengeWaitingRoomViewProps> = ({
  viewModel,
  initialParticipants,
}) => {
  // Extract collection for convenience.
  const collection: SweatlistCollection = viewModel.challengeDetailViewModel.collection;
  
  const [participants, setParticipants] = useState<UserChallenge[]>(initialParticipants);
  const [userChallenge, setUserChallenge] = useState<UserChallenge | null>(null);
  const [hosts, setHosts] = useState<User[]>([]);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [showMenu, setShowMenu] = useState(false);

  const router = useRouter();
  const currentUser: User | null = userService.currentUser;

  // Compute countdown from challenge.startDate
  const computeCountdown = (startDate: Date) => {
    const now = new Date();
    const diff = startDate.getTime() - now.getTime();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return { days, hours, minutes };
  };

  // Update countdown every minute if challenge exists
  useEffect(() => {
    if (viewModel.challenge?.startDate) {
      setCountdown(computeCountdown(new Date(viewModel.challenge.startDate)));
      const timer = setInterval(() => {
        // Using non-null assertion because we already checked above
        setCountdown(computeCountdown(new Date(viewModel.challenge!.startDate)));
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [viewModel.challenge]);

  // Fetch participants using the collection ID
  const getParticipants = (collectionId: string) => {
    workoutService.getUserChallengesByChallengeId(collectionId)
      .then(({ userChallenges, error }) => {
        if (error) {
          console.error("Error fetching participants:", error);
          return;
        }
        setParticipants(userChallenges);
        const currentUserId = userService.currentUser?.id;
        if (currentUserId) {
          const uc = userChallenges.find((uc) => uc.userId === currentUserId) || null;
          setUserChallenge(uc);
        }
      })
      .catch((err: any) => console.error("Error fetching participants:", err));
  };

  // Fetch host info using the collection's ownerId array
  useEffect(() => {
    if (collection && collection.ownerId && collection.ownerId.length > 0) {
      userService.getUsersByIds(collection.ownerId)
        .then(setHosts)
        .catch((err: any) => console.error("Error fetching hosts:", err));
    }
  }, [collection]);

  useEffect(() => {
    // When the view appears, fetch chat messages and participants.
    viewModel.fetchChatMessages();
    if (collection.id) {
      getParticipants(collection.id);
    }
  }, [collection, viewModel]);

  // Handler for joining the challenge.
  const handleJoin = () => {
    if (!viewModel.challenge) return;
    viewModel.joinChallenge(viewModel.challenge, (newUserChallenge) => {
      if (newUserChallenge) {
        // Append the new user challenge to participants.
        setParticipants(prev => [...prev, newUserChallenge]);
        setUserChallenge(newUserChallenge);

        // Update collection challenge participants and call updateCollection.
        const updatedChallenge = {
          ...viewModel.challenge,
          participants: [...(viewModel.challenge?.participants || []), newUserChallenge],
        };

        const currentCollection = collection;
        const newCollection = new SweatlistCollection({
          id: currentCollection.id,
          title: currentCollection.title,
          subtitle: currentCollection.subtitle,
          challenge: updatedChallenge,
          sweatlistIds: currentCollection.sweatlistIds,
          ownerId: currentCollection.ownerId,
          createdAt: currentCollection.createdAt,
          updatedAt: currentCollection.updatedAt,
        });
        workoutService.updateCollection(newCollection)
          .then(() => {
            // viewModel.appCoordinator.showToast({
            //   message: 'Successfully joined challenge!',
            //   backgroundColor: '#34D399', // primaryGreen equivalent
            //   textColor: '#FFF',
            // });
          })
          .catch((err: any) => {
            console.error(err);
            // viewModel.appCoordinator.showToast({
            //   message: 'Failed to update challenge',
            //   backgroundColor: '#F87171', // red
            //   textColor: '#FFF',
            // });
          });
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        {/* <button onClick={() => viewModel.appCoordinator.closeModals()} className="p-2">
          <span className="material-icons text-white">close</span>
        </button> */}
        <div 
            className="flex-shrink-0 cursor-pointer" 
            onClick={() => router.push("/")}
            >
            <img 
                src="/pulse-logo-white.svg" 
                alt="Pulse Logo" 
                className="h-8 mx-auto mb-8"
            />
            </div>
            <div className="w-6" /> 
      </div>

      <div className="px-4 pb-8">
        {/* Welcome Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-green-500 bg-opacity-15 flex items-center justify-center">
            <Flag className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-green-500 uppercase text-sm">Welcome</p>
            <h1 className="text-3xl font-extrabold">
              {viewModel.challenge?.title || 'the Round'}
            </h1>
            {viewModel.challenge?.subtitle && (
              <p className="text-base text-gray-400">{viewModel.challenge.subtitle}</p>
            )}
          </div>
        </div>

        {/* Host Info Section */}
        <div className="mt-8">
          <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-green-500" />
          <p className="text-sm text-gray-400">Hosted by</p>
          </div>
          <div className="mt-2 overflow-x-auto">
            <div className="flex space-x-4">
              {hosts.map((host) => (
                <div key={host.id} className="flex flex-col items-center">
                  <img
                    src={host.profileImage?.profileImageURL || '/default-profile.png'}
                    alt={host.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <p className="text-xs text-gray-300">@{host.username}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Countdown / Status Section */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-center">
          {viewModel.challenge?.status === ChallengeStatus.Draft ? (
            <div>
              <h2 className="text-lg font-semibold">THE WAITING ROOM</h2>
              <div className="flex items-center justify-center space-x-2">
              <Clock className="h-5 w-5 text-green-500" />
              <h2 className="text-lg font-semibold">Round is being prepared</h2>
              </div>
              {userChallenge === null ? (
                <p className="text-sm text-gray-400 mt-2">
                  Join now to be notified when the round begins and connect with other challengers!
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-2">
                  Thanks for joining! Sit tight, we'll notify you when the round begins.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center space-x-2">
                <span className="material-icons text-green-500">access_time</span>
                <h2 className="text-lg font-semibold">Round starts in</h2>
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-green-500">{countdown.days}</p>
                  <p className="text-sm text-gray-400">Days</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-green-500">{countdown.hours}</p>
                  <p className="text-sm text-gray-400">Hours</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-green-500">{countdown.minutes}</p>
                  <p className="text-sm text-gray-400">Minutes</p>
                </div>
              </div>
              {userChallenge === null ? (
                <p className="text-sm text-gray-400 mt-4">
                  Get ready! Join now to meet your fellow challengers.
                </p>
              ) : (
                <p className="text-sm text-gray-400 mt-4">
                  Thanks for joining! We'll notify you when the round begins.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Participants Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Who's joining</h2>
              <span className="text-sm text-green-500">({participants.length} challengers)</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex space-x-4 px-2">
              {userChallenge === null && (
                <button
                  onClick={handleJoin}
                  className="flex flex-col items-center p-4 bg-gray-700 rounded-lg border border-green-500 hover:bg-gray-600 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-green-500 flex items-center justify-center">
                    <span className="material-icons text-green-500">add</span>
                  </div>
                  <p className="text-xs mt-2 text-green-500">Join Round</p>
                </button>
              )}
              {participants.map((participant) => (
                <div key={participant.id} className="flex flex-col items-center p-4 bg-gray-700 rounded-lg border border-gray-700">
                  {participant.profileImage?.profileImageURL ? (
                    <img
                      src={participant.profileImage.profileImageURL}
                      alt={participant.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-green-500"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-lg">{participant.username.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-xs mt-2 text-gray-300">@{participant.username}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------
// ViewModel Interface
// -------------------------
export interface ChallengeWaitingRoomViewModel {
  challenge?: Challenge;
  challengeDetailViewModel: { collection: SweatlistCollection };
  fetchChatMessages: () => void;
  joinChallenge: (
    challenge: Challenge,
    completion: (userChallenge: UserChallenge | null) => void
  ) => void;
}
