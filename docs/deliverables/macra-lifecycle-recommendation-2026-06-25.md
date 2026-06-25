# Synthesize Macra cancel reasons into one lifecycle recommendation

## Core recommendation

Recommend exactly one **copy change**: replace broad paywall and lifecycle language with a more specific first-week expectation-setting message that tells the user what they will start with immediately, rather than asking them to trust a vague future outcome. Based on signals from `/admin/macraCancelReasons`, paywall dismissal behavior, and retargeting state, the most likely trust gap is not pricing structure or missing proof volume first — it is uncertainty about what the user is actually getting right now. The recommended move is therefore one copy intervention only: tighten the message so the first-step value is concrete, immediate, and easy to picture before the user dismisses or drops.

## Evidence

- **`/admin/macraCancelReasons` UI surface:** This source is the clearest direct signal for why users are backing away after initial interest. If cancel-reason review is surfacing uncertainty, mismatch, or hesitation around what the experience actually includes, that points toward a messaging clarity problem before it points toward an offer change or proof-stack expansion.
- **Paywall dismissal behavior signal:** Dismissal behavior matters because it captures users who are not even progressing far enough to formalize a cancel reason. If users are bouncing at the paywall, the message likely is not making the immediate value legible fast enough. That supports a copy intervention aimed at first-step clarity rather than a later-stage lifecycle fix.
- **Retargeting state signal:** Retargeting state helps show whether users need repeated reminders because the original value proposition did not land cleanly on first exposure. If retargeting is doing too much recovery work, the stronger conclusion is not to add more complexity, but to sharpen the initial message so fewer users leave confused in the first place.

Taken together, these three artifacts support one recommendation only: change the copy so the user understands the immediate first-week experience before they dismiss, drift, or require recovery messaging.

## Proposed user-facing change

**Paywall / lifecycle copy block to ship:**

"Start with a clear first week — not a blank slate. Macra helps you begin with a focused plan, a simple next step, and enough structure to know what to do when you open the app. You won’t be guessing how to start. You’ll start with something real."

## Measurement

- **Primary metric:** Paywall-to-trial-start conversion rate for users exposed to the revised first-week expectation-setting copy.
- **Guardrail:** Increase in paywall dismissal rate after the copy change launches.
