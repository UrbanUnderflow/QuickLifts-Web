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

## Copy snippets for brands

### Brand partner update — wait for the refreshed read

"Before we move any partner-facing funnel message forward, we need the active `variant_a` result refreshed against the current Scoreboard and Experiments records. From there, we use purchase behavior and source-quality context to understand what the funnel is actually supporting right now. If that refreshed read is not in hand, the message should wait."

### Brand partner update — if refreshed variant_a is holding

"We refreshed active `variant_a` before reviewing this partner message, and the current read still supports the existing funnel story. The recommendation is to keep the message specific: what someone is starting, why the opening experience is landing, and what the present funnel is proving without stretching beyond the current Scoreboard, experiment state, and purchase behavior."

### Brand partner update — if refreshed variant_a softens

"We refreshed active `variant_a` before making this recommendation, and the updated read suggests the current partner-facing story needs to tighten. Before changing the message, we are checking cancel reasons, user state, retargeting state, purchase logs, and AppsFlyer imports to separate a true message problem from a source-quality problem. The next move should be one measured adjustment tied to what the refreshed inputs still show as believable and conversion-safe."

## Copy snippets for gyms

### Gym partner update — if refreshed variant_a is holding

"We refreshed active `variant_a` before changing any gym-facing funnel message, and the current read still supports the existing trial-start path. The next-step message should stay concrete: what a new member starts with, what support they get in the first stretch, and why the opening experience feels doable instead of vague. If the refreshed result is holding, the job is not to add hype. It is to make the first yes easier."

### Gym partner update — if refreshed variant_a softens

"We refreshed active `variant_a` before making this gym recommendation, and the updated read suggests the current funnel message is losing trust too early. Before rewriting the story, we are checking purchase logs, cancel reasons, user state, and retargeting state to confirm whether the problem is the promise, the follow-up, or the handoff after signup. The next move is one clearer message about the first-step value, not a broader claim about the whole gym experience."

## Copy snippets for run clubs

### Run club update — if refreshed variant_a is holding

"We refreshed active `variant_a` before recommending any run-club funnel change, and the strongest signal is still the clearest one: tell runners exactly what they are joining, what the first block looks like, and what kind of support they get at the start. If the refreshed read is holding, the message should stay rooted in the real first-week experience rather than drifting into generic motivation."

### Run club update — if refreshed variant_a softens

"We refreshed active `variant_a` before changing this run-club message, and the updated performance suggests the current framing may be too broad for the runners entering right now. Before changing the funnel story, we are checking purchase logs, cancel reasons, retargeting state, and AppsFlyer imports to separate a message-fit problem from a source-quality problem. The next-step message should narrow the promise, make the opening run block more specific, and earn the next test from the refreshed readout."
