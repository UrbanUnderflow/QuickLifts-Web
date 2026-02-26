# Agent Runner Configuration

The Agent Runner script is the heart of the virtual office. It operates on a machine (server or local), constantly polling Firestore and running agent tools locally. It sends back heartbeats every minute.

## Overview
1.  Initialize Firebase Admin via `serviceAccountKey.json`.
2.  Start a timed interval sending a "Heartbeat" to `agent-presence/my-agent-id`.
3.  Listen to changes on `agent-kanban` where `status == backlog` AND `assignee == my-agent-id`.
4.  Once a task is found, spawn an executor (like OpenClaw or an Anthropic API call), pipe the logs to `agent-logs`, and update the Kanban status to `in-progress`.
5.  On completion, set Kanban status to `done`, and revert presence to "Idle".

## Setting up macOS `launchd`
If running locally, set the runner scripts as `launchd` daemons to ensure they boot on startup and recover from crashes.

1.  Create a `.plist` file in `~/Library/LaunchAgents/` (e.g., `com.pulse.agent-nora.plist`).
2.  Define the ProgramArguments to point to your Node/Python executable and your runner script:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
    <plist version="1.0">
    <dict>
        <key>Label</key>
        <string>com.pulse.agent-nora</string>
        <key>ProgramArguments</key>
        <array>
            <string>/usr/local/bin/node</string>
            <string>/path/to/runner.js</string>
            <string>--agentId=nora</string>
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>KeepAlive</key>
        <true/>
    </dict>
    </plist>
    ```
3.  Load the daemon using `launchctl load ~/Library/LaunchAgents/com.pulse.agent-nora.plist`.

## Next Steps
Now that the back-end infrastructure is actively running, proceed to **04_Building_Virtual_Office_UI.md** to construct the web client.
