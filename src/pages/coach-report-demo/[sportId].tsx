import React, { useMemo } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import CoachReportView from '../../components/coach-reports/CoachReportView';
import {
  PulseCheckSportConfigurationEntry,
  getDefaultPulseCheckSports,
} from '../../api/firebase/pulsecheckSportConfig';
import {
  COACH_REPORT_DEMO_EXAMPLES,
  CoachReportDemoExample,
  buildDemoCoachSurface,
  getSportColor,
} from '../../api/firebase/pulsecheckSportReportDemos';

// Public, full-page, coach-first weekly report demo. This route is intentionally
// PUBLIC (whitelisted in AuthWrapper) so stakeholders can review without
// accounts. It must stay demo-only: no Firestore reads, no live team data, and
// no reviewer-only evidence object. Real reports render through CoachReportView
// from their own authenticated route.

interface PageState {
  sport: PulseCheckSportConfigurationEntry | undefined;
  demo: CoachReportDemoExample | undefined;
}

export const assertCoachReportDemoSource = (
  sportId: string,
  report: CoachReportDemoExample | undefined,
): CoachReportDemoExample => {
  if (!report) {
    throw new Error(`No coach-report demo fixture exists for sport "${sportId}".`);
  }
  if (report !== COACH_REPORT_DEMO_EXAMPLES[sportId]) {
    throw new Error('Coach-report demo route may only render COACH_REPORT_DEMO_EXAMPLES fixtures.');
  }
  return report;
};

const useReportData = (sportId: string | undefined): PageState => {
  return useMemo(() => {
    if (!sportId) return { sport: undefined, demo: undefined };
    const sports = getDefaultPulseCheckSports();
    const sport = sports.find((s) => s.id === sportId);
    return {
      sport,
      demo: COACH_REPORT_DEMO_EXAMPLES[sportId],
    };
  }, [sportId]);
};

const formatGeneratedAt = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const CoachReportDemoPage: React.FC = () => {
  const router = useRouter();
  const sportId = typeof router.query.sportId === 'string' ? router.query.sportId : undefined;
  const { sport, demo } = useReportData(sportId);
  const generatedAtLabel = useMemo(formatGeneratedAt, []);

  if (!sportId) {
    return null;
  }

  if (!sport) {
    return (
      <div className="min-h-screen bg-[#080a14] text-zinc-200">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Coach Report Demo</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Sport not found</h1>
          <p className="mt-3 text-zinc-400">
            No sport configuration matches{' '}
            <code className="rounded bg-zinc-900 px-2 py-0.5 text-zinc-200">{sportId}</code>.
          </p>
        </div>
      </div>
    );
  }

  let verifiedDemo: CoachReportDemoExample;
  try {
    verifiedDemo = assertCoachReportDemoSource(sportId, demo);
  } catch (error) {
    return (
      <div className="min-h-screen bg-[#080a14] text-zinc-200">
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Coach Report Demo</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Demo not ready</h1>
          <p className="mt-3 text-zinc-400">
            {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{sport.name} — Sports Intelligence Report</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <CoachReportView report={buildDemoCoachSurface(verifiedDemo, sport, generatedAtLabel)} sport={sport} generatedAtLabel={generatedAtLabel} />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const sportIdParam = context.params?.sportId;
  const sportId = typeof sportIdParam === 'string' ? sportIdParam : Array.isArray(sportIdParam) ? sportIdParam[0] : '';
  const sports = getDefaultPulseCheckSports();
  const sport = sports.find((s) => s.id === sportId);
  const sportName = sport?.name || 'Coach Report';
  const sportColor = getSportColor(sportId);

  return {
    props: {
      ogMeta: {
        title: `${sportName} — Sports Intelligence Report`,
        description: `Weekly coach report for ${sportName}. From Pulse Sports Intelligence — read in under 60 seconds.`,
        image: 'https://fitwithpulse.ai/pil-og.png',
        url: `https://fitwithpulse.ai/coach-report-demo/${sportId}`,
        themeColor: sportColor.primary,
      },
    },
  };
};

export default CoachReportDemoPage;
