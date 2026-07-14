// ============================================================================
// DOMIX — LỚP NGHIỆP VỤ TÀI CHÍNH TẬP TRUNG (thuần, không phụ thuộc React)
//
// Nguyên tắc cứng (xem yêu cầu nghiệp vụ):
//   1. Đơn hàng ≠ đã thu tiền. Hóa đơn ≠ đã thu tiền. Duyệt quyết toán ≠ tiền đã chuyển.
//   2. Thu Chi CHỈ ghi dòng tiền thực tế vào/ra tài khoản công ty.
//   3. Tiền chưa thực thu/thực trả nằm ở Công nợ (debts) với lịch sử thanh toán từng phần.
//   4. Mọi bản ghi tự sinh mang sourceModule + sourceId để chống trùng và truy vết.
//   5. Tiền luôn ép Number và làm tròn tại MỘT nơi (roundVND).
// ============================================================================

// ---------- Tiền tệ ----------
export const roundVND = (n) => Math.round(Number(n) || 0);
export const toNum = (n) => Number(n) || 0;

// ---------- Phân quyền tập trung ----------
// Chưa có role "kế toán" riêng trong bảng users (chỉ admin/user) — dùng roleType hồ sơ
// nhân sự để nhận diện kế toán. Hàm duy nhất mọi nơi phải gọi, dễ mở rộng về sau.
export const ACTIONS = {
  MANAGE_PARTNERS: "manage_partners",          // tạo/sửa đối tác, cấu hình thu tiền & hóa đơn
  CREATE_SETTLEMENT: "create_settlement",      // tạo hồ sơ quyết toán
  APPROVE_SETTLEMENT: "approve_settlement",    // duyệt/hủy quyết toán
  CONFIRM_PARTNER_INVOICE: "confirm_partner_invoice", // xác nhận đối tác đã xuất VAT
  RECORD_PAYMENT: "record_payment",            // ghi nhận dòng tiền thật (thu/trả công nợ)
  EDIT_FINANCIALS: "edit_financials",          // sửa số liệu tài chính
  APPROVE_PAYROLL: "approve_payroll",
  DELETE_DATA: "delete_data",
};

export function can(authUser, action, employees = []) {
  if (!authUser) return false;
  if (authUser.role === "admin") return true;
  const emp = (employees || []).find(
    (e) => (e.email || "").trim().toLowerCase() === (authUser.email || "").trim().toLowerCase()
  );
  const isAccountant = emp?.roleType === "ke_toan";
  if (isAccountant) {
    return [
      ACTIONS.CREATE_SETTLEMENT,
      ACTIONS.CONFIRM_PARTNER_INVOICE,
      ACTIONS.RECORD_PAYMENT,
      ACTIONS.APPROVE_PAYROLL,
      ACTIONS.EDIT_FINANCIALS,
    ].includes(action);
  }
  return false; // sale/user thường: chỉ xem + sửa thông tin khách (không qua can())
}

// ---------- Chuẩn hóa ĐỐI TÁC (mục I) ----------
// Mặc định suy từ partnerRole cho dữ liệu cũ, nhưng từ đây trách nhiệm thật luôn đọc
// từ cashCollector / customerInvoiceIssuer đã lưu — KHÔNG suy lại từ role lúc runtime.
export function normalizePartner(p) {
  if (!p) return p;
  const role = p.partnerRole || "dai_ly";
  // Mặc định migration BÁM THEO ngữ nghĩa luồng cũ: mọi đối tác hoa hồng (đại lý LẪN
  // nhượng quyền kiểu Say Media) đều là "đối tác thu tiền khách, xuất VAT, nộp phần còn
  // lại về công ty" — đúng như computeDistributionSplit cũ. Admin đổi lại trong form
  // đối tác nếu hợp đồng thực tế khác (công ty thu tiền, trả phí cho đối tác).
  const defaults = {
    dai_ly: { cashCollector: "partner", customerInvoiceIssuer: "partner" },
    nhuong_quyen: { cashCollector: "partner", customerInvoiceIssuer: "partner" },
    nha_cung_cap: { cashCollector: "company", customerInvoiceIssuer: "company" },
  }[role] || { cashCollector: "partner", customerInvoiceIssuer: "partner" };
  return {
    ...p,
    partnerRole: role,
    cashCollector: p.cashCollector || defaults.cashCollector,
    customerInvoiceIssuer: p.customerInvoiceIssuer || defaults.customerInvoiceIssuer,
    settlementCycle: p.settlementCycle || "monthly",
    settlementDay: p.settlementDay ?? 5,
    commissionBase: p.commissionBase || "before_vat",
    defaultVatRate: p.defaultVatRate ?? 8,
    invoiceAttachmentRequired: p.invoiceAttachmentRequired ?? false,
    partnerCommissionInvoiceRequired: p.partnerCommissionInvoiceRequired ?? false,
    contractNo: p.contractNo || "",
    contractDate: p.contractDate || "",
    contractNote: p.contractNote || "",
    active: p.active ?? true,
  };
}

