// ──────────────────────────────────────────────────────────────────────────────
// Pulse Sports Intelligence — Full Spec Bundle (plain markdown)
//
// One concatenated markdown bundle of the seven Sports Intelligence spec tabs,
// produced for hand-off into a separate reviewer agent (or stakeholder review)
// without forcing the reader to navigate between System Overview tabs.
//
// Mirrors the rendered content of:
//   1. Sports Intelligence Layer (Architecture & Product Boundaries)
//   2. Aggregation + Inference Contract
//   3. Report Outlines + Coach Mocks
//   4. Contextual Detection Engine
//   5. Nora Context Capture
//   6. Session Detection + Matching
//   7. Sport Load Model
//
// IMPORTANT: this bundle is hand-curated to match the spec tabs. When a spec
// changes materially, update here too. Drift is acceptable for occasional
// reviewer hand-off but not desirable long-term.
// ──────────────────────────────────────────────────────────────────────────────

const HEADER = `# Pulse Sports Intelligence — Full Spec Bundle

> Hand-off bundle of the seven Sports Intelligence specs from the Pulse System Overview, concatenated as one document for reviewer or stakeholder consumption. Source of truth remains the System Overview admin tabs; this is a snapshot.

> **Translation rule (load-bearing):** every coach-visible string in this stack — reports, reviewer-screen messages, missing-context nudges, error states, even spec examples — must read in coach voice, not science-speak. "Confidence is emerging" → "this read will get sharper once you add the practice details." "Schedule context missing" → "drop the practice plan and we'll lock in the read." Internal vocabulary ("ACWR", "load_au", "high_confidence") never surfaces to coaches.

> **Slice 1 operating posture:** Pulse team manually curates inference + adherence; reports flow through reviewer screen; no auto-delivery during pilot.

> **v0.3 reasoning-layer rule:** Sports Intelligence follows the Nutrition Layer pattern: code builds the fact ledger, candidate reads, scoring, guardrails, executable Nora rubric results, and validated payload trace before Nora or coach-report copy is allowed to phrase anything.

> **Plain-language report rule:** Coach-facing copy must not speak in code. Every point must say when the moment shows up, what the athlete may feel or do, and the one simple mental-performance phrase or routine the coach should give. Do not add vague handoff lines that assign warm-up, lineup, tactical, training, or recovery decisions to unnamed staff unless a real named role and decision are present in the source data. Example: "When the game gets late in the shot clock and the guards are tired or mentally cluttered, don't give them a bunch of coaching points. Give them one simple mental reset phrase they can use in that moment."

> **Operating thesis:** "What is the athlete's physical state teaching us about their mental performance environment?" Athlete reads create mindset change. Coach reads distinguish individual, unit, and team-wide patterns while preserving the coach's authority over physical programming.

---
`;

