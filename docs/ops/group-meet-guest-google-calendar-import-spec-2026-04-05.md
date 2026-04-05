# Group Meet guest Google Calendar import spec + implementation checklist

Date: 2026-04-05

Status:
Approved V1 product spec with implementation checklist

Owner:
Group Meet / QuickLifts Web

## Summary

Add an optional Google Calendar connection flow on the public Group Meet guest invite page so a guest can import availability suggestions from their own calendar before they manually save anything.

The intended UX is:

1. Keep the existing manual Group Meet flow exactly as-is.
2. Add an optional `Connect Google Calendar` action on the guest invite page.
3. After guest consent, read Google busy blocks for the request target month.
4. Convert those busy blocks into suggested available windows inside Group Meet.
5. Let the guest edit or ignore those suggestions before pressing `Save availability`.

This feature should make availability entry faster without ever silently submitting anything on behalf of the guest.

## Product goals

- Reduce guest effort when filling availability.
- Preserve user trust by making calendar import optional and review-first.
- Improve overlap quality by grounding suggestions in actual calendar occupancy.
- Keep Group Meet usable for guests who do not connect a calendar.

## Non-goals for V1

- Outlook, Apple Calendar, or CalDAV support.
- Two-way calendar sync.
- Automatic saving of imported availability without guest confirmation.
- Reading or storing full event details beyond what is needed to derive free/busy windows.
- Background refresh after initial import.
- Host-side viewing of guest private event titles or descriptions.

## UX contract

## Entry point

On [src/pages/group-meet/[token].tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/group-meet/[token].tsx), add a secondary action near the existing `Save availability` flow:

- `Connect Google Calendar`
- If already connected for this invite, show:
  - `Refresh from Google Calendar`
  - `Disconnect calendar`

## Guest flow

1. Guest opens public invite link.
2. Guest sees current manual calendar UI exactly as today.
3. Guest may tap `Connect Google Calendar`.
4. Guest completes Google OAuth consent.
5. Group Meet fetches busy blocks for the target month.
6. Group Meet converts those busy blocks into suggested available windows.
7. Suggestions appear visually inside the existing availability picker.
8. Guest can:
   - accept suggested windows
   - edit them
   - ignore them entirely
   - still add manual ranges normally
9. Only when the guest taps `Save availability` do we persist their final chosen windows.

## UX rules

- Calendar import must always be optional.
- Imported windows must be visibly labeled as imported or suggested until the guest saves.
- Manual edits must override imported suggestions cleanly.
- Imported data should never auto-save just because the guest connected Google.
- If import fails, the guest should remain in the normal manual flow with a clear error banner.

## Suggested UI additions

On the guest page:

- Add a compact card above the calendar:
  - `Connect Google Calendar`
  - helper copy: `Optional. Import availability suggestions from your calendar, then review before saving.`

After connect:

- Show connection state:
  - `Google Calendar connected`
  - last import timestamp
  - `Refresh`
  - `Disconnect`

Inside [src/components/group-meet/GroupMeetAvailabilityPicker.tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/group-meet/GroupMeetAvailabilityPicker.tsx):

- Add an `Imported from Google Calendar` label on ranges that came from import and have not yet been edited.
- Keep current overlap suggestions from other guests.
- Distinguish the two suggestion types:
  - peer-overlap suggestions
  - calendar-import suggestions

Recommended visual hierarchy:

- Imported calendar windows:
  low-opacity blue/neutral treatment
- Peer-overlap suggestions:
  existing lime/yellow recommendation treatment
- Saved guest ranges:
  current strong selected treatment

## Privacy contract

V1 should use Google free/busy style occupancy only.

Do:

- Read whether time is busy or free.
- Derive candidate free windows from that occupancy.
- Store minimal metadata needed to support refresh/disconnect for this invite.

Do not:

- Show raw Google event titles to the host.
- Show raw Google event titles to other guests.
- Persist event descriptions, attendees, locations, or conferencing links in Group Meet.
- Persist a long-term personal calendar mirror in Firestore.

