#!/bin/zsh
set -euo pipefail

cd /Users/noraclawdbot/Documents/GitHub/QuickLifts-Web

PATH="/Users/noraclawdbot/.local/node-v22.22.0-darwin-arm64/bin:$PATH"

if [ -f ".env.local" ]; then
  set -a
  source .env.local
  set +a
fi

export USE_OPENCLAW=true
export AGENT_ID=nora
export AGENT_NAME="Nora"

exec node scripts/agentRunner.js
