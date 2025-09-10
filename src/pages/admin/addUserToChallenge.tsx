import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { workoutService } from '../../api/firebase/workout/service';
import { userService } from '../../api/firebase/user/service';
import { Challenge, UserChallenge, SweatlistCollection } from '../../api/firebase/workout/types';
import { User } from '../../api/firebase/user/types';
import { Search, Users, Plus, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import debounce from 'lodash.debounce';

const AddUserToChallengeAdmin: React.FC = () => {
  // User search state
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // Challenge search state
  const [challengeSearchTerm, setChallengeSearchTerm] = useState('');
  const [challengeSearchResults, setChallengeSearchResults] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [challengeSearchLoading, setChallengeSearchLoading] = useState(false);

  // Operation state
  const [isAdding, setIsAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search for users
  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setUserSearchResults([]);
      return;
    }

    setUserSearchLoading(true);
    try {
      // Get all users and filter by username or email
      const allUsers = await userService.getAllUsers();
      const filteredUsers = allUsers.filter(user => 
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

      setUserSearchResults(filteredUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      setErrorMessage('Failed to search users');
    } finally {
      setUserSearchLoading(false);
    }
  };

  // Search for challenges
  const searchChallenges = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setChallengeSearchResults([]);
      return;
    }

    setChallengeSearchLoading(true);
    try {
      // Get all collections with challenges and extract the challenges
      const allCollections = await workoutService.fetchAllAdminCollections();
      const allChallenges = allCollections
        .map(collection => collection.challenge)
        .filter(challenge => challenge != null); // Filter out null challenges

      const filteredChallenges = allChallenges.filter(challenge => 
        challenge.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        challenge.id?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10); // Limit to 10 results

      setChallengeSearchResults(filteredChallenges);
    } catch (error) {
      console.error('Error searching challenges:', error);
      setErrorMessage('Failed to search challenges');
    } finally {
      setChallengeSearchLoading(false);
    }
  };

  // Debounced search functions
  const debouncedUserSearch = debounce(searchUsers, 500);
  const debouncedChallengeSearch = debounce(searchChallenges, 500);

  // Handle user search input
  useEffect(() => {
    debouncedUserSearch(userSearchTerm);
  }, [userSearchTerm]);

  // Handle challenge search input
  useEffect(() => {
    debouncedChallengeSearch(challengeSearchTerm);
  }, [challengeSearchTerm]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  // Check if user is already in challenge
  const checkUserInChallenge = async (userId: string, challengeId: string): Promise<boolean> => {
    try {
      const userChallenges = await workoutService.fetchUserChallengesByUserId(userId);
      return userChallenges.some(uc => uc.challengeId === challengeId);
    } catch (error) {
      console.error('Error checking user challenge:', error);
      return false;
    }
  };

  // Add user to challenge (overwrite if exists)
  const handleAddUserToChallenge = async () => {
    if (!selectedUser || !selectedChallenge) {
      setErrorMessage('Please select both a user and a challenge');
      return;
    }

    if (!selectedUser.username) {
      setErrorMessage('Selected user must have a username');
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Check if user is already in the challenge
      const existingUserChallenges = await workoutService.fetchUserChallengesByUserId(selectedUser.id);
      const existingUserChallenge = existingUserChallenges.find(uc => uc.challengeId === selectedChallenge.id);
      
      let actionMessage = '';
      
      if (existingUserChallenge) {
        // User already exists - we'll overwrite their participation
        actionMessage = `Overwriting existing participation for ${selectedUser.username} in "${selectedChallenge.title}"`;
        console.log('Overwriting existing UserChallenge:', existingUserChallenge.id);
        
        // Delete the existing UserChallenge record first
        await workoutService.deleteUserChallenge(existingUserChallenge.id);
      } else {
        actionMessage = `Adding ${selectedUser.username} to "${selectedChallenge.title}"`;
      }

      // Use the existing joinChallenge functionality (now with fixed date conversion)
      await workoutService.joinChallenge({
        username: selectedUser.username,
        challengeId: selectedChallenge.id
      });

      setSuccessMessage(actionMessage + ' - Success!');
      
      // Clear selections
      setSelectedUser(null);
      setSelectedChallenge(null);
      setUserSearchTerm('');
      setChallengeSearchTerm('');
      setUserSearchResults([]);
      setChallengeSearchResults([]);

    } catch (error) {
      console.error('Error adding user to challenge:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to add user to challenge');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Add User to Challenge - Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8">
            <Plus className="text-[#d7ff00] mr-3 w-7 h-7" />
            <h1 className="text-2xl font-bold">Add User to Challenge</h1>
          </div>

          {/* Success/Error Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-900/20 border border-green-600/30 rounded-lg flex items-center">
              <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-green-400">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <span className="text-red-400">{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* User Search Section */}
            <div className="bg-[#1a1d23] rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 text-[#d7ff00] mr-2" />
                Select User
              </h2>

              {/* User Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by username, email, or display name..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
                />
                {userSearchLoading && (
                  <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Selected User */}
              {selectedUser && (
                <div className="mb-4 p-3 bg-[#d7ff00]/10 border border-[#d7ff00]/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#d7ff00]">{selectedUser.username}</p>
                      <p className="text-sm text-gray-400">{selectedUser.email}</p>
                      {selectedUser.displayName && (
                        <p className="text-sm text-gray-400">{selectedUser.displayName}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* User Search Results */}
              {!selectedUser && userSearchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userSearchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="p-3 bg-[#262a30] hover:bg-[#2a2e35] rounded-lg cursor-pointer transition-colors"
                    >
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-gray-400">{user.email}</p>
                      {user.displayName && (
                        <p className="text-sm text-gray-400">{user.displayName}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!selectedUser && userSearchTerm && !userSearchLoading && userSearchResults.length === 0 && (
                <p className="text-gray-400 text-center py-4">No users found</p>
              )}
            </div>

            {/* Challenge Search Section */}
            <div className="bg-[#1a1d23] rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Search className="w-5 h-5 text-[#d7ff00] mr-2" />
                Select Challenge
              </h2>

              {/* Challenge Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by challenge title or ID..."
                  value={challengeSearchTerm}
                  onChange={(e) => setChallengeSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
                />
                {challengeSearchLoading && (
                  <Loader className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>

              {/* Selected Challenge */}
              {selectedChallenge && (
                <div className="mb-4 p-3 bg-[#d7ff00]/10 border border-[#d7ff00]/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-[#d7ff00]">{selectedChallenge.title}</p>
                      <p className="text-sm text-gray-400">ID: {selectedChallenge.id}</p>
                      <p className="text-sm text-gray-400">
                        {selectedChallenge.startDate && new Date(selectedChallenge.startDate).toLocaleDateString()} - 
                        {selectedChallenge.endDate && new Date(selectedChallenge.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedChallenge(null)}
                      className="text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Challenge Search Results */}
              {!selectedChallenge && challengeSearchResults.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {challengeSearchResults.map((challenge) => (
                    <div
                      key={challenge.id}
                      onClick={() => setSelectedChallenge(challenge)}
                      className="p-3 bg-[#262a30] hover:bg-[#2a2e35] rounded-lg cursor-pointer transition-colors"
                    >
                      <p className="font-medium">{challenge.title}</p>
                      <p className="text-sm text-gray-400">ID: {challenge.id}</p>
                      <p className="text-sm text-gray-400">
                        {challenge.startDate && new Date(challenge.startDate).toLocaleDateString()} - 
                        {challenge.endDate && new Date(challenge.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!selectedChallenge && challengeSearchTerm && !challengeSearchLoading && challengeSearchResults.length === 0 && (
                <p className="text-gray-400 text-center py-4">No challenges found</p>
              )}
            </div>
          </div>

          {/* Add Button */}
          <div className="mt-8 text-center">
            <button
              onClick={handleAddUserToChallenge}
              disabled={!selectedUser || !selectedChallenge || isAdding}
              className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                selectedUser && selectedChallenge && !isAdding
                  ? 'bg-[#d7ff00] text-black hover:bg-[#c8e60e]'
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isAdding ? (
                <span className="flex items-center">
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </span>
              ) : (
                'Add/Overwrite User Challenge'
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
            <h3 className="font-medium text-blue-400 mb-2">Instructions:</h3>
            <ul className="text-sm text-blue-300 space-y-1">
              <li>1. Search and select a user by username, email, or display name</li>
              <li>2. Search and select a challenge by title or ID</li>
              <li>3. Click "Add/Overwrite User Challenge" to process</li>
              <li>4. If user already exists in challenge, their participation will be overwritten</li>
              <li>5. This resets their progress, dates, and creates a fresh UserChallenge record</li>
              <li>6. Uses the same joinChallenge functionality with proper date conversion</li>
            </ul>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default AddUserToChallengeAdmin;
