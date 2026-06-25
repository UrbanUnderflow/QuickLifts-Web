import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, Download, X } from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

interface MediaItem {
  src: string;
  title: string;
  caption: string;
  group: 'App Store' | 'Logging' | 'Planning & Nora';
}

const MEDIA: MediaItem[] = [
  {
    src: '/system-overview/macra/app-store-screenshots/01-food-journal.png',
    title: 'Food journal',
    caption: 'Daily food log, macro totals, meal timing, and the core Macra nutrition surface.',
    group: 'Logging',
  },
  {
    src: '/system-overview/macra/app-store-screenshots/02-ai-meal-scan.png',
    title: 'AI meal scan',
    caption: 'Camera-first meal capture that turns food evidence into macro estimates.',
    group: 'App Store',
  },
  {
    src: '/system-overview/macra/app-store-screenshots/03-meal-planning.png',
    title: 'Meal planning',
    caption: 'Target-aware daily planning for meals, calories, protein, carbs, and fats.',
    group: 'Planning & Nora',
  },
  {
    src: '/system-overview/macra/app-store-screenshots/04-label-scanner.png',
    title: 'Label scanner',
    caption: 'Nutrition-label capture for faster logging and better ingredient-level context.',
    group: 'Logging',
  },
  {
    src: '/system-overview/macra/app-store-screenshots/05-ask-nora.png',
    title: 'Ask Nora',
    caption: 'Nutrition chat with Nora for meal swaps, target coaching, and day-of guidance.',
    group: 'Planning & Nora',
  },
  {
    src: '/system-overview/macra/app-store-screenshots/06-macra-plus.png',
    title: 'Macra Plus',
    caption: 'Premium Macra plan surface for the App Store subscription flow.',
    group: 'App Store',
  },
];

const GROUPS: MediaItem['group'][] = ['App Store', 'Logging', 'Planning & Nora'];

const MacraMediaPage: React.FC = () => {
  const [active, setActive] = useState<MediaItem | null>(null);

  return (
    <AdminRouteGuard>
      <Head>
        <title>Macra Media — Admin</title>
      </Head>

      <div className="min-h-screen bg-[#05070c] text-white">
        <div className="border-b border-white/10 bg-[#0b1020]">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <Link
              href="/admin"
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} /> Back to Admin
            </Link>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.28em] text-[#6A9AFA]">
                  MACRA · MEDIA LIBRARY
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  Every Macra app screenshot.
                </h1>
                <p className="mt-3 max-w-xl text-gray-400">
                  Generated Macra App Store screenshots and product surfaces — food journal,
                  AI meal scan, label scanner, Ask Nora, meal planning, and Macra Plus. {MEDIA.length} assets.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-10">
          {GROUPS.map((group) => {
            const items = MEDIA.filter((m) => m.group === group);
            if (!items.length) return null;
            return (
              <section key={group} className="mb-14">
                <h2 className="mb-6 font-mono text-xs font-bold uppercase tracking-[0.24em] text-gray-500">
                  {group} · {items.length}
                </h2>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => (
                    <button
                      key={item.src}
                      onClick={() => setActive(item)}
                      className="group text-left"
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-xl transition-transform duration-300 group-hover:-translate-y-1 group-hover:border-[#6A9AFA]/40">
                        <img
                          src={item.src}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-[9/19] w-full object-cover object-top"
                        />
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                      <p className="mt-1 text-xs leading-snug text-gray-500">{item.caption}</p>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {active && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
            onClick={() => setActive(null)}
          >
            <button
              className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={() => setActive(null)}
            >
              <X size={20} />
            </button>
            <div className="flex max-h-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <img
                src={active.src}
                alt={active.title}
                className="max-h-[78vh] rounded-[28px] border border-white/10 shadow-2xl"
              />
              <div className="mt-5 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-base font-bold text-white">{active.title}</div>
                  <div className="text-sm text-gray-400">{active.caption}</div>
                </div>
                <a
                  href={active.src}
                  download
                  className="inline-flex items-center gap-2 rounded-full bg-[#6A9AFA] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={15} /> Download full-res
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRouteGuard>
  );
};

export default MacraMediaPage;
