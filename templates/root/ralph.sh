#!/bin/bash
# Ralph agent loop — two independent phases, each triggered by their own condition
#
# Phase 1: tasks.json has entries  → load slice from board, update .slices/
# Phase 2: .slices/**/index.json has a "Planned" slice → build it
#
# The phases are NOT causally linked — either can trigger on its own.
#
# Usage: ./ralph.sh [project_dir]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-"$SCRIPT_DIR"}"
TASKS_FILE="$PROJECT_DIR/tasks.json"
PROMPT_FILE="$PROJECT_DIR/prompt.md"
BACKEND_PROMPT_FILE="$PROJECT_DIR/backend-prompt.md"
AGENT_SCRIPT="$PROJECT_DIR/agent.sh"

if [[ ! -f "$PROJECT_DIR/.eventmodelers/config.json" ]]; then
  echo "ERROR: No .eventmodelers/config.json found in $PROJECT_DIR"
  exit 1
fi

echo "Ralph — project: $PROJECT_DIR"

# Returns 0 if tasks.json has at least one task
has_pending_tasks() {
  [[ -f "$TASKS_FILE" ]] || return 1
  local content
  content=$(cat "$TASKS_FILE")
  [[ "$content" != "[]" && -n "$content" ]]
}

# Returns 0 if any index.json under .slices/ contains a "Planned" slice
has_planned_slices() {
  grep -rqi '"status"[[:space:]]*:[[:space:]]*"planned"' "$PROJECT_DIR/.slices/" 2>/dev/null
}

# Runs agent.sh with the given prompt; retries on non-zero exit
run_agent() {
  local label="$1"
  local prompt="$2"
  while true; do
    echo "[$(date -u +%H:%M:%S)] $label"
    (cd "$PROJECT_DIR" && bash "$AGENT_SCRIPT" "$prompt") 2>&1 && return 0
    echo "[$(date -u +%H:%M:%S)] Agent error — retrying in 60s..."
    sleep 60
  done
}

while true; do
  ran_something=false

  if has_pending_tasks; then
    run_agent "Phase 1: loading slice from board..." "$(cat "$PROMPT_FILE")"
    ran_something=true
  fi

  if has_planned_slices; then
    run_agent "Phase 2: building slice..." "$(cat "$BACKEND_PROMPT_FILE")"
    ran_something=true
  fi

  if [[ "$ran_something" == false ]]; then
    sleep 3
  fi
done