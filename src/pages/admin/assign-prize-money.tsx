// Admin page for assigning prize money to challenges
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import Head from 'next/head';
import { Search, DollarSign, Trophy, Save, Edit, Trash2, Calendar, Users, Target, Mail, Send } from 'lucide-react';

interface Challenge {
  id: string;
  title: string;
  description: string;
  startDate: any;
  endDate: any;
  status: string;
  participantCount?: number;
  createdBy: string;
  creatorInfo?: {
    username: string;
    email: string;
  };
}

interface PrizeAssignment {
  id: string;
  challengeId: string;
  challengeTitle: string;
  prizeAmount: number; // in dollars
  prizeStructure: 'winner_takes_all' | 'top_three_split' | 'top_five_split' | 'custom';
  customDistribution?: { rank: number; percentage: number }[];
  description: string;
  status: 'assigned' | 'distributed' | 'cancelled';
  createdAt: any;
  createdBy: string;
  // Host validation fields
  hostEmailSent?: boolean;
  hostEmailSentAt?: any;
  hostConfirmed?: boolean;
  hostConfirmedAt?: any;
  distributionStatus?: 'pending' | 'processing' | 'distributed' | 'partially_distributed' | 'failed';
}

interface PrizeFormData {
  challengeId: string;
  prizeAmount: number;
  prizeStructure: 'winner_takes_all' | 'top_three_split' | 'top_five_split' | 'custom';
  description: string;
  customDistribution: { rank: number; percentage: number }[];
}

