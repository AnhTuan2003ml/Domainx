#!/usr/bin/env sh
set -eu
[ "$#" -ge 1 ] || { echo "Cách dùng: ./scripts/migrate-sqlite-to-postgres.sh data/domix.sqlite3 [--replace]" >&2; exit 1; }
PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
SQLITE_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
REPLACE="${2:-}"
docker compose up -d database
if [ "$REPLACE" = "--replace" ]; then
  docker compose run --rm --no-deps -v "$SQLITE_FILE:/migration/domix.sqlite3:ro" backend \
    python backend/scripts/migrate_sqlite_to_postgres.py --sqlite /migration/domix.sqlite3 --replace
else
  docker compose run --rm --no-deps -v "$SQLITE_FILE:/migration/domix.sqlite3:ro" backend \
    python backend/scripts/migrate_sqlite_to_postgres.py --sqlite /migration/domix.sqlite3
fi
docker compose up -d backend web
echo "Đã chuyển dữ liệu và khởi động lại DOMIX."
