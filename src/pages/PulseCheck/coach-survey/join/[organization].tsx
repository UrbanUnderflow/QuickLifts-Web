import type { GetServerSideProps } from 'next';
import PublicCoachJoin from '../../../../components/coachSurveys/PublicCoachJoin';

export default function PublicCoachJoinPage({ organization }: { organization: string }) {
  return <PublicCoachJoin organization={organization} />;
}

export const getServerSideProps: GetServerSideProps = async ({ params, res }) => {
  if (params?.organization !== 'umes') return { notFound: true };
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return { props: { organization: params.organization } };
};
