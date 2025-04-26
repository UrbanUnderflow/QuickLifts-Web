import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import debounce from 'lodash.debounce';

type User = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  isAdmin?: boolean;
  registrationComplete?: boolean;
  createdAt?: any;
  adminVerified?: boolean; // Flag to track actual admin status from admin collection
};

type TabType = 'all' | 'admins';

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [processingAdmin, setProcessingAdmin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);

  // Copy ID to clipboard and show toast
  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 2000); // Hide toast after 2 seconds
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Check admin status for a user
  const checkAdminStatus = async (email: string): Promise<boolean> => {
    try {
      const adminDoc = await getDoc(doc(db, 'admin', email));
      return adminDoc.exists();
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  // Load users and verify their admin status
  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        adminVerified: false // Initialize with unverified state
      })) as User[];

      // Set users first, then check admin status for each
      setUsers(allUsers);
      setFilteredUsers(allUsers);
      
      // Check admin status for each user
      const usersWithAdminStatus = await Promise.all(
        allUsers.map(async (user) => {
          if (user.email) {
            const isAdminUser = await checkAdminStatus(user.email);
            return { ...user, adminVerified: isAdminUser };
          }
          return user;
        })
      );

      setUsers(usersWithAdminStatus);
      updateFilteredUsers(usersWithAdminStatus, searchTerm, activeTab);
      setLoading(false);
    } catch (error) {
      console.error('Error loading users:', error);
      setLoading(false);
    }
  };

  // Toggle admin status
  const toggleAdminStatus = async (user: User) => {
    if (!user.email) return;
    
    try {
      setProcessingAdmin(user.email);
      
      const adminDocRef = doc(db, 'admin', user.email);
      const adminDoc = await getDoc(adminDocRef);
      
      if (adminDoc.exists()) {
        // Remove admin privileges
        await deleteDoc(adminDocRef);
      } else {
        // Grant admin privileges
        await setDoc(adminDocRef, { email: user.email });
      }
      
      // Refresh the users list
      await loadAllUsers();
      setProcessingAdmin(null);
    } catch (error) {
      console.error('Error toggling admin status:', error);
      setProcessingAdmin(null);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  // Update filtered users based on search term and active tab
  const updateFilteredUsers = (allUsers: User[], term: string, tab: TabType) => {
    let filtered = [...allUsers];
    
    // Apply tab filter
    if (tab === 'admins') {
      filtered = filtered.filter(user => user.adminVerified);
    }
    
    // Apply search term filter
    if (term) {
      const lowercaseTerm = term.toLowerCase();
      filtered = filtered.filter(user => 
        (user.email?.toLowerCase().includes(lowercaseTerm)) ||
        (user.displayName?.toLowerCase().includes(lowercaseTerm)) ||
        (user.username?.toLowerCase().includes(lowercaseTerm)) ||
        (user.id?.toLowerCase().includes(lowercaseTerm))
      );
    }
    
    setFilteredUsers(filtered);
  };

  // Client-side filtering
  useEffect(() => {
    if (!searchTerm) {
      updateFilteredUsers(users, searchTerm, activeTab);
      return;
    }
    
    const lowercaseTerm = searchTerm.toLowerCase();
    const filtered = users.filter(user => 
      (user.email?.toLowerCase().includes(lowercaseTerm)) ||
      (user.displayName?.toLowerCase().includes(lowercaseTerm)) ||
      (user.username?.toLowerCase().includes(lowercaseTerm)) ||
      (user.id?.toLowerCase().includes(lowercaseTerm))
    );
    
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleSearchChange = debounce((term: string) => {
    setSearchTerm(term);
  }, 300);

  const handleRefresh = () => {
    loadAllUsers();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Format date helper function
  const formatDate = (date: any): string => {
    if (!date) return 'Not available';
    
    // If it's a Firebase timestamp, use toDate()
    if (date && typeof date.toDate === 'function') {
      date = date.toDate();
    }
      
    return new Date(date).toLocaleString();
  };

  // Count of admin users
  const adminCount = users.filter(user => user.adminVerified).length;

  // Render user details for expanded row
  const renderUserDetails = (user: User) => {
    // Get all properties from the user object
    const userProps = Object.entries(user).filter(([key]) => key !== 'adminVerified');
    
    return (
      <div className="bg-[#1d2b3a] border-t border-blue-800 animate-fade-in-up p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Basic Information */}
          <div className="space-y-4">
            <div>
              <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Basic Information</h5>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 text-xs">User ID</div>
                  <div className="text-gray-300 font-mono text-sm">
                    <button 
                      onClick={() => copyToClipboard(user.id)} 
                      className="hover:text-blue-400 flex items-center"
                      title="Copy user ID"
                    >
                      {user.id}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Email</div>
                  <div className="text-gray-300 font-mono text-sm">
                    <button 
                      onClick={() => copyToClipboard(user.email)} 
                      className="hover:text-blue-400 flex items-center"
                      title="Copy email"
                    >
                      {user.email}
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Column 2: Profile Information */}
          <div className="space-y-4">
            <div>
              <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Profile Information</h5>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 text-xs">Display Name</div>
                  <div className="text-gray-300">{user.displayName || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Username</div>
                  <div className="text-gray-300">{user.username || 'Not set'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Created At</div>
                  <div className="text-gray-300">{formatDate(user.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Column 3: Status Information */}
          <div className="space-y-4">
            <div>
              <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Status Information</h5>
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 text-xs">Registration Status</div>
                  <div className="mt-1">
                    {user.registrationComplete ? (
                      <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                        Complete
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">
                        Incomplete
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Admin Status</div>
                  <div className="mt-1 flex items-center gap-2">
                    {user.adminVerified ? (
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                        Admin
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                        Regular User
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">isAdmin Flag</div>
                  <div className="mt-1">
                    {user.isAdmin ? (
                      <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">
                        True
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                        False
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Properties Section */}
        <div className="mt-6">
          <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">All User Properties</h5>
          <div className="bg-[#262a30] rounded-lg p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="py-2 px-3">Property</th>
                  <th className="py-2 px-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {userProps.map(([key, value]) => (
                  <tr key={key} className="border-b border-gray-800 hover:bg-[#2a2f36] transition-colors">
                    <td className="py-2 px-3 text-blue-400 font-mono">{key}</td>
                    <td className="py-2 px-3 text-gray-300 font-mono">
                      {typeof value === 'object' && value !== null ? (
                        value && typeof value.toDate === 'function' ? (
                          formatDate(value)
                        ) : (
                          <span 
                            className="cursor-pointer text-yellow-400 hover:text-yellow-300"
                            onClick={() => copyToClipboard(JSON.stringify(value))}
                            title="Click to copy JSON"
                          >
                            {JSON.stringify(value)}
                          </span>
                        )
                      ) : typeof value === 'boolean' ? (
                        String(value)
                      ) : (
                        value?.toString() || 'null'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end gap-2">
          <button 
            onClick={() => toggleAdminStatus(user)}
            disabled={processingAdmin === user.email}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center
              ${user.adminVerified 
                ? 'bg-red-900/30 text-red-400 border-red-900 hover:bg-red-800/40'
                : 'bg-blue-900/30 text-blue-400 border-blue-900 hover:bg-blue-800/40'} transition-colors`}
          >
            {processingAdmin === user.email ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : user.adminVerified ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
                Remove Admin
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Make Admin
              </>
            )}
          </button>
          <button 
            onClick={() => copyToClipboard(user.id)} 
            className="px-3 py-1.5 bg-[#262a30] text-[#d7ff00] rounded-lg text-xs font-medium border border-[#616e00] hover:bg-[#2c3137] transition flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            Copy ID
          </button>
          <button
            onClick={() => setSelectedUser(null)}
            className="px-3 py-1.5 bg-gray-700/30 text-gray-300 rounded-lg text-xs font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Close
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>User Management | Pulse Admin</title>
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </span>
            User Management
          </h1>
          
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            <div className="flex flex-wrap justify-between items-center mb-6">
              <div className="w-full md:w-1/2 mb-4 md:mb-0">
                <label className="block text-gray-300 mb-2 text-sm font-medium">Search Users</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by email, name, username or user ID"
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    onChange={(e) => handleSearchChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full md:w-auto">
                <button
                  onClick={handleRefresh}
                  className="relative bg-[#262a30] text-white px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition flex items-center"
                  disabled={loading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Refreshing...' : 'Refresh Users'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-4">
              <button
                className={`py-2 px-4 mr-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'all'
                    ? 'text-[#d7ff00]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => handleTabChange('all')}
              >
                All Users
                <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                  {users.length}
                </span>
                {activeTab === 'all' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                )}
              </button>
              <button
                className={`py-2 px-4 font-medium text-sm transition-colors relative ${
                  activeTab === 'admins'
                    ? 'text-[#d7ff00]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => handleTabChange('admins')}
              >
                Admins Only
                <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                  {adminCount}
                </span>
                {activeTab === 'admins' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                )}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Email</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Username</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Registration</th>
                    <th className="py-3 px-4 text-left text-gray-300 font-medium">Admin</th>
                    <th className="py-3 px-4 text-center text-gray-300 font-medium">Admin Actions</th>
                    <th className="py-3 px-4 text-center text-gray-300 font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <React.Fragment key={user.id}>
                      <tr className={`hover:bg-[#2a2f36] transition-colors ${selectedUser?.id === user.id ? 'bg-[#1d2b3a]' : ''}`}>
                        <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                          <button
                            onClick={() => copyToClipboard(user.id)}
                            className="text-blue-400 hover:text-blue-300"
                            title="Click to copy user ID"
                          >
                            {user.id.substring(0, 8)}...
                          </button>
                        </td>
                        <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{user.email}</td>
                        <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{user.username || '-'}</td>
                        <td className="py-3 px-4 border-b border-gray-700">
                          {user.registrationComplete ? 
                            <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">Complete</span> : 
                            <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">Incomplete</span>
                          }
                        </td>
                        <td className="py-3 px-4 border-b border-gray-700">
                          {user.adminVerified ? 
                            <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-medium border border-blue-900">Yes</span> : 
                            <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">No</span>
                          }
                        </td>
                        <td className="py-3 px-4 border-b border-gray-700 text-center">
                          <button
                            onClick={() => toggleAdminStatus(user)}
                            disabled={!user.email || processingAdmin === user.email}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                              user.adminVerified
                                ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900'
                                : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-900'
                            }`}
                          >
                            {processingAdmin === user.email ? (
                              <svg className="animate-spin h-4 w-4 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : user.adminVerified ? (
                              'Remove Admin'
                            ) : (
                              'Make Admin'
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 border-b border-gray-700 text-center">
                          <button
                            onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium border border-purple-900 hover:bg-purple-800/40 transition-colors flex items-center mx-auto ${
                              selectedUser?.id === user.id 
                                ? 'bg-purple-800/50 text-purple-300' 
                                : 'bg-purple-900/30 text-purple-400'
                            }`}
                            title="View user details"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            {selectedUser?.id === user.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {selectedUser?.id === user.id && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-gray-700">
                            {renderUserDetails(user)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {loading && (
              <div className="text-center my-4 text-gray-300">
                <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading users...
              </div>
            )}
            
            {!loading && filteredUsers.length === 0 && (
              <div className="flex items-center gap-2 text-red-400 mt-4 p-3 bg-red-900/20 rounded-lg relative overflow-hidden">
                {/* Error message gradient border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{activeTab === 'admins' ? 'No admin users found.' : 'No users found.'}</span>
              </div>
            )}

            {!loading && users.length > 0 && (
              <div className="text-gray-400 text-sm mt-4">
                {activeTab === 'admins' ? (
                  <>Showing {filteredUsers.length} admin{filteredUsers.length !== 1 ? 's' : ''}</>
                ) : (
                  <>Showing {filteredUsers.length} of {users.length} total users</>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastVisible && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up z-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>ID <span className="font-mono">{copiedId.substring(0, 8)}...</span> copied to clipboard</span>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default UsersManagement; 