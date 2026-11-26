import type { GetServerSideProps } from 'next';

/** Keep existing bookmarks pointed at the canonical curriculum workspace. */
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const settings = ['pillar', 'mapping', 'engine', 'transparency'];
  const destination = tab === 'rollups'
    ? 'https://theathleticmind.ai/internal/skill-curriculum?view=reports&tab=rollups'
    : tab && settings.includes(tab)
      ? `https://theathleticmind.ai/internal/skill-curriculum?view=settings&tab=${tab}`
      : 'https://theathleticmind.ai/internal/skill-curriculum?view=sequence';
  return { redirect: { destination, permanent: false } };
};

export default function CurriculumLayerRedirect() { return null; }
