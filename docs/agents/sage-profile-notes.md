# Sage Agent Documentation

### Root Cause of Runner Stall
The Sage runner was previously stalling due to a configuration issue that prevented the initial run from executing correctly. This was causing the runner to wait indefinitely for tasks without proper startup.

### Fix Applied
1. Re-ran the Sage provisioning workflow to ensure configurations were correctly applied.
2. Restarted the Sage runner to verify initialization without the 120-second stall issue.
3. Confirmed that the Sage agent is registered and visible in the agent list.
4. Monitoring is set up to ensure heartbeats emit steadily without interruptions.

### Recommendations
- Regularly check the `openclaw agents list` to ensure all agents, including Sage, are visible and operational.
- Monitor the agent logs for any future anomalies in heartbeat emissions.
- Document any changes in configuration to facilitate easier troubleshooting in the future.