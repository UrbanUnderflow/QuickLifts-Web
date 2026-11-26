import React, { FormEvent, useState } from 'react';
import Head from 'next/head';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

const UpdateListPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('submitting');
    setError('');

    try {
      const response = await fetch('/api/brevo/athleticmind-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: consented }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'We couldn’t add you right now. Please try again.');
      }

      setState('success');
      setEmail('');
      setConsented(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  return (
    <>
      <Head>
        <title>Stay connected | AthleticMind</title>
        <meta
          name="description"
          content="Get thoughtful updates from AthleticMind on mental performance, athlete wellbeing, and building strong minds."
        />
        <meta name="theme-color" content="#08251e" />
        <meta property="og:title" content="Stay connected | AthleticMind" />
        <meta
          property="og:description"
          content="Strong bodies. Strong minds. Get thoughtful updates from AthleticMind."
        />
        <link rel="canonical" href="https://theathleticmind.ai/updatelist" />
      </Head>

      <main className="relative min-h-screen overflow-hidden bg-[#08251e] text-[#f8f3e7]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-48 -top-48 h-[34rem] w-[34rem] rounded-full border border-[#d99a4e]/20" />
          <div className="absolute -right-28 -top-28 h-[25rem] w-[25rem] rounded-full border border-[#d99a4e]/15" />
          <div className="absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-[#123b2e]/75 via-[#0b2b22]/35 to-transparent" />
          <div className="absolute -bottom-64 -left-36 h-[36rem] w-[36rem] rounded-full bg-[#c96e35]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-8 pt-7 sm:px-10 lg:px-16">
          <header className="flex items-center justify-between border-b border-white/10 pb-6">
            <a href="https://theathleticmind.ai" className="inline-flex items-center gap-3" aria-label="AthleticMind home">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d99a4e]/70 text-lg font-semibold text-[#e8a34e]">
                AM
              </span>
              <span className="text-sm font-semibold tracking-[0.22em] text-[#f8f3e7] sm:text-base">
                ATHLETICMIND
              </span>
            </a>
            <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-[#d9cdb5] sm:block">
              Strong bodies. Strong minds.
            </span>
          </header>

          <section className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-20">
            <div className="max-w-2xl">
              <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#e6a04a]">
                <span className="h-px w-10 bg-[#e6a04a]" />
                Stay connected
              </p>
              <h1 className="font-serif text-5xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
                Strong bodies.
                <span className="mt-1 block text-[#e8a34e]">Strong minds.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[#e2ddcf] sm:text-xl">
                Follow the work behind a stronger future for athletes. Get occasional notes on mental performance,
                wellbeing, and the people and ideas moving the game forward.
              </p>
              <div className="mt-9 flex items-center gap-4">
                <span className="h-px w-12 bg-[#e8a34e]" />
                <p className="text-sm font-medium text-[#d9cdb5]">No donation required. Just stay in the conversation.</p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div aria-hidden="true" className="absolute -inset-3 rounded-[2rem] border border-[#d99a4e]/25" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-[#f8f3e7] p-7 text-[#102c23] shadow-2xl shadow-black/20 sm:p-9">
                {state === 'success' ? (
                  <div role="status" aria-live="polite" className="flex min-h-[22rem] flex-col justify-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a65c2b]">You’re on the list</p>
                    <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight">Thanks for staying connected.</h2>
                    <p className="mt-4 text-base leading-7 text-[#42544b]">
                      We’ll send occasional AthleticMind updates to your inbox. You can unsubscribe from any email.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a65c2b]">AthleticMind updates</p>
                    <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                      Keep the conversation going.
                    </h2>
                    <p className="mt-3 text-base leading-7 text-[#42544b]">
                      Sign up for occasional updates, stories, and ways to support athlete wellbeing.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                      <div>
                        <label htmlFor="updates-email" className="mb-2 block text-sm font-semibold">
                          Email address
                        </label>
                        <input
                          id="updates-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-[#c9c5b8] bg-white px-4 py-3.5 text-base text-[#102c23] outline-none transition placeholder:text-[#8b9189] focus:border-[#a65c2b] focus:ring-2 focus:ring-[#a65c2b]/20"
                        />
                      </div>

                      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#42544b]">
                        <input
                          type="checkbox"
                          required
                          checked={consented}
                          onChange={(event) => setConsented(event.target.checked)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#174434]"
                        />
                        <span>
                          I agree to receive occasional email updates from AthleticMind. I can unsubscribe at any time.
                          Read our <a href="/privacy" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
                        </span>
                      </label>

                      {state === 'error' && (
                        <p role="alert" className="text-sm font-medium text-red-800">{error}</p>
                      )}

                      <button
                        type="submit"
                        disabled={state === 'submitting'}
                        className="flex w-full items-center justify-center rounded-full bg-[#10372b] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-[#f8f3e7] transition hover:bg-[#194d3a] focus:outline-none focus:ring-2 focus:ring-[#a65c2b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                      >
                        {state === 'submitting' ? 'Adding you…' : 'Get AthleticMind updates'}
                      </button>
                    </form>
                    <p className="mt-5 text-center text-xs text-[#647268]">
                      Your inbox, your choice. No spam and no donation required.
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>

          <footer className="flex flex-col gap-5 border-t border-white/10 pt-6 text-sm text-[#d9cdb5] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.14em] text-[#bcb8a9]">Built for athletes. Shaped by practice.</p>
            <nav aria-label="Partner organizations" className="flex flex-wrap gap-x-6 gap-y-2">
              <a className="transition hover:text-[#e8a34e]" href="https://alfreedaarise.org" target="_blank" rel="noreferrer">
                Alfreeda Goff Foundation <span aria-hidden="true">↗</span>
              </a>
              <a className="transition hover:text-[#e8a34e]" href="https://48andforward.org" target="_blank" rel="noreferrer">
                48 &amp; Forward <span aria-hidden="true">↗</span>
              </a>
            </nav>
          </footer>
        </div>
      </main>
    </>
  );
};

export default UpdateListPage;
