# Memory System Audit — 2026-02-19

> Audited by: Antigravity  
> Reference: `docs/reference/openclaw-memory-research.md`  
> Config analyzed: `~/.openclaw/openclaw.json`  
> Workspace files: `~/.openclaw/workspace*/`  

---

## Executive Summary

Our memory system has **significant gaps**. The OpenClaw config is running near-default settings with no memory flush, no hybrid search, no session indexing, and no context pruning. We're vulnerable to all three failure modes described in the article. However, our *custom* memory layer (agentRunner.js manifesto + soul files + Firestore) partially compensates for some of these gaps.

---

## Failure Mode Analysis

### Failure Mode 1: Memory Is Never Saved

| Check | Status | Evidence |
|---|---|---|
| OpenClaw `memoryFlush` enabled | ❌ **MISSING** | Not present in `openclaw.json` — only `"compaction": { "mode": "safeguard" }` |
| Custom memory flush prompt | ❌ **MISSING** | No custom flush prompt configured |
| Agent auto-saves important context | ⚠️ **PARTIAL** | Our `appendLessonLearned()` writes to AGENT_MANIFESTO.md on failures, and `appendSoulLearning()` writes to soul files on task completion — but these only capture *task-level* insights, not conversational decisions or preferences |
| Memory files exist per agent | ⚠️ **SPARSE** | Only `main` workspace has memory files (2 entries in 9 days: 2026-02-10, 2026-02-18). Scout, Sage, Solara have **zero** memory files |

**Verdict: 🔴 FAILING** — Context from conversations, decisions, and preferences is almost certainly being lost. The two memory entries that exist are minimal (546 chars and 225 chars).

---

### Failure Mode 2: Memory Is Saved But Never Retrieved

| Check | Status | Evidence |
|---|---|---|
| Hybrid search enabled | ❌ **MISSING** | No `memorySearch` config in `openclaw.json` |
| Vector + BM25 combined | ❌ **MISSING** | Default SQLite indexer only |
| Session indexing enabled | ❌ **MISSING** | No `experimental.sessionMemory` config |
| Memory search includes sessions | ❌ **MISSING** | No `sources: ["memory", "sessions"]` config |
| Custom manifesto/soul lookup | ✅ **WORKING** | `loadManifesto()`, `loadSoul()`, `loadCodebaseMap()` load context from disk every step — but these are hardcoded paths, not semantic search |

**Verdict: 🔴 FAILING** — Even if memories were saved, agents would likely answer from context window instead of searching. Our custom file loaders (soul, manifesto, codebase map) work well but only cover pre-defined structural knowledge, not conversational history.

---

### Failure Mode 3: Context Compaction Destroys Knowledge

| Check | Status | Evidence |
|---|---|---|
| Compaction mode | ⚠️ `"safeguard"` | Better than default — safeguard mode is more conservative about what it removes |
| Context pruning configured | ❌ **MISSING** | No `contextPruning` config — no TTL, no keepLastAssistants |
| `softThresholdTokens` set | ❌ **MISSING** | Using default threshold (likely 80K+), meaning flushes happen late |
| Custom soul/manifesto survives compaction | ✅ **YES** | These are loaded from disk each step, not from context window. They're compaction-proof by design |

**Verdict: 🟡 PARTIALLY PROTECTED** — Our `safeguard` compaction mode is better than default, and our custom file-based knowledge (soul, manifesto, codebase map) is completely compaction-proof since it loads from disk. But *conversational* knowledge (decisions made during chat, evolving context) is still vulnerable.

---

## What We Have That The Article Doesn't Cover

Our system has several custom memory mechanisms that go *beyond* what OpenClaw's built-in memory provides:

| Our System | Article Equivalent | Notes |
|---|---|---|
| **Soul files** (`docs/agents/{id}/soul.md`) | Layer 1: Private memory | Richer than daily notes — structured experiential identity with beliefs, anti-patterns, thinking patterns |
| **Soul evolution** (`appendSoulLearning()`) | Layer 1 + auto-capture | Agent learns from every task and writes to its own soul file. Compaction-proof. |
| **Manifesto** (`docs/AGENT_MANIFESTO.md`) | Layer 2: Shared reference | Shared institutional knowledge across all agents. Updated on failures via `appendLessonLearned()` |
| **Codebase Map** (`docs/CODEBASE_MAP.md`) | Layer 2: Shared reference | Structural navigation shared by all agents |
| **North Star** (Firestore) | Layer 2: Shared reference | Strategic alignment. Cached 15 min. |
| **Firestore presence** | Layer 4: Coordination | Real-time agent status, token usage tracking, soul evolution tracking |
| **Task history** (Firestore) | No equivalent | Persistent task outcomes survive any compaction |

**Key insight:** Our custom layer (agentRunner.js) essentially builds its own memory system *on top of* OpenClaw, bypassing many of the OpenClaw memory issues. The soul files, manifesto, and codebase map are loaded from disk every step — they can never be forgotten.

