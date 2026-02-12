# Round Table Collaboration - User Guide

## What is Round Table Collaboration?

Round Table Collaboration is a premium feature in the Virtual Office that allows you to bring all your AI agents together for group discussions. When activated, agents visually gather around a central table, and you can send messages to all of them simultaneously, receiving coordinated responses from the entire team.

---

## Getting Started

### Accessing the Feature

1. Log in to Pulse Admin
2. Navigate to **Virtual Office** (`/admin/virtualOffice`)
3. Look for the **round wooden table** in the center of the office floor

### Starting a Collaboration Session

**Method 1: Mouse**
- Click on the round table in the center of the office
- Watch as your agents animate from their desks to the table

**Method 2: Keyboard**
- Press `Tab` until the table is focused (blue outline appears)
- Press `Enter` or `Space` to start the session

### What Happens Next

1. **Animation** (2-3 seconds)
   - Agents leave their desks one by one
   - They walk to the table with animated movement
   - They arrange themselves in a circle around the table

2. **Modal Opens**
   - A collaboration modal appears on your screen
   - All agents are shown at the top with their status
   - A message input field is ready for you to type

---

## Using the Collaboration Modal

### Modal Layout

```
┌─────────────────────────────────────────┐
│ Round Table Collaboration       [X]     │
│ 3 agents                                │
├─────────────────────────────────────────┤
│ [⚡ Nora] [🌌 Antigravity] [🕵️ Scout]  │
├─────────────────────────────────────────┤
│                                          │
│ Message Feed (scrollable)                │
│   You: Hello team!                       │
│   ├─ Nora: Hi! How can I help?         │
│   ├─ Antigravity: Ready to collaborate │
│   └─ Scout: Standing by!                │
│                                          │
├─────────────────────────────────────────┤
│ Type your message...            [Send]  │
└─────────────────────────────────────────┘
```

### Sending Messages

**Type and Send**:
1. Type your message in the input field at the bottom
2. Click the **Send** button (purple gradient)
3. Your message appears immediately in the feed

**Keyboard Shortcut**:
- Press `Cmd + Enter` (Mac) or `Ctrl + Enter` (Windows) to send quickly

### Understanding Agent Responses

**Status Indicators**:
- **Green dot**: Agent is actively working
- **Amber dot**: Agent is idle, ready for tasks
- **Gray dot**: Agent is offline

**Response States**:
- **Waiting...**: Agent hasn't started processing yet
- **Typing (animated dots)**: Agent is generating a response
- **Message content**: Agent has responded
- **Failed**: Agent couldn't respond (network/error)

**Response Counter**:
- Shows progress like "2/3 responses"
- Updates as agents respond

### Agent Avatars

Each agent is displayed with:
- **Emoji**: Visual identifier (e.g., ⚡ for Nora)
- **Name**: Agent's display name
- **Status**: Color-coded dot
- **Typing Overlay**: Appears when agent is processing

---

## Tips & Best Practices

### Effective Collaboration

**1. Be Clear and Specific**
```
✅ Good: "Nora, show me the status of the iOS build. Antigravity, what's blocking the profile screen redesign?"

❌ Vague: "What's happening with the app?"
```

**2. Address Agents by Name**
While all agents receive your message, mentioning specific agents helps them understand their role in the conversation.

**3. Ask Follow-up Questions**
You can reference previous messages:
```
"Based on Nora's report, Antigravity, can you prioritize fixing the profile API?"
```

**4. Use for Decision-Making**
Great for getting multiple perspectives:
```
"Should we launch the running category before or after the mental training feature? I want everyone's input."
```

### When to Use Round Table

**Ideal Scenarios**:
- Strategic planning discussions
- Cross-functional coordination
- Complex problem-solving requiring multiple perspectives
- Status updates from all agents
- Brainstorming sessions
- Consensus-building

**When Individual Chat is Better**:
- Simple questions for one agent
- Task assignments to specific agents
- Private/sensitive discussions
- Quick status checks

---

## Closing a Session

### Methods to Close

**Method 1: Close Button**
- Click the **X** in the top-right corner of the modal

**Method 2: Keyboard**
- Press `Escape` (ESC) key

**Method 3: Backdrop**
- Click anywhere outside the modal on the dark overlay

### Confirmation Dialog

If agents are still typing when you try to close:
- You'll see: "Some agents are still responding. Close anyway?"
- **Cancel**: Keep the session open
- **OK**: Close immediately (agents will stop responding)

### Return Animation

1. Modal closes immediately
2. Agents return to their desks in reverse order
3. Table returns to idle state (glow disappears)
4. Session is marked as "closed" in the system

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate to next interactive element |
| `Shift + Tab` | Navigate to previous element |
| `Enter` / `Space` | Activate focused element (e.g., click table) |
| `Cmd/Ctrl + Enter` | Send message from input field |
| `Escape` | Close modal |

---

## Understanding Message Colors

Each agent has a unique color scheme to help you quickly identify who's responding:

| Agent | Color | Visual Cue |
|-------|-------|------------|
| **You** (Admin) | Blue | Blue background, subtle glow |
| **Nora** | Green | Green left border on response |
| **Antigravity** | Purple | Purple left border on response |
| **Scout** | Amber | Amber left border on response |

---

## Mobile Experience

### Using on Mobile Devices

**Modal Appearance**:
- Full-screen on phones (no margins)
- Simplified layout for small screens
- Scrollable agent row if many agents

**Touch Interactions**:
- Tap the table to start
- Tap outside modal to close
- Swipe to scroll message feed
- Keyboard appears when tapping input

**Tips for Mobile**:
- Rotate to landscape for more space
- Use voice-to-text for longer messages
- Pinch to zoom if text is too small

---

## Troubleshooting

### Common Issues

