#!/bin/bash
#
# LinkedIn Outreach Runner - Claude Code Hook Setup
#
# This script configures a Claude Code SessionStart hook that
# automatically runs the outreach sequence actions when you start
# a Claude Code session.
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}LinkedIn Outreach - Claude Code Hook Setup${NC}"
echo "============================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_PATH="$SCRIPT_DIR/dist/runner.js"

# Check if runner exists
if [ ! -f "$RUNNER_PATH" ]; then
    echo -e "${YELLOW}Warning: Runner not found at $RUNNER_PATH${NC}"
    echo "Running npm build first..."
    cd "$SCRIPT_DIR"
    npm run build
fi

# Claude Code settings locations
CLAUDE_SETTINGS_DIR="$HOME/.claude"
CLAUDE_SETTINGS_FILE="$CLAUDE_SETTINGS_DIR/settings.json"
CLAUDE_SETTINGS_LOCAL="$CLAUDE_SETTINGS_DIR/settings.local.json"

# Create .claude directory if it doesn't exist
mkdir -p "$CLAUDE_SETTINGS_DIR"

# Check if we should use local or global settings
echo "Where would you like to add the hook?"
echo "  1) Global settings (~/.claude/settings.json) - applies to all projects"
echo "  2) Local settings (~/.claude/settings.local.json) - personal, not shared"
echo ""
read -p "Choice [1/2]: " choice

case $choice in
    2)
        TARGET_FILE="$CLAUDE_SETTINGS_LOCAL"
        ;;
    *)
        TARGET_FILE="$CLAUDE_SETTINGS_FILE"
        ;;
esac

echo ""
echo -e "Using: ${BLUE}$TARGET_FILE${NC}"

# Create the hook configuration
HOOK_CONFIG=$(cat <<EOF
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node $RUNNER_PATH 2>&1 | head -50"
          }
        ]
      }
    ]
  }
}
EOF
)

# Check if file exists and has content
if [ -f "$TARGET_FILE" ] && [ -s "$TARGET_FILE" ]; then
    echo ""
    echo -e "${YELLOW}Existing settings file found.${NC}"
    echo ""
    echo "The hook configuration to add is:"
    echo ""
    echo "$HOOK_CONFIG"
    echo ""
    echo -e "${YELLOW}Please manually merge this into your existing settings file:${NC}"
    echo -e "${BLUE}$TARGET_FILE${NC}"
    echo ""
    echo "Or backup and replace:"
    echo "  cp $TARGET_FILE $TARGET_FILE.backup"
    echo "  # Then manually edit to merge hooks"
else
    # Create new settings file
    echo "$HOOK_CONFIG" > "$TARGET_FILE"
    echo ""
    echo -e "${GREEN}Hook configuration written to $TARGET_FILE${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Ensure environment variables are set in your Claude Code MCP config"
echo "  2. Restart Claude Code"
echo "  3. The runner will execute automatically when you start a session"
echo ""
echo "To test manually:"
echo "  cd $SCRIPT_DIR"
echo "  npm run runner"
echo ""

# Show cron setup instructions
echo -e "${BLUE}Cron Job Setup (Optional)${NC}"
echo "========================="
echo ""
echo "To run the outreach daily at 9am, add this to your crontab:"
echo ""
echo "  crontab -e"
echo ""
echo "Then add this line:"
echo ""
echo "  0 9 * * * UNIPILE_API_KEY='your-key' UNIPILE_DSN='your-dsn' UNIPILE_ACCOUNT_ID='your-id' node $RUNNER_PATH >> $HOME/.claude/outreach.log 2>&1"
echo ""
echo "Or source your env file:"
echo ""
echo "  0 9 * * * source ~/.env && node $RUNNER_PATH >> $HOME/.claude/outreach.log 2>&1"
echo ""
