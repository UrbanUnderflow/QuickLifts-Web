import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Users,
  UserCheck,
  UserX,
  Loader2,
  Search,
  Copy,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
  Mail,
  Settings,
  Check,
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

// Define all available sections
const INVESTOR_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'product', label: 'Product' },
  { id: 'traction', label: 'Traction' },
  { id: 'ip', label: 'IP & Moats' },
  { id: 'vision', label: 'Vision' },
  { id: 'market', label: 'Market' },
  { id: 'techstack', label: 'Tech Stack' },
  { id: 'team', label: 'Team' },
  { id: 'financials', label: 'Financials' },
  { id: 'captable', label: 'Cap Table' },
  { id: 'deck', label: 'Pitch Deck' },
  { id: 'investment', label: 'Investment' },
  { id: 'documents', label: 'All Documents' },
] as const;

type SectionId = typeof INVESTOR_SECTIONS[number]['id'];

interface SectionAccess {
  overview: boolean;
  product: boolean;
  traction: boolean;
  ip: boolean;
  vision: boolean;
  market: boolean;
  techstack: boolean;
  team: boolean;
  financials: boolean;
  captable: boolean;
  deck: boolean;
  investment: boolean;
  documents: boolean;
}

const DEFAULT_SECTION_ACCESS: SectionAccess = {
  overview: true,
  product: true,
  traction: true,
  ip: true,
  vision: true,
  market: true,
  techstack: true,
  team: true,
  financials: true,
  captable: true,
  deck: true,
  investment: true,
  documents: true,
};

interface InvestorAccess {
  id: string;
  email: string;
  name?: string;
  company?: string;
  isApproved: boolean;
  sectionAccess?: SectionAccess;
  createdAt: any;
  updatedAt?: any;
  notes?: string;
}

