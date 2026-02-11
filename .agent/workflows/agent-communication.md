---
description: How to communicate with AI agents (Nora, Scout, etc.) directly from the IDE
---

# Agent Communication

Send commands, tasks, and messages to your AI agents directly from here. Messages flow through Firestore's `agent-commands` collection and are picked up by the agent runner in real-time.

**Communication is bidirectional** — agents proactively message you back with task completion summaries, failure reports, and suggestions without waiting for you to ask.

## Quick Commands

### Send a task to an agent
```bash
node scripts/sendToAgent.js nora "Your task description here" --type task --from antigravity
node scripts/sendToAgent.js scout "Find 10 running influencers with 10k+ followers" --type task --from antigravity
```

### Ask an agent a question
```bash
node scripts/sendToAgent.js nora "What's your current status?" --type question --from antigravity
```

### Send a chat message
```bash
node scripts/sendToAgent.js nora "Let me know when you're done" --type chat --from antigravity
```

### Send a direct command
```bash
node scripts/sendToAgent.js nora "Pull latest main and restart" --type command --from antigravity
```

## Message Types

| Type | Use When |
|---|---|
| `task` | Assigning work — agent will decompose into steps and execute |
| `command` | Direct instruction — agent executes immediately |
| `question` | Asking for info — agent responds with status/data |
| `chat` | General conversation — Smart Chat auto-detects intent via OpenAI |

## Agent IDs

| Agent | ID | Role | Runner |
|---|---|---|---|
| Antigravity | `antigravity` | Co-CEO · Strategy & Architecture | IDE (this machine) |
| Nora | `nora` | Director of System Ops | Mac Mini / local |
| Scout | `scout` | Influencer Research Analyst | Mac Mini / local |

## Starting an Agent Runner

Each agent needs its own runner process. The runner authenticates via the Firebase Admin SDK (service account credentials are embedded):

```bash
# Source env vars and start Nora
set -a; source .env.local; set +a
AGENT_ID=nora AGENT_NAME="Nora ⚡" node scripts/agentRunner.js

# Start Scout (in a separate terminal)
set -a; source .env.local; set +a
AGENT_ID=scout AGENT_NAME="Scout" node scripts/agentRunner.js
```

## How It Works

```
You (IDE/Chat UI) → Firestore (agent-commands) → Agent Runner → Agent executes
                                                                    ↓
You (Chat UI) ← Firestore (agent-commands) ← Proactive messages ←──┘
                                                                    ↓
You (Virtual Office) ← Firestore (agent-presence) ← Progress ←─────┘
```

### Outbound (you → agent)
1. **You send a message** via the Chat UI or `sendToAgent.js` script
2. **Message lands in Firestore** `agent-commands` with `from: admin, to: <agentId>, status: pending`
3. **Agent runner picks it up** via real-time Firestore listener
4. **Agent processes it** — for tasks, decomposes into steps and executes
5. **Agent responds** by updating the document with a `response` field

### Inbound (agent → you) — Proactive Messaging
Agents don't just respond — they **initiate** messages. These appear as incoming bubbles in the Chat UI:

- **Task completed** → Agent sends a summary with step count, duration, and what was done
- **Task failed** → Agent sends a failure report with the error and asks if you want to retry
- **Suggestions** → Agent can flag issues or recommend follow-up work

Proactive messages are stored as new `agent-commands` docs with `from: <agentId>, to: admin`.

## Chat UI Features

Access via: **Admin → Agent Chat** or directly at `/admin/agentChat`

- **Bidirectional conversation** — see both your messages and agent-initiated messages
- **Smart Chat** — when you send a `chat` message, OpenAI analyzes intent and auto-upgrades to `task` or `command` if appropriate
- **Offline detection** — if an agent's heartbeat is stale (>2 min), it shows as offline
- **Auto-fail** — pending messages to offline agents auto-fail after 45s with a reconnect hint
- **Proactive badges** — agent-initiated messages show `completed`, `failed`, `update`, or `suggestion` badges

## Monitoring

- **Chat UI**: `/admin/agentChat` — real-time conversation with each agent
- **Virtual Office**: `/admin/virtualOffice` — see live execution pipeline and agent status
  - Hover over agent desk to see current task steps
  - Click "Task History" to see completed pipelines
- **Firebase Console**: Check `agent-commands` collection for message history
- **Agent Logs**: Terminal output from the runner process

## Troubleshooting

| Problem | Fix |
|---|---|
| Message stuck on "Thinking..." | Agent runner may not be running — check terminal |
| Agent shows "Offline" | Restart the runner: `AGENT_ID=nora AGENT_NAME="Nora ⚡" node scripts/agentRunner.js` |
| `No tasks found` | Assign a kanban task to the agent, or send a `--type task` message |
| Index errors | Run `firebase deploy --only firestore:indexes` |
| Auth errors | Runner uses embedded service account — should just work. Check Firebase Console if creds are rotated |
| Messages auto-failing | Agent is offline. Start the runner first, then resend |
