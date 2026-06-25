# Publish a daily Macra KPI snapshot from Scoreboard, Experiments, purchase logs, cancel reasons, retargeting, and AppsFlyer coverage

## Core narrative

The daily Macra KPI snapshot is built from the existing `Scoreboard`, `Experiments`, purchase logs, cancel reasons, retargeting state, and AppsFlyer coverage before any funnel or partner messaging is sent. That means the operating picture is assembled from those live source artifacts first, and only then translated into any external summary, funnel interpretation, or partner-facing update. If that daily snapshot has not been built from those inputs, the messaging should wait.

## Messaging pillars

### 1. `Scoreboard` and `Experiments` define the daily frame

The first job of the daily KPI snapshot is to read `Scoreboard` and `Experiments` together so the top-line story reflects the current operating state instead of yesterday’s interpretation. Those two artifacts tell us whether the day is holding, improving, or softening before any partner-facing summary is written. If `Scoreboard` and `Experiments` are mixed, the message has to stay mixed too.

### 2. Purchase logs, cancel reasons, and retargeting state explain the trust picture

Purchase logs show where real conversion is happening, while cancel reasons and retargeting state show where trust is breaking down after interest is created. Those three artifacts keep the daily snapshot from becoming a shallow status update. They explain whether movement is tied to buying behavior, downstream hesitation, or follow-up that is arriving too late or too vaguely.

### 3. AppsFlyer coverage keeps source context attached to the read

AppsFlyer coverage makes sure the daily KPI snapshot stays honest about attribution visibility and traffic mix. A strong-looking day should not automatically become a broad messaging claim if the underlying source picture is partial or skewed. Keeping AppsFlyer coverage in the snapshot protects the interpretation from outrunning what the current operating artifacts can actually support.
