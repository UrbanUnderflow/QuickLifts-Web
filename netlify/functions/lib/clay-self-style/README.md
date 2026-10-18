# Clay Self style bundle

`SCHEMATICS-v1.md` is loaded into the image-edit prompt at runtime. Both PNG files
are appended after the three identity photos, in basketball/athlete order.
These are approved illustration references copied from PulseCheck assets
`ClayIntroBasketball` and `ClayDemoAthlete`. They establish material and sculptural
treatment only. They are examples, not user uploads. Netlify's existing
`included_files = ["netlify/functions/**"]` packages this directory.

The generator uses GPT Image 1.5, high quality, portrait 1024x1536, high input
fidelity, transparent PNG. Changes to model or reference artwork require another
visual evaluation; model selection is deliberately not accepted from a client.
The private job records the style version and generation settings. New settings
apply to new jobs only. Existing approved portraits are preserved.

Output validation decodes the PNG, checks portrait dimensions and alpha, rejects
empty output and any nontransparent content touching a canvas edge. Fully
contained output with tight margins is resized as a whole onto a transparent
portrait canvas to provide at least 8 percent margins. No anatomy is reconstructed. This catches canvas-edge clipping and opaque
backgrounds, but cannot identify a missing foot inside otherwise padded output,
judge likeness, or prove clay-style conformity. User approval remains required.
The worker fails a rejected job and deletes source photos using existing cleanup.
There is no automatic paid retry. Existing per-user generation limits apply.

Release evaluation should inspect a synthetic full-body example for identity,
matte tool-marked texture across face and clothes, natural proportions, complete
hair/hands/shoes, transparent margins and reference-style fit. A successful
sample is evidence of the configuration, not a guarantee for every likeness.
Do not use private athlete photos for a benchmark without explicit authorization.

Failed jobs record only allowlisted failure code/phase and numeric timing. Server
logs contain those same sanitized fields, without user IDs, URLs, input content
or raw provider messages. Expired GET responses use job_expired without mutating
the job during a read. Earlier failures cannot be diagnosed retrospectively.

## Successful-result allowance and temporary testing

Quota version 2 counts successful ready results, incremented only inside the
same transaction that changes processing to ready. Duplicate worker deliveries,
failed jobs, rejected output and cancelled late results consume no successful
allowance. One active job per account remains enforced. Counts reset by UTC day
of completion. Legacy attempt counts cannot prove successful creations: migration
carries only the currently known ready/approved result completed on that day.

The default limit remains three successful results per UTC day. The server-only
`CLAY_SELF_TESTER_UIDS` comma-separated exact UID allowlist can temporarily bypass
that limit, and only while `CLAY_SELF_TESTING_UNTIL` is a valid future timestamp.
Both are required; missing/expired configuration restores the limit automatically.
Other accounts keep the default limit. Remove the tester configuration when
validation finishes. Never print or place actual tester UIDs in documentation.
The override does not bypass concurrent-job protection or ownership checks.
