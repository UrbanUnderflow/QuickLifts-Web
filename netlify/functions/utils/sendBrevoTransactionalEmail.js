// ---------------------------------------------------------------------------
// Compatibility shim — DO NOT add logic here.
//
// The canonical Brevo transactional-send implementation lives in
// `emailSequenceHelpers.ts` (the TS helper used by 40+ functions). This file
// used to carry a SECOND, hand-maintained copy of the same send + idempotency
// stack, which had already drifted (e.g. it lacked attachment support). Both
// copies wrote to the identical Firestore collections and used the same shared
// `emailSafety` dedupe primitives, so collapsing to one source of truth is
// state-compatible — no dedupe/quota behavior change.
//
// The 7 `.js` functions that `require('./utils/sendBrevoTransactionalEmail')`
// keep working unchanged; they transparently get the canonical implementation.
// Netlify's esbuild bundler resolves the `.ts` import at build time.
// ---------------------------------------------------------------------------
const { sendBrevoTransactionalEmail, buildEmailDedupeKey } = require('./emailSequenceHelpers');

module.exports = { sendBrevoTransactionalEmail, buildEmailDedupeKey };