const SPEC_1_LAYER = `
## 1. Sports Intelligence Layer — Architecture & Product Boundaries

The device-agnostic, sport-aware interpretation system that translates raw biometrics, simulation evidence, daily check-ins, training, nutrition, and schedule context into mental-performance intelligence. Sits above the normalized health-context surface and below every consumer surface (coach reports, Macra, Nora, AuntEDNA escalation).

**Operating thesis:** What is the athlete's physical state teaching us about their mental performance environment?

Version 0.3 adds the reasoning-layer middle: \`Sports Fact Ledger -> Candidate Read Engine -> Scoring + Guardrails -> Nora/Coach Copy Layer -> Validated Intelligence Payload\`. The product failure this prevents is data-flavored confidence: unsupported physiology, invented session context, stale-data overconfidence, and vague actions. The product boundary it enforces: Nora uses physical signals to coach the mental layer, not to prescribe the physical workout.

**Slice 1 operating posture:** Pulse team manually curates inference + adherence; reports flow through reviewer screen; no auto-delivery during pilot. Reviewer screen: \`/admin/sportsIntelligenceReports\`. Code-owned reportPolicy/loadModel changes are backfilled with \`npx tsx scripts/seed-pulsecheck-sports.ts\` in diff mode first, then \`--apply\` after review.

### Highlights
- **Device-Agnostic Surface** — No single device is the contract. Apple Watch / HealthKit and Oura are the active sources today; Polar, Whoop, and Garmin are planned future devices. Sports Intelligence reads from the normalized health-context surface; every adapter, plus self-report, flows through the same record shape.
- **Mind-Body Performance Environment** — Same biometric reading can mean compounding momentum, a focus-support day, a composure opportunity, or recovery debt. The read connects physical state to focus, composure, decisioning, confidence, and habits.
- **Coach Context Without Overreach** — Coach reports distinguish individual, unit, and team-wide patterns, show supporting data, and spell out the exact coaching moment in plain English. They do not prescribe reps, sets, minutes, contact dose, throwing volume, jump volume, or workout changes.

### System Architecture (4 Layers)
| Layer | What Lives Here | Constraint |
|---|---|---|
| Inputs | Device-agnostic biometric surface, PulseCheck sims, daily Nora check-ins, FWP workouts, Macra nutrition, sport-config policy. | Sources are heterogeneous. The layer treats them as inputs to a single interpretation pipeline; no consumer reads any source directly. |
| Normalization | Adapters convert each source into the canonical record shape (Athlete Context Snapshot, Correlation Evidence Record, sport-config attribute values). | Renaming or fork-defining record types is forbidden. |
| Reasoning layer | Sports Fact Ledger → Candidate Read Engine → Scoring + Guardrails → Nora/Coach Copy Layer → Validated Intelligence Payload. | AI may phrase the read; code decides eligibility, support, usefulness, and rubric safety. The core question is how physical state shapes focus, composure, decisioning, confidence, and habit formation. |
| Output surfaces | Weekly Sports Intelligence Report, Game-Day Readiness Report, Early-Warning Alerts, Macra nutrition context, Nora coaching context, AuntEDNA escalation context. | Each surface has its own audience, latency, and copy posture. Coaches get pattern intelligence and supporting data; coaches keep authority over physical programming decisions. |

### Mind-Body Performance Framework
**Athlete job:** teach the athlete how physical state, sleep, nutrition timing, recovery habits, self-talk, and mental reps compound into focus, composure, confidence, decision-making, and long-game maturity. Lower-readiness days become training opportunities, not deficit labels.

**Coach job:** show coaches which patterns are individual, unit-level, or team-wide, with enough supporting data to inform their own judgment. Sports Intelligence offers plain-language coach messages and pattern context; it does not prescribe the physical program.

| Athlete Insight Type | When It Fires | What It Should Teach |
|---|---|---|
| Compounding Momentum | Sleep, recovery, routine, nutrition, and mental training are lining up | Praise the pattern and teach that the small things are becoming the big edge |
| Composure Opportunity | Recovery is lower, but not a clinical or safety state | Frame the day as a useful chance to practice staying steady when conditions are not perfect |
| Focus Support Day | Sleep timing, recovery, or load suggests attention may take more effort | Say when focus may get harder, what the athlete may feel, and the one simple phrase or routine to use before the first demanding task |
| Recovery Debt Pattern | Under-recovery repeats across several days | Teach that the system needs support; protect bedtime, fueling rhythm, or recovery routine without shame language |
| Mismatch Insight | Mental training is improving while physical habits are not supporting it, or vice versa | Show the athlete how body-state habits make mental reps stick deeper |
| Steady Builder Day | No dramatic signal | Use average days to build identity: complete the mental rep and keep the routine clean |

| Coach Pattern | What It Means | How The Report Should Help |
|---|---|---|
| Individual pattern | One athlete is under-recovered or carrying higher load while the team is steady | Name the athlete, show supporting evidence, and spell out the coaching moment in full sentences: when it may happen, what the athlete may feel or do, and what simple language the coach should use |
| Team-wide pattern | A meaningful share of the roster shows lower recovery, sleep disruption, sentiment drop, or cognitive drift | Surface it as a possible environment or schedule pattern for coach review, not as an automatic training correction |
| Unit / role pattern | A position group, event group, lineup role, or travel group shows a shared state pattern | Help the coach see whether the issue clusters by role, minutes, travel, class schedule, or competition density |
| Compounding strength | The team or athlete is stacking sleep, mental reps, check-ins, and stable physiology | Make the good pattern visible so coaches can reinforce the identity and habits that are working |
| Data coverage pattern | Wear rate, Nora completion, or training/nutrition context is thin | Explain what is missing before interpretation so coaches know whether the signal is trustworthy |

### Sports Intelligence Reasoning Layer v0.3
| Step | Layer | Responsibility |
|---|---|---|
| 1 | Sports Fact Ledger | Source of truth for athlete context, time context, source freshness, recovery/load/session/cognitive/check-in/nutrition facts, missing inputs, allowed claims, blocked claims, and evidence refs. |
| 2 | Candidate Read Engine | Deterministic code generates eligible reads: readiness_status, recovery_limiter, load_spike, intent_mismatch, game_day_prep, fueling_context, session_confirmation_needed, data_quality, no_intervention. |
| 3 | Scoring + Guardrails | Rank by confidence, sport relevance, timing, actionability, materiality, novelty, freshness, and rubric readiness. Block unsupported sessions, unsupported physiology, stale-data overconfidence, and clinical boundary violations. |
| 4 | Nora / Coach Copy Layer | Receives approved facts + selected candidate only. May translate tone, never invent facts, causes, sessions, or actions. |
| 5 | Validated Intelligence Payload | Persists ledger, candidates, selected read, rejected reads, rubric results, guardrail trace, evidence refs, final copy, and review status. |

### Device-Agnostic Biometric Surface
- Pulse runs multiple device integrations (Apple Watch / HealthKit and Oura active today; Polar, Whoop, and Garmin planned). Sports Intelligence cannot couple to any one device.
- All vendor data lands in the Health Context Source Record before any aggregator reads it. Adapters are the only code that touches vendor SDKs.
- Renaming or specializing field names per vendor is forbidden. HRV is \`rmssdMs\` whether it came from Polar, Oura, or Apple Health.

**Source lanes:** Apple Watch / HealthKit (active), Oura (active; direct OAuth preferred, HealthKit fallback), Polar / Whoop / Garmin (planned future devices), self-reported via Nora (active when no wearable connected), coach-entered.

**Normalized fields by domain:** sleep (totalSleepMin, deepSleepMin, remSleepMin, sleepEfficiency, sleepConsistencyScore, latency); HRV (rmssdMs, hrvBaselineDeltaPct, hrvTrend7d, restingHr, restingHrTrend7d); recovery (recoveryScore 0-100, readinessScore 0-100, recoveryTrend7d, sourceConfidence); training load (externalLoadAU, internalLoadRpeAU, acwr, microcycleLoadDelta, sessionRpe); workout sessions (sessionId, sport, modality, durationMin, intensity, sessionRpe, completedAt); competition / travel context; cognitive performance; sentiment / mental state.

### Sport Configuration Registry
Stored at Firestore \`company-config/pulsecheck-sports\` as an array of \`PulseCheckSportConfigurationEntry\`. Each sport: id, display name, emoji, positions[], attributes[], metrics[], prompting{}, reportPolicy{}.
- \`attributes[]\` capture sport-specific athlete dimensions; \`includeInNoraContext\` and \`includeInMacraContext\` flags control which products inject which attribute.
- \`metrics[]\` define sport-native KPIs in their actual units. Coach reports surface these directly.
- \`prompting.noraContext\` and \`prompting.macraNutritionContext\` are injected verbatim into Nora and Macra prompts.
- \`reportPolicy{}\` (this page) defines the report-generation primitives for the sport, including the planned \`reportPolicy.loadModel\`.
- Edit split: sport list, \`attributes[]\`, \`metrics[]\`, and \`prompting{}\` are edited via the Sports Intelligence Layer admin page (\`/admin/pulsecheckSportConfiguration\`) — adding a new sport is an admin operation, not an engineering deploy. \`reportPolicy\` and \`reportPolicy.loadModel\` are review-only on that page and edited in code so coach-facing intelligence can never be misconfigured through the UI.

### Athlete Sport Profile (per-user)
| Field | Source | Notes |
|---|---|---|
| athleteSport | Sport id from \`company-config/pulsecheck-sports\` | Mirrored to root \`users/{uid}.athleteSport\` for cross-product reads. |
| athleteSportName | Display name from sport config | Cached on root user doc. |
| athleteSportPosition | Position string from sport config | Optional. |
| Sport-specific attributes | Per-sport attributes captured via PulseCheck onboarding | \`includeInMacraContext\` / \`includeInNoraContext\` flags. |
| Sport-specific metrics | Per-sport metrics | Coach-facing reports surface these in sport-native units. |
| Sport prompting policy | \`noraContext\`, \`macraNutritionContext\`, \`riskFlags\`, \`restrictedAdvice\`, \`recommendedLanguage\` | Injected verbatim. |

### Output Surfaces
| Surface | Audience | Cadence | Contents |
|---|---|---|---|
| Weekly Sports Intelligence Report | Coach | Sundays before the week starts | Team load trend, aggregate sentiment, cognitive movement, individual vs team-wide recovery patterns, athlete watchlist, plain-language coach messages, and reviewer-visible validated payload trace. |
| Game-Day Readiness Report | Coach | Morning of competition | Athlete-by-athlete mind-body state with selected candidate, source freshness, optional travel context, and reviewed pre-competition protocols. |
| Early-Warning Alert | Coach | Real-time after review gate | Candidate alerts only until reviewed: individual under-recovery, team-wide under-recovery, sudden sentiment shift, cognitive decline. Clinical-threshold signals route through escalation, not here. |
| Macra Daily Insight Context | Athlete (via Nora) | Cloud-scheduled, ~7pm local | Sport context block injected into the Macra daily-insight cloud function. |
| Nora Coaching Context | Athlete (via Nora) | Every chat or check-in turn | Sport \`noraContext\` + risk flags + selected validated sports read. Athlete-facing copy must pass the executable Nora rubric. |
| AuntEDNA Escalation Context | Clinician | On clinical handoff only | Recent readiness trends, sentiment patterns, simulation performance — minimum-necessary set. |

### Coach Dashboard — Thin Surface, Reports Are The Truth
The dashboard is the access surface for reports, not a replacement for them. Coaches need one place to land — see the latest weekly, open the game-day read, scan watchlist names, glance at adherence — without digging.

| Block | Purpose | Depth Constraint |
|---|---|---|
| Latest Weekly Report Card | One-click into this week's report | Top line + read confidence + review status only. Full report opens in a dedicated reader. |
| Game-Day Readiness Tile | Upcoming competition tap-through | Athlete-by-athlete readiness band + confidence; no raw biometric scores. |
| Athlete Watchlist Strip | Named athletes from latest reviewed report | Names + one-line "why this matters". No leaderboards. |
| Adherence + Coverage Strip | Wear rate, daily check-ins, protocol/sim, training/RPE coverage | Lives at the top so coaches see participation state before any interpretation. |
| Supporting Sport-Native KPIs | Small KPI strip from sport config | Filtered through \`kpiRefs\` — no invented metrics. |
| Report Archive | Searchable list of all reviewed reports | Read-only. |

**Design posture:** user-friendly, stunning, easy to navigate. Calm visual hierarchy, generous whitespace, sport-color cues. Zero raw vendor scores rendered as judgment.

**What the dashboard is NOT:** not the interpretation layer; not a place to expose raw HRV / readiness scores as athlete labels; not a leaderboard; not a physical training prescription tool; not a substitute for the weekly walkthrough during pilot.

### Automation Trust Gates
| Gate | Scope | Rule |
|---|---|---|
| Build now | Aggregation plumbing, report draft generation, Macra/Nora sport-context enrichment, evidence/provenance display | May run automatically if outputs are clearly marked as context or draft intelligence. |
| Human review required | Weekly + Game-Day Reports, high-impact coach-facing pattern interpretations | Pulse Check team reviews before coach delivery during early pilots. |
| Blocked from full automation | Early-warning alerts, high-trust athlete watchlist promotion, sustained under-recovery flags, coach-facing risk recommendations | Requires locked thresholds, evaluation criteria, false-positive review, pilot evidence. |
| Never owned here | Clinical-threshold interpretation, clinical return-to-play decisions, clinician-gated disclosures | Routes through AuntEDNA escalation. |

### Phased Build Roadmap
- **Phase 0 — Schema lock** (Done) — Sport config schema with attributes, metrics, prompting fields, includeInMacraContext / includeInNoraContext flags. Admin surface live at \`/admin/pulsecheckSportConfiguration\`.
- **Phase 1 — Athlete sport profile capture** (Done) — Macra athlete onboarding with sport selector + position; mirrored to root user doc.
- **Phase 2 — Macra hookup** (Done) — Cloud-scheduled daily insight pulls sport context, FWP training, longitudinal patterns, distribution, outcome trend, frequent foods. Insight type tags drive UI badges.
- **Phase 3a — Sports Intelligence Reasoning Layer v0.3** (In build) — Fact ledger, candidate reads, scoring, guardrails, executable Nora rubric, validated payloads, replay fixtures, and admin QA trace. Polar 360 athlete read is the first live consumer.
- **Phase 3b — Coach-facing reports** (In design) — Weekly + Game-Day report generation pipeline. Initial sport coverage: basketball, golf, bowling. Outputs launch as human-reviewed drafts.
- **Phase 4 — Early pilot operation** (Pilot brief approved) — 110-day pilot: 20 days onboarding + 90 days operation. Adherence as primary metric. Weekly walk-throughs with each head coach.
- **Phase 5 — Adaptive Framing Scale** (Specced) — Persistent per-athlete framing profile (1-10) calibrated by Nora. Build follows pilot.
- **Phase 6 — Cross-sport scale** (Pilot-dependent) — Football, soccer, baseball, softball, volleyball, tennis configurations harden with pilot evidence. Per-sport KPIs surface on the thin Coach Dashboard via each sport's \`kpiRefs\`; coaching decision surface remains the narrative reports.

### Implementation Non-Negotiables
- **Device-Agnostic By Contract** — Sports Intelligence reads from the normalized health-context surface, never directly from Polar / Whoop / Oura / Apple Health APIs. New device support is an adapter, not a Sports Intelligence change.
- **Sport-Specific, Athlete-Specific** — Every recommendation is interpreted through the athlete's sport, position, season phase, and individual baseline.
- **Reports Carry The Interpretation, Dashboard Stays Thin** — Coaches do receive a dashboard, but the dashboard is intentionally thin. Interpretation lives in the report; the dashboard makes those reports easy to find, scan, and act on without forcing the coach to dig through raw scores.
- **Spell Out The Coaching Moment** — Coach-facing copy must not speak in code. Every point must say when the moment shows up, what the athlete may feel or do, and the one simple mental-performance phrase or routine the coach should give. Vague handoff lines that assign warm-up, lineup, tactical, training, or recovery decisions to unnamed staff fail unless a real named role and decision are present in the source data. Terms like reset cue, mental install, body-state read, and decision support fail unless immediately rewritten into plain English.
- **Coach Owns Physical Programming** — Sports Intelligence may show recovery, load, trend, individual, and team-wide patterns so coaches can make better decisions. It must not tell the coach to change reps, sets, minutes, contact dose, throwing volume, or any other physical programming variable.
- **Clinical Boundary Is Architectural** — Performance signals stay in the Sports Intelligence Layer. Clinical-threshold signals route through the escalation pipeline to AuntEDNA.
- **AI Writes, Code Reasons** — Sports Intelligence never asks AI to notice, diagnose, or infer from scratch. Code builds the ledger, selects the candidate read, blocks unsupported claims, and runs the executable Nora rubric.
- **Plain Athlete Language** — Athlete-facing copy must sound like a coach talking to a smart middle schooler. Coach-room filler like baseline, block, push signal, pullback signal, accessories, finishers, and normal-start read fails unless rewritten into an everyday mental action: complete the Nora session, use one simple phrase when frustration shows up, protect bedtime, or notice focus during the first demanding task.

### Definition Of Done — Spec Stage
- Device-agnostic biometric surface contract is explicit: adapters only, no vendor leakage into Sports Intelligence reads.
- Sport configuration registry, athlete sport profile shape, and cross-product mirror fields are documented; admin surface is live.
- Output surfaces are defined with audience, cadence, and contents.
- Companion Aggregation + Inference Contract exists with baseline windows, source precedence, missing-data behavior, confidence propagation, output payloads, and automation gates.
- Sports Intelligence Reasoning Layer v0.3 is installed: fact ledger, candidates, scoring, guardrails, executable Nora rubric, validated payloads, and admin QA traces.
- Plain athlete language is executable: coach-room filler like baseline, block, push signal, pullback signal, accessories, finishers, and normal-start read is blocked from athlete-facing copy.
- Macra hookup is implemented and pulled into this spec as Phase 1 + 2.
- Phased roadmap is captured with explicit pilot dependency for Phases 4–6.
- Non-negotiables (device-agnostic, sport-and-athlete-specific, reports-carry-the-interpretation-thin-dashboard-as-access-surface, clinical-boundary-is-architectural) are written so future PRs can be measured against them.

---
`;

