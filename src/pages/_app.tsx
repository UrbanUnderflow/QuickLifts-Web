import React from 'react';
import type { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { store } from '../redux/store'; // Make sure this path is correct
import '../components/Footer/GlisteningButton.css';
import '../index.css';
import '../styles/animations.css';

import AuthWrapper from '../components/AuthWrapper';

const MyApp: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (    
    <Provider store={store}>
      <AuthWrapper>
        <Component {...pageProps} />
      </AuthWrapper>
    </Provider>
  );
};

export default MyApp;