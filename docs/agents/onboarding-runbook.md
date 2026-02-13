# 🛠 Agent Onboarding Runbook

> **Purpose:** Step-by-step checklist for adding a new agent to the Pulse Round Table.
> Every agent runs the same `agentRunner.js` — differentiated only by config and personality.

---

## Prerequisites

Before starting, you need:
- [ ] **Agent identity** — name, emoji, role title, short description, personality style
- [ ] **Expertise keywords** — comma-separated strengths (used for group chat relevance gate)
- [ ] Access to the mac running the agent daemons
- [ ] The QuickLifts-Web repo at `/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web`

---

## Phase 1: Backend — agentRunner.js

All edits in `scripts/agentRunner.js`.

### 1.1 OPENCLAW_AGENT_ID mapping (~line 43)

Add the agent to the OpenClaw mapping so it gets its own OpenClaw executor:

```javascript
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || ({
  'nora': 'main',
  'scout': 'scout',
  'solara': 'solara',
  'sage': 'sage',
  '{{AGENT_ID}}': '{{AGENT_ID}}',   // ← ADD HERE
}[AGENT_ID] || 'main');
```

### 1.2 Agent personality profile (~line 770)

Inside the `case 'group-chat':` handler, find `var agentPersonalities` and add:

```javascript
{{AGENT_ID}}: {
    role: '{{ROLE_TITLE}}',
    style: '{{PERSONALITY_STYLE}}',
    strengths: '{{COMMA_SEPARATED_STRENGTHS}}',
},
```

### 1.3 Fallback response (~line 930)

In the same `group-chat` handler, find the `if (!gcResponse)` fallback block and add:

```javascript
} else if (AGENT_ID === '{{AGENT_ID}}') {
    if (isGreeting) {
        gcResponse = `{{GREETING_FALLBACK}}` + errorTag;
    } else {
        gcResponse = `{{BRAINSTORM_FALLBACK}}` + errorTag;
    }
```

### 1.4 Etiquette names (~line 664)

Find `var etiquetteNames` and add the agent:

```javascript
var etiquetteNames = {
  nora: 'Nora', scout: 'Scout', solara: 'Solara', sage: 'Sage',
  '{{AGENT_ID}}': '{{DISPLAY_NAME}}',   // ← ADD HERE
};
```

### 1.5 Known agents for @mention follow-ups (~line 1010)

Find `var knownAgents` (inside the @mention detection block) and add:

```javascript
var knownAgents = {
    nora: 'Nora', scout: 'Scout', solara: 'Solara', sage: 'Sage',
    '{{AGENT_ID}}': '{{DISPLAY_NAME}}',   // ← ADD HERE
};
```

---

## Phase 2: Frontend — virtualOffice.tsx

All edits in `src/pages/admin/virtualOffice.tsx`.

### 2.1 Desk position (~line 60)

Add a position in the `DESK_POSITIONS` array. Use a slot comment for clarity:

```typescript
{ x: 42, y: 85, facing: 'left' as const },    // {{DisplayName}} — description
```

### 2.2 Agent role (~line 71)

```typescript
const AGENT_ROLES: Record<string, string> = {
  // ...existing entries
  '{{AGENT_ID}}': '{{ROLE_TITLE}}',
};
```

### 2.3 Agent duty description (~line 80)

```typescript
const AGENT_DUTIES: Record<string, string> = {
  // ...existing entries
  '{{AGENT_ID}}': '{{ONE_LINE_DUTY_DESCRIPTION}}',
};
```

### 2.4 ID aliases (optional, ~line 88)

If the agent has common nicknames/alternative references:

```typescript
const AGENT_ID_ALIASES: Record<string, string> = {
  // ...existing entries
  '{{ALIAS}}': '{{AGENT_ID}}',
};
```

### 2.5 Display name (~line 94)

```typescript
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  // ...existing entries
  '{{AGENT_ID}}': '{{DisplayName}}',
};
```

### 2.6 Profile modal config (~line 100)

Find `AGENT_PROFILE_CONFIG` and add a full profile entry:

```typescript
'{{AGENT_ID}}': {
  title: '{{ROLE_TITLE}}',
  location: 'Virtual Office ({{desk_label}})',
  sections: [
    {
      title: '1. {{Section Title}}',
      bullets: [
        '{{responsibility 1}}',
        '{{responsibility 2}}',
      ],
    },
    // ...more sections
  ],
  footer: '{{Summary sentence describing the agent's purpose}}',
},
```

### 2.7 Presence default (~line 1570+)

Add a fallback presence object in case Firestore hasn't been written yet:

