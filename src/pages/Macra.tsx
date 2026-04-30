import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import PageHead from '../components/PageHead';
import MacraMarketingLanding from '../components/macra/MacraMarketingLanding';

const MACRA_TITLE = 'Macra — Scan any food. Get your macros instantly.';
const MACRA_DESCRIPTION =
  'Macra turns any meal into a complete macro breakdown in seconds. Nora builds your daily meal plan around your exact targets. From Pulse Intelligence Labs.';
const MACRA_URL = 'https://eatwithmacra.ai';
const MACRA_OG_IMAGE = '/macra-og.png';
const MACRA_OG_IMAGE_URL = `${MACRA_URL}${MACRA_OG_IMAGE}`;
const MACRA_APP_STORE_ID = '6463771067';

const MacraPage: NextPage = () => {
  return (
    <>
      <PageHead
        metaData={{
          pageId: 'macra',
          pageTitle: MACRA_TITLE,
          metaDescription: MACRA_DESCRIPTION,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl={MACRA_URL}
        pageOgImage={MACRA_OG_IMAGE}
        appleItunesAppId={MACRA_APP_STORE_ID}
        appleItunesAppArgument=""
      />
      <MacraMarketingLanding />
    </>
  );
};

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: MACRA_TITLE,
      description: MACRA_DESCRIPTION,
      image: MACRA_OG_IMAGE_URL,
      url: MACRA_URL,
      type: 'website',
      siteName: 'Macra',
    },
  },
});

export default MacraPage;
