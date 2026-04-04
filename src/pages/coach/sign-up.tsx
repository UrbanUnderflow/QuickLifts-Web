import type { GetServerSideProps, NextPage } from 'next';

const LegacyCoachSignupRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const invite = typeof query.invite === 'string' ? query.invite.trim() : '';
  const legacyRef = typeof query.ref === 'string' ? query.ref.trim() : '';

  if (invite) {
    const params = new URLSearchParams({ type: 'coach', invite });
    return {
      redirect: {
        destination: `/sign-up?${params.toString()}`,
        permanent: false,
      },
    };
  }

  const params = new URLSearchParams();
  if (legacyRef) {
    params.set('legacyFlow', 'coach-referral-retired');
    params.set('ref', legacyRef);
  }

  return {
    redirect: {
      destination: params.toString() ? `/PulseCheck/coach?${params.toString()}` : '/PulseCheck/coach',
      permanent: false,
    },
  };
};

export default LegacyCoachSignupRedirectPage;
