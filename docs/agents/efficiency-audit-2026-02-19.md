# Agent Efficiency Audit — 2026-02-19

> Audited by: Antigravity
> Files analyzed: `scripts/agentRunner.js`, soul files, manifesto, codebase map
> Previous audit status: 7/7 soul research takeaways now PASS ✅

---

## Executive Summary

The soul architecture is solid. The efficiency opportunities are in **prompt composition**, **wasted context**, **soulless prompt paths**, and **missing operational intelligence**. The biggest win is the codebase map — it's 54% of every task prompt but most of it is irrelevant to most tasks.

---

## 🔴 HIGH PRIORITY

### 1. Codebase Map is 54% of Every Task Prompt

**Current:** The full `CODEBASE_MAP.md` (7,638 chars, ~1,910 tokens) is injected into every single task execution prompt. This is the single largest block in the prompt.

**Problem:** Most tasks only touch 1-2 areas of the codebase. A task about brand messaging doesn't need to know about Firebase config paths. This wastes ~1,500 tokens per step (at 3-6 steps per task, that's 4,500-9,000 tokens of wasted context per task).

**Fix: Task-relevant codebase map filtering**
- Parse the task name/description for keywords
- Only inject the relevant sections of the codebase map
- Fallback to full map on retry (if the agent couldn't find files)
- Estimated savings: **40-60% of codebase map tokens per step** (~800-1,200 tokens saved per step)

**Priority: HIGH** — this compounds across every step of every task.

---

### 2. Recovery/Rewrite Prompt Has No Soul

**Current:** When a step crashes and triggers a Tier 2 "rewrite from a different angle" (line 4574), the recovery prompt is completely soulless:

```
RECOVERY MODE — A previous attempt at this task FAILED. You must try a DIFFERENT approach.
```

**Problem:** The article's research found that "a miscalibrated persona actively degrades performance" — but NO persona is arguably worse than a miscalibrated one. The recovery agent operates as a generic assistant, losing all the domain knowledge and thinking patterns from the soul.

**Fix:** Inject the soul's identity + thinking sections into the recovery prompt, so the agent brings its domain expertise to the recovery attempt.

**Priority: HIGH** — recovery is when the agent needs its soul the MOST.

---

### 3. Environment Block is Static & Repeated

**Current:** A 1,481-char environment/tools block is injected into EVERY task prompt (lines 4284-4320), describing:
- Mac App Store install commands
- Homebrew/npm install commands  
- SUDO_ASKPASS configuration
- Long-running install telemetry
- Key file paths

**Problem:** This information never changes. It uses ~371 tokens per step. For a typical 4-step task, that's ~1,500 tokens of static content that every step re-reads identically.

**Fix: Conditional environment injection**
- Only inject the full environment block on step 1 (or when the step involves installs/system operations)
- For subsequent steps, use a short reference: `"Environment details from Step 1 still apply."`
- Keyword detection: if the step description mentions "install", "brew", "sudo", "xcode", inject full block; otherwise skip
- Estimated savings: **~300 tokens per non-install step**

**Priority: MEDIUM-HIGH** — easy win, compounds over every task.

---

## 🟡 MEDIUM PRIORITY

### 4. Email Response Prompt Has No Soul

**Current:** Email responses use generic identities:
- Internal: `"You are ${AGENT_NAME}, the AI Chief of Staff at Pulse"`
- External: `"You are ${AGENT_NAME}, the AI Assistant at Pulse"`

**Problem:** Emails from Nora should sound like Nora. Emails from Solara should sound like Solara. Currently they all sound like the same generic assistant.

**Fix:** Inject compact soul (identity + flaw) into email prompts, same pattern as DMs.

**Priority: MEDIUM** — emails are lower volume than tasks, but they represent the agent to external partners.

---

### 5. Chat Intent Analysis Has No Soul

**Current:** `analyzeChatIntent()` (line 3815) uses:
```
"You are ${AGENT_NAME}, the AI Chief of Staff at Pulse."
```

**Problem:** This doesn't reflect the agent's actual role. Scout isn't "Chief of Staff" — Scout is a research analyst. The wrong role label could cause the intent classifier to misinterpret context.

**Fix:** Use `dmPersonalities[AGENT_ID].role` instead of hardcoded "Chief of Staff".

**Priority: MEDIUM** — quick fix, minor impact.

---

### 6. Task Decomposition is Generic

**Current:** `decomposeTask()` (line 3861) uses:
```
"You are a task decomposition agent."
```

**Problem:** A task decomposition agent doesn't know that Nora thinks in systems and dependency chains, or that Sage always starts with source verification. The decomposition doesn't reflect the agent's cognitive patterns.

**Fix:** Inject `cachedSoul.thinking` into the decomposition prompt so step breakdown reflects the agent's natural approach.

**Priority: MEDIUM** — would improve step quality, especially for complex tasks.

---

### 7. Manifesto is 39KB but Only ~2.3KB Gets Used

**Current:** `AGENT_MANIFESTO.md` is 39,126 chars (~9,687 tokens). On retries, only the Environment Knowledge section (capped at 1,500 chars) and Lessons Learned (capped at 800 chars) are injected — totaling ~2,300 chars.

**Problem:** Not really a problem — the capping is correct. But the manifesto file itself has grown very large. Lessons Learned may contain outdated entries that waste the 800-char budget.

**Fix:** 
- Periodically prune the Lessons Learned section (remove entries older than 30 days)
- Or cap at the N most recent entries instead of a char limit
- Consider: should evolved soul learnings eventually REPLACE some manifesto lessons?

**Priority: LOW-MEDIUM** — the 39KB file is fine on disk, and the injection is already capped.

---

## 🟢 LOW PRIORITY  

### 8. North Star Refresh is 15 Minutes

**Current:** `NORTH_STAR_REFRESH_MS = 15 * 60 * 1000` — the North Star is re-fetched from Firestore every 15 minutes.

**Observation:** This is fine for most use cases, but if you update the North Star during a task, the agent won't see it until the next refresh. Consider making this configurable or triggering a refresh on task start.

**Priority: LOW** — 15 minutes is reasonable.

---

### 9. No Per-Step Token Budget

**Current:** There's no maximum token budget for individual steps. If the buildPrompt generates a massive prompt (e.g., long codebase map + long manifesto on retry), it gets sent as-is.

**Fix:** Add a `clampPromptText()` call to `buildPrompt()` similar to how group chat prompts are clamped at `GROUP_CHAT_SYSTEM_PROMPT_BUDGET_CHARS`. This would prevent token waste on edge cases.

**Priority: LOW** — the current prompt sizes (~3,500 tokens) are within reasonable limits.

---

### 10. Validation Uses Same Model for All Tasks

**Current:** Post-task validation always uses `VALIDATION_MODEL` (gpt-4o-mini). This is correct for most tasks.

**Observation:** For high-complexity tasks (4-5), a better model might catch more validation issues. Consider using the task's model tier for validation of complex tasks.

**Priority: LOW** — validation accuracy is less critical than task execution accuracy.

---

## 📊 Prompt Composition Analysis

### Task Execution Prompt (First Attempt)

| Component | Size | % of Prompt | Notes |
|---|---|---|---|
| **Codebase Map** | 7,638 chars (~1,910 tokens) | **54.2%** | 🔴 Largest block — mostly irrelevant per task |
| **Soul** | 3,688 chars (~922 tokens) | 26.2% | ✅ Good — research says 90% should be identity |
| **Environment block** | 1,481 chars (~371 tokens) | 10.5% | 🟡 Static, could be conditional |
| **Work Output Rules** | 789 chars (~198 tokens) | 5.6% | ✅ Reasonable |
| **Task/Step context** | ~500 chars (~125 tokens) | 3.5% | ✅ Minimal |
| **Total** | **~14,096 chars (~3,524 tokens)** | 100% | |

### Per-Task Token Cost Estimate

| Scenario | Tokens/Step | Steps | Total | Cost (GPT-4o) |
|---|---|---|---|---|
| Simple task (3 steps, no retries) | 3,524 | 3 | 10,572 | $0.026 |
| Medium task (5 steps, 1 retry) | 3,674 | 6 | 22,044 | $0.055 |
| Complex task (6 steps, 2 retries) | 4,199 | 8 | 33,592 | $0.084 |

*Plus: decomposition (~500 tokens), validation (~1,000 tokens), soul evolution (~500 tokens)*

---

## Action Items (Prioritized)

| # | Action | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | **Task-relevant codebase map filtering** | -1,200 tokens/step | Medium | 🔴 HIGH |
| 2 | **Add soul to recovery prompts** | Better recovery quality | Low | 🔴 HIGH |
| 3 | **Conditional environment block** | -300 tokens/step | Low | 🟡 MED-HIGH |
| 4 | **Soul-powered email responses** | Brand-consistent emails | Low | 🟡 MEDIUM |
| 5 | **Fix "Chief of Staff" in analyzeChatIntent** | Correct role label | Trivial | 🟡 MEDIUM |
| 6 | **Soul-aware task decomposition** | Better step breakdown | Low | 🟡 MEDIUM |
| 7 | **Manifesto lesson pruning** | Fresher retry context | Low | 🟢 LOW-MED |
| 8 | **North Star refresh on task start** | Faster config propagation | Trivial | 🟢 LOW |
| 9 | **Per-step token budget clamp** | Edge case protection | Low | 🟢 LOW |
| 10 | **Complexity-based validation model** | Better validation for hard tasks | Trivial | 🟢 LOW |

---

*Next steps: Implement items #1-3 for immediate token savings, then #4-6 for consistency across all prompt paths.*
