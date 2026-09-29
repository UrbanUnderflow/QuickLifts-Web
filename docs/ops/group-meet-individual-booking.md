# Individual bookings in GroupMeet

Individual booking is separate from group availability collection. The existing `/GroupMeet` and `/admin/groupMeet` workspace now includes **Individual bookings**. It manages one host using the existing server Google Calendar connection.

## Host setup

1. Deploy the narrow Firestore rule changes for `groupMeetBookingSettings`, `groupMeetBookings`, and `groupMeetBookingLimits` before enabling bookings. They must be excluded from the legacy signed-in fallback; an explicit deny alone does not override another matching allow.
2. Deploy the application. No production deployment or calendar event creation is performed by the implementation tests.
3. Sign in with an admin account in the primary Firebase project. The booking settings endpoint intentionally rejects dev-project and localhost auth bypasses.
4. Open GroupMeet → Individual bookings. Check the configured host mailbox/calendar, choose timezone, available weekdays/hours, durations, buffer, minimum notice, and booking horizon. The initial defaults are paused, weekdays 9–5 America/New_York, 15/30/60 minutes, 15-minute buffer, 24-hour notice, and a 30-day horizon.
5. Enable and save, then copy `/group-meet/book/tremaine` (or the configured slug). Confirm live availability and a real test booking, invite, Meet link, reschedule, and cancellation before sharing broadly. Calendar “configured” is credential presence, not proof that live access works.

The existing `GOOGLE_CALENDAR_*` credentials and calendar ID are reused. The account needs calendar read/write access and Google Meet conference support. `NEXT_PUBLIC_SITE_URL` (or Netlify `URL`) supplies the trusted management-link origin in calendar invitations; configure it to the intended public domain. Public routes are also passed through on the PIL domain. E2E dev-Firebase mode blocks real calendar operations.

## Behavior and boundaries

- Visitors select a slot in their browser timezone, enter name/email, and receive a Google Calendar invitation without signing in. Calendar event details are never returned in public slot results.
- Availability is derived from the configured calendar, host hours, notice, horizon, and durable booking reservations. It checks only that one calendar, not every calendar in the host's Google account.
- Settings support one daily time window across selected weekdays. Per-day windows, date overrides, multiple hosts/calendars, payments, and custom intake questions are not included.
- Google Calendar sends attendee invitations and updates. No additional email provider is required. Google may generate the Meet link asynchronously; management-page reads refresh missing links.
- Calendar events contain a private management link for cancel/reschedule. Treat that URL as a credential. Booking pages bypass global analytics and authentication wrappers, return no-store API responses, and set no-referrer metadata.
- Cancellation remains available while bookings are paused. Previously submitted requests can reconcile after the public link is renamed or paused.
- Changing calendar configuration affects new bookings. Existing records retain their original calendar ID; credentials still need access to it.

## Reliability

Reservations use a shared Firestore transaction guard plus overlap checks, including buffers and meetings of different lengths. A deterministic Google event ID makes creation retries idempotent. Old and new slots remain reserved during rescheduling. A final provider availability read precedes event creation/update. External calendar writers can still insert conflicting events between that read and the write: Google Calendar offers no atomic reserve-if-free operation.

After an uncertain provider response, the reservation remains held. The visitor's browser retains the exact booking request in session storage. **Retry booking confirmation** reconciles that event instead of sending a second invitation. Management pages show **Retry meeting update** for unfinished cancellation/rescheduling, including after reload. Known failures before a provider write or definitive provider rejection release the reservation. Do not manually delete uncertain reservations without reconciling their event IDs.

Request throttles are stored per hashed client address and operation type with ten-minute windows. The `expiresAt` field can be configured as a Firestore TTL to remove inactive limiter records. Reservations are server-only; no browser SDK writes are required.

## Local verification

- Pure rules: `node --import tsx --test tests/unit/group-meet-booking.test.ts`
- Mocked server/API: `node --test tests/api/group-meet/individual-booking*.test.cjs`
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit`
- Browser suite: `tests/e2e/group-meet-individual-booking.spec.ts` uses intercepted APIs and never creates real meetings.

The mocked suite exercises conflict handling and provider recovery but does not prove actual Firestore concurrency, deployed rules, delivered emails, or signed-in Google behavior. This implementation session could not start a local web server or Chromium because of sandbox permissions; browser tests are included for execution in a permitted environment.

### Verification from this implementation

Production build, full TypeScript check, and scoped ESLint passed. All five new routes appear in the build manifest, and generated guest-page HTML includes page content without the Google Analytics script. All 40 new rule/server/API tests pass. Five mocked Playwright scenarios were discovered but could not execute under the browser/server sandbox restrictions described above.

A broader existing GroupMeet unit run passed 25 of 26 tests (including the 9 new rule tests). The existing `mapGroupMeetFinalConfirmationEmail normalizes stored metadata` test expects an object without `emailPurpose`, while the unchanged mapper already returns `emailPurpose: null`. Both that test and its implementation are unchanged from HEAD; this pre-existing mismatch was left outside this feature's scope.
