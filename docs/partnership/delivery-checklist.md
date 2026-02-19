# Delivery Checklist — Shared Proof Rule

1. **Upload or Link**
   - Every deliverable must include a repo path / shared link in the handoff message.

2. **Peer Verify (Pre-Standup)**
   - Before reporting “done,” confirm at least one teammate can open the file/link (repo path, SharePoint, etc.).
   - Preferred: teammate replies “✅ opened” in thread or mirror message AND log it in the telemetry/standup note; no verification = not reported. If verification fails, escalate immediately (don’t wait for standup).

3. **Standup Note**
   - If files aren’t accessible, log it explicitly (“Lead tile yellow — no repo data as of HH:MM”).
   - Escalate to Tremaine/infra if the link can’t be opened within 1 hour.

4. **Version Snapshot**
   - Include `ls -la` or `git status` snippet (and confirm push succeeded) when relevant so everyone sees timestamps/paths.

_This rule applies to Hampton, Oura, fencing, and all future partner drops—no link + peer verification = not shipped._
