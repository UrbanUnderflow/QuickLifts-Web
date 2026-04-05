import type { GetServerSideProps, NextPage } from 'next';

const LegacyCoachLandingRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/PulseCheck/coach',
    permanent: false,
  },
});

export default LegacyCoachLandingRedirectPage;
