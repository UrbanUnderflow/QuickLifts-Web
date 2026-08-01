// This route stays on the web so an installed app cannot intercept checkout.
// The shared invite page handles identity, offer details, and Stripe handoff.
import TeamInvitePage, {
  getServerSideProps as getTeamInviteServerSideProps,
} from '../team-invite/[token]';

export const getServerSideProps = getTeamInviteServerSideProps;

export default TeamInvitePage;
