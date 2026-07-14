from pathlib import Path
import os


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "data" / "domix.sqlite3"
DIST_DIR = ROOT_DIR / "dist"
SESSION_HOURS = 12
ROLES = {"admin", "user"}
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


SMTP_HOST = os.environ.get("DOMIX_SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.environ.get("DOMIX_SMTP_PORT", "465"))
SMTP_EMAIL = os.environ.get("DOMIX_SMTP_EMAIL", "").strip()
SMTP_APP_PASSWORD = os.environ.get("DOMIX_SMTP_APP_PASSWORD", "").strip()
SMTP_TIMEOUT_SECONDS = int(os.environ.get("DOMIX_SMTP_TIMEOUT_SECONDS", "20"))
OTP_EXPIRY_MINUTES = int(os.environ.get("DOMIX_OTP_EXPIRY_MINUTES", "10"))
OTP_RESEND_SECONDS = int(os.environ.get("DOMIX_OTP_RESEND_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(os.environ.get("DOMIX_OTP_MAX_ATTEMPTS", "5"))
OTP_MAX_REQUESTS_PER_HOUR = int(os.environ.get("DOMIX_OTP_MAX_REQUESTS_PER_HOUR", "5"))
