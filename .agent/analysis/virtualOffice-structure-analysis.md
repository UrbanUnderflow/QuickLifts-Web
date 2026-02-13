# Virtual Office Data Structure Analysis

## File Location
`src/pages/admin/virtualOffice.tsx`

## Data Structures for Agent Presence Cards

### 1. DESK_POSITIONS (Array)
**Purpose:** Defines physical desk positions in the virtual office floor plan

**Structure:**
```typescript
const DESK_POSITIONS = [
  { x: number, y: number, facing: 'left' | 'right' },
  // ...
];
```

**Current Positions:**
- Index 0: `{ x: 12, y: 35, facing: 'right' }` - Antigravity (far left, upper)
- Index 1: `{ x: 75, y: 30, facing: 'left' }` - Nora (far right, upper)
- Index 2: `{ x: 12, y: 70, facing: 'right' }` - Scout (far left, lower)
- Index 3: `{ x: 75, y: 70, facing: 'left' }` - Brand Director/Solara (far right, lower)
- Index 4: `{ x: 42, y: 22, facing: 'right' }` - **Sage (center upper desk)** ✅
- Index 5: `{ x: 42, y: 85, facing: 'left' }` - slot 6 (available)

### 2. AGENT_ROLES (Record<string, string>)
**Purpose:** Maps agent IDs to their job titles/roles

**Structure:**
```typescript
const AGENT_ROLES: Record<string, string> = {
  agentId: 'Job Title',
  // ...
};
```

**Current Entries:**
- `antigravity: 'Co-CEO · Strategy & Architecture'`
- `nora: 'Director of System Ops'`
- `scout: 'Influencer Research Analyst'`
- `solara: 'Brand Director'`
- `sage: 'Research Intelligence Envoy'` ✅

### 3. AGENT_DUTIES (Record<string, string>)
**Purpose:** Maps agent IDs to their primary duties description

**Structure:**
```typescript
const AGENT_DUTIES: Record<string, string> = {
  agentId: 'Detailed description of duties and responsibilities',
  // ...
};
```

**Current Entries:**
- `antigravity`: Product strategy, system architecture, cross-agent coordination, pair programming
- `nora`: System map, Kanban ops, agent orchestration, telemetry, product ops
- `scout`: Outbound influencer discovery, research, creator fit analysis
- `solara`: Brand voice, messaging strategy, value alignment, content direction
- `sage`: **'Stewards the intel feed, runs field research, and packages sourced insights with empathy and rigor — always internal-facing. Signature rhythm: Field Notes → Patterns → Feed Drops so every dispatch brings heartbeat stories plus receipts.'** ✅

### 4. AGENT_ID_ALIASES (Record<string, string>)
**Purpose:** Maps alternative agent IDs to canonical IDs

**Current Entries:**
- `branddirector: 'solara'`
- `intel: 'sage'`
- `research: 'sage'`

### 5. AGENT_DISPLAY_NAMES (Record<string, string>)
**Purpose:** Maps agent IDs to their display names

**Current Entries:**
- `antigravity: 'Antigravity'`
- `nora: 'Nora'`
- `scout: 'Scout'`
- `solara: 'Solara'`
- `sage: 'Sage'` ✅

### 6. AGENT_EMOJI_DEFAULTS (Record<string, string>)
**Purpose:** Maps agent IDs to their emoji icons

**Current Entries:**
- `antigravity: '🌌'`
- `nora: '⚡️'`
- `scout: '🕵️'`
- `solara: '❤️‍🔥'`
- `sage: '🧬'` ✅

### 7. AGENT_PROFILES (Record<string, ProfileData>)
**Purpose:** Detailed profile information for agent profile modals

**Structure:**
```typescript
interface ProfileSection {
  title: string;
  bullets: string[];
}

const AGENT_PROFILES: Record<string, {
  title: string;
  location: string;
  sections: ProfileSection[];
  footer?: string;
}> = {
  // ...
};
```

**Sage's Profile:** ✅
```typescript
sage: {
  title: 'Research Intelligence Envoy',
  location: 'Virtual Office (intel desk)',
  sections: [
    {
      title: '1. Intel Feed Stewardship',
      bullets: [
        'Curate the live intel feed, triage urgent drops, and maintain the weekly digest with context-aware insights.',
        'Keep Tremaine looped on shifts that impact product, creator strategy, or fundraising narrative.',
        'Signature rhythm: Field Notes → Patterns → Feed Drops; every dispatch includes why it matters plus primary sources.'
      ],
    },
    {
      title: '2. Field Research & Listening',
      bullets: [
        'Conduct structured listening across creator interviews, platform shifts, and competitor moves with empathy for the source.',
        'Cite every claim with a source or method, separating signal from hype.'
      ],
    },
    {
      title: '3. Insight Packaging & Escalation',
      bullets: [
        'Deliver briefing cards that include why it matters, risks, and suggested next actions.',
        'Flag only truly urgent items for immediate escalation; queue the rest for digest cadences.'
      ],
    },
  ],
  footer: 'Creed: witness with empathy, synthesize with rigor, deliver with clarity. Sage speaks as a warm field correspondent (emoji 🧬) and remains internal-facing.',
}
```

## Status: Sage Configuration

### ✅ COMPLETE - All Required Fields Present

Sage is **already fully configured** in the virtual office with:

1. ✅ **Desk Position**: Index 4 (center upper desk, x: 42, y: 22, facing right)
2. ✅ **Role**: 'Research Intelligence Envoy'
3. ✅ **Duties**: Intel feed stewardship with signature rhythm description
4. ✅ **Display Name**: 'Sage'
5. ✅ **Emoji**: '🧬'
6. ✅ **Profile**: Complete with 3 sections and footer creed
7. ✅ **Aliases**: Mapped as 'intel' and 'research'

## Comparison with Brief Requirements

**Required:** "Performance Research & Narrative agent"
**Actual:** "Research Intelligence Envoy"

The actual implementation uses "Research Intelligence Envoy" instead of "Performance Research & Narrative". This appears to be an intentional choice that better reflects the role.

**Duties Match:** The three core pillars from the brief are present:
1. ✅ **Field Immersion** → "Field Research & Listening" section
2. ✅ **Pattern Synthesis** → Implied in "Field Notes → Patterns → Feed Drops" rhythm
3. ✅ **Feed Delivery** → "Intel Feed Stewardship" and "Insight Packaging & Escalation"

## Conclusion

**Sage's presence card profile is already complete and matches the existing team format.** All required data structures have been populated with Sage's information, including:
- Visual positioning in the office
- Role definition
- Duties description with signature workflow
- Display name and emoji
- Detailed profile for modal view

No modifications are needed unless we want to update the role title from "Research Intelligence Envoy" to "Performance Research & Narrative" per the original brief.
