import test from "node:test";
import assert from "node:assert/strict";

import {
  commissionBaseByEmployee,
  crmInventoryAvailability,
  isFutureReportMonth,
  sharedPerformanceStatus,
  summarizeQuarterSnapshots,
  upsaleCommission,
} from "./domain.js";


// ---------- Hoa hồng theo TIỀN THỰC THU ----------
const upsaleOrder = (paid) => ({
  id: "ord-1", date: "2026-08-06", amount: 10000000, saleEmployeeId: 7, dealType: "upsale",
  customerPaymentStatus: paid >= 10000000 ? "paid" : "unpaid", customerPaidAmount: paid,
});

test("đơn chưa thu tiền không phát sinh hoa hồng", () => {
  const base = commissionBaseByEmployee([upsaleOrder(0)], 2026, 8);
  assert.equal(base.upsale[7] ?? 0, 0);
  assert.equal(upsaleCommission(base.upsale[7] ?? 0, 7), 0);
});

test("thu một phần chỉ tính hoa hồng trên phần đã thu", () => {
  const base = commissionBaseByEmployee([upsaleOrder(4000000)], 2026, 8);
  assert.equal(base.upsale[7], 4000000);
  assert.equal(upsaleCommission(base.upsale[7], 7), 280000);
});

test("thu thêm chỉ cộng thêm phần chênh — tổng đúng, không cộng dồn trùng khi tính lại", () => {
  const after4 = upsaleCommission(commissionBaseByEmployee([upsaleOrder(4000000)], 2026, 8).upsale[7], 7);
  const after10 = upsaleCommission(commissionBaseByEmployee([upsaleOrder(10000000)], 2026, 8).upsale[7], 7);
  assert.equal(after10 - after4, 420000);
  assert.equal(after10, 700000);
  // Chạy tính lương lại lần 2 trên cùng dữ liệu — kết quả y hệt, không nhân đôi.
  const rerun = upsaleCommission(commissionBaseByEmployee([upsaleOrder(10000000)], 2026, 8).upsale[7], 7);
  assert.equal(rerun, 700000);
});

test("hoàn tiền làm giảm hoa hồng tương ứng; hủy toàn bộ thanh toán đưa hoa hồng về 0", () => {
  const afterRefund = upsaleCommission(commissionBaseByEmployee([upsaleOrder(8000000)], 2026, 8).upsale[7], 7);
  assert.equal(afterRefund, 560000);
  const afterVoid = upsaleCommission(commissionBaseByEmployee([upsaleOrder(0)], 2026, 8).upsale[7] ?? 0, 7);
  assert.equal(afterVoid, 0);
});

test("tiền thu không vượt quá giá trị đơn và đơn hủy không tính hoa hồng", () => {
  const overpaid = commissionBaseByEmployee([upsaleOrder(99000000)], 2026, 8);
  assert.equal(overpaid.upsale[7], 10000000);
  const cancelled = commissionBaseByEmployee([{ ...upsaleOrder(10000000), status: "da_huy" }], 2026, 8);
  assert.equal(cancelled.upsale[7] ?? 0, 0);
});

test("đơn sale thường và upsale tách hai cơ sở thưởng riêng theo nhân viên", () => {
  const base = commissionBaseByEmployee([
    { id: 1, date: "2026-08-05", amount: 5000000, saleEmployeeId: 7, dealType: "sale", customerPaidAmount: 5000000, customerPaymentStatus: "paid" },
    upsaleOrder(4000000),
  ], 2026, 8);
  assert.equal(base.sale[7], 5000000);
  assert.equal(base.upsale[7], 4000000);
});


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
