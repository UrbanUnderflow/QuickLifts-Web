export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/creators',
      permanent: true,
    },
  }
}

export default function CreatorRedirect() {
  return null;
}
