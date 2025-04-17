import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { store, persistor } from '../redux/store'; 
import { PersistGate } from 'redux-persist/integration/react';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

import AuthWrapper from '../components/AuthWrapper';
import DefaultMeta from '../components/DefaultMeta';

// Only import in development mode
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  require('../utils/envDebug');
}

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  useEffect(() => {
    // Log a reminder about environment debugging in development mode
    if (isDev && typeof window !== 'undefined') {
      console.log('🔧 Debug tools available in development mode. Try window.debugEnv() in console.');
    }
  }, []);

  return (    
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthWrapper>
          <Component {...pageProps} />
          <DefaultMeta />
        </AuthWrapper>
      </PersistGate>
    </Provider>
  );
};

export default MyApp;