const AssignPrizeMoneyPage: React.FC = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [prizeAssignments, setPrizeAssignments] = useState<PrizeAssignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPrize, setEditingPrize] = useState<PrizeAssignment | null>(null);
  const [justAssignedPrize, setJustAssignedPrize] = useState<PrizeAssignment | null>(null);
  const [sendingHostEmail, setSendingHostEmail] = useState(false);
  
  const [formData, setFormData] = useState<PrizeFormData>({
    challengeId: '',
    prizeAmount: 1000,
    prizeStructure: 'winner_takes_all',
    description: '',
    customDistribution: [
      { rank: 1, percentage: 50 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 20 }
    ]
  });

  const currentUser = useSelector((state: RootState) => state.user.currentUser);

  useEffect(() => {
    fetchChallenges();
    fetchPrizeAssignments();
  }, []);

  const fetchChallenges = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/.netlify/functions/get-challenges?admin=true');
      const data = await response.json();
      if (data.success && data.challenges) {
        setChallenges(data.challenges);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrizeAssignments = async () => {
    try {
      const response = await fetch('/.netlify/functions/get-prize-assignments');
      const data = await response.json();
      if (data.success && data.assignments) {
        setPrizeAssignments(data.assignments);
      }
    } catch (error) {
      console.error('Error fetching prize assignments:', error);
    }
  };

  const filteredChallenges = challenges.filter(challenge =>
    challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    challenge.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    challenge.creatorInfo?.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleChallengeSelect = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setFormData(prev => ({
      ...prev,
      challengeId: challenge.id,
      description: `Prize money for ${challenge.title}`
    }));
  };

  const getPrizeStructureDescription = (structure: string) => {
    switch (structure) {
      case 'winner_takes_all':
        return '100% to 1st place';
      case 'top_three_split':
        return '60% / 25% / 15% (1st/2nd/3rd)';
      case 'top_five_split':
        return '40% / 25% / 20% / 10% / 5%';
      case 'custom':
        return 'Custom distribution';
      default:
        return structure;
    }
  };

  const calculateDistribution = (amount: number, structure: string) => {
    switch (structure) {
      case 'winner_takes_all':
        return [{ rank: 1, amount: amount, percentage: 100 }];
      case 'top_three_split':
        return [
          { rank: 1, amount: amount * 0.6, percentage: 60 },
          { rank: 2, amount: amount * 0.25, percentage: 25 },
          { rank: 3, amount: amount * 0.15, percentage: 15 }
        ];
      case 'top_five_split':
        return [
          { rank: 1, amount: amount * 0.4, percentage: 40 },
          { rank: 2, amount: amount * 0.25, percentage: 25 },
          { rank: 3, amount: amount * 0.2, percentage: 20 },
          { rank: 4, amount: amount * 0.1, percentage: 10 },
          { rank: 5, amount: amount * 0.05, percentage: 5 }
        ];
      case 'custom':
        return formData.customDistribution.map(dist => ({
          rank: dist.rank,
          amount: amount * (dist.percentage / 100),
          percentage: dist.percentage
        }));
      default:
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChallenge || !currentUser) return;

    setIsSaving(true);
    try {
      const payload = {
        challengeId: formData.challengeId,
        challengeTitle: selectedChallenge.title,
        prizeAmount: formData.prizeAmount,
        prizeStructure: formData.prizeStructure,
        description: formData.description,
        customDistribution: formData.prizeStructure === 'custom' ? formData.customDistribution : null,
        createdBy: currentUser.id,
        status: 'assigned'
      };

      const response = await fetch('/.netlify/functions/assign-challenge-prize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        alert('Prize money assigned successfully!');
        // Set the just assigned prize to show the host email button
        setJustAssignedPrize(data.prizeData);
        fetchPrizeAssignments();
        // Reset form
        setSelectedChallenge(null);
        setFormData({
          challengeId: '',
          prizeAmount: 1000,
          prizeStructure: 'winner_takes_all',
          description: '',
          customDistribution: [
            { rank: 1, percentage: 50 },
            { rank: 2, percentage: 30 },
            { rank: 3, percentage: 20 }
          ]
        });
      } else {
        console.error('Prize assignment failed:');
        console.error(data.error);
        
        // Extract and log Firebase console URL if present
        if (data.error && data.error.includes('console.firebase.google.com')) {
          const urlMatch = data.error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          if (urlMatch) {
            console.log('🔗 Firebase Console URL (copy this):');
            console.log(urlMatch[0]);
          }
        }
        
        console.error('Full response:', data);
        alert(`Error: ${data.error}\n\nFull details logged to console (F12 > Console tab)`);
      }
    } catch (error) {
      console.error('Error assigning prize:');
      console.error(error);
      
      // Extract and log Firebase console URL if present in error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage && errorMessage.includes('console.firebase.google.com')) {
        const urlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (urlMatch) {
          console.log('🔗 Firebase Console URL (copy this):');
          console.log(urlMatch[0]);
        }
      }
      
      alert(`Failed to assign prize money\n\nFull details logged to console (F12 > Console tab)`);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleDateString();
    } catch {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleSendHostEmail = async (prizeAssignment: PrizeAssignment) => {
    if (!currentUser) return;

    setSendingHostEmail(true);
    try {
      const response = await fetch('/.netlify/functions/send-host-validation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prizeAssignmentId: prizeAssignment.id,
          challengeId: prizeAssignment.challengeId,
          challengeTitle: prizeAssignment.challengeTitle,
          prizeAmount: prizeAssignment.prizeAmount,
          prizeStructure: prizeAssignment.prizeStructure,
          requestedBy: currentUser.id
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Host validation email sent successfully!');
        setJustAssignedPrize(null); // Hide the button
        fetchPrizeAssignments(); // Refresh to update status
      } else {
        console.error('Host email sending failed:');
        console.error(data.error);
        console.error('Full response:', data);
        alert(`Error sending email: ${data.error}\n\nFull details logged to console (F12 > Console tab)`);
      }
    } catch (error) {
      console.error('Error sending host email:');
      console.error(error);
      alert(`Failed to send host validation email\n\nFull details logged to console (F12 > Console tab)`);
    } finally {
      setSendingHostEmail(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Assign Prize Money - Admin Dashboard</title>
      </Head>
      
      <div className="min-h-screen bg-zinc-950 text-white py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-[#E0FE10]" />
            <h1 className="text-3xl font-bold">Assign Prize Money</h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Challenge Search & Selection */}
            <div className="space-y-6">
              <div className="bg-zinc-900 rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Search Challenges
                </h2>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by challenge title, ID, or creator..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:border-[#E0FE10] focus:outline-none"
                  />
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#E0FE10] mx-auto"></div>
                      <p className="mt-2 text-zinc-400">Loading challenges...</p>
                    </div>
                  ) : (
                    filteredChallenges.map((challenge) => {
                      const existingPrize = prizeAssignments.find(p => p.challengeId === challenge.id);
                      return (
                        <div
                          key={challenge.id}
                          onClick={() => handleChallengeSelect(challenge)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedChallenge?.id === challenge.id
                              ? 'border-[#E0FE10] bg-[#E0FE10]/10'
                              : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-white">{challenge.title}</h3>
                              <p className="text-sm text-zinc-400 mt-1">{challenge.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(challenge.startDate)} - {formatDate(challenge.endDate)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {challenge.participantCount || 0} participants
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-1">
                                Created by: {challenge.creatorInfo?.username || 'Unknown'}
                              </p>
                            </div>
                            <div className="ml-4">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                challenge.status === 'active' ? 'bg-green-900/50 text-green-400' :
                                challenge.status === 'completed' ? 'bg-blue-900/50 text-blue-400' :
                                'bg-zinc-700 text-zinc-300'
                              }`}>
                                {challenge.status}
                              </span>
                              {existingPrize && (
                                <div className="mt-2">
                                  <span className="px-2 py-1 rounded-full text-xs bg-yellow-900/50 text-yellow-400">
                                    {formatCurrency(existingPrize.prizeAmount)} Prize
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Prize Assignment Form */}
            <div className="space-y-6">
              {selectedChallenge ? (
                <div className="bg-zinc-900 rounded-xl p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Assign Prize Money
                  </h2>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Selected Challenge</label>
                      <div className="p-3 bg-zinc-800 rounded-lg">
                        <p className="font-semibold">{selectedChallenge.title}</p>
                        <p className="text-sm text-zinc-400">{selectedChallenge.description}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Prize Amount ($)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={formData.prizeAmount}
                        onChange={(e) => setFormData(prev => ({ ...prev, prizeAmount: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-[#E0FE10] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Prize Structure</label>
                      <select
                        value={formData.prizeStructure}
                        onChange={(e) => setFormData(prev => ({ ...prev, prizeStructure: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-[#E0FE10] focus:outline-none"
                      >
                        <option value="winner_takes_all">Winner Takes All</option>
                        <option value="top_three_split">Top 3 Split</option>
                        <option value="top_five_split">Top 5 Split</option>
                        <option value="custom">Custom Distribution</option>
                      </select>
                      <p className="text-sm text-zinc-400 mt-1">
                        {getPrizeStructureDescription(formData.prizeStructure)}
                      </p>
                    </div>

                    {formData.prizeStructure === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Custom Distribution</label>
                        <div className="space-y-2">
                          {formData.customDistribution.map((dist, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-sm w-12">#{dist.rank}:</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={dist.percentage}
                                onChange={(e) => {
                                  const newDist = [...formData.customDistribution];
                                  newDist[index].percentage = parseInt(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, customDistribution: newDist }));
                                }}
                                className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                              />
                              <span className="text-sm w-8">%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:border-[#E0FE10] focus:outline-none"
                        placeholder="Optional description or notes about this prize..."
                      />
                    </div>

                    {/* Prize Distribution Preview */}
                    <div className="border border-zinc-700 rounded-lg p-4 bg-zinc-800">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Prize Distribution Preview
                      </h3>
                      <div className="space-y-1">
                        {calculateDistribution(formData.prizeAmount, formData.prizeStructure).map((dist) => (
                          <div key={dist.rank} className="flex justify-between text-sm">
                            <span>#{dist.rank} Place ({dist.percentage}%)</span>
                            <span className="font-semibold">{formatCurrency(dist.amount)}</span>
                          </div>
                        ))}
                        <div className="border-t border-zinc-600 pt-1 mt-2">
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>{formatCurrency(formData.prizeAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full flex items-center justify-center gap-2 bg-[#E0FE10] text-black py-3 px-4 rounded-lg font-semibold hover:bg-[#C5E609] transition-colors disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                          Assigning Prize...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Assign Prize Money
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-xl p-6 text-center">
                  <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Challenge Selected</h3>
                  <p className="text-zinc-500">Select a challenge from the left to assign prize money.</p>
                </div>
              )}

              {/* Host Validation Email Button - Shows after prize assignment */}
              {justAssignedPrize && (
                <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-6 mt-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-400">
                    <Trophy className="w-5 h-5" />
                    Prize Assigned Successfully!
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="text-sm text-green-200">
                      <p><strong>Challenge:</strong> {justAssignedPrize.challengeTitle}</p>
                      <p><strong>Prize Amount:</strong> {formatCurrency(justAssignedPrize.prizeAmount)}</p>
                      <p><strong>Structure:</strong> {getPrizeStructureDescription(justAssignedPrize.prizeStructure)}</p>
                    </div>
                    
                    <div className="bg-zinc-800 rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-white">Next Step: Host Validation</h4>
                      <p className="text-sm text-zinc-300 mb-4">
                        Send an email to the challenge host to confirm the winner and authorize prize distribution.
                      </p>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleSendHostEmail(justAssignedPrize)}
                          disabled={sendingHostEmail}
                          className="flex items-center gap-2 bg-[#E0FE10] text-black py-2 px-4 rounded-lg font-semibold hover:bg-[#C5E609] transition-colors disabled:opacity-50"
                        >
                          {sendingHostEmail ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-black"></div>
                              Sending Email...
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4" />
                              Send Host Validation Email
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => setJustAssignedPrize(null)}
                          className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                        >
                          Skip for now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Existing Prize Assignments */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Existing Prize Assignments</h2>
            
            {prizeAssignments.length > 0 ? (
              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Challenge</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Prize Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Structure</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Host Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {prizeAssignments.map((prize) => (
                        <tr key={prize.id} className="hover:bg-zinc-800/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-white">{prize.challengeTitle}</div>
                              <div className="text-sm text-zinc-400">{prize.challengeId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">{formatCurrency(prize.prizeAmount)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{getPrizeStructureDescription(prize.prizeStructure)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              prize.status === 'assigned' ? 'bg-yellow-900/50 text-yellow-400' :
                              prize.status === 'distributed' ? 'bg-green-900/50 text-green-400' :
                              'bg-red-900/50 text-red-400'
                            }`}>
                              {prize.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              {prize.hostEmailSent ? (
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-900/50 text-blue-400">
                                  Email Sent
                                </span>
                              ) : (
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-900/50 text-gray-400">
                                  Pending
                                </span>
                              )}
                              {prize.hostConfirmed && (
                                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900/50 text-green-400">
                                  Confirmed
                                </span>
                              )}
                              {prize.distributionStatus && prize.distributionStatus !== 'pending' && (
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  prize.distributionStatus === 'distributed' ? 'bg-green-900/50 text-green-400' :
                                  prize.distributionStatus === 'processing' ? 'bg-yellow-900/50 text-yellow-400' :
                                  prize.distributionStatus === 'failed' ? 'bg-red-900/50 text-red-400' :
                                  'bg-blue-900/50 text-blue-400'
                                }`}>
                                  {prize.distributionStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                            {formatDate(prize.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {!prize.hostEmailSent && (
                                <button
                                  onClick={() => handleSendHostEmail(prize)}
                                  disabled={sendingHostEmail}
                                  className="text-green-400 hover:text-green-300 disabled:opacity-50"
                                  title="Send Host Validation Email"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setEditingPrize(prize)}
                                className="text-blue-400 hover:text-blue-300"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this prize assignment?')) {
                                    // TODO: Implement delete functionality
                                  }
                                }}
                                className="text-red-400 hover:text-red-300"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 rounded-xl p-8 text-center">
                <Trophy className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Prize Assignments Yet</h3>
                <p className="text-zinc-500">Start by selecting a challenge and assigning prize money above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default AssignPrizeMoneyPage; 