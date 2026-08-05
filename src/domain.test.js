import test from "node:test";
import assert from "node:assert/strict";

import {
  crmInventoryAvailability,
  isFutureReportMonth,
  sharedPerformanceStatus,
  summarizeQuarterSnapshots,
} from "./domain.js";


test("đơn đủ tồn được phép xuất kho", () => {
  assert.deepEqual(crmInventoryAvailability({ stock: 2 }, 1), {
    requested: 1,
    available: 2,
    shortage: 0,
    status: "fulfilled",
    canFulfill: true,
  });
});

test("đơn thiếu tồn được lưu chờ kho thay vì làm âm kho", () => {
  assert.deepEqual(crmInventoryAvailability({ stock: 0 }, 1), {
    requested: 1,
    available: 0,
    shortage: 1,
    status: "pending_stock",
    canFulfill: false,
  });
});

test("dịch vụ không gắn sản phẩm không bị kiểm tra tồn", () => {
  assert.equal(crmInventoryAvailability(null, 1).status, "not_applicable");
});

test("mọi màn hình dùng cùng phân loại hiệu suất từ FinancialSummary", () => {
  const summary = { performance_employee_ids: { good: [1], warning: [2], improve: [3], insufficient: [4] } };
  assert.equal(sharedPerformanceStatus(summary, 1), "tot");
  assert.equal(sharedPerformanceStatus(summary, "2"), "trung_binh");
  assert.equal(sharedPerformanceStatus(summary, 3), "canh_bao");
  assert.equal(sharedPerformanceStatus(summary, 4), "chua_co_du_lieu");
});

test("báo cáo quý không tính tháng tương lai và tách số giao dịch khỏi tiền", () => {
  const today = new Date("2026-08-05T12:00:00+07:00");
  assert.equal(isFutureReportMonth(2026, 9, today), true);
  const totals = summarizeQuarterSnapshots([
    { year: 2026, month: 7, revenue: 4_000_000, accountingProfit: 1_000_000, missingInvoices: 1 },
    { year: 2026, month: 8, revenue: 2_000_000, accountingProfit: -30_000, missingInvoices: 0 },
    { year: 2026, month: 9, revenue: 99_000_000, accountingProfit: 99_000_000, missingInvoices: 9 },
  ], today);
  assert.equal(totals.revenue, 6_000_000);
  assert.equal(totals.accountingProfit, 970_000);
  assert.equal(totals.missingInvoices, 1);
});
