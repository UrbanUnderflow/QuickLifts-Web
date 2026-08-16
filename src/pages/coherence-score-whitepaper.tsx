import type { GetServerSideProps, NextPage } from 'next';
import { COHERENCE_SCORE_WHITE_PAPER_SLUG } from '../content/research/coherence-score-whitepaper';

const LegacyCoherenceScoreWhitepaperPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: `/research/${COHERENCE_SCORE_WHITE_PAPER_SLUG}`,
    permanent: true,
  },
});

export default LegacyCoherenceScoreWhitepaperPage;
