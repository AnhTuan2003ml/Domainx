import base64
import hashlib
import hmac
import os
import re

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


PASSWORD_MIN_LENGTH = 10

# Cụm dễ đoán: gồm cả tên ứng dụng, vì mật khẩu kiểu "Domix<gì đó><năm>@" là thứ
# người tấn công thử đầu tiên khi biết đây là hệ thống của DOMIX.
WEAK_PASSWORD_FRAGMENTS = (
    "domix", "password", "matkhau", "123456", "12345678", "qwerty",
    "abc123", "111111", "000000", "admin123", "letmein", "iloveyou",
)


def validate_password_strength(password, field_label="Mật khẩu"):
    """Kiểm tra độ mạnh mật khẩu MỚI. Ném ValueError kèm thông báo tiếng Việt.

    Chỉ áp dụng khi ĐẶT mật khẩu (đăng ký, đổi, quên mật khẩu) — không bao giờ áp lên
    lúc đăng nhập, vì siết ở cửa đăng nhập sẽ khóa luôn người đang dùng mật khẩu cũ.
    """
    value = str(password or "")
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"{field_label} phải có ít nhất {PASSWORD_MIN_LENGTH} ký tự")
    groups = sum((
        bool(re.search(r"[a-z]", value)),
        bool(re.search(r"[A-Z]", value)),
        bool(re.search(r"[0-9]", value)),
        bool(re.search(r"[^A-Za-z0-9]", value)),
    ))
    if groups < 3:
        raise ValueError(
            f"{field_label} phải có ít nhất 3 trong 4 nhóm: chữ thường, chữ HOA, chữ số, ký tự đặc biệt"
        )
    lowered = value.lower()
    weak = next((fragment for fragment in WEAK_PASSWORD_FRAGMENTS if fragment in lowered), "")
    if weak:
        raise ValueError(
            f"{field_label} chứa cụm dễ đoán \"{weak}\". Hãy chọn mật khẩu khác, "
            "không dùng tên công ty hoặc dãy số liên tiếp"
        )
    return value


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
