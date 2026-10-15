import React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { isPipeListsRoute } from '../utils/pipelistsRuntime';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

// React.lazy runs this import only if the shell is rendered. Next's Pages SSR
// renderer waits for Suspense, including ESM-only dependencies in optimized
// builds. A synchronous require can return Webpack's unresolved async module.
const ApplicationShell = React.lazy(() => import('../components/ApplicationShell'));

export default function MyApp(props: AppProps) {
  // These standalone pages gate their own runtime before loading Firebase.
  // Do not import the general shell here: its auth/store dependencies initialize
  // Firebase at module load, even when an AuthWrapper never mounts.
  if (isPipeListsRoute(props.router.pathname)) {
    const { Component, pageProps } = props;
    return <><Head><meta name="viewport" content="width=device-width, initial-scale=1" /></Head><Component {...pageProps} /></>;
  }

  return <React.Suspense fallback={null}><ApplicationShell {...props} /></React.Suspense>;
}
