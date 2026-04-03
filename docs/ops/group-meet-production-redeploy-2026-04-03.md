# Group Meet production redeploy

Date: 2026-04-03

Purpose:
Force a fresh production deploy after `fitwithpulse.ai/admin/groupMeet` reported `Unsupported Firebase Next API route.` even though `main` already contains the Firebase Next API route bridge entries for:

- `/api/admin/group-meet`
- `/api/admin/group-meet/contacts`
- `/api/admin/group-meet/test-email`
- `/api/admin/group-meet/[requestId]/send`
- `/api/admin/group-meet/[requestId]/preview-email`

Operational note:
This commit is intentionally low-risk and exists to trigger a new deploy from current `main` so production can pick up the already-committed Group Meet route proxy changes.
