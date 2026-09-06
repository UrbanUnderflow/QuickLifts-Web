import React from 'react';
import type { GetServerSideProps } from 'next';
import LocalTesting from '../../components/admin/nora-red-team/LocalTesting';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import NoraRedTeamConsole from '../../components/admin/nora-red-team/NoraRedTeamConsole';

const NoraRedTeamPage: React.FC<{localTesting:boolean}> = ({localTesting}) => localTesting ? <LocalTesting/> : (
  <AdminRouteGuard scope="nora-testing">
    <Head>
      <title>Nora Red Team | Pulse Admin</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
    <NoraRedTeamConsole />
  </AdminRouteGuard>
);

export default NoraRedTeamPage;


export const getServerSideProps: GetServerSideProps = async ({req}) => ({props:{localTesting: process.env.NODE_ENV === 'development' && process.env.NORA_LOCAL_TESTING === 'true' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')}});