Preferred data handling posture:

- Runtime reads busy windows from Google.
- Group Meet stores only:
  - connection status
  - provider = `google`
  - token references / encrypted credential material
  - last sync time
  - last sync result summary
- Derived availability suggestions live client-side until guest saves.

## Authentication model

This is a guest-consent OAuth flow, separate from the existing admin-side Google Calendar setup in [src/lib/googleCalendar.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/googleCalendar.ts).

The current admin integration is for host-side final event creation.
The new guest integration is for guest-side availability import.

V1 auth model:

- OAuth provider: Google only
- Scope target: read-only calendar availability access
- Connection is attached to a specific Group Meet invite token
- Connection should not require a QuickLifts account

Recommended scopes for V1:

- Prefer the narrowest viable read-only scope that supports free/busy
- If Google free/busy endpoint requirements force broader read access, still keep the app behavior free/busy-only

Implementation rule:

- The consented Google account belongs to the guest using the invite link
- The access grant is stored server-side against that invite token
- Tokens must never be exposed to the frontend except through server-controlled session handling

## Data model additions

Add invite-level optional connection metadata under the existing Group Meet invite record.

Suggested fields on `groupMeetInvites/{token}`:

```ts
calendarImport?: {
  provider: 'google';
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: Timestamp | null;
  disconnectedAt: Timestamp | null;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: 'success' | 'error' | 'never';
  lastSyncError: string | null;
  googleAccountEmail: string | null;
  tokenRefKey: string | null;
}
```

Important note:

- `tokenRefKey` should reference secure credential storage, not contain raw OAuth secrets in the document.

Recommended secret storage:

- encrypted credential record in Firestore only if we already have a strong server encryption pattern for this class of secret
- otherwise prefer Google Cloud Secret Manager or another server-only encrypted store keyed by invite token

## API surface

Recommended new public endpoints:

1. `POST /api/group-meet/[token]/calendar/google/connect/start`
Purpose:
Create the Google OAuth start URL for this invite.

2. `GET /api/group-meet/calendar/google/callback`
Purpose:
Handle Google OAuth callback, validate state, and bind granted credentials to the invite token.

3. `POST /api/group-meet/[token]/calendar/google/import`
Purpose:
Fetch Google busy windows for the target month and return derived Group Meet availability suggestions.

4. `POST /api/group-meet/[token]/calendar/google/disconnect`
Purpose:
Remove or invalidate the saved Google connection for this invite.

5. Optional:
`GET /api/group-meet/[token]/calendar/google/status`
Purpose:
Return connection state and last sync metadata for page load.

## Import algorithm

Input:

- target month from Group Meet request
- request timezone
- guest Google busy windows for the relevant date range

Output:

- suggested Group Meet availability slots compatible with the existing `GroupMeetAvailabilitySlot` shape

Recommended V1 derivation rules:

1. Pull busy blocks for the whole target month.
2. Normalize all times into the Group Meet request timezone.
3. For each day in the month:
   - subtract busy blocks from a default daily candidate window
4. Filter resulting free windows:
   - discard tiny fragments shorter than meeting duration
   - optionally cap to a reasonable day span such as 6 AM to 10 PM local time
5. Return normalized free windows as suggestions.

Important:

The import algorithm should not automatically assume the guest is available 24 hours a day. V1 needs an explicit daily envelope.

Recommended default envelope for V1:

- 6:00 AM to 10:00 PM in the request timezone

This keeps overnight free-time artifacts from polluting the suggestions.

## Interaction with existing Group Meet suggestions

Today the guest view already supports peer-based recommendations from responders.

Imported calendar suggestions should coexist with:

- guest manual selections
- other-participant availability indicators
- peer-overlap recommendation chips

Recommended precedence:

1. Saved manual guest ranges are the source of truth.
2. Imported calendar ranges are editable draft suggestions.
3. Peer-overlap ranges are recommendation hints, not imported truth.

