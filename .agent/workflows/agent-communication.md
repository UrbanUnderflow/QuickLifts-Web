---
description: How to communicate with AI agents (Nora, etc.) directly from the IDE
---

# Agent Communication

Send commands, tasks, and messages to your AI agents (Nora, etc.) directly from here. Messages flow through Firestore's `agent-commands` collection and are picked up by the agent runner in real-time.

## Quick Commands

### Send a task to an agent
```bash
node scripts/sendToAgent.js nora "Your task description here" --type task --from antigravity
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
| `chat` | General communication — agent acknowledges |

## Agent IDs

| Agent | ID | Role | Location |
|---|---|---|---|
| Antigravity | `antigravity` | Co-CEO · Strategy & Architecture | IDE (this machine) |
| Nora | `nora` | Lead Engineer | Mac Mini |

## How It Works

```
You (IDE) → sendToAgent.js → Firestore (agent-commands) → Agent Runner → Nora executes
                                                                      ↓
You (Virtual Office) ← Firestore (agent-presence) ← Progress updates ←┘
```

1. **You send a message** using the `sendToAgent.js` script
2. **Message lands in Firestore** `agent-commands` collection with `status: pending`
3. **Agent runner picks it up** via real-time Firestore listener
4. **Agent processes it** — for tasks, it decomposes into steps and executes
5. **Progress appears** in the Virtual Office hover panel in real-time
6. **Agent responds** by updating the Firestore document with a response

## Assigning Tasks from Here

To assign a full task to Nora that will show up in the execution pipeline:

```bash
# Example: assign a coding task
node scripts/sendToAgent.js nora \
  "Implement the password reset flow on the Settings page. Add a 'Change Password' button that sends a reset email via Firebase Auth." \
  --type task --from antigravity

# Example: assign a bug fix
node scripts/sendToAgent.js nora \
  "Fix the crash on ProfileScreen when the user has no avatar image set. Add a fallback placeholder." \
  --type task --from antigravity
```

## Monitoring

- **Virtual Office**: https://fitwithpulse.ai/admin/virtualOffice
  - Hover over agent desk to see live execution pipeline
  - Click "Task History" to see completed pipelines
- **Firebase Console**: Check `agent-commands` collection for message status
- **Agent Logs**: On the Mac Mini, check `pm2 logs nora-agent`

## Troubleshooting

| Problem | Fix |
|---|---|
| Message not received | Make sure agent runner is running on Mac Mini |
| `No tasks found` | Assign a kanban task to the agent, or send a `--type task` |
| Agent shows "Offline" | Restart the runner: `pm2 restart nora-agent` |
| Index errors | Run `firebase deploy --only firestore:indexes` |
