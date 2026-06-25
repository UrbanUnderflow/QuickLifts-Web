# Refresh active variant_a experiment results before making funnel partner messaging

## Core narrative

Funnel-partner messaging decisions must wait for a refreshed read of the active `variant_a` experiment against the current Scoreboard and Experiments records. We should not move partner-facing funnel copy, campaign framing, or trial-start messaging forward from stale assumptions, older summaries, or prior decisions that have not been checked against the live operating view. The active `variant_a` read has to be refreshed first, then the message can be judged against what the current Scoreboard and Experiments records actually support.

## Messaging pillars

### 1. Scoreboard sets the outer boundary

The Scoreboard is the first constraint on what we are allowed to say. If the refreshed active `variant_a` read is still holding, partner messaging can reinforce the current funnel story. If it is softening, we do not compensate with bigger claims. We keep the message inside what the current Scoreboard can honestly support.

### 2. Purchase logs, cancel reasons, user state, and retargeting state explain the trust gap

Purchase logs show whether the funnel is actually converting, while cancel reasons, user state, and retargeting state help explain where people are hesitating or falling away. Together, those artifacts tell us whether the message is clear, whether the promise is landing too early, or whether follow-up is mismatched to the user’s current state. Messaging should answer the friction those inputs are showing, not a guessed version of it.

### 3. AppsFlyer imports tell us what can scale safely

AppsFlyer imports help separate a real messaging win from a source-quality illusion. If refreshed active `variant_a` performance looks strong only for a narrow slice of traffic, we should not stretch that into a broad partner claim. Using AppsFlyer imports alongside the live experiment read keeps the funnel story precise and shows which message can scale safely versus which one only works under a thinner acquisition mix.
