import React from 'react';
import type { AppProps } from 'next/app';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  return <Component {...pageProps} />;
};

export default MyApp;
