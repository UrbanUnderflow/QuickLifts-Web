import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import ProductPortfolioHome from '../../components/home/ProductPortfolioHome';

const META_TITLE = 'Pulse Intelligence Labs — PulseCheck, Fit With Pulse, Fit Club, and Macra';
const META_DESCRIPTION =
  'Pulse Intelligence Labs builds products for mental performance, fitness communities, clubs, and nutrition: PulseCheck, Fit With Pulse, Fit Club, and Macra.';
const META_URL = 'https://pulseintelligencelabs.com';
const META_OG_IMAGE = 'https://pulseintelligencelabs.com/pil-og.png';
const META_LAST_UPDATED = '2026-06-25T00:00:00.000Z';

type PILPageProps = {
  metaData: React.ComponentProps<typeof ProductPortfolioHome>['metaData'];
  ogMeta?: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
  };
};

const PILPage: NextPage<PILPageProps> = ({ metaData }) => {
  const handleExploreApps = () => {
    window.location.assign('/apps');
  };

  return (
    <ProductPortfolioHome
      metaData={metaData}
      pageOgUrl={META_URL}
      onUseWebApp={handleExploreApps}
      isSignInModalOpen={false}
      setIsSignInModalOpen={() => undefined}
      isAuthenticated={false}
      showAuthActions={false}
      primaryActionLabel="Explore Apps"
      finalCtaHeading="Use pulseintelligencelabs.com as the front door for the whole portfolio."
      finalCtaBody="Pulse Intelligence Labs can route people to the product that matches their job: athlete readiness, training, club building, or nutrition."
    />
  );
};

export const getStaticProps: GetStaticProps<PILPageProps> = async () => ({
  props: {
    metaData: {
      pageId: 'pil-home',
      pageTitle: META_TITLE,
      metaDescription: META_DESCRIPTION,
      ogTitle: 'Pulse Intelligence Labs',
      ogDescription: 'The company behind PulseCheck, Fit With Pulse, Fit Club, and Macra.',
      ogImage: '/pil-og.png',
      ogUrl: META_URL,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterTitle: 'Pulse Intelligence Labs',
      twitterDescription: 'The company behind PulseCheck, Fit With Pulse, Fit Club, and Macra.',
      twitterImage: '/pil-og.png',
      lastUpdated: META_LAST_UPDATED,
    },
    ogMeta: {
      title: META_TITLE,
      description: META_DESCRIPTION,
      image: META_OG_IMAGE,
      url: META_URL,
      type: 'website',
      siteName: 'Pulse Intelligence Labs',
    },
  },
});

export default PILPage;
