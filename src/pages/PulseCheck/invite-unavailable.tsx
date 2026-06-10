import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import { Mail, RefreshCcw } from 'lucide-react';

/**
 * Friendly landing for invite links that can't be opened — used instead of a
 * cold 404 when a PulseCheck team invite is already redeemed, revoked, expired,
 * or not found. The team-invite [token] page redirects here with ?reason=...
 */
const COPY: Record<string, { title: string; body: string }> = {
  redeemed: {
    title: 'This invite was already used',
    body: 'Single-use invites only work once. If you still need to join, ask your coach to send you a fresh link.',
  },
  revoked: {
    title: 'This invite was turned off',
    body: 'Your coach turned off this invite. Ask them to send you a new one to join the team.',
  },
  expired: {
    title: 'This invite has expired',
    body: 'This invite link is no longer active. Ask your coach for a new link to join the team.',
  },
  'not-found': {
    title: "We couldn't find this invite",
    body: 'This link may be mistyped or no longer exists. Double-check the link, or ask your coach to resend it.',
  },
  default: {
    title: "This invite can't be opened",
    body: 'This link is no longer active. Ask your coach to send you a new invite to join the team.',
  },
};

export const getServerSideProps: GetServerSideProps<{ reason: string }> = async ({ query }) => {
  const reason = typeof query.reason === 'string' ? query.reason : 'default';
  return { props: { reason } };
};

export default function InviteUnavailablePage({ reason }: { reason: string }) {
  const router = useRouter();
  const copy = COPY[reason] || COPY.default;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16 text-white" style={{ background: '#0b0b0d' }}>
      <Head>
        <title>Invite unavailable | PulseCheck</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div
        className="w-full max-w-md rounded-[28px] border border-white/10 p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
        style={{ background: 'radial-gradient(circle at top, rgba(124,58,237,0.12), transparent 60%), #111118' }}
      >
        <div className="mx-auto inline-flex rounded-2xl border border-[#7C3AED]/30 bg-[#7C3AED]/10 p-3">
          <Mail className="h-6 w-6 text-[#A78BFA]" />
        </div>

        <h1 className="mt-6 text-2xl font-bold">{copy.title}</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">{copy.body}</p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.reload()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
          >
            <RefreshCcw className="h-4 w-4" /> Try again
          </button>
          <Link
            href="https://pulsecheckmind.ai"
            className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: '#7C3AED' }}
          >
            Learn about PulseCheck
          </Link>
        </div>

        <p className="mt-6 text-xs leading-6 text-zinc-600">
          Need help? Contact your coach, or email{' '}
          <a href="mailto:hello@fitwithpulse.ai" className="text-zinc-400 underline">
            hello@fitwithpulse.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}
