import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { convertFirestoreTimestamp, formatDate } from '../../utils/formatDate';

type Payment = {
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  challengeId?: string;
  challengeTitle?: string;
  createdAt?: number | string | Date;
  updatedAt?: number | string | Date;
  platformFee?: number;
  ownerAmount?: number;
};

const centsToUsd = (cents?: number) => {
  if (!cents && cents !== 0) return '';
  return `$${(cents / 100).toFixed(2)}`;
};

const PaymentHistory: React.FC = () => {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.user.currentUser);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchPayments = async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'payments'),
          where('buyerId', '==', user.id),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const rows: Payment[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() as any;
          rows.push({
            paymentId: data.paymentId || docSnap.id,
            amount: data.amount,
            currency: (data.currency || 'usd').toUpperCase(),
            status: data.status || 'completed',
            challengeId: data.challengeId,
            challengeTitle: data.challengeTitle,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            platformFee: data.platformFee,
            ownerAmount: data.ownerAmount,
          });
        });
        setPayments(rows);
      } catch (e: any) {
        setError(e?.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, [user]);

  useEffect(() => {
    // Gate: redirect to home if not signed in
    if (user === null) {
      router.replace('/');
    }
  }, [user, router]);

  const hasUser = useMemo(() => !!user, [user]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>Payment History | Pulse</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Payment History</h1>
        {!hasUser && (
          <p className="text-zinc-400">You must be signed in to view this page.</p>
        )}
        {hasUser && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="grid grid-cols-12 text-zinc-400 px-4 py-3 border-b border-zinc-800 text-sm">
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Fee</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            {loading && (
              <div className="px-4 py-6 text-zinc-400">Loading payments…</div>
            )}
            {error && (
              <div className="px-4 py-6 text-red-400">{error}</div>
            )}
            {!loading && !error && payments.length === 0 && (
              <div className="px-4 py-6 text-zinc-400">No payments found.</div>
            )}
            {!loading && !error && payments.map((p) => {
              const created = convertFirestoreTimestamp(p.createdAt as any);
              return (
                <div key={p.paymentId} className="grid grid-cols-12 px-4 py-4 border-b border-zinc-800 last:border-0">
                  <div className="col-span-4">
                    <div className="font-medium text-white">
                      {p.challengeTitle || 'Subscription'}
                    </div>
                    <div className="text-xs text-zinc-500">#{p.paymentId}</div>
                  </div>
                  <div className="col-span-2 text-zinc-300">
                    {formatDate(created)}
                  </div>
                  <div className="col-span-2 text-right text-zinc-200">
                    {centsToUsd(p.amount)}
                  </div>
                  <div className="col-span-2 text-right text-zinc-400">
                    {p.platformFee != null ? centsToUsd(p.platformFee) : '—'}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'succeeded' || p.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700 text-zinc-200'}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;


