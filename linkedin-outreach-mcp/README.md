# LinkedIn Outreach MCP Server

An MCP (Model Context Protocol) server that enables Claude Code to automate LinkedIn outreach via the Unipile API.

## Features

- **LinkedIn Search**: Find prospects by keywords, title, company, location
- **Prospect Management**: Save and organize prospects with tags
- **Connection Invitations**: Send personalized connection requests
- **Messaging**: Send messages to connections
- **Sequence Management**: Create multi-step outreach campaigns
- **Rate Limiting**: Built-in safeguards to stay within LinkedIn limits
- **Action Logging**: Track all outreach activities

## Prerequisites

### 1. Unipile Account

1. Sign up at [unipile.com](https://www.unipile.com/)
2. Get your credentials from the dashboard:
   - **API Key**
   - **DSN** (e.g., `api8.unipile.com:13851`)
3. Connect your LinkedIn account via Hosted Auth
4. Note your **Account ID** after connecting

### 2. LinkedIn Account Requirements

- Use a **real, established account** (fake accounts get banned)
- **150+ connections** recommended
- Active account with consistent history

## Installation

```bash
# Clone or navigate to the project
cd linkedin-outreach-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

### Claude Code MCP Config

Add to your Claude Code MCP configuration (`~/.claude/claude_desktop_config.json` or similar):

```json
{
  "mcpServers": {
    "linkedin-outreach": {
      "command": "node",
      "args": ["/path/to/linkedin-outreach-mcp/dist/index.js"],
      "env": {
        "UNIPILE_API_KEY": "your-api-key-here",
        "UNIPILE_DSN": "api8.unipile.com:13851",
        "UNIPILE_ACCOUNT_ID": "your-account-id-here"
      }
    }
  }
}
```

Replace:
- `/path/to/linkedin-outreach-mcp` with the actual path
- `your-api-key-here` with your Unipile API key
- `api8.unipile.com:13851` with your DSN
- `your-account-id-here` with your LinkedIn account ID from Unipile

## Available Tools

### Search & Profiles

| Tool | Description |
|------|-------------|
| `search_linkedin` | Search LinkedIn for prospects |
| `get_profile` | Get detailed profile info |
| `get_prospects` | List saved prospects |
| `update_prospect` | Add tags/notes to prospects |

### Connections & Messages

| Tool | Description |
|------|-------------|
| `send_invitation` | Send connection request |
| `check_new_connections` | Detect accepted invitations |
| `list_sent_invitations` | View pending invitations |
| `send_message` | Message a connection |

### Sequences (Campaigns)

| Tool | Description |
|------|-------------|
| `create_sequence` | Create an outreach sequence |
| `list_sequences` | List all sequences |
| `activate_sequence` | Start a sequence |
| `pause_sequence` | Pause a sequence |
| `enroll_prospects` | Add prospects to a sequence |
| `run_sequence_actions` | Execute pending actions |
| `get_sequence_status` | View campaign metrics |

### Monitoring

| Tool | Description |
|------|-------------|
| `get_daily_limits` | Check rate limit usage |
| `get_action_history` | View recent actions |

## Usage Examples

### Find Prospects

```
"Search LinkedIn for CTOs at Series A startups in San Francisco"
```

### Create a Campaign

```
"Create an outreach sequence called 'CTO Outreach' with:
1. Send connection request with message 'Hi {{first_name}}, I noticed you're leading engineering at {{company}}...'
2. Wait for acceptance (7 days timeout)
3. Send message 'Thanks for connecting! I'd love to share...'
4. Wait 3 days
5. Send followup 'Following up on my previous message...'"
```

### Run Daily Outreach

```
"Run today's outreach actions for all active sequences"
```

### Check Campaign Status

```
"Show me the status of my CTO Outreach campaign"
```

## Rate Limits

Built-in conservative limits to protect your LinkedIn account:

| Action | Daily Limit | Weekly Limit |
|--------|-------------|--------------|
| Invitations | 40 | 180 |
| Messages | 80 | - |
| Profile Views | 90 | - |
| Searches | 20 | - |

## Data Storage

- SQLite database at `outreach.db` in the project directory
- Stores: prospects, sequences, enrollments, action logs
- All data is local - nothing sent to third parties except Unipile/LinkedIn

## Sequence Step Types

| Type | Description |
|------|-------------|
| `visit_profile` | View the prospect's profile |
| `send_invitation` | Send connection request |
| `wait_for_acceptance` | Wait for connection to accept |
| `send_message` | Send a direct message |
| `send_followup` | Send a follow-up message |
| `delay` | Wait before next step |

### Message Templates

Use placeholders for personalization:
- `{{first_name}}` - Prospect's first name
- `{{last_name}}` - Prospect's last name
- `{{full_name}}` - Full name
- `{{company}}` - Current company
- `{{headline}}` - LinkedIn headline

## Troubleshooting

### "Unipile not configured"
Ensure all three environment variables are set:
- `UNIPILE_API_KEY`
- `UNIPILE_DSN`
- `UNIPILE_ACCOUNT_ID`

### Rate limit errors
Check your current usage with `get_daily_limits`. Wait until the next day or reduce activity.

### "Not connected with this person"
You can only message people who have accepted your connection request. Use sequences with `wait_for_acceptance` step.

### Session expired
If Unipile returns authentication errors, reconnect your LinkedIn account in the Unipile dashboard.

## License

MIT
