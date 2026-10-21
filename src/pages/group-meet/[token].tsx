import React from 'react';
import { useRouter } from 'next/router';
import GroupMeetInviteAvailability from '../../components/group-meet/GroupMeetInviteAvailability';

export default function GroupMeetInvitePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  return <GroupMeetInviteAvailability key={token} token={token} />;
}
