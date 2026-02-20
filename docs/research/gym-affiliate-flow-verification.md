# Gym Affiliate Flow Verification — Schema, Signup, and Counters

**Task:** Add gym affiliate schema and linkage in Firestore so that:

1. `gymAffiliates` collection exists with fields: `gymId`, `gymName`, `partnerId`, `inviteCode`, `memberSignupCount`.
2. Web signup flow accepts an optional `inviteCode` and writes an affiliate reference to the `users` collection.
3. New users with valid invite codes cause `memberSignupCount` on the corresponding `gymAffiliates` document to increment.

This file documents what has been verified programmatically from this environment and what needs manual confirmation after deploying Firebase Functions.

---

## 1. Schema & Test Data Verification (Programmatic)

**Check:** `gymAffiliates` collection exists and contains at least one test doc matching the schema.

Executed via Node + Firebase Admin (see `.agent/workflows/firebase-admin.md` for pattern):

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web && node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('./serviceAccountKey.json');
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);
(async () => {
  const doc = await db.collection('gymAffiliates').doc('TEST-GYM-2026').get();
  if (!doc.exists) {
    console.error('gymAffiliates/TEST-GYM-2026 does not exist');
    process.exit(1);
  }
  console.log('gymAffiliates/TEST-GYM-2026 data:', doc.data());
})();
" 
```

**Observed output:**

```text
gymAffiliates/TEST-GYM-2026 data: {
  gymId: 'test-gym-1',
  gymName: 'Test Gym Affiliate Gym',
  partnerId: 'TEST-GYM-AFFILIATE-PARTNER',
  inviteCode: 'TEST-GYM-2026',
  memberSignupCount: 0
}
```

This confirms:

- `gymAffiliates` collection exists.
- Test document `TEST-GYM-2026` is present.
- All required fields are present and correctly typed.
- `memberSignupCount` initializes at `0`.

---

## 2. Signup Flow Wiring (Static Code Review)

**Objective:** Ensure that signing up via the web UI can carry a gym invite code through to the user document.

**Relevant frontend file:** `src/components/SignInModal.tsx`

### 2.1 Invite code input in signup UI

In `renderInitialStep`, when `isSignUp` is `true`, there is a new optional field:

```tsx
{isSignUp && (
  <div>
    <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
      Gym invite code <span className="text-zinc-500 text-xs">(optional)</span>
    </label>
    <input
      type="text"
      value={inviteCode}
      onChange={(e) => setInviteCode(e.target.value.trim())}
      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] transition-colors"
      placeholder="Enter your gym's invite code if you have one"
    />
  </div>
)}
```

This is tethered to a local `inviteCode` state variable:

```ts
const [inviteCode, setInviteCode] = useState("");
```

### 2.2 User creation carries gymInviteCode

In the email/password signup handler (`handleSubmit`, `signUpStep === "password"`), the new user payload includes `gymInviteCode` when present:

```ts
const { user } = await createUserWithEmailAndPassword(auth, email, password);

if (user) {
  // ... email existence checks ...

  const newUser = new User(user.uid, {
    id: user.uid,
    email: user.email,
    subscriptionType: SubscriptionType.unsubscribed,
    registrationComplete: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(inviteCode ? { gymInviteCode: inviteCode } : {})
  });

  await userService.updateUser(user.uid, newUser);
}
```

This ensures:

- **If** a gym invite code is entered, it is persisted as `gymInviteCode` on the `users/{userId}` document at creation time.
- This field is what the backend trigger uses to resolve the affiliate.

---

## 3. Backend User Creation Logic (Static Code Review)

**Objective:** Confirm that new users with valid gym invite codes cause affiliate counters to increment.

**Relevant backend files:**

- `functions/userAffiliateTriggers.js`
- `functions/index.js`

### 3.1 Trigger registration

`functions/index.js` exports the trigger:

```js
// Export user affiliate triggers
exports.onUserCreateGymAffiliate = require('./userAffiliateTriggers').onUserCreateGymAffiliate;
```

### 3.2 Trigger behavior on user create

`functions/userAffiliateTriggers.js` defines:

```js
exports.onUserCreateGymAffiliate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data() || {};
    const { userId } = context.params;

    let gymAffiliateId = userData.gymAffiliateId;
    const gymInviteCode = userData.gymInviteCode;

    // Resolve from gymInviteCode if needed
    if (!gymAffiliateId && gymInviteCode) {
      const affiliatesRef = db.collection('gymAffiliates');
      const snapshot = await affiliatesRef
        .where('inviteCode', '==', gymInviteCode)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const affiliateDoc = snapshot.docs[0];
        gymAffiliateId = affiliateDoc.id;
        await snap.ref.update({ gymAffiliateId });
      } else {
        // No match; log + skip
      }
    }

    if (!gymAffiliateId) {
      // Nothing to do
      return null;
    }

    const gymAffiliateRef = db.collection('gymAffiliates').doc(gymAffiliateId);
    const docSnap = await gymAffiliateRef.get();
    if (!docSnap.exists) {
      // Log + skip
      return null;
    }

    await gymAffiliateRef.update({
      memberSignupCount: admin.firestore.FieldValue.increment(1),
    });

    return null;
  });
