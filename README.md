# @eventmodelers/agent-kit

Real-time Claude agent + skill kit for the [Eventmodelers](https://eventmodelers.de) platform.

## Quick start

```bash
npx @eventmodelers/node-kit install
```

The installer will prompt for:
- **API token** — from your workspace settings
- **Organization ID** — UUID from your workspace
- **Base URL** — defaults to `https://api.eventmodelers.de`

After installation:

1. Start the real-time agent:
   ```bash
   cd realtime-agent && npm install && npm run dev
   ```

2. Open Claude Code in this directory — skills are available immediately.

## What gets installed

| Path | Description |
|------|-------------|
| `.eventmodelers/config.json` | Your token + org (gitignored) |
| `.claude/skills/connect` | Resolves board config for all other skills |
| `.claude/skills/timeline` | Live event storming facilitator |
| `.claude/skills/wdyt` | Business analyst review of your event model |
| `.claude/skills/storyboard` | Generate visual storyboards |
| `.claude/skills/storyboard-screen` | Design individual wireframe screens |
| `.claude/skills/place-element` | Place commands/events/read models on the board |
| `.claude/skills/learn-eventmodelers-api` | Full API reference for agent use |
| `realtime-agent/` | Node.js agent that listens for prompts via Supabase Realtime |

## Skills

Use skills in Claude Code with `/skill-name`:

- `/connect` — set up board connection
- `/timeline` — guided event storming session
- `/wdyt` — "what do you think?" business analysis
- `/storyboard` — build a full visual storyboard
- `/place-element` — place a specific element on the timeline

## Real-time agent

The real-time agent connects to your organization's Supabase Realtime channel and processes prompts sent from the Eventmodelers platform. It spawns `claude --dangerously-skip-permissions` for each prompt and acknowledges completion.

```bash
cd realtime-agent
npm install
npm run dev           # development (tsx)
npm run build && npm start  # production
```

## Commands

```bash
npx @eventmodelers/agent-kit install    # install + configure
npx @eventmodelers/agent-kit status     # check what's installed
npx @eventmodelers/agent-kit uninstall  # remove installed files
```