## Failure handling

User-facing failures should be explicit and non-blocking.

Cases:

- Google auth denied
- expired or revoked refresh token
- Google API quota or availability error
- target month unavailable
- timezone conversion failure

Required UX response:

- show error banner / toast
- keep the manual Group Meet flow usable
- do not clear any manually entered ranges

## Security requirements

- Validate invite token before any connect/import/disconnect action.
- Use signed OAuth state containing the invite token and anti-forgery nonce.
- Store OAuth credentials server-side only.
- Never send raw OAuth credentials to the browser.
- Support disconnect and credential revocation cleanup.
- Log import events and failures without logging credential material.

## Analytics and audit events

Recommended events:

- `group_meet_guest_calendar_connect_started`
- `group_meet_guest_calendar_connect_succeeded`
- `group_meet_guest_calendar_connect_failed`
- `group_meet_guest_calendar_import_succeeded`
- `group_meet_guest_calendar_import_failed`
- `group_meet_guest_calendar_disconnected`
- `group_meet_guest_import_suggestions_applied`

Useful dimensions:

- requestId
- inviteToken
- provider
- targetMonth
- importedSlotCount
- syncDurationMs
- errorCode

## Env and config expectations

This guest-side feature will require a separate Google OAuth client contract from the current admin-side service-account / refresh-token setup.

Expected new envs:

- `GOOGLE_GUEST_CALENDAR_CLIENT_ID`
- `GOOGLE_GUEST_CALENDAR_CLIENT_SECRET`
- `GOOGLE_GUEST_CALENDAR_REDIRECT_URI`
- `GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY` or equivalent secure secret reference

Important:

Do not reuse the host-side final-event credential path as the guest OAuth credential model. They solve different problems and have different consent boundaries.

## QA scenarios

Must pass before release:

1. Guest declines Google auth and can still complete manual availability.
2. Guest connects Google and receives suggestions without auto-saving.
3. Guest edits imported ranges and saves successfully.
4. Guest disconnects Google and loses import access but keeps manually saved Group Meet availability.
5. Revoked Google token is detected cleanly and prompts reconnect.
6. Mobile guest flow remains usable end to end.
7. Host and other guests never see private Google event details.

## Recommendation

Proceed with Google-only V1 using optional guest OAuth plus import-as-suggestions.

This is the right first version because it:

- matches the existing Group Meet manual review posture
- improves speed without taking control away from the guest
- keeps privacy risk lower than event-level mirroring
- fits cleanly into the current public invite architecture

## Build target

The implementation should slot into:

- public invite UI:
  [src/pages/group-meet/[token].tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/group-meet/[token].tsx)
- public invite API:
  [src/pages/api/group-meet/[token].ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/group-meet/[token].ts)
- guest availability picker:
  [src/components/group-meet/GroupMeetAvailabilityPicker.tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/group-meet/GroupMeetAvailabilityPicker.tsx)
- existing admin Google Calendar helper reference:
  [src/lib/googleCalendar.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/googleCalendar.ts)

## Full implementation checklist

This section turns the approved spec into a build sequence. Items are grouped in dependency order so the work can be executed cleanly.

## 0. Alignment and guardrails

- [ ] Confirm V1 provider scope is Google only.
- [ ] Confirm V1 behavior is import-as-suggestions only, never auto-save.
- [ ] Confirm V1 uses free/busy occupancy only and does not persist raw event details.
- [ ] Confirm manual availability flow remains fully usable with no calendar connection.
- [ ] Confirm the guest-side OAuth flow is separate from the existing admin-side Google Calendar integration.

Exit criteria:

- Team agrees this feature is optional, review-first, and privacy-bounded.

## 1. Env and secret contract

- [ ] Add guest-calendar env names to local docs and runtime docs:
  - `GOOGLE_GUEST_CALENDAR_CLIENT_ID`
  - `GOOGLE_GUEST_CALENDAR_CLIENT_SECRET`
  - `GOOGLE_GUEST_CALENDAR_REDIRECT_URI`
  - `GOOGLE_GUEST_CALENDAR_ENCRYPTION_KEY` or secure equivalent
