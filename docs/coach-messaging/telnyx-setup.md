# Telnyx coach messaging setup

The unified Messages UI uses the existing durable queue and opt-out store. Telnyx is selected explicitly; an unset provider continues to mean Twilio. No account activation, phone purchase, key creation, production flags, or real sends are performed by deploying this code.

## Production configuration

Set these in Netlify **production Functions/runtime scope**, never client-public variables or committed files:

- `COACH_COMMUNICATIONS_SMS_PROVIDER=telnyx`
- `TELNYX_API_KEY`: existing approved server-side key, supplied through secure configuration.
- `TELNYX_PUBLIC_KEY`: account Ed25519 public key (base64, 32 bytes), from Keys & Credentials.
- `TELNYX_MESSAGING_PROFILE_ID`: the verified messaging profile UUID.
- `TELNYX_FROM_NUMBER`: approved, registered SMS-capable E.164 sender.
- `COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL=https://fitwithpulse.ai/api/coach/communications/telnyx-webhook`
- `COACH_COMMUNICATIONS_FIREBASE_MODE=prod`
- `COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED=true`
- `COACH_COMMUNICATIONS_SMS_ENABLED=true`
- `COACH_COMMUNICATIONS_WORKER_ENABLED=true`

Keep the last two flags false/absent until activation is approved and all prerequisites below are verified. Webhook processing must remain enabled while outbound sending is paused so STOP continues to suppress recipients. Do not overwrite Twilio credentials used by other services.

### Compact configuration for Lambda environment limits

Legacy Lambda functions have a 4 KB aggregate environment limit. The non-secret
settings above can instead be stored as one minified `COACH_SMS_CONFIG` JSON value.
Keep `TELNYX_API_KEY` as its existing separate server-side secret. Explicit legacy
variables take precedence, including empty strings or `false`, so remove the
replaced legacy variables only when deploying code that supports compact settings.

| JSON field | Equivalent variable |
| --- | --- |
| `p` | `COACH_COMMUNICATIONS_SMS_PROVIDER` |
| `m` | `COACH_COMMUNICATIONS_FIREBASE_MODE` |
| `s` | `COACH_COMMUNICATIONS_SMS_ENABLED` |
| `w` | `COACH_COMMUNICATIONS_WORKER_ENABLED` |
| `h` | `COACH_COMMUNICATIONS_SMS_WEBHOOK_ENABLED` |
| `u` | `COACH_COMMUNICATIONS_TELNYX_WEBHOOK_URL` |
| `n` | `TELNYX_FROM_NUMBER` |
| `id` | `TELNYX_MESSAGING_PROFILE_ID` |
| `k` | `TELNYX_PUBLIC_KEY` |

`s`, `w`, and `h` accept JSON booleans only; other fields accept strings. Omitted
or malformed gates stay disabled. A paused configuration omits `s` and `w` and
keeps `h: true`. Do not include the API key in this JSON or in source control.
Netlify captures function environment values at deploy time; existing published
functions keep their previous values until a successful new deployment. For
rollback, restore the legacy variable set before rebuilding an older revision.

The verified AthleticMind sender/profile/public verification key/webhook URL also
have a named server-side profile in `account-profile.ts`. Select it with
`{"p":"telnyx","m":"prod","h":true,"account":"athleticmind"}` to keep inbound
processing available with outbound sending paused. This 75-byte key/value pair
replaces 454 bytes of individual settings, saving 379 bytes. Explicit compact
fields override the named profile, and legacy variables override both. A profile
selection alone never supplies provider, database environment, or activation gates.
An unknown profile name supplies no account defaults. Verify any public-key change
against Telnyx before revising the profile; API credentials remain in Netlify.

## Telnyx portal

1. Complete account verification and billing through the owner's authorized flow. Obtain explicit approval for purchases, credential creation, and agreements as applicable.
2. Use the existing **AthleticMind Coach Messages** profile, `4001a1ad-6b2f-48b5-a63c-217fa1ae9d74`, API V2, United States destination. Verify these details in the portal; do not duplicate the profile.
3. Obtain an SMS-capable sender and complete the registration/verification required for that sender. Attach it to this profile.
4. Deploy and verify the new route before setting any portal webhook. Then set the profile's standard inbound webhook to the production Telnyx endpoint above. Do not point it at a public inspection service. Outbound API calls provide the same endpoint with a per-job query parameter for delivery callbacks.
5. Preserve Telnyx STOP/HELP keyword handling. The application records inbound STOP in the existing shared phone suppression store. START records intent but does not automatically clear a prior opt-out or send anything.

## Activation checks

- Verify account status, sender ownership, messaging capability, registration state and profile association.
- Confirm the deployed endpoint rejects missing/invalid signatures without database effects; use only synthetic local tests until a real message is separately authorized.
- Inspect pending queue jobs before switching providers. New jobs persist their provider; old jobs default to Twilio. A job from a different provider is blocked, never silently sent through the replacement provider.
- Enable sending/worker only after configuration is complete and explicitly approved. This causes scheduled processing of queued messages, so inspect for queued work first.
- A successful API response means provider acceptance, not handset delivery. Only authenticated delivery callbacks produce delivered status. Lost responses, 408/409, malformed success and 5xx remain unknown and are not automatically resent.
- Physical delivery and inbound-reply testing require separate permission to send actual texts. Local mocked tests do not establish carrier delivery.

## Implementation and validation

`provider.ts` verifies raw-body Ed25519 signatures with a five-minute freshness window, exact messaging profile, E.164 addresses and a single SMS recipient. Outbound callbacks must carry the exact signed webhook URL for their durable job; the queue additionally checks sender, recipient hash, provider and provider message ID. Provider message IDs use `telnyx_` namespacing. Existing transaction/idempotency, authorization, opt-out and closed-account rules remain in effect.

Run offline tests:

```sh
node --import tsx --test tests/unit/coach-communications-telnyx.test.ts tests/unit/coach-communications.test.ts tests/unit/coach-communications-external-consent.test.ts tests/unit/coach-messages-unified.test.ts
npm run typecheck
```

References: [Telnyx send API](https://developers.telnyx.com/api-reference/messages/send-a-message), [raw webhook verification](https://developers.telnyx.com/docs/development/api-fundamentals/webhooks/receiving-webhooks), [messaging callbacks](https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks).
