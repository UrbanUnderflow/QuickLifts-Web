import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { useUser } from '../../hooks/useUser';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { userService } from '../../api/firebase/user';
import { db } from '../../api/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FaBars, FaTimes } from 'react-icons/fa';
import { signOut } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { showToast } from '../../redux/toastSlice';

const CoachProfilePage: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const currentUser = useUser();
  const [bio, setBio] = useState('');
  const [serviceTitle, setServiceTitle] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [services, setServices] = useState<Array<{ title: string; description?: string; priceCents: number }>>([]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [website, setWebsite] = useState('');
  const [otherLink, setOtherLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<'unknown'|'not_started'|'incomplete'|'active'>('unknown');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [onboardingLink, setOnboardingLink] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ totalEarned: number; pendingPayout: number; availableBalance: number; recentSales: Array<{date:string, amount:number, roundTitle:string}> } | null>(null);
  const [buyers, setBuyers] = useState<Record<string, { username?: string; email?: string }>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(()=>{
    const load = async () => {
      if (!currentUser || loaded) return;
      setBio(currentUser.bio || '');
      setImageUrl(currentUser.profileImage?.profileImageURL || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      try {
        const ref = doc(db, 'users', currentUser.id);
        const snap = await getDoc(ref);
        const data: any = snap.exists() ? snap.data() : {};
        if (Array.isArray(data.services)) {
          setServices(
            data.services
              .filter((s: any) => s && typeof s.title === 'string')
              .map((s: any) => ({ title: s.title, description: s.description || '', priceCents: Number(s.priceCents) || 0 }))
          );
        }
        const links = data.links || {};
        setInstagram(links.instagram || '');
        setYoutube(links.youtube || '');
        setWebsite(links.website || '');
        setOtherLink(links.other || '');
        // Stripe status
        const creator = data.creator || {};
        const hasAcct = !!creator.stripeAccountId;
        const status = creator.onboardingStatus || (hasAcct ? 'complete' : 'not_started');
        setStripeStatus(status === 'complete' ? 'active' : (status === 'incomplete' ? 'incomplete' : 'not_started'));
        setOnboardingLink(creator.onboardingLink || null);
      } catch (_) {}
      setLoaded(true);
    };
    load();
  }, [currentUser, loaded]);

  useEffect(()=>{
    const fetchEarnings = async () => {
      if (!currentUser) return;
      try {
        const res = await fetch(`/.netlify/functions/get-earnings?userId=${encodeURIComponent(currentUser.id)}`);
        const json = await res.json().catch(()=>({}));
        if (json?.success && json?.earnings) {
          const e = json.earnings;
          setEarnings({
            totalEarned: e.totalEarned || 0,
            pendingPayout: e.pendingPayout || 0,
            availableBalance: e.availableBalance || 0,
            recentSales: Array.isArray(e.recentSales) ? e.recentSales.map((s:any)=>({ date: s.date, amount: s.amount, roundTitle: s.roundTitle })) : []
          });
        }
      } catch (_) {}
    };
    if (stripeStatus === 'active') fetchEarnings();
  }, [currentUser?.id, stripeStatus]);

  // Resolve buyer names for recent sales
  useEffect(()=>{
    const loadBuyers = async () => {
      if (!earnings?.recentSales?.length) return;
      const ids = Array.from(new Set((earnings.recentSales as any[])
        .map((s:any)=> s.buyerId)
        .filter((id:string)=> typeof id === 'string' && id !== 'anonymous' && id !== 'unknown')));
      const map: Record<string, {username?: string; email?: string}> = {};
      await Promise.all(ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, 'users', id));
          if (snap.exists()) {
            const u: any = snap.data();
            map[id] = { username: u.username || u.displayName, email: u.email };
          }
        } catch (_) {}
      }));
      setBuyers(prev => ({ ...prev, ...map }));
    };
    loadBuyers();
  }, [earnings?.recentSales]);

  const onImageChange = async (file: File) => {
    try {
      setUploading(true);
      const res = await firebaseStorageService.uploadImage(file, UploadImageType.Profile);
      setImageUrl(res.downloadURL);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const payload = {
        bio,
        username: username || '',
        email: email || '',
        profileImage: { ...(currentUser.profileImage || {}), profileImageURL: imageUrl },
        links: {
          instagram: instagram || '',
          youtube: youtube || '',
          website: website || '',
          other: otherLink || ''
        }
      } as any;
      await setDoc(doc(db, 'users', currentUser.id), payload, { merge: true });
      // Persist services alongside user doc (keep immediate writes but ensure merged here too)
      if (services) {
        await setDoc(doc(db, 'users', currentUser.id), { services }, { merge: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      try { localStorage.removeItem('pulse_has_seen_marketing'); } catch (_) {}
      router.replace('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const addService = () => {
    const title = serviceTitle.trim();
    if (!title) return;
    // Parse price: allow $ and commas, decimals → cents
    const normalized = servicePrice.trim().replace(/[$,\s]/g, '');
    const priceNumber = Number(normalized || '0');
    const priceCents = Math.round(priceNumber * 100);
    const description = serviceDescription.trim();
    const next = [...services, { title, description, priceCents }];
    setServices(next);
    // Persist immediately
    if (currentUser) {
      setDoc(doc(db, 'users', currentUser.id), { services: next }, { merge: true }).catch(() => {});
    }
    setServiceTitle('');
    setServiceDescription('');
    setServicePrice('');
  };

  const removeService = (index: number) => {
    const next = services.filter((_, i) => i !== index);
    setServices(next);
    // Persist immediately
    if (currentUser) {
      setDoc(doc(db, 'users', currentUser.id), { services: next }, { merge: true }).catch(() => {});
    }
  };

  const startStripeOnboarding = async () => {
    if (!currentUser) {
      dispatch(showToast({ message: 'Please sign in to continue', type: 'error' }));
      return;
    }
    
    // Validate user has an email before proceeding
    if (!currentUser.email || currentUser.email.trim() === '') {
      dispatch(showToast({ 
        message: 'Your account is missing an email address. Please update your profile first.', 
        type: 'error',
        duration: 6000
      }));
      return;
    }
    
    setStripeLoading(true);
    try {
      console.log('[CoachProfile] Starting Stripe onboarding for user:', currentUser.id, 'email:', currentUser.email);
      const res = await fetch(`/.netlify/functions/create-connected-account?userId=${encodeURIComponent(currentUser.id)}`);
      
      if (!res.ok) {
        let errorMessage = `Failed to start onboarding (Error ${res.status})`;
        let errorDetails = '';
        
        try {
          const errorJson = await res.json();
          console.error('[CoachProfile] Stripe onboarding API error:', { 
            status: res.status, 
            error: errorJson 
          });
          
          // Use server-provided error message if available
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
          if (errorJson.details) {
            errorDetails = errorJson.details;
          }
          if (errorJson.code) {
            errorDetails = `${errorDetails} (Code: ${errorJson.code})`.trim();
          }
        } catch (parseErr) {
          const errorText = await res.text();
          console.error('[CoachProfile] Failed to parse error response:', { errorText, parseErr });
          errorDetails = 'Unable to parse server error';
        }
        
        dispatch(showToast({ 
          message: errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage, 
          type: 'error',
          duration: 7000
        }));
        return;
      }
      
      const json = await res.json().catch((err) => {
        console.error('[CoachProfile] Failed to parse JSON response:', err);
        return {};
      });
      
      if (json?.accountLink) {
        console.log('[CoachProfile] Opening Stripe onboarding in new tab');
        const newWindow = window.open(json.accountLink, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed) {
          // Popup was blocked - show helpful message
          dispatch(showToast({ 
            message: 'Please allow popups for this site to complete Stripe onboarding', 
            type: 'warning',
            duration: 5000
          }));
          // Fallback: open in same tab
          window.location.href = json.accountLink;
        } else {
          dispatch(showToast({ 
            message: 'Opening Stripe onboarding in new tab...', 
            type: 'info',
            duration: 3000
          }));
        }
        return;
      }
      
      // No accountLink in response - try Firestore fallback
      console.log('[CoachProfile] No accountLink in API response, checking Firestore');
      const ref = doc(db, 'users', currentUser.id);
      const snap = await getDoc(ref);
      const data: any = snap.exists() ? snap.data() : {};
      const link = data?.creator?.onboardingLink;
      
      if (link) {
        console.log('[CoachProfile] Found onboarding link in Firestore, opening in new tab');
        const newWindow = window.open(link, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed) {
          dispatch(showToast({ 
            message: 'Please allow popups for this site to complete Stripe onboarding', 
            type: 'warning',
            duration: 5000
          }));
          window.location.href = link;
        }
      } else {
        // No link found anywhere
        console.error('[CoachProfile] No onboarding link found in API or Firestore');
        dispatch(showToast({ 
          message: 'Unable to generate onboarding link. Please contact support with your user ID: ' + currentUser.id.slice(0, 8), 
          type: 'error',
          duration: 6000
        }));
      }
    } catch (err) {
      console.error('[CoachProfile] Unexpected error during Stripe onboarding:', err);
      dispatch(showToast({ 
        message: 'An unexpected error occurred. Please try again or contact support.', 
        type: 'error',
        duration: 5000
      }));
    } finally {
      setStripeLoading(false);
    }
  };

  const openStripeUpdate = async () => {
    if (!currentUser) {
      dispatch(showToast({ message: 'Please sign in to continue', type: 'error' }));
      return;
    }
    setStripeLoading(true);
    try {
      const url = `/.netlify/functions/create-account-update-link?userId=${encodeURIComponent(currentUser.id)}&accountType=creator`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[CoachProfile] Stripe update API error:', { status: res.status, error: errorText });
        dispatch(showToast({ 
          message: `Failed to open Stripe dashboard (Error ${res.status}). Please try again.`, 
          type: 'error',
          duration: 5000
        }));
        return;
      }
      
      const json = await res.json().catch(()=>({}));
      const link = json?.link || json?.onboardingLink || json?.accountLink;
      
      if (link) {
        const newWindow = window.open(link, '_blank', 'noopener,noreferrer');
        if (!newWindow || newWindow.closed) {
          dispatch(showToast({ 
            message: 'Please allow popups to access Stripe dashboard', 
            type: 'warning',
            duration: 5000
          }));
          window.location.href = link;
        }
      } else {
        console.error('[CoachProfile] No link in update response');
        dispatch(showToast({ 
          message: 'Unable to generate Stripe dashboard link. Please contact support.', 
          type: 'error',
          duration: 5000
        }));
      }
    } catch (err) {
      console.error('[CoachProfile] Unexpected error opening Stripe update:', err);
      dispatch(showToast({ 
        message: 'An unexpected error occurred. Please try again.', 
        type: 'error',
        duration: 5000
      }));
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Coach Profile</h1>
            <p className="text-zinc-400">Update your photo, bio, and services</p>
          </div>
          <nav className="hidden md:flex items-center gap-2">
            {[
              { href: '/coach/dashboard', label: 'Dashboard' },
              { href: '/coach/referrals', label: 'Referrals' },
              { href: '/coach/staff', label: 'Staff' },
              { href: '/coach/profile', label: 'Profile' }
            ].map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-[#E0FE10] text-black' : 'text-zinc-300 hover:text-white hover:bg-zinc-800'}`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <FaBars />
          </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex flex-col items-center justify-center w-full">
            <div className="text-sm text-zinc-400 mb-4">Update Profile Image</div>
            <img
              src={imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.username||'Coach')}&background=E0FE10&color=000000&size=128`}
              className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full object-cover border border-zinc-700"
            />
            <label className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg cursor-pointer mt-4">
              {uploading ? 'Uploading...' : 'Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={(e)=>{const f = e.target.files?.[0]; if (f) onImageChange(f);}} />
            </label>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 lg:col-span-2">
            {/* Account Info */}
            <div className="mb-4">
              <div className="text-sm text-zinc-400 mb-2">Account Info</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Username" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="mb-4">
              <div className="text-sm text-zinc-400 mb-2">Bio</div>
              <textarea value={bio} onChange={(e)=>setBio(e.target.value)} rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3" />
            </div>
            {/* Stripe Connect */}
            <div className="mb-6">
              <div className="text-sm text-zinc-400 mb-2">Stripe Connect</div>
              {stripeStatus !== 'active' ? (
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div>
                    <div className="text-white font-medium">Payouts not set up</div>
                    <div className="text-zinc-400 text-sm">Connect your Stripe account to receive payments for Additional Services.</div>
                  </div>
                  <button onClick={startStripeOnboarding} disabled={stripeLoading} className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg disabled:opacity-50">
                    {stripeLoading ? 'Loading…' : 'Start onboarding'}
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">Stripe Connected</div>
                      <div className="text-zinc-400 text-sm">Your payouts are active. View dashboard or update details.</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={openStripeUpdate} disabled={stripeLoading} className="bg-zinc-800 border border-zinc-700 px-3 py-2 rounded-lg">
                        {stripeLoading ? 'Loading…' : 'Update details'}
                      </button>
                      <a href="/.netlify/functions/get-dashboard-link-unified?accountType=creator" className="bg-[#E0FE10] text-black px-3 py-2 rounded-lg">Open Stripe</a>
                    </div>
                  </div>
                  {/* Earnings summary + recent transactions */}
                  <div className="mt-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-zinc-800/60 rounded-lg p-3">
                        <div className="text-xs text-zinc-400">Total earned</div>
                        <div className="text-lg font-semibold text-white">${earnings ? earnings.totalEarned.toFixed(2) : '0.00'}</div>
                      </div>
                      <div className="bg-zinc-800/60 rounded-lg p-3">
                        <div className="text-xs text-zinc-400">Available</div>
                        <div className="text-lg font-semibold text-white">${earnings ? earnings.availableBalance.toFixed(2) : '0.00'}</div>
                      </div>
                      <div className="bg-zinc-800/60 rounded-lg p-3">
                        <div className="text-xs text-zinc-400">Pending</div>
                        <div className="text-lg font-semibold text-white">${earnings ? earnings.pendingPayout.toFixed(2) : '0.00'}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-sm text-zinc-400 mb-2">Recent sales</div>
                      {earnings?.recentSales?.length ? (
                        <div className="border border-zinc-800 rounded-lg overflow-hidden">
                          <table className="min-w-full text-sm">
                            <thead className="bg-zinc-900 text-zinc-400">
                              <tr>
                                <th className="text-left px-3 py-2">Buyer</th>
                                <th className="text-left px-3 py-2">Service</th>
                                <th className="text-left px-3 py-2">Date</th>
                                <th className="text-right px-3 py-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(earnings.recentSales as any[]).slice(0,10).map((s:any, idx:number) => {
                                const buyer = buyers[s.buyerId] || {};
                                const buyerLabel = (buyer.username && buyer.username.length ? buyer.username : '')
                                  || (buyer.email && buyer.email.length ? buyer.email : '')
                                  || (s.buyerId && s.buyerId !== 'anonymous' && s.buyerId !== 'unknown' ? s.buyerId : '');
                                return (
                                  <tr key={idx} className="border-t border-zinc-800">
                                    <td className="px-3 py-2 text-white">{buyerLabel}</td>
                                    <td className="px-3 py-2 text-zinc-300">{s.roundTitle || 'Service'}</td>
                                    <td className="px-3 py-2 text-zinc-400">{s.date}</td>
                                    <td className="px-3 py-2 text-right text-white">${s.amount.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-500">No sales yet</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Links */}
            <div className="mb-6">
              <div className="text-sm text-zinc-400 mb-2">Links</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={instagram} onChange={(e)=>setInstagram(e.target.value)} placeholder="Instagram URL" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={youtube} onChange={(e)=>setYoutube(e.target.value)} placeholder="YouTube URL" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="Personal Website" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={otherLink} onChange={(e)=>setOtherLink(e.target.value)} placeholder="Other Link" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="mb-6">
              <div className="text-sm text-zinc-400 mb-2">Additional Services</div>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-3">
                <input value={serviceTitle} onChange={(e)=>setServiceTitle(e.target.value)} placeholder="Service title (e.g., 1:1 Coaching)" className="w-full md:flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={serviceDescription} onChange={(e)=>setServiceDescription(e.target.value)} placeholder="Description (optional)" className="w-full md:flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <input value={servicePrice} onChange={(e)=>setServicePrice(e.target.value)} placeholder="$ Price" className="w-full md:w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2" />
                <button onClick={addService} type="button" className="w-full md:w-auto bg-[#E0FE10] text-black px-4 py-2 rounded-lg hover:bg-lime-400">Add</button>
              </div>
              {services.length > 0 && (
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-900 text-zinc-400">
                      <tr>
                        <th className="text-left px-3 py-2">Title</th>
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-left px-3 py-2">Price</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((s, idx) => (
                        <tr key={`${s.title}-${idx}`} className="border-t border-zinc-800">
                          <td className="px-3 py-2">{s.title}</td>
                          <td className="px-3 py-2 text-zinc-400 max-w-[520px] truncate">{s.description || ''}</td>
                          <td className="px-3 py-2">${(s.priceCents/100).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={()=>removeService(idx)} className="text-zinc-300 hover:text-white">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <button onClick={onSave} disabled={saving} className="bg-[#E0FE10] text-black px-5 py-2 rounded-lg hover:bg-lime-400 disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachProfilePage;