- [ ] Decide canonical secure storage location for guest OAuth credential material.
- [ ] Document that this guest OAuth contract must not reuse the host final-event credential path.
- [ ] Add env presence checks to any local env validation flow if appropriate.

Suggested files:

- [docs/testing/local-machine-setup.md](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/testing/local-machine-setup.md)
- [env-check.js](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/env-check.js)
- [src/components/admin/system-overview/InfrastructureSecretsStackTab.tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/admin/system-overview/InfrastructureSecretsStackTab.tsx)

Exit criteria:

- Local and deployed runtimes both know the required guest Google OAuth env contract.

## 2. Shared types and invite data model

- [ ] Add guest calendar import types to [src/lib/groupMeet.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/groupMeet.ts).
- [ ] Add invite-level `calendarImport` metadata shape.
- [ ] Add a type for imported suggestion ranges if frontend state should distinguish them from manual ranges.
- [ ] Decide whether imported suggestions should be returned from the public invite payload or fetched separately.

Recommended fields to support:

- [ ] `provider`
- [ ] `status`
- [ ] `connectedAt`
- [ ] `disconnectedAt`
- [ ] `lastSyncedAt`
- [ ] `lastSyncStatus`
- [ ] `lastSyncError`
- [ ] `googleAccountEmail`
- [ ] `tokenRefKey`

Exit criteria:

- There is a canonical type contract for connection state and imported suggestion state.

## 3. Secure guest OAuth helper layer

- [ ] Create a dedicated helper for guest Google OAuth, separate from [src/lib/googleCalendar.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/googleCalendar.ts).
- [ ] Add helper to create OAuth start URLs with signed `state`.
- [ ] Add helper to exchange auth codes for access/refresh tokens.
- [ ] Add helper to refresh guest tokens.
- [ ] Add helper to revoke or disconnect guest tokens.
- [ ] Add helper to fetch Google busy blocks for a date range.
- [ ] Ensure tokens are encrypted or securely referenced before persistence.

Suggested new file(s):

- [src/lib/groupMeetGuestGoogleCalendar.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/groupMeetGuestGoogleCalendar.ts)

Exit criteria:

- Server-side code can start OAuth, finish OAuth, read busy blocks, refresh tokens, and disconnect securely.

## 4. Public API endpoints

- [ ] Add `POST /api/group-meet/[token]/calendar/google/connect/start`
- [ ] Add `GET /api/group-meet/calendar/google/callback`
- [ ] Add `POST /api/group-meet/[token]/calendar/google/import`
- [ ] Add `POST /api/group-meet/[token]/calendar/google/disconnect`
- [ ] Optionally add `GET /api/group-meet/[token]/calendar/google/status`

For each endpoint:

- [ ] Validate invite token.
- [ ] Ensure the request is tied only to the referenced invite.
- [ ] Never expose stored OAuth credentials to the client.
- [ ] Return structured success/error payloads that fit the guest UI.

Suggested file targets:

- [src/pages/api/group-meet/[token].ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/group-meet/[token].ts)
- new sibling routes under `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/group-meet/`

Exit criteria:

- Public invite flow can connect, import, check status, and disconnect without any admin auth dependency.

## 5. OAuth callback safety

- [ ] Implement signed state payload with invite token and nonce.
- [ ] Add callback validation to reject tampered or expired state.
- [ ] Decide callback completion UX:
  - redirect back to guest invite page with success status
  - or popup/close flow if desired later
- [ ] Make callback failures route back to the guest page with a user-readable error state.

Exit criteria:

- Guest OAuth cannot be attached to the wrong invite and failed callbacks recover cleanly.

## 6. Google busy-to-availability conversion engine

