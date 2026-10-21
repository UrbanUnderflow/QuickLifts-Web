# Personalized Clay skill scenes, version 2

## Approved rolling window

Prepare only the athlete's current curriculum skill and the next skill in their
applicable published plan. There is no full-catalog warmup, six-family warmup,
manual per-scene approval, or client-controlled selection of paid generation.
The approved avatar is the identity and wardrobe source. The approved matching
artwork panel is the composition and material source. Original photos, health
records, responses, and chat content are never sent to the image provider.

Native disclosure must cover automatic personalized skill illustrations from the
approved Clay Self. Native requests preparation after approval/profile refresh
and when the current curriculum skill changes. The background worker can finish
the two-slot window after the app closes. A profile approval with no client
refresh does not itself dispatch the worker in this release.

## Contract

Authenticated `/api/pulsecheck/functions/pulsecheck-clay-scenes`, Bearer identity
and `x-pulsecheck-firebase-mode` environment selection.

- GET `?skillId=<curriculum ID>` returns `skillId`, `avatarVersion`, `status`, and
  owner-issued `imageURL` when ready. Protocol IDs map to canonical exercise IDs.
- POST `{ "action": "prepare_current_pair" }` accepts no client-selected window.
  It returns `status`, `avatarVersion`, and `skills` when a curriculum is resolved.
- Scene states: `avatar_required`, `not_started`, `processing`, `ready`, `failed`.
- Preparation can also return `curriculum_unavailable`, `artwork_unavailable`, or
  `quota_reached`. These must not cause automatic POST retry loops.
- Poll GET while visible; reopening resumes the cached status. Jobs older than
  ten minutes report failed. Failed/expired jobs are not automatically retried.
- No `prepare_all` or manual `generate` action is accepted.

## Curriculum authority and cancellation

`pulsecheck-linear-curriculum/states/items/{uid}` supplies the owner-bound opted-in
state and current published version pin. The audience must explicitly contain
that UID before its latest published version is considered for the next skill.
The next candidate is the first uncompleted skill excluding the current skill.
If that candidate lacks runtime approval, stop; do not skip ahead. An absent or
invalid linear enrollment does not fall back to guessed catalog order or legacy
assignments. The endpoint only reads curriculum and never advances progress.

The worker rereads the window before calling the provider and before retaining
the output. It discards a result that leaves the window or whose avatar changes.
Each invocation processes at most two serial jobs. An in-flight provider request
cannot be recalled if the curriculum changes after it starts; its stale result
is discarded, and it does not consume the successful-result allowance.

## Artwork and cache

`clay-skill-manifest.json` allowlists the 77 skill IDs and protocol aliases. Matching
approved crops live in `clay-skill-style/<canonicalSkillId>.png`. Missing artwork
fails closed; the six old generic family prompts are not a public fallback.
The prompt sends the approved avatar first and the scene reference second, with
explicit identity/wardrobe versus composition/material precedence.

Cache identity includes scene version, approved avatar path, and canonical skill.
Advancing reuses the former next scene and prepares only the new next scene.
Replacing the avatar invalidates old scenes; only the current window is rebuilt.
Private owner/environment-scoped storage, signed URLs, stale-output cleanup,
one active owner job, six successful results per UTC day, and the existing
exact-tester expiring override remain. Failed attempts consume no allowance.

GPT Image 1.5 high quality, high fidelity, 1536x1024 PNG. Decoder checks establish
format and dimensions, not semantic fidelity. The previous synthetic breathing
sample tested the earlier generic template and is not evidence for this new
77-reference workflow. No paid sample or deployment of this revision has occurred.

## Remaining release gates

Verify all approved crops and bundled references, inspect a controlled generated
sample using the exact reference path, and validate native current/next transitions.
Legacy users without authoritative linear enrollment receive no automatic scenes.
There is deliberately no failed-generation retry UI yet.
