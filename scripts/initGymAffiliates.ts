// scripts/initGymAffiliates.ts
// One-off initializer for the `gymAffiliates` collection.
//
// Creates a single test gym affiliate document matching the GymAffiliate schema:
// - gymId
// - gymName
// - partnerId (string doc ID from `partners` collection)
// - inviteCode (unique string used at signup)
// - memberSignupCount (initialized to 0)
//
// Usage (from project root):
//   npx ts-node scripts/initGymAffiliates.ts --partnerId=<PARTNER_DOC_ID> \
//       --gymId=<GYM_ID> --gymName="My Gym" --inviteCode=<UNIQUE_CODE>
//
// NOTE: This script requires `serviceAccountKey.json` at the project root
// (see .agent/workflows/firebase-admin.md) and should NOT be committed with
// any real credential values.

import path from 'path';
import process from 'process';
import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Minimal argument parsing (no extra deps)
interface InitArgs {
  partnerId: string;
  gymId: string;
  gymName: string;
  inviteCode: string;
}

function parseArgs(argv: string[]): InitArgs {
  const args: Partial<InitArgs> = {};

  argv.forEach((arg) => {
    if (arg.startsWith('--partnerId=')) {
      args.partnerId = arg.replace('--partnerId=', '');
    } else if (arg.startsWith('--gymId=')) {
      args.gymId = arg.replace('--gymId=', '');
    } else if (arg.startsWith('--gymName=')) {
      args.gymName = arg.replace('--gymName=', '');
    } else if (arg.startsWith('--inviteCode=')) {
      args.inviteCode = arg.replace('--inviteCode=', '');
    }
  });

  const missing: string[] = [];
  if (!args.partnerId) missing.push('partnerId');
  if (!args.gymId) missing.push('gymId');
  if (!args.gymName) missing.push('gymName');
  if (!args.inviteCode) missing.push('inviteCode');

  if (missing.length > 0) {
    console.error(
      `Missing required arguments: ${missing.join(', ')}.\n` +
        'Usage: npx ts-node scripts/initGymAffiliates.ts ' +
        '--partnerId=<PARTNER_DOC_ID> --gymId=<GYM_ID> ' +
        '--gymName="My Gym" --inviteCode=<UNIQUE_CODE>'
    );
    process.exit(1);
  }

  return args as InitArgs;
}

async function main() {
  const { partnerId, gymId, gymName, inviteCode } = parseArgs(process.argv.slice(2));

  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(serviceAccountPath) as ServiceAccount;

  const app = initializeApp({
    credential: cert(serviceAccount),
  });

  const db = getFirestore(app);

  const gymAffiliatesCollection = db.collection('gymAffiliates');

  const docData = {
    gymId,
    gymName,
    partnerId,
    inviteCode,
    memberSignupCount: 0,
  };

  // Use inviteCode as the document ID to enforce uniqueness at the collection level.
  const docRef = gymAffiliatesCollection.doc(inviteCode);

  const existing = await docRef.get();
  if (existing.exists) {
    console.error(`A gym affiliate with inviteCode '${inviteCode}' already exists (doc id: ${docRef.id}).`);
    process.exit(1);
  }

  await docRef.set(docData);

  console.log('Created gym affiliate document:');
  console.log({ id: docRef.id, ...docData });
}

main().catch((err) => {
  console.error('Failed to initialize gymAffiliates:', err);
  process.exit(1);
});
