import type { GetServerSideProps } from 'next';
import React from 'react';
import { fetchClubLandingPageProps, type ClubLandingPageProps } from '../../../api/firebase/club/landingPage';
import ClubInstallLanding from '../../../components/club/ClubInstallLanding';
import { pulseWebOrigin } from '../../../utils/clubLinks';

type InstallPageProps = ClubLandingPageProps & {
  pageUrl: string;
  sharedBy: string | null;
  eventId: string | null;
};

const normalizeValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const ClubInstallPage = ({ clubData, creatorData, totalWorkoutsCompleted, allRounds, pageUrl, sharedBy, eventId }: InstallPageProps) => {
  if (!clubData) {
    return null;
  }

  return (
    <ClubInstallLanding
      clubData={clubData}
      creatorData={creatorData}
      totalWorkoutsCompleted={totalWorkoutsCompleted}
      allRounds={allRounds}
      pageUrl={pageUrl}
      sharedBy={sharedBy}
      eventId={eventId}
    />
  );
};

export const getServerSideProps: GetServerSideProps<InstallPageProps> = async ({ params, query, res }) => {
  const id = typeof params?.id === 'string' ? params.id : '';
  const sharedBy = normalizeValue(query.sharedBy);
  const eventId = normalizeValue(query.eventId);

  const sharedProps = await fetchClubLandingPageProps({ clubId: id, res });
  res?.setHeader('Cache-Control', 'private, no-store, max-age=0');

  if (sharedProps.error || !sharedProps.clubData) {
    return {
      props: {
        ...sharedProps,
        pageUrl: `${pulseWebOrigin}/club/${encodeURIComponent(id)}/install`,
        sharedBy: sharedBy || null,
        eventId: eventId || null,
      },
    };
  }

  const pageQuery = new URLSearchParams();
  if (sharedBy) {
    pageQuery.set('sharedBy', sharedBy);
  }
  if (eventId) {
    pageQuery.set('eventId', eventId);
  }

  const pageUrl = `${pulseWebOrigin}/club/${encodeURIComponent(id)}/install${pageQuery.toString() ? `?${pageQuery.toString()}` : ''}`;

  return {
    props: {
      ...sharedProps,
      pageUrl,
      sharedBy: sharedBy || null,
      eventId: eventId || null,
    },
  };
};

export default ClubInstallPage;
