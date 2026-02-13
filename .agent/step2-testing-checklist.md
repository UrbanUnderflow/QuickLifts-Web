# Step 2: Testing Checklist - Sage Presence Card Verification

**Purpose:** Browser-based verification that Sage's presence card renders correctly and matches team format

---

## Pre-Test Setup

### 1. Start Development Server

```bash
cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web
npm run dev
```

Wait for: `✓ Ready on http://localhost:3000`

### 2. Navigate to Virtual Office

Open browser to: `http://localhost:3000/admin/virtualOffice`

Expected: Virtual office floor plan loads with agent desks

---

## Visual Verification Checklist

### A. Desk Position ✅ Expected

- [ ] **Sage desk appears at center upper position**
  - Position should be between left and right columns
  - Higher up than Scout/Solara (lower desks)
  - Below or level with Nora/Antigravity (upper desks)

- [ ] **Desk furniture renders correctly**
  - Desk surface visible
  - Desk legs visible
  - Monitor present
  - Chair present
  - Status glow visible (color depends on status)

- [ ] **Character avatar is present**
  - Small character sprite at desk
  - Animated if status is "working"
  - Static if status is "idle"

---

### B. Nameplate Display ✅ Expected

- [ ] **Display name shows:** "Sage"
  - Font matches other agents
  - Proper capitalization
  - No truncation

- [ ] **Role title shows:** "Research Intelligence Envoy"
  - Appears below name
  - Smaller font size
  - Gray color (muted)
  - Full text visible

- [ ] **Status indicator present**
  - Colored dot next to name
  - Color matches agent status (green=working, blue=idle, etc.)

- [ ] **Progress indicator** (if agent is working)
  - Percentage value displayed
  - Updates in real-time

---

### C. Hover Panel (Mouse Over Sage's Desk) ✅ Expected

When hovering over Sage's desk, a detail panel should appear with:

#### Header Section
- [ ] **Emoji displays:** 🧬 (DNA helix)
  - Renders correctly (no broken emoji)
  - Proper size (~16-20px)
  - Left-aligned with name

- [ ] **Display name:** "Sage"
  - White color
  - Bold font
  - Aligned with emoji

- [ ] **Status badge**
  - Text shows current status ("Idle", "Working", etc.)
  - Colored pill/badge style
  - Right-aligned

#### Duty Section (Clickable)
- [ ] **Role title shows:** "Research Intelligence Envoy"
  - Indigo/purple color
  - Smaller uppercase/semibold font
  - Matches AGENT_ROLES entry

- [ ] **Duty description visible:**
  ```
  Stewards the intel feed, runs field research, and packages sourced 
  insights with empathy and rigor — always internal-facing. Signature 
  rhythm: Field Notes → Patterns → Feed Drops so every dispatch brings 
  heartbeat stories plus receipts.
  ```
  - Full text displayed (no truncation)
  - Gray color (readable)
  - Line breaks natural

- [ ] **"View full profile" link**
  - Small text with external link icon
  - Indigo/blue color
  - Indicates clickability

#### Additional Info
- [ ] **Current task** (if any)
  - Task text displayed
  - Progress bar if working
  - Execution steps if available

- [ ] **Session info**
  - Session duration displayed
  - Last update timestamp

---

### D. Profile Modal (Click on Hover Panel) ✅ Expected

Click "View full profile" in hover panel. Modal should open showing:

#### Modal Header
- [ ] **Title:** "Research Intelligence Envoy"
  - Large, bold font
  - Top of modal

- [ ] **Location:** "Virtual Office (intel desk)"
  - Below title
  - Smaller, muted text

- [ ] **Close button (X)**
  - Top right corner
  - Functional (closes modal)

#### Section 1: Intel Feed Stewardship
- [ ] **Section title:** "1. Intel Feed Stewardship"
  - Numbered
  - Bold font
  - Proper spacing

- [ ] **Three bullets visible:**
  1. "Curate the live intel feed, triage urgent drops, and maintain the weekly digest with context-aware insights."
  2. "Keep Tremaine looped on shifts that impact product, creator strategy, or fundraising narrative."
  3. "Signature rhythm: Field Notes → Patterns → Feed Drops; every dispatch includes why it matters plus primary sources."

- [ ] **Bullet formatting consistent**
  - Proper indentation
  - Readable spacing
  - Complete text visible

#### Section 2: Field Research & Listening
- [ ] **Section title:** "2. Field Research & Listening"
  - Numbered sequentially
  - Same style as Section 1

