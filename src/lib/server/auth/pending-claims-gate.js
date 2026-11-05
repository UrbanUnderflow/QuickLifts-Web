// Server-only and fail closed. Roster preparation does not enable sign-in claims.
function pendingClaimsEnabled() {
  return process.env.PENDING_ATHLETE_CLAIMS_ENABLED === 'true';
}
module.exports = { pendingClaimsEnabled };
