import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import BaselineHealthBackups from '../../components/admin/BaselineHealthBackups';

export default function BaselineHealthBackupsPage() {
  return <AdminRouteGuard>
    <main className="min-h-screen bg-clay-paper px-4 py-8 text-clay-ink sm:px-6">
      <Head><title>Private baseline backups | PulseCheck Admin</title><meta name="robots" content="noindex,nofollow" /></Head>
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/pulsecheckProvisioning" className="inline-flex items-center gap-2 text-sm font-semibold text-clay-ink2 hover:text-clay-ink"><ArrowLeft size={16} />Provisioning</Link>
        <div className="mb-7 mt-5 max-w-3xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-clay-ink2"><ShieldCheck size={16} />Admin access</p>
          <h1 className="text-3xl sm:text-4xl">Private baseline backups</h1>
          <p className="mt-3 text-sm leading-6 text-clay-ink2">See which private backups are waiting for AuntEdna, try delivery again, and remove a Pulse copy after AuntEdna confirms receipt.</p>
        </div>
        <BaselineHealthBackups />
      </div>
    </main>
  </AdminRouteGuard>;
}
