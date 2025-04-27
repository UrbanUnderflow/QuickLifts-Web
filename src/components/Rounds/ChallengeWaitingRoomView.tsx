import React, { useEffect, useState, useMemo } from 'react';
import { Challenge, ChallengeStatus, UserChallenge, SweatlistCollection } from '../../api/firebase/workout/types';
import { userService, User } from '../../api/firebase/user';
import { workoutService } from '../../api/firebase/workout/service';
import { ChatService } from '../../api/firebase/chat/service';
import { useRouter } from 'next/router';
import { Calendar, ChevronDown, Users, Clock, Flag, Share2, X, MessageSquare } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import RoundChatView from './RoundChatView';
import { GroupMessage, MessageMediaType } from '../../api/firebase/chat/types';
import { ShortUser } from '../../api/firebase/user/types';
import { useDispatch } from 'react-redux';
import { showToast } from '../../redux/toastSlice';

interface ChallengeWaitingRoomViewProps {
  viewModel: ChallengeWaitingRoomViewModel;
  initialParticipants: UserChallenge[];
  isOwner: boolean;
  setShowWaitingRoomAsOwner: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ChallengeWaitingRoomView: React.FC<ChallengeWaitingRoomViewProps> = ({
  viewModel,
  initialParticipants,
  isOwner,
  setShowWaitingRoomAsOwner,
}) => {
  // Extract collection for convenience.
  const collection: SweatlistCollection = viewModel.challengeDetailViewModel.collection;
  const challenge: Challenge | null = viewModel.challenge || null;
  
  const [participants, setParticipants] = useState<UserChallenge[]>(initialParticipants);
  const [userChallenge, setUserChallenge] = useState<UserChallenge | null>(null);
  const [hosts, setHosts] = useState<User[]>([]);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
  });
  const [showMenu, setShowMenu] = useState(false);

  // --- Chat State ---
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatExpanded, setChatExpanded] = useState(true);
  // --- End Chat State ---

  const router = useRouter();
  const currentUser = useUser();
  const dispatch = useDispatch();

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

  useEffect(() => {
    if (challenge?.id && currentUser) {
      // Find the current user's specific challenge participation details
      const uc = participants.find((p) => p.userId === currentUser.id) || null;
      setUserChallenge(uc);
    }
  }, [participants, currentUser, challenge]);

  // --- Chat useEffects ---
  useEffect(() => {
    // Fetch initial messages and set up listener
    const fetchMessagesAndSubscribe = async () => {
      if (challenge?.id) {
        try {
          const initialMessages = await ChatService.getInstance().fetchChallengeMessages(challenge.id);
          setMessages(initialMessages);
          calculateUnread(initialMessages);
        } catch (error) {
          console.error('Error fetching initial messages:', error);
        }
        // Setup listener regardless of initial fetch success
        const unsubscribe = setupRealtimeUpdates();
        return () => unsubscribe();
      } else {
        // Return a no-op function if no challenge ID
        return () => {};
      }
    };

    const unsubscribePromise = fetchMessagesAndSubscribe();
    
    // Cleanup function
    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, [challenge?.id]);

  useEffect(() => {
    // Mark messages as read when messages change and user is present
    if (challenge?.id && currentUser) {
      const unreadMessages = messages.filter(msg => !msg.readBy[currentUser.id]);
      if (unreadMessages.length > 0) {
        ChatService.getInstance().markMessagesAsRead(
          challenge.id,
          currentUser.id,
          unreadMessages.map(msg => msg.id)
        );
        // Optimistically update unread count
        calculateUnread(messages);
      }
    }
  }, [messages, challenge?.id, currentUser]);

  const setupRealtimeUpdates = () => {
    if (!challenge?.id) return () => {}; // Return no-op if no id
    return ChatService.getInstance().subscribeToMessages(challenge.id, (newMessages) => {
      setMessages(newMessages);
      calculateUnread(newMessages);
    });
  };
  
  const calculateUnread = (currentMessages: GroupMessage[]) => {
    if (!currentUser) return;
    const count = currentMessages.filter(msg => 
      !msg.readBy[currentUser.id]
    ).length;
    setUnreadCount(count);
  };

  const handleSendMessage = async (message: string, image?: File) => {
    if (!challenge?.id || !currentUser) return;
  
    try {
      let mediaUrl: string | null = null;
      let mediaType = MessageMediaType.None;
      if (image) {
        mediaUrl = await ChatService.getInstance().uploadMedia(image);
        mediaType = MessageMediaType.Image; // Assuming only image uploads for now
        if (!mediaUrl) {
          console.error('Failed to upload image');
          // TODO: Show error toast to user
          return; 
        }
      }
  
      const messageData: Omit<GroupMessage, 'id'> = {
        sender: currentUser.toShortUser(),
        content: message,
        timestamp: new Date(),
        readBy: { [currentUser.id]: new Date() }, // Use Date for readBy timestamp
        mediaURL: mediaUrl,
        mediaType: mediaType,
        checkinId: null, 
        gymName: null 
      };
  
      await ChatService.getInstance().sendMessage(challenge.id, messageData);
      // Message will appear via the real-time listener
    } catch (error) { 
      console.error('Failed to send message:', error);
      // TODO: Show error toast to user
    }
  };
  // --- End Chat useEffects & Handlers ---

  // --- Chat Expansion Toggle ---
  const toggleChatExpansion = () => {
    setChatExpanded(!chatExpanded);
  };
  // --- End Chat Expansion Toggle ---

  // Fetch participants using the collection ID
  const getParticipants = (collectionId: string) => {
    workoutService.getUserChallengesByChallengeId(collectionId)
      .then(({ userChallenges, error }) => {
        if (error) {
          console.error("Error fetching participants:", error);
          return;
        }
        setParticipants(userChallenges);
      })
      .catch((err: any) => console.error("Error fetching participants catch:", err));
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

  const hasJoined = useMemo(() => {
    return !!userChallenge;
  }, [userChallenge]);

  // --- Share Handler ---
  const handleShare = async () => {
    if (!currentUser) {
      alert("Please log in or sign up to share!"); // Basic alert, replace with modal/toast
      return;
    }
    if (!collection) {
      alert("Cannot generate share link: Challenge data not loaded.");
      return;
    }
    if (!userChallenge) {
      alert("Cannot award points: Your participation data isn't loaded yet.");
      console.warn("UserChallenge data not available for awarding share points.");
    } else {
      // Log the current bonus status before checking
      console.log("[Share Points] Current hasReceivedShareBonus:", userChallenge.hasReceivedShareBonus);
      console.log("[Share Points] UserChallenge state after update:", userChallenge); // Log updated state
    }

    let awardedPoints = false;

    // --- Award points logic ---
    if (userChallenge && !userChallenge.hasReceivedShareBonus) {
      try {
        console.log("Attempting to award first share bonus points...");
        // Create a deep copy to avoid mutating state directly before update
        const updatedChallengeData = JSON.parse(JSON.stringify(userChallenge.toDictionary()));
        
        // --- Explicitly set the ID ---
        // Ensure the 'id' property exists and holds the correct value from the original object
        if (userChallenge.id && !updatedChallengeData.id) {
           updatedChallengeData.id = userChallenge.id;
           console.log(`[Share Points] Copied ID from original userChallenge: ${updatedChallengeData.id}`);
        } else if (!userChallenge.id) {
           console.error("[Share Points] Original userChallenge object is missing its ID!");
        } else if (updatedChallengeData.id !== userChallenge.id) {
           // This case might indicate an issue with toDictionary or JSON processing
           console.warn("[Share Points] Mismatch between original ID and ID after JSON processing. Using original.");
           updatedChallengeData.id = userChallenge.id;
        }
        // -----------------------------

        // Update the necessary fields
        updatedChallengeData.hasReceivedShareBonus = true;
        updatedChallengeData.pulsePoints = updatedChallengeData.pulsePoints || {}; // Ensure pulsePoints object exists
        updatedChallengeData.pulsePoints.shareBonus = (updatedChallengeData.pulsePoints.shareBonus || 0) + 25;

        // Convert back to UserChallenge object for the update service
        const challengeToUpdate = new UserChallenge(updatedChallengeData);
        console.log("[Share Points] Challenge to updatedd:", updatedChallengeData);

        // --- ID Check ---
        if (!challengeToUpdate || !challengeToUpdate.id) {
          console.error("[Share Points] Error: Invalid UserChallenge ID before update.", challengeToUpdate);
          // Use toast for error
          dispatch(showToast({ message: "Could not award points: Internal error (missing ID).", type: 'error' }));
        } else {
          // --- Update in Firestore ---
          await workoutService.updateUserChallenge(challengeToUpdate);
          
          // --- Update local state ONLY after successful Firestore update ---
          setUserChallenge(challengeToUpdate); // Update the specific userChallenge state
          setParticipants(prevParticipants => 
            prevParticipants.map(p => p.id === challengeToUpdate.id ? challengeToUpdate : p)
          );
          awardedPoints = true;
          console.log("Successfully awarded share bonus points and updated state.");
          // --- Replace alert with toast --- 
          dispatch(showToast({ message: "+25 points for sharing! Keep it up!", type: 'success' }));
        }

      } catch (error) {
        console.error("Error awarding share bonus points:", error);
        // Use toast for error
        dispatch(showToast({ message: "Couldn't award points right now.", type: 'error' }));
      }
    }
    // --- End award points logic ---

    let generatedUrl: string | null = null; // Declare outside the try block

    try {
      // Generate the link using the service
      generatedUrl = await workoutService.generateShareableRoundLink(collection, currentUser);

      if (generatedUrl) {
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(generatedUrl);
          
          // Show success feedback (if points weren't already awarded)
          if (!awardedPoints) {
             // Use toast for success
             dispatch(showToast({ message: "Link copied to clipboard! Ready to paste.", type: 'success' })); 
          }
        } catch (clipboardError) {
            console.error('Clipboard write failed:', clipboardError);
            const manualCopyMsg = `Please copy this link manually:\n\n${generatedUrl}`;
            if (clipboardError instanceof DOMException && clipboardError.name === 'NotAllowedError') {
              dispatch(showToast({ message: `Copy failed (permission denied). ${manualCopyMsg}`, type: 'warning', duration: 6000 }));
            } else {
              dispatch(showToast({ message: `Copy failed. ${manualCopyMsg}`, type: 'warning', duration: 6000 }));
            }
        }
        
      } else {
        // Handle case where link generation failed
        console.error('Share link generation returned null.');
        dispatch(showToast({ message: "Could not generate the share link.", type: 'error' }));
      }
    } catch (error) {
      // This catch block now primarily handles errors from generateShareableRoundLink
      console.error('Error during share link generation:', error);
      dispatch(showToast({ message: "Could not generate the share link.", type: 'error' }));
    }
  };
  // --- End Share Handler ---

  // Placeholder for ChatPreviewCard
  const ChatPreviewCard = ({ onExpand, unreadCount }: { onExpand: () => void; unreadCount: number }) => (
    <button 
      onClick={onExpand}
      className="w-full p-4 bg-gray-800 rounded-lg text-left hover:bg-gray-700 transition-colors"
    >
      <div className="flex justify-between items-center">
        <p className="font-semibold">Chat</p>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 bg-[#DFFD10] text-black text-xs font-bold rounded-full">
            {unreadCount}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 mt-1">Tap to expand chat</p>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#141A1E] text-white pb-16">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sticky top-0 bg-[#141A1E] z-10">
        {/* Conditionally show close or back button */}
        {isOwner ? (
          <button 
            onClick={() => setShowWaitingRoomAsOwner(false)} 
            className="p-2 text-white hover:text-gray-300"
          >
            <ChevronDown className="h-6 w-6 transform -rotate-90" />
          </button>
        ) : (
          <button onClick={() => router.back()} className="p-2 text-white hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        )}
        <div className="flex-1 flex justify-center">
          <img 
              src="/pulse-logo-white.svg" 
              alt="Pulse Logo" 
              className="h-8"
          />
        </div>
        <div className="w-10"></div>
      </div>

      <div className="px-4 pb-8">
        {/* Welcome Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-[#DFFD10] bg-opacity-15 flex items-center justify-center">
            <Flag className="h-5 w-5 text-[#DFFD10]" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-[#DFFD10] uppercase text-sm">Welcome</p>
            <h1 className="text-3xl font-extrabold">
              {viewModel.challenge?.title || 'the Round'}
            </h1>
            {viewModel.challenge?.subtitle && (
              <p className="text-base text-gray-400">{viewModel.challenge.subtitle}</p>
            )}
          </div>
        </div>

        {/* Host Info Section - Centered */}
        <div className="mt-8">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Users className="h-5 w-5 text-[#DFFD10]" />
            <p className="text-sm text-gray-400">Hosted by</p>
          </div>
          <div className="flex justify-center space-x-4 mt-2 overflow-x-auto">
            {hosts.map((host) => (
              <div key={host.id} className="flex flex-col items-center text-center">
                <img
                  src={host.profileImage?.profileImageURL || '/default-profile.png'}
                  alt={host.username}
                  className="w-12 h-12 rounded-full object-cover mb-1"
                />
                <p className="text-xs text-gray-300">@{host.username}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Share Section - New */}
        <div className="mt-8 px-2">
          <button 
            onClick={handleShare}
            className="w-full flex items-center space-x-3 p-4 rounded-lg bg-[#DFFD10]/10 border border-[#DFFD10]/50 hover:bg-[#DFFD10]/20 transition-colors"
          >
            <Share2 className="h-5 w-5 text-[#DFFD10]" />
            <div className="text-left">
              <p className="font-semibold text-[#DFFD10]">Invite Friends to Join</p>
              <p className="text-sm text-gray-300">Share your link & earn +25 points per join! </p>
            </div>
          </button>
        </div>

        {/* Countdown / Status Section */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-center">
          {viewModel.challenge?.status === ChallengeStatus.Draft ? (
            <div>
              <h2 className="text-lg font-semibold">THE WAITING ROOM</h2>
              <div className="flex items-center justify-center space-x-2">
              <Clock className="h-5 w-5 text-[#DFFD10]" />
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
                <span className="material-icons text-[#DFFD10]">access_time</span>
                <h2 className="text-lg font-semibold">Round starts in</h2>
              </div>
              <div className="flex justify-center space-x-6 mt-4">
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-[#DFFD10]">{countdown.days}</p>
                  <p className="text-sm text-gray-400">Days</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-[#DFFD10]">{countdown.hours}</p>
                  <p className="text-sm text-gray-400">Hours</p>
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-3xl font-bold text-[#DFFD10]">{countdown.minutes}</p>
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
            <Users className="h-5 w-5 text-[#DFFD10]" />
            <h2 className="text-lg font-semibold">Who's joining</h2>
              <span className="text-sm text-[#DFFD10]">({participants.length} challengers)</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex space-x-4 px-2">
              {userChallenge === null && (
                <button
                  onClick={handleJoin}
                  className="flex flex-col items-center p-4 bg-gray-700 rounded-lg border border-[#DFFD10] hover:bg-gray-600 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-[#DFFD10] flex items-center justify-center">
                    <span className="material-icons text-[#DFFD10]">add</span>
                  </div>
                  <p className="text-xs mt-2 text-[#DFFD10]">Join Round</p>
                </button>
              )}
              {participants.map((participant) => (
                <div key={participant.id} className="flex flex-col items-center p-4 bg-gray-700 rounded-lg border border-gray-700">
                  {participant.profileImage?.profileImageURL ? (
                    <img
                      src={participant.profileImage.profileImageURL}
                      alt={participant.username}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#DFFD10]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#DFFD10] flex items-center justify-center">
                      <span className="text-white text-lg">{participant.username.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <p className="text-xs mt-2 text-gray-300">@{participant.username}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Section - New */}
        {challenge && currentUser && (
          <div className="mt-8">
            {/* Chat Introduction Header */}
            <div className="mb-4 px-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <MessageSquare className="h-5 w-5 text-[#DFFD10]" />
                <h3 className="text-lg font-semibold text-white">Pre-Round Chat</h3>
              </div>
              <p className="text-sm text-gray-400">
                Introduce yourself and get to know your fellow challengers before the round begins!
              </p>
            </div>
            {/* End Chat Introduction Header */}
            
            {chatExpanded ? (
              <RoundChatView
                participants={participants}
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUser={new User(currentUser.id, currentUser)}
                onCollapse={toggleChatExpansion}
              />
            ) : (
              <ChatPreviewCard 
                onExpand={toggleChatExpansion}
                unreadCount={unreadCount} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------
// ViewModel Interface
// -------------------------
export interface ChallengeWaitingRoomViewModel {
  challenge?: Challenge | null;
  challengeDetailViewModel: { collection: SweatlistCollection };
  fetchChatMessages: () => void;
  joinChallenge: (
    challenge: Challenge,
    completion: (userChallenge: UserChallenge | null) => void
  ) => void;
}
