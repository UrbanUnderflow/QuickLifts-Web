# Personalized Clay skill scenes, version 1

An athlete explicitly requests one scene family using their already approved
Clay Self. The UI discloses that this approved illustration is sent to the image
provider. No original photos, health data, curriculum performance, chat content,
or clinical information are sent. The generated derivative appears in skill
previews; it never changes the approved profile avatar. No second approval step
is required after this explicit creation action.

## Contract

Authenticated `/api/pulsecheck/functions/pulsecheck-clay-scenes`, existing Bearer
identity and `x-pulsecheck-firebase-mode` environment selection.

- GET `?family=breathing`: `family`, `avatarVersion`, `status`.
- POST `{ "action": "generate", "family": "breathing" }`: same shape, 202 for
  processing, 200 for cached result. Explicit action only, never on card render.
- States: `avatar_required`, `not_started`, `processing`, `ready`, `failed`.
- `ready` includes `imageURL`, owner-issued signed URL valid for 15 minutes.
- `failed` includes allowlisted `failureCode` and curated `error`.
- Poll GET every three seconds while visible; closing does not cancel generation.
  Reopen GET resumes. A job older than ten minutes reports failed.

Allowed families correspond to native categories: breathing, visualization,
focus, mindset, confidence, plus grounding. Cognitive attention drills use focus.
No client-authored prompt, pose, external source URL or arbitrary category is used.

## Storage, caching and limits

The cache key includes scene contract version, current approved avatar path and
family. Avatar replacement/deletion makes old caches inaccessible through this
endpoint. Late results are discarded if the approved avatar changed. Environments
use separate configured Firebase projects and buckets; UIDs scope every record.
Scene images use the existing protected `pulsecheck-clay-self-private` prefix,
without public download tokens. An hourly cursor-based sweep removes stale-version scene objects older than seven
days, scanning at most two pages of 50 objects per run. Current-version scenes,
source avatars and fresh files are preserved. The sweep keeps advancing its
cursor, so later objects are revisited without an unbounded invocation.

One job runs per owner across families. Six successful scene results per UTC day bound normal use. Failed jobs consume
no successful allowance. The same exact-tester UID and expiry configuration used
by Clay Self temporarily bypasses this cap for that tester only. Repeated requests during processing or after readiness
reuse the existing job/result without another provider call. Successful counts are separate from avatar creation, while the temporary tester
override is shared. There is no bulk generation,
automatic paid retry or forced regeneration operation in version 1.

Generation uses one approved avatar PNG, high input fidelity, GPT Image 1.5 high
quality, opaque 1536x1024. The fixed scene prompts describe the inspected Clay Form
mobile artboard: a seated athlete on a teal clay bench, warm cream practice space,
rich visible handmade texture and relaxed scene-specific poses. Other family
poses are explicit fixed templates. Output checks decode PNG and enforce dimensions;
they cannot prove semantic pose, clothing or likeness. Visual sample validation is
still required before claiming approved-artboard fidelity. A single controlled fictional-avatar breathing sample was requested for visual
validation; its result is reported separately from automated checks.