- [ ] **Two bullets visible:**
  1. "Conduct structured listening across creator interviews, platform shifts, and competitor moves with empathy for the source."
  2. "Cite every claim with a source or method, separating signal from hype."

#### Section 3: Insight Packaging & Escalation
- [ ] **Section title:** "3. Insight Packaging & Escalation"
  - Numbered sequentially
  - Same style as previous sections

- [ ] **Two bullets visible:**
  1. "Deliver briefing cards that include why it matters, risks, and suggested next actions."
  2. "Flag only truly urgent items for immediate escalation; queue the rest for digest cadences."

#### Footer Statement
- [ ] **Footer text visible:**
  ```
  Creed: witness with empathy, synthesize with rigor, deliver with 
  clarity. Sage speaks as a warm field correspondent (emoji 🧬) and 
  remains internal-facing.
  ```
  - Italicized or visually distinct
  - Bottom of modal
  - Complete text displayed

---

### E. Visual Consistency with Other Agents

Compare Sage to Scout, Nora, and Solara:

#### Desk Appearance
- [ ] Desk furniture style matches
- [ ] Status glow effect similar
- [ ] Character sprite consistent
- [ ] Monitor design identical

#### Nameplate Style
- [ ] Font family matches
- [ ] Text sizing consistent
- [ ] Color scheme aligned
- [ ] Layout identical

#### Hover Panel Style
- [ ] Background color matches
- [ ] Border/shadow identical
- [ ] Typography consistent
- [ ] Spacing/padding aligned
- [ ] Icon sizes match

#### Modal Style
- [ ] Background overlay identical
- [ ] Modal size/proportions consistent
- [ ] Header styling matches
- [ ] Section formatting aligned
- [ ] Footer style consistent
- [ ] Close button identical

---

### F. Interactive Behavior

#### Hover Interactions
- [ ] **Hover on desk**
  - Panel appears smoothly
  - Transitions are smooth (no jank)
  - Panel positioned correctly (not cut off)

- [ ] **Hover off desk**
  - Panel stays visible briefly (linger effect)
  - Fades out smoothly after ~500ms

- [ ] **Click outside panel**
  - Panel closes immediately

#### Modal Interactions
- [ ] **Click "View full profile"**
  - Modal opens smoothly
  - Background darkens (overlay)
  - Modal centers on screen

- [ ] **Click X button**
  - Modal closes smoothly
  - Returns to office view

- [ ] **Click outside modal**
  - Modal closes
  - Background click doesn't affect office

- [ ] **Scroll modal content**
  - Content scrolls if needed
  - Scrollbar appears if content long

---

### G. Mobile/Responsive Behavior (Optional)

If testing on smaller screens:

- [ ] Desk positions adapt responsively
- [ ] Nameplate text doesn't overflow
- [ ] Hover panel fits on screen
- [ ] Modal is readable on mobile
- [ ] Touch interactions work (tap to hover)

---

## Cross-Agent Comparison Tests

### Test Each Agent Side-by-Side

Open profiles for Scout, Nora, Solara, and Sage in sequence:

#### Scout vs Sage
- [ ] Both have 3 sections (specialist pattern)
- [ ] Footer length similar (concise)
- [ ] Bullet count similar (1-3 per section)
- [ ] Professional tone consistent

#### Nora vs Sage
- [ ] Nora has 6 sections (leader), Sage has 3 (specialist)
- [ ] Nora footer longer (paragraph), Sage medium (sentence)
- [ ] Both have numbered sections
- [ ] Both have functional titles

#### Solara vs Sage
- [ ] Solara has 4 sections, Sage has 3
- [ ] Both have medium footer length
- [ ] Bullet count similar (2-3 per section)
- [ ] Both have personality in footer

#### Visual Uniformity
- [ ] All profiles use same modal design
- [ ] All nameplates use same layout
- [ ] All hover panels use same style
- [ ] All desks use same furniture
- [ ] All emojis render correctly

---

## Bug Testing

### Known Potential Issues

#### Layout Issues
- [ ] Sage desk doesn't overlap other desks
- [ ] Nameplate doesn't extend off-screen
- [ ] Hover panel stays within viewport
- [ ] Modal doesn't clip content

#### Text Issues
- [ ] No text truncation in profile
- [ ] No wrapping issues in bullets
- [ ] Emoji renders (not box/�)
- [ ] Special characters display (→, —, etc.)

#### Animation Issues
- [ ] No flickering on hover
- [ ] Smooth transitions
- [ ] No layout shift when panel appears
- [ ] Modal animation smooth

