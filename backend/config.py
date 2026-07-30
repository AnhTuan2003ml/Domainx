from pathlib import Path
import os
from urllib.parse import quote


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "data" / "domix.sqlite3"
DIST_DIR = ROOT_DIR / "dist"
SESSION_HOURS = 12
ROLES = {"admin", "accountant", "user"}
DEFAULT_ADMIN_EMAIL = "admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "admin123@"


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
            # Allow inline comments for unquoted values: KEY=value # note
            comment_index = value.find(" #")
            if comment_index >= 0:
                value = value[:comment_index].rstrip()

        os.environ[key] = value


# Read secrets/configuration from the project-level .env file first.
# Real process/OS environment variables always take precedence.
_load_env_file(ROOT_DIR / ".env")


def _database_target_from_env():
    explicit_url = os.environ.get("DOMIX_DATABASE_URL", "").strip()
    if explicit_url:
        return explicit_url

    host = os.environ.get("DOMIX_DB_HOST", "").strip()
    if not host:
        return DEFAULT_DB_PATH
    port = os.environ.get("DOMIX_DB_PORT", "5432").strip() or "5432"
    name = os.environ.get("DOMIX_DB_NAME", "domix").strip() or "domix"
    user = os.environ.get("DOMIX_DB_USER", "domix").strip() or "domix"
    password = os.environ.get("DOMIX_DB_PASSWORD", "")
    return (
        f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{quote(name, safe='')}"
    )


DATABASE_URL = str(_database_target_from_env())
DEFAULT_DB_TARGET = DATABASE_URL if DATABASE_URL.startswith(("postgresql://", "postgres://")) else DEFAULT_DB_PATH
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
