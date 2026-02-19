# Give Your OpenClaw the Memory it Needs (Full Guide)

> **Source:** @tolibear_ — February 2026
> **Saved:** 2026-02-19 as reference for Pulse agent memory architecture
> **Related files:** `~/.openclaw/openclaw.json`, `scripts/agentRunner.js`, `docs/AGENT_MANIFESTO.md`

---

This guide covers the three common ways memory fails, the configuration changes that fix most issues, and the advanced tools (QMD, Mem0, Cognee, Obsidian) that make memory production-grade. Feed this article to your agent and it will thank you later because it remembers.

## Introduction

Over the past month running multiple instances of OpenClaw I've had my agents forget basic information, lose critical project context mid-conversation, and completely blank on decisions we made 24 hours earlier.

If you've used OpenClaw for more than a day, you've probably hit this too. Your agent "knows" things, then suddenly doesn't. You've told it your preferences multiple times. You've watched it write something to memory, then fail to recall it the next day. You start wondering if memory is actually broken.

The good news is that it can be easily fixed. It just needs a proper setup and this guide will walk you through it.

## The Three Common Memory Failures in OpenClaw

Before you can fix memory, you need to understand why it breaks. OpenClaw treats memory as a suggestion, not a requirement. The agent decides what to save, when to search, and what to recall. Without explicit configuration, it forgets by default.

There are three common failure modes, and each requires a different solution.

### Failure Mode 1: Memory Is Never Saved

When you tell your agent something important like your name, your preferences, a critical project decision, etc. OpenClaw doesn't force it to disk. The LLM decides whether it's worth saving.

Think about that. Your agent doesn't automatically save to memory, it's actually a judgment call made by the model in real-time.

Sometimes it saves and sometimes it doesn't, and it's not clear when it does or doesn't save. That means important context can slip through constantly because the model deemed it not worth storing.

*This is like having an employee who decides on their own which meeting notes to keep and which to throw away.*

### Failure Mode 2: Memory Is Saved But Never Retrieved

Even when facts make it to disk, recall isn't guaranteed. OpenClaw provides a memory_search tool, but the agent has to decide to use it.

In practice, when you ask about something stored in memory, the model frequently answers from its current context window instead of searching. From your perspective, it "forgot" but in reality, it never looked.

*This is like an employee who saved a document to Google Drive, but when you ask for it, they answer from memory instead of checking the actual document.*

### Failure Mode 3: Context Compaction Destroys Knowledge

This is the killer. To avoid hitting token limits, OpenClaw compacts context so as the context window fills up, older messages get summarized or removed. Any information that only existed in the active conversation (not yet saved to disk) is destroyed.

This applies even to MEMORY.md content, which loads at session start, and can get summarized away during a long session. The agent literally forgets mid-conversation because compaction removed context and nothing triggered a reload.

*Imagine having an employee with a stack of papers on their desk. When the stack gets too tall, they throw out the oldest papers to make room without saving the important ones.*

## Basic Fixes: What Everyone Should Configure

Before reaching for plugins or external databases, there's a lot you can fix with configuration alone. Most cases of "my agent forgets everything" come from running the default config without any basic optimizations.

Below are 4 basic fixes to the default config that can greatly improve how your OpenClaw memory performs.

### 1. Enable Memory Flush (This Is Critical)

Memory flush triggers a silent turn before compaction that prompts the agent to write durable memories to disk. This is the single most impactful change you can make.

```json
{
  "compaction": {
    "memoryFlush": {
      "enabled": true,
      "softThresholdTokens": 40000,
      "prompt": "Distill this session to memory/YYYY-MM-DD.md. Focus on decisions, state changes, lessons, blockers. If nothing: NO_FLUSH",
      "systemPrompt": "Extract only what is worth remembering. No fluff."
    }
  }
}
```

The key insight is to customize the prompt in the compaction section of your config. The default prompt is generic. Tell it exactly what to capture and specifically include decisions, state changes, lessons, blockers.

Also advisable to raise `softThresholdTokens` to 40000 to trigger flushes earlier, before the good stuff gets compacted.

### 2. Configure Context Pruning

Context pruning controls how old messages are removed before full compaction. Use TTL mode as a simple fix.

```json
{
  "contextPruning": {
    "mode": "cache-ttl",
    "ttl": "6h",
    "keepLastAssistants": 3
  }
}
```

The above config keeps messages from the last 6 hours and always preserves the 3 most recent assistant responses. This eliminates the annoying situation where you have to repeat recent messages following a context flush.

### 3. Enable Hybrid Search

Memory search combines vector similarity (conceptual matching) with BM25 keyword search (exact tokens), you want to enable both.

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

If you're not running hybrid search, you're leaving accuracy on the table. BM25 catches exact matches (error codes, project names) that vector search misses.

### 4. Index Past Sessions

The last simple fix is to enable session transcript indexing to recall conversations from weeks ago.

```json
{
  "memorySearch": {
    "sources": ["memory", "sessions"]
  },
  "experimental": {
    "sessionMemory": true
  }
}
```

This chunks and indexes past conversations alongside your memory files. "What did we decide about the content template last Tuesday?" becomes answerable.

## Advanced Memory Solutions: When Basic Config Isn't Enough

For agents running more demanding workloads like multi-day projects, multi-agent team coordination, or complex knowledge management, the built-in system can still hit limitations. Here's where to go next.

### QMD: Superior Retrieval Backend

QMD, developed by @tobi the CEO of Shopify, is an opt-in replacement for the built-in SQLite indexer. It runs as a local sidecar that combines BM25 + vectors + reranking. The retrieval quality is noticeably better.

The killer feature with QMD is you can index external document collections. Your Obsidian vault, project documentation, Notion exports, etc. becomes searchable via memory_search.

### Mem0: Compaction-Proof External Memory

Mem0 is a YC-backed company that markets itself as the "memory layer for AI apps." Mem0 stores memories outside the context window entirely so compaction literally cannot destroy them.

Two processes run every turn:
- **Auto-Capture** detects information and stores it without depending on the LLM's judgment.
- **Auto-Recall** searches and injects relevant memories before the agent responds.

This solves Failure Modes 1 and 3 completely since memory is captured automatically and survives any compaction.

### Cognee: Knowledge Graphs

When you need to query relationships between people, places and things, then vector search isn't going to be enough. Cognee builds a knowledge graph from your data.

Cognee ingests OpenClaw's memory files to construct a graph of entities and relationships. This allows for structured representation of concepts and their connections.

### Obsidian Integration

Two ways to integrate:
1. **Symlink your memory folder:** `ln -s ~/workspace/memory ~/Obsidian/AgentMemory`
2. **Index your vault via QMD** — everything in Obsidian becomes searchable by agents.

## Multi-Agent Memory Setup (from the article)

| Layer | Purpose | Implementation |
|---|---|---|
| **Layer 1: Private memory per agent** | Each agent has its own workspace with MEMORY.md and daily notes | Private context stays private |
| **Layer 2: Shared reference files** | Symlinked `_shared/` directory with user profile, agent roster, team conventions | Every agent sees the same ground truth |
| **Layer 3: QMD with shared paths** | Each agent's QMD config includes the shared directory | All agents can search same reference docs |
| **Layer 4: Coordination** | "Chief of Staff" agent reads core files at session start | Maintains consistency across team |

## The Real Fix

Stop expecting memory to be automatic because it just isn't — you have to configure it to be. OpenClaw treats memory as suggestions, not requirements.

---

*This document is a reference for the Pulse agent team. When updating OpenClaw memory configuration or the agentRunner memory systems, re-read this for the research backing behind each design decision.*
