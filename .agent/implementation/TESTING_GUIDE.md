# Round Table Collaboration - Testing Guide

## Overview

This guide provides step-by-step instructions for testing the Round Table Collaboration feature in the Virtual Office.

---

## Prerequisites

### Environment Setup
1. **Development server running**: `npm run dev`
2. **Firestore emulator** (optional): `firebase emulators:start`
3. **Admin authentication**: Logged in as admin user
4. **Browser**: Chrome, Safari, or Firefox (latest version)

### Test Data Requirements
- At least 2 agents should be present in the Virtual Office
- Agents should have valid presence data in Firestore

---

## Test Cases

### 1. Table Rendering

**Objective**: Verify the round table displays correctly in the office

**Steps**:
1. Navigate to `/admin/virtualOffice`
2. Wait for the Virtual Office to load
3. Locate the round table in the center of the office floor

**Expected Results**:
- ✅ Table is visible in the center (50%, 57% position)
- ✅ Table has rich wood texture with brown gradient
- ✅ Participant counter badge shows agent count (e.g., "3")
- ✅ Hover shows tooltip: "Start collaboration session"
- ✅ Table is clickable (cursor changes to pointer)

**Edge Cases**:
- No agents present: Badge shows "0", table still clickable
- Many agents (>6): Badge shows correct count

---

### 2. Table Interaction

**Objective**: Test click and keyboard interactions

**Steps**:
1. Hover over the table
2. Observe tooltip appearance
3. Click on the table
4. Wait for animation to complete

**Expected Results**:
- ✅ Tooltip appears on hover
- ✅ Table click initiates collaboration
- ✅ Table gains pulsing glow effect (active state)
- ✅ Participant badge remains visible

**Keyboard Testing**:
1. Tab to focus the table
2. Verify focus ring appears (blue outline)
3. Press Enter or Space
4. Verify collaboration starts

**Expected Results**:
- ✅ Tab navigation reaches table
- ✅ Focus indicator visible and high-contrast
- ✅ Enter/Space key triggers collaboration
- ✅ Escape key works in modal

---

### 3. Agent Animation to Table

**Objective**: Verify smooth agent movement to table positions

**Steps**:
1. Click the table to start collaboration
2. Observe agent animations
3. Note the stagger effect (sequential movement)
4. Wait for all agents to reach the table

**Expected Results**:
- ✅ Agents start moving one by one (150ms delay between each)
- ✅ Movement is smooth (2-second duration)
- ✅ Walking animation plays during movement
  - Character bobbing up and down
  - Arms swinging
  - Head bobbing
- ✅ Agents arrange in a circle around the table
- ✅ All agents face inward toward the table
- ✅ No visual glitches or jumps
- ✅ Animation maintains 60 FPS (check DevTools Performance tab)

**Edge Cases**:
- Single agent: Moves to top of table circle
- Two agents: Positioned at 12 o'clock and 6 o'clock
- Six+ agents: Evenly distributed around circle

**Performance Check**:
1. Open Chrome DevTools > Performance
2. Start recording
3. Click table
4. Stop recording after animation completes
5. Check for consistent 60 FPS (no drops below 55 FPS)

---

### 4. Modal Opening

**Objective**: Verify modal appears after animation completes

**Steps**:
1. After agents reach the table, observe modal opening
2. Check modal animation
3. Verify modal content

**Expected Results**:
- ✅ Modal appears ~2.3 seconds after clicking table (last agent + 300ms)
- ✅ Modal slides up with fade-in animation
- ✅ Backdrop appears with blur effect
- ✅ Modal is centered on screen
- ✅ Modal dimensions: 900px wide, 80vh tall (or full-screen on mobile)

**Modal Header**:
- ✅ Title: "Round Table Collaboration"
- ✅ Participant count badge (e.g., "3 agents")
- ✅ Close button (X) in top-right

**Agent Row**:
- ✅ All agents displayed horizontally
- ✅ Avatar shows emoji (e.g., ⚡ for Nora)
- ✅ Agent name below avatar
- ✅ Status indicator (green/amber/gray dot)
- ✅ Horizontal scroll if many agents

