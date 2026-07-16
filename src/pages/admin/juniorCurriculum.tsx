import type { GetServerSideProps } from 'next';

const LegacyJuniorCurriculumRoute = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/curriculum-outline',
    permanent: true,
  },
});

export default LegacyJuniorCurriculumRoute;
