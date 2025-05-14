import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle,
  XCircle,
  Sparkles,
  Loader2,
  Search,
  Copy,
  RefreshCw,
  AlertCircle,
  Info,
  XCircleIcon,
  BarChart3,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, query, where, getFirestore } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { useUser } from '../../hooks/useUser';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// Type definitions
type TabType = 'beta' | 'pilot';

interface BetaUser {
  id: string;
  email: string;
  name: string;
  isApproved: boolean;
  applyForFoundingCoaches: boolean;
  role: {
    trainer: boolean;
    enthusiast: boolean;
    coach: boolean;
    fitnessInstructor: boolean;
  };
  useCases: {
    oneOnOneCoaching: boolean;
    communityRounds: boolean;
    personalPrograms: boolean;
  };
  clientCount: string;
  yearsExperience: string;
  isCertified: boolean;
  certificationName?: string;
  createdAt: any; // Firestore timestamp
  updatedAt: any; // Firestore timestamp
  primaryUse?: string;
  longTermGoal?: string;
}

interface AnalyticsData {
  totalBetaUsers: number;
  approvedBetaUsers: number;
  pendingBetaUsers: number;
  totalPilotUsers: number;
  approvedPilotUsers: number;
  pendingPilotUsers: number;
  trainerCount: number;
  coachCount: number;
  certifiedCount: number;
  clientRanges: Record<string, number>;
  experienceRanges: Record<string, number>;
}

const BetaUsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('beta');
  const [betaUsers, setBetaUsers] = useState<BetaUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<BetaUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BetaUser | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalBetaUsers: 0,
    approvedBetaUsers: 0,
    pendingBetaUsers: 0,
    totalPilotUsers: 0,
    approvedPilotUsers: 0,
    pendingPilotUsers: 0,
    trainerCount: 0,
    coachCount: 0,
    certifiedCount: 0,
    clientRanges: {},
    experienceRanges: {},
  });
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [detailUser, setDetailUser] = useState<BetaUser | null>(null);

  const router = useRouter();
  const user = useUser();

  useEffect(() => {
    fetchBetaUsers();
  }, []);

  useEffect(() => {
    if (betaUsers.length > 0) {
      filterUsers();
      calculateAnalytics();
    }
  }, [betaUsers, activeTab, searchTerm]);

  const fetchBetaUsers = async () => {
    setLoading(true);
    try {
      const betaRef = collection(db, 'beta');
      const snapshot = await getDocs(betaRef);
      
      const users: BetaUser[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as BetaUser));
      
      setBetaUsers(users);
      console.log('Fetched beta users:', users.length);
    } catch (error) {
      console.error('Error fetching beta users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = betaUsers;
    
    // Filter by tab
    if (activeTab === 'pilot') {
      filtered = filtered.filter(user => user.applyForFoundingCoaches === true);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(term) || 
        user.email?.toLowerCase().includes(term)
      );
    }
    
    setFilteredUsers(filtered);
  };

  const calculateAnalytics = () => {
    const totalBeta = betaUsers.length;
    const approvedBeta = betaUsers.filter(user => user.isApproved).length;
    const totalPilot = betaUsers.filter(user => user.applyForFoundingCoaches).length;
    const approvedPilot = betaUsers.filter(user => user.applyForFoundingCoaches && user.isApproved).length;
    
    const trainerCount = betaUsers.filter(user => user.role?.trainer).length;
    const coachCount = betaUsers.filter(user => user.role?.coach).length;
    const certifiedCount = betaUsers.filter(user => user.isCertified).length;
    
    // Client ranges analytics
    const clientRanges: Record<string, number> = {};
    betaUsers.forEach(user => {
      if (!clientRanges[user.clientCount]) {
        clientRanges[user.clientCount] = 0;
      }
      clientRanges[user.clientCount]++;
    });
    
    // Experience ranges analytics
    const experienceRanges: Record<string, number> = {};
    betaUsers.forEach(user => {
      if (!experienceRanges[user.yearsExperience]) {
        experienceRanges[user.yearsExperience] = 0;
      }
      experienceRanges[user.yearsExperience]++;
    });
    
    setAnalytics({
      totalBetaUsers: totalBeta,
      approvedBetaUsers: approvedBeta,
      pendingBetaUsers: totalBeta - approvedBeta,
      totalPilotUsers: totalPilot,
      approvedPilotUsers: approvedPilot,
      pendingPilotUsers: totalPilot - approvedPilot,
      trainerCount,
      coachCount,
      certifiedCount,
      clientRanges,
      experienceRanges,
    });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleToggleApproval = (user: BetaUser) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const handleConfirmToggle = async () => {
    if (!selectedUser) return;
    
    setIsModalLoading(true);
    try {
      const newApprovalStatus = !selectedUser.isApproved;
      const userRef = doc(db, 'beta', selectedUser.id);
      await updateDoc(userRef, {
        isApproved: newApprovalStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setBetaUsers(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, isApproved: newApprovalStatus, updatedAt: new Date() } 
          : user
      ));

      // If user was just approved, send the email
      if (newApprovalStatus) {
        try {
          const emailResponse = await fetch('/.netlify/functions/send-approval-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: selectedUser.email,
              name: selectedUser.name
            })
          });

          if (!emailResponse.ok) {
            const errorData = await emailResponse.json();
            console.error('Failed to send approval email:', emailResponse.status, errorData);
            // Optionally: show a toast notification to the admin that email sending failed
          } else {
            console.log('Approval email sent successfully to:', selectedUser.email);
            // Optionally: show a success toast for email sent
          }
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
          // Optionally: show a toast notification for the network error
        }
      }
      
      setShowConfirmModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating user approval status:', error);
      // Optionally: show a toast for the main approval error
    } finally {
      setIsModalLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (date: any): string => {
    if (!date) return 'Unknown';
    
    try {
      // Handle Firestore Timestamp
      if (date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      // Handle Date object or string
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const renderRoles = (user: BetaUser) => {
    if (!user.role) return 'None';
    
    const roles = [];
    if (user.role.trainer) roles.push('Trainer');
    if (user.role.coach) roles.push('Coach');
    if (user.role.enthusiast) roles.push('Enthusiast');
    if (user.role.fitnessInstructor) roles.push('Instructor');
    
    return roles.join(', ') || 'None';
  };

  const renderUseCases = (user: BetaUser) => {
    if (!user.useCases) return 'None';
    
    const cases = [];
    if (user.useCases.oneOnOneCoaching) cases.push('1:1 Coaching');
    if (user.useCases.communityRounds) cases.push('Community Rounds');
    if (user.useCases.personalPrograms) cases.push('Personal Programs');
    
    return cases.join(', ') || 'None';
  };

  const handleShowUserDetails = (user: BetaUser) => {
    setDetailUser(user);
    setShowUserDetails(true);
  };

  const renderUserTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-zinc-800 rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-zinc-700 text-white text-left">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Client Count</th>
              <th className="px-4 py-3">Experience</th>
              <th className="px-4 py-3">Certified</th>
              <th className="px-4 py-3">Applied On</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  {loading ? 'Loading users...' : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} className="text-white hover:bg-zinc-700/50">
                  <td className="px-4 py-3">{user.name || 'Unknown'}</td>
                  <td className="px-4 py-3 flex items-center">
                    {user.email || 'Unknown'}
                    <button 
                      onClick={() => copyToClipboard(user.email)} 
                      className="ml-2 text-zinc-400 hover:text-zinc-200"
                      title="Copy email"
                    >
                      <Copy size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-3">{renderRoles(user)}</td>
                  <td className="px-4 py-3">{user.clientCount || 'Not specified'}</td>
                  <td className="px-4 py-3">{user.yearsExperience || 'Not specified'}</td>
                  <td className="px-4 py-3">
                    {user.isCertified ? (
                      <div className="flex items-center">
                        <CheckCircle size={16} className="text-green-500 mr-1" /> 
                        {user.certificationName || 'Yes'}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <XCircle size={16} className="text-red-500 mr-1" /> No
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    {user.isApproved ? (
                      <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                        Approved
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleToggleApproval(user)}
                        className={`p-1 rounded ${
                          user.isApproved
                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                        }`}
                        title={user.isApproved ? 'Revoke approval' : 'Approve user'}
                      >
                        {user.isApproved ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        onClick={() => handleShowUserDetails(user)}
                        className="p-1 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                        title="View details"
                      >
                        <Info size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAnalytics = () => {
    return (
      <div className="mb-8">
        <div className="bg-zinc-800 rounded-lg p-4 mb-4">
          <h3 className="text-white text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="mr-2" /> Analytics Dashboard
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-700 p-4 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Total Beta Users</div>
              <div className="text-white text-2xl font-bold">{analytics.totalBetaUsers}</div>
              <div className="mt-2 text-sm">
                <span className="text-green-500">{analytics.approvedBetaUsers} approved</span>
                {' · '}
                <span className="text-amber-500">{analytics.pendingBetaUsers} pending</span>
              </div>
            </div>
            
            <div className="bg-zinc-700 p-4 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Pilot Program Applicants</div>
              <div className="text-white text-2xl font-bold">{analytics.totalPilotUsers}</div>
              <div className="mt-2 text-sm">
                <span className="text-green-500">{analytics.approvedPilotUsers} approved</span>
                {' · '}
                <span className="text-amber-500">{analytics.pendingPilotUsers} pending</span>
              </div>
            </div>
            
            <div className="bg-zinc-700 p-4 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Professional Background</div>
              <div className="text-white font-bold">
                <div className="flex justify-between">
                  <span>Trainers:</span>
                  <span>{analytics.trainerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coaches:</span>
                  <span>{analytics.coachCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Certified:</span>
                  <span>{analytics.certifiedCount}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-700 p-4 rounded-lg">
              <div className="text-zinc-400 text-sm mb-1">Client Distribution</div>
              <div className="text-white text-sm">
                {Object.entries(analytics.clientRanges)
                  .filter(([range]) => range) // Filter out empty ranges
                  .sort((a, b) => {
                    // Custom sorting for client ranges
                    const rangeOrder: Record<string, number> = {
                      '0': 1,
                      '1-5': 2,
                      '6-10': 3,
                      '11-20': 4,
                      '21-50': 5,
                      '50+': 6
                    };
                    return (rangeOrder[a[0]] || 99) - (rangeOrder[b[0]] || 99);
                  })
                  .map(([range, count]) => (
                    <div key={range} className="flex justify-between mb-1">
                      <span>{range}:</span>
                      <span>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    return (
      <div>
        {renderAnalytics()}
        <div className="bg-zinc-800 rounded-lg overflow-hidden">
          <div className="p-4">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-white text-xl font-semibold mb-4 sm:mb-0">
                {activeTab === 'beta' ? 'All Beta Users' : 'Founding Coaches Pilot Applicants'}
              </h3>
              
              <div className="flex space-x-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                  />
                </div>
                
                <button
                  onClick={fetchBetaUsers}
                  className="flex items-center px-3 py-2 rounded-md bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>
          
          {renderUserTable()}
        </div>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Beta Users | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-zinc-900 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-white text-2xl font-bold">Pulse Programming Beta</h1>
            <div className="text-zinc-400 text-sm">
              Admin Dashboard
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-zinc-800 p-1 rounded-lg w-fit">
              <button
                onClick={() => handleTabChange('beta')}
                className={`flex items-center px-4 py-2 rounded-md ${
                  activeTab === 'beta'
                    ? 'bg-[#E0FE10] text-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <Users size={18} className="mr-2" />
                All Beta Users
              </button>
              <button
                onClick={() => handleTabChange('pilot')}
                className={`flex items-center px-4 py-2 rounded-md ${
                  activeTab === 'pilot'
                    ? 'bg-[#E0FE10] text-black' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <Sparkles size={18} className="mr-2" />
                Founding Coaches
              </button>
            </div>
          </div>

          {/* Main content */}
          {renderTabContent()}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {selectedUser.isApproved ? 'Revoke Access' : 'Approve User'}
              </h3>
              <p className="text-zinc-400 text-center mb-6">
                {selectedUser.isApproved
                  ? `Are you sure you want to revoke beta access for ${selectedUser.name}? They will no longer be able to access Pulse Programming.`
                  : `Are you sure you want to grant beta access to ${selectedUser.name}? They will be able to access all Pulse Programming features.`}
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 transition-colors"
                  disabled={isModalLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmToggle}
                  className={`flex-1 px-4 py-3 rounded-lg flex items-center justify-center ${
                    selectedUser.isApproved
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white transition-colors`}
                  disabled={isModalLoading}
                >
                  {isModalLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : selectedUser.isApproved ? (
                    'Revoke Access'
                  ) : (
                    'Approve User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && detailUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-white">User Details</h3>
              <button
                onClick={() => setShowUserDetails(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <XCircleIcon size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-zinc-400 text-sm">Name</h4>
                    <p className="text-white text-lg">{detailUser.name || 'Not provided'}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Email</h4>
                    <p className="text-white text-lg">{detailUser.email}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Certification</h4>
                    <p className="text-white text-lg">
                      {detailUser.isCertified 
                        ? (detailUser.certificationName || 'Yes') 
                        : 'No'}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Status</h4>
                    <div className="flex items-center space-x-2">
                      {detailUser.isApproved ? (
                        <>
                          <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                            Approved
                          </span>
                          <span className="text-white">
                            on {formatDate(detailUser.updatedAt)}
                          </span>
                        </>
                      ) : (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="text-zinc-400 text-sm">Roles</h4>
                    <p className="text-white">{renderRoles(detailUser)}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Use Cases</h4>
                    <p className="text-white">{renderUseCases(detailUser)}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Client Count</h4>
                    <p className="text-white">{detailUser.clientCount || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Experience</h4>
                    <p className="text-white">{detailUser.yearsExperience || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-zinc-400 text-sm">Applied On</h4>
                    <p className="text-white">{formatDate(detailUser.createdAt)}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-zinc-400 text-sm mb-2">Primary Use</h4>
                <div className="bg-zinc-700 p-4 rounded-lg">
                  <p className="text-white whitespace-pre-wrap">{detailUser.primaryUse || 'Not provided'}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-zinc-400 text-sm mb-2">Long-term Goal</h4>
                <div className="bg-zinc-700 p-4 rounded-lg">
                  <p className="text-white whitespace-pre-wrap">{detailUser.longTermGoal || 'Not provided'}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-700">
                <div className="flex items-center">
                  <Sparkles className="text-[#E0FE10] mr-2" size={20} />
                  <h4 className="text-white font-medium">Founding Coaches Pilot Program</h4>
                </div>
                <p className="text-zinc-400 mt-1">
                  {detailUser.applyForFoundingCoaches 
                    ? 'User has applied to join the Founding 100 Coaches Program' 
                    : 'User has not applied to the Founding 100 Coaches Program'}
                </p>
              </div>
              
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowUserDetails(false);
                    handleToggleApproval(detailUser);
                  }}
                  className={`px-4 py-2 rounded-lg ${
                    detailUser.isApproved
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white transition-colors`}
                >
                  {detailUser.isApproved ? 'Revoke Access' : 'Approve User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default BetaUsersPage; 