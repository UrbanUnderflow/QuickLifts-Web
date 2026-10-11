const { createDeployedSnapshotPullHandler } = require('./lib/athleticmind-snapshot-pull');

exports.handler = createDeployedSnapshotPullHandler({
  getDb: () => require('./config/firebase').getFirebaseAdminApp({ headers: {} }).firestore(),
});