// ---------- Chuẩn hóa ĐƠN PHÂN PHỐI (mục II + XIII) ----------
// 4 nhóm trạng thái ĐỘC LẬP. partnerInvoiceReceived cũ chỉ chuyển thành "đã có chứng từ",
// TUYỆT ĐỐI không hiểu là "đã nhận tiền".
export function normalizeDistributionOrder(o, partnersById = {}) {
  if (!o) return o;
  if (o._normalized) return o;
  const partner = partnersById[o.partnerId];
  const isPurchase = o.orderKind === "purchase";
  const legacyConfirmed = !!(o.partnerInvoiceConfirmed || o.partnerInvoiceReceived);
  const legacyHadTx = !!o.linkedTxId;
  return {
    ...o,
    _normalized: true,
    revenue: toNum(o.revenue),
    quantity: toNum(o.quantity) || 1,
    vatRate: toNum(o.vatRate),
    commissionPct: toNum(o.commissionPct),
    // 1) Trạng thái đơn hàng
    orderStatus: o.orderStatus || (isPurchase ? "fulfilled" : "confirmed"),
    // 2) Trạng thái khách thanh toán — dữ liệu cũ không lưu; nếu chu trình cũ đã chạy trọn
    // (xác nhận + có giao dịch) coi như khách đã trả, kèm migrationNote cho kế toán soát lại.
    customerPaymentStatus: o.customerPaymentStatus || (legacyConfirmed ? "paid" : "unpaid"),
    customerPaidAmount: toNum(o.customerPaidAmount ?? (legacyConfirmed ? o.revenue : 0)),
    customerPaidAt: o.customerPaidAt || "",
    customerPaymentMethod: o.customerPaymentMethod || "",
    cashCollector: o.cashCollector || partner?.cashCollector || "partner",
    // 3) Trạng thái hóa đơn cho khách cuối
    customerInvoiceIssuer: o.customerInvoiceIssuer || partner?.customerInvoiceIssuer || "partner",
    customerInvoiceStatus: o.customerInvoiceStatus || (legacyConfirmed ? "issued" : "pending"),
    customerInvoiceNo: o.customerInvoiceNo || o.partnerInvoiceNo || "",
    customerInvoiceDate: o.customerInvoiceDate || "",
    customerInvoiceAttachmentData: o.customerInvoiceAttachmentData || "",
    customerInvoiceAttachmentName: o.customerInvoiceAttachmentName || "",
    customerInvoiceConfirmedBy: o.customerInvoiceConfirmedBy || "",
    customerInvoiceConfirmedAt: o.customerInvoiceConfirmedAt || "",
    customerInvoiceNote: o.customerInvoiceNote || "",
    invoiceEvidenceReceived: o.invoiceEvidenceReceived ?? !!o.partnerInvoiceReceived,
    // 4) Trạng thái quyết toán công ty ↔ đối tác
    settlementStatus: o.settlementStatus
      || (isPurchase ? "settled" : legacyConfirmed && legacyHadTx ? "settled" : legacyConfirmed ? "awaiting_settlement" : "awaiting_settlement"),
    settlementId: o.settlementId ?? null,
    migrationNote: o.migrationNote
      || (legacyHadTx && !isPurchase
        ? "Chuyển đổi từ luồng cũ: giao dịch Thu cũ được GIỮ NGUYÊN — kế toán soát lại đối chiếu."
        : ""),
  };
}

