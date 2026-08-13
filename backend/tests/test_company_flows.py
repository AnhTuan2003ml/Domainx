from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.schema import init_db
from db.state_store import StateConflictError, read_state, update_state, write_state
from db.employee_store import upsert_with_account, delete_employee, replace_all, list_employees
from db.user_store import create_or_update_user
from db.connection import connect
from db.security_store import (
    clear_director_password_failures,
    director_password_is_rate_limited,
    record_director_password_failure,
)
from services.business_sync_service import (
    reconcile_company_data,
    record_debt_payment,
    remove_debt_payment,
)
from services.financial_summary_service import get_financial_summary, FinancialSummaryError
from services.payroll_payment_service import record_payroll_payment, resolve_payroll_reconciliation
from services.operational_ledger_service import list_debt_payments, list_inventory_movements
from services.performance_classification_service import summarize_performance
from services.invoice_status_service import summarize_invoices
from routes import company_data as company_data_route
from tests.postgres_test_case import PostgresTestCase


class DataApiHandler:
    def __init__(self, db_path, body):
        self.db_path = db_path
        self.body = body
        self.response = None
        self.status = None

    @staticmethod
    def require_user():
        return {"email": "admin@example.com", "role": "admin"}

    def read_json(self):
        return self.body

    @staticmethod
    def preserve_restricted_state(data, _user, _existing_data=None):
        return data

    @staticmethod
    def is_full_admin(_user):
        # Trả False để test không đi vào nhánh gửi email kho.
        return False

    @staticmethod
    def filter_state(state, _user):
        return state

    def send_json(self, payload, status=200):
        self.response = payload
        self.status = status


