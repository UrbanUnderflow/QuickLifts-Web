---
description: How to manage agent infrastructure (launchd services, logs, OpenClaw setup, provisioning new agents)
---

# Agent Infrastructure Operations

## Architecture Overview

Each agent runs as a macOS launchd service that executes `node scripts/agentRunner.js` with specific environment variables.

## Agent Registry

| Agent | Service Label | OpenClaw Agent ID |
|-------|--------------|-------------------|
| Nora  | `com.quicklifts.agent.nora` | `main` |
| Scout | `com.quicklifts.agent.scout` | `scout` |
| Solara | `com.quicklifts.agent.solara` | `solara` |
| Sage  | `com.quicklifts.agent.sage` | `sage` |

## File Locations

- **Plist files:** `/Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.agent.{name}.plist`
- **Agent runner script:** `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/scripts/agentRunner.js`
- **stdout logs:** `/tmp/quicklifts-agent-{name}.out.log`
- **stderr logs:** `/tmp/quicklifts-agent-{name}.err.log`
- **OpenClaw binary:** `/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin/openclaw`
- **OpenClaw workspaces:** `~/.openclaw/workspace-{name}` (e.g., `~/.openclaw/workspace-sage`)
- **Environment file:** `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/.env.local`
- **Workflows dir:** `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web/.agent/workflows/`

## Reading Agent Logs

// turbo
```bash
# View recent stdout
tail -100 /tmp/quicklifts-agent-{name}.out.log

# View recent stderr
tail -100 /tmp/quicklifts-agent-{name}.err.log

# Follow logs in real-time
tail -f /tmp/quicklifts-agent-{name}.out.log
```

## Checking Agent Status

// turbo
```bash
# Check if a specific agent is running
launchctl list | grep quicklifts.agent.{name}

# Check all agents
launchctl list | grep quicklifts
```

## Restarting an Agent

```bash
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.{name}
```

## Provisioning a New Agent

To add a new agent (e.g., "sage"):

### 1. Create the plist file

Create `/Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.agent.{name}.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.quicklifts.agent.{name}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web; export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:$PATH; if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; export USE_OPENCLAW=true AGENT_ID={name} AGENT_NAME={Name}; exec node scripts/agentRunner.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/quicklifts-agent-{name}.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/quicklifts-agent-{name}.err.log</string>
</dict>
</plist>
```

### 2. Load the service

```bash
launchctl load /Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.agent.{name}.plist
```

### 3. Verify it's running

// turbo
```bash
launchctl list | grep quicklifts.agent.{name}
tail -5 /tmp/quicklifts-agent-{name}.out.log
```

### 4. Check heartbeat in Firestore

The agent should appear in the `agent-presence/{name}` Firestore document with `status: 'idle'` within 10 seconds.

## OpenClaw Commands Reference

```bash
# List all configured agents
openclaw agents list

# Check OpenClaw version
openclaw --version

# Get agent status
openclaw agent --agent {openclaw_agent_id} --local --message "status" --timeout 30

# Run an agent turn
openclaw agent --agent {openclaw_agent_id} --local --message "YOUR PROMPT" --timeout 600
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Agent not appearing | Plist not loaded | `launchctl load /Users/noraclawdbot/Library/LaunchAgents/com.quicklifts.agent.{name}.plist` |
| Agent showing offline | Process crashed | Check stderr log: `tail -50 /tmp/quicklifts-agent-{name}.err.log` |
| "command not found" in logs | PATH not set | Ensure plist includes the PATH export with node binary location |
| Step stalls at 120s | OpenClaw timeout/stall | Check OpenClaw workspace health: `openclaw agents list` |
| Agent can't pick up tasks | AGENT_ID mismatch | Verify `AGENT_ID={name}` matches Firestore kanban `assignee` field |