#### Data Issues
- [ ] All text matches source code
- [ ] No missing sections
- [ ] No duplicate content
- [ ] Footer displays correctly

---

## Browser Compatibility (If Time Permits)

Test in multiple browsers:

### Chrome/Edge
- [ ] All features working
- [ ] Emoji displays correctly
- [ ] Animations smooth

### Firefox
- [ ] All features working
- [ ] Emoji displays correctly
- [ ] Animations smooth

### Safari
- [ ] All features working
- [ ] Emoji displays correctly
- [ ] Animations smooth

---

## Screenshot Documentation

Capture screenshots for documentation:

### Required Screenshots

1. **Office Overview**
   - Full virtual office with all agents
   - Sage visible at center upper position
   - Filename: `sage-office-overview.png`

2. **Sage Desk Close-up**
   - Sage's desk and nameplate
   - Clear view of emoji and role title
   - Filename: `sage-desk-closeup.png`

3. **Hover Panel**
   - Sage's hover detail panel open
   - All sections visible
   - Filename: `sage-hover-panel.png`

4. **Profile Modal**
   - Full profile modal with all 3 sections
   - Footer visible
   - Filename: `sage-profile-modal.png`

5. **Side-by-Side Comparison**
   - Scout and Sage profiles open
   - Show format consistency
   - Filename: `sage-scout-comparison.png`

---

## Test Results Summary Template

```markdown
## Browser Test Results

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Browser:** [Chrome/Firefox/Safari] version X.X
**Device:** [Desktop/Laptop] - [macOS/Windows/Linux]

### Overall Status: [✅ PASS / ⚠️ ISSUES / ❌ FAIL]

### Checklist Results

#### Desk Position: [✅/❌]
- Center upper position: [✅/❌]
- Furniture renders: [✅/❌]
- Character visible: [✅/❌]

#### Nameplate Display: [✅/❌]
- Display name correct: [✅/❌]
- Role title correct: [✅/❌]
- Status indicator: [✅/❌]

#### Hover Panel: [✅/❌]
- Emoji displays (🧬): [✅/❌]
- Duty description: [✅/❌]
- View profile link: [✅/❌]

#### Profile Modal: [✅/❌]
- Section 1 (Intel Feed): [✅/❌]
- Section 2 (Field Research): [✅/❌]
- Section 3 (Insight Packaging): [✅/❌]
- Footer displays: [✅/❌]

#### Visual Consistency: [✅/❌]
- Matches Scout: [✅/❌]
- Matches Nora: [✅/❌]
- Matches Solara: [✅/❌]

### Issues Found

[List any bugs, visual glitches, or inconsistencies]

1. [Issue description]
   - Severity: [High/Medium/Low]
   - Screenshot: [filename]
   - Fix required: [Yes/No]

### Screenshots Captured

- [ ] sage-office-overview.png
- [ ] sage-desk-closeup.png
- [ ] sage-hover-panel.png
- [ ] sage-profile-modal.png
- [ ] sage-scout-comparison.png

### Conclusion

[Brief summary of test results and next steps]
```

---

## Post-Test Actions

After completing all tests:

### If All Tests Pass ✅
1. Mark Step 2 as complete
2. Document test results
3. Save screenshots
4. Proceed to Step 3 (Review and validate)

### If Issues Found ⚠️
1. Document each issue with screenshot
2. Assess severity (blocking vs. minor)
3. Fix issues in code
4. Re-test after fixes
5. Update documentation

### If Major Failures ❌
1. Review code implementation
2. Compare against working agents
3. Debug rendering issues
4. Fix root causes
5. Complete re-test

---

## Time Estimate

**Estimated testing time:** 30-45 minutes

- Setup (5 min)
- Visual verification (15 min)
- Cross-agent comparison (10 min)
- Screenshot capture (5 min)
- Documentation (10 min)

**Note:** Add 15-30 min for bug fixing if issues found

---

## Success Criteria

Step 2 passes if:

✅ Sage desk appears at correct position (center upper)  
✅ Emoji 🧬 displays correctly in all contexts  
✅ All profile sections render with correct content  
✅ Visual style matches Scout/Nora/Solara  
✅ No layout bugs or text truncation  
✅ Interactive behavior works smoothly  
✅ Format consistency is 100%

---

**Checklist created by:** Scout (AI Engineer)  
**Date:** 2024-02-12  
**Purpose:** Comprehensive browser verification  
**Expected result:** ✅ All tests pass (implementation already complete)
