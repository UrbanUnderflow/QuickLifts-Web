import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import AthleteCard from '../../components/AthleteCard';

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Total Athletes</h3>
            <div className="text-3xl font-bold text-[#E0FE10]">{athletes.length}</div>
          </div>
          
          <div className="bg-zinc-900 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Monthly Revenue</h3>
            <div className="text-3xl font-bold text-green-400">$0</div>
          </div>
          
          <div className="bg-zinc-900 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-2">Account Type</h3>
            <div className="text-xl font-bold text-blue-400">
              {coachProfile?.userType === 'partner' ? 'Partner' : 'Coach'}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-zinc-900 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors">
              Invite Athletes
            </button>
            <button className="bg-zinc-800 text-white px-6 py-3 rounded-lg hover:bg-zinc-700 transition-colors">
              View Analytics
            </button>
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
                Share your referral code <span className="text-[#E0FE10] font-bold">{coachProfile?.referralCode}</span> with athletes to get started
              </p>
              <div className="flex justify-center space-x-4">
                <button 
                  onClick={() => navigator.clipboard.writeText(coachProfile?.referralCode || '')}
                  className="bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors"
                >
                  Copy Referral Code
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