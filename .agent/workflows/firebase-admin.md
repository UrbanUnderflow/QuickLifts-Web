---
description: How to use Firebase Admin SDK in standalone scripts
---

# Firebase Admin SDK Access

## Service Account Key Location
The Firebase service account key is at the **project root**:
```
/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/serviceAccountKey.json
```

This file is **gitignored** and should never be committed.

> The credentials are also embedded inline in `scripts/agentRunner.js` (search for `SERVICE_ACCOUNT`).

## Quick Usage Pattern

```javascript
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

const app = initializeApp({
  credential: cert(require(path.join(__dirname, '..', 'serviceAccountKey.json')))
});
const db = getFirestore(app);
```

## One-liner for ad-hoc scripts

// turbo
```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web && node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const app = initializeApp({ credential: cert(require('./serviceAccountKey.json')) });
const db = getFirestore(app);
// ... your Firestore code here ...
"
```

## Project ID
- Firebase project: `quicklifts-dd3f1`
- Service account email: `firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com`