// ---------- Tài chính phân phối DUY NHẤT (mục III) ----------
// Mọi nơi cần số tiền của một đơn hợp tác PHẢI gọi hàm này — không tự chia rải rác trong JSX.
export function calculateDistributionFinancials(order, partner) {
  const gross = roundVND(order.revenue);
  const vatRate = toNum(order.vatRate ?? partner?.defaultVatRate);
  const amountBeforeVatRaw = vatRate ? gross / (1 + vatRate / 100) : gross;
  const amountBeforeVat = roundVND(amountBeforeVatRaw);
  const vatAmount = gross - amountBeforeVat;

  const commissionPct = toNum(order.commissionPct);
  const commissionBase = partner?.commissionBase || "before_vat";
  const commissionBaseAmount = commissionBase === "gross" ? gross : amountBeforeVat;
  const commissionAmount = roundVND(commissionBaseAmount * (commissionPct / 100));

  const cashCollector = order.cashCollector || partner?.cashCollector || "partner";
  const invoiceIssuer = order.customerInvoiceIssuer || partner?.customerInvoiceIssuer || "partner";

  let amountDueToCompany = 0;
  let amountDueToPartner = 0;
  if (cashCollector === "partner") {
    // Đối tác giữ tiền khách: sau khi giữ VAT (đối tác xuất hóa đơn) + hoa hồng,
    // phần còn lại phải nộp về công ty.
    amountDueToCompany = roundVND(amountBeforeVat - commissionAmount);
  } else {
    // Công ty giữ tiền khách: công ty nợ đối tác đúng phần hoa hồng.
    amountDueToPartner = commissionAmount;
  }
  const debtDirection = amountDueToCompany > 0
    ? "partner_owes_company"
    : amountDueToPartner > 0
      ? "company_owes_partner"
      : "none";
  return {
    grossCustomerAmount: gross, vatRate, amountBeforeVat, vatAmount,
    commissionPct, commissionBaseAmount: roundVND(commissionBaseAmount), commissionAmount,
    amountDueToCompany, amountDueToPartner, debtDirection, cashCollector, invoiceIssuer,
  };
}

// ---------- HỒ SƠ QUYẾT TOÁN (mục IV) ----------
export function eligibleOrdersForSettlement(distOrders, partnerId, periodFrom, periodTo) {
  return (distOrders || []).filter((o) =>
    o.partnerId === partnerId
    && o.orderKind !== "purchase"
    && o.orderStatus !== "cancelled"
    && !o.settlementId
    && o.settlementStatus !== "settled" // đơn đã tất toán theo luồng cũ không được quyết toán lại
    && (o.date || "") >= periodFrom && (o.date || "") <= periodTo
  );
}

export function buildSettlementDraft({ partner, orders, periodFrom, periodTo, resolvePct }) {
  let grossRevenue = 0, amountBeforeVat = 0, vatAmount = 0, commissionAmount = 0;
  let amountDueToCompany = 0, amountDueToPartner = 0;
  const lines = orders.map((o) => {
    const pct = resolvePct ? resolvePct(o) : toNum(o.commissionPct);
    const fin = calculateDistributionFinancials({ ...o, commissionPct: pct }, partner);
    grossRevenue += fin.grossCustomerAmount;
    amountBeforeVat += fin.amountBeforeVat;
    vatAmount += fin.vatAmount;
    commissionAmount += fin.commissionAmount;
    amountDueToCompany += fin.amountDueToCompany;
    amountDueToPartner += fin.amountDueToPartner;
    return { orderId: o.id, date: o.date, endCustomerName: o.endCustomerName || "", productName: o.productName || "", commissionPct: pct, ...fin };
  });
  const net = roundVND(amountDueToCompany - amountDueToPartner);
  const direction = net > 0 ? "partner_to_company" : net < 0 ? "company_to_partner" : "balanced";
  const netAmount = Math.abs(net);
  return {
    id: Date.now(),
    settlementCode: `QT-${partner.id}-${(periodTo || "").replace(/-/g, "")}-${String(Date.now()).slice(-4)}`,
    partnerId: partner.id,
    periodFrom, periodTo,
    createdAt: new Date().toISOString(),
    approvedAt: null, approvedBy: "",
    dueDate: "",
    orderIds: orders.map((o) => o.id),
    lines,
    grossRevenue: roundVND(grossRevenue),
    amountBeforeVat: roundVND(amountBeforeVat),
    vatAmount: roundVND(vatAmount),
    commissionAmount: roundVND(commissionAmount),
    amountDueToCompany: roundVND(amountDueToCompany),
    amountDueToPartner: roundVND(amountDueToPartner),
    netAmount,
    direction,
    invoiceIssuer: partner.customerInvoiceIssuer || "partner",
    invoiceStatus: "pending", invoiceNo: "", invoiceDate: "",
    invoiceAttachmentData: "", invoiceAttachmentName: "", invoiceNote: "",
    paidAmount: 0, remainingAmount: netAmount,
    paymentStatus: "unpaid",
    debtId: null, linkedTransactionIds: [],
    note: "", status: "draft",
  };
}