- [ ] Build a pure helper that converts busy blocks into Group Meet suggestion slots.
- [ ] Normalize all Google times into the request timezone.
- [ ] Apply a daily envelope of `6:00 AM` to `10:00 PM` local request time.
- [ ] Subtract busy blocks from the daily envelope.
- [ ] Drop fragments shorter than `meetingDurationMinutes`.
- [ ] Return normalized `GroupMeetAvailabilitySlot` suggestions.
- [ ] Deduplicate adjacent or overlapping outputs where appropriate.

Suggested new helper:

- [src/lib/groupMeetGuestAvailabilityImport.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/lib/groupMeetGuestAvailabilityImport.ts)

Exit criteria:

- A deterministic helper can turn Google busy data into clean Group Meet suggestion ranges.

## 7. Invite payload expansion

- [ ] Expand the guest invite payload to include calendar import status metadata.
- [ ] Decide whether imported suggestion ranges should come from:
  - a separate import endpoint response only
  - or current invite payload after last import
- [ ] Keep current peer availability payload intact.
- [ ] Preserve backward compatibility for guests who never connect a calendar.

Suggested file:

- [src/pages/api/group-meet/[token].ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/api/group-meet/[token].ts)

Exit criteria:

- The guest page can render connection state and imported suggestion state without guessing.

## 8. Guest page UI: connection card

- [ ] Add a compact Google Calendar card above the availability picker.
- [ ] Add `Connect Google Calendar` action.
- [ ] After connect, show:
  - connected account email
  - last imported timestamp
  - `Refresh from Google Calendar`
  - `Disconnect calendar`
- [ ] Add success/error banners or toasts for connect/import/disconnect actions.
- [ ] Keep this card mobile-safe.

Suggested file:

- [src/pages/group-meet/[token].tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/group-meet/[token].tsx)

Exit criteria:

- Guest can clearly understand whether Google is connected and what the import actions do.

## 9. Guest page state management

- [ ] Add guest-page state for:
  - connection status
  - import loading
  - import errors
  - imported suggestion ranges
  - imported-at timestamp
- [ ] Ensure imported suggestions never overwrite manual saved selections automatically.
- [ ] Ensure a failed import never clears already-entered manual availability.
- [ ] Ensure disconnect removes Google import state but keeps manual Group Meet availability intact.

Suggested file:

- [src/pages/group-meet/[token].tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/pages/group-meet/[token].tsx)

Exit criteria:

- Guest page handles manual, imported, and saved states cleanly without collisions.

## 10. Availability picker integration

- [ ] Extend [src/components/group-meet/GroupMeetAvailabilityPicker.tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/group-meet/GroupMeetAvailabilityPicker.tsx) to accept imported suggestion ranges.
- [ ] Add a visual treatment for imported ranges distinct from peer-overlap suggestions.
- [ ] Add an `Imported from Google Calendar` label for unsaved imported ranges.
- [ ] Let guest tap imported suggestions to adopt them.
- [ ] Let guest edit imported ranges exactly like manual ranges.
- [ ] Ensure imported ranges can coexist with:
  - current manual selections
  - peer avatars
  - peer-overlap suggestions
- [ ] Maintain mobile layout quality.

Exit criteria:

- Imported suggestions feel native inside the existing picker and remain clearly editable.

## 11. Save semantics

- [ ] Keep current `Save availability` as the only persistence action.
- [ ] Ensure imported ranges are not persisted until the guest presses save.
- [ ] When save happens, persist only the guest’s final edited availability entries, not raw Google busy blocks.
- [ ] Decide whether imported-vs-manual provenance needs to be stored after save.
  - Recommended V1: no provenance required after final availability is saved

Exit criteria:

- Group Meet stores final chosen availability only, not a hidden auto-import artifact.

## 12. Disconnect semantics

- [ ] Disconnect should revoke or invalidate stored Google credentials.
- [ ] Disconnect should set `calendarImport.status = disconnected`.
- [ ] Disconnect should preserve any manually saved Group Meet availability.
- [ ] Disconnect should clear client-side imported suggestion draft state.

