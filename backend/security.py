import base64
import hashlib
import hmac
import os

try:
    import bcrypt
except ImportError:  # Hỗ trợ mở DB cũ ngoài Docker trong giai đoạn chuyển tiếp.
    bcrypt = None


PASSWORD_ITERATIONS = 210_000


def _legacy_pbkdf2_hash(password):
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(digest).decode("ascii"),
    )


def password_hash(password):
    """Hash mới dùng bcrypt; vẫn có fallback để công cụ cũ không bị ngắt."""
    if bcrypt is not None:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")
    return _legacy_pbkdf2_hash(password)


def verify_password(password, stored_hash):
    try:
        stored_hash = str(stored_hash or "")
        if stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
            if bcrypt is None:
                return False
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("ascii"))
        scheme, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def password_needs_rehash(stored_hash):
    return not str(stored_hash or "").startswith(("$2a$", "$2b$", "$2y$"))


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
