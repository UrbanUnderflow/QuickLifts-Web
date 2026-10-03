import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../api/firebase/config';
import TeamTrainerSharing from '../../components/pulsecheck/TeamTrainerSharing';

export default function TeamSharingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, current => { setUser(current); setReady(true); }), []);
  return <main style={{ minHeight: '100vh', background: '#f6f7f3', color: '#23362e', padding: '32px 16px' }}>
    <Head><title>Team trainer sharing | AthleticMind</title><meta name="robots" content="noindex" /></Head>
    <div style={{ maxWidth: 760, margin: '0 auto 24px' }}><Link href="/PulseCheck?section=profile&settings=1">← Back to profile settings</Link></div>
    {!ready ? <p role="status">Loading your account…</p> : user ? <TeamTrainerSharing key={user.uid} user={user} /> :
      <div style={{ maxWidth: 760, margin: '0 auto' }}><h1>Sign in to manage team sharing</h1><p>Your choices are saved to your athlete account.</p><Link href="/PulseCheck?section=profile&settings=1">Sign in to PulseCheck</Link></div>}
  </main>;
}