Exit criteria:

- Guest can safely remove Google access without losing already-saved availability.

## 13. Error handling and recovery

- [ ] Handle consent denial.
- [ ] Handle expired or revoked refresh token.
- [ ] Handle Google API unavailability.
- [ ] Handle quota errors.
- [ ] Handle malformed or missing callback state.
- [ ] Handle timezone normalization failures.
- [ ] Show plain-language recovery guidance in the guest UI.

Required UX rule:

- On any import/connect failure, the manual availability flow must remain usable.

Exit criteria:

- Failures degrade gracefully back to the normal manual workflow.

## 14. Privacy and security review

- [ ] Confirm no private Google event titles are ever rendered in Group Meet.
- [ ] Confirm no event descriptions, attendees, locations, or meeting links are persisted.
- [ ] Confirm OAuth tokens never reach the browser except through normal redirect semantics.
- [ ] Confirm logs never include raw token material.
- [ ] Confirm invite-token ownership is validated on every guest-calendar endpoint.

Exit criteria:

- Privacy boundary is enforced in code, not just in copy.

## 15. Telemetry and audit trail

- [ ] Emit connect/import/disconnect events.
- [ ] Include requestId, inviteToken, provider, targetMonth, success/failure outcome, and error code.
- [ ] Record last sync timestamp and last sync result on invite metadata.
- [ ] Decide whether admin request detail should show that a guest imported from Google.
  - Recommended V1: show connection/sync state only if useful, never event content

Exit criteria:

- Support and debugging can answer whether connect/import/disconnect happened and whether it succeeded.

## 16. Documentation updates

- [ ] Update local machine/setup docs with new envs.
- [ ] Update system overview / infrastructure secrets docs with guest Google OAuth contract.
- [ ] Add operational notes for callback URL and Google console setup.
- [ ] Document that admin Google Calendar and guest Google Calendar are separate integrations.

Suggested docs:

- [docs/testing/local-machine-setup.md](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/docs/testing/local-machine-setup.md)
- [src/components/admin/system-overview/InfrastructureSecretsStackTab.tsx](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/components/admin/system-overview/InfrastructureSecretsStackTab.tsx)
- [src/content/system-overview/manifest.ts](/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/content/system-overview/manifest.ts)

Exit criteria:

- Future setup does not depend on tribal knowledge.

## 17. Automated tests

- [ ] Unit test busy-to-availability conversion helper.
- [ ] Unit test timezone normalization.
- [ ] Unit test daily envelope filtering.
- [ ] Unit test status mapping for connected / disconnected / import error states.
- [ ] Runtime test public API connect/import/disconnect handlers with mocks.
- [ ] Regression test manual guest flow still works without Google.
- [ ] Regression test imported suggestions do not auto-save.

Suggested test targets:

- `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/api/group-meet/`
- new focused helper tests under `/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/tests/`

Exit criteria:

- Google import logic and manual guest flow are both covered by automated tests.

## 18. Manual QA checklist

- [ ] Guest declines auth and still uses manual flow.
- [ ] Guest connects and sees imported suggestions.
- [ ] Guest edits imported suggestions before save.
- [ ] Guest ignores imported suggestions and adds manual ranges instead.
- [ ] Guest disconnects and still sees previously saved manual availability.
- [ ] Guest reconnects after revocation.
- [ ] Mobile guest flow is clean.
- [ ] Desktop guest flow is clean.
- [ ] Host/admin cannot see private Google event content anywhere.

Exit criteria:

- Core guest scenarios are verified end to end on desktop and mobile.

## 19. Release gating

- [ ] Env vars configured in target environment.
- [ ] Google OAuth redirect URI configured correctly in Google Cloud console.
- [ ] Security review complete.
- [ ] QA complete.
- [ ] Docs updated.
- [ ] Rollout owner assigned.

Final release question:

- [ ] Is manual Group Meet still fully functional when Google import is unavailable?

The answer must be yes before release.