**Message Feed**:
- ✅ Empty state shows:
  - 💬 emoji
  - "Start the conversation"
  - Subtitle with participant count

**Input Area**:
- ✅ Textarea with placeholder
- ✅ Send button (gradient purple)
- ✅ Input is auto-focused

---

### 5. Message Sending

**Objective**: Test sending messages to all agents

**Steps**:
1. Type a test message: "Hello team, test message"
2. Click the Send button
3. Observe message appearance
4. Check Firestore for created documents

**Expected Results**:
- ✅ Message appears in feed immediately (optimistic update)
- ✅ Message bubble has blue theme (admin messages)
- ✅ Timestamp shows current time
- ✅ Response counter shows "0/3 responses" (for 3 agents)
- ✅ Send button shows spinner while sending
- ✅ Input clears after successful send
- ✅ Focus returns to input field

**Firestore Verification**:
1. Open Firestore console
2. Navigate to `agent-group-chats` collection
3. Find the document with current timestamp
4. Verify structure:
```
{
  participants: ['nora', 'antigravity', 'scout'],
  createdBy: 'admin',
  status: 'active',
  createdAt: [timestamp],
  lastMessageAt: [timestamp]
}
```
5. Check `messages` subcollection
6. Verify message document:
```
{
  from: 'admin',
  content: 'Hello team, test message',
  createdAt: [timestamp],
  responses: {
    nora: { content: '', status: 'pending' },
    antigravity: { content: '', status: 'pending' },
    scout: { content: '', status: 'pending' }
  },
  allCompleted: false
}
```
7. Check `agent-commands` collection
8. Verify 3 command documents created (one per agent):
```
{
  from: 'admin',
  to: 'nora', // (or antigravity, scout)
  type: 'group-chat',
  content: 'Hello team, test message',
  status: 'pending',
  groupChatId: '[chat-id]',
  messageId: '[message-id]',
  context: {
    otherAgents: ['antigravity', 'scout']
  }
}
```

**Keyboard Shortcut**:
1. Type a message
2. Press Cmd+Enter (Mac) or Ctrl+Enter (Windows)
3. Verify message sends

---

### 6. Agent Response Simulation

**Objective**: Simulate agent responses (until backend integration)

**Manual Simulation** (via Firestore console):
1. Open Firestore console
2. Navigate to the message document in `agent-group-chats/[chat-id]/messages/[message-id]`
3. Edit the document
4. Update `responses.nora`:
```json
{
  "content": "Hello! I'm ready to help with systems operations.",
  "status": "completed",
  "completedAt": [current timestamp]
}
```
5. Save the document
6. Switch back to the Virtual Office modal
7. Observe the response appear in real-time