const SPEC_2_AGGREGATION = `
## 2. Aggregation + Inference Contract

Decisioning contract that turns raw normalized inputs into athlete-specific readiness, load, cognitive movement, sentiment trend, recommendations, and report payloads.

Version 0.3 makes decisioning candidate-based and audit-first. The contract now owns \`SportsFactLedger\`, \`SportsCandidateRead\`, \`SportsReasoningTrace\`, and \`ValidatedSportsIntelligencePayload\` in addition to report-level interpretations.

### Highlights
- **Decisioning Contract** — Locks how normalized inputs become fact ledgers, eligible candidate reads, selected recommendations, copy posture, and validated payloads.
- **Human Review By Default** — Weekly and game-day report generation can be built now, but pilot coach delivery stays reviewed. Early-warning alerts remain blocked from full automation.
- **Confidence Carries Through** — Every output preserves evidence refs, provenance, confidence tier, missing inputs, and copy posture from ingestion through coach-facing language.

### Baseline Windows
| Signal Family | Baseline Window | Calculation | Fallback Rule |
|---|---|---|---|
| Sleep volume / efficiency | 14 days minimum, 28 days preferred | Daily rolling median + 7d trend | < 7 valid nights → mark directional, suppress athlete-specific readiness recommendation. |
| HRV / resting HR | 14 days minimum, 28 days preferred | Rolling median, 7d trend, same-device preferred | Source change inside baseline window → recompute with degraded confidence until 7 same-source days exist. |
| Readiness / recovery score | 7 days minimum, 21 days preferred | Vendor-harmonized 0-100 score, then athlete-relative delta | Never compare raw scores across athletes. |
| Training load | 7d acute, 28d chronic | ACWR plus microcycle delta and sport-native load metrics | If external load is absent, use internal/RPE lane with provenance downgrade. |
| Sentiment / check-in posture | 5 check-ins minimum, 14 days preferred | Rolling average + direction + abrupt-shift detector | Do not expose individual disclosures in Sports Intelligence outputs. |
| Cognitive movement | 3 valid sim sessions minimum, 14 days preferred | Focus, Composure, Decisioning deltas from athlete baseline | If sim count is thin, use narrative trend language only; no strong recommendations. |
| Travel impact | Competition travel record required | Distance, timezone shift, travel days, travel direction | If schedule/travel provenance absent, omit travel instead of imputing. |

### Fact Ledger + Candidate Reads
**SportsFactLedger fields:** athleteContext, timeContext, sourceFreshness, recoveryFacts, loadFacts, sessionFacts, cognitiveFacts, checkInFacts, nutritionFacts, allowedClaims, blockedClaims, missingInputs, evidenceRefs.

**Candidate types:** readiness_status, recovery_limiter, load_spike, load_recovery_match, intent_mismatch, game_day_prep, cognitive_movement, fueling_context, session_confirmation_needed, data_quality, no_intervention.

**Hard guardrails:** unsupported session claim → block; unsupported physiology claim → block; stale-data overconfidence → repair or block; clinical boundary → route; executable Nora rubric failure → repair, fallback, or hold for review.

### Missing Data + Source Conflict Rules
**Minimum data behavior:** No biometric baseline → use training, check-in, cognitive only; no recovery/readiness claim. One stale source → exclude if older than freshness SLA. Mixed wearable sources → prefer strongest provenance and continuity, never average vendor readiness scores. Self-reported only → allowed for context, cannot drive high-trust coach recommendation. Clinical-threshold signal → stop Sports Intelligence delivery, route through AuntEDNA.

**Mixed-source precedence:** Continuous wearable > HealthKit-derived wearable > athlete-entered > coach-entered. Direct vendor lane wins over HealthKit fallback when freshness/completeness equal. FWP \`workoutSessions\` is canonical for session completion. Sport profile config wins over mirror for policy.

### Confidence Propagation
| Tier | Required Evidence | Allowed Output |
|---|---|---|
| high_confidence | Multiple fresh lanes, sufficient athlete baseline, stable source provenance | Direct report recommendations after pilot review |
| stable | Enough baseline + at least two aligned evidence families | Recommendation with normal confidence language |
| emerging | Pattern appears but baseline / evidence count is maturing | "Monitor", "consider", "early pattern" language |
| directional | Thin or partially stale evidence still points one way | Context language only; no strong adjustment |
| degraded | Conflict, stale source, missing baseline, or source transition | No automated coach recommendation |

### Interpretation Rules
- **Readiness** — Blend biometric recovery, sleep, HRV/RHR trend, cognitive movement, sentiment 48h, training load, optional travel. Output is a band + explanation, not a universal wellness score.
- **Training load** — Compute ACWR, microcycle delta, session RPE trend, sport-native metrics. Recommendations change by sport, position, season phase, competition density.
- **Cognitive movement** — Compare Focus / Composure / Decisioning to athlete baseline + sim family evidence. Use confidence tier from Correlation Engine; avoid population-average claims.
- **Sentiment trend** — Aggregate check-in posture into trend + abrupt-shift signal. No individual disclosure leaves clinician-gated or athlete-private contexts.
- **Recommendation selection** — Generate candidate reads, score them, block unsupported claims, then select the lowest-risk useful action that matches evidence confidence and sport policy.
- **Recommendation selection** — Choose the lowest-risk action that matches evidence confidence and sport policy.

### Sport / Position / Season Modifiers
- **Basketball point guard, congested schedule** — Low HRV + high ACWR triggers minutes-management review and shorter high-cognitive-load practice blocks.
- **Basketball frontcourt, strength block** — Same low HRV may produce recovery emphasis rather than minutes warning if sentiment + cognition are stable.
- **Golf tournament week** — Precision, sleep consistency, composure trend carry more weight. Poor sleep with stable composure may recommend warm-up/routine reinforcement, not load reduction.
- **Bowling multi-day tournament** — Day-three fatigue trend can trigger recovery protocol + reduced extra reps.
- **Off-season development** — Moderate load increase framed as adaptation if sleep, sentiment, cognition stay stable.

### Alert Thresholds + Automation Gates (Pilot Default)
Early-warning alerts and high-trust coach recommendations are generated as review candidates only during early pilots. Automated coach delivery requires pilot evidence, threshold evaluation, and explicit release approval.

| Signal | Candidate Threshold | Delivery Gate |
|---|---|---|
| Overtraining pattern | ACWR > 1.5 OR microcycle delta > +25% for 3 days, plus degraded recovery or sentiment/cognitive decline | Human review required in pilot. |
| Sudden sentiment shift | 48h sentiment drop crosses threshold and persists across 2+ check-ins | Clinical language → escalation, not Sports Intelligence alert. |
| Cognitive decline | F/C/D drop ≥ 1 confidence band or configured percentile across 2 valid sessions | Must include simEvidenceCount + confidence tier. |
| Game-day readiness concern | 2+ evidence families indicate acute concern within 48h pre-competition | Reviewed game-day note, not real-time alert. |
| Data quality alert | Critical lane stale or missing for 3 expected sync cycles | Ops/admin alert only. Never coach-facing as athlete risk. |

### Canonical Output Schemas
- **AthleteReadinessInterpretation**: athleteId, dayKey, readinessBand, evidence[], confidenceTier, missingInputs[], provenanceTrace[], coachCopy, athleteContextCopy
- **TrainingLoadInterpretation**: athleteId, window, acuteLoad, chronicLoad, acwr, sportNativeMetrics[], loadBand, confidenceTier, recommendationIds[]
- **CognitiveMovementInterpretation**: athleteId, focusDelta, composureDelta, decisioningDelta, simEvidenceCount, confidenceTier, explanation
- **SportsRecommendation**: id, targetAudience, actionType, recommendationStrength, sportModifiers[], contraindications[], evidenceRefs[], copyPolicy
- **SportsIntelligenceWeeklyReport**: teamId, weekStart, aggregateTrends, athleteWatchlist[], recommendedAdjustments[], confidenceSummary, reviewStatus
- **GameDayReadinessReport**: teamId, competitionId, generatedAt, athleteReadiness[], travelContext?, preCompetitionProtocols[], reviewStatus
- **SportsEarlyWarningAlert**: teamId, athleteId, alertType, triggerEvidence[], thresholdTrace, escalationChecked, reviewStatus, deliveryStatus

### Coach Copy Policy
| Posture | Rule | Allowed Language |
|---|---|---|
| High confidence, aligned evidence | Direct but non-diagnostic | "Consider reducing high-intensity repetitions today" (after review). |
| Emerging or directional | Monitoring language | "Early pattern worth watching" |
| Degraded | Restrained | "Data is incomplete today" — no athlete risk implied. |
| Self-reported provenance | Carry provenance into copy | "Athlete-reported fatigue has trended up" |
| Clinical boundary | No clinical interpretation | Escalation output only after AuntEDNA handoff. |

### Build Exit Criteria
- Baseline jobs produce deterministic outputs for the same input frame and write provenance traces.
- Every recommendation can be traced to evidence refs, sport modifiers, confidence tier, and copy policy.
- Game-day and weekly report drafts expose reviewStatus before coach delivery.
- Alert thresholds tested against pilot fixtures for false positives and false negatives before automated delivery.
- Missing-data fixtures cover no wearable, stale wearable, source transition, self-reported-only, and conflicting source records.
- Clinical-threshold fixtures prove Sports Intelligence stops and routes to escalation instead of generating performance copy.

### First Phase 3 Build Slice
- **Basketball Weekly Draft** — Team load trend, aggregate sentiment trend, cognitive movement, athlete watchlist candidates, reviewed training-adjustment recommendations.
- **Basketball Game-Day Draft** — Morning readiness draft with athlete-by-athlete evidence, missing-input trace, optional travel context, pre-competition protocol recommendations.
- **Alerts Held Back** — Internal alert candidates for evaluation only. No automatic coach delivery until thresholds clear pilot evidence review.

---
`;

