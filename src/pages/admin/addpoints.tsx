import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { workoutService } from '../../api/firebase/workout/service';
import { UserChallenge } from '../../api/firebase/workout/types';
import debounce from 'lodash.debounce';

const AddPointsPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [searchResults, setSearchResults] = useState<UserChallenge[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedUserChallenge, setSelectedUserChallenge] = useState<UserChallenge | null>(null);
  const [addingPoints, setAddingPoints] = useState(false);
  const [pointsAdded, setPointsAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Clear results when username changes
  useEffect(() => {
    setSearchResults([]);
    setSearchPerformed(false);
    setSelectedUserChallenge(null);
    setPointsAdded(false);
    setNotificationSent(false);
    setError(null);
  }, [username]);

  const handleSearch = async () => {
    if (!username.trim()) {
      setError('Please enter a username to search');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchPerformed(true);
    
    try {
      // Fetch all user challenges
      const allChallenges = await workoutService.fetchAllUserChallenges();
      
      // Filter challenges by username
      const matchingChallenges = allChallenges.filter(challenge => 
        challenge.username.toLowerCase() === username.toLowerCase()
      );

      console.log(`Found ${matchingChallenges.length} challenges for username "${username}"`);
      setSearchResults(matchingChallenges);
      
      if (matchingChallenges.length === 0) {
        setError(`No challenges found for username "${username}"`);
      }
    } catch (error) {
      console.error('Error searching for user challenges:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchDebounced = debounce(handleSearch, 500);

  const handleAddPoints = async () => {
    if (!selectedUserChallenge) return;
    
    setAddingPoints(true);
    setError(null);
    
    try {
      // Create a copy of the user challenge
      const updatedChallenge = new UserChallenge({...selectedUserChallenge});
      
      // Add 5 points to shareBonus
      const currentShareBonus = updatedChallenge.pulsePoints.shareBonus || 0;
      updatedChallenge.pulsePoints.shareBonus = currentShareBonus + 5;
      
      // Update the user challenge in Firestore
      await workoutService.updateUserChallenge(updatedChallenge);
      
      setPointsAdded(true);
      showToast('Points added successfully!', 'success');
      
      // Reload the updated challenge
      const refreshedChallenge = await workoutService.fetchUserChallengeById(selectedUserChallenge.id);
      if (refreshedChallenge) {
        setSelectedUserChallenge(refreshedChallenge);
      }
      
      // Send notification
      if (selectedUserChallenge.fcmToken) {
        setSendingNotification(true);
        
        try {
          await sendShareBonusNotification(selectedUserChallenge.fcmToken);
          setNotificationSent(true);
          showToast('Notification sent successfully!', 'success');
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
          showToast('Points added but notification failed to send.', 'error');
        } finally {
          setSendingNotification(false);
        }
      } else {
        showToast('Points added but user has no FCM token for notifications.', 'error');
      }
    } catch (error) {
      console.error('Error adding points:', error);
      setError(error instanceof Error ? error.message : 'Failed to add points');
      showToast('Failed to add points.', 'error');
    } finally {
      setAddingPoints(false);
    }
  };

  const sendShareBonusNotification = async (fcmToken: string) => {
    const response = await fetch('/.netlify/functions/send-share-bonus-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: fcmToken,
        title: '🎉 +5 Points Added!',
        body: 'Thanks for sharing your Pulse challenge progress on social media!',
        points: 5
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send notification');
    }

    return await response.json();
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Add Points | Pulse Admin</title>
        <style>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.3s ease-out forwards;
          }
        `}</style>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
              </svg>
            </span>
            Add Points
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Search Form */}
            <div className="mb-6">
              <h2 className="text-xl font-medium mb-4 text-white">Search User Challenges</h2>
              
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <label htmlFor="username" className="block text-gray-300 mb-2 text-sm font-medium">Username</label>
                  <input 
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={loading || !username.trim()}
                    className={`px-4 py-3 rounded-lg font-medium ${
                      loading || !username.trim() 
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                        : 'bg-[#262a30] text-[#d7ff00] border border-[#616e00] hover:bg-[#2a2f36]'
                    } transition flex items-center`}
                  >
                    {loading ? (
                      <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                    Search
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-400 mt-2 p-3 bg-red-900/20 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            {/* Search Results */}
            {searchPerformed && !loading && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-white">
                  {searchResults.length === 0 
                    ? 'No Results Found' 
                    : `${searchResults.length} Result${searchResults.length !== 1 ? 's' : ''} Found`}
                </h3>
                
                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    {searchResults.map((userChallenge) => (
                      <div 
                        key={userChallenge.id}
                        className={`p-4 rounded-lg border ${
                          selectedUserChallenge?.id === userChallenge.id 
                            ? 'bg-[#1d2b3a] border-blue-500' 
                            : 'bg-[#262a30] border-gray-700 hover:bg-[#2a2f36] cursor-pointer'
                        } transition`}
                        onClick={() => setSelectedUserChallenge(userChallenge)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-lg">
                              {userChallenge.challenge?.title || 'Untitled Challenge'}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              ID: {userChallenge.challengeId}
                            </div>
                            <div className="mt-2 text-sm">
                              <div><span className="text-gray-400">Status:</span> {userChallenge.challenge?.status}</div>
                              <div><span className="text-gray-400">Start Date:</span> {formatDate(userChallenge.challenge?.startDate)}</div>
                              <div><span className="text-gray-400">End Date:</span> {formatDate(userChallenge.challenge?.endDate)}</div>
                              <div className="mt-1"><span className="text-gray-400">Current Points:</span> {userChallenge.pulsePoints.totalPoints}</div>
                              <div><span className="text-gray-400">Share Bonus:</span> {userChallenge.pulsePoints.shareBonus || 0}</div>
                            </div>
                          </div>
                          <div className="flex">
                            {selectedUserChallenge?.id === userChallenge.id && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Add Points Section */}
            {selectedUserChallenge && (
              <div className="mt-8 bg-[#1d2b3a] p-5 rounded-lg border border-blue-900">
                <h3 className="text-lg font-medium mb-3 text-white flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2 text-[#d7ff00]">
                    <path d="M10.464 8.746c.227-.18.497-.311.786-.394v2.795a2.252 2.252 0 01-.786-.393c-.394-.313-.546-.681-.546-1.004 0-.323.152-.691.546-1.004zM12.75 15.662v-2.824c.347.085.664.228.921.421.427.32.579.686.579.991 0 .305-.152.671-.579.991a2.534 2.534 0 01-.921.42z" />
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.836 3.836 0 00-1.72.756c-.712.566-1.112 1.35-1.112 2.178 0 .829.4 1.612 1.113 2.178.502.4 1.102.647 1.719.756v2.978a2.536 2.536 0 01-.921-.421l-.879-.66a.75.75 0 00-.9 1.2l.879.66c.533.4 1.169.645 1.821.75V18a.75.75 0 001.5 0v-.81a4.124 4.124 0 001.821-.749c.745-.559 1.179-1.344 1.179-2.191 0-.847-.434-1.632-1.179-2.191a4.122 4.122 0 00-1.821-.75V8.354c.29.082.559.213.786.393l.415.33a.75.75 0 00.933-1.175l-.415-.33a3.836 3.836 0 00-1.719-.755V6z" clipRule="evenodd" />
                  </svg>
                  Add Points for {selectedUserChallenge.username}
                </h3>
                
                <div className="bg-[#262a30] p-4 rounded-lg mb-4">
                  <p className="text-gray-300 mb-2">
                    You are about to add <span className="text-[#d7ff00] font-bold">5 points</span> to {selectedUserChallenge.username}'s share bonus for posting on social media about their challenge.
                  </p>
                  <p className="text-gray-300">
                    Current share bonus: <span className="font-bold">{selectedUserChallenge.pulsePoints.shareBonus || 0}</span> points
                  </p>
                  <p className="text-gray-300">
                    New share bonus: <span className="font-bold">{(selectedUserChallenge.pulsePoints.shareBonus || 0) + 5}</span> points
                  </p>
                </div>
                
                {!pointsAdded ? (
                  <button
                    onClick={handleAddPoints}
                    disabled={addingPoints}
                    className={`w-full px-4 py-3 rounded-lg font-medium ${
                      addingPoints
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-[#1d2b3a] text-[#d7ff00] border border-[#616e00] hover:bg-[#2a3b4a]'
                    } transition flex items-center justify-center`}
                  >
                    {addingPoints ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding Points...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                        Add 5 Points
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-green-900/30 text-green-400 border border-green-900 p-4 rounded-lg animate-fade-in-up">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">
                        Points added successfully!
                      </span>
                    </div>
                    {sendingNotification && !notificationSent && (
                      <div className="mt-2 flex items-center text-gray-300">
                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending notification...
                      </div>
                    )}
                    {notificationSent && (
                      <div className="mt-2 text-gray-300">
                        User has been notified about their bonus points!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Toast */}
      {toastVisible && (
        <div className={`fixed bottom-4 right-4 py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up z-50 ${
          toastType === 'success' ? 'bg-green-800 text-white' : 'bg-red-800 text-white'
        }`}>
          {toastType === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default AddPointsPage; 