import React from 'react';
import { PulseCheckYouthInfoPage } from './PulseCheck/youth-info';

const PulseCheckPerformersInfoPage: React.FC = () => (
  <PulseCheckYouthInfoPage audience="all-performers" />
);

export default PulseCheckPerformersInfoPage;

export const getStaticProps = async () => ({
  props: {
    ogMeta: {
      title: 'PulseCheck | Mental Performance for Work, School, Sport, and Life',
      description:
        'A daily mental performance system for professionals, students, athletes, and anyone who wants to handle pressure with greater focus and confidence.',
      image: 'https://pulsecheckmind.ai/pulsecheck-performers/performers-info-og.png',
      url: 'https://pulsecheckmind.ai/performers-info',
      type: 'website',
      siteName: 'PulseCheck',
    },
  },
});