class CompanyFlowTests(PostgresTestCase):
    def setUp(self):
        super().setUp()
        init_db(self.db_path)

    def tearDown(self):
        super().tearDown()

    def test_state_update_rejects_stale_version(self):
        write_state(self.db_path, {"company": {"name": "Bản đầu"}})
        first = read_state(self.db_path)

        saved = update_state(
            self.db_path,
            lambda data: {**data, "company": {"name": "Tài khoản A"}},
            expected_version=first["version"],
        )
        self.assertEqual(saved["version"], first["version"] + 1)

        with self.assertRaises(StateConflictError):
            update_state(
                self.db_path,
                lambda data: {**data, "company": {"name": "Tài khoản B ghi đè"}},
                expected_version=first["version"],
            )

        current = read_state(self.db_path)
        self.assertEqual(current["data"]["company"]["name"], "Tài khoản A")
        self.assertEqual(current["version"], saved["version"])

    def test_data_api_returns_409_instead_of_overwriting_stale_state(self):
        write_state(self.db_path, {"company": {"name": "Bản đầu"}})
        version = read_state(self.db_path)["version"]

        first = DataApiHandler(self.db_path, {
            "data": {"company": {"name": "Tài khoản A"}},
            "expectedVersion": version,
        })
        self.assertTrue(company_data_route.handle_put(first, "/api/data/fields", None))
        self.assertEqual(first.status, 200)

        stale = DataApiHandler(self.db_path, {
            "data": {"company": {"name": "Tài khoản B"}},
            "expectedVersion": version,
        })
        self.assertTrue(company_data_route.handle_put(stale, "/api/data/fields", None))
        self.assertEqual(stale.status, 409)
        self.assertEqual(stale.response["code"], "STATE_VERSION_CONFLICT")
        self.assertEqual(read_state(self.db_path)["data"]["company"]["name"], "Tài khoản A")

    def test_director_password_rate_limit_is_persisted_in_postgresql(self):
        attempt_key = "director@example.com|127.0.0.1"
        for _ in range(5):
            record_director_password_failure(self.db_path, attempt_key, 600)

        self.assertTrue(
            director_password_is_rate_limited(self.db_path, attempt_key, 600, 5)
        )
        clear_director_password_failures(self.db_path, attempt_key)
        self.assertFalse(
            director_password_is_rate_limited(self.db_path, attempt_key, 600, 5)
        )

    def _seed_sales_flow(self):
        write_state(
            self.db_path,
            reconcile_company_data(
                {
                    "company": {"openingCashBalance": 0},
                    "inventory": [
                        {
                            "id": "product-1",
                            "name": "Sản phẩm kiểm thử",
                            "stock": 10,
                            "expiryDate": "29/09/2026",
                            "createdAt": "2026-07-01",
                        }
                    ],
                    "orders": [
                        {
                            "id": "order-1",
                            "date": "2026-07-29",
                            "amount": 2_160_000,
                            "quantity": 2,
                            "productId": "product-1",
                            "productName": "Sản phẩm kiểm thử",
                            "customerName": "TEST QA 2",
                            "orderStatus": "active",
                            "invoiceStatus": "missing",
                            "customerPaidAmount": 0,
                        }
                    ],
                    "transactions": [
                        {
                            "id": "expense-1",
                            "date": "2026-07-29",
                            "kind": "chi",
                            "amount": 350_000,
                            "category": "Chi kiểm thử",
                            "status": "approved",
                        }
                    ],
                    "debts": [],
                    "paymentLedger": [],
                    "stockMovements": [],
                    "distributionOrders": [],
                    "marketingLogs": [],
                    "payrollApprovals": [],
                    "payrollPayments": [],
                    "securityAuditLog": [],
                }
            ),
        )
        return read_state(self.db_path)["data"]

    def test_financial_summary_is_single_source_of_truth(self):
        state = self._seed_sales_flow()
        debt_id = state["debts"][0]["id"]

        def pay(data):
            saved, _ = record_debt_payment(
                data,
                debt_id,
                {
                    "amount": 1_500_000,
                    "date": "2026-07-29",
                    "paymentMethod": "chuyen_khoan",
                    "idempotencyKey": "qa2-payment",
                },
                created_by="accountant@example.com",
            )
            return saved

        update_state(self.db_path, pay)
        summary = get_financial_summary(self.db_path, 2026, 7)
        self.assertEqual(summary["recognized_revenue"], 2_160_000)
        self.assertEqual(summary["cash_received"], 1_500_000)
        self.assertEqual(summary["accounts_receivable"], 660_000)
        self.assertEqual(summary["cash_spent"], 350_000)
        self.assertEqual(summary["cash_balance"], 1_150_000)
        self.assertEqual(summary["inventory_product_count"], 1)
        self.assertEqual(summary["inventory_stock_total"], 8)

    def test_debt_payment_is_idempotent_and_reversible(self):
        state = self._seed_sales_flow()
        debt_id = state["debts"][0]["id"]
        payment_ids = []

        for _ in range(2):
            result_box = {}

            def pay(data):
                saved, payment_id = record_debt_payment(
                    data,
                    debt_id,
                    {
                        "amount": 500_000,
                        "date": "2026-07-29",
                        "idempotencyKey": "same-click",
                    },
                    created_by="accountant@example.com",
                )
                result_box["id"] = payment_id
                return saved

            update_state(self.db_path, pay)
            payment_ids.append(result_box["id"])

        state = read_state(self.db_path)["data"]
        posted = [item for item in state["paymentLedger"] if item.get("entryType") == "payment"]
        receipts = [item for item in state["transactions"] if item.get("kind") == "thu"]
        self.assertEqual(payment_ids[0], payment_ids[1])
        self.assertEqual(len(posted), 1)
        self.assertEqual(len(receipts), 1)

        update_state(
            self.db_path,
            lambda data: remove_debt_payment(
                data,
                debt_id,
                payment_ids[0],
                reversed_by="accountant@example.com",
                reversal_reason="Khách chuyển nhầm tài khoản",
            ),
        )
        state = read_state(self.db_path)["data"]
        debt = next(item for item in state["debts"] if item["id"] == debt_id)
        self.assertEqual(debt["paidAmount"], 0)
        self.assertEqual(debt["remainingAmount"], 2_160_000)
        self.assertEqual(len([item for item in state["transactions"] if item.get("kind") == "thu"]), 0)
        self.assertTrue(any(item.get("entryType") == "reversal" for item in state["paymentLedger"]))

    def test_inventory_dates_and_movements_survive_reload(self):
        state = self._seed_sales_flow()
        product = state["inventory"][0]
        self.assertEqual(product["stock"], 8)
        self.assertEqual(product["expiryDate"], "2026-09-29")
        sale = next(item for item in state["stockMovements"] if item.get("movementType") == "sale_out")
        self.assertEqual(sale["quantityBefore"], 10)
        self.assertEqual(sale["quantityAfter"], 8)

        reloaded = reconcile_company_data(read_state(self.db_path)["data"])
        self.assertEqual(reloaded["inventory"][0]["expiryDate"], "2026-09-29")
        self.assertEqual(reloaded["inventory"][0]["stock"], 8)

    def test_payroll_payment_creates_one_expense_and_blocks_duplicate(self):
        data = {
            "payrollApprovals": [
                {
                    "id": "approval-1",
                    "employeeId": 10,
                    "employeeName": "Nhân viên A",
                    "year": 2026,
                    "month": 7,
                    "status": "cho_ke_toan_chi_tra",
                    "approval_status": "director_approved",
                    "payment_status": "unpaid",
                    "requestedWorkDays": 2,
                    "requestedDailySalary": 300_000,
                    "requestedBonus": 78_889,
                    "attendance_days_snapshot": 2,
                    "system_salary_snapshot": 678_889,
                    "systemReferenceAtSubmit": 678_889,
                    "bossApprovedAt": "2026-07-29T12:00:00+07:00",
                    "varianceReason": "",
                }
            ],
            "payrollPayments": [],
            "transactions": [],
            "securityAuditLog": [],
        }
        paid, _ = record_payroll_payment(
            data,
            {
                "employeeId": 10,
                "employeeName": "Nhân viên A",
                "year": 2026,
                "month": 7,
                "amount": 678_889,
                "currentWorkDays": 2,
                "currentSystemAmount": 678_889,
                "date": "2026-07-29",
            },
            actor_email="accountant@example.com",
            actor_name="Kế toán",
        )
        self.assertEqual(len(paid["payrollPayments"]), 1)
        self.assertEqual(len([item for item in paid["transactions"] if item.get("kind") == "chi"]), 1)
        self.assertEqual(paid["payrollApprovals"][0]["payment_status"], "paid")
        with self.assertRaisesRegex(ValueError, "đã được chi trả"):
            record_payroll_payment(
                paid,
                {
                    "employeeId": 10,
                    "year": 2026,
                    "month": 7,
                    "amount": 678_889,
                    "currentWorkDays": 2,
                    "currentSystemAmount": 678_889,
                },
                actor_email="accountant@example.com",
            )



    def test_legacy_paid_amount_becomes_linked_debt_payment(self):
        write_state(
            self.db_path,
            reconcile_company_data({
                "company": {"openingCashBalance": 0},
                "orders": [{
                    "id": "legacy-order", "date": "2026-07-29", "amount": 2_160_000,
                    "quantity": 1, "customerName": "TEST QA 2", "orderStatus": "active",
                    "customerPaidAmount": 1_500_000,
                }],
                "debts": [{
                    "id": "legacy-debt", "type": "thu", "sourceModule": "crm",
                    "sourceId": "legacy-order", "orderId": "legacy-order", "amount": 2_160_000,
                    "paidAmount": 1_500_000, "remainingAmount": 660_000,
                    "paymentHistory": [], "issueDate": "2026-07-29",
                }],
                "transactions": [{
                    "id": "legacy-receipt", "date": "2026-07-29", "kind": "thu",
                    "amount": 1_500_000, "source": "crm", "sourceModule": "crm",
                    "sourceId": "legacy-order", "orderId": "legacy-order", "status": "approved",
                }],
                "paymentLedger": [], "inventory": [], "stockMovements": [],
                "distributionOrders": [], "marketingLogs": [], "payrollApprovals": [],
                "payrollPayments": [], "securityAuditLog": [],
            }),
        )
        state = read_state(self.db_path)["data"]
        debt = next(item for item in state["debts"] if item["id"] == "legacy-debt")
        self.assertEqual(len(debt["paymentHistory"]), 1)
        payments = list_debt_payments(self.db_path, "legacy-debt")
        self.assertEqual(len(payments), 1)
        self.assertEqual(payments[0]["amount"], 1_500_000)
        self.assertEqual(payments[0]["receipt_transaction_id"], "legacy-receipt")
        with connect(self.db_path) as conn:
            receipt = conn.execute(
                "SELECT amount, status, source_id FROM cash_transactions WHERE id = ?",
                ("legacy-receipt",),
            ).fetchone()
        self.assertIsNotNone(receipt)
        self.assertEqual(receipt["amount"], 1_500_000)
        self.assertEqual(receipt["status"], "posted")
        self.assertTrue(str(receipt["source_id"]).startswith("legacy:debt:"))
        summary = get_financial_summary(self.db_path, 2026, 7)
        self.assertEqual(summary["cash_received"], 1_500_000)
        self.assertEqual(summary["accounts_receivable"], 660_000)

    def test_deleted_order_auto_reverses_orphaned_payment_ledger_entry(self):
        # Regression: xóa 1 đơn CRM đã thu tiền ngay (không qua công nợ) từng để lại
        # một bút toán "opening-payment" mồ côi trong paymentLedger vĩnh viễn — không
        # có luồng nào dọn nó khi đơn nguồn biến mất, khiến cash_transactions lệch với
        # dữ liệu nghiệp vụ và "Tổng quan tài chính" báo lỗi không tải được.
        write_state(
            self.db_path,
            reconcile_company_data({
                "company": {"openingCashBalance": 0},
                "orders": [{
                    "id": "order-orphan-1", "date": "2026-07-30", "amount": 100_000,
                    "quantity": 1, "customerName": "Khach tu dat", "orderStatus": "active",
                    "customerPaymentStatus": "paid", "customerPaidAmount": 100_000,
                }],
                "debts": [], "transactions": [], "paymentLedger": [], "inventory": [],
                "stockMovements": [], "distributionOrders": [], "marketingLogs": [],
                "payrollApprovals": [], "payrollPayments": [], "securityAuditLog": [],
            }),
        )
        state = read_state(self.db_path)["data"]
        active_payments = [item for item in state["paymentLedger"] if item.get("entryType") == "payment"]
        self.assertEqual(len(active_payments), 1)
        orphan_id = active_payments[0]["id"]
        with connect(self.db_path) as conn:
            receipt = conn.execute(
                "SELECT status FROM cash_transactions WHERE source_id = ?", (orphan_id,),
            ).fetchone()
        self.assertEqual(receipt["status"], "posted")

        # Xóa đơn — đúng thao tác người dùng làm ở tab Doanh thu CRM.
        def delete_order(data):
            trimmed = dict(data)
            trimmed["orders"] = [o for o in trimmed.get("orders", []) if o.get("id") != "order-orphan-1"]
            return reconcile_company_data(trimmed)

        update_state(self.db_path, delete_order)
        state = read_state(self.db_path)["data"]
        reversal_targets = {
            item.get("reversalOf") for item in state["paymentLedger"] if item.get("entryType") == "reversal"
        }
        self.assertIn(orphan_id, reversal_targets)
        with connect(self.db_path) as conn:
            receipt = conn.execute(
                "SELECT status FROM cash_transactions WHERE source_id = ?", (orphan_id,),
            ).fetchone()
        self.assertEqual(receipt["status"], "reversed")
        # Không còn đơn nào trong kỳ nên không phát sinh doanh thu/công nợ giả từ đơn đã xóa.
        summary = get_financial_summary(self.db_path, 2026, 7)
        self.assertEqual(summary["recognized_revenue"], 0)
        self.assertEqual(summary["cash_received"], 0)

    def test_financial_summary_fails_loudly_when_cash_ledger_is_out_of_balance(self):
        state = self._seed_sales_flow()
        debt_id = state["debts"][0]["id"]
        update_state(
            self.db_path,
            lambda data: record_debt_payment(
                data,
                debt_id,
                {"amount": 1_500_000, "date": "2026-07-29", "idempotencyKey": "ledger-check"},
                created_by="accountant@example.com",
            )[0],
        )
        with connect(self.db_path) as conn:
            conn.execute("UPDATE cash_transactions SET amount = 0 WHERE transaction_type = 'thu'")
        with self.assertRaisesRegex(FinancialSummaryError, "(Sổ giao dịch không cân|lệch số tiền với sổ Thu–Chi)"):
            get_financial_summary(self.db_path, 2026, 7)

    def test_payroll_requires_reconciliation_before_payment(self):
        data = {
            "payrollApprovals": [{
                "id": "approval-reconcile", "employeeId": 10, "employeeName": "Nhân viên A",
                "year": 2026, "month": 7, "status": "cho_ke_toan_chi_tra",
                "approval_status": "director_approved", "payment_status": "unpaid",
                "requestedWorkDays": 1, "requestedDailySalary": 600_000,
                "requestedBonus": 78_889, "attendance_days_snapshot": 1,
                "system_salary_snapshot": 952_222, "systemReferenceAtSubmit": 952_222,
                "bossApprovedAt": "2026-07-29T12:00:00+07:00",
            }],
            "payrollPayments": [], "transactions": [], "securityAuditLog": [],
        }
        payload = {
            "employeeId": 10, "employeeName": "Nhân viên A", "year": 2026, "month": 7,
            "amount": 678_889, "currentWorkDays": 2, "currentSystemAmount": 952_222,
            "date": "2026-07-29",
        }
        with self.assertRaisesRegex(ValueError, "chưa đối soát xong"):
            record_payroll_payment(data, payload, actor_email="accountant@example.com")
        resolved = resolve_payroll_reconciliation(
            data,
            {
                "employeeId": 10, "year": 2026, "month": 7,
                "action": "keep_approved", "reason": "Đã đối chiếu chứng từ bổ sung",
                "currentWorkDays": 2, "currentSystemAmount": 952_222,
            },
            actor_email="accountant@example.com", actor_name="Kế toán",
        )
        paid, _ = record_payroll_payment(resolved, payload, actor_email="accountant@example.com")
        self.assertEqual(paid["payrollApprovals"][0]["reconciliation_status"], "resolved")
        self.assertEqual(paid["payrollApprovals"][0]["payment_status"], "paid")
        self.assertEqual(len(paid["payrollPayments"]), 1)

    def test_inventory_duplicate_opening_is_removed_and_before_after_are_real(self):
        data = reconcile_company_data({
            "inventory": [{
                "id": "p-qa", "name": "Sản phẩm QA", "stock": 8,
                "expiryDate": "29/09/2026", "createdAt": "2026-07-01",
            }],
            "orders": [], "debts": [], "transactions": [], "paymentLedger": [],
            "stockMovements": [
                {"id": "open-a", "productId": "p-qa", "movementType": "opening", "delta": 10, "date": "2026-07-01"},
                {"id": "open-b", "productId": "p-qa", "movementType": "opening", "delta": 10, "date": "2026-07-01"},
                {"id": "sale-a", "productId": "p-qa", "movementType": "sale_out", "delta": -2, "quantity": 2, "date": "2026-07-29", "sourceModule": "manual", "sourceId": "sale-a"},
            ],
        })
        write_state(self.db_path, data)
        state = read_state(self.db_path)["data"]
        openings = [item for item in state["stockMovements"] if item["movementType"] == "opening"]
        self.assertEqual(len(openings), 1)
        self.assertEqual(state["inventory"][0]["stock"], 8)
        self.assertEqual(state["inventory"][0]["expiryDate"], "2026-09-29")
        movements = list_inventory_movements(self.db_path, "p-qa")
        sale = next(item for item in movements if item["movement_type"] == "sale_out")
        self.assertEqual(sale["quantity_before"], 10)
        self.assertEqual(sale["quantity_after"], 8)
        self.assertTrue(any(issue["type"] == "duplicate_opening_removed" for issue in state["inventoryLedgerIssues"]))

    def test_existing_account_is_repaired_to_employee_by_email(self):
        account = create_or_update_user(self.db_path, "qa.accountant@example.com", "SafePass123!", "accountant")
        replace_all(self.db_path, [{
            "id": 1001, "email": "qa.accountant@example.com", "name": "TEST QA 2 Kế toán",
            "position": "Kế toán", "dept": "Tài chính", "roleType": "ke_toan",
            "accountRole": "accountant", "status": "active",
        }])
        employees = list_employees(self.db_path)
        self.assertEqual(employees[0]["account_id"], account["id"])

    def test_date_only_fields_use_one_shared_format(self):
        data = reconcile_company_data({
            "inventory": [{"id": "p1", "name": "Kho", "stock": 1, "expiryDate": "31/12/2026"}],
            "contracts": [{"id": "c1", "signDate": "29/02/2028", "expiryDate": "31/12/2028"}],
            "capitalContributions": [{"id": "v1", "certificationDate": "30/04/2026"}],
            "fixedAssets": [{"id": "a1", "purchaseDate": "2026-12-31T00:00:00+07:00", "warrantyExpiryDate": "01/01/2028"}],
            "orders": [], "debts": [], "transactions": [], "paymentLedger": [], "stockMovements": [],
        })
        self.assertEqual(data["inventory"][0]["expiryDate"], "2026-12-31")
        self.assertEqual(data["contracts"][0]["signDate"], "2028-02-29")
        self.assertEqual(data["contracts"][0]["expiryDate"], "2028-12-31")
        self.assertEqual(data["capitalContributions"][0]["certificationDate"], "2026-04-30")
        self.assertEqual(data["fixedAssets"][0]["purchaseDate"], "2026-12-31")
        self.assertEqual(data["fixedAssets"][0]["warrantyExpiryDate"], "2028-01-01")

    def test_performance_and_invoice_counts_share_one_classifier(self):
        performance = summarize_performance([
            {"id": 1, "status": "active", "roleType": "sale", "salesTarget": 100, "salesActual": 100},
            {"id": 2, "status": "active", "roleType": "sale", "salesTarget": 100, "salesActual": 50},
            {"id": 3, "status": "active", "roleType": "ky_thuat", "tasksAssigned": 0, "customScore": 0},
        ])
        self.assertEqual(performance["counts"], {"good": 1, "warning": 0, "improve": 1, "insufficient": 1})
        self.assertEqual(performance["employee_ids"]["improve"], [2])

        invoices = summarize_invoices([
            {"id": "m", "orderStatus": "active", "invoiceStatus": "missing"},
            {"id": "p", "orderStatus": "active", "invoiceStatus": "pending"},
            {"id": "v", "orderStatus": "active", "invoiceStatus": "verified"},
            {"id": "n", "orderStatus": "active", "invoiceRequired": False},
            {"id": "x", "orderStatus": "cancelled", "invoiceStatus": "missing"},
        ])
        self.assertEqual(invoices["counts"], {"missing": 1, "pending": 1, "provided": 0, "verified": 1, "not_required": 1})
        self.assertEqual(invoices["order_ids"]["missing"], ["m"])

    def test_employee_account_link_is_one_to_one_and_self_delete_is_blocked(self):
        employee = {
            "id": 1_725_000_000_001,
            "email": "admin@example.com",
            "name": "Quản trị viên",
            "position": "Giám đốc",
            "dept": "Ban giám đốc",
            "accountRole": "admin",
            "status": "active",
        }
        employees = upsert_with_account(self.db_path, employee, password="SafePass123!")
        self.assertEqual(len(employees), 1)
        self.assertIsNotNone(employees[0]["account_id"])
        with self.assertRaisesRegex(ValueError, "Không thể tự xóa"):
            delete_employee(self.db_path, employee["id"], "admin@example.com")

    def test_server_attendance_blocks_client_bypass_of_payroll_reconciliation(self):
        approval = {
            "id": "approval-server-check", "employeeId": 77, "employeeName": "Nhân viên máy chủ",
            "year": 2026, "month": 7, "status": "cho_ke_toan_chi_tra",
            "approval_status": "director_approved", "payment_status": "unpaid",
            "requestedWorkDays": 1, "requestedDailySalary": 600_000,
            "requestedBonus": 78_889, "attendance_days_snapshot": 1,
            "system_salary_snapshot": 678_889, "systemReferenceAtSubmit": 678_889,
            "bossApprovedAt": "2026-07-29T12:00:00+07:00",
        }
        data = {"payrollApprovals": [approval], "payrollPayments": [], "transactions": [], "securityAuditLog": []}
        employee = {
            "id": 77, "dailySalary": 600_000,
            "attendance": {"2026-07": {"1": "X", "2": "X"}},
        }
        malicious_payload = {
            "employeeId": 77, "year": 2026, "month": 7, "amount": 678_889,
            "currentWorkDays": 1, "currentSystemAmount": 678_889, "date": "2026-07-30",
        }
        with self.assertRaisesRegex(ValueError, "chưa đối soát xong"):
            record_payroll_payment(
                data, malicious_payload, actor_email="accountant@example.com", employee=employee
            )

    def test_employee_response_exposes_canonical_user_id(self):
        account = create_or_update_user(self.db_path, "linked@example.com", "SafePass123!", "user")
        replace_all(self.db_path, [{
            "id": 2001, "user_id": account["id"], "email": "linked@example.com",
            "name": "Nhân viên liên kết", "position": "Nhân viên", "dept": "Vận hành",
            "accountRole": "user", "status": "active",
        }])
        employee = list_employees(self.db_path)[0]
        self.assertEqual(employee["user_id"], account["id"])
        self.assertEqual(employee["account_id"], account["id"])

    def test_financial_summary_rejects_debt_without_real_payment_certificate(self):
        state = self._seed_sales_flow()
        debt_id = state["debts"][0]["id"]
        update_state(
            self.db_path,
            lambda data: record_debt_payment(
                data, debt_id,
                {"amount": 500_000, "date": "2026-07-29", "idempotencyKey": "real-certificate"},
                created_by="accountant@example.com",
            )[0],
        )
        with connect(self.db_path) as conn:
            conn.execute("DELETE FROM debt_payments WHERE debt_id = ?", (debt_id,))
        with self.assertRaisesRegex(FinancialSummaryError, "không cân"):
            get_financial_summary(self.db_path, 2026, 7)


if __name__ == "__main__":
    unittest.main(verbosity=2)
