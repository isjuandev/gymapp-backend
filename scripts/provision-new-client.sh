#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PROVISION NEW CLIENT (GYM) SCRIPT
# ------------------------------------------------------------------------------
# Orchestrates new tenant provisioning for GymApp:
# 1. Runs schema creation and Prisma migrations via provision-tenant-schema.sh
# 2. Generates unique, cryptographically secure JWT secrets for this client
# 3. Outputs explicit, step-by-step instructions for the manual configuration
#    needed in the Coolify UI dashboard.
#
# Usage:
#   ./scripts/provision-new-client.sh <client_name>
# Example:
#   ./scripts/provision-new-client.sh fitzone
# ==============================================================================

CLIENT_NAME="${1:-}"

if [ -z "$CLIENT_NAME" ]; then
  echo "❌ Error: Client name is required."
  echo "Usage: $0 <client_name>"
  echo "Example: $0 fitzone"
  exit 1
fi

# Sanitize client name: lowercase, replace dashes with underscores
SANITIZED_CLIENT=$(echo "$CLIENT_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

if ! [[ "$SANITIZED_CLIENT" =~ ^[a-z0-9_]+$ ]]; then
  echo "❌ Error: Client name must contain only alphanumeric characters, dashes, or underscores."
  exit 1
fi

SCHEMA_NAME="gym_${SANITIZED_CLIENT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=========================================================="
echo "🚀 PROVISIONING NEW CLIENT: '${CLIENT_NAME}'"
echo "=========================================================="

# ------------------------------------------------------------------------------
# Step 1: Provision Schema and Run Migrations
# ------------------------------------------------------------------------------
echo ""
echo "▶ STEP 1/2: Provisioning PostgreSQL schema & executing migrations..."
"${SCRIPT_DIR}/provision-tenant-schema.sh" "${CLIENT_NAME}"

# ------------------------------------------------------------------------------
# Step 2: Generate Unique Secrets & Configuration
# ------------------------------------------------------------------------------
echo ""
echo "▶ STEP 2/2: Generating unique cryptographic secrets..."

# Generate 256-bit (64 hex characters) secrets
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)

# Load base DATABASE_URL to derive tenant-specific string
if [ -z "${DATABASE_URL:-}" ] && [ -f "${BACKEND_DIR}/.env" ]; then
  export $(grep -v '^#' "${BACKEND_DIR}/.env" | grep -E '^DATABASE_URL=' | xargs)
fi

BASE_DB_URL=$(echo "${DATABASE_URL:-postgresql://gym_user:gym_password@localhost:5432/gym_db}" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/g; s/[?&]$//')
if [[ "$BASE_DB_URL" == *"?"* ]]; then
  TENANT_DB_URL="${BASE_DB_URL}&schema=${SCHEMA_NAME}"
else
  TENANT_DB_URL="${BASE_DB_URL}?schema=${SCHEMA_NAME}"
fi

# Replace localhost with internal docker network / server host if needed
PRODUCTION_DB_URL=$(echo "$TENANT_DB_URL" | sed 's/localhost/postgres/g; s/127\.0\.0\.1/postgres/g')

echo ""
echo "================================================================================"
echo "✅ SCHEMA & SECRETS READY FOR CLIENT: ${CLIENT_NAME}"
echo "================================================================================"
echo ""
echo "📋 CLIENT-SPECIFIC ENVIRONMENT VARIABLES (COPY TO COOLIFY):"
echo "--------------------------------------------------------------------------------"
echo "NODE_ENV=production"
echo "PORT=3000"
echo "DATABASE_URL=\"${PRODUCTION_DB_URL}\""
echo "JWT_SECRET=\"${JWT_SECRET}\""
echo "JWT_REFRESH_SECRET=\"${JWT_REFRESH_SECRET}\""
echo "--------------------------------------------------------------------------------"
echo ""
echo "🖥️  MANUAL STEPS TO COMPLETE IN COOLIFY UI (Dashboard):"
echo "--------------------------------------------------------------------------------"
echo "1. Log into your Coolify dashboard (e.g. http://<mac-mini-ip>:8000)."
echo "2. Open Project: 'GymApp' -> Environment: 'Production'."
echo ""
echo "3. Option A (Recommended - Duplicate Template):"
echo "   - Click on your 'gymapp-template' application."
echo "   - Click 'Actions' (three dots) -> 'Duplicate'."
echo "   - Rename the new app to: 'gymapp-${SANITIZED_CLIENT}'."
echo ""
echo "   Option B (New Application from Git):"
echo "   - Click '+ New' -> 'Application' -> 'Public Repository' (or Private GitHub App)."
echo "   - Repository: <your-repo-url> | Branch: main | Build Pack: Dockerfile"
echo "   - Base Directory: /backend (or / if standalone repo)"
echo "   - Dockerfile Location: /backend/Dockerfile"
echo ""
echo "4. Set Domains (FQDN):"
echo "   - In 'Domains', enter: https://${SANITIZED_CLIENT}.api.gymapp.com"
echo "   - (Ensure DNS CNAME/A record for '${SANITIZED_CLIENT}.api.gymapp.com' points to your Mac mini / Multipass IP)"
echo ""
echo "5. Configure Environment Variables:"
echo "   - Go to the 'Environment Variables' tab."
echo "   - Paste the 5 variables shown in the box above."
echo "   - Save changes."
echo ""
echo "6. Deploy:"
echo "   - Click 'Deploy'."
echo "   - Monitor build and runtime logs."
echo "   - Verify health check: curl -f https://${SANITIZED_CLIENT}.api.gymapp.com/health"
echo "================================================================================"
