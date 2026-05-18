import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, Mail, User } from 'lucide-react';

type RitualEarlyAccessFormProps = {
  source: string;
  compact?: boolean;
  className?: string;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RitualEarlyAccessForm: React.FC<RitualEarlyAccessFormProps> = ({
  source,
  compact = false,
  className = '',
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState('');

  const isSubmitting = submitState === 'submitting';
  const trimmedEmail = email.trim();
  const canSubmit = emailPattern.test(trimmedEmail) && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setSubmitState('error');
      setMessage('Enter a valid email address.');
      return;
    }

    setSubmitState('submitting');
    setMessage('');

    try {
      const response = await fetch('/.netlify/functions/pulse-ritual-early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: trimmedEmail,
          source,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          referrer: typeof document !== 'undefined' ? document.referrer : '',
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'We could not save your request right now.');
      }

      setSubmitState('success');
      setMessage(data.alreadyJoined ? "You're already on the early access list." : "You're on the early access list.");
      setName('');
      setEmail('');
    } catch (error) {
      setSubmitState('error');
      setMessage(error instanceof Error ? error.message : 'We could not save your request right now.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className={compact ? 'space-y-3' : 'space-y-4'}>
        <div className={compact ? 'grid gap-3 sm:grid-cols-[1fr,1fr,auto]' : 'grid gap-3 sm:grid-cols-[1fr,1fr]'}>
          <label className="relative block">
            <span className="sr-only">Name</span>
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-[#5EEAD4]/60"
            />
          </label>

          <label className="relative block">
            <span className="sr-only">Email address</span>
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-[#5EEAD4]/60"
            />
          </label>

          {compact && (
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5EEAD4] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#99F6E4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Join
            </button>
          )}
        </div>

        {!compact && (
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5EEAD4] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#99F6E4] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Request early access
          </button>
        )}

        {message && (
          <p className={`flex items-center gap-2 text-sm ${submitState === 'success' ? 'text-[#99F6E4]' : 'text-red-300'}`}>
            {submitState === 'success' && <Check className="h-4 w-4" />}
            {message}
          </p>
        )}
      </div>
    </form>
  );
};

export default RitualEarlyAccessForm;
