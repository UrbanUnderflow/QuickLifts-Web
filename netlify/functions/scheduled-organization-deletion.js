const { schedule } = require('@netlify/functions');
const { getFirebaseAdminApp } = require('./config/firebase');
const { ORGANIZATIONS, purgeOrganizationBatch } = require('./lib/organization-lifecycle');
exports.handler = schedule('*/5 * * * *', async () => {
  const db = getFirebaseAdminApp().firestore(), now = Date.now();
  // Single-field expiry query avoids requiring a newly provisioned composite index.
  const candidates = await db.collection(ORGANIZATIONS).where('purgeAfter','<=',now).limit(10).get();
  let processed = 0, failed = 0;
  for (const doc of candidates.docs.filter(d => ['deleted','purging'].includes(d.data().lifecycleState)).slice(0,10)) {
    try { if ((await purgeOrganizationBatch({db,organizationId:doc.id,now})).processed) processed++; } catch { failed++; }
  }
  return {statusCode:200,body:JSON.stringify({processed,failed})};
});