const SPEC_3_REPORTS = `
## 3. Report Outlines + Coach Mock Reports

Companion baseline for what Sports Intelligence reports should look like across every sport currently in PulseCheck sport configuration. Each sport has a build-facing report outline plus a coach-facing mock report demo at \`/coach-report-demo/{sportId}\` (public for stakeholder review).

### Highlights
- **All Configured Sports Covered** — 18 sports, each with a populated reportPolicy in \`pulsecheckSportConfig.ts\`.
- **Reports Carry The Interpretation** — Narrative, pattern-aware, and useful for coach judgment. The thin Coach Dashboard is the access surface that links into reports.
- **Coach-Ready Demo** — Mock report is written for a head coach: top line, data confidence, individual vs team pattern read, watchlist, plain-language coaching moments, caveats. No QA artifacts on the coach surface.

### Universal Coach Report Shape
| Surface | Audience | Mock Contents | Release Posture |
|---|---|---|---|
| Weekly Sports Intelligence Report | Coach | Team posture, sport-native KPI movement, cognitive trend, load/recovery trend, individual vs team-wide pattern read, athlete watchlist, plain-language coach messages | Human-reviewed during pilot |
| Game-Day Readiness Report | Coach | Athlete-by-athlete mind-body state band, confidence tier, key evidence, missing inputs, sport-specific pre-competition protocol | Human-reviewed before delivery |
| Early-Warning Candidate | Internal review | Threshold trace, evidence refs, source confidence, escalation check, proposed coach-facing language | Not automatically delivered during pilot |

### Required Report Blocks
| Block | Required Shape |
|---|---|
| Header | Sport, team, report window, generatedAt, reviewStatus, reviewer, confidence summary |
| Data Coverage / Adherence | Wear rate, Nora completion, protocol/sim completion, nutrition coverage, read confidence — must show before any watchlist or recommendation block |
| Team Lens | One paragraph: what changed, what matters this week, where coaches should focus attention |
| Sport-Native KPIs | Only KPIs from sport config or verified team systems |
| Athlete Rows | Name, role/position, mind-body state band, confidence tier, evidence refs, missing inputs, plain-language coach message, copy posture |
| Watchlist | Rare, reviewed list of athletes or role groups; not a punitive ranking |
| Coach Adjustment | Practice, recovery, communication, pre-competition, or nutrition-context action framed in sport language |
| Trace | Internal-only provenance |

### Coach-Facing Plain-English Requirements
| Block | Requirement |
|---|---|
| Top Line | One plain-English paragraph that tells the coach what changed, why it matters, and what to do first |
| Data Confidence | Small coverage block before any interpretation |
| Team Read | Coach-language interpretation of load, readiness, sentiment, F/C/D movement |
| Watchlist | 2-4 reviewed athletes with "why this matters" + "coach move". No punitive ranking |
| This Week / Game-Day Actions | Short, practical actions usable in practice, walkthrough, pre-game, post-game recovery |
| Do Not Overread | Caveat that prevents raw score worship, clinical interpretation, unsupported technical advice |

### Adherence + Data Coverage (Primary Pilot Confidence Block)
Adherence is the primary success metric for early pilots. Every weekly report opens with data coverage before any athlete-specific claims. Thin participation lowers confidence and suppresses strong coach actions.

| Coverage Area | Report Rule |
|---|---|
| Device coverage | Wearable coverage by athlete and team; stale or missing lanes lower confidence before interpretation |
| Nora completion | Daily check-in completion + sentiment coverage |
| Protocol / sim completion | Completion rate, simEvidenceCount, recency for F/C/D movement |
| Training / nutrition coverage | FWP workout/session RPE coverage + Macra nutrition availability |
| Coach-facing confidence | Visible confidence posture: strong / usable / thin / insufficient (in coach voice, not internal tier names) |

### Config-Backed Report Policy
Lives under each \`PulseCheckSportConfigurationEntry.reportPolicy\` with common defaults owned by the report generator. All 18 configured sports ship policy-backed.

| Field | Purpose |
|---|---|
| reportPolicyDefaults | Shared generator defaults: interpretation-in-the-report posture, adherence/data coverage, confidence thresholds, aggregate sentiment, privacy, clinical-boundary routing |
| contextModifiers | Sport-specific modifiers (travel impact, schedule density, tee time, lane transition, block length, heat, wind, minutes concentration) |
| kpiRefs | References to metric keys in \`metrics[]\`; no report generator should invent sport KPI names |
| weeklyRead / gameDayRead | Report lenses with id, label, inputFamilies, linkedDimensions |
| watchlistSignals | Reviewed watch candidates with evidence families and dimension mapping |
| coachActions | Allowed coach moves linked to watch signals or report lenses |
| earlyWarningFamilies | Candidate alert families requiring high confidence and review |
| languagePosture | Coach-language summary, recommended terms, must-avoid phrases |
| dimensionMap | Internal sport-native mapping back to Focus, Composure, Decisioning |
| coachLanguageTranslations | Per-sport jargon → coach English translation table |

### Coach-Facing Mock Report Demo (Public)
Lives at \`/coach-report-demo/{sportId}\` — public route, whitelisted in AuthWrapper. Stakeholder-shareable URLs for the initial pilot sports (basketball, golf, bowling, track & field):
- \`/coach-report-demo/basketball\`
- \`/coach-report-demo/golf\`
- \`/coach-report-demo/bowling\`
- \`/coach-report-demo/track-field\`

**Design language:** Thunder ExtraBold display H1, sport-color accent bar + dot-grid texture in hero, athlete avatars (initials circles) on watchlist + game-day cards, "If you see / Then" structure on game-day morning, soft accent gradient ambient on wide monitors, coach-voice copy throughout, no QA artifacts visible.

### Implementation Acceptance — Report Generator Is Aligned When
- Every weekly report includes the universal blocks and sport-native KPI anchors for the athlete sport.
- Every weekly report opens with adherence/data coverage and suppresses strong claims when participation is thin.
- Every game-day report uses the sport-specific readiness lens and avoids prohibited language for that sport.
- Every sport-native theme maps internally to Focus, Composure, Decisioning so cross-sport measurement remains coherent.
- Top line requires three fills (whatChanged + who + firstAction). If any is missing, generator falls back to thin-read copy and labels the report as Thin read.
- Watchlist requires named athletes at stable confidence or higher; group-only blocks (e.g. "Sprinter group") are suppressed by policy.
- Coach actions must reference a named athlete or specific session; generic principles are filtered out.
- Every emitted report passes the sport-localization audit against languagePosture.mustAvoid; failed audits block coach delivery until regenerated.
- Pilot reviewers can compare generated copy against this mock baseline before coach delivery.
- New sports added through configuration are not considered report-ready until reportPolicy is populated and a matching mock-report baseline exists.

### Boundary Reminder
Mock report baselines define expected report shape and language. They do not override the automation gates in the Aggregation + Inference Contract. Weekly and game-day reports remain human-reviewed during pilot; early-warning alerts remain internal candidates only.

---
`;

