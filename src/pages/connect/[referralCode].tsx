import type { GetServerSideProps, NextPage } from 'next';

const LegacyAthleteReferralRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const referralCode = typeof params?.referralCode === 'string' ? params.referralCode.trim() : '';
  const search = new URLSearchParams({ legacyFlow: 'athlete-referral-retired' });
  if (referralCode) {
    search.set('ref', referralCode);
  }

  return {
    redirect: {
      destination: `/PulseCheck/login?${search.toString()}`,
      permanent: false,
    },
  };
};

export default LegacyAthleteReferralRedirectPage;
