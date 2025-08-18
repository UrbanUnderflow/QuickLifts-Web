import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import AthleteCard from '../../components/AthleteCard';
import { FaCopy, FaQrcode, FaLink, FaUsers } from 'react-icons/fa';

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchCoachProfile = async () => {
      // Wait for auth to initialize before checking user
      if (userLoading) {
        return;
      }
      
      if (!currentUser) {
        setError('Please sign in to access the coach dashboard.');
        setLoading(false);
        return;
      }

      try {
        // Use coach service to check for profile
        const coachProfile = await coachService.getCoachProfile(currentUser.id);
        
        if (!coachProfile) {
          setError('Access denied. Coach account required.');
          setLoading(false);
          return;
        }

        setCoachProfile(coachProfile);
        
        // Generate invite link
        const baseUrl = window.location.origin;
        const inviteUrl = `${baseUrl}/coach-invite/${coachProfile.referralCode}`;
        setInviteLink(inviteUrl);
        
        // Generate QR code using Google Charts API
        const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(inviteUrl)}`;
        setQrCodeUrl(qrCodeApiUrl);
        
        // Fetch connected athletes
        console.log('Fetching athletes for coach:', coachProfile.id);
        const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
        console.log('Initial athlete fetch result:', connectedAthletes);
        setAthletes(connectedAthletes);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching coach profile:', err);
        setError('Failed to load coach profile. Please try again.');
        setLoading(false);
      }
    };

    fetchCoachProfile();
  }, [currentUser?.id, userLoading]); // Fixed: removed router and used currentUser.id instead of currentUser object

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Access Denied</div>
          <div className="text-white">{error}</div>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 bg-[#E0FE10] text-black px-6 py-2 rounded-lg hover:bg-lime-400 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Coach Dashboard</h1>
            <p className="text-zinc-400">Welcome back, {currentUser?.username}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-zinc-400">Referral Code</div>
            <div className="text-xl font-bold text-[#E0FE10]">{coachProfile?.referralCode}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <div className="bg-zinc-900 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-2">
              <FaUsers className="text-[#E0FE10] text-xl" />
              <h3 className="text-lg font-semibold">Total Athletes</h3>
            </div>
            <div className="text-3xl font-bold text-[#E0FE10]">{athletes.length}</div>
            <p className="text-zinc-400 text-sm mt-1">Connected athletes</p>
          </div>
        </div>

        {/* Invite Athletes Section */}
        <div className="mt-8 bg-zinc-900 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <FaLink className="text-[#E0FE10] text-xl" />
            <h3 className="text-lg font-semibold">Invite Athletes</h3>
          </div>
          
          <div className="space-y-4">
            {/* Invite Link */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Invite Link
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 focus:border-[#E0FE10] focus:outline-none"
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg hover:bg-lime-400 transition-colors flex items-center space-x-2"
                >
                  <FaCopy className="text-sm" />
                  <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Athletes can click this link to automatically connect to you
              </p>
            </div>

            {/* QR Code Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-300">
                  QR Code
                </label>
                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-[#E0FE10] hover:text-lime-400 transition-colors flex items-center space-x-1 text-sm"
                >
                  <FaQrcode />
                  <span>{showQrCode ? 'Hide' : 'Show'} QR Code</span>
                </button>
              </div>
              
              {showQrCode && qrCodeUrl && (
                <div className="bg-white p-4 rounded-lg inline-block">
                  <img src={qrCodeUrl} alt="Invite QR Code" className="w-48 h-48" />
                  <p className="text-center text-black text-xs mt-2">
                    Scan to connect with {coachProfile?.referralCode}
                  </p>
                </div>
              )}
              
              <p className="text-xs text-zinc-500 mt-1">
                Athletes can scan this QR code to instantly connect
              </p>
            </div>

            {/* Legacy Referral Code */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Referral Code
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={coachProfile?.referralCode || ''}
                  readOnly
                  className="flex-1 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700"
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(coachProfile?.referralCode || '');
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className="bg-zinc-700 text-white px-4 py-2 rounded-lg hover:bg-zinc-600 transition-colors flex items-center space-x-2"
                >
                  <FaCopy className="text-sm" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                For athletes who prefer to enter a code manually
              </p>
            </div>
          </div>
        </div>

        {/* Athletes Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold">Your Athletes</h3>
            {athletes.length > 0 && (
              <span className="text-zinc-400">{athletes.length} connected</span>
            )}
          </div>
          
          {athletes.length === 0 ? (
            <div className="bg-zinc-900 rounded-xl p-8 text-center">
              <div className="text-zinc-400 mb-4">No athletes connected yet</div>
              <p className="text-zinc-500 mb-6">
                Use the invite link or QR code above to connect with athletes instantly
              </p>
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                    }
                  }}
                  className="bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors flex items-center space-x-2"
                >
                  <FaLink className="text-sm" />
                  <span>{copySuccess ? 'Copied!' : 'Copy Invite Link'}</span>
                </button>
                <button 
                  onClick={async () => {
                    if (coachProfile) {
                      console.log('Refreshing athletes for coach:', coachProfile.id);
                      try {
                        const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
                        console.log('Found athletes:', connectedAthletes);
                        setAthletes(connectedAthletes);
                      } catch (error) {
                        console.error('Error refreshing athletes:', error);
                      }
                    }
                  }}
                  className="bg-zinc-700 text-white px-6 py-3 rounded-lg hover:bg-zinc-600 transition-colors"
                >
                  Refresh Athletes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {athletes.map((athlete) => (
                <AthleteCard
                  key={athlete.id}
                  athlete={athlete}
                  onViewDetails={(athleteId) => {
                    console.log('View details for athlete:', athleteId);
                    // TODO: Navigate to athlete details page
                  }}
                  onMessageAthlete={(athleteId) => {
                    console.log('Message athlete:', athleteId);
                    // TODO: Open messaging interface
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachDashboard;