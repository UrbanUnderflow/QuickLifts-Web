# Sage Deliverables

This directory contains **actual research output** produced by Sage — the Research Intelligence Envoy.

Every file here is a completed deliverable from a Sage research task. When Sage finishes a task, the output is written here, committed, and pushed to GitHub so it's immediately available on the Sage Deliverables dashboard and via Netlify.

## Directory Structure

```
deliverables/
├── manifest.json          # Index of all deliverables (auto-updated)
├── README.md              # This file
├── peptide-research-brief.md
├── peptide-whitepaper-outline.md
└── ...future research output
```

## How Deliverables Get Here

1. Sage completes a research task via OpenClaw
2. The output is saved to this directory
3. `manifest.json` is updated with metadata (title, date, tags, summary)
4. Changes are committed and pushed to GitHub
5. The deliverables appear on `/admin/sage-deliverables` automatically

## Linking to Heartbeat Timeline

Each deliverable in `manifest.json` includes a timestamp, which the heartbeat timeline can reference to show when research was completed.
