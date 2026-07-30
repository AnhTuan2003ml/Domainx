from __future__ import annotations

import string
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services import user_service


class GenerateTemporaryPasswordTests(unittest.TestCase):
    def test_password_is_not_the_old_hardcoded_value(self):
        # Regression: hàm này từng luôn trả về "Domain123@" cho mọi tài khoản mới.
        passwords = {user_service.generate_temporary_password() for _ in range(20)}
        self.assertNotIn("Domain123@", passwords)
        self.assertEqual(len(passwords), 20, "mỗi lần gọi phải ra mật khẩu khác nhau")

    def test_password_has_required_character_classes(self):
        password = user_service.generate_temporary_password()
        self.assertTrue(any(c in string.ascii_uppercase for c in password))
        self.assertTrue(any(c in string.ascii_lowercase for c in password))
        self.assertTrue(any(c in string.digits for c in password))
        self.assertTrue(any(c in user_service._TEMP_PASSWORD_SYMBOLS for c in password))

    def test_password_respects_requested_length(self):
        self.assertEqual(len(user_service.generate_temporary_password(24)), 24)
        # Độ dài tối thiểu được ép về 12 dù truyền nhỏ hơn.
        self.assertEqual(len(user_service.generate_temporary_password(4)), 12)


if __name__ == "__main__":
    unittest.main()
