#!/usr/bin/env bash
#
# Firestore Index Sync (Pre-Deploy Safety Check)
#
# Goal:
# - Pull the *live* Firestore index definitions from Firebase
# - Diff them against our repo's firestore.indexes.json
# - Optionally update the repo file to match live
#
# Why:
# Deploying with `firebase deploy --only firestore:indexes` can DELETE indexes that exist in Firebase
# but are missing from firestore.indexes.json. This script prevents accidental deletions by ensuring
# the repo file is in sync first.
#
# Usage:
#   bash scripts/sync-firestore-indexes.sh
#   bash scripts/sync-firestore-indexes.sh --project quicklifts-dd3f1
#   bash scripts/sync-firestore-indexes.sh --write
#   bash scripts/sync-firestore-indexes.sh --project quicklifts-dd3f1 --write
#
# Exit codes:
#   0  - In sync (no diff) OR --write completed
#   2  - Diff detected (out of sync)
#   1  - Other error
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

LOCAL_FILE="${PROJECT_ROOT}/firestore.indexes.json"
TEMP_DIR="${PROJECT_ROOT}/temp"

PROJECT=""
DO_WRITE="false"

print_usage() {
  cat <<EOF
Usage:
  bash scripts/sync-firestore-indexes.sh [--project <projectId>] [--write]

Options:
  --project <projectId>   Firebase project id (defaults to .firebaserc \"default\")
  --write                 Overwrite firestore.indexes.json with live indexes (safe pre-deploy sync)

Examples:
  bash scripts/sync-firestore-indexes.sh
  bash scripts/sync-firestore-indexes.sh --project quicklifts-dd3f1
  bash scripts/sync-firestore-indexes.sh --write
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="${2:-}"
      shift 2
      ;;
    --write)
      DO_WRITE="true"
      shift 1
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${LOCAL_FILE}" ]]; then
  echo "❌ Missing ${LOCAL_FILE}"
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "❌ Firebase CLI not found."
  echo "💡 Install: yarn global add firebase-tools  (or: npm i -g firebase-tools)"
  exit 1
fi

if [[ -z "${PROJECT}" ]]; then
  FIREBASERC="${PROJECT_ROOT}/.firebaserc"
  if [[ -f "${FIREBASERC}" ]]; then
    # Extract projects.default from .firebaserc without jq dependency
    PROJECT="$(node -e "const fs=require('fs');const p='${FIREBASERC}';const j=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write((j.projects&&j.projects.default)||'');" || true)"
  fi
fi

if [[ -z "${PROJECT}" ]]; then
  echo "❌ Could not determine Firebase project."
  echo "💡 Pass explicitly: --project <projectId>"
  exit 1
fi

mkdir -p "${TEMP_DIR}"
LIVE_FILE="${TEMP_DIR}/firestore.indexes.live.${PROJECT}.json"

echo "🔎 Firestore index sync check"
echo "  - project: ${PROJECT}"
echo "  - local:   ${LOCAL_FILE}"
echo "  - live:    ${LIVE_FILE}"
echo ""

cd "${PROJECT_ROOT}"

echo "⬇️  Exporting live indexes from Firebase..."
firebase firestore:indexes --project "${PROJECT}" > "${LIVE_FILE}"
echo "✅ Exported live indexes."
echo ""

if [[ "${DO_WRITE}" == "true" ]]; then
  echo "✍️  Updating local firestore.indexes.json to match live..."
  cp "${LIVE_FILE}" "${LOCAL_FILE}"
  echo "✅ Updated ${LOCAL_FILE}"
  echo ""
  echo "Next:"
  echo "  - Review changes (git diff)"
  echo "  - Commit firestore.indexes.json"
  exit 0
fi

echo "🔁 Diffing local vs live..."
echo ""

DIFF_EXIT=0
if command -v git >/dev/null 2>&1; then
  # git diff --no-index gives nicer output without requiring git status
  set +e
  git diff --no-index -- "${LOCAL_FILE}" "${LIVE_FILE}"
  DIFF_EXIT=$?
  set -e
else
  set +e
  diff -u "${LOCAL_FILE}" "${LIVE_FILE}"
  DIFF_EXIT=$?
  set -e
fi

# git diff returns 1 when files differ; diff returns 1 when files differ
if [[ "${DIFF_EXIT}" -eq 1 ]]; then
  echo ""
  echo "⚠️  OUT OF SYNC: live indexes differ from firestore.indexes.json"
  echo "✅ This is exactly what we want to catch *before* deploying indexes."
  echo ""
  echo "Fix options:"
  echo "  A) If Firebase is correct (console-created indexes):"
  echo "     bash scripts/sync-firestore-indexes.sh --project ${PROJECT} --write"
  echo "     then commit firestore.indexes.json"
  echo ""
  echo "  B) If repo is correct (new indexes in code):"
  echo "     Deploy AFTER ensuring firestore.indexes.json includes all existing live indexes."
  exit 2
fi

echo "✅ In sync."
exit 0