export function approveSettlement(settlement, approvedBy) {
  return {
    ...settlement,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedBy: approvedBy || "",
  };
}

// Duyệt quyết toán → tạo ĐÚNG MỘT khoản công nợ (chưa có Thu/Chi nào cả).
export function createDebtFromSettlement(settlement, partner, existingDebts) {
  if (settlement.direction === "balanced" || settlement.netAmount <= 0) return null;
  const dup = (existingDebts || []).find(
    (d) => d.sourceModule === "distribution_settlement" && d.sourceId === settlement.id
  );
  if (dup) return null; // chống trùng (mục XIV)
  const type = settlement.direction === "partner_to_company" ? "thu" : "tra";
  return {
    id: settlement.id + 1,
    type,
    counterpartyType: "distribution_partner",
    counterpartyId: partner.id,
    counterpartyName: partner.name,
    counterpartyTaxCode: partner.taxCode || "",
    counterpartyPhone: partner.phone || "",
    counterpartyEmail: partner.email || "",
    sourceModule: "distribution_settlement",
    sourceId: settlement.id,
    settlementId: settlement.id,
    settlementCode: settlement.settlementCode,
    orderId: null,
    amount: settlement.netAmount,
    paidAmount: 0,
    remainingAmount: settlement.netAmount,
    issueDate: (settlement.approvedAt || new Date().toISOString()).slice(0, 10),
    dueDate: settlement.dueDate || "",
    status: "open",
    paymentHistory: [],
    invoiceIssuer: settlement.invoiceIssuer,
    invoiceNo: settlement.invoiceNo || "",
    invoiceDate: settlement.invoiceDate || "",
    note: `Quyết toán ${settlement.settlementCode} (${settlement.periodFrom} → ${settlement.periodTo})`,
    createdAt: new Date().toISOString(),
    createdBy: settlement.approvedBy || "",
  };
}

// ---------- CÔNG NỢ (mục VI + XIII.5) ----------
export function normalizeDebt(d) {
  if (!d) return d;
  if (d._normalized) return d;
  const amount = roundVND(d.amount);
  const paidAmount = roundVND(d.paidAmount ?? (d.status === "paid" ? amount : 0));
  const remainingAmount = roundVND(d.remainingAmount ?? (amount - paidAmount));
  const paymentHistory = Array.isArray(d.paymentHistory)
    ? d.paymentHistory
    : (d.status === "paid" && d.linkedTxId
      ? [{ id: d.linkedTxId, date: d.issueDate || "", amount, paymentMethod: "chuyen_khoan", referenceNo: "", linkedTransactionId: d.linkedTxId, note: "Chuyển đổi từ dữ liệu cũ (đánh dấu đã trả toàn bộ)", createdBy: "" }]
      : []);
  return {
    ...d,
    _normalized: true,
    counterpartyType: d.counterpartyType || "other",
    counterpartyId: d.counterpartyId ?? null,
    counterpartyName: d.counterpartyName || d.partner || "",
    sourceModule: d.sourceModule || "manual",
    sourceId: d.sourceId ?? null,
    settlementId: d.settlementId ?? null,
    orderId: d.orderId ?? null,
    amount, paidAmount, remainingAmount, paymentHistory,
    status: remainingAmount <= 0 && amount > 0 ? "paid" : paidAmount > 0 ? "partial" : (d.status === "cancelled" ? "cancelled" : "open"),
    createdAt: d.createdAt || "",
    createdBy: d.createdBy || "",
  };
}