```

Implications:

- If `gymInviteCode` is set on the user and matches a `gymAffiliates` doc’s `inviteCode`, the trigger:
  - Resolves the affiliate and writes `gymAffiliateId` onto the user.
  - Increments `memberSignupCount` on that affiliate.
- If `gymAffiliateId` is already set on the user at creation, the trigger skips resolution and just increments.

---

## 4. What Still Requires Manual Verification After Deploy

Because this environment cannot deploy Firebase Functions or run the web signup flow interactively, end-to-end verification of the runtime path must be completed by a human after deploying functions:

1. **Deploy functions** (from project root):
   - `firebase deploy --only functions:onUserCreateGymAffiliate` (or full functions deploy as appropriate).

2. **Web signup test (invite code):**
   - Open the Pulse web app in a browser.
   - Trigger the **Sign Up** flow so `SignInModal` appears.
   - Enter:
     - A new, unused email.
     - A valid password.
     - `TEST-GYM-2026` in the **Gym invite code (optional)** field.
   - Complete signup.

3. **Check `users/{userId}` document:**
   - In the Firebase console (Firestore):
     - Find the newly created `users/{userId}` document.
     - Confirm it contains:
       - `gymInviteCode: "TEST-GYM-2026"`
       - `gymAffiliateId: "TEST-GYM-2026"` (set by the trigger).

4. **Check `gymAffiliates/TEST-GYM-2026` document:**
   - In Firestore, open `gymAffiliates/TEST-GYM-2026`.
   - Confirm that `memberSignupCount` has increased from its previous value (e.g., from `0` to `1`).

5. **(Optional) Admin script double-check:**
   - After the signup and trigger have run, you can verify via Node:

   ```bash
   cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web && node -e "
   const { initializeApp, cert } = require('firebase-admin/app');
   const { getFirestore } = require('firebase-admin/firestore');
   const sa = require('./serviceAccountKey.json');
   const app = initializeApp({ credential: cert(sa) });
   const db = getFirestore(app);
   (async () => {
     const affiliate = await db.collection('gymAffiliates').doc('TEST-GYM-2026').get();
     console.log('Updated gymAffiliates/TEST-GYM-2026:', affiliate.data());
   })().catch(err => { console.error(err); process.exit(1); });
   "
   ```

   - Confirm that `memberSignupCount` reflects the number of test signups performed with `TEST-GYM-2026`.

---

## Summary

From within this environment, we have verified:

- `gymAffiliates` collection exists and has a correctly shaped test document (`TEST-GYM-2026`).
- The signup UI accepts an optional `inviteCode` and persists it as `gymInviteCode` on the `users` document.
- A Firestore `onCreate` trigger for `users/{userId}` resolves `gymInviteCode` → `gymAffiliateId` and increments `memberSignupCount` on the corresponding `gymAffiliates` document.

Final validation of the **live** end-to-end flow (web signup → trigger → counter increment) requires deploying the functions and running a manual signup with `inviteCode = TEST-GYM-2026`, then inspecting Firestore as described above.
