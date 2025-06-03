import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { auth } from '../../api/firebase/config';
import { CheckCircle, XCircle, Clock, Trash2, Eye, EyeOff, Code, Users, Shield, AlertCircle } from 'lucide-react';
import { adminMethods } from '../../api/firebase/admin/methods';
import { ProgrammingAccess } from '../../api/firebase/admin/types';

const ProgrammingAccessManagement: React.FC = () => {
  const [programmingAccessRequests, setProgrammingAccessRequests] = useState<ProgrammingAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAccessStatus, setProcessingAccessStatus] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProgrammingAccess | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'requested' | 'active' | 'deactivated'>('all');

  // Load programming access requests
  const loadProgrammingAccessRequests = async () => {
    try {
      setLoading(true);
      const requests = await adminMethods.getProgrammingAccessRequests();
      setProgrammingAccessRequests(requests);
    } catch (error) {
      console.error('Error loading programming access requests:', error);
      setToastMessage({ type: 'error', text: 'Failed to load programming access requests' });
    } finally {
      setLoading(false);
    }
  };

  // Handle programming access status updates
  const handleUpdateAccessStatus = async (id: string, status: 'active' | 'deactivated') => {
    try {
      setProcessingAccessStatus(id);
      
      const currentUser = auth.currentUser;
      const approvedBy = currentUser?.email || 'Unknown Admin';
      
      const success = await adminMethods.updateProgrammingAccessStatus(id, status, approvedBy);
      
      if (success) {
        setToastMessage({ 
          type: 'success', 
          text: `Access ${status === 'active' ? 'approved' : 'deactivated'} successfully` 
        });
        // Reload the requests to show updated status
        await loadProgrammingAccessRequests();
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating access status:', error);
      setToastMessage({ 
        type: 'error', 
        text: `Failed to ${status === 'active' ? 'approve' : 'deactivate'} access` 
      });
    } finally {
      setProcessingAccessStatus(null);
    }
  };

  // Handle deleting programming access requests
  const handleDeleteAccessRequest = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to delete the programming access request for ${email}? This action cannot be undone.`)) {
      return;
    }

    try {
      setProcessingAccessStatus(id);
      
      const success = await adminMethods.deleteProgrammingAccessRequest(id);
      
      if (success) {
        setToastMessage({ 
          type: 'success', 
          text: 'Access request deleted successfully' 
        });
        // Reload the requests to show updated list
        await loadProgrammingAccessRequests();
        // Close details if this request was selected
        if (selectedRequest?.id === id) {
          setSelectedRequest(null);
        }
      } else {
        throw new Error('Failed to delete request');
      }
    } catch (error) {
      console.error('Error deleting access request:', error);
      setToastMessage({ 
        type: 'error', 
        text: 'Failed to delete access request' 
      });
    } finally {
      setProcessingAccessStatus(null);
    }
  };

  // Copy email to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setToastMessage({ type: 'success', text: 'Email copied to clipboard' });
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        setToastMessage({ type: 'error', text: 'Failed to copy email' });
      });
  };

  // Format date helper
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  // Filter requests based on search term and status
  const filteredRequests = programmingAccessRequests.filter(request => {
    const matchesSearch = !searchTerm || 
      request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return (
          <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-xs font-medium border border-yellow-900 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Requested
          </span>
        );
      case 'active':
        return (
          <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded-full text-xs font-medium border border-green-900 flex items-center">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </span>
        );
      case 'deactivated':
        return (
          <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900 flex items-center">
            <XCircle className="w-3 h-3 mr-1" />
            Deactivated
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-900/30 text-gray-400 rounded-full text-xs font-medium border border-gray-900">
            Unknown
          </span>
        );
    }
  };

  // Get role display
  const getRoleDisplay = (role?: ProgrammingAccess['role']) => {
    if (!role) return 'Not specified';
    
    const selectedRoles = Object.entries(role)
      .filter(([_, selected]) => selected)
      .map(([roleName, _]) => {
        switch (roleName) {
          case 'trainer': return 'Trainer';
          case 'enthusiast': return 'Enthusiast';
          case 'coach': return 'Coach';
          case 'fitnessInstructor': return 'Fitness Instructor';
          default: return roleName;
        }
      });
    
    return selectedRoles.length > 0 ? selectedRoles.join(', ') : 'Not specified';
  };

  // Get use cases display
  const getUseCasesDisplay = (useCases?: ProgrammingAccess['useCases']) => {
    if (!useCases) return 'Not specified';
    
    const selectedUseCases = Object.entries(useCases)
      .filter(([_, selected]) => selected)
      .map(([useCase, _]) => {
        switch (useCase) {
          case 'oneOnOneCoaching': return 'One-on-One Coaching';
          case 'communityRounds': return 'Community Rounds';
          case 'personalPrograms': return 'Personal Programs';
          default: return useCase;
        }
      });
    
    return selectedUseCases.length > 0 ? selectedUseCases.join(', ') : 'Not specified';
  };

  useEffect(() => {
    loadProgrammingAccessRequests();
  }, []);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#111417] text-white">
        <Head>
          <title>Programming Access Management - Pulse Admin</title>
        </Head>

        {/* Toast Message */}
        {toastMessage && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border animate-fade-in-up ${
            toastMessage.type === 'success' 
              ? 'bg-green-900/90 border-green-700 text-green-100' 
              : toastMessage.type === 'error'
              ? 'bg-red-900/90 border-red-700 text-red-100'
              : 'bg-blue-900/90 border-blue-700 text-blue-100'
          }`}>
            <div className="flex items-center">
              {toastMessage.type === 'success' && <CheckCircle className="w-5 h-5 mr-2" />}
              {toastMessage.type === 'error' && <XCircle className="w-5 h-5 mr-2" />}
              {toastMessage.type === 'info' && <AlertCircle className="w-5 h-5 mr-2" />}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <div className="container mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Code className="w-8 h-8 text-[#d7ff00] mr-3" />
              <div>
                <h1 className="text-3xl font-bold text-white">Programming Access Management</h1>
                <p className="text-gray-400 mt-1">Manage access requests for Pulse Programming</p>
              </div>
            </div>
            <button
              onClick={loadProgrammingAccessRequests}
              disabled={loading}
              className="px-4 py-2 bg-[#d7ff00] text-black rounded-lg font-medium hover:bg-[#c5df0e] transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-[#262a30] rounded-lg border border-gray-700 text-white placeholder:text-gray-500 focus:border-[#d7ff00] focus:outline-none"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="p-3 bg-[#262a30] rounded-lg border border-gray-700 text-white focus:border-[#d7ff00] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="requested">Requested</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Requests</p>
                  <p className="text-2xl font-bold text-white">{programmingAccessRequests.length}</p>
                </div>
                <Users className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {programmingAccessRequests.filter(r => r.status === 'requested').length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Active</p>
                  <p className="text-2xl font-bold text-green-400">
                    {programmingAccessRequests.filter(r => r.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Deactivated</p>
                  <p className="text-2xl font-bold text-red-400">
                    {programmingAccessRequests.filter(r => r.status === 'deactivated').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Requests List */}
            <div className="lg:col-span-2">
              <div className="bg-[#262a30] rounded-lg border border-gray-700">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold text-white">Access Requests</h2>
                  <p className="text-gray-400 text-sm">
                    Showing {filteredRequests.length} of {programmingAccessRequests.length} requests
                  </p>
                </div>
                
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d7ff00] mx-auto"></div>
                    <p className="text-gray-400 mt-2">Loading requests...</p>
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="p-8 text-center">
                    <Code className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No programming access requests found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-4 hover:bg-[#2a2f36] transition-colors cursor-pointer ${
                          selectedRequest?.id === request.id ? 'bg-[#1d2b3a] border-l-4 border-[#d7ff00]' : ''
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(request.email);
                                }}
                                className="text-blue-400 hover:text-blue-300 font-medium"
                                title="Click to copy email"
                              >
                                {request.email}
                              </button>
                              {getStatusBadge(request.status)}
                            </div>
                            <div className="text-sm text-gray-400">
                              <p>{request.name || 'No name provided'}</p>
                              <p>Requested: {formatDate(request.createdAt)}</p>
                              {request.approvedAt && (
                                <p>Approved: {formatDate(request.approvedAt)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {request.status === 'requested' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateAccessStatus(request.id!, 'active');
                                  }}
                                  disabled={processingAccessStatus === request.id}
                                  className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 transition-colors disabled:opacity-50"
                                  title="Approve access"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateAccessStatus(request.id!, 'deactivated');
                                  }}
                                  disabled={processingAccessStatus === request.id}
                                  className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                  title="Deny access"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {request.status === 'active' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateAccessStatus(request.id!, 'deactivated');
                                }}
                                disabled={processingAccessStatus === request.id}
                                className="p-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors disabled:opacity-50"
                                title="Deactivate access"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                            {request.status === 'deactivated' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateAccessStatus(request.id!, 'active');
                                }}
                                disabled={processingAccessStatus === request.id}
                                className="p-2 bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/50 transition-colors disabled:opacity-50"
                                title="Reactivate access"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccessRequest(request.id!, request.email);
                              }}
                              disabled={processingAccessStatus === request.id}
                              className="p-2 bg-gray-900/30 text-gray-400 rounded-lg hover:bg-red-900/50 hover:text-red-400 transition-colors disabled:opacity-50"
                              title="Delete request"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Request Details */}
            <div className="lg:col-span-1">
              <div className="bg-[#262a30] rounded-lg border border-gray-700 sticky top-6">
                <div className="p-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold text-white">Request Details</h2>
                </div>
                
                {selectedRequest ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-400">Email</label>
                      <p className="text-white">{selectedRequest.email}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Name</label>
                      <p className="text-white">{selectedRequest.name || 'Not provided'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Status</label>
                      <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Role</label>
                      <p className="text-white">{getRoleDisplay(selectedRequest.role)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Primary Use</label>
                      <p className="text-white">{selectedRequest.primaryUse || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Use Cases</label>
                      <p className="text-white">{getUseCasesDisplay(selectedRequest.useCases)}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Client Count</label>
                      <p className="text-white">{selectedRequest.clientCount || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Years Experience</label>
                      <p className="text-white">{selectedRequest.yearsExperience || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Certified</label>
                      <p className="text-white">{selectedRequest.isCertified ? 'Yes' : 'No'}</p>
                      {selectedRequest.isCertified && selectedRequest.certificationName && (
                        <p className="text-gray-400 text-sm">{selectedRequest.certificationName}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Long Term Goal</label>
                      <p className="text-white">{selectedRequest.longTermGoal || 'Not specified'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Apply for Founding Coaches</label>
                      <p className="text-white">{selectedRequest.applyForFoundingCoaches ? 'Yes' : 'No'}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-400">Requested</label>
                      <p className="text-white">{formatDate(selectedRequest.createdAt)}</p>
                    </div>
                    
                    {selectedRequest.approvedAt && (
                      <div>
                        <label className="text-sm font-medium text-gray-400">Approved</label>
                        <p className="text-white">{formatDate(selectedRequest.approvedAt)}</p>
                        {selectedRequest.approvedBy && (
                          <p className="text-gray-400 text-sm">by {selectedRequest.approvedBy}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Select a request to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default ProgrammingAccessManagement; 