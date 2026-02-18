#!/bin/zsh
set -euo pipefail

cd /Users/tremainegrant/Documents/GitHub/QuickLifts-Web

PATH="/opt/homebrew/bin:$PATH"

if [ -f ".env.local" ]; then
  set -a
  source .env.local
  set +a
fi

export USE_OPENCLAW=true
export AGENT_ID=scout
export AGENT_NAME="Scout"

exec node scripts/agentRunner.js
