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

const PILPage: NextPage<PILPageProps> = ({ metaData }) => (
    <ProductPortfolioHome
      metaData={metaData}
      pageOgUrl={META_URL}
      finalCtaHeading="Tell us what you are building. We will point you to the right product."
      finalCtaBody="Use the demo form to tell us your role and which product you want to see. We will follow up with the clearest next step."
    />
);

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
