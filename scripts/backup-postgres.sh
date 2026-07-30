#!/usr/bin/env sh
set -eu
PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
BACKUP_DIR="${1:-backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="domix_${STAMP}.dump"
CONTAINER_FILE="/tmp/$FILE"
CONTAINER_ID="$(docker compose ps -q database)"
[ -n "$CONTAINER_ID" ] || { echo "Container PostgreSQL chưa chạy." >&2; exit 1; }
docker compose exec -T database sh -lc "pg_dump -Fc --no-owner -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -f '$CONTAINER_FILE'"
docker cp "$CONTAINER_ID:$CONTAINER_FILE" "$BACKUP_DIR/$FILE"
docker compose exec -T database rm -f "$CONTAINER_FILE"
echo "Đã sao lưu: $BACKUP_DIR/$FILE"