export function debtDisplayStatus(debt, todayStr) {
  if (debt.status === "paid" || debt.status === "cancelled") return debt.status;
  if (debt.dueDate && todayStr && debt.dueDate < todayStr) return "overdue";
  return debt.status;
}

export function daysOverdue(debt, todayStr) {
  if (!debt.dueDate || debt.status === "paid" || debt.status === "cancelled") return 0;
  const due = new Date(debt.dueDate);
  const today = new Date(todayStr);
  const diff = Math.floor((today - due) / 86400000);
  return diff > 0 ? diff : 0;
}

// Ghi nhận MỘT lần thanh toán công nợ (một phần hoặc toàn bộ) → đúng 1 giao dịch Thu/Chi.
export function recordDebtPayment(debt, { amount, date, paymentMethod, referenceNo, note, createdBy }, existingTransactions) {
  const payAmount = roundVND(amount);
  if (payAmount <= 0) return { error: "Số tiền thanh toán phải lớn hơn 0." };
  if (payAmount > debt.remainingAmount) return { error: `Số tiền vượt quá còn nợ (${debt.remainingAmount.toLocaleString("vi-VN")}đ).` };
  // ID duy nhất kể cả khi 2 lần thanh toán rơi vào cùng mili-giây.
  const paymentId = Date.now() * 100 + Math.floor(Math.random() * 100);
  // Chống trùng: cùng một lần thanh toán không được tạo 2 giao dịch (mục XIV).
  const dupTx = findDuplicateTransaction(existingTransactions, {
    sourceModule: "congno_payment", sourceId: paymentId, kind: debt.type === "thu" ? "thu" : "chi",
  });
  if (dupTx) return { error: "Lần thanh toán này đã có giao dịch Thu Chi — không tạo trùng." };
  const transaction = makeTransaction({
    id: paymentId + 1,
    date: date || new Date().toISOString().slice(0, 10),
    kind: debt.type === "thu" ? "thu" : "chi",
    category: debt.type === "thu" ? "Thu công nợ" : "Trả công nợ",
    desc: `${debt.type === "thu" ? "Thu nợ từ" : "Trả nợ cho"} ${debt.counterpartyName}${debt.settlementCode ? ` — ${debt.settlementCode}` : ""}${note ? " — " + note : ""}`,
    amount: payAmount,
    partnerName: debt.counterpartyName,
    paymentMethod: paymentMethod || "chuyen_khoan",
    sourceModule: "congno_payment",
    sourceId: paymentId,
    debtId: debt.id,
    settlementId: debt.settlementId || null,
    orderId: debt.orderId || null,
    paymentReference: referenceNo || "",
    createdAutomatically: true,
  });
  const payment = {
    id: paymentId,
    date: transaction.date,
    amount: payAmount,
    paymentMethod: paymentMethod || "chuyen_khoan",
    referenceNo: referenceNo || "",
    linkedTransactionId: transaction.id,
    note: note || "",
    createdBy: createdBy || "",
  };
  const paidAmount = roundVND(debt.paidAmount + payAmount);
  const remainingAmount = roundVND(debt.amount - paidAmount);
  const updatedDebt = {
    ...debt,
    paidAmount, remainingAmount,
    status: remainingAmount <= 0 ? "paid" : "partial",
    paymentHistory: [...(debt.paymentHistory || []), payment],
  };
  return { updatedDebt, transaction, payment };
}

// Xóa/hủy một lần thanh toán: đảo giao dịch liên kết + phục hồi đúng số dư (CA 9).
export function removeDebtPayment(debt, paymentId) {
  const payment = (debt.paymentHistory || []).find((p) => p.id === paymentId);
  if (!payment) return { error: "Không tìm thấy lần thanh toán." };
  const paidAmount = roundVND(debt.paidAmount - payment.amount);
  const remainingAmount = roundVND(debt.amount - paidAmount);
  const updatedDebt = {
    ...debt,
    paidAmount, remainingAmount,
    status: paidAmount <= 0 ? "open" : remainingAmount <= 0 ? "paid" : "partial",
    paymentHistory: (debt.paymentHistory || []).filter((p) => p.id !== paymentId),
  };
  return { updatedDebt, removedTransactionId: payment.linkedTransactionId };
}

