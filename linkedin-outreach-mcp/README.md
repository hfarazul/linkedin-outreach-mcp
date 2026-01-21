# LinkedIn Outreach MCP Server

An MCP (Model Context Protocol) server that enables Claude Code to automate LinkedIn outreach via the Unipile API. Search for prospects, send personalized connection requests, and run multi-step outreach campaigns - all through natural language conversation with Claude.

## Table of Contents

- [What This Does](#what-this-does)
- [How It Works](#how-it-works)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Available Tools](#available-tools)
- [Rate Limits](#rate-limits)
- [Troubleshooting](#troubleshooting)

---

## What This Does

This MCP server turns Claude Code into a LinkedIn outreach assistant. Instead of manually searching for leads, sending connection requests, and following up, you can simply tell Claude what you want:

```
"Find founders in AI/fintech in the US and send them connection requests"
```

Claude will:
1. Search LinkedIn for matching profiles
2. Save them as prospects
3. Send personalized connection invitations
4. Track everything in a local database

### Use Cases

- **Sales prospecting**: Find and connect with potential customers
- **Recruiting**: Search for candidates and reach out
- **Networking**: Build connections in your industry
- **Partnership outreach**: Connect with potential partners at scale

---

## How It Works

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   MCP Server    │────▶│   Unipile API   │
│  (Your prompts) │     │  (This repo)    │     │   (LinkedIn)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   SQLite DB     │
                        │  (Local data)   │
                        └─────────────────┘
```

1. **Claude Code** receives your natural language request
2. **MCP Server** translates it into LinkedIn actions via tools
3. **Unipile API** executes actions on LinkedIn (search, invite, message)
4. **SQLite Database** stores prospects, sequences, and action history locally

### Data Flow

```
Search Request → Unipile API → Prospects saved to DB
                                      ↓
                              Enroll in Sequence
                                      ↓
                              Run Sequence Actions
                                      ↓
                    ┌─────────────────────────────────┐
                    │  visit_profile → send_invitation │
                    │        ↓                         │
                    │  wait_for_acceptance             │
                    │        ↓                         │
                    │  send_message → send_followup    │
                    └─────────────────────────────────┘
```

### Key Components

| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server + 16 tool implementations |
| `src/unipile-client.ts` | Unipile REST API wrapper |
| `src/db/schema.ts` | SQLite database operations |
| `outreach.db` | Local database (created on first run) |

---

## Features

### Core Capabilities

- **LinkedIn Search**: Find prospects by keywords, job title, company, location
- **Profile Viewing**: View detailed profile information
- **Connection Requests**: Send personalized invitations (300 char limit)
- **Direct Messaging**: Message your connections
- **Prospect Management**: Save, tag, and organize leads

### Automation Features

- **Outreach Sequences**: Multi-step campaigns that run automatically
- **Rate Limiting**: Built-in safeguards to protect your LinkedIn account
- **Action Logging**: Full audit trail of all activities
- **Personalization**: Template variables like `{{first_name}}`, `{{company}}`

### Sequence Step Types

| Step | Description |
|------|-------------|
| `visit_profile` | View prospect's profile (shows up in "Who viewed your profile") |
| `send_invitation` | Send connection request with optional message |
| `wait_for_acceptance` | Pause until they accept (with timeout) |
| `send_message` | Send a direct message (must be connected) |
| `send_followup` | Send a follow-up message |
| `delay` | Wait N days before next step |

---

## Prerequisites

### 1. Unipile Account

Unipile provides the API that connects to LinkedIn.

1. Sign up at [unipile.com](https://www.unipile.com/)
2. From the dashboard, get:
   - **API Key** (Settings → API)
   - **DSN** (e.g., `api8.unipile.com:13851`)
3. Connect your LinkedIn account via "Hosted Auth"
4. Copy your **Account ID** after connecting

### 2. LinkedIn Account

- Use a **real, established account** (new/fake accounts get banned)
- **150+ connections** recommended for better reach
- Active account with consistent usage history
- LinkedIn Premium helps but isn't required

### 3. Claude Code

- Install [Claude Code CLI](https://claude.ai/claude-code)
- Have MCP servers enabled

---

## Installation

```bash
# Clone the repository
git clone https://github.com/hfarazul/linkedin-outreach-mcp.git
cd linkedin-outreach-mcp/linkedin-outreach-mcp

# Install dependencies
npm install

# Build the TypeScript
npm run build
```

---

## Configuration

### 1. Create Environment File (Optional)

```bash
cp .env.example .env
```

Edit `.env`:
```
UNIPILE_API_KEY=your-api-key-here
UNIPILE_DSN=api8.unipile.com:13851
UNIPILE_ACCOUNT_ID=your-account-id-here
```

### 2. Configure Claude Code

Add to your Claude Code MCP config file:

**Location**: `~/.claude.json` or `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linkedin-outreach": {
      "command": "node",
      "args": ["/full/path/to/linkedin-outreach-mcp/dist/index.js"],
      "env": {
        "UNIPILE_API_KEY": "your-api-key-here",
        "UNIPILE_DSN": "api8.unipile.com:13851",
        "UNIPILE_ACCOUNT_ID": "your-account-id-here"
      }
    }
  }
}
```

### 3. Restart Claude Code

After updating the config, restart Claude Code to load the MCP server.

---

## Usage Examples

### Example 1: Basic Prospect Search

**You say:**
```
Search for software engineers at Google in San Francisco
```

**Claude does:**
- Calls `search_linkedin` with keywords, title, location
- Saves 10 prospects to the database
- Shows you the results

---

### Example 2: Send Connection Requests

**You say:**
```
Send connection requests to the engineers we just found with a message about
wanting to learn about their work on AI projects
```

**Claude does:**
- Gets the prospects from the database
- Sends personalized invitations to each
- Tracks rate limits (max 40/day)

---

### Example 3: Create an Outreach Campaign

**You say:**
```
Create an outreach sequence for founders:
1. First, view their profile
2. Next day, send a connection request saying "Hi {{first_name}}, I'm impressed by what you're building at {{company}}. Would love to connect!"
3. Wait up to 7 days for them to accept
4. Once connected, send a message asking about their biggest challenge
5. If no reply after 5 days, send a gentle follow-up
```

**Claude does:**
- Creates a sequence with 5 steps
- Configures delays and timeouts
- Saves it as a draft

---

### Example 4: Run a Full Campaign

**You say:**
```
1. Search for AI startup founders in New York
2. Create an outreach sequence for them
3. Enroll all the prospects
4. Activate and run the first batch of actions
```

**Claude does:**
```
Step 1: Searches LinkedIn → finds 10 founders
Step 2: Creates sequence with profile visit, invitation, follow-up
Step 3: Enrolls all 10 prospects
Step 4: Activates sequence and runs profile visits
```

---

### Example 5: Daily Outreach Routine

**You say:**
```
Check for new connections, then run today's pending sequence actions
```

**Claude does:**
- Calls `check_new_connections` to detect accepts
- Updates prospect status for anyone who accepted
- Runs `run_sequence_actions` to execute pending steps
- Reports what was done

---

### Example 6: Monitor Progress

**You say:**
```
Show me the status of my campaigns and today's rate limit usage
```

**Claude shows:**
```
Campaign: AI Founders Outreach
- Status: Active
- Enrolled: 25 prospects
- In Progress: 18
- Connected: 5
- Completed: 2

Today's Usage:
- Invitations: 12/40
- Messages: 3/80
- Profile Views: 25/90
```

---

## Available Tools

### Search & Profiles

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_linkedin` | Search for prospects | `keywords`, `title`, `company`, `location`, `source_tag` |
| `get_profile` | Get detailed profile | `identifier` (URL, username, or ID) |
| `get_prospects` | List saved prospects | `source_search`, `is_connection`, `limit` |
| `update_prospect` | Add tags/notes | `prospect_id`, `tags`, `notes` |

### Connections & Messages

| Tool | Description | Parameters |
|------|-------------|------------|
| `send_invitation` | Send connection request | `prospect_id`, `message` (max 300 chars) |
| `check_new_connections` | Detect accepted invites | (none) |
| `send_message` | Message a connection | `prospect_id`, `message` |

### Sequences (Campaigns)

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_sequence` | Create outreach campaign | `name`, `description`, `steps` |
| `list_sequences` | List all sequences | `status` filter |
| `activate_sequence` | Start a sequence | `sequence_id` |
| `pause_sequence` | Pause a sequence | `sequence_id` |
| `enroll_prospects` | Add prospects to sequence | `sequence_id`, `prospect_ids` or `source_search` |
| `run_sequence_actions` | Execute pending actions | `sequence_id`, `max_actions` |
| `get_sequence_status` | View campaign metrics | `sequence_id` |

### Monitoring

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_daily_limits` | Check rate limit usage | (none) |
| `get_action_history` | View recent actions | `action_type`, `limit` |

---

## Rate Limits

Conservative limits to protect your LinkedIn account from restrictions:

| Action | Daily Limit | Weekly Limit |
|--------|-------------|--------------|
| Connection Invitations | 40 | 180 |
| Messages | 80 | - |
| Profile Views | 90 | - |
| Searches | 20 | - |

The server enforces these automatically. If you hit a limit, it will return an error message telling you to wait.

---

## Message Templates

Personalize your messages with these placeholders:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{first_name}}` | First name | "John" |
| `{{last_name}}` | Last name | "Doe" |
| `{{full_name}}` | Full name | "John Doe" |
| `{{company}}` | Current company | "Acme Inc" |
| `{{headline}}` | LinkedIn headline | "CEO at Acme" |

**Example message:**
```
Hi {{first_name}}, I noticed you're leading {{company}}.
I'd love to connect and learn more about your work!
```

---

## Data Storage

All data is stored locally in SQLite:

| Table | Contents |
|-------|----------|
| `prospects` | Saved LinkedIn profiles |
| `sequences` | Outreach campaign definitions |
| `sequence_enrollments` | Prospect journey through campaigns |
| `actions_log` | Audit trail of all actions |
| `known_connections` | Cache of your LinkedIn connections |
| `rate_limits` | Daily/weekly action counters |

**Location:** `outreach.db` in the project directory

**Privacy:** No data is sent to third parties except through the Unipile API to LinkedIn.

---

## Troubleshooting

### "Unipile not configured"

Ensure all three environment variables are set:
- `UNIPILE_API_KEY`
- `UNIPILE_DSN`
- `UNIPILE_ACCOUNT_ID`

### "HTTP 422" on invitations

This usually means:
- You already sent an invitation to this person
- The person has restricted who can send them invitations
- Try with a different prospect

### Rate limit errors

Check your usage with `get_daily_limits`. Either:
- Wait until tomorrow (limits reset daily)
- Reduce your outreach volume

### "Not connected with this person"

You can only message people who accepted your connection. Use sequences with `wait_for_acceptance` to handle this automatically.

### Session expired

If Unipile returns authentication errors:
1. Go to the Unipile dashboard
2. Reconnect your LinkedIn account
3. Update your `UNIPILE_ACCOUNT_ID` if it changed

### Sequence actions not running

Check that:
1. The sequence is `active` (not `draft` or `paused`)
2. Prospects are enrolled
3. The `next_action_at` time has passed
4. You're calling `run_sequence_actions`

---

## Development

```bash
# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## License

MIT

---

## Disclaimer

This tool is for legitimate business networking and outreach. Always:
- Respect LinkedIn's Terms of Service
- Don't spam or harass people
- Keep your outreach relevant and valuable
- Honor unsubscribe/stop requests immediately

Use responsibly.
