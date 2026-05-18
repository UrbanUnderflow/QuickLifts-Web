import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Droplet, Flame, Leaf, Moon, Sparkles } from 'lucide-react';
import RitualEarlyAccessForm from './RitualEarlyAccessForm';

const RITUAL_MARKS = [
  { label: 'Mind', Icon: Moon, text: 'Start with a two-minute reset that meets the day you are actually in.' },
  { label: 'Body', Icon: Flame, text: 'Keep hydration, mobility, recovery, and training signals in one daily rhythm.' },
  { label: 'Fuel', Icon: Leaf, text: 'Carry nutrition and energy intent from Macra into the rest of the Pulse stack.' },
];

const RitualLanding: React.FC = () => {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050606] text-white selection:bg-[#5EEAD4]/30">
      <section className="relative min-h-screen px-6 py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(94,234,212,0.20),transparent_34%),radial-gradient(circle_at_18%_78%,rgba(16,185,129,0.14),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.92))]" />

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/pulse-ritual-icon.png" alt="" className="h-9 w-9 rounded-[25%]" draggable={false} />
            <span className="text-sm font-semibold tracking-[0.18em] text-zinc-300 uppercase">Pulse Ritual</span>
          </Link>
          <Link
            href="/apps"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Pulse apps
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl items-center gap-12 py-16 lg:grid-cols-[1fr,0.88fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#5EEAD4]/25 bg-[#5EEAD4]/10 px-3 py-1.5 text-xs font-semibold text-[#99F6E4]">
              <Sparkles className="h-3.5 w-3.5" />
              Early access opening soon
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              Water your body, mind, and spirit.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              Pulse Ritual is the daily watering layer for human performance. Three small drops a day, connected to the way you train, eat, recover, and show up.
            </p>

            <div className="mt-9 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md">
              <p className="mb-4 text-sm font-medium text-zinc-300">Join the first early access group.</p>
              <RitualEarlyAccessForm source="ritual-landing-hero" />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute inset-0 rounded-full bg-[#5EEAD4]/20 blur-3xl" />
            <div className="relative aspect-square rounded-[32%] border border-[#5EEAD4]/25 bg-black/50 p-7 shadow-2xl shadow-[#5EEAD4]/10">
              <img
                src="/pulse-ritual-icon.png"
                alt="Pulse Ritual app icon"
                className="h-full w-full rounded-[25%] object-cover"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-black px-6 py-20">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
          {RITUAL_MARKS.map(({ label, Icon, text }) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <Icon className="mb-6 h-7 w-7 text-[#5EEAD4]" />
              <h2 className="text-xl font-semibold text-white">{label}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#070908] px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[0.9fr,1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5EEAD4]">The ritual loop</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Built for daily consistency, not another dashboard to babysit.
            </h2>
          </div>
          <div className="space-y-4">
            {[
              'Three drops a day: Mind, Body, and Fuel.',
              'Auto-waters from Pulse Check, Fit With Pulse, and Macra as the ecosystem grows.',
              'Designed as a calm daily layer for athletes, coaches, wellness operators, and anyone building better performance habits.',
            ].map((item) => (
              <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#5EEAD4]" />
                <p className="text-sm leading-6 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-3xl border border-[#5EEAD4]/20 bg-[#5EEAD4]/[0.06] p-6 sm:p-10 lg:grid-cols-[1fr,1.1fr]">
          <div>
            <Droplet className="mb-5 h-8 w-8 text-[#5EEAD4]" />
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get early access.</h2>
            <p className="mt-4 text-sm leading-6 text-zinc-300">
              We will use this list to invite the first testers and keep you posted as Ritual moves toward launch.
            </p>
          </div>
          <RitualEarlyAccessForm source="ritual-landing-bottom" compact />
        </div>
      </section>
    </main>
  );
};

export default RitualLanding;
