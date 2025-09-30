import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import { User, SubscriptionType, SubscriptionPlatform, UserLevel } from '../../api/firebase/user';
import { userService } from '../../api/firebase/user';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { FaGoogle, FaApple } from 'react-icons/fa';
import { coachAuth } from '../../api/firebase/auth/coachAuth';

const CoachSignUpPage: React.FC = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthUser, setOauthUser] = useState<any | null>(null);

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
      isCurrentlyActive: false, videoCount: 0, creator: null, winner: null,
      createdAt: new Date(), updatedAt: new Date()
    });
    await userService.updateUser(uid, u);
  };

  const handleGoogle = async () => {
    try {
      setLoading(true); setError(null);
      const res = await coachAuth.signInWithGoogle();
      const fb = res.user;
      const existing = await userService.fetchUserFromFirestore(fb.uid);
      if (existing) return router.push('/coach/dashboard');
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
      if (existing) return router.push('/coach/dashboard');
      const suggested = (fb.displayName?.replace(/\s+/g, '_') || fb.email?.split('@')[0] || 'user').toLowerCase();
      setOauthUser(fb); setEmail(fb.email || ''); setUsername(suggested);
    } catch (e: any) { setError(e?.message || 'Apple sign-in failed'); }
    finally { setLoading(false); }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || username.length < 3) return setError('Username must be at least 3 characters');
    try {
      setLoading(true);
      let imageUrl = '';
      if (profileFile) imageUrl = (await firebaseStorageService.uploadImage(profileFile, UploadImageType.Profile)).downloadURL;

      if (oauthUser) {
        await saveUser(oauthUser.uid, oauthUser.email || '', username, imageUrl);
        return router.push('/coach/dashboard');
      }

      if (!email) return setError('Email is required');
      if (!password || password.length < 6) return setError('Password must be at least 6 characters');
      if (password !== confirm) return setError('Passwords do not match');

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await saveUser(cred.user.uid, email, username, imageUrl);
      router.push('/coach/dashboard');
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
            <input value={username} onChange={e=>setUsername(e.target.value)} type="text" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3" />
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