**Table won't start collaboration**
- Verify you're logged in as admin
- Check that at least one agent is online
- Try refreshing the page
- Check browser console for errors

**Agents aren't responding**
- Verify agent runners are active
- Check Firestore for pending commands
- Wait up to 45 seconds for responses
- Contact system admin if issues persist

**Modal won't open**
- Wait for animation to complete (2-3 seconds)
- Check browser console for errors
- Try restarting collaboration

**Animation is choppy**
- Close other browser tabs
- Check CPU usage (should be low)
- Try a different browser
- Disable browser extensions

**Can't send messages**
- Check internet connection
- Verify input isn't empty
- Check 2000 character limit
- Try refreshing the page

### Error Messages

**"Failed to send message. Please try again."**
- Network connection lost
- Firestore permission denied
- Solution: Check connection, try again

**"Some agents are still responding. Close anyway?"**
- This is normal behavior
- Not an error—just a confirmation
- Choose OK to close or Cancel to wait

---

## Advanced Features

### Message History

**Viewing Past Messages**:
- Scroll up in the message feed
- All messages from the current session are preserved
- Feed auto-scrolls to latest message when new messages arrive

**Message Limits**:
- No practical limit on message count
- Feed may slow down with 100+ messages
- Consider starting a new session for long discussions

### Session Management

**Session Persistence**:
- Each session is stored in Firestore
- Session history viewable by admin
- Sessions marked as "closed" when ended

**Multiple Sessions**:
- You can only have one active session at a time
- Opening Virtual Office in multiple tabs doesn't sync collaboration state
- Each tab maintains independent state

---

## Accessibility Features

### For Keyboard Users

- **Full keyboard navigation**: No mouse required
- **Logical tab order**: Table → Modal → Agents → Input → Send → Close
- **Clear focus indicators**: Blue outlines on focused elements
- **No keyboard traps**: Can always escape back

### For Screen Reader Users

- **ARIA labels**: All elements properly labeled
- **Live regions**: New messages announced automatically
- **Semantic HTML**: Proper heading structure
- **Alt text**: Emojis have text descriptions

### For Motion-Sensitive Users

- **Reduced motion support**: Respects OS settings
- **Instant transitions**: When "Reduce motion" enabled
- **No flashing**: No elements flash or strobe
- **Disable animations**: Via browser/OS settings

---

## Best Practices for Agents

### When Responding to Group Messages

**For AI Agents** (Implementation Note):
- Acknowledge other agents' responses
- Build on previous context
- Keep responses concise (no one likes long walls of text)
- Coordinate rather than duplicate work
- Reference specific agents by name when relevant

**Example Good Response**:
```
Nora: "I'll handle the infrastructure deployment. Antigravity, you mentioned needing API keys—I'll generate those now."
```

**Example Less Helpful**:
```
Nora: "I can help with that. What do you need?"
```

---

## Privacy & Security

### Data Handling

- **Session Storage**: All messages stored in Firestore
- **Admin-Only Access**: Only admins can view/initiate collaboration
- **Agent Isolation**: Agents only see messages in their group chat
- **No External Sharing**: Messages stay within Pulse system

### Message Content

- **No PII**: Avoid sending sensitive personal information
- **Professional Use**: Keep messages work-related
- **Audit Trail**: All messages logged with timestamps

---

## FAQ

**Q: How many agents can participate?**  
A: All agents in the Virtual Office will participate. No practical limit, but optimal with 3-6 agents.

**Q: Can I remove specific agents from a session?**  
A: Not currently. All active agents participate. Future versions may support selective participation.

**Q: Do messages persist after closing?**  
A: Yes, in Firestore. However, the modal only shows the current session. Historical sessions can be queried from Firestore.

**Q: Can agents see each other's responses?**  
A: Currently, agents receive the user's message but not other agents' responses in real-time. Future updates will enable agent-to-agent awareness.

**Q: What happens if an agent is offline?**  
A: The message is still sent. When the agent comes online, it will process pending messages in its command queue.

**Q: Can I edit or delete messages?**  
A: Not currently. Consider this before sending. Future versions may support editing.

**Q: Is there a character limit for messages?**  
A: Yes, 2000 characters per message. Keep messages concise for best results.

**Q: Can I use emojis in messages?**  
A: Yes! Emojis work perfectly in messages.

**Q: Will this work on my iPad?**  
A: Yes! The feature is fully responsive and works on tablets with touch support.

---

## Getting Help

### Resources

- **Implementation Docs**: `.agent/implementation/IMPLEMENTATION_COMPLETE.md`
- **Testing Guide**: `.agent/implementation/TESTING_GUIDE.md`
- **Technical Details**: `.agent/analysis/round-table-requirements.md`

### Support Contacts

- **Technical Issues**: Scout (AI Engineer)
- **Feature Requests**: Product Team
- **Bug Reports**: Use GitHub Issues

---

## Changelog

### Version 1.0 (2024-02-11)
- ✅ Initial release
- ✅ Basic collaboration functionality
- ✅ Real-time messaging
- ✅ Agent status indicators
- ✅ Keyboard accessibility
- ✅ Mobile responsive design

### Future Enhancements (Planned)
- 🔮 Voice mode (text-to-speech)
- 🔮 Breakout rooms (subset of agents)
- 🔮 Voting/polling
- 🔮 Screen sharing
- 🔮 Meeting summaries
- 🔮 Message editing/deletion
- 🔮 Session history viewer

---

**Happy Collaborating!** 🎉

This feature is designed to make your multi-agent workflows more efficient and enjoyable. We hope it becomes an essential part of your Virtual Office experience.

---

**Document Version**: 1.0  
**Last Updated**: 2024-02-11  
**Author**: Scout (AI Engineer)  
**For**: Pulse Fitness Administrators
