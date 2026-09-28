#!/usr/bin/env bash
# Plan consistency repair runner (Fase 2, invariant verifier).
#
# Idempotent: repairing an already consistent database changes nothing
# (the API checks first and only acts on violations; history rows are never
# deleted). Default mode is dry-run (report only).
#
# Usage:
#   API_BASE=https://gymapp-api.nexobite.com ADMIN_TOKEN=<jwt> ./scripts/plan-consistency.sh [report|repair] [--apply] [--limit N]
#
# Examples:
#   ./scripts/plan-consistency.sh report
#   ./scripts/plan-consistency.sh repair            # dry-run
#   ./scripts/plan-consistency.sh repair --apply    # apply repairs
set -euo pipefail

API_BASE="${API_BASE:-https://gymapp-api.nexobite.com}"
MODE="${1:-report}"
APPLY=false
LIMIT=500
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=true ;;
    --limit) shift ;;
  esac
done
# --limit N parsing (supports both "--limit N" and "--limit=N")
for ((i=1; i<=$#; i++)); do
  if [[ "${!i}" == "--limit" ]]; then
    j=$((i+1)); LIMIT="${!j}"
  elif [[ "${!i}" == --limit=* ]]; then
    LIMIT="${!i#--limit=}"
  fi
done

if [[ -z "${ADMIN_TOKEN:-}" ]]; then
  echo "ERROR: ADMIN_TOKEN env var is required (JWT of an ADMIN user)." >&2
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"

if [[ "$MODE" == "report" ]]; then
  echo "== Plan consistency report (limit=$LIMIT) =="
  curl -sS -H "$AUTH_HEADER" "$API_BASE/admin/integrity/plan-consistency?limit=$LIMIT" | head -c 20000
  echo
elif [[ "$MODE" == "repair" ]]; then
  if [[ "$APPLY" == "true" ]]; then
    echo "== Applying plan consistency repairs (limit=$LIMIT) =="
    curl -sS -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -d "{\"dryRun\": false, \"limit\": $LIMIT}" \
      "$API_BASE/admin/integrity/plan-consistency/repair" | head -c 20000
    echo
  else
    echo "== Repair dry-run (no changes, limit=$LIMIT) =="
    curl -sS -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
      -d "{\"dryRun\": true, \"limit\": $LIMIT}" \
      "$API_BASE/admin/integrity/plan-consistency/repair" | head -c 20000
    echo
  fi
else
  echo "Usage: $0 [report|repair] [--apply] [--limit N]" >&2
  exit 1
fi
