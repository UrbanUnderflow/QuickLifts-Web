// Operational authorization applies independently of event-specific handoff consent.
function clinicalAuthorizationAllowsTransfer({ documents = [], decisions = {}, participationEnded = false, tier = 2 }) {
  // Urgent safety routing uses its separately configured emergency/safety basis.
  if (Number(tier) >= 3) return true;
  const applicable = documents.filter(doc => doc.category === 'health_authorization' || doc.id === 'pulsecheck-health-authorization');
  if (!applicable.length) return true; // Legacy deployments keep their existing lawful-basis workflow.
  if (participationEnded) return false;
  return applicable.every(doc => {
    const entry = decisions[doc.id];
    return entry?.decision === 'accepted' && entry.version === doc.version && entry.document?.body === doc.body && entry.document?.category === 'health_authorization' && Boolean(entry.signedName?.trim())
      && (!entry.expiresAt || Date.parse(entry.expiresAt) > Date.now());
  });
}
module.exports = { clinicalAuthorizationAllowsTransfer };
