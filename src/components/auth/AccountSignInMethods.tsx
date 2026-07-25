import React, { useMemo, useState } from 'react';
import { CheckCircle2, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { auth } from '../../api/firebase/config';
import {
  getProviderLabel,
  linkProviderToCurrentAccount,
  listLinkedProviders,
  unlinkProviderFromCurrentAccount,
  type LinkableProvider,
} from '../../api/firebase/auth/accountLinking';

const CONNECTABLE_PROVIDERS: LinkableProvider[] = ['apple.com', 'google.com'];

const AccountSignInMethods: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [connecting, setConnecting] = useState<LinkableProvider | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const user = auth.currentUser;
  const linkedProviders = useMemo(
    () => (user ? listLinkedProviders(user) : []),
    [user, refreshKey],
  );

  const connect = async (providerId: LinkableProvider) => {
    setConnecting(providerId);
    setMessage(null);
    try {
      await linkProviderToCurrentAccount(providerId);
      setRefreshKey((value) => value + 1);
      setMessage({
        type: 'success',
        text: `${getProviderLabel(providerId)} now opens this same Pulse account.`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || `${getProviderLabel(providerId)} could not be connected.`,
      });
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async (providerId: LinkableProvider) => {
    if (!window.confirm(`Remove ${getProviderLabel(providerId)} from this Pulse account?`)) return;
    setConnecting(providerId);
    setMessage(null);
    try {
      await unlinkProviderFromCurrentAccount(providerId);
      setRefreshKey((value) => value + 1);
      setMessage({
        type: 'success',
        text: `${getProviderLabel(providerId)} was removed from this account.`,
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || `${getProviderLabel(providerId)} could not be removed.`,
      });
    } finally {
      setConnecting(null);
    }
  };

  return (
    <section className={`rounded-2xl border border-white/10 bg-zinc-900/50 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#E0FE10]/10 p-2 text-[#E0FE10]">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Sign-in methods</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            Connect Apple and Google here so every sign-in opens this account, including its teams,
            subscription, and history.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {linkedProviders.map((provider) => (
          <div
            key={`${provider.providerId}-${provider.email || ''}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="text-sm text-white">{provider.displayName}</div>
              {provider.email && <div className="truncate text-xs text-zinc-500">{provider.email}</div>}
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
              {CONNECTABLE_PROVIDERS.includes(provider.providerId as LinkableProvider) && linkedProviders.length > 1 && (
                <button
                  type="button"
                  onClick={() => void disconnect(provider.providerId as LinkableProvider)}
                  disabled={connecting !== null}
                  className="text-xs text-zinc-500 hover:text-red-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {CONNECTABLE_PROVIDERS.filter(
          (providerId) => !linkedProviders.some((provider) => provider.providerId === providerId),
        ).map((providerId) => (
          <button
            key={providerId}
            type="button"
            onClick={() => void connect(providerId)}
            disabled={connecting !== null}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
          >
            <span>
              <span className="block text-sm text-white">Connect {getProviderLabel(providerId)}</span>
              <span className="block text-xs text-zinc-500">Use it to open this same account</span>
            </span>
            {connecting === providerId
              ? <Loader2 className="h-4 w-4 animate-spin text-[#E0FE10]" />
              : <Link2 className="h-4 w-4 text-zinc-400" />}
          </button>
        ))}
      </div>

      {message && (
        <div
          role="status"
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            message.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}
    </section>
  );
};

export default AccountSignInMethods;
