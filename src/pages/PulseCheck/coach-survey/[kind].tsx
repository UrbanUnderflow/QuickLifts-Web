import type { GetServerSideProps } from 'next';
import CoachSurvey from '../../../components/coachSurveys/CoachSurvey';
import { isSurveyKind, type SurveyKind } from '../../../lib/coachSurveys/questionnaire';

export default function CoachSurveyPage(props: { kind: SurveyKind; review: boolean }) { return <CoachSurvey key={props.kind} {...props} />; }
export const getServerSideProps: GetServerSideProps = async ({ params, query, res }) => {
  if (!isSurveyKind(params?.kind)) return { notFound: true };
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return { props: { kind: params.kind, review: process.env.NODE_ENV === 'development' && query.review === '1' } };
};
