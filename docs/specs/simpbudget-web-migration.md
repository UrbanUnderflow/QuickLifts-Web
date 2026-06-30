# SimpBudget Web Migration

## Route

SimpBudget lives at `/SimpBudget`, so the production URL is:

https://fitwithpulse.ai/SimpBudget

The page is intentionally separate from `/admin/founderBudget`. The admin page remains the source surface until Tremaine imports those records into the new SimpBudget Firebase project.

## Firebase Project

The web route initializes a named Firebase app for the SimpBudget project:

- Project ID: `simpbudget-e213e`
- Auth domain: `simpbudget-e213e.firebaseapp.com`
- Storage bucket: `simpbudget-e213e.firebasestorage.app`

Set these Netlify environment variables before production deploy:

- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_API_KEY`
- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_SIMPBUDGET_FIREBASE_APP_ID`

## Data Model

SimpBudget writes per-user data under:

- `simpbudget-users/{uid}`
- `simpbudget-users/{uid}/budgetSpaces/{spaceId}`
- `simpbudget-users/{uid}/budgets/{spaceId}-{year}-{month}`

Budget Spaces replace the old hardcoded `business | personal` model. Imported Business and Personal data become normal Budget Spaces, and new spaces can be added for projects, launches, trips, households, or any other budget context.

## Migration Flow

1. Tremaine signs into `/SimpBudget` with `tremaine.grant@gmail.com`.
2. The page signs into the SimpBudget Firebase project.
3. Tremaine connects the QuickLifts source with Google if it is not already connected.
4. The importer reads `founder-budgets` from the existing QuickLifts Firebase project.
5. The importer writes Business and Personal as Budget Spaces in `simpbudget-e213e`.
6. Each saved founder budget month is copied into `simpbudget-users/{uid}/budgets`.

The importer is idempotent. Running it again updates the migrated Business and Personal month records in SimpBudget.

## Firestore Rules Shape

The SimpBudget project should allow an authenticated user to read/write only their own document tree:

```text
match /simpbudget-users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Storage uploads use:

```text
simpbudget-imports/{uid}/{spaceId}/{yearMonth}/{fileName}
```

Storage rules should similarly require `request.auth.uid == uid`.
