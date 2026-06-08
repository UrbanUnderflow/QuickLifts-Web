import React from 'react';
import Head from 'next/head';
import { CoachDashboardShell } from '../dashboard';
import {
  DEMO_ATHLETES,
  DEMO_ALERTS,
  DEMO_COACH_ID,
  useDemoDashboardMocks,
} from '../../../components/coach/demoDashboardData';
import NoraDashboardTraining from '../../../components/coach/NoraDashboardTraining';

// Always-on demo of the coach dashboard: mock roster + in-memory services +
// the Nora training walkthrough. Mirrors the live dashboard's training mode,
// but never touches real data.
const CoachDashboardDemo: React.FC = () => {
  const mockReady = useDemoDashboardMocks(true);

  return (
    <>
      <Head>
        <title>Coach Dashboard (Demo) | PulseCheck</title>
      </Head>
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs px-4 py-1.5 text-center">
        Demo mode — mock data for walkthroughs. No real athletes or Firebase writes.
      </div>
      {mockReady && (
        <CoachDashboardShell
          athletes={DEMO_ATHLETES as any}
          alerts={DEMO_ALERTS}
          loadingAthletes={false}
          coachName="Coach Mayo"
          coachEmail="coach.mayo@fitwithpulse.ai"
          coachId={DEMO_COACH_ID}
          isDemo
          earningsEnabled
          revenueSharePct={20}
        />
      )}
      {mockReady && <NoraDashboardTraining />}
    </>
  );
};

export default CoachDashboardDemo;
