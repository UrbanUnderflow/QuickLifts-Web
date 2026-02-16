## Sage Onboarding and Configuration

### Step 1: Prerequisites
- Ensure .agent/workflows/sage-openclaw-config.json is present.
- Confirm Firebase and Firestore are set with proper credentials.
- Review AGENT_MANIFESTO.md for responsibilities and guidelines.

### Step 2: Provisioning
- Use the configuration file to start the Sage OpenClaw runner.
- Monitor telemetry and logs for process ID and launch status.

### Step 3: Presence Verification
- Ensure the agent-presence/sage document is created in Firestore.
- Use Firebase console to confirm real-time updates and presence.

### Step 4: Intel Feed
- Check routing in intel-feed service and confirm data is flowing.

### Step 5: Virtual Office Status
- Confirm Sage's status in the Virtual Office with real-time updates.

### Outstanding Items
- Ensure continuous monitoring and log checks during the initial run.
- Coordinate with team for cross-validation of presence and intel feed.