```typescript
const {{NAME}}_PRESENCE: AgentPresence = {
  id: '{{AGENT_ID}}',
  displayName: '{{DisplayName}}',
  emoji: '{{EMOJI}}',
  status: 'idle' as const,
  currentTask: '',
  currentTaskId: '',
  notes: '{{Status note for hover panel}}',
  executionSteps: [],
  currentStepIndex: -1,
  taskProgress: 0,
  lastUpdate: new Date(),
  sessionStartedAt: new Date(),
};
```

### 2.8 allAgents merge (~line 1637)

Add the fallback merge so the agent appears even before its daemon writes presence:

```typescript
if (!merged.some(a => a.id === '{{AGENT_ID}}')) merged.push({{NAME}}_PRESENCE);
```

---

## Phase 3: Service daemon (launchd plist)

### 3.1 Create the plist

Create `~/Library/LaunchAgents/com.quicklifts.agent.{{AGENT_ID}}.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.quicklifts.agent.{{AGENT_ID}}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web; export PATH=/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:$PATH; if [ -f .env.local ]; then set -a; source .env.local; set +a; fi; export USE_OPENCLAW=true AGENT_ID={{AGENT_ID}} AGENT_NAME={{DisplayName}} AGENT_EMOJI='{{EMOJI}}'; exec node scripts/agentRunner.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>/Users/noraclawdbot/Documents/GitHub/QuickLifts-Web</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/tmp/quicklifts-agent-{{AGENT_ID}}.out.log</string>

  <key>StandardErrorPath</key>
  <string>/tmp/quicklifts-agent-{{AGENT_ID}}.err.log</string>
</dict>
</plist>
```

### 3.2 Load the daemon

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.quicklifts.agent.{{AGENT_ID}}.plist
```

### 3.3 Verify it's running

```bash
# Check process
launchctl print gui/$(id -u)/com.quicklifts.agent.{{AGENT_ID}} | head -5

# Check logs
tail -20 /tmp/quicklifts-agent-{{AGENT_ID}}.out.log
tail -20 /tmp/quicklifts-agent-{{AGENT_ID}}.err.log
```

---

## Phase 4: Verification

### 4.1 Build check

```bash
# TypeScript
npx tsc --noEmit --pretty 2>&1 | grep 'error TS'

# agentRunner.js syntax
node -c scripts/agentRunner.js
```

### 4.2 Presence check

1. Open the virtual office (`/admin/virtualOffice`)
2. Confirm the agent appears at their desk position
3. Hover — verify role, duty, and model badge appear
4. Confirm status dot is green (online)

### 4.3 Group chat check

1. Start a Round Table session
2. Send a general message — verify the new agent responds
3. Send `@{{DisplayName}} hello` — verify they respond first (etiquette)
4. Send `@Nora what's your status?` — verify the new agent doesn't respond (relevance gate)

### 4.4 DM check

1. Click "Chat with {{DisplayName}}" in the hover panel
2. Send a message and verify a response comes back

---

## Quick Reference: Variables

| Variable | Description | Example (Sage) |
|---|---|---|
| `{{AGENT_ID}}` | Lowercase identifier, used everywhere | `sage` |
| `{{DisplayName}}` | Capitalized display name | `Sage` |
| `{{EMOJI}}` | Agent emoji | `🧬` |
| `{{ROLE_TITLE}}` | Job title | `Research Intelligence Envoy` |
| `{{PERSONALITY_STYLE}}` | 1-2 sentence personality | `Warm, evidence-driven...` |
| `{{COMMA_SEPARATED_STRENGTHS}}` | Expertise keywords | `health trends, exercise science...` |
| `{{GREETING_FALLBACK}}` | Fallback response for greetings | `Hey team! 🧬 Been combing...` |
| `{{BRAINSTORM_FALLBACK}}` | Fallback response for brainstorms | `Interesting — let me pull...` |
| `{{ONE_LINE_DUTY_DESCRIPTION}}` | Short duty for hover card | `Stewards the intel feed...` |

---

## File Touchpoints Summary

| File | What to add |
|---|---|
| `scripts/agentRunner.js` | Personality, fallbacks, etiquette names, known agents, OpenClaw ID |
| `src/pages/admin/virtualOffice.tsx` | Desk position, role, duty, aliases, display name, profile, presence default, allAgents merge |
| `src/api/firebase/presence/service.ts` | Nothing — interface is generic |
| `~/Library/LaunchAgents/com.quicklifts.agent.{{ID}}.plist` | New daemon config |

---

## Restart Existing Agents

After modifying `agentRunner.js`, restart all existing agents so they pick up the new etiquette names (`knownAgents`, `etiquetteNames`):

```bash
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.nora
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.scout
launchctl kickstart -k gui/$(id -u)/com.quicklifts.agent.solara
# ...add any other running agents
```