const SPEC_4_CONTEXTUAL_DETECTION = `
## 4. Contextual Detection Engine

The differentiating Sports Intelligence loop: timestamped sensor evidence starts the read, but athlete profile, coach context, Nora clarification, and historical corrections turn ambiguous activity into sport-specific meaning. Pulse Check does not depend solely on the wearable. It uses the wearable as evidence, separates daily rollups from session candidates, then intelligently closes gaps with the athlete and coach.

### Core Rule
When confidence is low, do not guess harder. Ask better. Nora is the missing-signal engine: she asks for the one answer that can change the classification, confidence tier, load contribution, or recommendation.

### Evidence To Meaning Boundary
| Evidence Type | What It Means | Allowed Product Behavior |
|---|---|---|
| Daily rollup | Date-level facts such as steps, calories, active minutes, activity-class counts, sleep, recovery, and source coverage. | Context clue only. It may trigger "training-like movement today" in reviewer/debug surfaces, but it cannot become a session, bucket, or load contribution. |
| Timestamped primitive window | A segmented start/end window built from minute/sample-level HR, MET, activity class, cadence, distance, ACC bursts, rest gaps, and coverage. | Eligible for session_candidate and training-load bucket because it proves when the activity happened. |
| Explicit session source | HealthKit workout, vendor workout, QuickLifts workout completion, app-started workout runtime, or athlete/coach-confirmed scheduled session. | Eligible for session_candidate because the source gives a real window and provenance. Context still decides final meaning. |
| Ambiguous movement | Training-like evidence exists, but missing timestamps, poor coverage, or conflicting signals prevent segmentation. | Hold back or ask a targeted question only if the answer changes classification, confidence, load, recommendation, or reviewer delivery posture. |

### Five Context Layers
| Layer | What It Contains | Why It Matters |
|---|---|---|
| Sensor Evidence | HR, HR zones, movement density, acceleration bursts, step/distance, sleep, HRV, recovery, device coverage, signal quality. | Answers "what did the body and device show?" It does not own final sport meaning by itself. |
| Athlete Context | Sport, position, level, season phase, training age, injury history, normal baseline, goals, team membership, prior confirmed sessions. | Turns the same evidence into athlete-specific meaning. |
| Coach Context | Practice schedule, game schedule, prescribed plan, coach voice notes, roster tags, venue, training focus, intended intensity, modified workload. | Tells the system what was supposed to happen and what the staff already knows. |
| Nora Clarification | Targeted athlete or coach questions when evidence is incomplete: session type, RPE, soreness, whether this was practice/lift/conditioning/recovery. | Closes gaps without forcing manual logging. Nora asks only when the answer materially improves the read. |
| Structured Interpretation | Confirmed session record with evidence, context, direct answers, confidence tier, load contribution, recommendation posture, and learning signals. | This is what downstream load, readiness, reports, and Nora coaching consume. |

### Pipeline
Detect -> Contextualize -> Ask -> Confirm -> Interpret -> Learn.

- **Detect:** timestamped signals create candidate sessions from HR, movement density, acceleration bursts, device coverage, and real time windows. Daily rollups remain evidence only. Output is evidence, not a hard claim.
- **Contextualize:** enrich with athlete sport/position, team schedule, prescribed sessions, venue context, coach notes, and historical pattern memory.
- **Ask:** if confidence is incomplete and the missing answer matters, Nora asks a small, specific question in athlete or coach voice.
- **Confirm:** answers, dismissals, corrections, and text/voice context become first-class confirmation events with provenance.
- **Interpret:** emit a session_record and load/readiness context that combine observed data, sport policy, athlete baseline, coach intent, and Nora-confirmed context.
- **Learn:** repeated confirmations calibrate future reads: same team practice window, same athlete lift pattern, same coach schedule rhythm, same sport-specific session signature.

### Phase 0 Schema Contract
The implementation contract is locked in \`src/api/firebase/phaseJSessionContracts.ts\` with contract version \`phase-j-session-v0.1\`.

| Collection | Runtime Role |
|---|---|
| \`phase-j-session-candidates\` | Working records emitted by detection before final interpretation. |
| \`phase-j-context-confirmation-events\` | Durable athlete, coach, vendor, operator, and system confirmation/correction evidence. |
| \`phase-j-clarification-prompts\` | Nora prompt lifecycle records with target, question type, reason, status, expiry, and answer linkage. |
| \`phase-j-session-records\` | Canonical downstream session truth consumed by Sport Load, reports, Nora, and readiness context. |
| \`phase-j-athlete-session-patterns\` | Learned per-athlete session signatures used to reduce future questions. |

Confidence tiers are \`strong_contextual\`, \`confirmed\`, \`usable\`, \`directional\`, and \`hold_back\`. Actor precedence is \`operator > coach > athlete > vendor > system\`. Any record that can affect interpretation must carry provenance: source family, source type, source record ids, observed/ingested timestamps, confidence hints, and quality flags.

### Friction Guardrails
| Guardrail | Rule | Why |
|---|---|---|
| Max prompts per athlete per day | Default cap: 2 clarification prompts/day unless the athlete initiated the session or a safety/escalation lane is involved. | Prevents Nora from becoming session-detection homework. |
| Session-type cooldown | Do not ask the same athlete the same session-type question more than once in a rolling 72h window unless new evidence conflicts with the prior answer. | Stops repeated "was this a lift?" prompts after pattern evidence exists. |
| Coach-preferred routing | If coach context can resolve ambiguity without athlete burden, ask coach or wait for schedule/plan sync before asking the athlete. | Keeps athlete friction low and respects coach intent. |
| Pattern-confidence decay | As athlete_session_pattern.confidence rises, clarification probability decays. Ask only on drift, conflict, unusually high load, or missing critical context. | Confirmed routines should get cheaper over time. |
| Materiality gate | No clarification prompt is allowed unless the answer can change classification, confidence tier, load contribution, recommendation, or reviewer delivery posture. | Turns "ask better" into an enforceable rule. |
| Ask suppression | If the likely output is still directional after the answer, hold back or route to reviewer instead of interrupting the athlete. | Avoids low-value questions. |

### Hard Confirmation Rules
| Rule | Definition | Why |
|---|---|---|
| Direct actor identity | Confirmation requires a known athlete, coach, or operator actor id and role. Parsed text with no actor identity is supplementary evidence only. | Prevents "confirmed" from meaning "we parsed a sentence." |
| Recent enough | Default confirmation freshness: answer within 24h of session end. Older answers annotate but do not upgrade to confirmed read without reviewer approval. | Keeps stale memory from becoming session truth. |
| Unambiguous answer | The answer must resolve the specific classification/context question. Free-form summaries are parsed into evidence, then marked confirmed only if the key field is clear. | Vague notes are useful, but not automatically confirmation. |
| Conflict handling | If athlete answer, coach context, vendor sport, and schedule disagree, the record stays usable/directional until reviewer or follow-up resolves the conflict. | Triangulation should not hide disagreement. |
| Actor precedence | Coach owns intent/schedule context; athlete owns exertion, RPE, soreness, and what they personally did. Operator/reviewer can adjudicate conflicts. | Different actors are authoritative for different facts. |

### Cold-Start + Device-Absent Rules
- Athlete onboarding should pre-seed sport, position, level, season phase, normal weekly rhythm, known lift days, practice days, and preferred clarification mode.
- Coach onboarding should capture recurring practice windows, lift windows, venues, and minimum viable plan format.
- The first 14 days use lighter claims, reviewer visibility, and sparse questions while athlete_session_pattern is immature.
- If a scheduled event exists but wearable evidence is missing, create a low-confidence session_candidate with deviceCoverage=missing and ask for confirmation instead of dropping load entirely.
- If enough teammates confirm a scheduled practice, ask the missing athlete for one-tap confirmation; do not assume attendance.

### Audience Policy Boundary
Same bridge, different audience contract. Athlete-facing and coach-facing language may use the same ServerBridge/translation infrastructure, but must use separate audience policy profiles.

- **Athlete policy:** athlete-safe Nora framing: encouraging, private, non-punitive, focused on action and self-awareness.
- **Coach policy:** coach-operational language: concise, role-appropriate, team-context aware, no raw private disclosures, no clinical authority.
- **Forbidden shortcut:** do not route coach-facing language through translateForAthlete unless the service is explicitly role-aware and invoked with coach policy.

### Phase I Curriculum Boundary
Physical session records feed load/readiness and can influence Nora planning context, but they are not automatically mental-curriculum completions. A confirmed practice can trigger or modify a follow-up protocol/sim recommendation; completion still requires the athlete to execute the assigned mental task.

### Technical Implementation
| Workstream | Implementation |
|---|---|
| Daily evidence ledger | Write date-keyed aggregate activity evidence separately from timestamped primitives. Mark aggregate-only source records as not session-candidate eligible. |
| iOS primitive extractor | Generalize lift/Polar work into SessionPrimitiveAccumulator for HR zones, movement density, accel bursts, rest gaps, step/distance, and device coverage. |
| Sport detection profiles | Load sport/position policy from pulsecheck sport configuration: relevant primitives, thresholds, confidence gates, clarification questions, load-model inputs. |
| Candidate emitter | Emit session_candidate from device evidence without overclaiming. Include missingContext and "what would tighten this read" fields. |
| Nora clarification router | Given a candidate and missing context, choose whether to ask athlete, ask coach, wait for schedule sync, or hold back. Enforce daily caps, cooldowns, coach-preferred routing, and pattern-confidence decay. |
| Athlete response capture | Support quick taps, text summary, and voice summary. Parse lift/practice/conditioning summaries into structured context using the Claude bridge/GPT fallback path. |
| Coach context capture | Reuse Nora Context Capture: schedule upload, prescribed plan, voice memo, roster matching, venue/time windows, and parsed coach_observation. |
| Session record writer | Merge candidate evidence + confirmations + schedule/plan context into canonical session_record with provenance and confidence tier. |
| Pattern learning | Update athlete_session_pattern after confirmations/corrections. Use repeated confirmed patterns to reduce future questions and improve confidence. |
| Reviewer/debug surface | Show candidate -> context -> question -> answer -> final session_record -> load contribution so operators can audit why Nora believed something. Build the skeleton before automation is trusted. |

### Product Rules
- The device layer provides evidence; Nora plus athlete/coach context provides meaning.
- Daily summaries are not sessions. No timestamped evidence or explicit session source means no athlete-facing session card, no bucket, and no load contribution.
- Never synthesize a session window from aggregate active minutes, day-boundary math, snapshot end, or refresh time.
- Nora should ask only the smallest useful question, and only when the answer can change classification, confidence, load, or recommendation.
- Athlete and coach answers are data with provenance. They must be saved as structured confirmation events, not buried in chat transcripts.
- Repeated confirmations should reduce future friction. The system should learn team rhythm, athlete-specific patterns, and sport-specific signatures.
- Coach-facing language stays practical: "drop the practice plan and we will tighten the read" instead of "confidence is emerging."
- Athlete-facing and coach-facing language share infrastructure only when the bridge is role-aware; each audience must use its own policy profile.

---
`;

