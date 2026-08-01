/**
 * Coach Mental Training Route Alias
 *
 * We keep `/coach/mental-training` as the canonical, lowercase URL.
 * This file re-exports the current implementation from `mentalGames.tsx`
 * to avoid "Page not found" issues when navigating via client-side tabs.
 */

import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/coach/dashboard?view=nora',
    permanent: false,
  },
});

export { default } from './mentalGames';
