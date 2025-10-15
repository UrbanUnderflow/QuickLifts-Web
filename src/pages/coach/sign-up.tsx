import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { User, SubscriptionType, SubscriptionPlatform, UserLevel } from '../../api/firebase/user';
import { userService } from '../../api/firebase/user';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { FaGoogle, FaApple } from 'react-icons/fa';
import { coachAuth } from '../../api/firebase/auth/coachAuth';
import { coachService } from '../../api/firebase/coach';
import { db } from '../../api/firebase/config';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useUser } from '../../hooks/useUser';

const CoachSignUpPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthUser, setOauthUser] = useState<any | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const ensureCoachProfile = async (uid: string) => {
    try {
      const existingProfile = await coachService.getCoachProfile(uid);
      if (existingProfile) return existingProfile;
      const created = await coachService.createPartnerProfile(uid);
      return created;
    } catch (e: any) {
      console.error('[coach/sign-up] ensureCoachProfile error', e);
      setError(e?.message || 'Failed to set up coach profile');
      return null;
    }
  };

  // Persist referrer code from ?ref= in localStorage so we can link after sign-up
  useEffect(() => {
    const ref = (router.query.ref as string) || '';
    if (typeof window !== 'undefined' && ref) {
      try { localStorage.setItem('pulse_referring_coach_code', ref.toUpperCase()); } catch (_) {}
    }
  }, [router.query.ref]);

  const maybeLinkReferringCoach = async (uid: string, inviteeUsername: string, inviteeEmail: string) => {
    try {
      if (typeof window === 'undefined') return;
      const ref = localStorage.getItem('pulse_referring_coach_code');
      if (!ref) return;
      await coachService.connectCoachToCoachByReferralCode(uid, inviteeUsername || '', inviteeEmail || '', ref);
      try { localStorage.removeItem('pulse_referring_coach_code'); } catch (_) {}
    } catch (_) { /* ignore linking failure */ }
  };

  // Username helpers
  const normalizedUsername = (val: string) => val.trim().toLowerCase();
  const validUsernameFormat = (val: string) => /^[a-z0-9_]{3,20}$/.test(val);

  const checkUsernameAvailability = async (name: string): Promise<boolean> => {
    const uname = normalizedUsername(name);
    if (!validUsernameFormat(uname)) {
      setUsernameError('Use 3-20 chars: letters, numbers, underscore');
      setIsAvailable(null);
      return false;
    }
    setUsernameError(null);
    setIsChecking(true);
    try {
      const ref = doc(db, 'usernames', uname);
      const snap = await getDoc(ref);
      const taken = snap.exists();
      setIsAvailable(!taken);
      return !taken;
    } catch (_) {
      setIsAvailable(null);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const claimUsername = async (uid: string, name: string) => {
    const uname = normalizedUsername(name);
    if (!validUsernameFormat(uname)) throw new Error('Invalid username');
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'usernames', uname);
      const snap = await tx.get(ref);
      if (snap.exists() && (snap.data() as any)?.userId !== uid) {
        throw new Error('Username already taken');
      }
      tx.set(ref, { userId: uid, username: uname, createdAt: serverTimestamp() });
    });
  };

  const saveUser = async (uid: string, userEmail: string, display: string, imageUrl: string) => {
    const u = new User(uid, {
      id: uid,
      email: userEmail,
      username: display,
      displayName: display,
      role: 'coach',
      registrationComplete: true,
      subscriptionType: SubscriptionType.unsubscribed,
      subscriptionPlatform: SubscriptionPlatform.Web,
      level: UserLevel.Novice,
      goal: [], bodyWeight: [], macros: {},
      profileImage: { profileImageURL: imageUrl, imageOffsetWidth: 0, imageOffsetHeight: 0 },
      bio: '', additionalGoals: '', blockedUsers: [], encouragement: [],
      isCurrentlyActive: false, videoCount: 0,
      // Ensure optional nested objects are either valid objects or nulls
      creator: null,
      winner: null,
      linkedCoachId: null,
      createdAt: new Date(), updatedAt: new Date()
    });
    await userService.updateUser(uid, u);
  };

  // If already signed-in with a complete user profile, auto-create coach profile and skip the form
  useEffect(() => {
    const autoCreate = async () => {
      try {
        if (!currentUser?.id) return;
        // If this user already exists in Firestore, ensure a coach profile and redirect
        const profile = await ensureCoachProfile(currentUser.id);
        if (profile) {
          await maybeLinkReferringCoach(currentUser.id, currentUser.username || '', currentUser.email || '');
          router.replace('/coach/dashboard');
        }
      } catch (_) {
        // fall back to form if something fails
      }
    };
    autoCreate();
  }, [currentUser?.id]);

  const handleGoogle = async () => {
    try {
      setLoading(true); setError(null);
      const res = await coachAuth.signInWithGoogle();
      const fb = res.user;
      const existing = await userService.fetchUserFromFirestore(fb.uid);
      if (existing) {
        // Upgrade existing user to coach if needed
        if (existing.role !== 'coach') {
          const upgraded = new User(existing.id || fb.uid, { ...existing, role: 'coach', registrationComplete: true, updatedAt: new Date() });
          await userService.updateUser(existing.id || fb.uid, upgraded);
        }
        // If no profile image on existing account, collect it here before redirect
        const hasImage = !!(existing as any)?.profileImage?.profileImageURL;
        if (!hasImage) {
          const suggested = (fb.displayName?.replace(/\s+/g, '_') || fb.email?.split('@')[0] || 'user').toLowerCase();
          setOauthUser(fb);
          setEmail(fb.email || (existing as any)?.email || '');
          setUsername((existing as any)?.username || suggested);
          setLoading(false);
          return; // show form to upload image and save
        }
        const profile = await ensureCoachProfile(fb.uid);
        if (profile) {
          await maybeLinkReferringCoach(fb.uid, (existing as any)?.username || username || '', fb.email || '');
          return router.replace('/coach/dashboard');
        }
        return;
      }
      const suggested = (fb.displayName?.replace(/\s+/g, '_') || fb.email?.split('@')[0] || 'user').toLowerCase();
      setOauthUser(fb); setEmail(fb.email || ''); setUsername(suggested);
    } catch (e: any) { setError(e?.message || 'Google sign-in failed'); }
    finally { setLoading(false); }
  };

  const handleApple = async () => {
    try {
      setLoading(true); setError(null);
      const res = await coachAuth.signInWithApple();
      const fb = res.user;
      const existing = await userService.fetchUserFromFirestore(fb.uid);
      if (existing) {
        if (existing.role !== 'coach') {
          const upgraded = new User(existing.id || fb.uid, { ...existing, role: 'coach', registrationComplete: true, updatedAt: new Date() });
          await userService.updateUser(existing.id || fb.uid, upgraded);
        }
        const hasImage = !!(existing as any)?.profileImage?.profileImageURL;
        if (!hasImage) {
          const suggested = (fb.displayName?.replace(/\s+/g, '_') || fb.email?.split('@')[0] || 'user').toLowerCase();
          setOauthUser(fb);
          setEmail(fb.email || (existing as any)?.email || '');
          setUsername((existing as any)?.username || suggested);
          setLoading(false);
          return;
        }
        const profile = await ensureCoachProfile(fb.uid);
        if (profile) {
          await maybeLinkReferringCoach(fb.uid, (existing as any)?.username || username || '', fb.email || '');
          return router.replace('/coach/dashboard');
        }
        return;
      }
      const suggested = (fb.displayName?.replace(/\s+/g, '_') || fb.email?.split('@')[0] || 'user').toLowerCase();
      setOauthUser(fb); setEmail(fb.email || ''); setUsername(suggested);
    } catch (e: any) { setError(e?.message || 'Apple sign-in failed'); }
    finally { setLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const uname = normalizedUsername(username);
    if (!validUsernameFormat(uname)) return setError('Username: 3-20 chars, letters, numbers, underscore');
    const available = await checkUsernameAvailability(uname);
    if (!available) return setError('Username is taken');
    try {
      setLoading(true);
      let imageUrl = '';
      if (profileFile) imageUrl = (await firebaseStorageService.uploadImage(profileFile, UploadImageType.Profile)).downloadURL;

      if (oauthUser) {
        await claimUsername(oauthUser.uid, uname);
        await saveUser(oauthUser.uid, oauthUser.email || '', uname, imageUrl);
        const profile = await ensureCoachProfile(oauthUser.uid);
        if (profile) {
          await maybeLinkReferringCoach(oauthUser.uid, uname, oauthUser.email || '');
          return router.replace('/coach/dashboard');
        }
        return;
      }

      if (!email) return setError('Email is required');
      if (!password || password.length < 6) return setError('Password must be at least 6 characters');
      if (password !== confirm) return setError('Passwords do not match');

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await claimUsername(cred.user.uid, uname);
      await saveUser(cred.user.uid, email, uname, imageUrl);
      const profile = await ensureCoachProfile(cred.user.uid);
      if (profile) {
        await maybeLinkReferringCoach(cred.user.uid, uname, email);
        router.replace('/coach/dashboard');
      }
    } catch (e: any) {
      setError(e?.message || 'Could not create account');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Head><title>Coach Sign Up | Pulse</title></Head>
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E0FE10] rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-black font-bold text-2xl">P</span></div>
          <h1 className="text-3xl font-bold mb-2">Join as a Coach</h1>
          <p className="text-zinc-400">Create your coach account in seconds</p>
        </div>

        {!oauthUser && (
          <div className="space-y-3 mb-6">
            <button onClick={handleGoogle} disabled={loading} className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-zinc-200 transition disabled:opacity-50 flex items-center justify-center gap-2"><FaGoogle /> Continue with Google</button>
            <button onClick={handleApple} disabled={loading} className="w-full bg-black border border-zinc-700 text-white font-semibold py-3 rounded-lg hover:bg-zinc-900 transition disabled:opacity-50 flex items-center justify-center gap-2"><FaApple /> Continue with Apple</button>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border-2 border-zinc-700">
                {previewUrl ? (<img src={previewUrl} alt="preview" className="w-full h-full object-cover" />) : (<span className="text-zinc-500">Photo</span>)}
              </div>
              <label htmlFor="profileImage" className="absolute -bottom-2 -right-2 bg-[#E0FE10] text-black px-2 py-1 rounded-full cursor-pointer">Upload
                <input id="profileImage" type="file" accept="image/*" onChange={(e)=>{const f=e.target.files?.[0]; setProfileFile(f||null); if(f) setPreviewUrl(URL.createObjectURL(f));}} className="hidden" />
              </label>
            </div>
          </div>

          {!oauthUser && (
            <div>
              <label className="block text-sm mb-2">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3" />
            </div>
          )}

          <div>
            <label className="block text-sm mb-2">Username</label>
            <div className="space-y-1">
              <input
                value={username}
                onChange={(e)=>{
                  const v = e.target.value;
                  setUsername(v);
                  // Live validate format so valid entries don't keep showing the error until blur
                  const uname = normalizedUsername(v);
                  if (validUsernameFormat(uname)) {
                    setUsernameError(null);
                  } else {
                    setUsernameError('Use 3-20 chars: letters, numbers, underscore');
                  }
                  setIsAvailable(null);
                }}
                onBlur={()=>checkUsernameAvailability(username)}
                type="text"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3"
                placeholder="e.g., coach_matthew"
              />
              <div className="text-xs">
                {usernameError && (<span className="text-red-400">{usernameError}</span>)}
                {!usernameError && isChecking && (<span className="text-zinc-400">Checking availability…</span>)}
                {!usernameError && isAvailable === true && (<span className="text-green-400">Username is available</span>)}
                {!usernameError && isAvailable === false && (<span className="text-red-400">Username is taken</span>)}
              </div>
            </div>
          </div>

          {!oauthUser && (
            <>
              <div>
                <label className="block text-sm mb-2">Password</label>
                <input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3" />
              </div>
              <div>
                <label className="block text-sm mb-2">Confirm Password</label>
                <input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3" />
              </div>
            </>
          )}

          {error && (<div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>)}

          <button disabled={loading} className="w-full bg-[#E0FE10] text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition disabled:opacity-50">
            {loading ? (oauthUser ? 'Saving Profile...' : 'Creating Account...') : (oauthUser ? 'Save Coach Profile' : 'Create Coach Account')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CoachSignUpPage;


