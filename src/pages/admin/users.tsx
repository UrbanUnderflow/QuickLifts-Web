import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../api/firebase/config';
import debounce from 'lodash.debounce';
import { Trash2 as TrashIcon, Trash2, AlertCircle, CheckCircle, Activity, Clock, Calendar, Dumbbell, Eye, XCircle, ArrowRight, ChevronRight, Code, Users, Shield, LogIn, Search } from 'lucide-react';
import { workoutService } from '../../api/firebase/workout/service';
import { Workout, WorkoutStatus, WorkoutSummary, RepsAndWeightLog } from '../../api/firebase/workout/types';
import { ExerciseLog } from '../../api/firebase/exercise/types';
import { adminMethods } from '../../api/firebase/admin/methods';
import { BetaApplication } from '../../api/firebase/admin/types';


type User = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  isAdmin?: boolean;
  registrationComplete?: boolean;
  createdAt?: any;
  adminVerified?: boolean; // Flag to track actual admin status from admin collection
  // Approximate number of videos the user has uploaded to the platform (if tracked)
  videoCount?: number;
};

// Define a type for workout session display data
type WorkoutSessionDisplay = {
  workout: Workout;
  logs: ExerciseLog[];
};

// Update TabType to include 'logs', 'betaApplications', and 'creators'
type TabType = 'all' | 'admins' | 'creators' | 'workoutSessions' | 'logs' | 'betaApplications';

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [processingAdmin, setProcessingAdmin] = useState<string | null>(null);
  const [processingDelete, setProcessingDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [copiedId, setCopiedId] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  // Add State for Batch Delete
  const [isSelectingForDelete, setIsSelectingForDelete] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  
  // Add State for Batch Delete Progress
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState(0);
  const [batchDeleteCurrent, setBatchDeleteCurrent] = useState(0);
  const [batchDeleteTotal, setBatchDeleteTotal] = useState(0);
  const [batchDeleteError, setBatchDeleteError] = useState<string | null>(null);
  const [batchDeleteStatusText, setBatchDeleteStatusText] = useState('');

  // State to track if we have exactly one user selected for workout sessions tab
  const [workoutSessionsUser, setWorkoutSessionsUser] = useState<User | null>(null);

  // State for workout sessions
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSessionDisplay[]>([]);
  const [loadingWorkoutSessions, setLoadingWorkoutSessions] = useState(false);
  const [workoutSessionsError, setWorkoutSessionsError] = useState<string | null>(null);
  const [hasLoadedWorkoutSessions, setHasLoadedWorkoutSessions] = useState(false);
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');

  // Add state for selected workout session
  const [selectedWorkoutSession, setSelectedWorkoutSession] = useState<WorkoutSessionDisplay | null>(null);
  
  // *** START: State for Workout Session Selection & Logs Tab ***
  const [selectedWorkoutSessionIds, setSelectedWorkoutSessionIds] = useState<Set<string>>(new Set());
  const [logsWorkoutSession, setLogsWorkoutSession] = useState<WorkoutSessionDisplay | null>(null);
  // *** END: State for Workout Session Selection & Logs Tab ***

  // *** START: State for Fetched Session Logs ***
  const [sessionLogs, setSessionLogs] = useState<ExerciseLog[]>([]);
  const [loadingSessionLogs, setLoadingSessionLogs] = useState(false);
  const [sessionLogsError, setSessionLogsError] = useState<string | null>(null);
  // *** END: State for Fetched Session Logs ***

  // *** START: State for Expanded Session Log Details ***
  const [selectedSessionLogId, setSelectedSessionLogId] = useState<string | null>(null);
  // *** END: State for Expanded Session Log Details ***

  // *** START: State for Beta Applications ***
  const [betaApplications, setBetaApplications] = useState<BetaApplication[]>([]);
  const [loadingBetaApplications, setLoadingBetaApplications] = useState(false);
  const [betaApplicationsError, setBetaApplicationsError] = useState<string | null>(null);
  const [processingApplicationStatus, setProcessingApplicationStatus] = useState<string | null>(null);
  const [selectedBetaApplication, setSelectedBetaApplication] = useState<BetaApplication | null>(null);
  // *** END: State for Beta Applications ***

  // State for adding users to 100trainers program
  const [processingAdd100Trainers, setProcessingAdd100Trainers] = useState<string | null>(null);

  // State for remote login functionality
  const [processingRemoteLogin, setProcessingRemoteLogin] = useState<string | null>(null);

  // *** START: State for Username Migration ***
  const [showUsernameMigrationModal, setShowUsernameMigrationModal] = useState(false);
  const [usersWithBadUsernames, setUsersWithBadUsernames] = useState<User[]>([]);
  const [loadingBadUsernames, setLoadingBadUsernames] = useState(false);
  const [migratingUsernames, setMigratingUsernames] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationResults, setMigrationResults] = useState<{ success: number; failed: number; skipped: number }>({ success: 0, failed: 0, skipped: 0 });
  // *** END: State for Username Migration ***

  // Copy ID to clipboard and show toast
  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id)
      .then(() => {
        setCopiedId(id);
        setToastMessage({ type: 'success', text: 'ID copied to clipboard' });
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setToastMessage({ type: 'error', text: 'Error: Failed to copy ID' });
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

      // Update state with the final user list that includes admin status
      setUsers(usersWithAdminStatus);
      updateFilteredUsers(usersWithAdminStatus, searchTerm, activeTab);
      
    } catch (error) {
      console.error('Error loading users:', error);
      setToastMessage({ 
        type: 'error', 
        text: 'Error loading users. Please try again.' 
      });
    } finally {
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

  // Implement handleDeleteUser function
  const handleDeleteUser = async (userToDelete: User) => {
    if (!auth.currentUser) {
      console.error('Admin not logged in!');
      setToastMessage({ type: 'error', text: 'Error: You must be logged in as admin.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user ${userToDelete.username || userToDelete.email} (ID: ${userToDelete.id})? This action cannot be undone.`)) {
      return;
    }

    console.log(`[Admin] Confirmed deletion for user: ${userToDelete.id}`);
    setProcessingDelete(userToDelete.id);
    setToastMessage(null); // Clear previous toasts

    try {
      const idToken = await auth.currentUser.getIdToken(true); // Force refresh token

      const response = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId: userToDelete.id }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete user.');
      }

      console.log(`[Admin] Successfully deleted user: ${userToDelete.id}`);
      setToastMessage({ type: 'success', text: `User ${userToDelete.username || userToDelete.email} deleted successfully.` });

      // Refresh user list and close details view
      setSelectedUser(null); // Close details view first
      await loadAllUsers(); // Then reload data

    } catch (error) {
      console.error('Error deleting user:', error);
      setToastMessage({ type: 'error', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setProcessingDelete(null);
    }
  };

  // Handlers for Batch Selection
  const handleToggleSelectMode = () => {
    // Check the current state *before* toggling
    const wasSelecting = isSelectingForDelete;

    // Toggle the selection mode state
    setIsSelectingForDelete(prev => !prev);

    // Always clear the ID selections when mode changes
    setSelectedUserIds(new Set()); 
    setSelectedWorkoutSessionIds(new Set());

    // If we were selecting and are now exiting (Cancel Selection was clicked)
    if (wasSelecting) {
      // Perform the full reset
      setSelectedUser(null); // Close user details view
      setSelectedWorkoutSession(null); // Close workout session details view
      setSelectedSessionLogId(null); // Close log details view
      setActiveTab('all'); // Reset to the main 'all users' tab
      // Optionally clear search terms here if desired
      // setSearchTerm('');
      // setWorkoutSearchTerm('');
    } 
    // If we were *not* selecting and are now *entering* (Select Users was clicked),
    // we just cleared the selection IDs above, no further reset needed.
  };

  const handleUserCheckboxChange = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Calculate if all *currently visible* users are selected
  const areAllVisibleSelected = useMemo(() => {
      if (!isSelectingForDelete || filteredUsers.length === 0) return false;
      return filteredUsers.every(user => selectedUserIds.has(user.id));
  }, [filteredUsers, selectedUserIds, isSelectingForDelete]);

  const handleSelectAllVisibleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const isChecked = event.target.checked;
      setSelectedUserIds(prev => {
          const next = new Set(prev);
          const visibleUserIds = filteredUsers.map(u => u.id);

          if (isChecked) {
              // Add all visible users to the set
              visibleUserIds.forEach(id => next.add(id));
          } else {
              // Remove all visible users from the set
              visibleUserIds.forEach(id => next.delete(id));
          }
          return next;
      });
  };

  const handleBatchDeleteClick = async () => {
    if (selectedUserIds.size === 0) {
      setToastMessage({ type: 'error', text: 'No users selected for deletion.' });
      return;
    }

    if (!auth.currentUser) {
      setToastMessage({ type: 'error', text: 'Error: Admin not logged in.' });
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete ${selectedUserIds.size} selected user(s)? This action cannot be undone.`)) {
      return;
    }

    // Setup batch deletion state
    setIsBatchDeleting(true);
    setBatchDeleteTotal(selectedUserIds.size);
    setBatchDeleteCurrent(0);
    setBatchDeleteProgress(0);
    setBatchDeleteError(null);
    setBatchDeleteStatusText(`Preparing to delete ${selectedUserIds.size} users...`);
    setToastMessage(null); // Clear previous toasts

    let idToken: string | null = null;
    try {
      idToken = await auth.currentUser.getIdToken(true); // Get token once
    } catch (tokenError) {
      console.error('Error getting admin ID token:', tokenError);
      setBatchDeleteError('Could not authenticate admin user.');
      setIsBatchDeleting(false);
      setToastMessage({ type: 'error', text: 'Failed to get admin token.' });
      return;
    }

    const userIdsToDelete = Array.from(selectedUserIds); // Copy set to array
    let successCount = 0;
    let hasError = false;

    for (let i = 0; i < userIdsToDelete.length; i++) {
      const userId = userIdsToDelete[i];
      // Find user info for display
      const userToDelete = users.find(u => u.id === userId);
      const userIdentifier = userToDelete?.username || userToDelete?.email || userId.substring(0, 8) + '...';
      setBatchDeleteStatusText(`Deleting user ${i + 1} of ${batchDeleteTotal}: ${userIdentifier}`);

      try {
        const response = await fetch('/.netlify/functions/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ userId: userId }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          // Log specific error but continue with next user
          const errMsg = result.message || `Failed to delete user ${userIdentifier}. Status: ${response.status}`;
          console.error(`Batch delete error for ${userId}: ${errMsg}`);
          setBatchDeleteError(errMsg); // Store the error encountered
          hasError = true;
          
          // Optionally break the loop on first error:
          // break;
          
          // Or continue with next user:
          // Update progress even for failures
          const currentCount = i + 1;
          setBatchDeleteCurrent(currentCount);
          setBatchDeleteProgress(Math.round((currentCount / batchDeleteTotal) * 100));
        } else {
          // Success for this user
          successCount++;
          const currentCount = i + 1;
          setBatchDeleteCurrent(currentCount);
          setBatchDeleteProgress(Math.round((currentCount / batchDeleteTotal) * 100));
        }
      } catch (fetchError) {
        console.error(`Network/fetch error deleting user ${userId}:`, fetchError);
        setBatchDeleteError(`Network error deleting ${userIdentifier}.`);
        hasError = true;
        break; // Stop on network error
      }

      // Wait 1 second before the next deletion
      if (i < userIdsToDelete.length - 1) { // Don't wait after the last one
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Batch Deletion Finished
    setIsBatchDeleting(false);
    
    if (hasError) {
      if (successCount > 0) {
        setToastMessage({ 
          type: 'error', 
          text: `Partially completed: Deleted ${successCount} of ${batchDeleteTotal} users. Error: ${batchDeleteError}` 
        });
      } else {
        setToastMessage({ 
          type: 'error', 
          text: `Batch delete failed: ${batchDeleteError}` 
        });
      }
    } else {
      setToastMessage({ 
        type: 'success', 
        text: `Successfully deleted ${successCount} of ${batchDeleteTotal} users.` 
      });
    }

    // Refresh user list and exit selection mode
    await loadAllUsers();
    setIsSelectingForDelete(false);
    setSelectedUserIds(new Set()); // Clear selection
  };

  useEffect(() => {
    loadAllUsers();
    loadBetaApplications(); // Load beta applications on mount to check for existing ones
  }, []);

  // Update filtered users based on search term and active tab
  const updateFilteredUsers = (allUsers: User[], term: string, tab: TabType) => {
    let filtered = [...allUsers];
    
    // Apply tab filter
    if (tab === 'admins') {
      filtered = filtered.filter(user => user.adminVerified);
    } else if (tab === 'creators') {
      // Show only users who have uploaded videos (identified by videoCount > 0)
      filtered = filtered.filter(user => (user.videoCount || 0) > 0);
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

  // Handle search term changes with debounce
  const debouncedSearch = useMemo(() => {
      return debounce((term: string) => {
          updateFilteredUsers(users, term, activeTab);
      }, 300);
  }, [users, activeTab]); // Recreate debounce function if users or activeTab change

  useEffect(() => {
      // Call the debounced search function when searchTerm changes
      debouncedSearch(searchTerm);
      // Cleanup function to cancel the debounce on unmount or when searchTerm changes rapidly
      return () => {
          debouncedSearch.cancel();
      };
  }, [searchTerm, debouncedSearch]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setSearchTerm(''); // Clear search term on refresh
      
      // Close any open detail views
      setSelectedUser(null);
      setSelectedWorkoutSession(null);
      setSelectedSessionLogId(null);
      setSelectedBetaApplication(null);
      
      // Clear any selections
      setSelectedUserIds(new Set());
      setSelectedWorkoutSessionIds(new Set());
      
      // Reset selection mode
      setIsSelectingForDelete(false);
      
      // Load fresh data
      await loadAllUsers();
      
      // If we're on the beta applications tab, refresh that data too
      if (activeTab === 'betaApplications') {
        await loadBetaApplications();
      }
      
      setToastMessage({ 
        type: 'success', 
        text: 'User data refreshed successfully!' 
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      setToastMessage({ 
        type: 'error', 
        text: 'Error refreshing user data. Please try again.' 
      });
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    
    // Load programming access data when switching to that tab
    if (tab === 'betaApplications') {
      loadBetaApplications();
    }
    
    // Only apply filtering for 'all' and 'admins' tabs
    if (tab !== 'workoutSessions' && tab !== 'betaApplications') {
      updateFilteredUsers(users, searchTerm, tab);
    }
    
    // If switching away from workout sessions, ensure filtering is correct
    if (activeTab === 'workoutSessions' && tab !== 'workoutSessions' && tab !== 'betaApplications') {
      updateFilteredUsers(users, searchTerm, tab);
    }
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

  // *** START: Username Migration Functions ***
  
  // Normalizes a username by removing invalid characters
  const normalizeUsername = (username: string): string => {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .trim();
  };

  // Check if a username is valid (only contains allowed characters)
  const isValidUsername = (username: string): boolean => {
    if (!username) return true; // Empty usernames are handled separately
    return /^[a-z0-9_.-]+$/.test(username);
  };

  // *** USERNAME DIAGNOSTIC FUNCTIONS ***
  
  // State for username diagnostics
  const [diagnosticResults, setDiagnosticResults] = useState<{
    duplicateUsernames: Array<{ username: string; users: Array<{ id: string; email: string; displayName: string }> }>;
    orphanedUsernamesDocs: Array<{ username: string; userId: string }>;
    usersWithoutUsernameDoc: Array<{ id: string; username: string; email: string }>;
    mismatchedUserIds: Array<{ username: string; usernameDocUserId: string; actualUserId: string; email: string }>;
  } | null>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

  // Run comprehensive username diagnostics
  const runUsernameDiagnostics = async () => {
    setRunningDiagnostics(true);
    setDiagnosticResults(null);
    
    try {
      // 1. Find duplicate usernames in users collection
      const usernameMap = new Map<string, Array<{ id: string; email: string; displayName: string }>>();
      users.forEach(user => {
        if (user.username) {
          const existing = usernameMap.get(user.username) || [];
          existing.push({ id: user.id, email: user.email, displayName: user.displayName });
          usernameMap.set(user.username, existing);
        }
      });
      const duplicateUsernames = Array.from(usernameMap.entries())
        .filter(([_, users]) => users.length > 1)
        .map(([username, users]) => ({ username, users }));

      // 2. Get all documents from usernames collection
      const usernamesSnapshot = await getDocs(collection(db, 'usernames'));
      const usernamesDocs = new Map<string, { userId: string; username?: string }>();
      usernamesSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        usernamesDocs.set(docSnap.id, { userId: data.userId, username: data.username });
      });

      // 3. Find orphaned username documents (userId doesn't exist in users)
      const userIds = new Set(users.map(u => u.id));
      const orphanedUsernamesDocs: Array<{ username: string; userId: string }> = [];
      usernamesDocs.forEach((data, username) => {
        if (data.userId && !userIds.has(data.userId)) {
          orphanedUsernamesDocs.push({ username, userId: data.userId });
        }
      });

      // 4. Find users without corresponding username document
      const usersWithoutUsernameDoc: Array<{ id: string; username: string; email: string }> = [];
      users.forEach(user => {
        if (user.username && !usernamesDocs.has(user.username)) {
          usersWithoutUsernameDoc.push({ id: user.id, username: user.username, email: user.email });
        }
      });

      // 5. Find mismatched userIds (username doc points to different user than expected)
      const mismatchedUserIds: Array<{ username: string; usernameDocUserId: string; actualUserId: string; email: string }> = [];
      users.forEach(user => {
        if (user.username) {
          const usernameDoc = usernamesDocs.get(user.username);
          if (usernameDoc && usernameDoc.userId && usernameDoc.userId !== user.id) {
            mismatchedUserIds.push({
              username: user.username,
              usernameDocUserId: usernameDoc.userId,
              actualUserId: user.id,
              email: user.email
            });
          }
        }
      });

      setDiagnosticResults({
        duplicateUsernames,
        orphanedUsernamesDocs,
        usersWithoutUsernameDoc,
        mismatchedUserIds
      });
      setShowDiagnosticsModal(true);
      
      const totalIssues = duplicateUsernames.length + orphanedUsernamesDocs.length + 
                         usersWithoutUsernameDoc.length + mismatchedUserIds.length;
      
      if (totalIssues === 0) {
        setToastMessage({ type: 'success', text: 'No username issues found!' });
      } else {
        setToastMessage({ type: 'warning', text: `Found ${totalIssues} username issues. Review in modal.` });
      }
    } catch (error) {
      console.error('Error running username diagnostics:', error);
      setToastMessage({ type: 'error', text: 'Error running diagnostics' });
    } finally {
      setRunningDiagnostics(false);
    }
  };

  // Repair a specific username connection
  const repairUsernameConnection = async (userId: string, username: string) => {
    try {
      // Update the usernames collection to point to the correct user
      const usernameRef = doc(db, 'usernames', username);
      await setDoc(usernameRef, { 
        userId: userId, 
        username: username,
        createdAt: serverTimestamp(),
        repairedAt: serverTimestamp()
      });
      
      setToastMessage({ type: 'success', text: `Fixed username connection for ${username}` });
      
      // Re-run diagnostics
      await runUsernameDiagnostics();
    } catch (error) {
      console.error('Error repairing username:', error);
      setToastMessage({ type: 'error', text: 'Error repairing username connection' });
    }
  };

  // State for batch repair
  const [batchRepairing, setBatchRepairing] = useState(false);
  const [batchRepairProgress, setBatchRepairProgress] = useState(0);
  const [resolvingDuplicate, setResolvingDuplicate] = useState<string | null>(null);

  // Generate a unique username by appending numbers
  const generateUniqueUsername = async (baseUsername: string): Promise<string> => {
    let suffix = 1;
    let candidate = `${baseUsername}${suffix}`;
    
    while (suffix < 1000) {
      // Check if candidate exists in users collection
      const usersWithCandidate = users.filter(u => u.username === candidate);
      if (usersWithCandidate.length === 0) {
        // Also check usernames collection
        const usernameDoc = await getDoc(doc(db, 'usernames', candidate));
        if (!usernameDoc.exists()) {
          return candidate;
        }
      }
      suffix++;
      candidate = `${baseUsername}${suffix}`;
    }
    
    // Fallback: use timestamp
    return `${baseUsername}_${Date.now()}`;
  };

  // Resolve duplicate username - keep for one user, generate new for others
  const resolveDuplicateUsername = async (
    username: string, 
    keepUserId: string, 
    otherUserIds: string[]
  ) => {
    setResolvingDuplicate(username);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Update usernames collection to point to the keeper
      const usernameRef = doc(db, 'usernames', username);
      batch.set(usernameRef, {
        userId: keepUserId,
        username: username,
        createdAt: serverTimestamp(),
        resolvedAt: serverTimestamp()
      });
      
      // 2. Generate new usernames for other users
      for (const otherId of otherUserIds) {
        const newUsername = await generateUniqueUsername(username);
        
        // Update the user's username field
        const userRef = doc(db, 'users', otherId);
        batch.update(userRef, { 
          username: newUsername,
          updatedAt: serverTimestamp()
        });
        
        // Create new username doc for the other user
        const newUsernameRef = doc(db, 'usernames', newUsername);
        batch.set(newUsernameRef, {
          userId: otherId,
          username: newUsername,
          createdAt: serverTimestamp(),
          generatedFrom: username
        });
        
        console.log(`[ResolveDuplicate] Assigned ${newUsername} to user ${otherId}`);
      }
      
      await batch.commit();
      
      setToastMessage({ 
        type: 'success', 
        text: `Resolved duplicate: ${username} kept for selected user, ${otherUserIds.length} user(s) assigned new usernames` 
      });
      
      // Refresh users list and re-run diagnostics
      await loadAllUsers();
      await runUsernameDiagnostics();
      
    } catch (error) {
      console.error('Error resolving duplicate username:', error);
      setToastMessage({ type: 'error', text: 'Error resolving duplicate username' });
    } finally {
      setResolvingDuplicate(null);
    }
  };

  // Batch fix all missing username docs
  const batchFixMissingUsernameDocs = async () => {
    if (!diagnosticResults?.usersWithoutUsernameDoc.length) return;
    
    setBatchRepairing(true);
    setBatchRepairProgress(0);
    
    const total = diagnosticResults.usersWithoutUsernameDoc.length;
    let success = 0;
    let failed = 0;
    
    try {
      // Process in batches of 50 to avoid overwhelming Firestore
      const batchSize = 50;
      const items = diagnosticResults.usersWithoutUsernameDoc;
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchItems = items.slice(i, Math.min(i + batchSize, items.length));
        
        for (const item of batchItems) {
          const usernameRef = doc(db, 'usernames', item.username);
          batch.set(usernameRef, {
            userId: item.id,
            username: item.username,
            createdAt: serverTimestamp(),
            repairedAt: serverTimestamp()
          });
        }
        
        await batch.commit();
        success += batchItems.length;
        setBatchRepairProgress(Math.round((success / total) * 100));
      }
      
      setToastMessage({ 
        type: 'success', 
        text: `Created ${success} username documents successfully!` 
      });
      
      // Re-run diagnostics
      await runUsernameDiagnostics();
      
    } catch (error) {
      console.error('Error in batch repair:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Batch repair failed. ${success} succeeded, ${total - success} remaining.` 
      });
    } finally {
      setBatchRepairing(false);
      setBatchRepairProgress(0);
    }
  };

  // *** END USERNAME DIAGNOSTIC FUNCTIONS ***

  // Find users with invalid usernames (contains spaces, special chars, or uppercase)
  const findUsersWithBadUsernames = async () => {
    setLoadingBadUsernames(true);
    setMigrationResults({ success: 0, failed: 0, skipped: 0 });
    
    try {
      const badUsers = users.filter(user => {
        if (!user.username) return false;
        // Check if username has invalid characters (spaces, special chars, uppercase)
        const hasInvalidChars = !isValidUsername(user.username);
        const hasUppercase = user.username !== user.username.toLowerCase();
        return hasInvalidChars || hasUppercase;
      });
      
      setUsersWithBadUsernames(badUsers);
      setShowUsernameMigrationModal(true);
      
      if (badUsers.length === 0) {
        setToastMessage({ type: 'success', text: 'No users with invalid usernames found!' });
      }
    } catch (error) {
      console.error('Error finding bad usernames:', error);
      setToastMessage({ type: 'error', text: 'Error scanning for invalid usernames' });
    } finally {
      setLoadingBadUsernames(false);
    }
  };

  // Migrate/fix all bad usernames (IMPROVED with collision detection)
  const migrateUsernames = async () => {
    if (usersWithBadUsernames.length === 0) return;
    
    setMigratingUsernames(true);
    setMigrationProgress(0);
    const results = { success: 0, failed: 0, skipped: 0, collisions: 0 };
    
    try {
      // First pass: detect collisions
      const normalizedToUsers = new Map<string, Array<User>>();
      usersWithBadUsernames.forEach(user => {
        const normalized = normalizeUsername(user.username);
        if (normalized && normalized !== user.username) {
          const existing = normalizedToUsers.get(normalized) || [];
          existing.push(user);
          normalizedToUsers.set(normalized, existing);
        }
      });
      
      // Also check against existing usernames in the database
      const existingUsernamesSnapshot = await getDocs(collection(db, 'usernames'));
      const existingUsernames = new Set<string>();
      existingUsernamesSnapshot.forEach(docSnap => existingUsernames.add(docSnap.id));
      
      const batch = writeBatch(db);
      
      for (let i = 0; i < usersWithBadUsernames.length; i++) {
        const user = usersWithBadUsernames[i];
        const oldUsername = user.username;
        let newUsername = normalizeUsername(oldUsername);
        
        // Update progress
        setMigrationProgress(Math.round(((i + 1) / usersWithBadUsernames.length) * 100));
        
        // Skip if normalized username is empty or same as original
        if (!newUsername || newUsername === oldUsername) {
          results.skipped++;
          continue;
        }
        
        // Skip if normalized username is too short
        if (newUsername.length < 3) {
          console.warn(`Skipping user ${user.id}: normalized username "${newUsername}" is too short`);
          results.skipped++;
          continue;
        }
        
        // Check for collisions
        const usersWithSameNormalized = normalizedToUsers.get(newUsername) || [];
        const hasCollisionWithOtherMigrating = usersWithSameNormalized.length > 1;
        const hasCollisionWithExisting = existingUsernames.has(newUsername) && 
          !usersWithBadUsernames.some(u => u.username === newUsername);
        
        if (hasCollisionWithOtherMigrating || hasCollisionWithExisting) {
          // Add a numeric suffix to make it unique
          let suffix = 1;
          let uniqueUsername = `${newUsername}${suffix}`;
          while (existingUsernames.has(uniqueUsername) || 
                 usersWithBadUsernames.some(u => normalizeUsername(u.username) === uniqueUsername)) {
            suffix++;
            uniqueUsername = `${newUsername}${suffix}`;
          }
          console.warn(`Collision detected for "${newUsername}". Using "${uniqueUsername}" for user ${user.id}`);
          newUsername = uniqueUsername;
          results.collisions++;
        }
        
        try {
          // Update user document with new username
          const userRef = doc(db, 'users', user.id);
          batch.update(userRef, { username: newUsername });
          
          // Update usernames collection (delete old, add new)
          if (oldUsername) {
            const oldUsernameRef = doc(db, 'usernames', oldUsername);
            batch.delete(oldUsernameRef);
          }
          const newUsernameRef = doc(db, 'usernames', newUsername);
          batch.set(newUsernameRef, { 
            userId: user.id, 
            username: newUsername,
            createdAt: serverTimestamp() 
          });
          
          // Track this new username as existing to prevent future collisions in this batch
          existingUsernames.add(newUsername);
          
          results.success++;
        } catch (error) {
          console.error(`Error migrating username for user ${user.id}:`, error);
          results.failed++;
        }
      }
      
      // Commit the batch
      await batch.commit();
      
      setMigrationResults(results);
      setToastMessage({ 
        type: 'success', 
        text: `Migration complete! ${results.success} fixed, ${results.failed} failed, ${results.skipped} skipped${results.collisions > 0 ? `, ${results.collisions} collisions resolved` : ''}` 
      });
      
      // Refresh users list
      await loadAllUsers();
      
      // Clear bad usernames list
      setUsersWithBadUsernames([]);
      
    } catch (error) {
      console.error('Error during username migration:', error);
      setToastMessage({ type: 'error', text: 'Error during username migration' });
    } finally {
      setMigratingUsernames(false);
    }
  };

  // Get the corrected version of a username for preview
  const getCorrectedUsername = (username: string): string => {
    return normalizeUsername(username);
  };
  
  // *** END: Username Migration Functions ***

  // Format duration in minutes to hours and minutes
  const formatDuration = (durationInMinutes: number): string => {
    if (!durationInMinutes) return '0m';
    
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = durationInMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Function to load workout sessions for the selected user
  const loadWorkoutSessions = async () => {
    // Deselect any selected workout when reloading
    setSelectedWorkoutSession(null);
    
    if (!workoutSessionsUser || !workoutSessionsUser.id) {
      setWorkoutSessionsError('No user selected.');
      return;
    }

    setLoadingWorkoutSessions(true);
    setWorkoutSessionsError(null);
    
    try {
      // Use the existing workoutService.fetchAllWorkoutSessions function
      const userId = workoutSessionsUser.id;
      const sessionsData = await workoutService.fetchAllWorkoutSessions(userId);
      
      // Filter out null workouts and convert to our display format
      const validSessions = sessionsData
        .filter(session => session.workout !== null && session.logs !== null)
        .map(session => ({
          workout: session.workout as Workout,
          logs: session.logs as ExerciseLog[]
        }));
      
      setWorkoutSessions(validSessions);
      setHasLoadedWorkoutSessions(true);
      
      if (validSessions.length === 0) {
        setWorkoutSessionsError('No workout sessions found for this user.');
      } else {
        setToastMessage({
          type: 'success',
          text: `Loaded ${validSessions.length} workout session(s) for ${workoutSessionsUser.username || workoutSessionsUser.email || 'user'}.`
        });
      }
    } catch (error) {
      console.error('Error loading workout sessions:', error);
      setWorkoutSessionsError(`Error loading workout sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingWorkoutSessions(false);
    }
  };

  // Calculate stats from workout sessions
  const workoutStats = useMemo(() => {
    if (!workoutSessions.length) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        lastWorkoutDate: null,
        totalExercises: 0,
        completedSessions: 0
      };
    }

    // Sort sessions by startTime (newest first)
    const sortedSessions = [...workoutSessions].sort((a, b) => {
      const timeA = a.workout.createdAt?.getTime() || a.workout.startTime?.getTime() || 0;
      const timeB = b.workout.createdAt?.getTime() || b.workout.startTime?.getTime() || 0;
      return timeB - timeA; // Newest first (descending)
    });

    return {
      totalSessions: workoutSessions.length,
      totalDuration: workoutSessions.reduce((total, session) => total + (session.workout.duration || 0), 0),
      lastWorkoutDate: sortedSessions[0]?.workout.startTime || null,
      totalExercises: workoutSessions.reduce((total, session) => total + (session.workout.exercises?.length || 0), 0),
      completedSessions: workoutSessions.filter(session => session.workout.isCompleted).length
    };
  }, [workoutSessions]);

  // When selectedUserIds changes, check if exactly one user is selected for workout sessions tab
  useEffect(() => {
    if (selectedUserIds.size === 1) {
      // Get the single selected user
      const userId = Array.from(selectedUserIds)[0];
      const user = users.find(u => u.id === userId);
      setWorkoutSessionsUser(user || null);
    } else {
      setWorkoutSessionsUser(null);
      // If we're on workout sessions tab but no longer have exactly one user selected,
      // switch back to 'all' tab
      if (activeTab === 'workoutSessions') {
        setActiveTab('all');
      }
    }
  }, [selectedUserIds, users, activeTab]);

  // When tab changes, reset session data if leaving the workout sessions tab
  useEffect(() => {
    if (activeTab !== 'workoutSessions') {
      setHasLoadedWorkoutSessions(false);
    }
  }, [activeTab]);

  // Filter workout sessions based on search term
  const filteredWorkoutSessions = useMemo(() => {
    let sessionsToDisplay = [...workoutSessions]; // Start with a copy

    // Apply search filter if term exists
    if (workoutSearchTerm.trim()) {
      const searchLower = workoutSearchTerm.toLowerCase().trim();
      sessionsToDisplay = sessionsToDisplay.filter(session => 
        (session.workout.id && session.workout.id.toLowerCase().includes(searchLower)) ||
        (session.workout.title && session.workout.title.toLowerCase().includes(searchLower))
      );
    }

    // Always sort the result (filtered or full list)
    sessionsToDisplay.sort((a, b) => {
      // Prioritize createdAt, then fall back to startTime
      const timeA = a.workout.createdAt?.getTime() || a.workout.startTime?.getTime() || 0;
      const timeB = b.workout.createdAt?.getTime() || b.workout.startTime?.getTime() || 0;
      return timeB - timeA; // Newest first (descending)
    });

    return sessionsToDisplay;
  }, [workoutSessions, workoutSearchTerm]);

  // Render workout session details
  const renderWorkoutSessionDetails = (session: WorkoutSessionDisplay) => {
    const { workout, logs } = session;
    const completedExercises = logs.filter(log => log.isCompleted).length;
    const totalExercises = logs.length;
    const completionPercentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    return (
      <div className="bg-[#1d2b3a] border-t border-blue-800 animate-fade-in-up p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-[#d7ff00]" />
            <div>
              <h4 className="text-lg font-medium text-white">{workout.title || 'Untitled Workout'}</h4>
              <p className="text-gray-400 text-sm">
                {workout.startTime 
                  ? workout.startTime.toLocaleString() 
                  : 'Unknown Date'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedWorkoutSession(null)}
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Close details"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Basic Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Workout Information</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Status</div>
                <div className="mt-1">
                  {workout.isCompleted ? (
                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                      Completed
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">
                      {workout.workoutStatus}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Duration</div>
                <div className="text-gray-300">{formatDuration(workout.duration || 0)}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Body Zone</div>
                <div className="text-gray-300">{workout.zone || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Created</div>
                <div className="text-gray-300">{formatDate(workout.createdAt)}</div>
              </div>
              {workout.author && (
                <div>
                  <div className="text-gray-400 text-xs">Author</div>
                  <div className="text-gray-300">{workout.author}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Column 2: Progress Information */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Completion Progress</h5>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="text-gray-400 text-xs">Exercises Completed</div>
                <div className="font-medium text-gray-300">
                  {completedExercises} / {totalExercises}
                </div>
              </div>

              <div className="relative pt-1">
                <div className="text-gray-400 text-xs mb-1">{completionPercentage}% Complete</div>
                <div className="w-full bg-[#262a30] rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"
                    style={{ width: `${completionPercentage}%` }}
                  ></div>
                </div>
              </div>
              
              {workout.startTime && workout.updatedAt && (
                <div>
                  <div className="text-gray-400 text-xs">Time Spent</div>
                  <div className="text-gray-300">
                    {workout.startTime && workout.updatedAt ? 
                      formatDuration(Math.floor((workout.updatedAt.getTime() - workout.startTime.getTime()) / 60000)) : 
                      'N/A'}
                  </div>
                </div>
              )}
              
              {workout.workoutRating && (
                <div>
                  <div className="text-gray-400 text-xs">User Rating</div>
                  <div className="text-gray-300">{workout.workoutRating}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Column 3: Quick Stats */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Workout Stats</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Total Exercises</div>
                <div className="text-gray-300">{workout.exercises?.length || 0}</div>
              </div>
              {logs && logs.length > 0 && (
                <>
                  <div>
                    <div className="text-gray-400 text-xs">Average Reps</div>
                    <div className="text-gray-300">
                      {logs.some(log => log.logs && log.logs.length > 0)
                        ? Math.round(
                            logs.reduce((sum, log) => {
                              if (!log.logs || log.logs.length === 0) return sum;
                              const avgReps = log.logs.reduce((s, l) => s + (l.reps || 0), 0) / log.logs.length;
                              return sum + avgReps;
                            }, 0) / logs.filter(log => log.logs && log.logs.length > 0).length
                          )
                        : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Average Weight</div>
                    <div className="text-gray-300">
                      {logs.some(log => log.logs && log.logs.length > 0)
                        ? Math.round(
                            logs.reduce((sum, log) => {
                              if (!log.logs || log.logs.length === 0) return sum;
                              const avgWeight = log.logs.reduce((s, l) => s + (l.weight || 0), 0) / log.logs.length;
                              return sum + avgWeight;
                            }, 0) / logs.filter(log => log.logs && log.logs.length > 0).length
                          ) + ' lbs'
                        : 'N/A'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Exercises List */}
        {workout.exercises && workout.exercises.length > 0 && (
          <div className="mt-6">
            <h5 className="text-gray-400 text-sm font-medium mb-3 border-b border-gray-700 pb-1">Exercise List</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {workout.exercises.map((exerciseRef: any, index: number) => {
                // Find matching log
                const log = logs.find(l => 
                  l.exercise?.id === exerciseRef.exercise?.id || 
                  l.exercise?.name === exerciseRef.exercise?.name
                );
                
                return (
                  <div 
                    key={`${exerciseRef.exercise?.id || index}`}
                    className={`p-3 rounded-lg border ${
                      log?.isCompleted 
                        ? 'bg-green-900/20 border-green-900' 
                        : 'bg-[#262a30] border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-medium ${
                        log?.isCompleted 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-200">
                          {exerciseRef.exercise?.name || 'Unknown Exercise'}
                        </div>
                        <div className="font-medium text-gray-200">
                          {exerciseRef.exercise?.id || 'Unknown ExerciseID'}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {exerciseRef.exercise?.category?.type === 'weight-training' ? (
                            <>
                              {exerciseRef.exercise.category.details?.sets || 0} sets × {
                                Array.isArray(exerciseRef.exercise.category.details?.reps) 
                                  ? exerciseRef.exercise.category.details.reps.join('/') 
                                  : (exerciseRef.exercise.category.details?.reps || '0')
                              } reps
                            </>
                          ) : (
                            <>
                              {exerciseRef.exercise?.category?.details?.duration ? `${exerciseRef.exercise.category.details.duration} sec` : 'No duration'}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setSelectedWorkoutSession(null)}
            className="px-3 py-1.5 bg-gray-700/30 text-gray-300 rounded-lg text-xs font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Close
          </button>
        </div>
      </div>
    );
  };

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
            onClick={() => handleAddTo100Trainers(user)}
            disabled={processingAdd100Trainers === user.id || !user.email}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center bg-green-900/30 text-green-400 border-green-900 hover:bg-green-800/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {processingAdd100Trainers === user.id ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Adding...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-1" />
                Add to 100trainers
              </>
            )}
          </button>
          <button
            onClick={() => handleDeleteUser(user)}
            disabled={processingDelete === user.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center bg-red-900/30 text-red-400 border-red-900 hover:bg-red-800/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {processingDelete === user.id ? (
               <>
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </>
            ) : (
               <>
                 <TrashIcon className="h-4 w-4 mr-1" />
                 Delete User
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
            <XCircle className="h-4 w-4 mr-1" />
            Close
          </button>
        </div>
      </div>
    );
  };

  // Add useEffect to hide toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000); // Hide toast after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // *** START: Handler for Workout Session Checkbox Change ***
  const handleWorkoutSessionCheckboxChange = (sessionId: string) => {
    setSelectedWorkoutSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };
  // *** END: Handler for Workout Session Checkbox Change ***

  // *** START: useEffect to track single selected workout session ***
  useEffect(() => {
    if (selectedWorkoutSessionIds.size === 1) {
      const sessionId = Array.from(selectedWorkoutSessionIds)[0];
      const session = workoutSessions.find(s => s.workout.id === sessionId);
      setLogsWorkoutSession(session || null);
    } else {
      setLogsWorkoutSession(null);
      // *** START: Clear logs state when selection changes ***
      setSessionLogs([]); 
      setLoadingSessionLogs(false);
      setSessionLogsError(null);
      // *** END: Clear logs state when selection changes ***

      // If we're on logs tab but no longer have exactly one session selected,
      // switch back to 'workoutSessions' tab
      if (activeTab === 'logs') {
        setActiveTab('workoutSessions');
      }
    }
  }, [selectedWorkoutSessionIds, workoutSessions, activeTab]);
  // *** END: useEffect to track single selected workout session ***

  // *** START: Function to load logs for the selected session ***
  const loadLogsForSession = async () => {
    if (!logsWorkoutSession || !workoutSessionsUser) {
      setSessionLogsError("Cannot load logs: No user or workout session selected.");
      return;
    }

    const userId = workoutSessionsUser.id;
    const workoutId = logsWorkoutSession.workout.id;
    console.log(`[Admin Users] Loading logs for user: ${userId}, workout: ${workoutId}`);

    setLoadingSessionLogs(true);
    setSessionLogsError(null);
    setSessionLogs([]); // Clear previous logs

    try {
      const logsRef = collection(db, 'users', userId, 'workoutSessions', workoutId, 'logs');
      const logsSnapshot = await getDocs(logsRef);
      
      if (logsSnapshot.empty) {
        console.log('[Admin Users] No logs found for this session.');
        setSessionLogs([]);
        // Optionally set an info message instead of error
        // setSessionLogsError("No exercise logs found for this workout session."); 
      } else {
        const fetchedLogs = logsSnapshot.docs.map(doc => (
          // Convert to plain object matching ExerciseLog structure expected by state/UI
          // Ensure this aligns with how ExerciseLog is structured/used elsewhere
          { id: doc.id, ...doc.data() } as ExerciseLog 
        ));
        
        // Optional: Sort logs if needed (e.g., by order field)
        // fetchedLogs.sort((a, b) => (a.order || 0) - (b.order || 0)); 

        setSessionLogs(fetchedLogs);
        console.log(`[Admin Users] Loaded ${fetchedLogs.length} logs.`);
      }

    } catch (error) {
      console.error('[Admin Users] Error loading session logs:', error);
      setSessionLogsError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSessionLogs([]);
    } finally {
      setLoadingSessionLogs(false);
    }
  };
  // *** END: Function to load logs for the selected session ***

  // *** START: Render Log Details Function ***
  const renderSessionLogDetails = (log: ExerciseLog) => {
    // Ensure log and nested properties exist
    console.log("[Admin Users] Rendering Log Details for log ID:", log.id, "Data:", JSON.stringify(log, null, 2)); // Added detailed log
    if (!log) return null;
    const exercise = log.exercise;
    const category = exercise?.category;
    const details = category?.details;
    // *** FIX: Access the correct property for recorded sets ***
    // @ts-ignore - Data from Firestore uses 'log', type definition uses 'logs'
    const recordedSets = log.log || []; 

    return (
      <div className="bg-[#262a30] border-t border-purple-800 animate-fade-in-up p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#d7ff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> </svg>
            <div>
              <h4 className="text-lg font-medium text-white">{exercise?.name || 'Exercise Log Details'}</h4>
              <p className="text-gray-400 text-sm font-mono">
                Log ID: 
                <button 
                  onClick={() => copyToClipboard(log.id)} 
                  className="hover:text-blue-400 flex items-center ml-1"
                  title="Copy log ID"
                >
                  {log.id}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor"> <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /> <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /> </svg>
                </button>
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedSessionLogId(null)} // Close details
            className="p-1 text-gray-400 hover:text-gray-200 transition"
            title="Close details"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1: Log Status & Timestamps */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Log Status</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Submitted</div>
                <div className="mt-1">
                  {log.logSubmitted ? (
                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">Submitted</span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">Pending</span>
                  )}
                </div>
              </div>
              {log.completedAt && (
                <div>
                  <div className="text-gray-400 text-xs">Completed At</div>
                  <div className="text-gray-300">{formatDate(log.completedAt)}</div>
                </div>
              )}
               <div>
                  <div className="text-gray-400 text-xs">Created At</div>
                  <div className="text-gray-300">{formatDate(log.createdAt)}</div>
                </div>
              <div>
                <div className="text-gray-400 text-xs">Last Updated</div>
                <div className="text-gray-300">{formatDate(log.updatedAt)}</div>
              </div>
            </div>
          </div>
          
          {/* Column 2: Exercise Info */}
          <div className="space-y-4">
            <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Exercise Info</h5>
            <div className="space-y-3">
              <div>
                <div className="text-gray-400 text-xs">Exercise Name</div>
                <div className="text-gray-300">{exercise?.name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Exercise ID</div>
                <div className="text-gray-300 font-mono text-sm">{exercise?.id || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Type</div>
                <div className="text-gray-300 capitalize">{category?.type?.replace('-', ' ') || 'N/A'}</div>
              </div>
              {category?.type === 'weight-training' && (
                <>
                  <div>
                    <div className="text-gray-400 text-xs">Target Sets</div>
                    <div className="text-gray-300">{details?.sets || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">Target Reps</div>
                    <div className="text-gray-300">{Array.isArray(details?.reps) ? details.reps.join(' / ') : (details?.reps || 'N/A')}</div>
                  </div>
                </>
              )}
              {category?.type === 'timed' && (
                 <div>
                  <div className="text-gray-400 text-xs">Target Duration</div>
                  <div className="text-gray-300">{details?.duration ? `${details.duration} sec` : 'N/A'}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Column 3: Recorded Performance */}
          <div className="space-y-4">
             <h5 className="text-gray-400 text-sm font-medium mb-2 border-b border-gray-700 pb-1">Recorded Performance</h5>
             {recordedSets.length > 0 ? (
               <div className="space-y-2">
                 {recordedSets.map((setLog: RepsAndWeightLog, index: number) => ( // Added types
                   <div key={index} className="bg-[#1d2b3a] p-2 rounded border border-gray-700 text-xs">
                     <span className="font-medium text-gray-400 mr-2">Set {index + 1}:</span>
                     <span className="text-gray-300 font-mono">
                       {setLog.reps || '0'} reps × {setLog.weight || '0'} lbs {setLog.isBodyWeight ? '(Bodyweight)' : ''}
                     </span>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-gray-400 italic text-sm">No specific set data recorded for this log entry.</p>
             )}
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setSelectedSessionLogId(null)}
            className="px-3 py-1.5 bg-gray-700/30 text-gray-300 rounded-lg text-xs font-medium border border-gray-700 hover:bg-gray-700/50 transition flex items-center"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Close Details
          </button>
        </div>
      </div>
    );
  };
  // *** END: Render Log Details Function ***

  // *** START: Beta Applications Management Functions ***
  const loadBetaApplications = async () => {
    try {
      setLoadingBetaApplications(true);
      setBetaApplicationsError(null);
      
      const applications = await adminMethods.getBetaApplications();
      setBetaApplications(applications);
    } catch (error) {
      console.error('Error loading beta applications:', error);
      setBetaApplicationsError('Failed to load beta applications');
    } finally {
      setLoadingBetaApplications(false);
    }
  };

  const handleUpdateApplicationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      setProcessingApplicationStatus(id);
      
      const currentUser = auth.currentUser;
      const approvedBy = currentUser?.email || 'Unknown Admin';
      
      // Find the application to get user details for email
      const application = betaApplications.find(app => app.id === id);
      
      const success = await adminMethods.updateBetaApplicationStatus(id, status, approvedBy);
      
      if (success) {
        // If user was just approved, send the congratulatory email
        if (status === 'approved' && application) {
          try {
            const emailResponse = await fetch('/.netlify/functions/send-approval-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: application.email,
                name: application.name || application.email
              })
            });

            if (!emailResponse.ok) {
              const errorData = await emailResponse.json();
              console.error('Failed to send approval email:', emailResponse.status, errorData);
              setToastMessage({ 
                type: 'success', 
                text: `Application approved successfully, but email notification failed to send` 
              });
            } else {
              console.log('Approval email sent successfully to:', application.email);
              setToastMessage({ 
                type: 'success', 
                text: `Application approved and congratulatory email sent to ${application.email}` 
              });
            }
          } catch (emailError) {
            console.error('Error sending approval email:', emailError);
            setToastMessage({ 
              type: 'success', 
              text: `Application approved successfully, but email notification failed to send` 
            });
          }
        } else {
          setToastMessage({ 
            type: 'success', 
            text: `Application ${status === 'approved' ? 'approved' : 'rejected'} successfully` 
          });
        }
        
        await loadBetaApplications();
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating application status:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Failed to ${status === 'approved' ? 'approve' : 'reject'} application` 
      });
    } finally {
      setProcessingApplicationStatus(null);
    }
  };

  const handleDeleteApplication = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete the beta application for ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessingApplicationStatus(id);
      
      const success = await adminMethods.deleteBetaApplication(id);
      
      if (success) {
        setToastMessage({ 
          type: 'success', 
          text: 'Application deleted successfully' 
        });
        await loadBetaApplications();
        if (selectedBetaApplication?.id === id) {
          setSelectedBetaApplication(null);
        }
      } else {
        throw new Error('Failed to delete application');
      }
    } catch (error) {
      console.error('Error deleting application:', error);
      setToastMessage({ 
        type: 'error', 
        text: 'Failed to delete application' 
      });
    } finally {
      setProcessingApplicationStatus(null);
    }
  };

  // Add user to 100trainers program
  const handleAddTo100Trainers = async (user: User) => {
    if (!user.email) {
      setToastMessage({ 
        type: 'error', 
        text: 'User must have an email to be added to 100trainers program' 
      });
      return;
    }

    if (!window.confirm(`Add ${user.username || user.email} to the 100trainers program?\n\nThis will create an approved beta application for them.`)) {
      return;
    }

    try {
      setProcessingAdd100Trainers(user.id);
      
      const currentUser = auth.currentUser;
      const approvedBy = currentUser?.email || 'Unknown Admin';
      
      // Check if user already has a beta application
      const existingApplication = betaApplications.find(app => 
        app.email?.toLowerCase() === user.email?.toLowerCase()
      );
      
      if (existingApplication) {
        setToastMessage({ 
          type: 'error', 
          text: `${user.email} already has a beta application (Status: ${existingApplication.status})` 
        });
        return;
      }

      const success = await adminMethods.createBetaApplication(
        user.email,
        user.displayName || '',
        user.username || '',
        approvedBy
      );
      
      if (success) {
        setToastMessage({ 
          type: 'success', 
          text: `Successfully added ${user.username || user.email} to 100trainers program` 
        });
        
        // Refresh beta applications if we're on that tab
        if (activeTab === 'betaApplications') {
          await loadBetaApplications();
        }
      } else {
        setToastMessage({ 
          type: 'error', 
          text: 'Failed to add user to 100trainers program. They may already have an application.' 
        });
      }
    } catch (error) {
      console.error('Error adding user to 100trainers:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Failed to add user to 100trainers program: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setProcessingAdd100Trainers(null);
    }
  };

  // Remote login function
  const handleRemoteLogin = async (user: User) => {
    if (!user.email) {
      setToastMessage({ 
        type: 'error', 
        text: 'User must have an email for remote login' 
      });
      return;
    }

    if (!window.confirm(`Remote login as ${user.username || user.email}?\n\nThis will open a new tab logged in as this user for debugging purposes.`)) {
      return;
    }

    try {
      setProcessingRemoteLogin(user.id);
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setToastMessage({ 
          type: 'error', 
          text: 'You must be logged in as an admin to use remote login' 
        });
        return;
      }

      // Generate remote login token
      const response = await fetch('/.netlify/functions/generate-remote-login-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: user.id,
          adminUserId: currentUser.uid
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate remote login token');
      }

      const { token } = await response.json();

      // Consume the token and get custom token
      const loginResponse = await fetch('/.netlify/functions/consume-remote-login-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(errorData.error || 'Failed to consume remote login token');
      }

      const { customToken, user: targetUser } = await loginResponse.json();

      // Sign in with the custom token in a new tab
      const loginUrl = `${window.location.origin}/remote-login?token=${customToken}&userId=${targetUser.id}&email=${encodeURIComponent(targetUser.email)}`;
      window.open(loginUrl, '_blank', 'noopener,noreferrer');

      setToastMessage({ 
        type: 'success', 
        text: `Remote login initiated for ${user.username || user.email}. Check the new tab.` 
      });

    } catch (error) {
      console.error('Error with remote login:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Failed to remote login: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setProcessingRemoteLogin(null);
    }
  };
  // *** END: Beta Applications Management Functions ***

  // Helper function to format role field
  const formatRoleField = (role: any): string => {
    if (Array.isArray(role)) {
      return role.join(', ');
    }
    if (typeof role === 'object' && role) {
      return Object.keys(role).filter(key => role[key]).join(', ');
    }
    return role || 'Not provided';
  };

  // Helper function to format use cases field
  const formatUseCasesField = (useCases: any): string => {
    if (Array.isArray(useCases)) {
      return useCases.join(', ');
    }
    if (typeof useCases === 'object' && useCases) {
      return Object.keys(useCases).filter(key => useCases[key]).join(', ');
    }
    return useCases || 'Not provided';
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
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          .animate-pulse-slow {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
          @keyframes progressAnimation {
            from { 
              background-position: 0 0;
            }
            to { 
              background-position: 50px 50px;
            }
          }
          .animated-progress {
            background-size: 50px 50px;
            background-image: linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.15) 25%,
              transparent 25%,
              transparent 50%,
              rgba(255, 255, 255, 0.15) 50%,
              rgba(255, 255, 255, 0.15) 75%,
              transparent 75%,
              transparent
            );
            animation: progressAnimation 1.5s linear infinite;
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
            
            {/* Top Controls Area */}
            <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
              {/* Search */}
              <div className="flex-grow md:flex-grow-0 md:w-1/2">
                <label className="block text-gray-300 mb-2 text-sm font-medium">Search Users</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by email, name, username or user ID"
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={isBatchDeleting}
                  />
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 items-center">
                 {/* Batch Delete Button (Conditional) */}
                 {isSelectingForDelete && selectedUserIds.size > 0 && (
                     <button
                        onClick={handleBatchDeleteClick}
                        disabled={isBatchDeleting}
                        className={`bg-red-700/80 text-white px-4 py-3 rounded-lg font-medium transition flex items-center text-sm
                          ${isBatchDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600/80'}`}
                     >
                         <TrashIcon className="h-4 w-4 mr-2"/>
                         Delete Selected ({selectedUserIds.size})
                     </button>
                 )}
                 {/* Toggle Selection Mode Button */}
                 <button
                   onClick={handleToggleSelectMode}
                   disabled={isBatchDeleting}
                   className={`${isSelectingForDelete 
                     ? 'bg-gray-700/80' 
                     : 'bg-purple-700/80 hover:bg-purple-600/80'
                   } text-white px-4 py-3 rounded-lg font-medium transition flex items-center text-sm
                   ${isBatchDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   {isSelectingForDelete ? 'Cancel Selection' : 'Select Users'}
                 </button>
                {/* Username Migration Button */}
                <button
                   onClick={findUsersWithBadUsernames}
                   className={`bg-amber-700/80 text-white px-4 py-3 rounded-lg font-medium hover:bg-amber-600/80 transition flex items-center text-sm
                     ${(loadingBadUsernames || isBatchDeleting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                   disabled={loadingBadUsernames || isBatchDeleting}
                 >
                   <AlertCircle className="h-4 w-4 mr-2" />
                   {loadingBadUsernames ? 'Scanning...' : 'Fix Invalid Usernames'}
                 </button>
                 {/* Username Diagnostics Button */}
                 <button
                   onClick={runUsernameDiagnostics}
                   className={`bg-cyan-700/80 text-white px-4 py-3 rounded-lg font-medium hover:bg-cyan-600/80 transition flex items-center text-sm
                     ${(runningDiagnostics || isBatchDeleting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                   disabled={runningDiagnostics || isBatchDeleting}
                 >
                   <Search className="h-4 w-4 mr-2" />
                   {runningDiagnostics ? 'Running...' : 'Diagnose Usernames'}
                 </button>
                 {/* Refresh Button */}
                 <button
                   onClick={handleRefresh}
                   className={`bg-[#262a30] text-white px-4 py-3 rounded-lg font-medium hover:bg-[#2a2f36] transition flex items-center text-sm
                     ${(loading || isBatchDeleting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                   disabled={loading || isBatchDeleting}
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
                } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => handleTabChange('all')}
                disabled={isBatchDeleting}
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
                className={`py-2 px-4 mr-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'admins'
                    ? 'text-[#d7ff00]'
                    : 'text-gray-400 hover:text-gray-200'
                } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => handleTabChange('admins')}
                disabled={isBatchDeleting}
              >
                Admins Only
                <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                  {users.filter(u => u.adminVerified).length}
                </span>
                {activeTab === 'admins' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                )}
              </button>
              
              {/* Creators Tab - users who have uploaded videos */}
              <button
                className={`py-2 px-4 mr-2 font-medium text-sm transition-colors relative ${
                  activeTab === 'creators'
                    ? 'text-[#d7ff00]'
                    : 'text-gray-400 hover:text-gray-200'
                } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => handleTabChange('creators')}
                disabled={isBatchDeleting}
              >
                <div className="flex items-center">
                  <Activity className="h-4 w-4 mr-1" />
                  Creator Tab
                  <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                    {users.filter(u => (u.videoCount || 0) > 0).length}
                  </span>
                </div>
                {activeTab === 'creators' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                )}
              </button>
              
              {/* Workout Sessions Tab - Only show when exactly one user is selected */}
              {workoutSessionsUser && (
                <button
                  className={`py-2 px-4 font-medium text-sm transition-colors relative ${
                    activeTab === 'workoutSessions'
                      ? 'text-[#d7ff00]'
                      : 'text-gray-400 hover:text-gray-200'
                  } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => handleTabChange('workoutSessions')}
                  disabled={isBatchDeleting}
                >
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 mr-1" />
                    Workout Sessions
                    <span className="ml-2 px-2 py-0.5 bg-blue-900/40 text-blue-300 rounded-full text-xs border border-blue-800">
                      {workoutSessionsUser.username || workoutSessionsUser.email || workoutSessionsUser.id.substring(0, 8)}
                    </span>
                  </div>
                  {activeTab === 'workoutSessions' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                  )}
                </button>
              )}
              
              {/* Logs Tab - Only show when exactly one workout session is selected */}
              {logsWorkoutSession && (
                <button
                  className={`py-2 px-4 font-medium text-sm transition-colors relative ${ 
                    activeTab === 'logs'
                      ? 'text-[#d7ff00]'
                      : 'text-gray-400 hover:text-gray-200'
                  } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => handleTabChange('logs')}
                  disabled={isBatchDeleting}
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"> <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /> </svg> 
                    Session Logs
                    <span className="ml-2 px-2 py-0.5 bg-purple-900/40 text-purple-300 rounded-full text-xs border border-purple-800">
                      {logsWorkoutSession.workout.id.substring(0, 8)}...
                    </span>
                  </div>
                  {activeTab === 'logs' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                  )}
                </button>
              )}

              {/* Beta Applications Tab */}
                              <button
                  className={`py-2 px-4 mr-2 font-medium text-sm transition-colors relative ${
                    activeTab === 'betaApplications'
                      ? 'text-[#d7ff00]'
                      : 'text-gray-400 hover:text-gray-200'
                  } ${isBatchDeleting ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => handleTabChange('betaApplications')}
                  disabled={isBatchDeleting}
                >
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    Beta Applications
                    <span className="ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                      {betaApplications.length}
                    </span>
                  </div>
                {activeTab === 'betaApplications' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                )}
              </button>
            </div>

            {/* Batch Deletion Progress UI */}
            {isBatchDeleting && (
              <div className="my-4 p-4 bg-[#1d2b3a] rounded-lg border border-blue-800 shadow-lg animate-fade-in-up relative overflow-hidden">
                {/* Gradient top border */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
                
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <div className="mr-2 h-6 w-6 text-blue-400 animate-pulse-slow">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-blue-300">{batchDeleteStatusText}</span>
                  </div>
                  <span className="text-sm font-medium text-[#d7ff00]">
                    {batchDeleteCurrent} / {batchDeleteTotal} ({batchDeleteProgress}%)
                  </span>
                </div>
                
                <div className="relative pt-1">
                  <div className="w-full bg-[#262a30] rounded-full h-3 mb-1">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ease-out animated-progress ${
                        batchDeleteError ? 'bg-red-600' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]'
                      }`}
                      style={{ width: `${batchDeleteProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                {batchDeleteError && (
                  <div className="mt-2 flex items-start text-red-400 bg-red-900/20 p-2 rounded border border-red-900">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-xs">{batchDeleteError}</p>
                  </div>
                )}
                
                <p className="text-gray-400 text-xs mt-2">
                  Removing users sequentially with a 1-second delay between operations to prevent rate limiting.
                </p>
              </div>
            )}

            {/* Conditional Content Based on Tab */}
            {activeTab === 'workoutSessions' ? (
              // Display Workout Sessions Content
              <div className="mt-4">
                <div className="bg-[#1d2b3a] rounded-lg border border-blue-800 p-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-4">
                    <Activity className="h-5 w-5 text-[#d7ff00]" />
                    <h3 className="text-lg font-medium text-white">Workout Sessions</h3>
                    <span className="text-blue-300 text-sm">
                      {workoutSessionsUser?.username || workoutSessionsUser?.email || ''}
                    </span>
                  </div>
                  
                  {!hasLoadedWorkoutSessions ? (
                    <div className="bg-[#262a30] rounded-lg p-6 flex items-center justify-center">
                      <p className="text-gray-400 italic">
                        Click "Load Workout Sessions" to view this user's workout history.
                      </p>
                    </div>
                  ) : loadingWorkoutSessions ? (
                    <div className="bg-[#262a30] rounded-lg p-8 flex flex-col items-center justify-center">
                      <svg className="animate-spin h-8 w-8 mb-4 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-gray-300">Loading workout sessions...</p>
                    </div>
                  ) : workoutSessionsError && workoutSessions.length === 0 ? (
                    <div className="bg-[#262a30] rounded-lg p-6">
                      <div className="flex items-start gap-3 text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-800">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium mb-1">Failed to load workout sessions</p>
                          <p className="text-sm text-red-300">{workoutSessionsError}</p>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button 
                          className="px-4 py-2 bg-blue-700/80 hover:bg-blue-600/80 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                          onClick={loadWorkoutSessions}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : workoutSessions.length === 0 ? (
                    <div className="bg-[#262a30] rounded-lg p-6">
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <Dumbbell className="h-12 w-12 mb-4 text-gray-600" />
                        <p className="text-lg font-medium mb-2">No Workout Sessions Found</p>
                        <p className="text-sm text-center max-w-md">
                          This user hasn't completed any workout sessions yet or their session data may be in a different format.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Workout Sessions Search Bar */}
                      <div className="mb-6">
                        <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                          {/* Add Refresh button next to search label */}
                          <div className="flex justify-between items-center mb-2">
                              <label className="block text-gray-300 text-sm font-medium">Search Workout Sessions</label>
                              <button 
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${ 
                                  loadingWorkoutSessions 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                    : 'bg-blue-700/80 hover:bg-blue-600/80 text-white'
                                }`}
                                onClick={loadWorkoutSessions} 
                                disabled={loadingWorkoutSessions}
                              >
                                {loadingWorkoutSessions ? (
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path> </svg>
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> </svg>
                                )}
                                <span>Refresh</span>
                              </button>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search by workout ID or title"
                              className="w-full bg-[#1a1e24] border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                              value={workoutSearchTerm}
                              onChange={(e) => setWorkoutSearchTerm(e.target.value)}
                            />
                            {workoutSearchTerm && (
                              <button 
                                onClick={() => setWorkoutSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex justify-between mt-2">
                            <div className="text-sm text-gray-400">
                              {filteredWorkoutSessions.length} of {workoutSessions.length} sessions
                            </div>
                            {workoutSearchTerm && (
                              <button 
                                onClick={() => setWorkoutSearchTerm('')}
                                className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
                              >
                                Clear filter
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Workout Sessions Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-900/30 rounded-lg">
                              <Activity className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Total Sessions</div>
                              <div className="text-xl font-bold text-white">{workoutStats.totalSessions}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-900/30 rounded-lg">
                              <Clock className="h-5 w-5 text-purple-400" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Total Time</div>
                              <div className="text-xl font-bold text-white">{formatDuration(workoutStats.totalDuration)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-900/30 rounded-lg">
                              <Calendar className="h-5 w-5 text-green-400" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Latest Workout</div>
                              <div className="text-xl font-bold text-white">
                                {workoutStats.lastWorkoutDate 
                                  ? workoutStats.lastWorkoutDate.toLocaleDateString() 
                                  : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#262a30] p-4 rounded-lg border border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-900/30 rounded-lg">
                              <Dumbbell className="h-5 w-5 text-amber-400" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-400">Completion Rate</div>
                              <div className="text-xl font-bold text-white">
                                {workoutStats.totalSessions > 0 
                                  ? `${Math.round((workoutStats.completedSessions / workoutStats.totalSessions) * 100)}%` 
                                  : '0%'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Workout Sessions Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                          <thead>
                            <tr className="border-b border-gray-700">
                              {/* Add Checkbox Header for Workout Sessions */}
                              <th className="py-3 px-4 text-center w-12">
                                <input
                                  type="checkbox"
                                  className="form-checkbox h-4 w-4 text-[#d7ff00] bg-gray-800 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-offset-0"
                                  title="Select/Deselect all visible sessions"
                                  disabled={isBatchDeleting}
                                />
                              </th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">Date</th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">Title</th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">ID</th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">Exercises</th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">Duration</th>
                              <th className="py-3 px-4 text-left text-gray-300 font-medium">Status</th>
                              <th className="py-3 px-4 text-center text-gray-300 font-medium">View</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredWorkoutSessions.map((session) => (
                              <React.Fragment key={session.workout.id}>
                                <tr className={`hover:bg-[#2a2f36] transition-colors ${
                                  selectedWorkoutSession?.workout.id === session.workout.id ? 'bg-[#1d2b3a]' : ''
                                }`}>
                                  {/* Add Checkbox Cell for Workout Sessions */}
                                  <td className="py-3 px-4 border-b border-gray-700 text-center">
                                      <input
                                          type="checkbox"
                                          className="form-checkbox h-4 w-4 text-[#d7ff00] bg-gray-800 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-offset-0"
                                          checked={selectedWorkoutSessionIds.has(session.workout.id)}
                                          onChange={() => handleWorkoutSessionCheckboxChange(session.workout.id)}
                                          disabled={isBatchDeleting}
                                      />
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                                    {session.workout.createdAt 
                                      ? formatDate(session.workout.createdAt).split(',')[0]
                                      : 'Unknown Date'}
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700">
                                    <div className="font-medium text-white">
                                      {session.workout.title || 'Untitled Workout'}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                      {session.workout.workoutStatus}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                                    <button 
                                      onClick={() => copyToClipboard(session.workout.id || '')} 
                                      className="hover:text-blue-400 flex items-center text-blue-300 text-sm font-mono"
                                      title="Copy workout ID"
                                    >
                                      {session.workout.id ? session.workout.id.substring(0, 8) + '...' : 'N/A'}
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                      </svg>
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                                    {session.workout.exercises?.length || 0} exercise{session.workout.exercises?.length !== 1 ? 's' : ''}
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700 text-gray-300">
                                    {formatDuration(session.workout.duration || 0)}
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700">
                                    {(() => {
                                      switch (session.workout.workoutStatus) {
                                        case WorkoutStatus.Complete:
                                          return (
                                            <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">
                                              Completed
                                            </span>
                                          );
                                        case WorkoutStatus.Archived:
                                          return (
                                            <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                                              Archived
                                            </span>
                                          );
                                        case WorkoutStatus.InProgress:
                                          return (
                                            <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">
                                              In Progress
                                            </span>
                                          );
                                        case WorkoutStatus.QueuedUp:
                                          return (
                                            <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900">
                                              Queued Up
                                            </span>
                                          );
                                        default:
                                          return (
                                            <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-700">
                                              {session.workout.workoutStatus || 'Unknown'}
                                            </span>
                                          );
                                      }
                                    })()}
                                  </td>
                                  <td className="py-3 px-4 border-b border-gray-700 text-center">
                                    <button
                                      onClick={() => setSelectedWorkoutSession(
                                        selectedWorkoutSession?.workout.id === session.workout.id ? null : session
                                      )}
                                      className={`px-2 py-1 rounded-lg text-xs font-medium border hover:bg-blue-800/40 transition-colors flex items-center mx-auto ${
                                        selectedWorkoutSession?.workout.id === session.workout.id 
                                          ? 'bg-blue-800/50 text-blue-300 border-blue-900' 
                                          : 'bg-blue-900/30 text-blue-400 border-blue-900'
                                      }`}
                                      title="View workout details"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      {selectedWorkoutSession?.workout.id === session.workout.id ? 'Hide' : 'View'}
                                    </button>
                                  </td>
                                </tr>
                                {selectedWorkoutSession?.workout.id === session.workout.id && (
                                  <tr>
                                    <td colSpan={8} className="p-0 border-b border-gray-700">
                                      {renderWorkoutSessionDetails(session)}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Commented out old refresh button */}
                      {/*
                      <div className="flex justify-end mt-4">
                        <button
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                          onClick={loadWorkoutSessions}
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span className="text-sm">Refresh</span>
                        </button>
                      </div>
                      */}
                    </>
                  )}
                  
                  <div className="flex justify-end mt-4">
                    {!loadingWorkoutSessions && (
                      <button 
                        className="px-4 py-2 bg-blue-700/80 hover:bg-blue-600/80 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        onClick={loadWorkoutSessions}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {hasLoadedWorkoutSessions ? 'Refresh' : 'Load Workout Sessions'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'betaApplications' ? (
              // Display Beta Applications Content
              <div className="mt-4">
                <div className="bg-[#1d2b3a] rounded-lg border border-green-800 p-6 animate-fade-in-up">
                                      <div className="flex items-center justify-between gap-3 mb-6">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-[#d7ff00]" />
                        <h3 className="text-lg font-medium text-white">Beta Applications Management</h3>
                      </div>
                    <div className="flex gap-2 text-sm">
                      <span className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full border border-blue-800">
                        Total: {betaApplications.length}
                      </span>
                      <span className="px-3 py-1 bg-orange-900/30 text-orange-300 rounded-full border border-orange-800">
                        Pending: {betaApplications.filter(a => a.status === 'pending').length}
                      </span>
                      <span className="px-3 py-1 bg-green-900/30 text-green-300 rounded-full border border-green-800">
                        Active: {betaApplications.filter(a => a.status === 'approved').length}
                      </span>
                    </div>
                  </div>

                  {loadingBetaApplications ? (
                    <div className="bg-[#262a30] rounded-lg p-8 flex flex-col items-center justify-center">
                      <svg className="animate-spin h-8 w-8 mb-4 text-[#d7ff00]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-gray-300">Loading beta applications...</p>
                    </div>
                  ) : betaApplicationsError ? (
                    <div className="bg-[#262a30] rounded-lg p-6">
                      <div className="flex items-start gap-3 text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-800">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium mb-1">Failed to load beta applications</p>
                          <p className="text-sm text-red-300">{betaApplicationsError}</p>
                        </div>
                      </div>
                    </div>
                  ) : betaApplications.length === 0 ? (
                    <div className="bg-[#262a30] rounded-lg p-6 flex items-center justify-center">
                      <p className="text-gray-400 italic">No beta applications found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-[#262a30] rounded-lg overflow-hidden">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="py-3 px-4 text-left text-gray-300 font-medium">Email</th>
                            <th className="py-3 px-4 text-left text-gray-300 font-medium">Name</th>
                            <th className="py-3 px-4 text-left text-gray-300 font-medium">Status</th>
                            <th className="py-3 px-4 text-left text-gray-300 font-medium">Requested</th>
                            <th className="py-3 px-4 text-center text-gray-300 font-medium">Actions</th>
                            <th className="py-3 px-4 text-center text-gray-300 font-medium">View</th>
                          </tr>
                        </thead>
                        <tbody>
                          {betaApplications.map((application) => (
                            <React.Fragment key={application.id}>
                              <tr className={`hover:bg-[#2a2f36] transition-colors ${selectedBetaApplication?.id === application.id ? 'bg-[#1d2b3a]' : ''}`}>
                                <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{application.email}</td>
                                <td className="py-3 px-4 border-b border-gray-700 text-gray-300">{application.name || '-'}</td>
                                <td className="py-3 px-4 border-b border-gray-700">
                                  {application.status === 'pending' && (
                                    <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded-full text-xs font-medium border border-orange-900">Pending</span>
                                  )}
                                  {application.status === 'approved' && (
                                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900">Approved</span>
                                  )}
                                  {application.status === 'rejected' && (
                                    <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">Rejected</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 border-b border-gray-700 text-gray-300 text-sm">
                                  {formatDate(application.submittedAt)}
                                </td>
                                <td className="py-3 px-4 border-b border-gray-700 text-center">
                                  <div className="flex gap-1 justify-center">
                                    {application.status === 'pending' && (
                                      <>
                    <button 
                                          onClick={() => handleUpdateApplicationStatus(application.id || '', 'approved')}
                                          disabled={processingApplicationStatus === application.id}
                                          className="px-2 py-1 bg-green-900/30 text-green-400 hover:bg-green-900/50 rounded text-xs font-medium border border-green-900 transition-colors"
                                        >
                                          {processingApplicationStatus === application.id ? '...' : 'Approve'}
                                        </button>
                                        <button
                                          onClick={() => handleDeleteApplication(application.id || '', application.email || '')}
                                          disabled={processingApplicationStatus === application.id}
                                          className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded text-xs font-medium border border-red-900 transition-colors"
                                        >
                                          {processingApplicationStatus === application.id ? '...' : 'Reject'}
                                        </button>
                                      </>
                                    )}
                                    {application.status === 'approved' && (
                                      <button
                                        onClick={() => handleUpdateApplicationStatus(application.id || '', 'rejected')}
                                        disabled={processingApplicationStatus === application.id}
                                        className="px-2 py-1 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded text-xs font-medium border border-red-900 transition-colors"
                                      >
                                        {processingApplicationStatus === application.id ? '...' : 'Revoke'}
                    </button>
                                    )}
                                    {application.status === 'rejected' && (
                                      <button
                                        onClick={() => handleUpdateApplicationStatus(application.id || '', 'approved')}
                                        disabled={processingApplicationStatus === application.id}
                                        className="px-2 py-1 bg-green-900/30 text-green-400 hover:bg-green-900/50 rounded text-xs font-medium border border-green-900 transition-colors"
                                      >
                                        {processingApplicationStatus === application.id ? '...' : 'Approve'}
                                      </button>
                                    )}
                  </div>
                                </td>
                                <td className="py-3 px-4 border-b border-gray-700 text-center">
                                  <button
                                    onClick={() => setSelectedBetaApplication(selectedBetaApplication?.id === application.id ? null : application)}
                                    className={`px-2 py-1 rounded-lg text-xs font-medium border hover:bg-blue-800/40 transition-colors flex items-center mx-auto ${
                                      selectedBetaApplication?.id === application.id 
                                        ? 'bg-blue-800/50 text-blue-300 border-blue-900' 
                                        : 'bg-blue-900/30 text-blue-400 border-blue-900'
                                    }`}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    {selectedBetaApplication?.id === application.id ? 'Hide' : 'View'}
                                  </button>
                                </td>
                              </tr>
                              {selectedBetaApplication?.id === application.id && (
                                <tr>
                                  <td colSpan={7} className="p-0 border-b border-gray-700">
                                    <div className="bg-[#1a1e24] p-6 border-l-4 border-[#d7ff00]">
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-white font-medium">Application Details</h4>
                                        <button
                                          onClick={() => handleDeleteApplication(application.id || '', application.email || '')}
                                          disabled={processingApplicationStatus === application.id}
                                          className="px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg text-xs font-medium border border-red-900 transition flex items-center"
                                        >
                                          {processingApplicationStatus === application.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="text-gray-400">Email:</span>
                                          <span className="text-white ml-2">{application.email}</span>
                      </div>
                                        <div>
                                          <span className="text-gray-400">Name:</span>
                                          <span className="text-white ml-2">{application.name || 'Not provided'}</span>
                      </div>
                                        <div>
                                          <span className="text-gray-400">Status:</span>
                                          <span className="text-white ml-2">{application.status}</span>
                                        </div>
                                        
                                        <div>
                                          <span className="text-gray-400">Years Experience:</span>
                                          <span className="text-white ml-2">{application.yearsExperience || 'Not provided'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Certified:</span>
                                          <span className="text-white ml-2">{application.isCertified ? 'Yes' : 'No'}</span>
                                        </div>
                                        {application.certificationName && (
                                          <div>
                                            <span className="text-gray-400">Certification:</span>
                                            <span className="text-white ml-2">{application.certificationName}</span>
                                          </div>
                                        )}
                                        <div className="md:col-span-2">
                                          <span className="text-gray-400">Use Cases:</span>
                                          <span className="text-white ml-2">{formatUseCasesField(application.useCases)}</span>
                                        </div>
                                        <div className="md:col-span-2">
                                          <span className="text-gray-400">Long Term Goal:</span>
                                          <span className="text-white ml-2">{application.longTermGoal || 'Not provided'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Founding Coaches:</span>
                                          <span className="text-white ml-2">{application.applyForFoundingCoaches ? 'Yes' : 'No'}</span>
                                        </div>
                                        {application.approvedBy && (
                                          <div>
                                            <span className="text-gray-400">Approved By:</span>
                                            <span className="text-white ml-2">{application.approvedBy}</span>
                                          </div>
                                        )}
                                        {application.approvedAt && (
                                          <div>
                                            <span className="text-gray-400">Approved At:</span>
                                            <span className="text-white ml-2">{formatDate(application.approvedAt)}</span>
                                          </div>
                                        )}
                                        <div>
                                          <span className="text-gray-400">Primary Use:</span>
                                          <span className="text-white ml-2">{application.primaryUse || 'Not provided'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Client Count:</span>
                                          <span className="text-white ml-2">{application.clientCount || 'Not provided'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Status:</span>
                                          <span className="text-white ml-2">{application.status}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-400">Role:</span>
                                          <span className="text-white ml-2">{formatRoleField(application.role)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'logs' ? (
              // Display Logs Content (existing logs content)
              <div>Logs content...</div>
            ) : (
              // Display Users Table for 'all' and 'admins' tabs
                      <div className="overflow-x-auto">
                <table className={`min-w-full bg-[#262a30] rounded-lg overflow-hidden ${isBatchDeleting ? 'opacity-60 pointer-events-none' : ''}`}>
                          <thead>
                            <tr className="border-b border-gray-700">
                      {/* Conditional Checkbox Header */}
                      {isSelectingForDelete && (
                          <th className="py-3 px-4 text-center w-12">
                              <input
                                  type="checkbox"
                                  className="form-checkbox h-4 w-4 text-[#d7ff00] bg-gray-800 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-offset-0"
                                  checked={areAllVisibleSelected}
                                  onChange={handleSelectAllVisibleChange}
                                  title="Select/Deselect all visible users"
                                  disabled={isBatchDeleting}
                              />
                          </th>
                      )}
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
                          {/* Conditional Checkbox Cell */}
                          {isSelectingForDelete && (
                              <td className="py-3 px-4 border-b border-gray-700 text-center">
                                  <input
                                      type="checkbox"
                                      className="form-checkbox h-4 w-4 text-[#d7ff00] bg-gray-800 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-offset-0"
                                      checked={selectedUserIds.has(user.id)}
                                      onChange={() => handleUserCheckboxChange(user.id)}
                                      disabled={isBatchDeleting}
                                  />
                              </td>
                          )}
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
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => toggleAdminStatus(user)}
                                disabled={!user.email || processingAdmin === user.email}
                                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
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
                              <button
                                onClick={() => handleAddTo100Trainers(user)}
                                disabled={processingAdd100Trainers === user.id || !user.email}
                                className="px-2 py-1 rounded-md text-xs font-medium transition-colors bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Add ${user.username || user.email} to 100trainers program`}
                              >
                                {processingAdd100Trainers === user.id ? (
                                  <svg className="animate-spin h-3 w-3 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <Users className="h-3 w-3" />
                                )}
                              </button>
                              <button
                                onClick={() => handleRemoteLogin(user)}
                                disabled={processingRemoteLogin === user.id || !user.email}
                                className="px-2 py-1 rounded-md text-xs font-medium transition-colors bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 border border-purple-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Remote login as ${user.username || user.email}`}
                              >
                                {processingRemoteLogin === user.id ? (
                                  <svg className="animate-spin h-3 w-3 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <LogIn className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                                  </td>
                          <td className="py-3 px-4 border-b border-gray-700 text-center">
                                    <button
                              onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                                      className={`px-2 py-1 rounded-lg text-xs font-medium border hover:bg-blue-800/40 transition-colors flex items-center mx-auto ${ 
                                selectedUser?.id === user.id 
                                          ? 'bg-blue-800/50 text-blue-300 border-blue-900' 
                                          : 'bg-blue-900/30 text-blue-400 border-blue-900'
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
                            <td colSpan={isSelectingForDelete ? 8 : 7} className="p-0 border-b border-gray-700">
                              {renderUserDetails(user)}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification with updated styling */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 py-2 px-4 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in-up z-50 ${
          toastMessage.type === 'success' 
            ? 'bg-green-800/90 border border-green-700 text-white' 
            : toastMessage.type === 'error'
              ? 'bg-red-800/90 border border-red-700 text-white'
              : 'bg-blue-800/90 border border-blue-700 text-white'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-300" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-300" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Username Migration Modal */}
      {showUsernameMigrationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1d2b3a] rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                  Username Migration Tool
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Found {usersWithBadUsernames.length} user{usersWithBadUsernames.length !== 1 ? 's' : ''} with invalid usernames
                </p>
              </div>
              <button 
                onClick={() => setShowUsernameMigrationModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
                disabled={migratingUsernames}
              >
                ✕
              </button>
            </div>

            {/* Migration Progress */}
            {migratingUsernames && (
              <div className="mb-4 p-4 bg-amber-900/20 rounded-lg border border-amber-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-amber-300 font-medium">Migration in progress...</span>
                  <span className="text-amber-300">{migrationProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${migrationProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Results Summary */}
            {migrationResults.success > 0 || migrationResults.failed > 0 || migrationResults.skipped > 0 ? (
              <div className="mb-4 p-4 bg-gray-800/50 rounded-lg flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{migrationResults.success}</div>
                  <div className="text-xs text-gray-400">Fixed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{migrationResults.failed}</div>
                  <div className="text-xs text-gray-400">Failed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-400">{migrationResults.skipped}</div>
                  <div className="text-xs text-gray-400">Skipped</div>
                </div>
              </div>
            ) : null}

            {/* Users List */}
            <div className="flex-1 overflow-y-auto mb-4">
              {usersWithBadUsernames.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-green-400 font-medium">All usernames are valid!</p>
                  <p className="text-gray-400 text-sm mt-2">No migration needed.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1d2b3a]">
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">User</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Current Username</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">→</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Corrected Username</th>
                      <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersWithBadUsernames.map((user) => {
                      const corrected = getCorrectedUsername(user.username);
                      const hasSpaces = user.username.includes(' ');
                      const hasSpecialChars = /[^a-zA-Z0-9_.-]/.test(user.username.replace(/ /g, ''));
                      const hasUppercase = user.username !== user.username.toLowerCase();
                      const tooShort = corrected.length < 3;
                      
                      return (
                        <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-4">
                            <div>
                              <div className="text-white font-medium">{user.displayName || 'No display name'}</div>
                              <div className="text-gray-500 text-xs">{user.email}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <code className="bg-red-900/30 text-red-300 px-2 py-1 rounded text-sm border border-red-800">
                              {user.username}
                            </code>
                          </td>
                          <td className="py-3 px-4 text-gray-500">→</td>
                          <td className="py-3 px-4">
                            {tooShort ? (
                              <span className="text-yellow-400 text-sm">⚠️ Too short after fix</span>
                            ) : (
                              <code className="bg-green-900/30 text-green-300 px-2 py-1 rounded text-sm border border-green-800">
                                {corrected}
                              </code>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {hasSpaces && (
                                <span className="px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded text-xs">spaces</span>
                              )}
                              {hasSpecialChars && (
                                <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs">special chars</span>
                              )}
                              {hasUppercase && (
                                <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs">uppercase</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                This will update usernames in the database and usernames collection.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUsernameMigrationModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                  disabled={migratingUsernames}
                >
                  Cancel
                </button>
                {usersWithBadUsernames.length > 0 && (
                  <button
                    onClick={migrateUsernames}
                    disabled={migratingUsernames}
                    className={`px-4 py-2 bg-amber-600 text-white rounded-lg font-medium transition flex items-center gap-2
                      ${migratingUsernames ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-500'}`}
                  >
                    {migratingUsernames ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Migrating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Correct {usersWithBadUsernames.length} Username{usersWithBadUsernames.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Username Diagnostics Modal */}
      {showDiagnosticsModal && diagnosticResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1d2b3a] rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Search className="h-6 w-6 text-cyan-500" />
                  Username Diagnostics Results
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Found {diagnosticResults.duplicateUsernames.length + diagnosticResults.orphanedUsernamesDocs.length + 
                         diagnosticResults.usersWithoutUsernameDoc.length + diagnosticResults.mismatchedUserIds.length} issues
                </p>
              </div>
              <button 
                onClick={() => setShowDiagnosticsModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Results Summary */}
            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg flex gap-6 flex-wrap">
              <div className="text-center min-w-[100px]">
                <div className={`text-2xl font-bold ${diagnosticResults.duplicateUsernames.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {diagnosticResults.duplicateUsernames.length}
                </div>
                <div className="text-xs text-gray-400">Duplicate Usernames</div>
              </div>
              <div className="text-center min-w-[100px]">
                <div className={`text-2xl font-bold ${diagnosticResults.mismatchedUserIds.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {diagnosticResults.mismatchedUserIds.length}
                </div>
                <div className="text-xs text-gray-400">Mismatched IDs</div>
              </div>
              <div className="text-center min-w-[100px]">
                <div className={`text-2xl font-bold ${diagnosticResults.usersWithoutUsernameDoc.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {diagnosticResults.usersWithoutUsernameDoc.length}
                </div>
                <div className="text-xs text-gray-400">Missing Username Docs</div>
              </div>
              <div className="text-center min-w-[100px]">
                <div className={`text-2xl font-bold ${diagnosticResults.orphanedUsernamesDocs.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {diagnosticResults.orphanedUsernamesDocs.length}
                </div>
                <div className="text-xs text-gray-400">Orphaned Docs</div>
              </div>
            </div>

            {/* Results Details */}
            <div className="flex-1 overflow-y-auto space-y-6">
              {/* Mismatched User IDs - Most Critical */}
              {diagnosticResults.mismatchedUserIds.length > 0 && (
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-800">
                  <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Mismatched User IDs (CRITICAL)
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    These usernames have documents pointing to different users than expected. This causes profile lookup issues!
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-red-800">
                        <th className="text-left py-2 px-2 text-gray-400">Username</th>
                        <th className="text-left py-2 px-2 text-gray-400">Username Doc Points To</th>
                        <th className="text-left py-2 px-2 text-gray-400">Actual User ID</th>
                        <th className="text-left py-2 px-2 text-gray-400">Email</th>
                        <th className="text-left py-2 px-2 text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosticResults.mismatchedUserIds.map((item, idx) => (
                        <tr key={idx} className="border-b border-red-900/30">
                          <td className="py-2 px-2">
                            <code className="bg-red-900/30 px-2 py-0.5 rounded text-red-300">{item.username}</code>
                          </td>
                          <td className="py-2 px-2 text-red-400 font-mono text-xs">{item.usernameDocUserId.slice(0, 12)}...</td>
                          <td className="py-2 px-2 text-green-400 font-mono text-xs">{item.actualUserId.slice(0, 12)}...</td>
                          <td className="py-2 px-2 text-gray-300">{item.email}</td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => repairUsernameConnection(item.actualUserId, item.username)}
                              className="px-2 py-1 bg-green-700 text-white rounded text-xs hover:bg-green-600 transition"
                            >
                              Fix Connection
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Duplicate Usernames */}
              {diagnosticResults.duplicateUsernames.length > 0 && (
                <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-800">
                  <h3 className="text-purple-400 font-bold mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Duplicate Usernames ({diagnosticResults.duplicateUsernames.length})
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    Multiple users have the same username. Click "Keep" on the user who should keep this username. Others will get a new unique username.
                  </p>
                  {diagnosticResults.duplicateUsernames.map((dup, idx) => (
                    <div key={idx} className="mb-4 p-4 bg-gray-800/50 rounded border border-purple-900/30">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <code className="text-purple-300 font-bold text-lg">{dup.username}</code>
                          <span className="text-gray-400 ml-2">({dup.users.length} users claiming this)</span>
                        </div>
                        {resolvingDuplicate === dup.username && (
                          <div className="flex items-center gap-2 text-purple-400">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Resolving...
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {dup.users.map((u, uidx) => (
                          <div key={uidx} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">{u.id.slice(0, 12)}...</span>
                                <span className={`font-medium ${u.displayName ? 'text-white' : 'text-gray-500 italic'}`}>
                                  {u.displayName || 'No display name'}
                                </span>
                              </div>
                              <div className="text-gray-400 text-sm mt-1">{u.email}</div>
                            </div>
                            <button
                              onClick={() => {
                                const otherIds = dup.users.filter(other => other.id !== u.id).map(other => other.id);
                                resolveDuplicateUsername(dup.username, u.id, otherIds);
                              }}
                              disabled={resolvingDuplicate !== null}
                              className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium transition flex items-center gap-2
                                ${resolvingDuplicate !== null ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-500'}`}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Keep This User
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-gray-500 text-xs mt-2 italic">
                        The user you select will keep "{dup.username}". Others will be assigned "{dup.username}1", "{dup.username}2", etc.
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Users Without Username Document */}
              {diagnosticResults.usersWithoutUsernameDoc.length > 0 && (
                <div className="bg-amber-900/20 rounded-lg p-4 border border-amber-800">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-amber-400 font-bold flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Users Without Username Document ({diagnosticResults.usersWithoutUsernameDoc.length})
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        These users have usernames but no corresponding document in the usernames collection.
                      </p>
                    </div>
                    <button
                      onClick={batchFixMissingUsernameDocs}
                      disabled={batchRepairing}
                      className={`px-4 py-2 bg-amber-600 text-white rounded-lg font-medium transition flex items-center gap-2
                        ${batchRepairing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-500'}`}
                    >
                      {batchRepairing ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Fixing... {batchRepairProgress}%
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Fix All ({diagnosticResults.usersWithoutUsernameDoc.length})
                        </>
                      )}
                    </button>
                  </div>
                  {batchRepairing && (
                    <div className="mb-3">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${batchRepairProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-800">
                        <th className="text-left py-2 px-2 text-gray-400">Username</th>
                        <th className="text-left py-2 px-2 text-gray-400">User ID</th>
                        <th className="text-left py-2 px-2 text-gray-400">Email</th>
                        <th className="text-left py-2 px-2 text-gray-400">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosticResults.usersWithoutUsernameDoc.map((item, idx) => (
                        <tr key={idx} className="border-b border-amber-900/30">
                          <td className="py-2 px-2">
                            <code className="bg-amber-900/30 px-2 py-0.5 rounded text-amber-300">{item.username}</code>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs text-gray-400">{item.id.slice(0, 12)}...</td>
                          <td className="py-2 px-2 text-gray-300">{item.email}</td>
                          <td className="py-2 px-2">
                            <button
                              onClick={() => repairUsernameConnection(item.id, item.username)}
                              className="px-2 py-1 bg-amber-700 text-white rounded text-xs hover:bg-amber-600 transition"
                            >
                              Create Doc
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Orphaned Username Documents */}
              {diagnosticResults.orphanedUsernamesDocs.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-gray-400 font-bold mb-3 flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Orphaned Username Documents
                  </h3>
                  <p className="text-gray-400 text-sm mb-3">
                    These username documents point to user IDs that no longer exist.
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-2 text-gray-400">Username Doc</th>
                        <th className="text-left py-2 px-2 text-gray-400">Points To (Non-existent)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosticResults.orphanedUsernamesDocs.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-800">
                          <td className="py-2 px-2">
                            <code className="bg-gray-700 px-2 py-0.5 rounded text-gray-300">{item.username}</code>
                          </td>
                          <td className="py-2 px-2 font-mono text-xs text-red-400">{item.userId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* No Issues Found */}
              {diagnosticResults.duplicateUsernames.length === 0 && 
               diagnosticResults.mismatchedUserIds.length === 0 &&
               diagnosticResults.usersWithoutUsernameDoc.length === 0 &&
               diagnosticResults.orphanedUsernamesDocs.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <p className="text-green-400 font-medium">All username connections are healthy!</p>
                  <p className="text-gray-400 text-sm mt-2">No issues found in the username system.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-700 mt-4">
              <button
                onClick={runUsernameDiagnostics}
                className="px-4 py-2 bg-cyan-700 text-white rounded-lg hover:bg-cyan-600 transition flex items-center gap-2"
                disabled={runningDiagnostics}
              >
                <Search className="h-4 w-4" />
                Re-run Diagnostics
              </button>
              <button
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default UsersManagement; 