import React from 'react';
import type { NextPage, GetStaticProps } from 'next';
import HomePage, { getStaticProps as getHomeStaticProps } from './index';

// Reuse the Home page so /about renders exactly the same content
// This keeps a single source of truth for the marketing layout

type HomeProps = React.ComponentProps<typeof HomePage>;

const About: NextPage<HomeProps> = (props) => {
  return <HomePage {...props} />;
};

export const getStaticProps: GetStaticProps = getHomeStaticProps;

export default About;