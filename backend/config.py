from pathlib import Path
import os
from urllib.parse import quote


ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
SESSION_HOURS = 12
ROLES = {"admin", "accountant", "user"}
DEFAULT_ADMIN_EMAIL = "admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "admin123@"
POSTGRES_SCHEMES = ("postgresql://", "postgres://")


def _load_env_file(path):
    """Load KEY=VALUE entries from .env without overriding OS variables."""
    if not path.exists() or not path.is_file():
        return

    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        else:
            comment_index = value.find(" #")
            if comment_index >= 0:
                value = value[:comment_index].rstrip()

        os.environ[key] = value


_load_env_file(ROOT_DIR / ".env")


def _postgres_database_url_from_env():
    """Return the single PostgreSQL target used by every DOMIX runtime path.

    DOMIX no longer falls back to a local file database. A malformed URL or a
    missing password stops the backend immediately instead of silently opening a
    different database and making newly-created employees appear to disappear.
    """
    explicit_url = os.environ.get("DOMIX_DATABASE_URL", "").strip()
    if explicit_url:
        if not explicit_url.lower().startswith(POSTGRES_SCHEMES):
            raise RuntimeError("DOMIX_DATABASE_URL phải là URL PostgreSQL (postgresql://...).")
        return explicit_url

    host = os.environ.get("DOMIX_DB_HOST", "").strip() or "127.0.0.1"
    port = os.environ.get("DOMIX_DB_PORT", "5432").strip() or "5432"
    name = (
        os.environ.get("DOMIX_DB_NAME", "").strip()
        or os.environ.get("POSTGRES_DB", "").strip()
        or "domix"
    )
    user = (
        os.environ.get("DOMIX_DB_USER", "").strip()
        or os.environ.get("POSTGRES_USER", "").strip()
        or "domix"
    )
    password = (
        os.environ.get("DOMIX_DB_PASSWORD", "")
        or os.environ.get("POSTGRES_PASSWORD", "")
    )
    if not password:
        raise RuntimeError(
            "Thiếu mật khẩu PostgreSQL. Hãy đặt POSTGRES_PASSWORD hoặc DOMIX_DB_PASSWORD trong .env."
        )

    return (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{quote(name, safe='')}"
    )


DATABASE_URL = _postgres_database_url_from_env()
DEFAULT_DB_TARGET = DATABASE_URL
APP_ENV = os.environ.get("DOMIX_APP_ENV", "development").strip().lower()
CORS_ORIGIN = os.environ.get("DOMIX_CORS_ORIGIN", "*").strip() or "*"


SMTP_HOST = os.environ.get("DOMIX_SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.environ.get("DOMIX_SMTP_PORT", "465"))
SMTP_EMAIL = os.environ.get("DOMIX_SMTP_EMAIL", "").strip()
SMTP_APP_PASSWORD = os.environ.get("DOMIX_SMTP_APP_PASSWORD", "").strip()
SMTP_TIMEOUT_SECONDS = int(os.environ.get("DOMIX_SMTP_TIMEOUT_SECONDS", "20"))
ALERT_DAYS_BEFORE_EXPIRY = int(os.environ.get("DOMIX_ALERT_DAYS_BEFORE_EXPIRY", "5"))
ALERT_CHECK_INTERVAL_SECONDS = int(os.environ.get("DOMIX_ALERT_CHECK_INTERVAL_SECONDS", "3600"))
OTP_EXPIRY_MINUTES = int(os.environ.get("DOMIX_OTP_EXPIRY_MINUTES", "10"))
OTP_RESEND_SECONDS = int(os.environ.get("DOMIX_OTP_RESEND_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(os.environ.get("DOMIX_OTP_MAX_ATTEMPTS", "5"))
OTP_MAX_REQUESTS_PER_HOUR = int(os.environ.get("DOMIX_OTP_MAX_REQUESTS_PER_HOUR", "5"))

ANTHROPIC_API_KEY = os.environ.get("DOMIX_ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("DOMIX_ANTHROPIC_MODEL", "claude-sonnet-4-6").strip() or "claude-sonnet-4-6"
ANTHROPIC_API_VERSION = os.environ.get("DOMIX_ANTHROPIC_API_VERSION", "2023-06-01").strip() or "2023-06-01"
AI_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("DOMIX_AI_TIMEOUT_SECONDS", "120"))
MAX_REQUEST_BODY_BYTES = int(os.environ.get("DOMIX_MAX_REQUEST_BODY_BYTES", str(30 * 1024 * 1024)))
