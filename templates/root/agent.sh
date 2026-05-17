#!/bin/bash
# Runs the AI agent with the given prompt.
# Usage: ./agent.sh "<prompt>"
# Override by replacing this script with your own implementation.

set -euo pipefail

PROMPT="${1:-}"

if [[ -z "$PROMPT" ]]; then
  echo "ERROR: No prompt provided"
  exit 1
fi

claude "$PROMPT"