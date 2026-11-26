import type { GetServerSideProps } from 'next';

const LegacyJuniorCurriculumRoute = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: 'https://theathleticmind.ai/internal/skill-curriculum?view=content&track=junior',
    permanent: false,
  },
});

export default LegacyJuniorCurriculumRoute;
