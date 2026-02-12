# 🤖 Agent Onboarding Runbook

> **Purpose:** Step-by-step guide for adding a new AI agent to the Pulse team. This document is designed to be followed by Nora (or any agent) when onboarding a new team member. It covers every integration point in the system.

---

## Prerequisites

Before starting, gather the following from the person requesting the new agent:

| Question | Example | Variable |
|---|---|---|
| **Agent ID** (lowercase, no spaces) | `phoenix` | `AGENT_ID` |
| **Display Name** | `Phoenix` | `AGENT_NAME` |
| **Emoji** | `🔥` | `AGENT_EMOJI` |
| **Color** (hex) | `#ef4444` | `AGENT_COLOR` |
| **Role Title** | `QA & Testing Specialist` | `ROLE_TITLE` |
| **Role Description** (1-2 sentences) | `Owns end-to-end testing...` | `ROLE_DESC` |
| **AI Model** | `openai/gpt-5.1-codex` or `anthropic/claude-sonnet-4-5` | `MODEL` |

---

## Step 1: Create the OpenClaw Agent

OpenClaw manages the AI backend. Each agent gets its own isolated workspace.

```bash
# Create the agent with its own workspace
openclaw agents add NEW_AGENT_ID \
  --workspace ~/.openclaw/workspace-NEW_AGENT_ID \
  --model MODEL_ID \
  --non-interactive

# Set the agent's identity (name, emoji)
openclaw agents set-identity NEW_AGENT_ID \
  --name "DISPLAY_NAME" \
  --emoji "EMOJI"
```

**Verify:**
```bash
openclaw agents list
# Should show the new agent in the list
```

### Current agents for reference:
| Agent ID | OpenClaw ID | Model | Workspace |
|---|---|---|---|
| `nora` | `main` | `openai/gpt-5.1-codex` | `~/.openclaw/workspace` |
| `scout` | `scout` | `anthropic/claude-sonnet-4-5` | `~/.openclaw/workspace-scout` |
| `solara` | `solara` | `openai/gpt-5.1-codex` | `~/.openclaw/workspace-solara` |

---

## Step 2: Create the LaunchAgent plist

This makes the agent start automatically on boot and restart if it crashes.

**File:** `~/Library/LaunchAgents/com.quicklifts.agent.NEW_AGENT_ID.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.quicklifts.agent.NEW_AGENT_ID</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web; export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:$PATH; if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; export USE_OPENCLAW=true AGENT_ID=NEW_AGENT_ID AGENT_NAME=DISPLAY_NAME AGENT_EMOJI=EMOJI OPENCLAW_AGENT_ID=OPENCLAW_ID; exec node scripts/agentRunner.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/quicklifts-agent-NEW_AGENT_ID.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/quicklifts-agent-NEW_AGENT_ID.err.log</string>
</dict>
</plist>
```

**Load and start the agent:**
```bash
launchctl load ~/Library/LaunchAgents/com.quicklifts.agent.NEW_AGENT_ID.plist
launchctl start com.quicklifts.agent.NEW_AGENT_ID
```

**Verify:**
```bash
launchctl list | grep quicklifts.agent.NEW_AGENT_ID
# Should show PID and exit status 0
tail -20 /tmp/quicklifts-agent-NEW_AGENT_ID.out.log
# Should show heartbeat messages
```

---

## Step 3: Update `agentRunner.js` — OpenClaw Agent ID Mapping

The agent runner maps `AGENT_ID` → `OPENCLAW_AGENT_ID`. If the new agent's OpenClaw ID matches its AGENT_ID, no change is needed (the fallback is `'main'`). Otherwise, add it to the mapping.

**File:** `scripts/agentRunner.js` — Line ~43

```javascript
// BEFORE:
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || ({ 'nora': 'main', 'scout': 'scout', 'solara': 'solara' }[AGENT_ID] || 'main');

// AFTER (add new agent):
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || ({ 'nora': 'main', 'scout': 'scout', 'solara': 'solara', 'NEW_AGENT_ID': 'OPENCLAW_ID' }[AGENT_ID] || 'main');
```

> **Note:** If you set `OPENCLAW_AGENT_ID` in the plist's environment exports (Step 2), this mapping is bypassed and no code change is needed here.

---

## Step 4: Register in the Virtual Office UI

Several files need the new agent's color, emoji, and identity.

### 4a. `src/pages/admin/virtualOffice.tsx`

This is the main file with the most integration points.

#### Desk Positions (line ~58)
Add a new position to the `DESK_POSITIONS` array:
```typescript
const DESK_POSITIONS = [
  { x: 75, y: 30, facing: 'left' as const },    // Nora
  { x: 12, y: 70, facing: 'right' as const },   // Scout
  { x: 42, y: 55, facing: 'right' as const },   // Solara (or existing)
  { x: 55, y: 75, facing: 'left' as const },    // NEW_AGENT — add a new position
];
```

#### Role Titles (line ~70)
```typescript
const ROLE_TITLES: Record<string, string> = {
  nora: 'Director of System Ops',
  scout: 'Influencer Research Analyst',
  solara: 'Brand Director',
  NEW_AGENT_ID: 'ROLE_TITLE',  // ← add
};
```

#### Role Descriptions (line ~78)
```typescript
const ROLE_DESCRIPTIONS: Record<string, string> = {
  nora: '...',
  scout: '...',
  solara: '...',
  NEW_AGENT_ID: 'ROLE_DESCRIPTION',  // ← add
};
```

