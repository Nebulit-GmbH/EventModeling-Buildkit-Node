---
name: load-slice
description: Load all slices from the board via the slicedata API and return the data for a specific slice by ID or title. Also refreshes the local slices/ directory so each slice is stored as a dedicated JSON file.
---

# Load Slice

> **Before doing anything else**, invoke the `connect` skill to resolve `TOKEN`, `BOARD_ID`, `ORG_ID`, and `BASE_URL`. Do not proceed until the connect skill has completed.

---

## Step 1 — Parse arguments

From `$ARGUMENTS`, extract:

| Field | How to find it | Default |
|-------|---------------|---------|
| `sliceId` | UUID of the slice (SLICE_BORDER node ID) | optional — prefer over title |
| `sliceTitle` | slice title (case-insensitive match) | optional — used if sliceId missing |

If neither is provided, return the full list of all slices without filtering.

---

## Step 2 — Fetch all slices from the slicedata API

```bash
curl -s \
  -H "x-token: <TOKEN>" \
  -H "x-board-id: <BOARD_ID>" \
  -H "x-user-id: load-slice-skill" \
  "<BASE_URL>/api/org/<ORG_ID>/boards/<BOARD_ID>/slicedata/slices"
```

Response: `{ "slices": [{ "id": "<nodeId>", "title": "<title>", "status": "<status>" }] }`

Save the full array as `ALL_SLICES`.

---

## Step 3 — Persist each slice as a dedicated file

For every slice in `ALL_SLICES`, write it to `slices/<id>.json` in the current working directory:

```bash
mkdir -p slices
```

For each slice `s` in `ALL_SLICES`:
```bash
echo '<s as JSON>' > slices/<s.id>.json
```

This keeps the local `slices/` directory in sync with the board state.

---

## Step 4 — Return the requested slice

If `sliceId` was given: find the entry in `ALL_SLICES` where `id === sliceId`.  
If `sliceTitle` was given: find the entry where `title` matches case-insensitively.  
If neither: return all slices.

If a specific slice was requested but not found, stop and list the available titles.

---

## Step 5 — Output

```
Slices loaded: <count> total, persisted to slices/

Requested slice:
  Title:  <title>
  ID:     <id>
  Status: <status>
```

Or if no filter was given:
```
All slices (<count>):
  - <title> [<status>] (<id>)
  - ...
```

Make the matched slice's `id`, `title`, and `status` available to subsequent steps in the same session.