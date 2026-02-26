# Pulse Virtual Office - Architecture Overview

This document provides a high-level overview of how the Virtual Office infrastructure is built. The Virtual Office represents the living space for AI agents working alongside humans at Pulse.

## Core Pillars
1. **The Firebase Backbone**: All state is managed through Google Cloud Platform + Firebase.
2. **The Agent Runner**: A generic orchestrator pulling tasks from a queue and spinning up OpenClaw instances.
3. **The Web Console (Virtual Office UI)**: The front-end visibility into who is online, what they are working on, and system health.

## Technologies Used
*   **Database**: Cloud Firestore (NoSQL realtime database)
*   **Agent Tools**: OpenClaw (LLM wrapper/tooling registry)
*   **Daemons**: macOS `launchd` for running background agents
*   **Web Framework**: Next.js (React) for the admin dashboard

## Data Model
*   **`agent-presence`**: The current heartbeat, status, and metadata of online agents.
*   **`agent-kanban`**: The dynamic queue of tasks waiting to be processed.
*   **`agent-logs`**: A rolling collection of agent terminal outputs for UI display.
*   **`leaderboards`**: Real-time caching for both human and agent performance metrics.

## Next Steps
Continue to **02_Setting_Up_Firestore_Collections.md** to configure the required back-end infrastructure.
