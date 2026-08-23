import React from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import NoraRedTeamConsole from '../../components/admin/nora-red-team/NoraRedTeamConsole';

const NoraRedTeamPage: React.FC = () => (
  <AdminRouteGuard>
    <Head>
      <title>Nora Red Team | Pulse Admin</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    <NoraRedTeamConsole />
  </AdminRouteGuard>
);

export default NoraRedTeamPage;