const SPEC_4_NORA_CONTEXT = `
## 4. Nora Context Capture

Coach-facing input layer. Athlete enters nothing on training data; coach spends ~5 minutes per week on three lightweight inputs (schedule upload, practice-plan upload, voice memo). Nora structures the rest.

### Highlights
- **Coach Burden ≈ Zero** — No reps logged, no counts entered, no sliders, no forms. Drop the schedule once, drop a plan when it changes, leave a voice memo when something matters.
- **Device Sees What Happened** — The device handles all training-data capture. Nora's job is only to capture intent and context — what was supposed to happen, who was where, what mattered.
- **Coach Voice Always** — When the system needs more context or has uneven coverage, it asks in coach voice ("drop the practice plan and we'll tighten the read") — never in science-speak.

### Three Input Modes
| Input | Format | Cadence | What It Becomes |
|---|---|---|---|
| Schedule upload | PDF, .ics, Google Calendar share, photo of a whiteboard | One-time, refresh whenever it changes | Season calendar — practice / lift / film / travel / competition. Once this is in, every device-detected session can be matched to a scheduled event. |
| Practice plan upload | PDF, picture of a whiteboard, Excel sheet, Google Doc | When the plan changes (usually weekly) | The week's prescribed training — comparison anchor for "executed 4 of the 6 prescribed reps". |
| Voice memo | Hold-to-talk, 10s to 2 minutes | When something matters — usually 1-3 a week | Coach's ambient observations: how practice felt, who looked off, what they installed. Replaces the practice-log a coach would otherwise have to type. |

### Burden Allocation
- **Athlete:** Wears the device. Checks in with Nora once a day. That's it.
- **Coach:** ~5 minutes per week — drop the schedule once, drop a practice plan when it changes, leave occasional voice memos.
- **Nothing else:** No reps logged. No counts entered. No sliders. No forms.

### Structured Records (Firestore)
| Record | Shape | Purpose |
|---|---|---|
| team_schedule_event | { teamId, sportId, kind: practice|lift|film|travel|competition, startsAt, endsAt, location?, opponent?, source: upload\\|voice\\|calendar_sync, sourceFreshness } | Backbone record matching device activity to intent |
| prescribed_session | { teamId, sportId, sessionEventId, blocks[]: { kind, target, count, intensity, restSec, notes }, source: pdf_upload\\|voice\\|whiteboard_photo, parserConfidence } | Prescribed structure of a training session — compared against device-detected session |
| coach_observation | { teamId, coachUserId, recordedAt, transcript, extracted: { athleteFlags[], topicTags[], tempoFlag?, freeText }, voiceMemoUrl?, source: voice\\|text } | Ambient coaching context from voice memos. Tagged so the report can pull "Coach said Davis looked tired Tuesday" into Tuesday's session |
| team_calendar_artifact | { teamId, sourceUrl, sourceType: pdf\\|ics\\|gcal\\|photo, parsedAt, eventCount, parserConfidence, raw? } | Original upload kept for re-parse + audit |

### Intake Channels
- Nora app — coach surface (drop file, paste link, hold-to-talk) — primary daily channel
- Email forward — coach@team-id.pulse.ai for AD-emailed schedules
- Calendar sync — Google / Outlook / iCloud OAuth, continuous
- Whiteboard photo — vision OCR pipeline → prescribed_session
- Pulse iOS share extension — share-to-Nora from any app

### Parser Pipeline
| Surface | How It's Parsed | Notes |
|---|---|---|
| PDF / Doc | pdf-parse + table extraction → workout_plan_extractor LLM → prescribed_session blocks | Works for typed practice plans + AD calendars |
| Whiteboard / photo | Apple Vision text recognition → workout_plan_extractor LLM → prescribed_session blocks | Confidence drops one tier; coach gets soft confirm prompt |
| Calendar sync (.ics / Google / Outlook) | Standard ICS/CalDAV reader → team_schedule_event | Deterministic; no LLM needed |
| Voice memo | Whisper transcription → coach_observation_extractor LLM → coach_observation with athlete/topic/flag tags | Athletes matched to roster; topics matched to sport's focus list |

**Parsing trust model:** Calendar sync is full confidence. Typed-PDF is high confidence with a 1-tap parsed preview for new formats. Whiteboard photo drops one tier and always shows editable preview. Voice memos always show transcript card before saving. Parse failures surface only on the coach's reviewer screen, in coach voice.

### Voice Memo as Primary Ambient Channel
**Why voice:** A coach's coaching cycle is verbal — they're already talking on the practice floor, in the film room, on the bus. A 15-second voice memo on the way to the car after practice gives Nora three or four pieces of structured context in less time than typing one sentence.

**What Nora extracts:**
- Athlete tags — names matched against the roster (one-tap confirm for nicknames or last-name-only)
- Topic tags — what was installed, what was emphasized, what felt off
- Tempo flags — "lighter day", "harder than usual", "felt sluggish across the group"
- Free-text trace — original transcript stays on the coach_observation

### Coach-Voice Examples (What The System Says Back)
- **Schedule context missing for a session:** "We saw Tuesday's session on the device but don't have a practice plan for it. Drop one and we'll lock in a tighter read."
- **Voice memo couldn't identify an athlete:** "Quick check — when you said 'Smith', did you mean M. Smith or D. Smith?"
- **Upload looks low-confidence:** "Got the practice plan — does this look right? [parsed preview] You can fix anything in 10 seconds."
- **Full context:** "This week's read is at full confidence — schedule, plan, and your notes are all in."
- **One-time gap:** "We don't have your competition schedule yet. Drop the season calendar and you're set for the year — Nora will keep it fresh."

### Privacy + Boundary Rules
- Athlete-private content from Nora check-ins NEVER enters team_schedule_event, prescribed_session, or coach_observation. Aggregate sentiment only.
- Voice memo retention: audio 90 days for re-transcription; transcripts per team data agreement. Coach can delete any memo at any time.
- Coach observations about athletes visible only to coaching staff with team access; athletes do not see transcripts.
- Schedule + observation records carry sport context + athlete tags but no biometric data — biometrics live in Health Context Source Record only.

### Failure Modes
- **Low-resolution whiteboard photo:** OCR confidence drops; Nora shows parsed structure with 1-tap edit. If skipped, prescribed_session stored at directional confidence; report flags practice as "device-derived only".
- **Coach forgets to upload schedule:** Device sessions still detected and classified by activity pattern. Confidence drops one tier. Reviewer screen nudges: "Drop the schedule and we'll tighten the read." Non-blocking.
- **Voice memo references unknown nickname:** Nora asks once: "When you said 'Wheels', do you mean P. Whitman?" Saves alias to roster_aliases.
- **Conflicting practice plans:** Latest upload wins, prior archived. Conflict shown on reviewer screen. Athletes see no disruption.
- **Calendar drift:** Continuous sync re-fetches; updated event bumps sourceFreshness. Already-matched device activity rebinds on next aggregation pass.

### Build Exit Criteria
- Coach can drop a season schedule and produce team_schedule_event records within 30 seconds.
- Coach can drop a weekly practice plan and produce prescribed_session blocks the system can compare device activity against.
- Coach can leave a 30-second voice memo and Nora produces a coach_observation tagged to right athletes and right session, in coach voice.
- When schedule or plan is missing, reviewer surface shows coach-voice nudge ("drop the practice plan and we'll tighten the read"), never science-speak.
- Athlete-private Nora content provably never propagated into team records.
- Coach can correct a parsed upload in one tap; correction trains future parses.

---
`;

