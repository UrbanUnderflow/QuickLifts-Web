export const getServerSideProps = async () => ({
  redirect: {
    destination: '/admin/pulseCommand',
    permanent: false,
  },
});

export default function LegacyMissionControlRedirect() {
  return null;
}
