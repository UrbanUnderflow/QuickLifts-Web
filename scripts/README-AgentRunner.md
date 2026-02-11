# Pulse Agent Runner

The Agent Runner (`scripts/agentRunner.js`) is a Node.js process that acts as the "brain" for your AI agent (Nora). It listens for chat messages, infers intent (Chat vs Task vs Command), and executes actions.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js 18+ installed.
2.  **Authentication**: The runner needs permission to write to Firestore.
    *   **Option A (Recommended for Local Dev)**: Run `gcloud auth application-default login` to authenticate with your Google Cloud account.
    *   **Option B (Service Account)**: Download a service account JSON key from Firebase Console -> Project Settings -> Service Accounts. Save it as `service-account.json` in the project root.
3.  **Environment Variables**: You must provide `OPENAI_API_KEY` and `AGENT_ID`.

## Running the Agent

You can run the agent directly using `node`:

```bash
# Load your local environment variables first
set -a; source .env.local; set +a

# Start the runner (example for Nora)
AGENT_ID=nora AGENT_NAME="Nora ⚡" node scripts/agentRunner.js
```

## Features

-   **Smart Chat**: Uses OpenAI to detect if a message is a simple chat, a task request, or a command.
-   **Task Execution**: Automatically creates tasks in the Kanban board if detected.
-   **Commands**: Supports `stop`, `status`, `priority` commands.
-   **Email Bridge**: Can generate responses for incoming emails (if configured).

## Troubleshooting

-   **"No service account found"**: This means you haven't set up `service-account.json` or `gcloud auth application-default login`.
-   **"Could not load the default credentials"**: Run `gcloud auth application-default login`.
-   **"Missing Firestore index"**: Check the `firestore.indexes.json` file and deploy indexes or click the link in the error log.
