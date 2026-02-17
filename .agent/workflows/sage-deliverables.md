---
description: How Sage should save, commit, and push research deliverables after completing a task
---

# Sage Deliverables Workflow

After Sage completes any research or analysis task, the output must be saved to the project repo so it's accessible on the Sage Deliverables dashboard and deployed via Netlify.

## Steps

### 1. Write the deliverable file
Save the research output as a markdown (or JSON) file in:
```
docs/sage/deliverables/<slug>.md
```
Use a descriptive kebab-case filename, e.g. `peptide-research-brief.md`.

### 2. Update the manifest
Add a new entry to `docs/sage/deliverables/manifest.json`:
```json
{
  "id": "<slug>",
  "title": "Human-readable title",
  "filename": "<slug>.md",
  "category": "research-output",
  "description": "One-liner describing the deliverable",
  "tags": ["tag1", "tag2"],
  "emoji": "🧬",
  "completedAt": "ISO-8601 timestamp",
  "taskRef": "Which task produced this (e.g. Sage Task #4)",
  "status": "complete"
}
```
Also update the `lastUpdated` timestamp at the top of the manifest.

### 3. Commit and push
```bash
cd /path/to/QuickLifts-Web
git add docs/sage/deliverables/
git commit -m "📡 Sage deliverable: <title>"
git push origin main
```

### 4. Heartbeat integration (optional)
If the intel-feed Firestore collection is available, also post a heartbeat entry:
```bash
curl -X POST https://your-site.netlify.app/api/agent/intelFeed \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "sage",
    "type": "deliverable",
    "title": "<title>",
    "summary": "<one-liner>",
    "filePath": "docs/sage/deliverables/<slug>.md",
    "tags": ["tag1", "tag2"]
  }'
```

## Recovery: Files on Mac Mini

If deliverables were written to the Mac Mini (`/Users/noraclawdbot/...`), they need to be copied to this repo:

```bash
# From the Mac Mini, copy to this project:
scp /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/docs/PeptideResearchBrief.md \
    tremainegrant@<your-mac>:~/Documents/GitHub/QuickLifts-Web/docs/sage/deliverables/peptide-research-brief.md
```

Or SSH into the Mac Mini, cat the file, and paste it locally.