const InvestorAccessPage: React.FC = () => {
  const [accessList, setAccessList] = useState<InvestorAccess[]>([]);
  const [filteredList, setFilteredList] = useState<InvestorAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<InvestorAccess | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sendEmail, setSendEmail] = useState(true); // Checkbox state for sending email
  
  // New user form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newSectionAccess, setNewSectionAccess] = useState<SectionAccess>({ ...DEFAULT_SECTION_ACCESS });
  
  // Edit form state
  const [editSectionAccess, setEditSectionAccess] = useState<SectionAccess>({ ...DEFAULT_SECTION_ACCESS });

  useEffect(() => {
    fetchAccessList();
  }, []);

  useEffect(() => {
    filterList();
  }, [accessList, searchTerm]);

  const fetchAccessList = async () => {
    setLoading(true);
    try {
      const accessRef = collection(db, 'investorAccess');
      const q = query(accessRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const users: InvestorAccess[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as InvestorAccess));
      
      setAccessList(users);
    } catch (error) {
      console.error('Error fetching investor access list:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterList = () => {
    if (!searchTerm) {
      setFilteredList(accessList);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const filtered = accessList.filter(user => 
      user.email?.toLowerCase().includes(term) || 
      user.name?.toLowerCase().includes(term) ||
      user.company?.toLowerCase().includes(term)
    );
    setFilteredList(filtered);
  };

  const resetAddForm = () => {
    setNewEmail('');
    setNewName('');
    setNewCompany('');
    setNewNotes('');
    setNewSectionAccess({ ...DEFAULT_SECTION_ACCESS });
    setSendEmail(true);
    setEmailStatus('idle');
  };

  const handleAddUser = async () => {
    if (!newEmail.trim()) return;
    
    setIsModalLoading(true);
    setEmailStatus('idle');
    try {
      const accessRef = collection(db, 'investorAccess');
      await addDoc(accessRef, {
        email: newEmail.toLowerCase().trim(),
        name: newName.trim() || null,
        company: newCompany.trim() || null,
        notes: newNotes.trim() || null,
        isApproved: true,
        sectionAccess: newSectionAccess,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Send access notification email if checkbox is checked
      if (sendEmail) {
        setEmailStatus('sending');
        try {
          const emailResponse = await fetch('/.netlify/functions/send-investor-access-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: newEmail.toLowerCase().trim(),
              name: newName.trim() || null,
            }),
          });
          
          if (emailResponse.ok) {
            setEmailStatus('sent');
          } else {
            console.error('Failed to send access email');
            setEmailStatus('error');
          }
        } catch (emailError) {
          console.error('Error sending access email:', emailError);
          setEmailStatus('error');
        }
      }
      
      resetAddForm();
      setShowAddModal(false);
      fetchAccessList();
    } catch (error) {
      console.error('Error adding investor access:', error);
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleOpenEditModal = (user: InvestorAccess) => {
    setSelectedUser(user);
    setEditSectionAccess(user.sectionAccess || { ...DEFAULT_SECTION_ACCESS });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    
    setIsModalLoading(true);
    try {
      const userRef = doc(db, 'investorAccess', selectedUser.id);
      await updateDoc(userRef, {
        sectionAccess: editSectionAccess,
        updatedAt: new Date()
      });
      
      // Update local state
      setAccessList(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, sectionAccess: editSectionAccess, updatedAt: new Date() } 
          : user
      ));
      
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating section access:', error);
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleToggleApproval = (user: InvestorAccess) => {
    setSelectedUser(user);
    setShowConfirmModal(true);
  };

  const handleConfirmToggle = async () => {
    if (!selectedUser) return;
    
    setIsModalLoading(true);
    try {
      const newApprovalStatus = !selectedUser.isApproved;
      const userRef = doc(db, 'investorAccess', selectedUser.id);
      await updateDoc(userRef, {
        isApproved: newApprovalStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setAccessList(prev => prev.map(user => 
        user.id === selectedUser.id 
          ? { ...user, isApproved: newApprovalStatus, updatedAt: new Date() } 
          : user
      ));
      
      setShowConfirmModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating approval status:', error);
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleDeleteUser = (user: InvestorAccess) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    
    setIsModalLoading(true);
    try {
      const userRef = doc(db, 'investorAccess', selectedUser.id);
      await deleteDoc(userRef);
      
      // Update local state
      setAccessList(prev => prev.filter(user => user.id !== selectedUser.id));
      
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
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
      if (date && typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      }
      
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const countEnabledSections = (access?: SectionAccess): number => {
    if (!access) return INVESTOR_SECTIONS.length; // Default to all if not set
    return Object.values(access).filter(Boolean).length;
  };

  const toggleAllSections = (value: boolean, setter: React.Dispatch<React.SetStateAction<SectionAccess>>) => {
    const newAccess: SectionAccess = {} as SectionAccess;
    INVESTOR_SECTIONS.forEach(section => {
      newAccess[section.id] = value;
    });
    setter(newAccess);
  };

  // Render section checkboxes inline (not as a separate component to avoid re-render issues)
  const renderSectionCheckboxes = (
    currentAccess: SectionAccess,
    setAccess: React.Dispatch<React.SetStateAction<SectionAccess>>
  ) => {
    const enabledCount = countEnabledSections(currentAccess);
    const allEnabled = enabledCount === INVESTOR_SECTIONS.length;
    const noneEnabled = enabledCount === 0;

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-zinc-400 text-sm">Section Access</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleAllSections(true, setAccess)}
              className={`text-xs px-2 py-1 rounded ${allEnabled ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => toggleAllSections(false, setAccess)}
              className={`text-xs px-2 py-1 rounded ${noneEnabled ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
            >
              None
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-700/50 rounded-lg max-h-64 overflow-y-auto">
          {INVESTOR_SECTIONS.map(section => (
            <label
              key={section.id}
              className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-zinc-700 transition-colors"
              onClick={() => {
                setAccess(prev => ({
                  ...prev,
                  [section.id]: !prev[section.id]
                }));
              }}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                  currentAccess[section.id]
                    ? 'bg-[#E0FE10] border-[#E0FE10]'
                    : 'border-zinc-500 bg-transparent'
                }`}
              >
                {currentAccess[section.id] && <Check size={14} className="text-black" />}
              </div>
              <span className="text-white text-sm">{section.label}</span>
            </label>
          ))}
        </div>
        <p className="text-zinc-500 text-xs mt-2">
          {enabledCount} of {INVESTOR_SECTIONS.length} sections enabled
        </p>
      </div>
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Investor Access | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-zinc-900 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-white text-2xl font-bold">Investor Dataroom Access</h1>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-[#E0FE10] text-black font-medium rounded-lg hover:bg-[#d8f521] transition-colors"
            >
              <Plus size={18} className="mr-2" />
              Grant Access
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Total Granted</div>
              <div className="text-white text-2xl font-bold">{accessList.length}</div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Active Access</div>
              <div className="text-green-500 text-2xl font-bold">
                {accessList.filter(u => u.isApproved).length}
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Revoked</div>
              <div className="text-red-500 text-2xl font-bold">
                {accessList.filter(u => !u.isApproved).length}
              </div>
            </div>
          </div>

          {/* Search and Refresh */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by email, name, or company..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
              </div>
              
              <button
                onClick={fetchAccessList}
                className="flex items-center px-3 py-2 rounded-md bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
                title="Refresh data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span className="ml-2">Refresh</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-zinc-700 text-white text-left">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Sections</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                        <Loader2 className="animate-spin mx-auto mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                        {searchTerm ? 'No matching users found' : 'No investors have been granted access yet'}
                      </td>
                    </tr>
                  ) : (
                    filteredList.map(user => (
                      <tr key={user.id} className="text-white hover:bg-zinc-700/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <Mail size={14} className="text-zinc-500 mr-2" />
                            {user.email}
                            <button 
                              onClick={() => copyToClipboard(user.email)} 
                              className="ml-2 text-zinc-400 hover:text-zinc-200"
                              title="Copy email"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{user.name || '—'}</td>
                        <td className="px-4 py-3 text-zinc-300">{user.company || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${countEnabledSections(user.sectionAccess) === INVESTOR_SECTIONS.length ? 'text-green-400' : 'text-amber-400'}`}>
                            {countEnabledSections(user.sectionAccess)}/{INVESTOR_SECTIONS.length}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-400 text-sm">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          {user.isApproved ? (
                            <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-500 text-xs font-medium">
                              Revoked
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20"
                              title="Edit section access"
                            >
                              <Settings size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleApproval(user)}
                              className={`p-1.5 rounded ${
                                user.isApproved
                                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                  : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                              }`}
                              title={user.isApproved ? 'Revoke access' : 'Grant access'}
                            >
                              {user.isApproved ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 rounded bg-zinc-600/50 text-zinc-400 hover:bg-zinc-600 hover:text-white"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Grant Investor Access</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-sm mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="investor@example.com"
                  className="w-full px-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
              </div>
              
              <div>
                <label className="block text-zinc-400 text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full px-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
              </div>
              
              <div>
                <label className="block text-zinc-400 text-sm mb-1">Company</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Venture Capital LLC"
                  className="w-full px-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
              </div>
              
              {renderSectionCheckboxes(newSectionAccess, setNewSectionAccess)}
              
              <div>
                <label className="block text-zinc-400 text-sm mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Optional notes about this investor..."
                  rows={2}
                  className="w-full px-4 py-2 rounded-md bg-zinc-700 text-white border border-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#E0FE10] resize-none"
                />
              </div>
              
              {/* Send Email Checkbox */}
              <div 
                className="flex items-center gap-3 p-3 bg-zinc-700/50 rounded-lg cursor-pointer hover:bg-zinc-700 transition-colors"
                onClick={() => setSendEmail(!sendEmail)}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                    sendEmail
                      ? 'bg-[#E0FE10] border-[#E0FE10]'
                      : 'border-zinc-500 bg-transparent'
                  }`}
                >
                  {sendEmail && <Check size={14} className="text-black" />}
                </div>
                <div>
                  <span className="text-white text-sm font-medium">Send access notification email</span>
                  <p className="text-zinc-500 text-xs mt-0.5">Email will include dataroom link and access instructions</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 transition-colors"
                disabled={isModalLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="flex-1 px-4 py-2 rounded-lg bg-[#E0FE10] text-black font-medium hover:bg-[#d8f521] transition-colors flex items-center justify-center"
                disabled={isModalLoading || !newEmail.trim()}
              >
                {isModalLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  'Grant Access'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Access Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-2">Edit Section Access</h3>
            <p className="text-zinc-400 text-sm mb-4">{selectedUser.email}</p>
            
            {renderSectionCheckboxes(editSectionAccess, setEditSectionAccess)}
            
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 transition-colors"
                disabled={isModalLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 rounded-lg bg-[#E0FE10] text-black font-medium hover:bg-[#d8f521] transition-colors flex items-center justify-center"
                disabled={isModalLoading}
              >
                {isModalLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Confirmation Modal */}
      {showConfirmModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-amber-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {selectedUser.isApproved ? 'Revoke Access' : 'Grant Access'}
              </h3>
              <p className="text-zinc-400 text-center mb-6">
                {selectedUser.isApproved
                  ? `Are you sure you want to revoke investor dataroom access for ${selectedUser.email}?`
                  : `Are you sure you want to grant investor dataroom access to ${selectedUser.email}?`}
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
                    'Grant Access'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Delete Access Record</h3>
              <p className="text-zinc-400 text-center mb-6">
                Are you sure you want to permanently delete the access record for {selectedUser.email}? This action cannot be undone.
              </p>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedUser(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-zinc-600 text-white hover:bg-zinc-700 transition-colors"
                  disabled={isModalLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center justify-center"
                  disabled={isModalLoading}
                >
                  {isModalLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default InvestorAccessPage;