// ---------- THU CHI (mục VII + XIV) ----------
export function makeTransaction(fields) {
  return {
    // các trường giao diện cũ vẫn dùng
    partnerTaxCode: "", partnerPhone: "", partnerEmail: "",
    invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: "", vatRate: 0,
    attachmentData: "", attachmentName: "", attachmentType: "",
    status: "approved",
    // trường truy vết mới (mục VII)
    sourceModule: fields.sourceModule || "manual",
    sourceId: fields.sourceId ?? null,
    debtId: fields.debtId ?? null,
    settlementId: fields.settlementId ?? null,
    orderId: fields.orderId ?? null,
    cashDirection: fields.kind === "thu" ? "in" : "out",
    paymentReference: fields.paymentReference || "",
    bankAccount: fields.bankAccount || "",
    actualPaymentDate: fields.actualPaymentDate || fields.date || "",
    createdAutomatically: fields.createdAutomatically ?? false,
    reversalOfTransactionId: fields.reversalOfTransactionId ?? null,
    // giữ source cũ để tương thích badge hiện tại
    source: fields.source || fields.sourceModule || "manual",
    ...fields,
    amount: roundVND(fields.amount),
  };
}

export function findDuplicateTransaction(transactions, { sourceModule, sourceId, kind }) {
  if (sourceId == null) return null;
  return (transactions || []).find(
    (t) => (t.sourceModule || t.source) === sourceModule && (t.sourceId ?? t.sourceOrderId) === sourceId
      && (!kind || t.kind === kind) && !t.reversalOfTransactionId
  );
}

// Giao dịch tự sinh: không cho sửa số tiền trực tiếp khi nguồn còn tồn tại (mục VII).
export function isAutoTransaction(t) {
  if (t?.createdAutomatically) return true;
  return ["crm", "hoptac", "congno", "congno_payment", "payroll", "hoptac_muahang", "distribution_settlement"].includes(t?.source || t?.sourceModule);
}

export const SOURCE_MODULE_LABELS = {
  crm: "Từ CRM",
  congno: "Từ công nợ",
  congno_payment: "Thu/trả công nợ",
  distribution_settlement: "Quyết toán đối tác",
  hoptac: "Hợp tác phân phối",
  hoptac_muahang: "Nhập hàng",
  payroll: "Bảng lương",
  manual: "Nhập tay",
};

// ---------- KHO HÀNG (mục IX) ----------
const MOVEMENT_SIGNS = {
  opening: 1, purchase_in: 1, return_in: 1, adjustment_in: 1, cancel_reverse: 1,
  sale_out: -1, distribution_out: -1, adjustment_out: -1,
};

export function hasStockMovement(movements, { sourceModule, sourceId, movementType }) {
  return (movements || []).some(
    (m) => m.sourceModule === sourceModule && m.sourceId === sourceId && m.movementType === movementType
  );
}

// HÀM DUY NHẤT được phép đổi tồn kho. Trả về null nếu trùng (đã trừ/cộng rồi — mục XIV).
export function buildStockMovement({ productId, movementType, quantity, date, sourceModule, sourceId, note, createdBy }, existingMovements) {
  if (hasStockMovement(existingMovements, { sourceModule, sourceId, movementType })) return null;
  const sign = MOVEMENT_SIGNS[movementType] ?? 0;
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    productId,
    movementType,
    quantity: Math.abs(toNum(quantity) || 1),
    delta: sign * Math.abs(toNum(quantity) || 1),
    date: date || new Date().toISOString().slice(0, 10),
    sourceModule: sourceModule || "manual",
    sourceId: sourceId ?? null,
    note: note || "",
    createdBy: createdBy || "",
    createdAt: new Date().toISOString(),
  };
}