---

## The 4 Basic Fixes — Audit

### Fix 1: Enable Memory Flush

**Current:** ❌ Not configured  
**Impact:** HIGH — This is "the single most impactful change" per the article  
**Recommendation:**

```json
{
  "compaction": {
    "mode": "safeguard",
    "memoryFlush": {
      "enabled": true,
      "softThresholdTokens": 40000,
      "prompt": "Distill this session to memory/YYYY-MM-DD.md. Focus on: decisions made, project state changes, lessons learned, blockers discovered, preferences expressed, key facts about Pulse/agents/architecture. If nothing worth remembering: NO_FLUSH",
      "systemPrompt": "You are an agent memory specialist. Extract only durable, actionable knowledge. No fluff. No repetition of what's already in your soul file or AGENT_MANIFESTO.md."
    }
  }
}
```

### Fix 2: Configure Context Pruning

**Current:** ❌ Not configured  
**Impact:** MEDIUM — prevents stale messages from crowding out recent context  
**Recommendation:**

```json
{
  "contextPruning": {
    "mode": "cache-ttl",
    "ttl": "6h",
    "keepLastAssistants": 3
  }
}
```

### Fix 3: Enable Hybrid Search

**Current:** ❌ Not configured  
**Impact:** HIGH — without this, `memory_search` uses basic vector matching only  
**Recommendation:**

```json
{
  "memorySearch": {
    "enabled": true,
    "sources": ["memory", "sessions"],
    "query": {
      "hybrid": {
        "enabled": true,
        "vectorWeight": 0.7,
        "textWeight": 0.3
      }
    }
  }
}
```

### Fix 4: Index Past Sessions

**Current:** ❌ Not configured  
**Impact:** MEDIUM — would make past conversations searchable  
**Recommendation:**

```json
{
  "experimental": {
    "sessionMemory": true
  }
}
```

---

## Multi-Agent Memory Architecture — Audit

| Article Layer | Our Status | Gap |
|---|---|---|
| **Layer 1: Private memory per agent** | ⚠️ PARTIAL | Each agent has its own workspace, but only `main` (Nora) has any memory files. Scout/Sage/Solara workspaces have working docs but no `memory/` directory |
| **Layer 2: Shared reference files** | ✅ IMPLEMENTED | Manifesto, codebase map, and North Star are shared via the project repo. Soul files are per-agent but all live in the same repo |
| **Layer 3: QMD with shared paths** | ❌ NOT INSTALLED | No QMD sidecar. Using default SQLite indexer. Memory database sizes: main=6.1MB, scout/sage/solara=100KB each (nearly empty) |
| **Layer 4: Coordination** | ✅ IMPLEMENTED | Nora functions as the coordination agent. Firestore presence system provides real-time status. Group chat enables multi-agent brainstorming |

---

## Prioritized Action Items

| # | Action | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | **Enable memoryFlush in openclaw.json** | Fixes Failure Mode 1 — agents will save knowledge before compaction | Config change | 🔴 **CRITICAL** |
| 2 | **Enable hybrid search** | Fixes Failure Mode 2 — agents will actually find saved memories | Config change | 🔴 **HIGH** |
| 3 | **Add contextPruning** | Reduces Failure Mode 3 risk — TTL keeps recent context fresh | Config change | 🟡 **MEDIUM** |
| 4 | **Enable sessionMemory** | Makes past conversations searchable | Config change | 🟡 **MEDIUM** |
| 5 | **Create memory/ dirs for all agent workspaces** | Ensures all agents can write daily notes | `mkdir -p` | 🟡 **MEDIUM** |
| 6 | **Investigate QMD installation** | Superior retrieval backend with external doc indexing | Medium effort | 🟢 **LOW** (future) |
| 7 | **Consider Mem0 plugin** | Compaction-proof auto-capture/recall | Medium effort | 🟢 **LOW** (future) |

---

## Overall Score

| Category | Score | Notes |
|---|---|---|
| **OpenClaw built-in memory** | 2/10 | Near-default config. No flush, no search, no pruning. |
| **Custom memory (agentRunner)** | 8/10 | Excellent. Soul files, manifesto, codebase map all load from disk and are compaction-proof. Soul evolution provides auto-learning. Firestore tracks everything. |
| **Combined effective memory** | 6/10 | The custom layer compensates well for task execution, but conversational context (DMs, decisions, preferences) is still vulnerable to the three failure modes. |
| **Multi-agent coordination** | 7/10 | Strong shared reference layer (manifesto, North Star) and Firestore coordination. Missing QMD shared search. |

**Bottom line:** Our custom agentRunner memory system is strong and creative — it sidesteps most of OpenClaw's memory issues for *task execution*. But the OpenClaw config itself is nearly unconfigured. The 4 basic fixes from the article (all config changes, no code required) would significantly improve conversational memory and decision recall.

---

*Next steps: Apply fixes #1-4 to `~/.openclaw/openclaw.json` and create memory directories for all agent workspaces.*
