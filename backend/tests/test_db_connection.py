from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.connection import _replace_qmark_placeholders, _translate_postgres_sql


class ReplaceQmarkPlaceholdersTests(unittest.TestCase):
    def test_qmark_becomes_postgres_placeholder(self):
        self.assertEqual(
            _replace_qmark_placeholders("SELECT * FROM t WHERE id = ?"),
            "SELECT * FROM t WHERE id = %s",
        )

    def test_literal_percent_in_like_pattern_is_escaped(self):
        # Regression: LIKE '%kế toán%' từng làm psycopg vỡ với lỗi
        # "only '%s', '%b', '%t' are allowed as placeholders, got '%k'"
        # vì dấu % đơn lẻ trong chuỗi SQL bị hiểu nhầm thành placeholder.
        sql = "SELECT * FROM employees WHERE LOWER(position) LIKE '%kế toán%'"
        translated = _replace_qmark_placeholders(sql)
        self.assertIn("%%k", translated)
        self.assertNotIn("%k", translated.replace("%%k", ""))

    def test_multiple_percent_literals_and_qmarks_together(self):
        sql = "SELECT * FROM t WHERE a LIKE '%x%' AND b = ? AND c LIKE '%y%'"
        translated = _replace_qmark_placeholders(sql)
        self.assertEqual(
            translated,
            "SELECT * FROM t WHERE a LIKE '%%x%%' AND b = %s AND c LIKE '%%y%%'",
        )

    def test_question_mark_inside_string_literal_is_untouched(self):
        sql = "SELECT * FROM t WHERE note = 'is this ok?' AND id = ?"
        translated = _replace_qmark_placeholders(sql)
        self.assertEqual(
            translated,
            "SELECT * FROM t WHERE note = 'is this ok?' AND id = %s",
        )

    def test_full_translate_pipeline_survives_like_pattern(self):
        sql = (
            "SELECT id FROM employees WHERE account_id IS NULL "
            "AND LOWER(COALESCE(position, '')) LIKE '%kế toán%'"
        )
        translated = _translate_postgres_sql(sql)
        # Không còn dấu % đơn lẻ nào ngoài %% hợp lệ.
        import re

        stray = re.sub(r"%%", "", translated)
        self.assertNotIn("%", stray)


if __name__ == "__main__":
    unittest.main()
