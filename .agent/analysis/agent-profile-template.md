# Agent Profile Template - Extracted from Scout

This document provides a complete template for creating agent presence card profiles in the Virtual Office, based on Scout's existing configuration.

---

## Complete Profile Structure for Agent: Scout

### 1. Desk Position (DESK_POSITIONS Array)
**Array Index:** 2 (third position, 0-indexed)
**Location in File:** Line ~48

```typescript
{ x: 12, y: 70, facing: 'right' }
```

**Fields:**
- `x`: number (horizontal position, 0-100 scale)
- `y`: number (vertical position, 0-100 scale)  
- `facing`: 'left' | 'right' (direction agent faces)

**Visual Location:** Far left, lower position in office

---

### 2. Agent Role (AGENT_ROLES Object)
**Location in File:** Line ~55

```typescript
scout: 'Influencer Research Analyst'
```

**Fields:**
- Key: agentId (lowercase)
- Value: Job title string (can include special chars like ·)

---

### 3. Agent Duties (AGENT_DUTIES Object)
**Location in File:** Line ~62

```typescript
scout: 'Runs outbound influencer discovery workflows, researches creator fit and engagement quality, and prepares qualified prospects for CRM intake.'
```

**Fields:**
- Key: agentId (lowercase)
- Value: Duties description (1-2 sentence summary of primary responsibilities)

**Format Pattern:**
- Active voice verbs (Runs, researches, prepares)
- Comma-separated list of duties
- Focused on key responsibilities
- ~100-200 characters

---

### 4. Agent ID Aliases (AGENT_ID_ALIASES Object)
**Location in File:** Line ~68

```typescript
// Scout doesn't have aliases defined
// Example from other agents:
// branddirector: 'solara',
```

**Optional:** Only needed if agent has alternative IDs

---

### 5. Display Name (AGENT_DISPLAY_NAMES Object)
**Location in File:** Line ~74

```typescript
scout: 'Scout'
```

**Fields:**
- Key: agentId (lowercase)
- Value: Display name (typically capitalized, can match agentId)

---

### 6. Emoji Default (AGENT_EMOJI_DEFAULTS Object)
**Location in File:** Line ~82

```typescript
scout: '🕵️'
```

**Fields:**
- Key: agentId (lowercase)
- Value: Single emoji character

**Purpose:** Used as visual identifier in presence cards and modals

---

### 7. Full Profile (AGENT_PROFILES Object)
**Location in File:** Line ~250+

```typescript
scout: {
  title: 'Influencer Research Analyst',
  location: 'Virtual Office (research desk)',
  sections: [
    {
      title: '1. Discovery Scope',
      bullets: [
        'Research runner-focused creators and shortlist profiles with strong audience engagement.',
        'Prioritize creators aligned with Pulse goals and current campaign filters.',
      ],
    },
    {
      title: '2. Qualification Workflow',
      bullets: [
        'Capture creator handle, niche, engagement signals, and fit rationale.',
        'Prepare structured records that can be inserted into the CRM pipeline.',
      ],
    },
    {
      title: '3. Reporting Cadence',
      bullets: [
        'Provide concise recaps of candidates discovered, confidence level, and recommended next actions.',
      ],
    },
  ],
  footer: 'Scout is the focused research specialist for creator discovery and qualification workflows.',
}
```

**Structure:**
```typescript
{
  title: string;           // Job title (matches AGENT_ROLES)
  location: string;        // Physical/virtual location description
  sections: ProfileSection[];  // Array of duty sections
  footer?: string;         // Optional closing statement/creed
}

interface ProfileSection {
  title: string;           // Section heading (numbered: "1. Title", "2. Title", etc.)
  bullets: string[];       // Array of bullet point descriptions
}
```

**Pattern for Sections:**
- 3-5 sections typical
- Numbered titles (1. Title, 2. Title, etc.)
- 1-3 bullets per section
- Bullets are detailed sentences describing specific responsibilities
- Optional footer with agent's creed/summary

---

## Complete Checklist for Adding New Agent

To add a new agent to the Virtual Office, you must update **7 data structures**:

### Required Updates:

1. ✅ **DESK_POSITIONS** (Array)
   - Add position object: `{ x, y, facing }`
   - Choose available desk slot (0-5)

2. ✅ **AGENT_ROLES** (Record)
   - Add: `agentId: 'Job Title'`

3. ✅ **AGENT_DUTIES** (Record)
   - Add: `agentId: 'Brief duties description'`

4. ✅ **AGENT_DISPLAY_NAMES** (Record)
   - Add: `agentId: 'DisplayName'`

5. ✅ **AGENT_EMOJI_DEFAULTS** (Record)
   - Add: `agentId: '🎭'`

