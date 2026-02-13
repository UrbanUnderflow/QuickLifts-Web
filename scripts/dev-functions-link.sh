#!/bin/bash
# ═══════════════════════════════════════════════════════
# dev-functions-link.sh
# Creates a lightweight symlinked functions directory for fast local dev.
# Only links the functions you actually need during development.
# Run: bash scripts/dev-functions-link.sh
# ═══════════════════════════════════════════════════════

set -e

SRC_DIR="netlify/functions"
DEV_DIR="netlify/functions-dev"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_ROOT"

# Clean previous
rm -rf "$DEV_DIR"
mkdir -p "$DEV_DIR"

# ───────────────────────────────────────────────────
# Core functions needed for local development
# Add/remove as needed — each line is one function
# ───────────────────────────────────────────────────
CORE_FUNCTIONS=(
  # Auth & User
  check-admin
  check-env
  get-user-by-id
  delete-user
  reset-onboarding

  # Payments & Checkout (if testing payment flows)
  create-checkout-session
  create-payment-intent
  complete-payment
  verify-subscription
  manage-subscription
  validate-promo-code

  # Agent system (virtual office / admin)
  pulsecheck-chat
  pulsecheck-escalation
  classify-escalation
  analyze-sentiment
  send-notification

  # Content / Workout
  generate-workout-from-body-parts
  inferExerciseBodyParts
  analyze-workout-machine-screen
  generateCaption
  get-body-weight

  # Challenges
  get-challenges
  get-challenge-by-id
  get-run-round-leaderboard
  calculate-winners

  # Followers / Social
  get-followers
  send-friend-email

  # Files / Media
  process-video-gif
  add-gif-to-exercise

  # OG Images
  og-image

  # Coach
  create-coach-checkout-session
  get-coach-profile
  create-partner-profile
  notify-coach-connection

  # Admin tools
  get-dashboard-link
  get-earnings
  fix-null-creator
  get-user-videos
  get-all-workout-summaries

  # KPI / Press
  generateKpiSnapshot
  draftPress

  # Mental training
  tts-mental-step
)

# ───────────────────────────────────────────────────
# Create symlinks
# ───────────────────────────────────────────────────
linked=0
skipped=0
for fn in "${CORE_FUNCTIONS[@]}"; do
  # Try common extensions
  for ext in ".ts" ".js" ".mjs"; do
    src="$SRC_DIR/${fn}${ext}"
    if [ -f "$src" ]; then
      ln -s "$(cd "$(dirname "$src")" && pwd)/$(basename "$src")" "$DEV_DIR/$(basename "$src")"
      linked=$((linked + 1))
      break
    fi
  done

  # Check for directory-based functions
  if [ -d "$SRC_DIR/$fn" ]; then
    ln -s "$(cd "$SRC_DIR/$fn" && pwd)" "$DEV_DIR/$fn"
    linked=$((linked + 1))
  fi
done

# Also link shared assets/config directories
for shared in "assets" "config" "shared" "utils"; do
  if [ -d "$SRC_DIR/$shared" ]; then
    ln -s "$(cd "$SRC_DIR/$shared" && pwd)" "$DEV_DIR/$shared"
    echo "  📁 Linked shared directory: $shared"
  fi
done

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Dev functions ready: $linked linked (from ${#CORE_FUNCTIONS[@]} requested)"
echo "📂 Directory: $DEV_DIR"
echo "🚀 Run: npm run dev:fast"
echo "═══════════════════════════════════════════"
