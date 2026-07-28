import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { db } from '../../../api/firebase/config';

type ServiceOrder = {
  serviceTitle?: string;
  serviceDescription?: string;
  coachName?: string;
  amountCents?: number;
  coachPriceCents?: number;
  processingFeeCents?: number;
  currency?: string;
  status?: string;
};

const money = (cents?: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((Number(cents) || 0) / 100);

const PulseCheckServicePurchaseSuccess: React.FC = () => {
  const router = useRouter();
  const orderId = typeof router.query.orderId === 'string' ? router.query.orderId : '';
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'pulsecheck-coach-service-orders', orderId));
        if (!cancelled) setOrder(snap.exists() ? (snap.data() as ServiceOrder) : null);
      } catch {
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const currency = order?.currency || 'usd';

  return (
    <>
      <Head>
        <title>Service purchased | PulseCheck</title>
      </Head>
      <main className="min-h-screen bg-[#07080c] px-5 py-12 text-white">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-[#E0FE10]/5 p-8 shadow-2xl shadow-black/40">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
              <CheckCircle2 className="h-7 w-7 text-emerald-300" />
            </div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-[#E0FE10]">
              PulseCheck
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">
              Service purchased successfully
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              {loading
                ? 'Loading your service details…'
                : order
                  ? `You’re set. ${order.coachName || 'Your coach'} now has this service attached to your account.`
                  : 'Your payment was completed. If details do not appear here, return to PulseCheck and refresh your conversation.'}
            </p>

            {order ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10">
                    <ClipboardList className="h-4 w-4 text-cyan-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold">{order.serviceTitle || 'Coach service'}</div>
                    {order.serviceDescription ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                        {order.serviceDescription}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-zinc-500">
                        Service price
                        <span className="block text-sm font-bold text-white">
                          {money(order.coachPriceCents, currency)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-zinc-500">
                        Processing
                        <span className="block text-sm font-bold text-cyan-200">
                          {money(order.processingFeeCents, currency)}
                        </span>
                      </div>
                      <div className="rounded-xl border border-[#E0FE10]/15 bg-[#E0FE10]/5 p-3 text-zinc-500">
                        Total
                        <span className="block text-sm font-bold text-[#E0FE10]">
                          {money(order.amountCents, currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
};

export default PulseCheckServicePurchaseSuccess;
