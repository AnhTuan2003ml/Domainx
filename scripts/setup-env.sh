#!/usr/bin/env sh
set -eu

ADMIN_EMAIL="${1:-}"
HTTP_PORT="${2:-8080}"
PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_PATH="$PROJECT_ROOT/.env"

if [ -z "$ADMIN_EMAIL" ]; then
  echo "Cách dùng: ./scripts/setup-env.sh admin@congty.vn [8080]" >&2
  exit 1
fi
if [ -e "$ENV_PATH" ]; then
  echo "File .env đã tồn tại. Hãy sao lưu hoặc xóa trước khi tạo lại." >&2
  exit 1
fi

secure_token() {
  bytes="$1"
  python - "$bytes" <<'PY'
import secrets, sys
print(secrets.token_urlsafe(int(sys.argv[1])))
PY
}

DB_PASSWORD="$(secure_token 30)"
ADMIN_PASSWORD="$(secure_token 24)"
OTP_SECRET="$(secure_token 48)"

cat > "$ENV_PATH" <<EOF
POSTGRES_DB=domix
POSTGRES_USER=domix
POSTGRES_PASSWORD=$DB_PASSWORD
DOMIX_ADMIN_EMAIL=$ADMIN_EMAIL
DOMIX_ADMIN_PASSWORD=$ADMIN_PASSWORD
DOMIX_OTP_SECRET=$OTP_SECRET
DOMIX_HTTP_PORT=$HTTP_PORT
DOMIX_CORS_ORIGIN=*
DOMIX_SMTP_HOST=smtp.gmail.com
DOMIX_SMTP_PORT=465
DOMIX_SMTP_EMAIL=
DOMIX_SMTP_APP_PASSWORD=
DOMIX_ANTHROPIC_API_KEY=
DOMIX_ANTHROPIC_MODEL=claude-sonnet-4-6
DOMIX_AI_TIMEOUT_SECONDS=120
EOF
chmod 600 "$ENV_PATH"
printf 'Đã tạo %s\nTài khoản quản trị: %s\nMật khẩu quản trị: %s\n' "$ENV_PATH" "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
