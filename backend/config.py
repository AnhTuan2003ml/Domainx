from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = ROOT_DIR / "data" / "domix.sqlite3"
DIST_DIR = ROOT_DIR / "dist"
SESSION_HOURS = 12
ROLES = {"admin", "user"}
DEFAULT_ADMIN_EMAIL = "admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "admin123@"