#### Agent Tooltips / Bio (line ~170)
Add a full tooltip/bio object for the new agent:
```typescript
const AGENT_TOOLTIPS: Record<string, AgentTooltip> = {
  // ... existing agents ...
  NEW_AGENT_ID: {
    title: 'ROLE_TITLE',
    subtitle: 'One-liner about core mission',
    sections: [
      {
        heading: '🔧 Core Responsibilities',
        items: [
          'Responsibility 1',
          'Responsibility 2',
        ],
      },
      {
        heading: '💡 Why This Role Matters',
        items: [
          'Value proposition 1',
        ],
      },
    ],
    footer: 'Summary sentence about what this agent brings to the team.',
  },
};
```

#### Fallback Presence (line ~1340)
Add a fallback presence object so the agent shows even if its runner hasn't connected to Firebase yet:
```typescript
const NEW_AGENT_PRESENCE: AgentPresence = {
  id: 'NEW_AGENT_ID',
  displayName: 'DISPLAY_NAME',
  status: 'offline',
  emoji: 'EMOJI',
  currentTask: '',
  taskProgress: 0,
  lastHeartbeat: new Date(),
};
```

And in the merge logic (~line 1377):
```typescript
if (!merged.some(a => a.id === 'NEW_AGENT_ID')) merged.push(NEW_AGENT_PRESENCE);
```

#### Priority Sorting (line ~1380)
Add to the priority record:
```typescript
const priority: Record<string, number> = { antigravity: 0, nora: 1, scout: 2, solara: 3, NEW_AGENT_ID: 4 };
```

### 4b. `src/components/virtualOffice/GroupChatModal.tsx`

**AGENT_COLORS** (line ~19):
```typescript
const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',
  antigravity: '#8b5cf6',
  scout: '#f59e0b',
  solara: '#f43f5e',
  NEW_AGENT_ID: 'HEX_COLOR',  // ← add
  default: '#3b82f6',
};
```

**AGENT_EMOJIS** (line ~27):
```typescript
const AGENT_EMOJIS: Record<string, string> = {
  nora: '⚡',
  antigravity: '🌌',
  scout: '🕵️',
  solara: '❤️‍🔥',
  NEW_AGENT_ID: 'EMOJI',  // ← add
};
```

### 4c. Other files with AGENT_COLORS / AGENT_EMOJIS

The same maps exist in these files — add the new agent to each:

| File | What to update |
|---|---|
| `src/components/virtualOffice/AgentChatModal.tsx` (line ~44) | `AGENT_EMOJIS` |
| `src/components/virtualOffice/FilingCabinet.tsx` (line ~16) | `AGENT_COLORS` |
| `src/components/virtualOffice/MeetingMinutesPreview.tsx` (line ~21) | `AGENT_COLORS` |
| `src/pages/admin/agentChat.tsx` (line ~44) | `AGENT_EMOJIS` |

> **Future improvement:** These should be centralized in a single `src/constants/agents.ts` file to avoid updating 6+ files every time we add an agent.

---

## Step 5: Update the Agent Manifesto

Add the new agent to `docs/AGENT_MANIFESTO.md` so that all agents know about the new team member.

Add a section under "Core Identity" introducing the new agent and their role.

---

## Step 6: Verify Everything Works

### 6a. Check the runner is alive
```bash
tail -f /tmp/quicklifts-agent-NEW_AGENT_ID.out.log
# Should see heartbeat logs every 30 seconds
```

### 6b. Check Firebase presence
The agent should appear in the `agent-presence` Firestore collection with status `idle` or `working`.

### 6c. Check the Virtual Office
Navigate to `/admin/virtual-office` — the new agent should appear at their desk with the correct emoji, color, and role title.

### 6d. Test chat
Open the Round Table and verify the new agent appears in the participant list and responds to brainstorm messages.

### 6e. Test task assignment
Switch to Task mode in Round Table, @mention the new agent, and assign a simple task. Verify it appears on the kanban board.

---

## Step 7: Restart Existing Agents (Optional)

If you want existing agents to pick up the manifesto changes:
```bash
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.nora
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.scout
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.solara
```

---

## Quick Reference — All Files to Touch

| # | File | What to add |
|---|---|---|
| 1 | `~/.openclaw/` | OpenClaw agent (via `openclaw agents add`) |
| 2 | `~/Library/LaunchAgents/com.quicklifts.agent.*.plist` | LaunchAgent plist |
| 3 | `scripts/agentRunner.js` | OpenClaw ID mapping (line ~43) |
| 4 | `src/pages/admin/virtualOffice.tsx` | Desk position, role title, role desc, tooltip, fallback presence, sort priority |
| 5 | `src/components/virtualOffice/GroupChatModal.tsx` | AGENT_COLORS + AGENT_EMOJIS |
| 6 | `src/components/virtualOffice/AgentChatModal.tsx` | AGENT_EMOJIS |
| 7 | `src/components/virtualOffice/FilingCabinet.tsx` | AGENT_COLORS |
| 8 | `src/components/virtualOffice/MeetingMinutesPreview.tsx` | AGENT_COLORS |
| 9 | `src/pages/admin/agentChat.tsx` | AGENT_EMOJIS |
| 10 | `docs/AGENT_MANIFESTO.md` | Team introduction |

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Agent not showing in Virtual Office | Not in `agent-presence` Firestore | Check runner logs for Firebase errors |
| Agent shows but with wrong emoji/color | Missing from frontend maps | Update all AGENT_COLORS/AGENT_EMOJIS files |
| "exit 1" in runner logs | OpenClaw agent not configured | Run `openclaw agents list` to verify |
| Agent can't execute tasks | `USE_OPENCLAW=true` not set | Check plist environment exports |
| Agent appears then disappears | Runner crashing on startup | Check `/tmp/quicklifts-agent-*.err.log` |

---

*Last updated: February 12, 2026*
