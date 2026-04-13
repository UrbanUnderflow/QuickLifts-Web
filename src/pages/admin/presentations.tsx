import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { ArrowLeft, Copy, ExternalLink, FileStack, Link as LinkIcon, MonitorPlay } from 'lucide-react';

type PresentationCategory = 'Interactive Demos' | 'Presentation Decks' | 'Supporting Surfaces';

interface PresentationLink {
  id: string;
  title: string;
  href: string;
  category: PresentationCategory;
  typeLabel: string;
  accessLabel: string;
  description: string;
}

const PRESENTATION_REGISTRY: PresentationLink[] = [
  {
    id: 'pulsecheckdemo',
    title: 'Pulse Check Demo',
    href: '/pulsecheckdemo',
    category: 'Interactive Demos',
    typeLabel: 'Interactive demo',
    accessLabel: 'Live route',
    description: 'Patriots-focused Pulse Check walkthrough for mental performance and escalation flow.',
  },
  {
    id: 'box-breathing-simulator',
    title: 'Box Breathing Simulator',
    href: '/box-breathing-simulator',
    category: 'Interactive Demos',
    typeLabel: 'Interactive presentation',
    accessLabel: 'Live route',
    description: 'Four-slide Pulse Check x AuntEdna presentation centered on anxiety data and the live box breathing simulation.',
  },
  {
    id: 'wunnarundemo',
    title: 'Wunna Run Demo',
    href: '/wunnarundemo',
    category: 'Interactive Demos',
    typeLabel: 'Interactive demo',
    accessLabel: 'Live route',
    description: 'Pulse x Wunna Run story-driven demo from discovery through leaderboard and analytics.',
  },
  {
    id: 'auntedna',
    title: 'AuntEdna Demo',
    href: '/auntedna',
    category: 'Interactive Demos',
    typeLabel: 'Interactive demo',
    accessLabel: 'Live route',
    description: 'Clinical intelligence demo for mental performance, welfare checks, and handoff workflows.',
  },
  {
    id: 'wunna-run-presentation',
    title: 'Wunna Run Presentation',
    href: '/WunnaRun',
    category: 'Presentation Decks',
    typeLabel: 'Presentation',
    accessLabel: 'Passcode protected',
    description: 'Slide-based Wunna Run presentation with analytics and PDF export support.',
  },
  {
    id: 'pitch',
    title: 'Pitch Deck',
    href: '/pitch',
    category: 'Presentation Decks',
    typeLabel: 'Pitch deck',
    accessLabel: 'Passcode protected',
    description: 'Primary passcode-gated pitch deck with analytics and export tooling.',
  },
  {
    id: 'invest',
    title: 'Invest Presentation',
    href: '/Invest',
    category: 'Presentation Decks',
    typeLabel: 'Investor presentation',
    accessLabel: 'Passcode protected',
    description: 'Investor-facing presentation surface with access tracking and export support.',
  },
  {
    id: 'pulseintelligencelabs',
    title: 'Pulse Intelligence Labs Deck',
    href: '/pulseintelligencelabs',
    category: 'Presentation Decks',
    typeLabel: 'Interactive deck',
    accessLabel: 'Live route',
    description: 'Interactive company presentation covering Pulse, Pulse Check, partners, team, and raise narrative.',
  },
  {
    id: 'pulse-overview',
    title: 'Pulse 2 Minute Overview',
    href: '/pulse-overview',
    category: 'Supporting Surfaces',
    typeLabel: 'Video overview',
    accessLabel: 'Live route',
    description: 'Quick product walkthrough with embedded video and download link.',
  },
  {
    id: 'product-demos',
    title: 'Product Demos',
    href: '/product-demos',
    category: 'Supporting Surfaces',
    typeLabel: 'Demo library',
    accessLabel: 'Live route',
    description: 'Central gallery of Pulse tutorial videos and feature demos.',
  },
];

const CATEGORY_ORDER: PresentationCategory[] = [
  'Interactive Demos',
  'Presentation Decks',
  'Supporting Surfaces',
];

const CATEGORY_COPY: Record<PresentationCategory, string> = {
  'Interactive Demos': 'Narrative demo surfaces built to simulate the product or workflow live.',
  'Presentation Decks': 'Deck-style pages used for pitches, investor conversations, and partner presentations.',
  'Supporting Surfaces': 'Related overview and demo-library pages that support the main presentations.',
};

const chipClasses = {
  lime: 'border-[#d7ff00]/30 bg-[#d7ff00]/10 text-[#eefb8a]',
  blue: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
};

const PresentationsPage: React.FC = () => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const groupedPresentations = React.useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: PRESENTATION_REGISTRY.filter((item) => item.category === category),
    }));
  }, []);

  const copyValue = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch (error) {
      console.error('Failed to copy presentation link:', error);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Presentations | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Link href="/admin" className="inline-flex items-center text-gray-400 hover:text-white transition mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Link>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center">
                  <span className="text-[#d7ff00] mr-3">
                    <MonitorPlay className="w-7 h-7" />
                  </span>
                  Presentations
                </h1>
                <p className="text-gray-400 mt-2 max-w-3xl">
                  Internal registry for live presentation routes, interactive demos, and related overview surfaces.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#1a1e24] px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Stored links</div>
                <div className="mt-1 text-2xl font-semibold text-white">{PRESENTATION_REGISTRY.length}</div>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-zinc-800 bg-[#1a1e24] p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-zinc-700 bg-zinc-900 p-2 text-[#d7ff00]">
                <FileStack className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Presentation registry</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  This surface keeps the current presentation URLs in one place so the team can quickly launch, copy, and manage them.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {groupedPresentations.map(({ category, items }) => (
              <section key={category}>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{category}</h2>
                    <p className="text-sm text-zinc-400">{CATEGORY_COPY[category]}</p>
                  </div>
                  <div className="text-sm text-zinc-500">
                    {items.length} {items.length === 1 ? 'surface' : 'surfaces'}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {items.map((item) => {
                    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${item.href}` : item.href;
                    const isCopied = copiedId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#1a1e24] p-5 shadow-xl"
                      >
                        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-400 via-violet-400 to-[#d7ff00]" />

                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${chipClasses.blue}`}>
                                {item.typeLabel}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${chipClasses.lime}`}>
                                {item.accessLabel}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                              <LinkIcon className="w-3.5 h-3.5" />
                              Route
                            </div>
                            <code className="block break-all text-sm text-zinc-200">{item.href}</code>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff00] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#c8f100]"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Open
                            </a>

                            <button
                              type="button"
                              onClick={() => void copyValue(item.id, item.href)}
                              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#20242b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a2f38]"
                            >
                              <Copy className="w-4 h-4" />
                              {isCopied ? 'Copied route' : 'Copy route'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void copyValue(`${item.id}-full`, fullUrl)}
                              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#20242b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2a2f38]"
                            >
                              <Copy className="w-4 h-4" />
                              {copiedId === `${item.id}-full` ? 'Copied full URL' : 'Copy full URL'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default PresentationsPage;