export const MOVEMENT_LABELS = {
  opening: "Tồn đầu", purchase_in: "Nhập mua", sale_out: "Bán ra (CRM)",
  distribution_out: "Xuất phân phối", return_in: "Khách trả lại", adjustment_in: "Điều chỉnh tăng",
  adjustment_out: "Điều chỉnh giảm", cancel_reverse: "Hoàn tồn do hủy đơn",
};

// ---------- KHÁCH HÀNG (mục VIII) ----------
export function customerKeyOf(rec) {
  const phone = (rec.phone || "").replace(/\D/g, "");
  if (phone) return `p:${phone}`;
  const email = (rec.email || "").trim().toLowerCase();
  if (email) return `e:${email}`;
  return `n:${(rec.customerName || "").trim().toLowerCase()}`;
}

// Chuẩn hóa hồ sơ khách từ orders cũ (ưu tiên SĐT → email → tên). Không mất dữ liệu đơn.
export function buildCustomersFromOrders(orders, existingCustomers) {
  const customers = [...(existingCustomers || [])];
  const byKey = new Map(customers.map((c) => [customerKeyOf(c), c]));
  const orderCustomerIds = {};
  let seq = Date.now();
  for (const o of orders || []) {
    if (o.customerId && customers.some((c) => c.id === o.customerId)) {
      orderCustomerIds[o.id] = o.customerId;
      continue;
    }
    const key = customerKeyOf(o);
    let cust = byKey.get(key);
    if (!cust) {
      cust = {
        id: seq++,
        customerName: o.customerName || "(Chưa rõ tên)",
        phone: o.phone || "", secondaryPhone: "", email: o.email || "", zalo: "",
        customerType: o.customerTaxCode ? "company" : "individual",
        companyName: o.customerCompanyName || "", taxCode: o.customerTaxCode || "",
        invoiceAddress: "", address: "",
        source: o.source || "", assignedSaleEmployeeId: o.saleEmployeeId || null,
        status: "active", tags: [], note: "",
        createdAt: o.date || "", updatedAt: "",
        contactLog: [],
        auditLog: [],
      };
      customers.push(cust);
      byKey.set(key, cust);
    }
    orderCustomerIds[o.id] = cust.id;
  }
  return { customers, orderCustomerIds };
}

export function makeAuditEntry(field, oldValue, newValue, changedBy) {
  return {
    changedAt: new Date().toISOString(),
    changedBy: changedBy || "",
    field,
    oldValue: oldValue == null ? "" : String(oldValue),
    newValue: newValue == null ? "" : String(newValue),
  };
}

export function diffAudit(oldObj, newObj, fields, changedBy) {
  const entries = [];
  for (const f of fields) {
    const a = oldObj?.[f], b = newObj?.[f];
    if (String(a ?? "") !== String(b ?? "")) entries.push(makeAuditEntry(f, a, b, changedBy));
  }
  return entries;
}

// ---------- MIGRATION TỔNG khi load dữ liệu (mục XIII) ----------
export function migrateAppData(data) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  const partners = (out.distributionPartners || []).map(normalizePartner);
  const partnersById = Object.fromEntries(partners.map((p) => [p.id, p]));
  out.distributionPartners = partners;
  out.distributionOrders = (out.distributionOrders || []).map((o) => normalizeDistributionOrder(o, partnersById));
  out.debts = (out.debts || []).map(normalizeDebt);
  out.distributionSettlements = out.distributionSettlements || [];
  out.stockMovements = out.stockMovements || [];
  // Khách hàng: chuẩn hóa từ orders cũ, gắn customerId cho đơn chưa có.
  const { customers, orderCustomerIds } = buildCustomersFromOrders(out.orders || [], out.customers || []);
  out.customers = customers;
  out.orders = (out.orders || []).map((o) => ({
    ...o,
    customerId: o.customerId || orderCustomerIds[o.id] || null,
    // CRM cũ tạo Thu ngay khi tạo đơn → coi như đã thanh toán đủ (giữ giao dịch cũ, mục XIII.2)
    customerPaymentStatus: o.customerPaymentStatus || (o.linkedTxId ? "paid" : (o.customerPaymentStatus || "paid")),
    customerPaidAmount: toNum(o.customerPaidAmount ?? (o.linkedTxId ? o.amount : o.amount)),
    auditLog: o.auditLog || [],
  }));
  return out;
}
