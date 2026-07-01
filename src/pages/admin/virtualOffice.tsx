export const getServerSideProps = async () => ({
  redirect: {
    destination: '/admin/pulseCommand',
    permanent: false,
  },
});

export default function LegacyVirtualOfficeRedirect() {
  return null;
}
