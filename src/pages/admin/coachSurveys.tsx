import type { GetServerSideProps } from 'next';
export default function CoachSurveysRedirect() { return null; }
export const getServerSideProps: GetServerSideProps = async () => ({ redirect: { destination: '/admin/pulsecheckProvisioning', permanent: false } });
