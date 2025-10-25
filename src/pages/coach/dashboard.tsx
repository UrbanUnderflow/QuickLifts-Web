import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { useUser, useUserLoading } from '../../hooks/useUser';
import { coachService } from '../../api/firebase/coach';
import { CoachModel } from '../../types/Coach';
import AthleteCard from '../../components/AthleteCard';
import { FaCopy, FaQrcode, FaLink, FaUsers, FaBars, FaTimes } from 'react-icons/fa';
import { db } from '../../api/firebase/config';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

const CoachDashboard: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const router = useRouter();
  const [coachProfile, setCoachProfile] = useState<CoachModel | null>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedAthletes, setSharedAthletes] = useState<any[]>([]);
  const [sharedByCoach, setSharedByCoach] = useState<Array<{coachId: string; coachName?: string; athletes: any[]}>>([]);
  const [pendingInvites, setPendingInvites] = useState<{ coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      try {
        localStorage.removeItem('pulse_has_seen_marketing');
      } catch (_) {}
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

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
        // Fetch connected athletes (your own)
        const connectedAthletes = await coachService.getConnectedAthletes(coachProfile.id);
        setAthletes(connectedAthletes);

        // Also fetch shared athletes where you're a staff member for other coaches
        try {
          if (currentUser?.email) {
            const invitesRef = collection(db, 'staff-invites');
            const qInv = query(invitesRef, where('memberEmail', '==', currentUser.email.toLowerCase()), where('status', '==', 'accepted'));
            const snap = await getDocs(qInv);
            const allShared: any[] = [];
            const grouped: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
            for (const d of snap.docs) {
              const data: any = d.data();
              const allow: string[] = Array.isArray(data.allowedAthletes) ? data.allowedAthletes : [];
              if (data.permission === 'full') {
                const connected = await coachService.getConnectedAthletes(data.coachId);
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: connected });
                allShared.push(...connected);
              } else if (allow.length) {
                const perCoach: any[] = [];
                await Promise.all(allow.map(async (aid: string) => {
                  try {
                    const uref = doc(db, 'users', aid);
                    const usnap = await getDoc(uref);
                    if (usnap.exists()) {
                      const u = usnap.data();
                      const athlete = { id: aid, ...u };
                      perCoach.push(athlete);
                      allShared.push(athlete);
                    }
                  } catch (_) {}
                }));
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: perCoach });
              }
            }
            if (grouped.length) setSharedByCoach(grouped);
            setSharedAthletes(allShared);
          }
        } catch (_) {
          setSharedAthletes([]);
        }

        setLoading(false);
      } catch (err) {
        // If no coach profile, check if this user is a staff member with assignments
        try {
          if (!currentUser) throw err;
          // Find any coach-staff record where this user (by email) is a member
          const coachStaffRoot = collection(db, 'coach-staff');
          const coachIdsSnap = await getDocs(coachStaffRoot);
          let found: { coachId: string; allowed: string[] } | null = null;
          const invites: { coachId: string; coachName?: string; permission: 'full'|'limited'; allowedAthletes?: string[] }[] = [];
          const groupedShared: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
          for (const coachDoc of coachIdsSnap.docs) {
            const memberSnap = await getDoc(doc(db, 'coach-staff', coachDoc.id, 'members', (currentUser.email || '').toLowerCase()));
            if (memberSnap.exists()) {
              const data: any = memberSnap.data();
              if (data.status === 'invited') {
                invites.push({ coachId: coachDoc.id, coachName: undefined, permission: data.permission || 'limited', allowedAthletes: data.allowedAthletes || [] });
              } else if (data.permission === 'limited' && Array.isArray(data.allowedAthletes) && data.allowedAthletes.length) {
                found = { coachId: coachDoc.id, allowed: data.allowedAthletes };
              } else if (data.permission === 'full') {
                // Staff with full permission → show that coach's athletes as shared
                const connected = await coachService.getConnectedAthletes(coachDoc.id);
                groupedShared.push({ coachId: coachDoc.id, coachName: undefined, athletes: connected });
              }
            }
          }
          if (groupedShared.length) setSharedByCoach(groupedShared);
          if (invites.length) {
            setPendingInvites(invites);
          }
          // Additionally read limited shares from staff-invites (source of truth)
          try {
            const invitesRef = collection(db, 'staff-invites');
            const qInv = query(invitesRef, where('memberEmail', '==', (currentUser.email||'').toLowerCase()), where('status', '==', 'accepted'));
            const snap = await getDocs(qInv);
            const allShared: any[] = [];
            const grouped: Array<{coachId: string; coachName?: string; athletes: any[]}> = [];
            for (const d of snap.docs) {
              const data: any = d.data();
              const allow: string[] = Array.isArray(data.allowedAthletes) ? data.allowedAthletes : [];
              if (data.permission === 'full') {
                const connected = await coachService.getConnectedAthletes(data.coachId);
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: connected });
              } else if (allow.length) {
                const perCoach: any[] = [];
                await Promise.all(allow.map(async (aid: string) => {
                  try {
                    const uref = doc(db, 'users', aid);
                    const usnap = await getDoc(uref);
                    if (usnap.exists()) {
                      const u = usnap.data();
                      perCoach.push({ id: aid, ...u });
                      allShared.push({ id: aid, ...u });
                    }
                  } catch (_) {}
                }));
                grouped.push({ coachId: data.coachId, coachName: data.coachUsername, athletes: perCoach });
              }
            }
            if (grouped.length) setSharedByCoach(grouped);
            if (allShared.length) setSharedAthletes(allShared);
          } catch (_) {}
          // Neither coach nor staff with assignments
          setError('Access denied. Coach account required.');
          setLoading(false);
        } catch (subErr) {
          console.error('Error fetching coach profile:', err);
          setError('Failed to load coach profile. Please try again.');
          setLoading(false);
        }
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
        <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <div className="text-2xl font-semibold text-white mb-2">No Coach Account</div>
          <p className="text-zinc-400 mb-6">
            You’re signed in but don’t have a coach profile yet. Create one to access the dashboard.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/coach/sign-up')}
              className="bg-[#E0FE10] text-black px-6 py-3 rounded-lg hover:bg-lime-400 transition-colors"
            >
              Create Coach Account
            </button>
            <div className="text-sm text-zinc-500 mt-3">
              Signed in as <span className="text-zinc-300">{currentUser?.email || currentUser?.username || 'unknown'}</span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1">
              <button
                onClick={handleSignOut}
                className="bg-zinc-800 text-white px-5 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
              >
                Sign out
              </button>
              <button
                onClick={() => router.push('/')}
                className="bg-zinc-800 text-white px-5 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
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

          {/* Top Nav: Dashboard | Referrals | Staff */}
          <div className="flex-1" />
          <nav className="mr-6 hidden md:flex items-center gap-2">
            {[
              { href: '/coach/dashboard', label: 'Dashboard' },
              { href: '/coach/referrals', label: 'Referrals' },
              { href: '/coach/revenue', label: 'Earnings' },
              { href: '/coach/staff', label: 'Staff' },
              { href: '/coach/inbox', label: 'Inbox' },
              { href: '/coach/profile', label: 'Profile' }
            ].map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="text-right">
            <div className="text-sm text-zinc-400">Referral Code</div>
            <div className="text-xl font-bold text-[#E0FE10]">{coachProfile?.referralCode}</div>
            {/* Mobile menu trigger under referral code */}
            <button
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="mt-2 md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
            >
              <FaBars />
            </button>
            <button
              onClick={handleSignOut}
              className="mt-3 bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors hidden md:inline-flex"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile slide-over navigation */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute top-0 right-0 h-full w-72 bg-zinc-900 border-l border-zinc-800 shadow-xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="text-lg font-semibold text-white">Menu</div>
                <button
                  aria-label="Close navigation"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <FaTimes />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { href: '/coach/dashboard', label: 'Dashboard' },
                  { href: '/coach/referrals', label: 'Referrals' },
                  { href: '/coach/revenue', label: 'Earnings' },
                  { href: '/coach/staff', label: 'Staff' },
                  { href: '/coach/inbox', label: 'Inbox' },
                  { href: '/coach/profile', label: 'Profile' }
                ].map((item) => {
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-auto pt-6 border-t border-zinc-800">
                <div className="text-xs text-zinc-400 mb-2">Referral Code</div>
                <div className="text-lg font-bold text-[#E0FE10] mb-4">{coachProfile?.referralCode}</div>
                <button
                  onClick={() => { setMobileNavOpen(false); handleSignOut(); }}
                  className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Referrals moved to /coach/referrals */}

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

        {/* Shared Athletes (staff) */}
        {sharedAthletes.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Shared Athletes</h3>
              <span className="text-zinc-400">{sharedAthletes.length} assigned</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedAthletes.map((athlete) => (
                <AthleteCard
                  key={athlete.id}
                  athlete={athlete}
                  onViewDetails={()=>{}}
                  onMessageAthlete={()=>{}}
                />
              ))}
            </div>
          </div>
        )}

        {/* Invites Inbox (staff) */}
        {pendingInvites.length > 0 && (
          <div className="mt-12">
            <h3 className="text-2xl font-bold mb-4">Invites</h3>
            <div className="space-y-3">
              {pendingInvites.map((inv) => (
                <div key={inv.coachId} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                  <div className="text-zinc-300">You have been invited to join a coach’s staff.</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async ()=>{
                        if (!currentUser?.email) return;
                        const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
                        await updateDoc(memberRef, { status: 'accepted' });
                        // Refresh page state
                        setPendingInvites(prev => prev.filter(p => p.coachId !== inv.coachId));
                        // Try to load shared athletes now
                        if (inv.permission === 'full') {
                          const connected = await coachService.getConnectedAthletes(inv.coachId);
                          setSharedAthletes(connected);
                        } else if (inv.allowedAthletes && inv.allowedAthletes.length) {
                          const results: any[] = [];
                          await Promise.all(inv.allowedAthletes.map(async (aid: string) => {
                            const uref = doc(db, 'users', aid);
                            const usnap = await getDoc(uref);
                            if (usnap.exists()) results.push({ id: aid, ...usnap.data() });
                          }));
                          setSharedAthletes(results);
                        }
                      }}
                      className="bg-[#E0FE10] text-black px-3 py-1.5 rounded-md"
                    >Accept</button>
                    <button
                      onClick={async ()=>{
                        if (!currentUser?.email) return;
                        const memberRef = doc(db, 'coach-staff', inv.coachId, 'members', currentUser.email.toLowerCase());
                        await updateDoc(memberRef, { status: 'declined' });
                        setPendingInvites(prev => prev.filter(p => p.coachId !== inv.coachId));
                      }}
                      className="bg-zinc-800 border border-zinc-700 px-3 py-1.5 rounded-md"
                    >Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachDashboard;