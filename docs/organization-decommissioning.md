# Organization decommissioning

Provisioning offers Delete organization with exact-name confirmation and a separate Deleted organizations restore list. Only an authenticated platform admin in the selected Firebase environment can change lifecycle state. No customer organization is deleted by deployment.

## Lifecycle

- Delete atomically sets status decommissioned and lifecycleState deleted, preserving settings. The organization disappears from the active directory. Current parent checks close team dashboards, reports, invitations, organization notifications and scoped clinical transport. Personal resources remain available.
- Restore is allowed strictly before deletedAt + 90 × 24 hours, checked by the server. It restores the previous status, including provisioning/draft states. Existing team settings and report schedules resume subject to their ordinary eligibility checks.
- The backend worker runs every five minutes. At expiry it atomically changes the state to purging; restoration then remains blocked. Bounded leased batches are retryable. Completed organizations leave the expiry query.
- Final cleanup removes organization/team settings, owned invite links, activation invitations, native handoffs, invite acceptance outbox entries, and participation report snapshots/configuration. Minimal denied-access organization/team tombstones prevent stale grants from reopening access.

## Retained records

Personal accounts and athlete history remain. Membership consent evidence, pilot/cohort definitions referenced by enrollments, research and clinical records remain under their existing access boundaries. Shared partner credentials can cover other organizations and are retained; the deleted organization scope is rejected. Uploaded artwork and backups are not erased by this worker. This is permanent organization decommissioning, not a promise to erase all personal or regulated records.

## Release verification

Tests use synthetic records: exact confirmation, admin authorization, 90-day boundary, restore, expired leases, multipage cleanup, cross-organization isolation, access rules, reminder suppression and resource-only critical fallback. The browser component test uses synthetic HTTP responses and blocks external network access.

Production rules differ from the repository. scripts/organization-lifecycle/build-scoped-rules.cjs prepares a narrow patch over the downloaded current production rules; test that exact candidate in the emulator and compare the release identity before publishing. Do not overwrite unrelated live rules with the full local file. Native apps may retain previously cached data; server access is revoked immediately, and this feature does not remotely erase device caches.
