// The parent pointer is read inside the transaction so concurrent replacements
// revoke the actual winner, including links absent from the caller's old query.
async function replaceInviteAtomically({ runTransaction, teamRef, organizationRef, inviteRefFor,
  previousRefs, payload, pointerKey, reuse, timestamp }) {
  return runTransaction(async transaction => {
    const team = await transaction.get(teamRef);
    const organization = await transaction.get(organizationRef);
    if (!team.exists() || !organization.exists() || team.data().organizationId !== payload.organizationId) throw new Error('Invite team and organization must match.');
    const previousId = team.data().inviteReplacementPointers?.[pointerKey];
    const refs = new Map(previousRefs.map(ref => [ref.id, ref]));
    if (previousId) refs.set(previousId, inviteRefFor(previousId));
    const previous = await Promise.all([...refs.values()].map(ref => transaction.get(ref)));
    if (previous.some(snapshot => snapshot.exists() && (snapshot.data().teamId !== payload.teamId ||
      snapshot.data().organizationId !== payload.organizationId || snapshot.data().inviteType !== payload.inviteType))) {
      throw new Error('Invite scope changed. Reload before replacing this link.');
    }
    const usable = snapshot => snapshot.exists() && ['active', 'redeemed'].includes(snapshot.data().status);
    const reusable = reuse ? previous.find(snapshot => snapshot.id === previousId && usable(snapshot))
      || previous.find(snapshot => snapshot.id === payload.token && usable(snapshot))
      || previous.find(usable) : null;
    const token = reusable?.id || payload.token;
    for (const snapshot of previous) if (snapshot.exists() && snapshot.id !== token && snapshot.data().status === 'active') {
      transaction.update(snapshot.ref, { status: 'revoked', updatedAt: timestamp });
    }
    transaction.set(inviteRefFor(token), { ...payload, token,
      activationUrl: payload.activationUrl.split(payload.token).join(token),
      ...(payload.activationCode ? { activationCode: reusable?.data().activationCode || token.replace(/-/g, '').slice(0, 16).toUpperCase() } : {}),
      ...(payload.commercialSnapshot ? { commercialSnapshot: { ...payload.commercialSnapshot, inviteToken: token } } : {}),
      ...(reusable ? { createdAt: reusable.data().createdAt || payload.createdAt, redemptionCount: reusable.data().redemptionCount || 0 } : {}) }, { merge: Boolean(reusable) });
    const teamUpdate = { [`inviteReplacementPointers.${pointerKey}`]: token, updatedAt: timestamp };
    if (payload.inviteType === 'admin-activation') {
      const preActivation = status => ['draft', 'provisioning'].includes(status);
      if (preActivation(team.data().status)) teamUpdate.status = 'ready-for-activation';
      if (preActivation(organization.data().status)) transaction.update(organizationRef, { status: 'ready-for-activation', updatedAt: timestamp });
    }
    transaction.update(teamRef, teamUpdate);
    return token;
  });
}
module.exports = { replaceInviteAtomically };
