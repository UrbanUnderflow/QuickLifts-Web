import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type PilotDashboardTheme = 'dark' | 'light';

const PILOT_DASHBOARD_THEME_STORAGE_KEY = 'pulsecheckPilotDashboardTheme';

interface PilotDashboardThemeContextValue {
  theme: PilotDashboardTheme;
  setTheme: (theme: PilotDashboardTheme) => void;
  toggleTheme: () => void;
}

const PilotDashboardThemeContext = createContext<PilotDashboardThemeContextValue | null>(null);

const readStoredTheme = (): PilotDashboardTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem(PILOT_DASHBOARD_THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
};

export const usePilotDashboardTheme = () => {
  const value = useContext(PilotDashboardThemeContext);
  if (!value) {
    throw new Error('usePilotDashboardTheme must be used inside PilotDashboardThemeFrame.');
  }
  return value;
};

export const PilotDashboardThemeFrame: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [theme, setThemeState] = useState<PilotDashboardTheme>('dark');

  const setTheme = useCallback((nextTheme: PilotDashboardTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PILOT_DASHBOARD_THEME_STORAGE_KEY, nextTheme);
    }
  }, []);

  useEffect(() => {
    setThemeState(readStoredTheme());
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PILOT_DASHBOARD_THEME_STORAGE_KEY) return;
      setThemeState(event.newValue === 'light' ? 'light' : 'dark');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo<PilotDashboardThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    }),
    [setTheme, theme]
  );

  return (
    <PilotDashboardThemeContext.Provider value={value}>
      <div
        className="pilot-dashboard-theme-frame min-h-screen"
        data-pilot-theme={theme}
        data-testid="pilot-dashboard-theme-frame"
      >
        {children}
      </div>
      <style jsx global>{`
        .pilot-dashboard-theme-frame {
          background: #07090f;
          color-scheme: dark;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] {
          background: #f3f7f5;
          color: #172033;
          color-scheme: light;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] > header:first-child {
          color-scheme: dark;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-dashboard-theme,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-theme,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#0b0f17]'] {
          background: #f3f7f5 !important;
          color: #172033 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#111417]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#1a1e24]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#11151f]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#0f1522]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#0a0f18]/95'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[#03060d]/88'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[rgba(9,12,19,0.98)]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[rgba(9,12,19,0.92)]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[rgba(7,9,15,0.88)]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-[rgba(7,9,15,0.82)]'] {
          background: rgba(255, 255, 255, 0.94) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-glass-card,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-panel {
          background: rgba(255, 255, 255, 0.84) !important;
          border-color: rgba(31, 51, 44, 0.12) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 16px 45px rgba(30, 64, 55, 0.08) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-inset,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.02]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.025]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.03]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.035]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.04]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.05]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.06]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/5'] {
          background: rgba(255, 255, 255, 0.72) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/[0.08]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-white/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-black/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-black/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-black/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-black/35'] {
          background: rgba(30, 58, 49, 0.055) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-400/5'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-400/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-500/12'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-950/25'] {
          background: #ecfdf5 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-cyan-400/5'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-cyan-400/[0.06]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-cyan-400/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-cyan-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-sky-400/[0.06]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-sky-400/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-sky-400/15'] {
          background: #ecfeff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-blue-400/10'] {
          background: #eff6ff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-400/5'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-400/[0.08]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-400/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-500/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-amber-950/30'] {
          background: #fffbeb !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-400/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-500/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-500/12'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-500/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-rose-950/40'] {
          background: #fff1f2 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-violet-400/5'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-violet-400/10'] {
          background: #f5f3ff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='bg-emerald-300'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-participation-progress-fill {
          background: #047857 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-participation-progress-track {
          background: #cbd5d1 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/5'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/8'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/[0.07]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/10'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-white/25'] {
          border-color: rgba(31, 51, 44, 0.13) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-emerald-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-emerald-400/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-emerald-400/25'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-emerald-400/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-emerald-700/40'] {
          border-color: #047857 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/25'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/35'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-cyan-400/50'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-sky-400/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-sky-400/25'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-sky-400/30'] {
          border-color: #0e7490 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-blue-400/30'] {
          border-color: #1d4ed8 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-400/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-400/25'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-400/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-400/40'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-amber-700/50'] {
          border-color: #a16207 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-400/20'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-400/25'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-400/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-400/40'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-500/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-rose-700/60'] {
          border-color: #be123c !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-violet-400/15'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-violet-400/20'] {
          border-color: #6d28d9 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='border-zinc-700'] {
          border-color: #64748b !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='divide-white/5'] > :not([hidden]) ~ :not([hidden]),
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='divide-white/10'] > :not([hidden]) ~ :not([hidden]),
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='divide-white/[0.06]'] > :not([hidden]) ~ :not([hidden]) {
          border-color: rgba(31, 51, 44, 0.1) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white'] {
          color: #172033 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/90'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/85'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/80'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/75'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/70'] {
          color: #344054 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/65'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/60'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/55'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/50'] {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/45'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/42'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/40'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/38'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/35'] {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/30'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/28'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-white/25'] {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-zinc-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-zinc-200'] {
          color: #172033 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-zinc-300'] {
          color: #344054 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-zinc-400'] {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-zinc-500'] {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[#7cefd6]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[#9cf4e2]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[#00d4aa]'] {
          color: #0b665b !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-50'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-50/90'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-200'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-200/80'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-cyan-300'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-sky-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-sky-200'] {
          color: #075985 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-50/90'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-100/75'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-100/80'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-200'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-emerald-300'] {
          color: #065f46 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-50'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-100/90'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-100/80'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-100/75'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-200'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-amber-300'] {
          color: #92400e !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-orange-100'] {
          color: #9a3412 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-rose-50'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-rose-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-rose-200'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-rose-200/80'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-rose-300'] {
          color: #be123c !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-violet-100'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-violet-200'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-violet-300'] {
          color: #5b21b6 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-blue-100'] {
          color: #1d4ed8 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-slate-300'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-slate-500'] {
          color: #475569 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-slate-700'] {
          color: #334155 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-invite-qr-fixed-dark {
          background: #09111e !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-invite-qr-fixed-dark-title {
          color: #ffffff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-invite-qr-fixed-dark-copy {
          color: #cbd5e1 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] input,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] textarea,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] select {
          color: #253047;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] input::placeholder,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] textarea::placeholder {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] select option {
          background: #ffffff;
          color: #253047;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-select,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-select {
          -webkit-appearance: none;
          appearance: none;
          background-color: rgba(255, 255, 255, 0.72) !important;
          background-image: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2210%22%20height%3D%226%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M1%201l4%204%204-4%22%20stroke%3D%22%23253047%22%20stroke-opacity%3D%22.62%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") !important;
          background-position: right 0.9rem center !important;
          background-repeat: no-repeat !important;
          background-size: 10px 6px !important;
          padding-right: 2.5rem;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-theme table thead th {
          color: #526075 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-theme table tbody td,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-theme code {
          color: #344054 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-detail-theme table tbody tr:hover td {
          background: rgba(15, 118, 110, 0.035) !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-ambient-orb {
          opacity: 0.55;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='after:bg-[#00d4aa]']::after {
          background: #087f70 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[9px]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[10px]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='text-[11px]'] {
          font-size: 0.75rem !important;
          line-height: 1rem !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='uppercase'][class~='text-[9px]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='uppercase'][class~='text-[10px]'],
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='uppercase'][class~='text-[11px]'] {
          font-weight: 600 !important;
          letter-spacing: 0.12em !important;
        }

        .pilot-athlete-join-toast {
          border-color: rgba(52, 211, 153, 0.24);
          background: rgba(9, 19, 22, 0.95);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.38);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-athlete-join-toast {
          border-color: rgba(5, 150, 105, 0.22);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 22px 60px rgba(30, 64, 55, 0.16);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:text-white']:hover,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:text-white/75']:hover,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:text-white/80']:hover {
          color: #101828 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:bg-white/[0.03]']:hover,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:bg-white/[0.06]']:hover,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:bg-white/[0.08]']:hover,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] [class~='hover:bg-white/10']:hover {
          background: rgba(15, 118, 110, 0.08) !important;
        }

        .pilot-theme-toggle {
          display: inline-flex;
          min-height: 2.5rem;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.035);
          padding: 0.55rem 0.8rem;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.8rem;
          font-weight: 600;
          transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
        }

        .pilot-theme-toggle:hover {
          border-color: rgba(124, 239, 214, 0.28);
          background: rgba(255, 255, 255, 0.07);
          color: #ffffff;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-toggle {
          border-color: rgba(31, 51, 44, 0.14);
          background: rgba(255, 255, 255, 0.86);
          color: #344054;
          box-shadow: 0 8px 24px rgba(30, 64, 55, 0.07);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-toggle:hover {
          border-color: rgba(15, 118, 110, 0.28);
          background: #ffffff;
          color: #0f766e;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-soft-action {
          border-color: #9fd9cc !important;
          background: #e9f7f3 !important;
          color: #0b665b !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-soft-action:hover {
          border-color: #76c5b4 !important;
          background: #d9efe9 !important;
          color: #07584f !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-primary-action {
          border-color: #0f766e !important;
          background: #0f766e !important;
          color: #ffffff !important;
          box-shadow: 0 8px 20px rgba(15, 118, 110, 0.16);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-primary-action:hover {
          border-color: #0b5f59 !important;
          background: #0b5f59 !important;
          color: #ffffff !important;
        }

        .pilot-theme-danger-action {
          border-color: rgba(251, 113, 133, 0.28) !important;
          background: rgba(251, 113, 133, 0.1) !important;
          color: #fecdd3 !important;
        }

        .pilot-theme-danger-action:hover:not(:disabled) {
          border-color: rgba(251, 113, 133, 0.42) !important;
          background: rgba(251, 113, 133, 0.16) !important;
          color: #ffffff !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-danger-action {
          border-color: #f0a7b6 !important;
          background: #fff1f3 !important;
          color: #9f1239 !important;
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-danger-action:hover:not(:disabled) {
          border-color: #e77b91 !important;
          background: #ffe4e8 !important;
          color: #881337 !important;
        }

        .pilot-athlete-removal-notice {
          background: rgba(9, 19, 22, 0.96);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.38);
        }

        .pilot-athlete-removal-notice[data-tone='error'] {
          background: rgba(28, 11, 18, 0.96);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-athlete-removal-notice {
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 22px 60px rgba(30, 64, 55, 0.16);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-soft-action:disabled,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-primary-action:disabled,
        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-theme-danger-action:disabled {
          border-color: #d1d9d7 !important;
          background: #edf1f0 !important;
          color: #526075 !important;
          box-shadow: none !important;
          opacity: 1 !important;
        }

        .pilot-team-filter-focus:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #07090f, 0 0 0 4px rgba(0, 212, 170, 0.68);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-team-filter-focus:focus-visible {
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px rgba(15, 118, 110, 0.52);
        }

        .pilot-dashboard-theme-frame[data-pilot-theme='light'] .pilot-team-filter-menu {
          border-color: rgba(31, 51, 44, 0.14) !important;
          background: rgba(255, 255, 255, 0.99) !important;
          box-shadow: 0 24px 60px rgba(30, 64, 55, 0.16) !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .pilot-theme-toggle {
            transition: none;
          }
        }
      `}</style>
    </PilotDashboardThemeContext.Provider>
  );
};

export const PilotDashboardThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { theme, toggleTheme } = usePilotDashboardTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const nextThemeLabel = isDark ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="pilot-theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextThemeLabel} mode`}
      title={`Switch to ${nextThemeLabel} mode`}
      data-testid="pilot-dashboard-theme-toggle"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {compact ? null : <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  );
};

export { PILOT_DASHBOARD_THEME_STORAGE_KEY };
