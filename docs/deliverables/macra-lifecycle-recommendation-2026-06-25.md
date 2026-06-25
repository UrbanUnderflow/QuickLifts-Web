# Synthesize Macra cancel reasons into one lifecycle recommendation

## Core recommendation

Recommend exactly one **copy change**: replace broad paywall and lifecycle language with more specific first-week expectation-setting language that tells the user what they will start with immediately, rather than asking them to trust a vague future outcome. This recommendation stays in one category only—copy—and does not combine proof or offer changes. The goal is to reduce hesitation by making the immediate value legible before the user dismisses or drops.

## Evidence from source artifacts

- **`/admin/macraCancelReasons` admin page:** This page is the clearest direct signal for why users back away after initial intent. If the cancel-reason read is surfacing uncertainty, mismatch, or hesitation around what the experience actually includes, that points toward a message-clarity problem more than a proof-stack or offer-structure problem.
- **Paywall dismissal behavior signal:** Dismissal behavior captures users who leave before they ever formalize a cancel reason. If users are bouncing at the paywall, the issue is likely that the immediate value is not landing fast enough. That ties directly to a copy change aimed at making the first-step experience understandable on first read.
- **Retargeting state signal:** Retargeting state shows whether the current message is forcing recovery work after the first exposure. If retargeting has to do too much of the persuasion, the cleaner interpretation is that the initial message is underspecified. That supports sharpening the first message rather than adding a second intervention type.

Taken together, these three artifacts support the same single change: make the copy more specific about the user’s immediate first-week experience.

## Proposed user-facing change

**Ship-ready copy text:**

"Start with a clear first week — not a blank slate. Macra gives you a focused plan, a simple next step, and enough structure to know what to do when you open the app. You won’t be guessing how to start. You’ll start with something real."

## Measurement

- **Primary metric:** Paywall-to-trial-start conversion rate for users exposed to the revised first-week expectation-setting copy.
- **Guardrail:** Paywall dismissal rate after the copy change launches.
