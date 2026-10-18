const validId = value => typeof value === 'string' && value.length > 0 && value.length < 240 && !value.includes('/');
async function protectLegacyRoster(db, { coachId, organizationId, actorUid }, now) {
  if (![coachId, organizationId, actorUid].every(validId)) throw new Error('A configured organization and coach are required.');
  return db.runTransaction(async tx => {
    const org = await tx.get(db.collection('pulsecheck-organizations').doc(organizationId));
    if (!org.exists || !['pulsecheck', 'athleticmind'].includes(org.data().productBrand) || org.data().status !== 'active') throw new Error('Provision an active organization with an explicit program product before migrating this roster.');
    const roster = await tx.get(db.collection('coachAthletes').where('coachId', '==', coachId));
    const ids = [...new Set([coachId, ...roster.docs.map(doc => doc.data()).filter(data => data.status !== 'disconnected' && !data.pulseCheckMigrationStatus).map(data => data.athleteUserId).filter(validId)])];
    if (ids.length > 200) throw new Error('This roster requires a separately reviewed migration.');
    const closures = await Promise.all([...new Set([actorUid, ...ids])].map(uid => tx.get(db.collection('account-closure-jobs').doc(uid))));
    if (closures.some(doc => doc.exists)) throw new Error('Account closure prevents roster migration.');
    const markers = await Promise.all(ids.map(uid => tx.get(db.collection('pulsecheck-private-users').doc(uid))));
    ids.forEach((uid,index) => tx.set(db.collection('pulsecheck-private-users').doc(uid), { userId:uid, protected:true, createdAt:markers[index].data()?.createdAt || now }, {merge:true}));
    return { protectedUserIds:ids };
  });
}
module.exports = { protectLegacyRoster };
