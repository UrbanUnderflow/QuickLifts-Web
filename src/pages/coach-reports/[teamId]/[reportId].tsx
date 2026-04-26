import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertTriangle, ArrowLeft, CalendarDays, Lock, RefreshCw } from 'lucide-react';

import CoachReportView from '../../../components/coach-reports/CoachReportView';
import { pulseCheckProvisioningService } from '../../../api/firebase/pulsecheckProvisioning/service';
import type { PulseCheckTeamMembershipRole } from '../../../api/firebase/pulsecheckProvisioning/types';
import {
  pulsecheckCoachReportService,
  StoredCoachReport,
} from '../../../api/firebase/pulsecheckCoachReportService';
import {
  getDefaultPulseCheckSports,
  PulseCheckSportConfigurationEntry,
} from '../../../api/firebase/pulsecheckSportConfig';
import { useUser, useUserLoading } from '../../../hooks/useUser';

type PageStatus = 'loading' | 'ready' | 'sign_in' | 'no_access' | 'not_found' | 'not_ready' | 'error';

interface PageState {
  status: PageStatus;
  report: StoredCoachReport | null;
  teamName: string;
  message: string;
}

const COACH_REPORT_ACCESS_ROLES = new Set<PulseCheckTeamMembershipRole>([
  'team-admin',
  'coach',
  'performance-staff',
]);

const COACH_VISIBLE_STATUSES = new Set<StoredCoachReport['reviewStatus']>([
  'published',
  'sent',
]);

const formatReportDate = (value: unknown) => {
  if (!value) return '';
  const date =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: unknown })?.toDate === 'function'
        ? (value as { toDate: () => Date }).toDate()
        : typeof value === 'string' || typeof value === 'number'
          ? new Date(value)
          : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const hydrateCoachSurfaceMeta = (
  report: StoredCoachReport,
  teamName: string,
  sport: PulseCheckSportConfigurationEntry
): StoredCoachReport['coachSurface'] => ({
  ...report.coachSurface,
  meta: {
    ...report.coachSurface.meta,
    reportId: report.id,
    teamId: report.teamId,
    teamName: report.coachSurface.meta.teamName || teamName || `${sport.name} program`,
    sportId: report.sportId,
    sportName: sport.name,
    generatedAt:
      report.coachSurface.meta.generatedAt ||
      formatReportDate(report.sentAt || report.publishedAt || report.updatedAt || report.createdAt),
  },
});

interface StateMessageProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}

const StateMessage: React.FC<StateMessageProps> = ({ icon, title, body, action }) => (
  <div className="min-h-screen bg-[#080a14] px-6 py-24 text-zinc-200">
    <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950/70 p-8 text-center shadow-2xl shadow-black/30">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-300">
        {icon}
      </div>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  </div>
);

