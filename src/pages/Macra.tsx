import type { NextPage } from 'next';
import React from 'react';
import PageHead from '../components/PageHead';
import MacraMarketingLanding from '../components/macra/MacraMarketingLanding';

const MacraPage: NextPage = () => {
  return (
    <>
      <PageHead
        metaData={{
          pageId: 'macra',
          pageTitle: 'Macra — Scan any food. Get your macros instantly.',
          metaDescription:
            'Macra turns any meal into a complete macro breakdown in seconds. Nora builds your daily meal plan around your exact targets. From Pulse Intelligence Labs.',
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl="https://fitwithpulse.ai/Macra"
      />
      <MacraMarketingLanding />
    </>
  );
};

export default MacraPage;
