import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Download, Loader2 } from 'lucide-react';
import styles from '../../../pages/PulseCheck/team-billing.module.css';

type Invoice = { id: string; number: string | null; created: number; currency: string; amountPaid: number; amountDue: number; total: number; status: string; hostedInvoiceUrl: string | null; invoicePdf: string | null };
type History = { invoices: Invoice[]; nextCursor: string | null };
const statusLabels: Record<string, string> = { paid: 'Paid', open: 'Payment due', void: 'Voided', uncollectible: 'Uncollectible', draft: 'Draft' };
const stripeLink = (value: string | null, pdf = false) => {
  try { const url = new URL(value || ''); return url.protocol === 'https:' && (pdf ? ['pay.stripe.com', 'invoice.stripe.com'] : ['invoice.stripe.com']).includes(url.hostname) ? url.href : undefined; } catch { return undefined; }
};
const money = (amount: number, currency: string) => {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  return formatter.format(amount / 10 ** (formatter.resolvedOptions().maximumFractionDigits ?? 2));
};

export default function PaymentHistory({ teamId, request }: { teamId: string; request: (name: string, body: object) => Promise<History> }) {
  const [history, setHistory] = useState<History>({ invoices: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const alive = useRef(false);
  const inFlight = useRef(false);
  const load = useCallback(async (cursor?: string) => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true); setError('');
    try {
      const result = await request('get-pulsecheck-athlete-invoices', { teamId, ...(cursor ? { cursor } : {}) });
      if (alive.current) setHistory(previous => ({ invoices: cursor ? [...previous.invoices, ...result.invoices.filter(item => !previous.invoices.some(old => old.id === item.id))] : result.invoices, nextCursor: result.nextCursor }));
    } catch { if (alive.current) setError('Your payment history could not be loaded. Please try again.'); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  }, [request, teamId]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [load]);
  return <section className={`${styles.card} ${styles.history}`} aria-labelledby="history-title" aria-busy={loading}>
    <h2 id="history-title">Payment history</h2>
    <p className={styles.description}>Invoices for your team membership.</p>
    {history.invoices.length > 0 && <ul className={styles.invoiceList}>{history.invoices.map(invoice => {
      const view = stripeLink(invoice.hostedInvoiceUrl);
      const pdf = stripeLink(invoice.invoicePdf, true);
      return <li key={invoice.id} className={styles.invoice}>
        <div className={styles.invoiceTop}><time dateTime={new Date(invoice.created * 1000).toISOString()}>{new Date(invoice.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time><strong>{money(invoice.status === 'paid' ? invoice.amountPaid : invoice.total, invoice.currency)}</strong></div>
        <div className={styles.invoiceMeta}><span>{invoice.number || 'Invoice'}</span><span className={invoice.status === 'paid' ? styles.paid : styles.invoiceStatus}>{statusLabels[invoice.status] || 'Pending'}</span></div>
        {(view || pdf) && <div className={styles.invoiceLinks}>{view && <a href={view} target="_blank" rel="noopener noreferrer" aria-label={`View invoice ${invoice.number || ''}`}>View invoice <ArrowUpRight size={14} /></a>}{pdf && <a href={pdf} target="_blank" rel="noopener noreferrer" aria-label={`Download invoice ${invoice.number || ''} PDF`}>PDF <Download size={14} /></a>}</div>}
      </li>;
    })}</ul>}
    {loading && <p className={styles.loading} role="status"><Loader2 size={18} className={styles.spinner} /> Loading invoices…</p>}
    {!loading && !error && !history.invoices.length && <p className={styles.notice}>{history.nextCursor ? 'No team invoices in this batch. Check older invoices below.' : 'No invoices yet.'}</p>}
    {error && <div className={styles.error}><p role="alert">{error}</p><button className={styles.secondary} onClick={() => void load(history.nextCursor || undefined)}>Try again</button></div>}
    {!error && history.nextCursor && <button className={styles.secondary} disabled={loading} onClick={() => void load(history.nextCursor!)}>Load older invoices</button>}
  </section>;
}