**Expected Results**:
- ✅ Nora's response appears under the admin message
- ✅ Response has green border (Nora's color)
- ✅ Agent emoji (⚡) and name displayed
- ✅ Check icon appears (completed status)
- ✅ Response counter updates: "1/3 responses"
- ✅ Message content displays correctly

**Repeat for other agents** with different responses to verify color-coding:
- Antigravity (purple border): "🌌"
- Scout (amber border): "🕵️"

---

### 7. Typing Indicators

**Objective**: Test typing indicator display

**Steps**:
1. Manually update Firestore (while message is pending)
2. Set `responses.antigravity.status = 'processing'`
3. Observe the typing indicator

**Expected Results**:
- ✅ Avatar in agent row shows pulsing animation
- ✅ Typing overlay appears on avatar
- ✅ Three animated dots bouncing
- ✅ Response bubble shows "typing" state with animated dots
- ✅ No content displayed while typing

---

### 8. Message Feed Scrolling

**Objective**: Verify auto-scroll and manual scrolling

**Steps**:
1. Send multiple messages (5-10 messages)
2. Let the feed scroll automatically
3. Scroll up manually
4. Send a new message
5. Observe behavior

**Expected Results**:
- ✅ Feed auto-scrolls to latest message on new message
- ✅ User can scroll up to view history
- ✅ Scrollbar appears when content overflows
- ✅ Scrollbar is styled (purple theme)
- ✅ Scroll is smooth

**Overflow Testing**:
1. Send a very long message (500+ characters)
2. Verify text wraps correctly
3. Check for overflow or layout breaks

---

### 9. Modal Closing

**Objective**: Test modal close functionality

**Method 1: Close Button**
1. Click the X button in the top-right
2. Verify confirmation if agents are typing
3. Confirm closure
4. Observe return animation

**Method 2: Escape Key**
1. Press Escape
2. Verify confirmation if agents are typing
3. Confirm closure
4. Observe return animation

**Method 3: Backdrop Click**
1. Click outside the modal (on the dark backdrop)
2. Verify confirmation if agents are typing
3. Confirm closure
4. Observe return animation

**Expected Results**:
- ✅ Confirmation dialog appears if any agent has status='processing'
- ✅ Dialog text: "Some agents are still responding. Close anyway?"
- ✅ Cancel keeps modal open
- ✅ OK closes modal and triggers return animation
- ✅ If no agents typing, modal closes immediately

---

### 10. Return Animation

**Objective**: Verify agents return to desks smoothly

**Steps**:
1. Close the modal
2. Observe agent animations
3. Note the reverse stagger effect
4. Wait for all agents to reach their desks

**Expected Results**:
- ✅ Modal closes immediately
- ✅ Agents start moving in reverse order (last to arrive, first to leave)
- ✅ Stagger delay: 150ms between each agent
- ✅ Movement is smooth (2-second duration)
- ✅ Walking animation plays during movement
- ✅ Agents return to original desk positions
- ✅ Table returns to idle state (no glow)
- ✅ Collaboration state resets
- ✅ Participant badge updates

**Firestore Verification**:
1. Check `agent-group-chats` collection
2. Find the session document
3. Verify `status: 'closed'`
4. Verify `closedAt` timestamp present

---

### 11. Responsive Design

**Objective**: Test on different screen sizes

**Desktop (1920x1080)**:
1. Resize browser to full width
2. Test all functionality
3. Verify layout is optimal

**Expected Results**:
- ✅ Modal: 900px wide, centered
- ✅ Agent row: Horizontal scroll if many agents
- ✅ Message feed: Ample space for messages
- ✅ All elements properly spaced

**Tablet (768x1024)**:
1. Resize browser to 768px width
2. Test all functionality
3. Check for layout shifts

**Expected Results**:
- ✅ Modal: 95vw width, centered
- ✅ Agent avatars slightly smaller
- ✅ Message bubbles adapt to width
- ✅ Input area remains functional

**Mobile (375x667)**:
1. Resize browser to 375px width
2. Test all functionality
3. Verify mobile-specific styles

**Expected Results**:
- ✅ Modal: Full-screen (100vw, 100vh)
- ✅ No border radius (square corners)
- ✅ Agent row scrollable
- ✅ Message bubbles stack properly
- ✅ Input area accessible
- ✅ Keyboard doesn't obscure input

**Device Testing**:
- iPhone (Safari iOS): Test touch interactions
- Android (Chrome): Test touch interactions
- iPad (Safari): Test tablet layout

---

### 12. Accessibility

**Objective**: Verify WCAG 2.1 Level AA compliance

**Keyboard Navigation**:
1. Use Tab key to navigate through all interactive elements
2. Verify logical tab order:
   - Table → Modal opens → Agent avatars → Message feed → Input → Send → Close
3. Test all keyboard shortcuts

**Expected Results**:
- ✅ All interactive elements reachable via keyboard
- ✅ Tab order is logical and intuitive
- ✅ Focus indicators always visible
- ✅ No keyboard traps
- ✅ Escape closes modal

**Screen Reader Testing** (VoiceOver on Mac, NVDA on Windows):
1. Enable screen reader
2. Navigate to Virtual Office
3. Tab to the table
4. Listen for announcement

**Expected Announcements**:
- Table: "Start collaboration session with 3 agents, button"
- Modal opens: "Round Table Collaboration, dialog"
- Agent avatars: "Nora, working, emoji: ⚡"
- Input: "Type your message, edit text"
- Send button: "Send message, button"
- Messages: "You says: Hello team" (via live region)

**Color Contrast**:
1. Use browser extension (axe DevTools or WAVE)
2. Run accessibility audit
3. Check contrast ratios

**Expected Results**:
- ✅ All text meets 4.5:1 contrast ratio
- ✅ Focus indicators meet 3:1 contrast ratio
- ✅ No color-only indicators (icons accompany colors)

**Motion Reduction**:
1. Enable "Reduce motion" in OS settings (macOS: System Preferences > Accessibility > Display)
2. Click the table
3. Observe animations

**Expected Results**:
- ✅ Agent transitions are instant (0.01ms duration)
- ✅ No walking animations
- ✅ Modal slides in quickly or not at all
- ✅ Typing indicators still visible but not animated

---

### 13. Performance Testing

**Objective**: Ensure smooth performance under load

**Animation Frame Rate**:
1. Open Chrome DevTools > Performance
2. Start recording
3. Click table to trigger animation
4. Wait for animation to complete
5. Stop recording
6. Analyze frame rate

**Expected Results**:
- ✅ Average FPS: 60
- ✅ Minimum FPS: 55+
- ✅ No long tasks (>50ms)
- ✅ Smooth animation curve (no stuttering)

**Memory Usage**:
1. Open Chrome DevTools > Memory
2. Take heap snapshot
3. Interact with feature (open/close modal 5 times)
4. Take another heap snapshot
5. Compare memory usage

**Expected Results**:
- ✅ No significant memory leaks
- ✅ Memory returns to baseline after closing modal
- ✅ Event listeners properly cleaned up

**Network Performance**:
1. Open Chrome DevTools > Network
2. Throttle to "Slow 3G"
3. Send a message
4. Observe network requests

**Expected Results**:
- ✅ Firestore writes complete within 5 seconds
- ✅ Optimistic update shows message immediately
- ✅ No race conditions or duplicate requests

**Stress Testing** (Many Agents):
1. Manually add 10+ agent presence documents in Firestore
2. Reload Virtual Office
3. Click table
4. Observe animation

**Expected Results**:
- ✅ All agents animate smoothly
- ✅ Circular arrangement scales appropriately
- ✅ Frame rate remains above 55 FPS
- ✅ Modal displays all agents (with scrolling)

---

### 14. Error Handling

**Objective**: Verify graceful error handling

**Network Failure**:
1. Open DevTools > Network
2. Set to "Offline"
3. Try to send a message

**Expected Results**:
- ✅ Error caught and logged to console
- ✅ Alert shows: "Failed to send message. Please try again."
- ✅ Message not added to feed
- ✅ Input retains text
- ✅ Can retry after going online

**Firestore Permission Denied**:
1. Manually trigger a Firestore permission error
2. Observe error handling

**Expected Results**:
- ✅ Error caught and logged
- ✅ User-friendly error message
- ✅ Application doesn't crash

**Agent Runner Offline**:
1. Send a message when no agent runners are active
2. Wait 45 seconds

**Expected Results**:
- ✅ Responses remain in "pending" state
- ✅ No timeout errors shown to user
- ✅ Can close modal without issues

**Invalid Data**:
1. Send a message with 2000+ characters (max length)
2. Try to send empty message

**Expected Results**:
- ✅ 2000 char limit enforced
- ✅ Empty message send button is disabled
- ✅ No errors thrown

---

### 15. Edge Cases

**No Agents Present**:
1. Manually remove all agent presence documents
2. Reload Virtual Office
3. Click table

**Expected Results**:
- ✅ Table shows "0" participant badge
- ✅ Click still initiates collaboration
- ✅ Modal opens with empty agent row
- ✅ Can send messages (to empty recipient list)
- ✅ No crashes or errors

**Single Agent**:
1. Ensure only one agent is present
2. Click table
3. Observe animation

**Expected Results**:
- ✅ Single agent moves to top of table (12 o'clock)
- ✅ Animation smooth
- ✅ Modal opens correctly
- ✅ Broadcast sends to single agent

**Multiple Sessions**:
1. Open Virtual Office in two browser tabs
2. Start collaboration in Tab 1
3. Observe Tab 2

**Expected Results**:
- ✅ Tab 2 doesn't auto-start collaboration
- ✅ Each tab maintains independent state
- ✅ No race conditions in Firestore

**Rapid Clicking**:
1. Click table rapidly 5 times
2. Observe behavior

**Expected Results**:
- ✅ Only one collaboration session starts
- ✅ No duplicate Firestore documents
- ✅ Animation doesn't restart mid-transition

**Browser Refresh During Animation**:
1. Click table
2. Immediately refresh browser (before animation completes)
3. Observe state

**Expected Results**:
- ✅ State resets cleanly
- ✅ Agents return to desks
- ✅ No stuck animations
- ✅ No orphaned Firestore sessions

---

## Browser Compatibility Matrix

Test on the following browsers:

| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|--------|--------|
| Chrome | Latest | ✅ | ✅ | Pass |
| Safari | Latest | ✅ | ✅ | Pass |
| Firefox | Latest | ✅ | ⚠️ | Not tested |
| Edge | Latest | ✅ | ⚠️ | Not tested |
| Samsung Internet | Latest | ❌ | ⚠️ | Not tested |

---

## Automated Testing (Future)

### Unit Tests (Jest)
```typescript
// tablePositions.test.ts
describe('getTablePosition', () => {
  it('should calculate correct position for first agent', () => {
    const pos = getTablePosition(0, 3);
    expect(pos.x).toBeCloseTo(50);
    expect(pos.y).toBeLessThan(57);
  });
});
```

### Integration Tests (React Testing Library)
```typescript
// RoundTable.test.tsx
describe('RoundTable', () => {
  it('should render with correct participant count', () => {
    render(<RoundTable isActive={false} onClick={jest.fn()} participantCount={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

### E2E Tests (Cypress/Playwright)
```typescript
// round-table.spec.ts
describe('Round Table Collaboration', () => {
  it('should animate agents to table on click', () => {
    cy.visit('/admin/virtualOffice');
    cy.get('[data-testid="round-table"]').click();
    cy.wait(2500);
    cy.get('.agent-desk-sprite').should('have.class', 'at-table');
    cy.get('[data-testid="group-chat-modal"]').should('be.visible');
  });
});
```

---

## Bug Reporting Template

If you encounter issues during testing, use this template:

```markdown
### Bug Report

**Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Environment**:
- Browser: [Chrome 120.0]
- OS: [macOS 14.0]
- Screen size: [1920x1080]

**Steps to Reproduce**:
1. Navigate to Virtual Office
2. Click the round table
3. [Additional steps]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Screenshots/Video**:
[Attach if applicable]

**Console Errors**:
```
[Paste any console errors]
```

**Firestore Data**:
[Include relevant Firestore document snapshots]

**Additional Context**:
[Any other relevant information]
```

---

## Test Sign-Off

After completing all test cases, use this checklist:

### Functional Testing
- [ ] Table renders correctly
- [ ] Click initiates collaboration
- [ ] Agents animate to table smoothly
- [ ] Modal opens after animation
- [ ] Messages can be sent
- [ ] Firestore documents created correctly
- [ ] Modal can be closed
- [ ] Agents return to desks smoothly
- [ ] State resets properly

### Non-Functional Testing
- [ ] Performance meets targets (60 FPS)
- [ ] Responsive on all screen sizes
- [ ] Accessible (keyboard, screen reader)
- [ ] Error handling works
- [ ] Edge cases handled
- [ ] No console errors
- [ ] No memory leaks

### Browser Compatibility
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] Chrome (mobile)
- [ ] Safari iOS (mobile)

### Documentation
- [ ] Testing guide complete
- [ ] Known issues documented
- [ ] User documentation created

**Tested By**: ___________________  
**Date**: ___________________  
**Build Version**: ___________________  
**Status**: ✅ Pass / ⚠️ Pass with issues / ❌ Fail  

---

## Support

For questions or issues:
- Check implementation docs: `.agent/implementation/IMPLEMENTATION_COMPLETE.md`
- Review requirements: `.agent/analysis/round-table-requirements.md`
- Contact: Scout (AI Engineer)

---

**Last Updated**: 2024-02-11  
**Version**: 1.0  
**Status**: Ready for Testing