const SPEC_5_SESSION_DETECTION = `
## 5. Session Detection + Matching

The bridge between what the device saw and what the coach planned. Detects training and competition sessions from timestamped biometric primitives or explicit workout/session records, classifies them by activity signature, matches them to schedule + prescribed-plan records, compares execution against prescribed structure, emits the session_record consumed downstream. Daily rollups can support context, but they cannot create sessions.

### Highlights
- **Device Sees It First** — Continuous biometrics let the system detect and classify sessions without any logging. Coach context tightens the read; absence of context does not break it.
- **Schedule + Plan = Tighter Read** — When team_schedule_event and prescribed_session exist, the matcher binds them to the detected session and emits prescribed-vs-executed deltas. When they don't, the read stays usable but lighter.
- **Unscheduled Activity Is Real Data** — Athletes who train outside the plan get counted, not ignored. Coach sees "extra session yesterday — counted in his load" without it being treated as a planning failure.

### Pipeline (Detect → Classify → Match → Compare → Emit)
| Step | What Happens | Notes |
|---|---|---|
| 1. Detect | Timestamped primitive stream or explicit workout records → activity-segmenter splits day into candidate sessions when HR/movement crosses thresholds | Sport-aware threshold profiles; daily rollups are excluded |
| 2. Classify | Each candidate gets a session-type guess from biometric signature (interval / steady / strength / game / scrimmage / recovery / unscheduled) | Outputs class + a "this guess is solid / rough" tier |
| 3. Match | Detected session bound to team_schedule_event and (when present) prescribed_session | Time-window overlap + sport context + (when GPS) location proximity |
| 4. Compare | When prescribed_session matched, compare device-detected blocks against prescribed (executed 4 of 6 reps; pace 4% slower) | Comparison fan-out lives on session_record |
| 5. Emit | Final session_record lands in Firestore | Consumed by load model + dimension-state engine + report generator |

### Session-Candidate Gate
| Gate | Definition | Behavior |
|---|---|---|
| Accepted: timestamped primitives | Minute/sample bins with observed start/end, local timezone, HR/MET/activity class/cadence/ACC/distance coverage. | Can open a session_candidate when sustained signal and quiet-gap rules produce real detectedStart/detectedEnd. |
| Accepted: explicit workout/session record | HealthKit workout, vendor workout, QuickLifts workout completion, scheduled session confirmed by athlete/coach, or app-started session runtime. | Can create or seed a session_candidate because the source already provides a real window and provenance. |
| Rejected: daily rollup only | Steps, calories, active minutes, activity-class counts, max/avg MET, date-level Polar/Oura summaries. | Evidence only. Can support a reviewer clue or targeted question, but cannot create a session_record or athlete-facing training-load row. |
| Local-time requirement | Every candidate carries UTC timestamps for ordering plus localDateKey/timezone for display and day attribution. | Prevents UTC/local drift and stops a late-night boundary from becoming a fake workout window. |

### Per-Sport Detection Signatures (Device-Only Inference)
| Sport | Detection Signature | Inferred From Device Alone | Read Quality |
|---|---|---|---|
| Track — Sprinter | GPS speed > 7 m/s segments separated by recovery dips | Per-rep distance + max velocity + recovery time = full session structure | Solid |
| Track — Distance | HR holds in Z2-Z4, GPS pace pattern | Pace zones + total distance + tempo-vs-easy classification | Solid |
| Track — Throws / Jumps | Accelerometer impact spikes (high peak force, low frequency) | Approach-rep count + landing load proxy | Rough — needs prescribed plan |
| Golf | Walking + intermittent swing impacts + 3-5h duration | Round duration + walking distance + swing count + heat exposure | Solid |
| Basketball Practice | Mixed-modal HR + jump cluster + lateral acceleration + 60-120 min | Active minutes + jumps + sprints + density | Solid |
| Basketball Game | Higher HR variability + interval pattern matching game-clock + travel pre/post | Same blocks + game-context flag | Solid w/ calendar, rough without |
| Bowling | Repetitive accelerometer rhythm + low HR + block duration | Shots per block + density + grip strain proxy | Rough — improves with prescribed plan |
| Soccer | High-speed runs (GPS > threshold) + sprint count + total distance + duration | Position-aware load primitives — full coverage | Solid |
| Football | Burst-rest-burst pattern + collision spikes + position-specific accel | Snap-count proxy + collision load + position-load profile | Solid for skill positions; rough for line without helmet IMU |
| Strength / Lift | Low-movement, accelerometer micro-spikes, HR rises in sets | Set count + rest pattern; reps inferred from cadence | Rough without plan, tight with |

### Classifier Input Features
- HR statistics — Mean, max, time-in-zone Z1-Z5; HR variability across session
- Movement statistics — GPS distance, max speed, sprint count, lateral-accel count, jump count
- Duration + structure — Total duration, high-intensity burst count, recovery-dip count, burst:rest ratio
- Time-of-day + location — When the session started, where; proximity to known team venues
- Calendar overlap — Time-window overlap with team_schedule_event records (highest-weight feature when present)
- Recent-context history — Same athlete's last 14 days of session_records

### Matching Rules
- **Time-window overlap** — Detected start ± 30 min window vs. team_schedule_event window. Closest overlap wins; sport context tiebreaks.
- **Location proximity** — When GPS available + venue known, ~250m proximity boosts match confidence. Indoor practices fall back to time-window only.
- **Sport context** — Detected classification must be plausible for matched event's sport.
- **Athlete-roster context** — Match is per-athlete; multiple athletes on same team can match same scheduled event with different execution profiles.
- **Unmatched activity** — Detected session with no plausible event becomes unscheduled_activity. Counted in load, flagged so coach knows it wasn't on the plan.

### Prescribed Comparison (When A Plan Exists)
| Comparison | How | What It Surfaces |
|---|---|---|
| Reps executed vs. prescribed | detected_reps / prescribed_reps | "Executed 4 of 6 reps" |
| Intensity vs. prescribed | Detected pace/power/HR-zone vs. targets | "Ran the reps 4% slower than prescribed" |
| Rest vs. prescribed | Detected rest dip lengths vs. prescribed | "Compressed the rest" or "blew up the rest" |
| Volume vs. prescribed | Detected total vs. prescribed total | Backbone for "stopped early" vs. "extra reps" |
| Modality drift | Detected modality vs. prescribed | "Athlete did a tempo run when the plan called for an easy day" |

### Confidence Tiers (Internal — Never Surface To Coach)
| Internal Tier | When | How It Surfaces |
|---|---|---|
| Strong read | Schedule + plan + device coverage + clean classifier | Used in coach reports without hedging |
| Usable read | One missing OR lower-confidence piece, device data clean | Used with lighter claims; reviewer nudges coach in coach voice |
| Early signal | No plan AND no schedule match; device-only inference | "Monitor" / "early pattern" language only; reviewer says "drop the practice plan and we'll tighten this read" |
| Holding back | Device coverage thin OR ambiguous classification | Suppressed; reviewer flags; coach report omits this session |

### Reviewer-Screen Nudges (Coach Voice Examples)
- Schedule missing: "We saw a session on Tuesday but don't have a practice plan for it. Drop one and we'll tighten the read."
- Unscheduled run: "D. Smith logged an extra session yesterday — wasn't on the plan. Counted in his load."
- Missed wear: "M. Johnson missed Tuesday's wear — we're leaning on his Wednesday and Thursday for this week's read."
- Device data clean, no plan: "This week's read is solid on what happened. Drop the practice plan and we can also speak to what was supposed to happen."
- Conflicting plans: "We have two practice plans for Tuesday — using the latest one. Heads up if that's wrong."

### Failure Modes
- **Only daily rollup evidence exists:** Record daily activity evidence and optionally show "training-like movement, no session window" in reviewer/debug surfaces. Do not emit a session_record, count load, or synthesize start/end.
- **Non-training activity:** Long walk, yoga, dance party. Classifier marks non_training; excluded from training load. Coach can confirm/correct via Nora.
- **Athlete forgot device for key session:** session_record emitted with device_data: missing, flagged. Load model uses prescribed plan as proxy if confidence high enough; otherwise excluded.
- **Genuinely uncertain classification:** session_record carries both candidates + "holding back" tier. Reviewer surfaces uncertainty; coach disambiguates in one tap.
- **Schedule event but no movement:** Travel/film/isometric lift. Classifier resolves correctly; if not, schedule kind field provides strong prior.
- **Wrong-wrist or shifted device:** Quality-of-signal flags pull session_record into "holding back". Reviewer tracks frequency by athlete to flag hardware issue early.

### session_record Schema
\`\`\`
{
  id, athleteId, sportId, detectedStart, detectedEnd,
  classifier: { class, candidates[], featureSnapshot },
  scheduleEventId?, prescribedSessionId?,
  prescribedComparison?,
  blocks[]: { kind, count, intensity, restPattern },
  deviceCoverage: { wear%, qualityFlags[] },
  confidenceTier: strong|usable|early|holding_back,
  coachVoiceSummary,
  unscheduledActivity?: bool
}
\`\`\`

Lives at \`athletes/{athleteId}/sessionRecords/{sessionRecordId}\` with denormalized index at \`teams/{teamId}/sessionRecords\`.

### Build Exit Criteria
- Detected session classifications agree with manual coach review on >85% of sessions across the initial pilot sports (basketball, golf, bowling, track & field).
- Match engine binds detected session to correct schedule event in >95% of cases when calendar context present.
- Prescribed comparison surfaces deviations correctly on a fixture set covering interval, steady, strength, and game session types.
- Every confidence tier verifiable from the record; no hidden internal states.
- Reviewer-screen nudges use coach voice — never "confidence is emerging" or "evidence is thin".
- Unscheduled activity detected, counted, surfaced without being treated as a planning failure.
- Athletes with poor device coverage visibly handled — week's read is "leaning on the days they wore it", not silently broken.

---
`;

