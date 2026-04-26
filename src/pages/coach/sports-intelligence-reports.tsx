import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, ClipboardCheck, FileText, Search } from 'lucide-react';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { useUser, useUserLoading } from '../../hooks/useUser';
import {
  listSentSportsIntelligenceReportsForCoach,
  type CoachReportListItem,
} from '../../api/firebase/pulsecheckCoachReportAccess';

const formatReportDate = (date?: Date) => {
  if (!date) return 'Date pending';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatAdherenceChip = (report: CoachReportListItem) => {
  if (!report.adherence.categoriesTotal) return report.adherence.label || 'Coverage pending';
  return `Adherence: ${report.adherence.categoriesReady ?? 0} / ${report.adherence.categoriesTotal} categories`;
};

const CoachSportsIntelligenceReports: React.FC = () => {
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const [reports, setReports] = useState<CoachReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userLoading) return;

    if (!currentUser?.id) {
      setReports([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listSentSportsIntelligenceReportsForCoach(currentUser.id)
      .then((nextReports) => {
        if (!cancelled) setReports(nextReports);
      })
      .catch((reportError) => {
        console.error('Failed to load Sports Intelligence reports:', reportError);
        if (!cancelled) {
          setReports([]);
          setError('We could not load the report archive. Please refresh and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, userLoading]);

  const filteredReports = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return reports;
    return reports.filter((report) =>
      [
        report.title,
        report.weekLabel,
        report.teamName,
        report.sportName,
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [reports, searchTerm]);

  return (
    <CoachLayout
      title="Sports Intelligence Reports"
      subtitle="Reviewed weekly reads and game-day notes for your teams"
      requiresActiveSubscription={false}
    >
      <PageHead
        metaData={{
          pageId: 'coach-sports-intelligence-reports',
          pageTitle: 'Sports Intelligence Reports - Coach Dashboard',
          metaDescription: 'Coach archive for reviewed Pulse Sports Intelligence reports.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/coach/sports-intelligence-reports"
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6EE7B7]">
                Report Archive
              </p>
              <h1 className="mt-3 text-3xl font-bold text-white">Sports Intelligence reads</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
                Open the latest reviewed report or look back at prior weeks. This page stays intentionally thin: the report carries the interpretation.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search reports"
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-[#6EE7B7]/50"
              />
            </div>
          </div>
        </motion.section>

        <div className="mt-8">
          {loading || userLoading ? (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-10 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#E0FE10] border-t-transparent" />
              <p className="text-sm text-zinc-400">Loading reviewed reports...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
              <p className="text-sm font-semibold text-red-200">{error}</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/40 p-10 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#6EE7B7]/30 bg-[#6EE7B7]/10">
                <FileText className="h-7 w-7 text-[#6EE7B7]" />
              </div>
              <h2 className="text-xl font-semibold text-white">
                {reports.length === 0 ? 'No reviewed reports have been sent yet.' : 'No reports match that search.'}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
                Once the Pulse team publishes a weekly read or game-day note, it will appear here with the same coach-facing language used in the report email.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredReports.map((report, index) => (
                <motion.div
                  key={`${report.teamId}-${report.reportId}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Link
                    href={report.href}
                    className="group block rounded-2xl border border-white/10 bg-zinc-900/60 p-5 transition-all hover:-translate-y-0.5 hover:border-[#6EE7B7]/40 hover:bg-zinc-900/80"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#6EE7B7]/30 bg-[#6EE7B7]/10">
                          <FileText className="h-6 w-6 text-[#6EE7B7]" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                              {report.sportName}
                            </span>
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-300">
                              {report.teamName}
                            </span>
                          </div>
                          <h2 className="mt-3 text-xl font-semibold text-white">{report.title}</h2>
                          <p className="mt-2 text-sm text-zinc-400">{report.weekLabel}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-200">
                          <ClipboardCheck className="h-4 w-4 text-[#6EE7B7]" />
                          {formatAdherenceChip(report)}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                          <CalendarDays className="h-4 w-4 text-zinc-500" />
                          {formatReportDate(report.sentAt || report.publishedAt || report.generatedAt)}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-2xl bg-[#E0FE10] px-4 py-3 text-sm font-semibold text-black">
                          Open
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  );
};

export default CoachSportsIntelligenceReports;