const CoachReportPage: React.FC = () => {
  const router = useRouter();
  const currentUser = useUser();
  const userLoading = useUserLoading();
  const teamId = typeof router.query.teamId === 'string' ? router.query.teamId : '';
  const reportId = typeof router.query.reportId === 'string' ? router.query.reportId : '';
  const [state, setState] = useState<PageState>({
    status: 'loading',
    report: null,
    teamName: '',
    message: 'Getting the report ready.',
  });

  useEffect(() => {
    if (!router.isReady || !teamId || !reportId) return;
    if (userLoading) {
      setState({ status: 'loading', report: null, teamName: '', message: 'Checking your sign-in.' });
      return;
    }
    if (!currentUser?.id) {
      setState({
        status: 'sign_in',
        report: null,
        teamName: '',
        message: 'Sign in with the account tied to this team and we will open the coach-ready read.',
      });
      return;
    }

    let cancelled = false;

    const loadReport = async () => {
      setState({ status: 'loading', report: null, teamName: '', message: 'Getting the report ready.' });

      try {
        const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(currentUser.id);
        const membership = memberships.find(
          (entry) => entry.teamId === teamId && COACH_REPORT_ACCESS_ROLES.has(entry.role)
        );

        if (!membership) {
          if (!cancelled) {
            setState({
              status: 'no_access',
              report: null,
              teamName: '',
              message: 'This report is for that team staff only. Use the account attached to the team, or ask Pulse to add you.',
            });
          }
          return;
        }

        const [team, report] = await Promise.all([
          pulseCheckProvisioningService.getTeam(teamId).catch(() => null),
          pulsecheckCoachReportService.getReport(teamId, reportId),
        ]);

        if (!report) {
          if (!cancelled) {
            setState({
              status: 'not_found',
              report: null,
              teamName: team?.displayName || '',
              message: 'We could not find that report link. Check the latest email from Pulse, or open the report from coach home.',
            });
          }
          return;
        }

        if (!COACH_VISIBLE_STATUSES.has(report.reviewStatus)) {
          if (!cancelled) {
            setState({
              status: 'not_ready',
              report,
              teamName: team?.displayName || '',
              message: 'This read is still being reviewed. We will send the coach-ready link when the Pulse team signs off.',
            });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: 'ready',
            report,
            teamName: team?.displayName || '',
            message: '',
          });
        }
      } catch (error) {
        console.error('[CoachReportPage] Failed to load Sports Intelligence report:', error);
        if (!cancelled) {
          setState({
            status: 'error',
            report: null,
            teamName: '',
            message: 'Something got in the way while loading this report. Refresh once; if it still does not open, send this link to Pulse and we will fix it.',
          });
        }
      }
    };

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, reportId, router.isReady, teamId, userLoading]);

  const sport = useMemo(() => {
    const sportId = state.report?.sportId || state.report?.coachSurface?.meta?.sportId;
    return getDefaultPulseCheckSports().find((entry) => entry.id === sportId) || null;
  }, [state.report?.coachSurface?.meta?.sportId, state.report?.sportId]);

  const coachSurface = useMemo(() => {
    if (!state.report || !sport) return null;
    return hydrateCoachSurfaceMeta(state.report, state.teamName, sport);
  }, [sport, state.report, state.teamName]);

  if (state.status === 'loading') {
    return (
      <>
        <Head>
          <title>Sports Intelligence Report</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage
          icon={<RefreshCw className="h-5 w-5 animate-spin" />}
          title="Opening the read"
          body={state.message || 'Getting the report ready.'}
        />
      </>
    );
  }

  if (state.status === 'sign_in') {
    const signInHref = `${router.asPath.split('?')[0]}?signin=1`;
    return (
      <>
        <Head>
          <title>Sign in for report</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage
          icon={<Lock className="h-5 w-5" />}
          title="Sign in to open this read"
          body={state.message}
          action={<Link className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500" href={signInHref}>Sign in</Link>}
        />
      </>
    );
  }

  if (state.status === 'no_access') {
    return (
      <>
        <Head>
          <title>Report access needed</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage
          icon={<Lock className="h-5 w-5" />}
          title="This one is team-only"
          body={state.message}
          action={<Link className="text-sm font-medium text-white underline decoration-zinc-500 underline-offset-4" href="/coach/dashboard">Go to coach home</Link>}
        />
      </>
    );
  }

  if (state.status === 'not_found') {
    return (
      <>
        <Head>
          <title>Report not found</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage
          icon={<AlertTriangle className="h-5 w-5" />}
          title="That report link is not landing"
          body={state.message}
          action={<Link className="text-sm font-medium text-white underline decoration-zinc-500 underline-offset-4" href="/coach/dashboard">Open coach home</Link>}
        />
      </>
    );
  }

  if (state.status === 'not_ready') {
    return (
      <>
        <Head>
          <title>Report in review</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage icon={<CalendarDays className="h-5 w-5" />} title="Almost ready" body={state.message} />
      </>
    );
  }

  if (state.status === 'error' || !state.report || !sport || !coachSurface) {
    return (
      <>
        <Head>
          <title>Report needs a refresh</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <StateMessage
          icon={<AlertTriangle className="h-5 w-5" />}
          title="The read did not open cleanly"
          body={state.message || 'Refresh once; if it still does not open, send this link to Pulse and we will fix it.'}
          action={<button type="button" onClick={() => router.reload()} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500">Refresh report</button>}
        />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{sport.name} - Sports Intelligence Report</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[#050608] px-4 py-6 text-zinc-100 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Link href="/coach/dashboard" className="mb-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to coach home
          </Link>
          <CoachReportView report={coachSurface} sport={sport} />
        </div>
      </div>
    </>
  );
};

export default CoachReportPage;
