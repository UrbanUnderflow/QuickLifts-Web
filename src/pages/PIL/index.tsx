import type { GetStaticProps, NextPage } from 'next';
import React from 'react';
import ProductPortfolioHome from '../../components/home/ProductPortfolioHome';

const META_TITLE = 'Pulse Intelligence Labs | PulseCheck';
const META_DESCRIPTION =
  'Pulse Intelligence Labs builds PulseCheck for daily mental performance practice and coordinated team support.';
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
      focusPulseCheck
      metaData={metaData}
      pageOgUrl={META_URL}
      finalCtaHeading="See how PulseCheck fits your team."
      finalCtaBody="Tell us about your team and the support you want to build. Explore the PulseCheck experience with us."
    />
);

export const getStaticProps: GetStaticProps<PILPageProps> = async () => ({
  props: {
    metaData: {
      pageId: 'pil-home',
      pageTitle: META_TITLE,
      metaDescription: META_DESCRIPTION,
      ogTitle: 'Pulse Intelligence Labs',
      ogDescription: 'The company behind PulseCheck. Daily mental performance practice and team support.',
      ogImage: '/pil-og.png',
      ogUrl: META_URL,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterTitle: 'Pulse Intelligence Labs',
      twitterDescription: 'The company behind PulseCheck. Daily mental performance practice and team support.',
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
