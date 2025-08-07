// Admin page for assigning prize money to challenges
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import Head from 'next/head';
import { Search, DollarSign, Trophy, Save, Edit, Trash2, Calendar, Users, Target, Mail, Send, CreditCard, AlertCircle } from 'lucide-react';

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
  // Funding fields
  fundingStatus?: 'pending' | 'funded' | 'distributed' | 'refunded';
  depositedAmount?: number;
  escrowRecordId?: string;
  depositedAt?: any;
  depositedBy?: string;
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
  const [newPrizeAmount, setNewPrizeAmount] = useState('');
  const [justAssignedPrize, setJustAssignedPrize] = useState<PrizeAssignment | null>(null);
  const [sendingHostEmail, setSendingHostEmail] = useState(false);
  const [depositorPrize, setDepositorPrize] = useState<PrizeAssignment | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [escrowRecords, setEscrowRecords] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  
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

  // Helper function to find existing assignment for selected challenge
  const getExistingAssignment = (challengeId: string): PrizeAssignment | null => {
    return prizeAssignments.find(assignment => assignment.challengeId === challengeId) || null;
  };

  // Check if we're in reassignment mode
  const existingAssignment = selectedChallenge ? getExistingAssignment(selectedChallenge.id) : null;
  const isReassigning = !!existingAssignment;

  useEffect(() => {
    const loadAllData = async () => {
      setDataLoaded(false);
      await Promise.all([
        fetchChallenges(),
        fetchPrizeAssignments(),
        fetchEscrowRecords()
      ]);
      setDataLoaded(true);
    };
    
    loadAllData();
    
    // Check for successful deposit in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('deposit_success') === 'true') {
      const sessionId = urlParams.get('session_id');
      alert(`Prize money deposit completed successfully!\nCheckout Session: ${sessionId}`);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh data
      setTimeout(() => {
        fetchPrizeAssignments();
        fetchEscrowRecords();
      }, 3000); // Give webhook time to process
    }
    
    if (urlParams.get('deposit_cancelled') === 'true') {
      alert('Prize money deposit was cancelled.');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Pre-populate form when selecting a challenge with existing assignment
  useEffect(() => {
    if (existingAssignment) {
      setFormData({
        challengeId: existingAssignment.challengeId,
        prizeAmount: existingAssignment.prizeAmount,
        prizeStructure: existingAssignment.prizeStructure,
        description: existingAssignment.description || '',
        customDistribution: existingAssignment.customDistribution || [
          { rank: 1, percentage: 50 },
          { rank: 2, percentage: 30 },
          { rank: 3, percentage: 20 }
        ]
      });
    }
  }, [existingAssignment]);

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

  const fetchEscrowRecords = async () => {
    try {
      const response = await fetch('/.netlify/functions/get-prize-escrow');
      const data = await response.json();
      if (data.success && data.escrowRecords) {
        setEscrowRecords(data.escrowRecords);
      }
    } catch (error) {
      console.error('Error fetching escrow records:', error);
    }
  };

  const handleDepositPrizeMoney = async (prizeAssignment: PrizeAssignment) => {
    if (!currentUser) return;

    setIsDepositing(true);
    try {
      // Initialize Stripe
      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        alert('Stripe configuration error. Please contact support.');
        setIsDepositing(false);
        return;
      }
      const stripe = window.Stripe ? window.Stripe(stripeKey) : null;
      
      if (!stripe) {
        alert('Stripe not loaded. Please refresh the page and try again.');
        setIsDepositing(false);
        return;
      }

      // Step 1: Create payment intent on the backend
      const createResponse = await fetch('/.netlify/functions/create-deposit-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: prizeAssignment.challengeId,
          prizeAmount: Math.round(prizeAssignment.prizeAmount * 100), // Convert to cents
          depositedBy: currentUser.id,
          depositorName: currentUser.username,
          depositorEmail: currentUser.email
        })
      });

      const response = await createResponse.json();
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId, breakdown, isPartialDeposit, existingEscrowAmount, amountToDeposit } = response;
      
      if (!clientSecret) {
        throw new Error('Failed to create payment intent');
      }

      // Step 2: Use Elements for Payment (like round purchases - supports Link automatically)
      console.log('Payment Intent created:', paymentIntentId);
      console.log('Client Secret:', clientSecret);
      console.log('Fee breakdown:', breakdown);
      
      // Create Elements and Payment Element
      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: 'night', // Dark theme to match our UI
        }
      });
      
      // Create and mount Payment Element
      const paymentElement = elements.create('payment', {
        defaultValues: {
          billingDetails: {
            email: currentUser.email,
            name: currentUser.username
          }
        }
      });
      
      // Create modal for payment with fee breakdown
      const modalHtml = `
        <div id="payment-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center;">
          <div style="background: #18181b; padding: 24px; border-radius: 12px; width: 90%; max-width: 500px; color: white;">
            <h3 style="margin: 0 0 16px 0; color: white;">${isPartialDeposit ? 'Additional' : ''} Prize Money Deposit</h3>
            <p style="margin: 0 0 8px 0; color: #a1a1aa;">Challenge: ${prizeAssignment.challengeTitle}</p>
            ${isPartialDeposit ? `<p style="margin: 0 0 8px 0; color: #fbbf24; font-size: 14px;">⚡ Adding to existing deposit of $${(existingEscrowAmount / 100).toFixed(2)}</p>` : ''}
            
            <div style="background: #27272a; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <h4 style="margin: 0 0 12px 0; color: white; font-size: 14px;">Payment Breakdown:</h4>
              ${isPartialDeposit ? `
                <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #fbbf24;">
                  <span>Existing in Escrow:</span>
                  <span>$${(existingEscrowAmount / 100).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #a1a1aa;">
                  <span>Additional Deposit:</span>
                  <span>${breakdown.depositAmount}</span>
                </div>
              ` : `
                <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #a1a1aa;">
                  <span>Prize Deposit:</span>
                  <span>${breakdown.depositAmount}</span>
                </div>
              `}
              <div style="display: flex; justify-content: space-between; margin: 4px 0; color: #a1a1aa;">
                <span>Service Fee:</span>
                <span>${breakdown.serviceFee}</span>
              </div>
              <hr style="border: none; border-top: 1px solid #3f3f46; margin: 8px 0;">
              <div style="display: flex; justify-content: space-between; margin: 4px 0; color: white; font-weight: 600;">
                <span>Total Charge:</span>
                <span>${breakdown.totalCharged}</span>
              </div>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #71717a;">Winner will receive $${prizeAssignment.prizeAmount.toFixed(2)} total</p>
            </div>
            
            <div id="payment-element" style="margin: 16px 0;"></div>
            <div style="display: flex; gap: 12px; margin-top: 16px;">
              <button id="cancel-payment" style="flex: 1; padding: 12px; background: #3f3f46; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
              <button id="submit-payment" style="flex: 1; padding: 12px; background: #E0FE10; color: black; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Pay ${breakdown.totalCharged}</button>
            </div>
            <div id="payment-messages" style="margin-top: 12px; color: #ef4444;"></div>
          </div>
        </div>
      `;
      
      // Add modal to page
      document.body.insertAdjacentHTML('beforeend', modalHtml);
      
      // Mount payment element
      paymentElement.mount('#payment-element');
      
      // Handle cancel
      document.getElementById('cancel-payment')?.addEventListener('click', () => {
        document.getElementById('payment-modal')?.remove();
        setIsDepositing(false);
      });
      
      // Handle payment submission
      document.getElementById('submit-payment')?.addEventListener('click', async () => {
        const submitButton = document.getElementById('submit-payment');
        const messagesDiv = document.getElementById('payment-messages');
        
        if (submitButton) submitButton.textContent = 'Processing...';
        
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/admin/assign-prize-money?deposit_success=true&pi=${paymentIntentId}`,
          },
          redirect: 'if_required'
        });

        if (error) {
          if (messagesDiv) messagesDiv.textContent = error.message || 'Payment failed';
          if (submitButton) submitButton.textContent = `Pay $${prizeAssignment.prizeAmount}`;
        } else {
          // Payment succeeded
          document.getElementById('payment-modal')?.remove();
          
          const successMessage = isPartialDeposit 
            ? `Additional prize money deposited successfully!\n\nAdditional Deposit: ${breakdown.depositAmount}\nService Fee: ${breakdown.serviceFee}\nTotal Charged: ${breakdown.totalCharged}\n\nTotal in Escrow: $${(existingEscrowAmount + amountToDeposit) / 100}\nWinner will receive $${prizeAssignment.prizeAmount.toFixed(2)} total!`
            : `Prize money deposited successfully!\n\nDeposit Amount: ${breakdown.depositAmount}\nService Fee: ${breakdown.serviceFee}\nTotal Charged: ${breakdown.totalCharged}\n\nWinner will receive $${prizeAssignment.prizeAmount.toFixed(2)}!`;
            
          alert(successMessage);
          fetchPrizeAssignments(); // Refresh assignments
          fetchEscrowRecords(); // Refresh escrow records
        }
      });
    } catch (error) {
      console.error('Error depositing prize money:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to deposit prize money: ${errorMessage}`);
    } finally {
      setIsDepositing(false);
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
      if (isReassigning && existingAssignment) {
        // Handle reassignment - update existing assignment
        const response = await fetch('/.netlify/functions/update-prize-assignment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: existingAssignment.id,
            prizeAmount: formData.prizeAmount,
            prizeStructure: formData.prizeStructure,
            description: formData.description,
            customDistribution: formData.prizeStructure === 'custom' ? formData.customDistribution : null,
            updatedBy: currentUser.id
          })
        });

        const data = await response.json();
        if (data.success) {
          alert('Prize money reassigned successfully!');
          fetchPrizeAssignments();
          // Keep the form populated for further edits
        } else {
          console.error('Prize reassignment failed:', data.error);
          alert(`Error reassigning prize: ${data.error}`);
        }
      } else {
        // Handle new assignment
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

  const getFundingStatus = (challengeId: string): { status: string; escrowRecord?: any } => {
    // Don't check funding status until all data is loaded
    if (!dataLoaded) {
      return { status: 'loading' };
    }
    
    console.log('=== FUNDING STATUS DEBUG ===');
    console.log('Looking for challengeId:', challengeId);
    console.log('PRIZE ASSIGNMENT RECORDS:', prizeAssignments);
    console.log('ESCROW RECORDS (PRIZE MONEY):', escrowRecords);
    console.log('Escrow records count:', escrowRecords.length);
    console.log('Prize assignments count:', prizeAssignments.length);
    
    // Debug each escrow record
    escrowRecords.forEach((record, index) => {
      console.log(`Escrow Record ${index}:`, {
        challengeId: record.challengeId,
        matches: record.challengeId === challengeId,
        typeof_recordId: typeof record.challengeId,
        typeof_searchId: typeof challengeId,
        status: record.status,
        amount: record.amount
      });
    });
    
    const matchingRecords = escrowRecords.filter(record => record.challengeId === challengeId);
    console.log('Matching records:', matchingRecords);
    console.log('================================');
    
    if (matchingRecords.length > 0) {
      const escrowRecord = matchingRecords[0];
      return { status: 'funded', escrowRecord };
    }
    
    return { status: 'pending' };
  };

  const handleSendHostEmail = async (prizeAssignment: PrizeAssignment) => {
    if (!currentUser) return;

    setSendingHostEmail(true);
    try {
      console.log('Sending host email for prizeAssignment:', prizeAssignment.id);

      console.log('Send-host payload →', {
        prizeAssignmentId : prizeAssignment.id,
        challengeId       : prizeAssignment.challengeId,
        challengeTitle    : prizeAssignment.challengeTitle,
        prizeAmount       : prizeAssignment.prizeAmount,
        prizeStructure    : prizeAssignment.prizeStructure,
        requestedBy       : currentUser.id
      });
      
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
        <script src="https://js.stripe.com/v3/"></script>
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
                      <label className="block text-sm font-medium mb-2">
                        Selected Challenge
                        {isReassigning && (
                          <span className="ml-2 px-2 py-1 bg-yellow-900/50 text-yellow-400 text-xs font-semibold rounded-full">
                            REASSIGNING
                          </span>
                        )}
                      </label>
                      <div className={`p-3 rounded-lg ${isReassigning ? 'bg-yellow-900/20 border border-yellow-600/30' : 'bg-zinc-800'}`}>
                        <p className="font-semibold">{selectedChallenge.title}</p>
                        <p className="text-sm text-zinc-400">{selectedChallenge.description}</p>
                        {isReassigning && existingAssignment && (
                          <p className="text-sm text-yellow-400 mt-2">
                            Current prize: ${existingAssignment.prizeAmount} ({existingAssignment.prizeStructure})
                          </p>
                        )}
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
                          {isReassigning ? 'Reassigning Prize...' : 'Assigning Prize...'}
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {isReassigning ? 'Reassign Prize Money' : 'Assign Prize Money'}
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Existing Prize Assignments</h2>
              <button
                onClick={() => {
                  console.log('Escrow Records:', escrowRecords);
                  console.log('Prize Assignments:', prizeAssignments);
                  fetchEscrowRecords();
                  fetchPrizeAssignments();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
              >
                Debug & Refresh
              </button>
            </div>
            
            {prizeAssignments.length > 0 ? (
              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Challenge</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Prize Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Structure</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Funding</th>
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
                            {(() => {
                              const fundingInfo = getFundingStatus(prize.challengeId);
                              return (
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  fundingInfo.status === 'loading' ? 'bg-blue-900/50 text-blue-400' :
                                  fundingInfo.status === 'pending' ? 'bg-red-900/50 text-red-400' :
                                  fundingInfo.status === 'funded' ? 'bg-green-900/50 text-green-400' :
                                  fundingInfo.status === 'distributed' ? 'bg-blue-900/50 text-blue-400' :
                                  'bg-gray-900/50 text-gray-400'
                                }`}>
                                  {fundingInfo.status === 'loading' ? 'Loading...' : fundingInfo.status}
                                </span>
                              );
                            })()}
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
                              {(() => {
                                const fundingInfo = getFundingStatus(prize.challengeId);
                                return fundingInfo.status === 'pending' && (
                                  <button
                                    onClick={() => handleDepositPrizeMoney(prize)}
                                    disabled={isDepositing}
                                    className="text-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                                    title="Deposit Prize Money"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                  </button>
                                );
                              })()}
                              {!prize.hostEmailSent && getFundingStatus(prize.challengeId).status === 'funded' && (
                                <button
                                  onClick={() => handleSendHostEmail(prize)}
                                  disabled={sendingHostEmail}
                                  className="flex items-center gap-2 text-green-400 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={sendingHostEmail ? "Sending email..." : "Send Host Validation Email"}
                                >
                                  {sendingHostEmail ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                                      <span className="text-xs">Sending...</span>
                                    </>
                                  ) : (
                                    <Mail className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingPrize(prize);
                                  setNewPrizeAmount(prize.prizeAmount.toString());
                                }}
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

          {/* Escrow Summary */}
          {escrowRecords.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold mb-6">Prize Money Escrow Status</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-zinc-900 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <CreditCard className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Total Held</p>
                      <p className="text-xl font-bold text-white">
                        {formatCurrency(escrowRecords
                          .filter(record => record.status === 'held')
                          .reduce((sum, record) => sum + (record.amount || 0), 0) / 100
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <Trophy className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Total Distributed</p>
                      <p className="text-xl font-bold text-white">
                        {formatCurrency(escrowRecords
                          .reduce((sum, record) => sum + (record.distributedAmount || 0), 0) / 100
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Users className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Active Escrows</p>
                      <p className="text-xl font-bold text-white">
                        {escrowRecords.filter(record => record.status === 'held').length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Unfunded Prizes</p>
                      <p className="text-xl font-bold text-white">
                        {prizeAssignments.filter(prize => getFundingStatus(prize.challengeId).status === 'pending').length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800">
                  <h3 className="text-lg font-semibold">Escrow Records</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Challenge</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Total Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Remaining</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Distributed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Deposited By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {escrowRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-zinc-800/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-white">{record.challengeTitle}</div>
                              <div className="text-sm text-zinc-400">{record.challengeId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-white">{formatCurrency((record.totalAmountCharged || 0) / 100)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-semibold text-green-400">{formatCurrency((record.amount || 0) / 100)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-blue-400">{formatCurrency((record.distributedAmount || 0) / 100)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              record.status === 'held' ? 'bg-green-900/50 text-green-400' :
                              record.status === 'distributing' ? 'bg-yellow-900/50 text-yellow-400' :
                              record.status === 'distributed' ? 'bg-blue-900/50 text-blue-400' :
                              'bg-gray-900/50 text-gray-400'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{record.depositedByUsername || 'Unknown'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">
                            {record.createdAt ? new Date(record.createdAt).toLocaleDateString() : 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Prize Modal */}
      {editingPrize && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Edit Prize Amount</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Challenge: {editingPrize.challengeTitle}
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Prize Amount ($)
                </label>
                <input
                  type="number"
                  value={newPrizeAmount}
                  onChange={(e) => setNewPrizeAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:border-[#E0FE10] focus:outline-none"
                  placeholder="Enter prize amount"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (!newPrizeAmount || parseFloat(newPrizeAmount) <= 0) {
                    alert('Please enter a valid prize amount');
                    return;
                  }

                  try {
                    const response = await fetch('/.netlify/functions/update-prize-assignment', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        assignmentId: editingPrize.id,
                        prizeAmount: parseFloat(newPrizeAmount)
                      })
                    });

                    const data = await response.json();
                    if (data.success) {
                      alert('Prize amount updated successfully!');
                      setEditingPrize(null);
                      setNewPrizeAmount('');
                      fetchPrizeAssignments();
                    } else {
                      alert(`Error updating prize: ${data.error}`);
                    }
                  } catch (error) {
                    console.error('Error updating prize:', error);
                    alert('Failed to update prize amount');
                  }
                }}
                className="flex-1 bg-[#E0FE10] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#d0ee00] transition-colors"
              >
                Save Changes
              </button>
              
              <button
                onClick={() => {
                  setEditingPrize(null);
                  setNewPrizeAmount('');
                }}
                className="flex-1 bg-zinc-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default AssignPrizeMoneyPage; 