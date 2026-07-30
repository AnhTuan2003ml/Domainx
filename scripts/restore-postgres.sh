#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "Cách dùng: ./scripts/restore-postgres.sh backups/domix_xxx.dump" >&2; exit 1; }
PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
BACKUP_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
CONTAINER_ID="$(docker compose ps -q database)"
[ -n "$CONTAINER_ID" ] || { echo "Container PostgreSQL chưa chạy." >&2; exit 1; }
CONTAINER_FILE="/tmp/domix_restore.dump"
docker cp "$BACKUP_FILE" "$CONTAINER_ID:$CONTAINER_FILE"
docker compose exec -T database sh -lc "pg_restore --clean --if-exists --no-owner -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" '$CONTAINER_FILE'"
docker compose exec -T database rm -f "$CONTAINER_FILE"
docker compose restart backend
echo "Đã khôi phục database từ: $BACKUP_FILE"
