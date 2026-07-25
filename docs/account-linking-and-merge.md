# Account linking and duplicate-account merges

Pulse uses one Firebase Authentication UID as the canonical identity for each person. Email and
password, Apple, and Google are sign-in methods attached to that UID.

## Preventing new duplicates

- Social buttons on login pages only open existing accounts. If Firebase creates a new social
  identity during a login attempt, the temporary identity is deleted and the person is directed to
  sign up or connect the method from Settings.
- Social sign-up asks the person to confirm this is their first Pulse account before creating the
  Firestore profile.
- Exact-email provider conflicts keep the pending OAuth credential in memory. After the person
  signs in with the existing method on the same screen, the new provider is linked to that UID.
- Settings exposes the connected methods and allows Apple or Google to be added or removed. At
  least one sign-in method must remain.

Apple private relay emails can differ from the address used for email and password. Settings is the
canonical path for connecting Apple because the signed-in user provides the identity match.

## Self-service merge

If Apple or Google is already attached to another Firebase UID, connecting it from Settings runs an
ownership-proven merge:

1. The current Firebase ID token proves ownership of the account being kept.
2. A secondary Firebase Auth session signs in with the provider credential and provides an ID token
   for the duplicate account.
3. The server verifies both tokens against the same Firebase project.
4. The duplicate Auth user is disabled while records are moved.
5. Firestore records are archived under `account-merge-audits/{mergeId}/records`.
6. UID-keyed documents, user subcollections, membership records, and known UID references move to
   the canonical UID. Canonical values win field conflicts.
7. `account-aliases/{oldUid}` points to the canonical UID.
8. Stripe customer metadata is updated when a linked customer is present.
9. RevenueCat purchases are transferred to the canonical customer through the RevenueCat V2
   customer transfer endpoint. The configured key needs customer, subscription, and purchase
   read-write permissions.
10. The duplicate Auth user is deleted, and the provider credential is linked to the canonical
    user.
11. The audit becomes `complete`.

Any server failure before Auth deletion re-enables the duplicate Auth user.

## Admin-assisted merge

User Management includes a combine button on every user row.

The admin chooses the duplicate account and the account to keep, reviews a read-only inventory, and
enters the exact confirmation phrase. This stages the Firestore data merge and leaves the duplicate
Auth user active. The owner finishes the provider handoff from Settings, which proves they control
both sign-in methods.

Staged merges can be rolled back from the completion panel while the source Auth identity still
exists. A completed provider transfer cannot be automatically rolled back.

## Audit states

- `running`: the merge lock is held and records are moving.
- `data-merged`: an admin staged the records; provider proof is pending.
- `awaiting-provider-link`: self-service data movement and Auth deletion succeeded.
- `complete`: the provider is linked to the canonical Auth user.
- `failed`: the audit contains the failure and the archived records.
- `rolled-back`: archived Firestore records were restored.

The merge endpoint is `/.netlify/functions/merge-accounts`. It supports `preview`, `merge-data`,
`self-service-merge`, `finalize-provider-link`, `resolve-current-alias`, and `rollback`.