6. ✅ **AGENT_PROFILES** (Record)
   - Add complete profile object with title, location, sections[], footer?

7. ⚠️ **AGENT_ID_ALIASES** (Optional, Record)
   - Only if agent has alternative IDs

---

## Naming Conventions

### Agent IDs
- **Format:** Lowercase, single word
- **Examples:** `antigravity`, `nora`, `scout`, `solara`, `sage`

### Display Names
- **Format:** Capitalized proper name
- **Examples:** `Antigravity`, `Nora`, `Scout`, `Solara`, `Sage`

### Role Titles
- **Format:** Title Case, can use · separator
- **Examples:** 
  - `Co-CEO · Strategy & Architecture`
  - `Director of System Ops`
  - `Influencer Research Analyst`
  - `Brand Director`

### Locations
- **Format:** Descriptive phrase
- **Patterns:**
  - `IDE (pair-programming with Tremaine)`
  - `Mac Mini (autonomous runner)`
  - `Virtual Office (research desk)`
  - `Virtual Office (brand strategy desk)`
  - `Virtual Office (intel desk)`

---

## Visual Layout Reference

### Desk Positions (x, y coordinates on 0-100 scale)

```
     [Antigravity]                              [Nora]
      (12, 35) →                             ← (75, 30)
                      
                      [Sage]
                    ← (42, 22)


     [Scout]                                  [Solara]
      (12, 70) →                             ← (75, 70)
                      
                    [Available]
                     (42, 85) ←
```

**Pattern:**
- Left side (x: 12): Faces right (→)
- Right side (x: 75): Faces left (←)
- Center (x: 42): Can face either direction

---

## Example: Complete New Agent Template

```typescript
// 1. DESK_POSITIONS (choose available slot)
{ x: 42, y: 85, facing: 'left' }  // slot 5

// 2. AGENT_ROLES
newagent: 'Job Title Here'

// 3. AGENT_DUTIES
newagent: 'Primary duty, secondary duty, and tertiary responsibility in clear, active voice.'

// 4. AGENT_DISPLAY_NAMES
newagent: 'NewAgent'

// 5. AGENT_EMOJI_DEFAULTS
newagent: '🎯'

// 6. AGENT_PROFILES
newagent: {
  title: 'Job Title Here',
  location: 'Virtual Office (specialty desk)',
  sections: [
    {
      title: '1. Core Responsibility',
      bullets: [
        'First key duty explained in detail.',
        'Second aspect of this responsibility.',
      ],
    },
    {
      title: '2. Secondary Focus',
      bullets: [
        'Another major area of work.',
        'Related tasks and outcomes.',
      ],
    },
    {
      title: '3. Collaboration & Delivery',
      bullets: [
        'How this agent works with the team.',
        'What they deliver and when.',
      ],
    },
  ],
  footer: 'Optional creed or summary statement about the agent\'s approach.',
}

// 7. AGENT_ID_ALIASES (optional)
alternativeid: 'newagent'
```

---

## Validation Checklist

After adding a new agent, verify:

- [ ] Agent ID is lowercase, no spaces
- [ ] Display name is capitalized
- [ ] Emoji renders correctly (single character)
- [ ] Role title matches between AGENT_ROLES and AGENT_PROFILES.title
- [ ] Desk position coordinates are within 0-100 range
- [ ] Profile has 2-5 sections with numbered titles
- [ ] All bullets are complete sentences
- [ ] Footer (if present) provides clear summary/creed
- [ ] Duties description is concise (1-2 sentences)

---

## Current Agent Summary (for reference)

| Agent ID | Display Name | Emoji | Role | Desk Position | Sections |
|----------|--------------|-------|------|---------------|----------|
| antigravity | Antigravity | 🌌 | Co-CEO · Strategy & Architecture | (12, 35) → | 5 |
| nora | Nora | ⚡️ | Director of Systems Operations | (75, 30) ← | 6 |
| scout | Scout | 🕵️ | Influencer Research Analyst | (12, 70) → | 3 |
| solara | Solara | ❤️‍🔥 | Brand Director | (75, 70) ← | 4 |
| sage | Sage | 🧬 | Research Intelligence Envoy | (42, 22) → | 3 |

**Available Desk Slot:** Position 5 - (42, 85) facing left

---

## File Location

All these data structures are defined in:
`src/pages/admin/virtualOffice.tsx`

Lines approximately:
- DESK_POSITIONS: ~48
- AGENT_ROLES: ~55
- AGENT_DUTIES: ~62
- AGENT_ID_ALIASES: ~68
- AGENT_DISPLAY_NAMES: ~74
- AGENT_EMOJI_DEFAULTS: ~82
- AGENT_PROFILES: ~150+

---

_Template extracted from Scout's configuration in virtualOffice.tsx_
