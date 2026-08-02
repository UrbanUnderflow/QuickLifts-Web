import React from 'react';
import { PulseCheckYouthInfoPage } from './PulseCheck/youth-info';

const PulseCheckProInfoPage: React.FC = () => (
  <PulseCheckYouthInfoPage audience="pro" />
);

export default PulseCheckProInfoPage;

export const getStaticProps = async () => ({
  props: {
    ogMeta: {
      title: 'PulseCheck Pro | Train the Mind Like the Body.',
      description:
        'An athlete-first mental performance system with 200+ skills, a structured curriculum, wearable context, and qualified human support.',
      image: 'https://pulsecheckmind.ai/pulsecheck-pro-og-clean.png',
      url: 'https://pulsecheckmind.ai/pro-info',
      type: 'website',
      siteName: 'PulseCheck',
    },
  },
});
