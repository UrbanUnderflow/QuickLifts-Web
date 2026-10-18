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
empty output and visible content within 2 percent of any canvas edge. The prompt
requests 8 percent margins. This catches canvas-edge clipping and opaque
backgrounds, but cannot identify a missing foot inside otherwise padded output,
judge likeness, or prove clay-style conformity. User approval remains required.
The worker fails a rejected job and deletes source photos using existing cleanup.
There is no automatic paid retry. Existing per-user generation limits apply.

Release evaluation should inspect a synthetic full-body example for identity,
matte tool-marked texture across face and clothes, natural proportions, complete
hair/hands/shoes, transparent margins and reference-style fit. A successful
sample is evidence of the configuration, not a guarantee for every likeness.
Do not use private athlete photos for a benchmark without explicit authorization.
