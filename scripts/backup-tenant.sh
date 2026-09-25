#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TENANT BACKUP SCRIPT
# ------------------------------------------------------------------------------
# Backs up an isolated PostgreSQL tenant schema using pg_dump and uploads
# the compressed archive to external/offsite storage.
#
# RULE: Never leave the backup solely on the same machine (Mac mini) running
# production containers!
#
# Usage:
#   ./scripts/backup-tenant.sh <client_name>
# Example:
#   ./scripts/backup-tenant.sh fitzone
# ==============================================================================

CLIENT_NAME="${1:-}"

if [ -z "$CLIENT_NAME" ]; then
  echo "❌ Error: Client name is required."
  echo "Usage: $0 <client_name>"
  echo "Example: $0 fitzone"
  exit 1
fi

SANITIZED_CLIENT=$(echo "$CLIENT_NAME" | tr '[:upper:]' '[:lower:]' | tr '-' '_')
SCHEMA_NAME="gym_${SANITIZED_CLIENT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load .env if DATABASE_URL is not set
if [ -z "${DATABASE_URL:-}" ] && [ -f "${BACKEND_DIR}/.env" ]; then
  export $(grep -v '^#' "${BACKEND_DIR}/.env" | grep -E '^DATABASE_URL=' | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Error: DATABASE_URL is not set and could not be loaded from .env"
  exit 1
fi

# Clean database connection string for pg_dump
BASE_DB_URL=$(echo "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*(&|$)/\1/g; s/[?&]$//')

# Prepare local backup directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-${BACKEND_DIR}/backups}"
mkdir -p "${BACKUP_DIR}"

BACKUP_FILENAME="${SCHEMA_NAME}_${TIMESTAMP}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

echo "=========================================================="
echo "📦 STARTING BACKUP FOR TENANT: '${CLIENT_NAME}'"
echo "📁 Schema: '${SCHEMA_NAME}'"
echo "⏰ Timestamp: '${TIMESTAMP}'"
echo "=========================================================="

# 1. Run pg_dump filtered by tenant schema
echo "Running pg_dump for schema '${SCHEMA_NAME}'..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${BASE_DB_URL}" \
    --schema="${SCHEMA_NAME}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "${BACKUP_FILEPATH}"
else
  # Fallback: if host has docker and postgres container is running
  echo "ℹ️  Host pg_dump not found, attempting via docker exec..."
  POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-gym_postgres}"
  POSTGRES_USER="${POSTGRES_USER:-gym_user}"
  POSTGRES_DB="${POSTGRES_DB:-gym_db}"

  docker exec -t "${POSTGRES_CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --schema="${SCHEMA_NAME}" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip > "${BACKUP_FILEPATH}"
fi

FILESIZE=$(ls -lh "${BACKUP_FILEPATH}" | awk '{print $5}')
echo "✔ Local dump created: ${BACKUP_FILEPATH} (${FILESIZE})"

# 2. Upload to external/offsite storage
echo ""
echo "☁️  OFFSITE STORAGE UPLOAD"
echo "----------------------------------------------------------"

# Configurable storage driver: 's3', 'rsync', 'rclone', or 'none'
BACKUP_STORAGE_DRIVER="${BACKUP_STORAGE_DRIVER:-none}"

case "$BACKUP_STORAGE_DRIVER" in
  s3)
    # AWS S3 / Cloudflare R2 / Backblaze B2 compatible
    if [ -z "${S3_BACKUP_BUCKET:-}" ]; then
      echo "❌ Error: BACKUP_STORAGE_DRIVER=s3 but S3_BACKUP_BUCKET is not set."
      exit 1
    fi
    S3_DEST="s3://${S3_BACKUP_BUCKET}/backups/${SCHEMA_NAME}/${BACKUP_FILENAME}"
    echo "Uploading to S3 target: ${S3_DEST}..."
    aws s3 cp "${BACKUP_FILEPATH}" "${S3_DEST}"
    echo "✔ Upload completed successfully."
    ;;

  rsync)
    # Remote backup server / NAS via SSH
    if [ -z "${RSYNC_DESTINATION:-}" ]; then
      echo "❌ Error: BACKUP_STORAGE_DRIVER=rsync but RSYNC_DESTINATION is not set (e.g. backupuser@nas.local:/backups)."
      exit 1
    fi
    echo "Syncing to remote rsync target: ${RSYNC_DESTINATION}..."
    rsync -avz -e ssh "${BACKUP_FILEPATH}" "${RSYNC_DESTINATION}/${SCHEMA_NAME}/"
    echo "✔ Rsync completed successfully."
    ;;

  rclone)
    # Rclone remote (e.g. remote:bucket/path)
    if [ -z "${RCLONE_REMOTE:-}" ]; then
      echo "❌ Error: BACKUP_STORAGE_DRIVER=rclone but RCLONE_REMOTE is not set."
      exit 1
    fi
    echo "Copying via rclone to: ${RCLONE_REMOTE}/${SCHEMA_NAME}/..."
    rclone copy "${BACKUP_FILEPATH}" "${RCLONE_REMOTE}/${SCHEMA_NAME}/"
    echo "✔ Rclone completed successfully."
    ;;

  none|*)
    echo "⚠️  WARNING: BACKUP_STORAGE_DRIVER is set to 'none' or unconfigured!"
    echo "⚠️  The backup file exists ONLY on the local machine (${BACKUP_FILEPATH})."
    echo "⚠️  CRITICAL: Configure offsite upload (S3, Cloudflare R2, Backblaze B2, or rsync)!"
    echo "    To enable S3 upload, export:"
    echo "      export BACKUP_STORAGE_DRIVER=s3"
    echo "      export S3_BACKUP_BUCKET=your-offsite-backup-bucket"
    echo "    To enable rsync to remote NAS, export:"
    echo "      export BACKUP_STORAGE_DRIVER=rsync"
    echo "      export RSYNC_DESTINATION=user@nas.local:/data/backups"
    ;;
esac

echo "=========================================================="
echo "✅ Backup process finished for tenant '${CLIENT_NAME}'"
echo "=========================================================="
