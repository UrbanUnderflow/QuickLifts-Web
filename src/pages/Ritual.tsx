import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import PageHead from '../components/PageHead';
import RitualLanding from '../components/ritual/RitualLanding';

const RITUAL_TITLE = 'Pulse Ritual — Water your body, mind, and spirit.';
const RITUAL_DESCRIPTION =
  'Pulse Ritual is the daily watering layer for human performance. Join the early access list for the next Pulse Intelligence Labs app.';
const RITUAL_URL = 'https://pulseintelligencelabs.com/Ritual';
const RITUAL_OG_IMAGE = 'https://pulseintelligencelabs.com/pil-og.png';

const RitualPage: NextPage = () => {
  return (
    <>
      <PageHead
        metaData={{
          pageId: 'ritual',
          pageTitle: RITUAL_TITLE,
          metaDescription: RITUAL_DESCRIPTION,
          lastUpdated: new Date().toISOString(),
        }}
        pageOgUrl={RITUAL_URL}
        pageOgImage={RITUAL_OG_IMAGE}
        themeColor="#5EEAD4"
        appleItunesAppArgument=""
      />
      <RitualLanding />
    </>
  );
};

export const getStaticProps: GetStaticProps = async () => ({
  props: {
    ogMeta: {
      title: RITUAL_TITLE,
      description: RITUAL_DESCRIPTION,
      image: RITUAL_OG_IMAGE,
      url: RITUAL_URL,
      type: 'website',
      siteName: 'Pulse Ritual',
    },
  },
});

export default RitualPage;
