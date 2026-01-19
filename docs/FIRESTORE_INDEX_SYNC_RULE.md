# Firestore Index Sync Rule (MANDATORY Before Any Index Deploy)

## Why this exists

Deploying Firestore indexes with:

`firebase deploy --only firestore:indexes`

can **DELETE** indexes that exist in Firebase but are **missing** from our repo’s `firestore.indexes.json`.

That means if someone adds an index in the Firebase console and we later deploy from a stale `firestore.indexes.json`, we can accidentally delete that console-created index and break production queries.

This doc defines the **mandatory pre-deploy step** to prevent that.

---

## ✅ The Rule

**Before ANY deploy that includes Firestore indexes, you must run the sync check and resolve any diffs.**

This applies to:
- `firebase deploy --only firestore:indexes`
- any “deploy everything” command that includes indexes
- any scripts that deploy indexes

---

## The Workflow (Always Do This)

### 1) Run the sync check (NO file changes)

From `QuickLifts-Web/`:

```bash
bash scripts/sync-firestore-indexes.sh
```

To check production explicitly:

```bash
bash scripts/sync-firestore-indexes.sh --project quicklifts-dd3f1
```

### 2) If it reports OUT OF SYNC

This means **Firebase has indexes that your repo file does not** (often because someone created an index via the console link).

Sync your local file to match live:

```bash
bash scripts/sync-firestore-indexes.sh --project quicklifts-dd3f1 --write
```

Then:
- review `git diff`
- commit `firestore.indexes.json`
- proceed with deploy

### 3) If you are intentionally adding new indexes

The safe order is:

1. Sync down from live first (**must pass**)
2. Add your new index entries to `firestore.indexes.json`
3. Deploy indexes
4. Sync down again (optional, but recommended) and confirm “In sync”

---

## The Script

We use:
- `scripts/sync-firestore-indexes.sh` — exports *live* indexes and diffs them against `firestore.indexes.json`

Outputs:
- Writes live snapshot to `QuickLifts-Web/temp/firestore.indexes.live.<project>.json`
- Exits `2` if there’s a diff (so CI can fail if you want)

---

## Safety Guardrail

`scripts/sync-firebase-indexes.sh` (the deploy helper) now refuses to deploy indexes unless the sync check passes first.

---

## TL;DR

- **Never deploy indexes without syncing first.**
- If live != local, run `--write`, commit, then deploy.

