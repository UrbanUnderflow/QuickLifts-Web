import React from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { isPipeListsRoute } from '../utils/pipelistsRuntime';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

export default function MyApp(props: AppProps) {
  // These standalone pages gate their own runtime before loading Firebase.
  // Do not import the general shell here: its auth/store dependencies initialize
  // Firebase at module load, even when an AuthWrapper never mounts.
  if (isPipeListsRoute(props.router.pathname)) {
    const { Component, pageProps } = props;
    return <><Head><meta name="viewport" content="width=device-width, initial-scale=1" /></Head><Component {...pageProps} /></>;
  }

  // Synchronous lazy require preserves the existing SSR/render behavior of all
  // other products without evaluating their service clients on PipeLists routes.
  const ApplicationShell = require('../components/ApplicationShell').default as React.ComponentType<AppProps>;
  return <ApplicationShell {...props} />;
}
