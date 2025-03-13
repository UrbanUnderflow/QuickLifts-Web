import React from 'react';
import type { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { store, persistor } from '../redux/store'; 
import { PersistGate } from 'redux-persist/integration/react';
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

import AuthWrapper from '../components/AuthWrapper';
import FirebaseConfigCheck from '../components/FirebaseConfigCheck';

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (    
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthWrapper>
          <Component {...pageProps} />
          <FirebaseConfigCheck />
        </AuthWrapper>
      </PersistGate>
    </Provider>
  );
};

export default MyApp;