const SPEC_6_LOAD_MODEL = `
## 6. Sport Load Model

Per-sport load model that turns device-derived session primitives + prescribed-comparison deltas + context modifiers into a sport-relevant load score with sport-tolerable thresholds. Lives on \`PulseCheckSportReportPolicy.loadModel\` so a new sport is an admin operation, not a deploy.

### Highlights
- **Same primitives, sport-specific blend** — Every device flows through the same Health Context Source Record. The difference between sports is which primitives matter, how they're weighted, and what counts as "high" — not the data shape.
- **Device sees what happened** — The athlete logs nothing. Reps, sprints, jumps, walking distance, swing count, intensity zones — all derived from continuous biometrics. The coach uploads the prescribed plan once a week so the model can compare execution vs. intent.
- **Sport-tolerable, not generic** — The same acute:chronic ratio that means "yellow flag" for a sprinter is normal range for a golfer. Thresholds and decay live per sport so coach language stays sport-native.

### Primitive Catalog (What The Device Captures)
| Primitive | How It's Derived | Sports That Use It Heavily |
|---|---|---|
| Sprint reps | GPS speed > sport threshold + duration > 2s | Track sprinter, soccer, lacrosse, basketball |
| Sprint distance | GPS distance accumulated above sport speed threshold | Track sprinter, soccer, football, lacrosse |
| HR-zone time | Seconds in HR zones Z1–Z5 | All sports — load denominator |
| Internal load (HR-derived) | TRIMP-style integration of HR-zone time | All sports — universal internal load proxy |
| Session RPE | Athlete-reported 1-10 effort | All sports — supporting input only, never primary |
| Jump count | Vertical accelerometer Z-spike count above sport threshold | Basketball, volleyball, gymnastics |
| Impact / collision load | Accelerometer impact-magnitude integration; helmet IMU when available | Football, lacrosse, hockey, wrestling |
| Walking distance | GPS distance at sustained low speed (1-2 m/s) over multi-hour activity | Golf |
| Swing reps | Accelerometer Z-spike with sport-characteristic signature | Golf, baseball, softball, tennis |
| Lateral acceleration count | Accelerometer X/Y deflection count above threshold | Basketball, volleyball, tennis |
| Block / round duration | Activity duration matched against sport-typical block lengths | Bowling, golf, tennis |
| Heat exposure | Skin temp + ambient × duration | Golf, soccer, T&F (distance), football camp |
| Sleep efficiency | Vendor-harmonized sleep score with hard-day-eve weighting | All sports — recovery debt input |
| HRV trend | rmssdMs rolling 7d vs. 28d baseline | All sports — recovery posture input |
| Travel days | GPS-detected location change beyond home venue / hotel signature | All sports — context modifier |
| Prescribed deviation | session_record.prescribedComparison delta | All sports — when plan is uploaded |

### Per-Sport Load Profiles
| Sport | Heaviest Primitives | ACWR Ceiling | Decay | Coach-Voice Phrases When Concerning |
|---|---|---|---|---|
| Track — Sprinter | sprintReps × distance, jump-height delta, RPE, HR-zone time | 1.4 | Fast (3-5d) | "looking heavy in the legs", "speed felt off" |
| Track — Distance | Weekly mileage in HR zones, tempo/threshold time, sleep, heat | 1.6 | Medium (5-7d) | "back-half of the volume block is showing", "long run hit harder than usual" |
| Track — Throws / Jumps | Contact / impact load, technical-rep count, peak force, landing load | 1.3 | Slow (7-10d) | "approaches feel heavy", "release timing slipped" |
| Golf | Walking distance, swing reps, round duration, heat exposure, tournament-eve sleep | 1.7 | Fast | "the grind of walking 18 is showing", "tempo off the back nine" |
| Basketball | Active minutes × intensity, jump count, repeat-sprint readiness, lateral-accel, collision when available | 1.5 | Medium | "minutes are catching up", "legs looked heavy on the late-clock reads" |
| Bowling | Shots × block length, grip strain proxy, travel days, between-block recovery | 1.6 | Medium | "repeating the same shot got harder late", "Day 2 stamina is the read" |
| Football | Snap-count proxy, collision load, position-specific accelerometer | 1.4 | Slow (7-10d) | "contact load piling on the LB unit", "padded reps are catching up" |
| Soccer | High-speed runs, sprint count, total distance, position-aware profile | 1.5 | Medium | "high-speed running is climbing past recovery", "midfield three is heavy" |
| Volleyball | Jump count, approach jump intensity, set-and-block reps, shoulder volume proxy | 1.5 | Medium | "jump count is climbing past the line", "blocking volume is catching up" |
| Wrestling | Mat time × intensity, grip readiness, weigh-in proximity, hydration + weight delta | 1.4 | Medium | "grip is tight going into the cut", "mat time is piling on" |
| Tennis | Match duration, surface load, heat exposure, between-point recovery | 1.6 | Fast | "the heat block is showing", "long-match recovery hasn't caught up" |
| Baseball | Pitch count + innings, throwing volume (position), at-bat density | 1.4 | Slow for arms; medium otherwise | "arm-care window is tight", "throwing volume is climbing" |
| Softball | Pitch count, throwing volume, tournament-day density, all-day fueling proxy | 1.5 | Medium | "tournament fatigue is showing", "Day 2 reaction is off" |
| Hockey | Shift count × shift length, skate repeat readiness, contact load | 1.5 | Medium | "shift length is creeping up", "contact accumulation is showing" |
| Lacrosse | Repeat sprint readiness, contact load, position-aware sprint demand | 1.5 | Medium | "two-way sprint demand is climbing", "contact is piling on" |
| Crossfit | Mixed-modal density, grip fatigue, gymnastics volume, monostructural pace | 1.6 | Fast | "grip is going into the qualifier hot", "density block is catching up" |
| Gymnastics | Landing load, skill-attempt count, apparatus-specific contact volume, growth/age sensitivity | 1.3 | Slow | "landing load is past the comfortable range", "beam attempts are catching up" |
| Bodybuilding / Physique | Cardio minutes, daily steps, posing minutes, fasted-weight trend, weeks-out proximity | 1.4 | Medium | "prep volume is on track", "post-show reverse is settling" |

### Load Score Pipeline
1. Pull session primitives — read each session_record's detected blocks + prescribedComparison delta + device coverage (per session, per athlete)
2. Apply sport blend — weight each primitive per the sport's loadModel; produce per-session load_au
3. Roll up acute / chronic — acute = trailing 7 days; chronic = trailing 28 days, both in load_au
4. Compute acute:chronic ratio
5. Apply context modifiers — heat × duration, travel days, time-zone shift, schedule density per sport contextModifiers
6. Apply recovery debt — sleep deficit + HRV-below-baseline streak push effective load up
7. Map to load band — compare adjusted score to sport thresholds (low / moderate / high / concerning)
8. Translate to coach voice — pull matching phrase from sport's coachLanguageTranslations + signal-state combination

### Prescribed Comparison Weighting (When A Plan Exists)
| Input | Formula | Coach-Voice Trigger |
|---|---|---|
| Executed reps fraction | detected_reps / prescribed_reps | < 0.85 = "stopped early"; > 1.15 = "added reps" |
| Pace deviation | (detected_pace - prescribed_pace) / prescribed_pace | > +5% slower = "ran the reps softer"; > -5% faster = "pushed past prescription" |
| Rest deviation | (detected_rest - prescribed_rest) / prescribed_rest | < -20% = "compressed the rest"; > +30% = "stretched the rest" |
| Volume deviation | (detected_volume - prescribed_volume) / prescribed_volume | "Stopped early" or "did extra" |
| Modality drift | detected_modality vs. prescribed_modality | "Tempo run when an easy day was prescribed" — high-impact on load story |

### Load Bands → Coach Voice
The coach NEVER sees "acute:chronic ratio" or "load_au" or "score: 0.78". The system maps every band to coach-voice phrases — pulled from the sport's coachLanguageTranslations.

| Band | Meaning | Coach-Voice Phrases |
|---|---|---|
| Low | Comfortably under sport-tolerable load | "Plenty of room", "fresh" |
| Moderate | Within typical training week, no flags | "On track", "solid week of work" |
| High | Approaching sport-tolerable ceiling | "Heavy week", "recent work is starting to show in the body-state data" |
| Concerning | Past ceiling OR sustained high without recovery | "Recovery is not keeping up with the week", "when fatigue shows up, ask one short question about focus and give the athlete one simple phrase to use before the next rep" |

### Schema (\`PulseCheckSportReportPolicy.loadModel\`)
| Field | Purpose |
|---|---|
| loadModel.primitives[] | Each: { key, weight, source, filter? } — what to pull from session_records and how to weight |
| loadModel.thresholds | { low, moderate, high, concerning } in 0–1 normalized space — per sport |
| loadModel.acwrCeiling | Sport-tolerable acute:chronic ratio (sprinter ~1.4, golfer ~1.7) |
| loadModel.decayHalfLifeDays | How fast load score recovers without new sessions |
| loadModel.recoveryDebtFloor | How negative the score can go before "deload" warning |
| loadModel.contextModifiers[] | Sport-specific environmental + schedule modifiers |
| loadModel.prescribedComparisonWeights | How much prescribed-vs-executed deltas adjust the load score |

### Failure Modes
- **Athlete missed device wear for two days:** Load held at last known value; flagged as "leaning on his last good days". Coach report omits hard claims about load for that athlete this week.
- **Prescribed plan missing:** Load model still produces score from device data alone. Confidence drops one tier. Coach report uses lighter claims; reviewer screen says "drop the practice plan and we'll tighten this read." Never silent.
- **Unscheduled extra session:** Counted in load (no surprise spike). session_record carries unscheduledActivity: true. Coach sees "extra session yesterday — counted in his load."
- **New sport, no calibrated thresholds:** Load model uses inherited reportPolicyDefaults; thresholds surfaced as "early baselining". Reviewer says "we're still learning what 'high' looks like for [sport] — first 4 weeks read lighter on purpose."
- **Wildly different baselines on same team:** All thresholds are athlete-relative within sport. Sport thresholds set the band; per-athlete baselines set the line within it.

### Build Exit Criteria
- \`PulseCheckSportReportPolicy.loadModel\` populated for every configured sport (starting with the initial pilot sports — basketball, golf, bowling, track & field) with primitives, weights, thresholds, decay, context modifiers; review-only on the Sports Intelligence Layer admin page (edits ship through code).
- Load score is reproducible — same athlete's same week produces the same number twice.
- Per-sport load bands map cleanly to coach-voice phrases in coachLanguageTranslations (no untranslated "ACWR > 1.5" leaking to report).
- Prescribed-vs-executed deltas materially adjust the load score.
- Missing-device-wear and missing-prescribed-plan cases produce a usable but lighter read instead of breaking — reviewer screen says so in coach voice.
- A new sport added through admin console produces a load score from day one using inherited defaults; reviewer flags "still baselining".

---
`;

const FOOTER = `
## End of Bundle

This bundle is a snapshot of the System Overview Sports Intelligence specs as of generation. The canonical source remains:
- \`/admin/systemOverview?section=pulsecheck-sports-intelligence-layer-spec\`
- \`/admin/systemOverview?section=pulsecheck-sports-intelligence-aggregation-inference-contract\`
- \`/admin/systemOverview?section=pulsecheck-sports-intelligence-mock-report-baselines\`
- \`/admin/systemOverview?section=pulsecheck-contextual-sports-detection-engine\`
- \`/admin/systemOverview?section=pulsecheck-nora-context-capture\`
- \`/admin/systemOverview?section=pulsecheck-session-detection-matching\`
- \`/admin/systemOverview?section=pulsecheck-sport-load-model\`

Operational admin surfaces:
- \`/admin/sportsIntelligenceReports\` — reviewer screen for draft seeding, curation, audit, and publish.
- \`/admin/pulsecheckSportConfiguration\` — sport configuration surface; code-owned reportPolicy/loadModel fields are review-only.
- \`scripts/seed-pulsecheck-sports.ts\` — idempotent diff/apply backfill for code-owned Sports Intelligence policy defaults.

Public coach-report demo URLs (no auth required):
- https://fitwithpulse.ai/coach-report-demo/basketball
- https://fitwithpulse.ai/coach-report-demo/golf
- https://fitwithpulse.ai/coach-report-demo/bowling
- https://fitwithpulse.ai/coach-report-demo/track-field
`;

export const SPORTS_INTELLIGENCE_DOCS_BUNDLE: string = [
  HEADER,
  SPEC_1_LAYER,
  SPEC_2_AGGREGATION,
  SPEC_3_REPORTS,
  SPEC_4_CONTEXTUAL_DETECTION,
  SPEC_4_NORA_CONTEXT,
  SPEC_5_SESSION_DETECTION,
  SPEC_6_LOAD_MODEL,
  FOOTER,
].join('\n');

export const SPORTS_INTELLIGENCE_DOCS_BYTES = SPORTS_INTELLIGENCE_DOCS_BUNDLE.length;
