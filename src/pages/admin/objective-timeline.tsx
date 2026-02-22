import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';

const ObjectiveTimelinePanel = dynamic(() => import('../../components/virtualOffice/ObjectiveTimelinePanel'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#030508',
      color: '#71717a',
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: '14px',
    }}>
      Loading Objective Timeline…
    </div>
  ),
});

export default function ObjectiveTimelinePage() {
  const [agents, setAgents] = useState<AgentPresence[]>([]);

  useEffect(() => {
    const unsubscribe = presenceService.listen((next) => {
      setAgents((next || []).slice().sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
    return () => unsubscribe();
  }, []);

  return (
    <AdminRouteGuard>
      <ObjectiveTimelinePanel
        agents={agents}
        onClose={() => { }}
      />
    </AdminRouteGuard>
  );
}
