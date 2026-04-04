import type { GetServerSideProps, NextPage } from 'next';

const LegacyCoachOnboardRedirectPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const invite =
    typeof query.invite === 'string'
      ? query.invite.trim()
      : typeof query.ref === 'string'
        ? query.ref.trim()
        : '';

  const params = new URLSearchParams();
  params.set('type', 'coach');
  if (invite) {
    params.set('invite', invite);
  }

  return {
    redirect: {
      destination: `/sign-up?${params.toString()}`,
      permanent: false,
    },
  };
};

export default LegacyCoachOnboardRedirectPage;
