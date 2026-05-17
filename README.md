# @eventmodelers/node-kit

Real-time Claude agent + skill kit for the [Eventmodelers](https://eventmodelers.de) platform. Connect your board to a fully autonomous coding agent that picks up slice status changes, implements the code, and marks work done — all without manual intervention.

---

## How it works

```
Board (Eventmodelers)
  │  slice status → "Planned"
  ▼
Realtime Agent  ──────────────────► tasks.json
  │  listens on Supabase channel         │
  │  writes task on slice:changed        │
  ▼                                      ▼
ralph.sh loop ◄────────────────── Phase 1: load slice
  │  checks tasks.json every 3s          reads task → runs /connect + /load-slice
  │                                      fetches slice definition to .slices/
  │                                      removes task from tasks.json
  │
  ▼
Phase 2: build slice
  checks .slices/**/index.json for status "Planned"
  → sets status "InProgress" on board
  → runs /build-state-change, /build-state-view, or /build-automation
  → runs quality checks (build + test)
  → commits, merges to main
  → sets status "Done" on board
  → waits for the next slice
```

---

## Step 1 — Install

Run the installer in your project directory:

```bash
npx @eventmodelers/node-kit install
```

The installer will ask for three values:

| Prompt | Where to find it |
|--------|-----------------|
| **API token** | Workspace Settings → API Tokens |
| **Organization ID** | URL bar in your Eventmodelers workspace: `.../org/<UUID>/...` |
| **Base URL** | Default: `https://api.eventmodelers.de` |

What gets written to disk:

| Path | Purpose |
|------|---------|
| `.eventmodelers/config.json` | Your credentials (gitignored automatically) |
| `.claude/skills/connect` | Resolves board config for all other skills |
| `.claude/skills/load-slice` | Fetches slice definitions from the board |
| `.claude/skills/update-slice-status` | Changes a slice's status on the board |
| `.claude/skills/build-state-change` | Implements command handler slices |
| `.claude/skills/build-state-view` | Implements projection/read model slices |
| `.claude/skills/build-automation` | Implements reactor/automation slices |
| `.claude/skills/learn-eventmodelers-api` | Full API reference for the agent |
| `realtime-agent/` | Node.js listener for board events |
| `ralph.sh` | The main agent loop |
| `prompt.md` | Phase 1 instructions (load slice) |
| `backend-prompt.md` | Phase 2 instructions (build slice) |
| `AGENT.md` | Accumulated learnings across iterations |

---

## Step 2 — Install realtime agent dependencies

```bash
cd realtime-agent && npm install
```

---

## Step 3 — Connect the realtime agent

Start the realtime agent from your project root. It connects to the Eventmodelers Supabase channel for your board and listens for `slice:changed` events.

```bash
cd realtime-agent && npm run dev
```

On startup the agent:
1. Reads `.eventmodelers/config.json`
2. Fetches platform config and a short-lived realtime auth token from the API
3. Persists all current board slices to `slices/<id>.json`
4. Subscribes to the private channel `board:<boardId>-slicechanged`
5. Refreshes the realtime token automatically every 10 minutes

You should see output like:

```
[agent] Starting — org=..., board=..., base=https://api.eventmodelers.de, cwd=...
[agent] Persisted 12 slice(s) to .../slices
[agent] Realtime channel "board:d886f...-slicechanged" status: SUBSCRIBED
```

Keep this process running. It is the bridge between your board and the agent loop.

---

## Step 4 — Start the ralph loop

Open a second terminal and start the main loop:

```bash
./ralph.sh
```

The loop runs forever (pass an iteration count to limit it: `./ralph.sh 5`). It polls every 3 seconds when idle, waiting for either pending tasks or planned slices.

```
Ralph — project: /your/project
[12:00:00] idle — sleeping 3s
[12:00:03] idle — sleeping 3s
```

---

## The full flow — end to end

### Trigger: change a slice status on the board

Open your Eventmodelers board, find a slice, and set its status to **Planned** (or any other status your workflow uses).

The moment you save the change, the board broadcasts a `slice:changed` event over Supabase Realtime.

---

### Realtime agent picks it up → writes `tasks.json`

The realtime agent receives the broadcast payload:

```json
{
  "event": "slice:changed",
  "organizationId": "48b548e9-...",
  "boardId": "d886f666-...",
  "sliceId": "a3f2c891-...",
  "sliceTitle": "Place Order",
  "sliceStatus": "Planned",
  "timestamp": 1716000000000
}
```

It immediately:
1. Re-fetches all slices and updates local `slices/` snapshots
2. Appends a new task entry to `tasks.json`:

```json
[
  {
    "id": "uuid-...",
    "createdAt": "2026-05-17T12:00:01.000Z",
    "payload": {
      "event": "slice:changed",
      "boardId": "d886f666-...",
      "sliceId": "a3f2c891-...",
      "sliceTitle": "Place Order",
      "sliceStatus": "Planned",
      "timestamp": 1716000000000
    }
  }
]
```

Terminal output:
```
[agent] slice:changed — slice="Place Order" status="Planned"
[agent] Persisted 12 slice(s) to .../slices
[agent] Task uuid-... written — slice="Place Order" status="Planned"
```

---

### Phase 1: ralph loop loads the slice

The ralph loop detects a non-empty `tasks.json` and runs **Phase 1** — the `prompt.md` agent:

```
[12:00:04] Phase 1: loading slice from board...
```

The agent:
1. Reads `AGENT.md` to load accumulated learnings
2. Reads `tasks.json`, picks the oldest task
3. Runs `/connect` → resolves token, board ID, org ID, base URL from `.eventmodelers/config.json`
4. Runs `/load-slice sliceId=a3f2c891-...` → fetches full slice definition from the board API and writes it to `.slices/<context>/Place-Order/slice.json`
5. Updates `.slices/<context>/index.json` with the slice metadata and status
6. Removes the completed task from `tasks.json` (writes `[]` if last task)
7. Appends a progress entry to `progress.txt`
8. Updates `AGENT.md` with any new learnings

---

### Phase 2: ralph loop implements the slice

In the next cycle the loop checks `.slices/**/index.json` for any slice with `"status": "Planned"`. It finds the "Place Order" slice and runs **Phase 2** — the `backend-prompt.md` agent:

```
[12:00:08] Phase 2: building slice...
```

**Set status to InProgress**

The agent picks the highest-priority Planned slice and immediately:
- Updates `.slices/<context>/index.json` → `"status": "InProgress"`
- Calls `/update-slice-status` → sets the slice status to **InProgress** on the board

You will see the slice change color on the board in real time.

**Determine slice type and run matching skill**

The agent reads `.slices/<context>/Place-Order/slice.json` and determines the slice type:

| Slice type | Trigger condition | Skill used |
|-----------|-------------------|-----------|
| State change | Has `commands[]` entries | `/build-state-change` |
| State view | Has `readModel{}` definition | `/build-state-view` |
| Automation | Has non-empty `processors[]` | `/build-automation` |

The matching skill is loaded and guides the implementation step by step — event types, command handler, tests, DB migration, and route.

**Implement, test, commit**

The agent:
1. Writes progress to `progress.txt` after each step
2. Implements the slice following the JSON definition as the source of truth
3. Runs `npm run build` and `npm run test` (slice tests only)
4. Commits with message `feat: Place Order`
5. Merges the feature branch back to main

**Set status to Done**

After a successful commit:
- Updates `.slices/<context>/index.json` → `"status": "Done"`
- Calls `/update-slice-status` → sets the slice status to **Done** on the board

You will see the slice turn green on the board.

**Log and wait**

The agent appends a final progress entry to `progress.txt` and updates `AGENT.md` with reusable learnings. If no more Planned slices exist it replies with `<promise>NO_TASKS</promise>` and the loop goes back to idle, polling every 3 seconds for the next change.

```
[12:04:21] idle — sleeping 3s
[12:04:24] idle — sleeping 3s
```

---

## Project files reference

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `.eventmodelers/config.json` | installer / `/connect` | all skills, realtime agent | credentials |
| `tasks.json` | realtime agent | Phase 1 agent | task queue |
| `slices/<id>.json` | realtime agent | Phase 1 agent | raw board slice snapshots |
| `.slices/<ctx>/index.json` | `/load-slice` skill | Phase 2 agent | slice metadata + status |
| `.slices/<ctx>/<folder>/slice.json` | `/load-slice` skill | build skills | full slice definition |
| `progress.txt` | Phase 1 + 2 agents | Phase 2 agent (patterns section) | work log |
| `AGENT.md` | Phase 1 + 2 agents | both agents at startup | accumulated learnings |
| `prompt.md` | installer | ralph.sh (Phase 1) | Phase 1 agent instructions |
| `backend-prompt.md` | installer | ralph.sh (Phase 2) | Phase 2 agent instructions |

---

## Skills reference

| Skill | Invoke as | What it does |
|-------|-----------|-------------|
| `connect` | `/connect` | Resolves and persists board credentials |
| `load-slice` | `/load-slice sliceId=<uuid>` | Fetches slice definition, writes to `.slices/` |
| `update-slice-status` | `/update-slice-status` | Changes a slice's status on the board |
| `build-state-change` | `/build-state-change` | Implements a command handler slice |
| `build-state-view` | `/build-state-view` | Implements a projection / read model slice |
| `build-automation` | `/build-automation` | Implements a reactor / automation slice |
| `learn-eventmodelers-api` | `/learn-eventmodelers-api` | Loads the full Eventmodelers API reference |

---

## CLI commands

```bash
npx @eventmodelers/node-kit install    # install and configure
npx @eventmodelers/node-kit status     # check what is installed
npx @eventmodelers/node-kit uninstall  # remove all installed files
```

---

## Slice statuses

| Status | Meaning |
|--------|---------|
| `Created` | Slice exists on the board, not yet planned |
| `Planned` | Queued for the agent — triggers Phase 2 |
| `InProgress` | Agent is currently implementing |
| `Review` | Implementation complete, awaiting review |
| `Done` | Fully implemented and merged |
| `Blocked` | Waiting on an external dependency |
| `Assigned` | Assigned to a specific person |
| `Informational` | Documentation-only slice, not implemented |