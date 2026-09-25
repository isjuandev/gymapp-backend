#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PROVISION TENANT SCHEMA SCRIPT
# ------------------------------------------------------------------------------
# Provisions a new isolated PostgreSQL schema for a gym/client and deploys
# all Prisma migrations into that schema.
#
# Usage:
#   ./scripts/provision-tenant-schema.sh <client_name>
# Example:
#   ./scripts/provision-tenant-schema.sh fitzone
#   Result: Creates schema `gym_fitzone` and runs `prisma migrate deploy`
# ==============================================================================

CLIENT_NAME="${1:-}"

if [ -z "$CLIENT_NAME" ]; then
  echo "❌ Error: Client name is required."
  echo "Usage: $0 <client_name>"
  echo "Example: $0 powergym"
  exit 1
fi

# Sanitize client name: lowercase, replace hyphens with underscores
SANITIZED_CLIENT=$(echo "$CLIENT_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')

# Validate format: letters, numbers, underscores only
if ! [[ "$SANITIZED_CLIENT" =~ ^[a-z0-9_]+$ ]]; then
  echo "❌ Error: Client name must contain only alphanumeric characters, dashes, or underscores."
  exit 1
fi

SCHEMA_NAME="gym_${SANITIZED_CLIENT}"

# Find backend root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if DATABASE_URL is not set in environment
if [ -z "${DATABASE_URL:-}" ] && [ -f "${BACKEND_DIR}/.env" ]; then
  export $(grep -v '^#' "${BACKEND_DIR}/.env" | grep -E '^DATABASE_URL=' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set and could not be loaded from .env"
  exit 1
fi

echo "=========================================================="
echo "🏋️  Provisioning tenant schema for client: '${CLIENT_NAME}'"
echo "📁 Target PostgreSQL Schema: '${SCHEMA_NAME}'"
echo "=========================================================="

# 1) Base DATABASE_URL (without existing ?schema query param)
BASE_DB_URL=$(echo "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/g; s/[?&]$//')

# Construct tenant-specific DATABASE_URL
if [[ "$BASE_DB_URL" == *"?"* ]]; then
  TENANT_DB_URL="${BASE_DB_URL}&schema=${SCHEMA_NAME}"
else
  TENANT_DB_URL="${BASE_DB_URL}?schema=${SCHEMA_NAME}"
fi

# 2) Create the schema in PostgreSQL if not exists
echo "Creating schema '${SCHEMA_NAME}' in PostgreSQL..."

BASE_DB_URL="$BASE_DB_URL" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.BASE_DB_URL }
  }
});
async function main() {
  await prisma.\$executeRawUnsafe(\`CREATE SCHEMA IF NOT EXISTS \"${SCHEMA_NAME}\";\`);
  console.log(\"✔ Schema '${SCHEMA_NAME}' verified/created successfully.\");
}
main()
  .catch((err) => {
    console.error('❌ Failed to create schema:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.\$disconnect());
"

# 3) Run Prisma migrations against the new schema
echo "Applying Prisma migrations to schema '${SCHEMA_NAME}'..."
DATABASE_URL="$TENANT_DB_URL" npx prisma migrate deploy --schema="${BACKEND_DIR}/src/prisma/schema.prisma"

echo "=========================================================="
echo "✅ Tenant schema '${SCHEMA_NAME}' provisioned successfully!"
echo "   Connection string for this instance:"
echo "   ${TENANT_DB_URL}"
echo "=========================================================="
