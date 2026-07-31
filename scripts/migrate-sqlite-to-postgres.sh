#!/usr/bin/env sh
set -eu
echo "Luồng chuyển dữ liệu cũ đã bị vô hiệu hóa. DOMIX chỉ dùng PostgreSQL trong volume domix_postgres_data." >&2
exit 1
