import type { NextPage } from 'next';
import React from 'react';
import PageHead from '../components/PageHead';
import NoraLanding from '../components/nora/NoraLanding';

const NoraPage: NextPage = () => {
  return (
    <>
      <PageHead
        metaData={{
          pageId: 'nora',
          pageTitle: 'Nora AI — The coach inside every Pulse product.',
          metaDescription:
            'Meet Nora. The always-on AI companion inside PulseCheck, Fit With Pulse, and Macra. Warm, precise, trained in sport psychology — with her signature voice and orb.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/Nora"
        pageOgImage="/nora-og.png"
      />
      <NoraLanding />
    </>
  );
};

export default NoraPage;
