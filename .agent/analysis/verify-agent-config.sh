#!/bin/bash
# Agent Configuration Verification Script
# Verifies that an agent is properly configured in virtualOffice.tsx

AGENT_ID="${1:-sage}"
FILE="src/pages/admin/virtualOffice.tsx"

echo "=========================================="
echo "Agent Configuration Verification"
echo "Agent ID: $AGENT_ID"
echo "File: $FILE"
echo "=========================================="
echo ""

# Check if file exists
if [ ! -f "$FILE" ]; then
    echo "❌ ERROR: File not found: $FILE"
    exit 1
fi

echo "Checking data structures..."
echo ""

# 1. Check AGENT_ROLES
echo -n "1. AGENT_ROLES: "
if grep -q "^\s*${AGENT_ID}:" "$FILE" | head -1; then
    VALUE=$(grep "^\s*${AGENT_ID}:" "$FILE" | head -1 | cut -d"'" -f2)
    echo "✅ Present - '$VALUE'"
else
    echo "❌ Missing"
fi

# 2. Check AGENT_DUTIES
echo -n "2. AGENT_DUTIES: "
if grep -q "^\s*${AGENT_ID}:" "$FILE"; then
    echo "✅ Present"
else
    echo "❌ Missing"
fi

# 3. Check AGENT_DISPLAY_NAMES
echo -n "3. AGENT_DISPLAY_NAMES: "
if grep -q "^\s*${AGENT_ID}:" "$FILE"; then
    echo "✅ Present"
else
    echo "❌ Missing"
fi

# 4. Check AGENT_EMOJI_DEFAULTS
echo -n "4. AGENT_EMOJI_DEFAULTS: "
if grep -q "^\s*${AGENT_ID}:" "$FILE"; then
    EMOJI=$(grep "^\s*${AGENT_ID}:" "$FILE" | grep "AGENT_EMOJI_DEFAULTS" -A 10 | grep "${AGENT_ID}:" | cut -d"'" -f2)
    echo "✅ Present - $EMOJI"
else
    echo "❌ Missing"
fi

# 5. Check AGENT_PROFILES
echo -n "5. AGENT_PROFILES: "
if grep -q "^\s*${AGENT_ID}: {" "$FILE"; then
    SECTION_COUNT=$(sed -n "/^\s*${AGENT_ID}: {/,/^\s*},\?$/p" "$FILE" | grep -c "title:")
    echo "✅ Present - $SECTION_COUNT sections found"
else
    echo "❌ Missing"
fi

# 6. Check DESK_POSITIONS comment
echo -n "6. DESK_POSITIONS: "
if grep -q "// ${AGENT_ID^}" "$FILE"; then
    echo "✅ Position assigned"
else
    echo "⚠️  No position comment found"
fi

echo ""
echo "=========================================="
echo "Verification complete"
echo "=========================================="
