# ICP-Based LinkedIn Outreach Guide

A simple guide to running targeted LinkedIn outreach using Claude Code.

---

## Quick Start

Just tell Claude what you're looking for:

```
My ICP: YC founders in the US building automation tools.
Titles: CEO, Founder, Co-founder.
Bonus signals: mentions "workflow", "AI agent", or "no-code".

Search for 10 prospects, qualify them, and send invites to good fits.
```

That's it. Claude handles the rest.

---

## The Flow

```
1. Define ICP → 2. Search → 3. Qualify → 4. Send → 5. Track
```

### Step 1: Define Your ICP

Tell Claude your Ideal Customer Profile. Be specific:

```
My ICP for this outreach:

Company criteria:
- Y Combinator backed (any batch)
- Stage: Seed to Series B
- Location: North America

Role criteria:
- Titles: CEO, Founder, Co-founder, CTO

Keyword signals (in profile/headline):
- Primary: automation, workflow, AI agent
- Tools: zapier, n8n, make.com
- Pain: "manual process", "repetitive tasks"
```

### Step 2: Claude Searches

Claude uses your ICP to search LinkedIn:

```
Searching for: YC automation workflow AI agent founder CEO United States
```

Returns ~10 prospects with name, headline, company.

### Step 3: Claude Qualifies

For each prospect, Claude evaluates fit:

| Fit Level | Criteria | Action |
|-----------|----------|--------|
| ⭐ **HIGH** | Matches 4+ criteria (YC + title + keywords) | Send invite |
| 🟡 **MEDIUM** | Matches 2-3 criteria | Send invite |
| ❌ **LOW** | Matches 0-1 criteria | Skip |

Example qualification:

```
Mauricio Morales - Founder & CEO @ DailyBot (YC alum)
✅ YC alum
✅ Founder & CEO
✅ DailyBot = workflow automation
→ HIGH FIT - Send invite

Tony Cueva - Venture Partner @ Hustle Fund
❌ Not founder/CEO (VC role)
→ LOW FIT - Skip
```

### Step 4: Send Invites

Claude sends personalized connection requests to qualified leads:

```
Hi Mauricio, love what you're building with DailyBot - workflow
automation is such a pain point. Fellow YC enthusiast here.
Would love to connect!
```

### Step 5: Track Results

Check status anytime:

```
Check for new connections and show me who accepted from my outreach.
```

---

## Example Prompts

### Basic Search + Qualify + Send

```
My ICP: Series A fintech founders in NYC.
Search for 10 prospects, qualify them, and send invites to medium/high fits.
```

### Search Only (No Sending)

```
My ICP: AI startup CTOs in San Francisco, 10-50 employees.
Search for prospects and tell me who you'd recommend - don't send yet.
```

### Different Keyword Focus

```
My ICP:
- Founders/CEOs at startups
- Building with: no-code, low-code, or RPA
- Location: US or UK
- Bonus: mentions Zapier, Make, or n8n

Find 10 prospects and qualify them.
```

### Check Status

```
Show me all connection requests I've sent and their status.
```

### Follow Up

```
Check for new connections. For anyone who accepted, send a follow-up
message asking about their biggest automation challenge.
```

---

## ICP Templates

### SaaS Founders

```
My ICP:
- Role: Founder, CEO, CTO
- Company: B2B SaaS
- Stage: Seed to Series B
- Location: United States
- Signals: "automation", "workflow", "productivity"
```

### YC Startups

```
My ICP:
- Y Combinator backed (any batch)
- Role: Founder, CEO, Co-founder
- Location: North America
- Signals: "AI", "automation", "developer tools"
```

### Enterprise Buyers

```
My ICP:
- Role: VP Engineering, Director of Ops, Head of IT
- Company: 500+ employees
- Industry: Finance, Healthcare, or Manufacturing
- Signals: "digital transformation", "process improvement"
```

---

## Rate Limits

The system enforces daily limits to protect your LinkedIn account:

| Action | Daily Limit |
|--------|-------------|
| Connection Invitations | 40 |
| Messages | 80 |
| Profile Views | 90 |
| Searches | 20 |

Check your usage anytime:

```
What are my rate limits for today?
```

---

## Tips

1. **Be specific with ICP** - The more specific, the better Claude can qualify

2. **Use keyword signals** - Keywords in profile/headline are strong indicators

3. **Quality over quantity** - Better to send 10 targeted invites than 40 generic ones

4. **Check daily** - Run "check for new connections" to catch accepts quickly

5. **Personalize messages** - Reference their company/product in the invite

---

## Troubleshooting

### "HTTP 422" on invite

- Already sent an invite to this person
- Try a different prospect

### No accepts after a week

- Normal for cold outreach (10-30% accept rate)
- Try refining your ICP or message

### Rate limit reached

- Wait until tomorrow (limits reset daily)
- Focus on qualifying better, not sending more
