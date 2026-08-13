const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (window.location.port === "5173" ? "http://127.0.0.1:8000" : window.location.origin);
const TOKEN_KEY = "domix_auth_token";

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (Number.isInteger(Number(data.version)) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("domix:state-version", { detail: Number(data.version) }));
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (!path.startsWith("/api/auth/login") && !path.startsWith("/api/auth/register") && !path.startsWith("/api/auth/forgot-password")) {
      window.dispatchEvent(new CustomEvent("domix:auth-expired"));
    }
  }
  if (!response.ok) {
    const summary = data.error || `Lỗi API (${response.status})`;
    const detail = typeof data.detail === "string" ? data.detail.trim() : "";
    const message = detail && detail !== summary ? `${summary}: ${detail}` : summary;
    const error = new Error(message);
    error.status = response.status;
    error.detail = detail;
    error.requestId = data.requestId || "";
    error.payload = data;
    throw error;
  }
  return data;
}

export async function login(email, password) {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function requestRegistrationOtp(email, password, confirmPassword) {
  return requestJson("/api/auth/register/request-otp", {
    method: "POST",
    body: JSON.stringify({ email, password, confirmPassword }),
  });
}

export async function verifyRegistrationOtp(email, otp) {
  const result = await requestJson("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function requestPasswordResetOtp(email) {
  return requestJson("/api/auth/forgot-password/request-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordWithOtp(email, otp, newPassword, confirmPassword) {
  const result = await requestJson("/api/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify({ email, otp, newPassword, confirmPassword }),
  });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result.user;
}

export async function logout() {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function getCurrentUser() {
  return requestJson("/api/auth/me");
}

export async function loadAppData() {
  return requestJson("/api/data");
}

export async function loadAppFields(fields = [], options = {}) {
  const names = Array.from(new Set((fields || []).filter(Boolean)));
  const path = appendQuery("/api/data/fields", {
    names: names.join(","),
    force: options.force ? 1 : undefined,
  });
  return requestJson(path, { cache: "no-store" });
}

export async function saveAppFields(data, expectedVersion) {
  return requestJson("/api/data/fields", {
    method: "PUT",
    body: JSON.stringify({ data, expectedVersion }),
  });
}


export async function fetchFinancialSummary(year, month) {
  return requestJson(appendQuery("/api/financial-summary", { year, month }), { cache: "no-store" });
}

export async function fetchFinancialSummarySeries(year, month, months = 6) {
  return requestJson(appendQuery("/api/financial-summary/series", { year, month, months }), { cache: "no-store" });
}

export async function fetchDebtPaymentHistory(debtId) {
  return requestJson(appendQuery("/api/company-data/debt-payments", { debtId }), { cache: "no-store" });
}

export async function fetchInventoryMovements(productId) {
  return requestJson(appendQuery("/api/company-data/inventory-movements", { productId }), { cache: "no-store" });
}

// ---------- Sổ cái hạch toán kép (chạy song song với dữ liệu nghiệp vụ) ----------
export async function fetchAccountingJournal(params = {}) {
  return requestJson(appendQuery("/api/accounting/journal", params), { cache: "no-store" });
}
export async function fetchTrialBalance(params = {}) {
  return requestJson(appendQuery("/api/accounting/trial-balance", params), { cache: "no-store" });
}
export async function fetchVatBooks(params = {}) {
  return requestJson(appendQuery("/api/accounting/vat-books", params), { cache: "no-store" });
}
export async function fetchLedgerReconciliation(params = {}) {
  return requestJson(appendQuery("/api/accounting/reconciliation", params), { cache: "no-store" });
}
export async function fetchAccountingPeriods() {
  return requestJson("/api/accounting/periods", { cache: "no-store" });
}
export async function syncAccountingLedger(mode = "preview") {
  return requestJson("/api/accounting/sync", { method: "POST", body: JSON.stringify({ mode }) });
}
export async function reverseJournalEntry(entryId, reason) {
  return requestJson("/api/accounting/journal/reverse", { method: "POST", body: JSON.stringify({ entryId, reason }) });
}
export async function lockAccountingPeriod(period) {
  return requestJson("/api/accounting/periods/lock", { method: "POST", body: JSON.stringify({ period }) });
}
export async function unlockAccountingPeriod(period, reason) {
  return requestJson("/api/accounting/periods/unlock", { method: "POST", body: JSON.stringify({ period, reason }) });
}
export async function fetchInventoryReconciliation(params = {}) {
  return requestJson(appendQuery("/api/accounting/inventory-reconciliation", params), { cache: "no-store" });
}
export async function fetchOpeningInventoryBatches() {
  return requestJson("/api/accounting/opening-inventory", { cache: "no-store" });
}
export async function suggestOpeningInventory() {
  return requestJson("/api/accounting/opening-inventory/suggest", { cache: "no-store" });
}
export async function createOpeningInventoryBatch(payload) {
  const idempotencyKey = payload?.idempotencyKey || `opening-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return requestJson("/api/accounting/opening-inventory", {
    method: "POST",
    body: JSON.stringify({ ...payload, idempotencyKey }),
  });
}
export async function reviewOpeningInventoryBatch(batchId) {
  return requestJson("/api/accounting/opening-inventory/review", { method: "POST", body: JSON.stringify({ batchId }) });
}
export async function postOpeningInventoryBatch(batchId, mode = "preview") {
  return requestJson("/api/accounting/opening-inventory/post", { method: "POST", body: JSON.stringify({ batchId, mode }) });
}
export async function reverseOpeningInventoryBatch(batchId, reason) {
  return requestJson("/api/accounting/opening-inventory/reverse", { method: "POST", body: JSON.stringify({ batchId, reason }) });
}
export async function deleteDraftOpeningInventoryBatch(batchId) {
  return requestJson("/api/accounting/opening-inventory/delete-draft", { method: "POST", body: JSON.stringify({ batchId }) });
}

export async function createDebtPayment(debtId, payment) {
  const idempotencyKey = payment?.idempotencyKey || `debt-${debtId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return requestJson("/api/company-data/debt-payments", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ debtId, payment: { ...payment, idempotencyKey }, idempotencyKey }),
  });
}

export async function deleteDebtPayment(debtId, paymentId, reason) {
  return requestJson("/api/company-data/debt-payments", {
    method: "DELETE",
    body: JSON.stringify({ debtId, paymentId, reason }),
  });
}

export async function upsertInventoryProduct(product, openingStock = 0) {
  return requestJson("/api/company-data/inventory-product", {
    method: "POST",
    body: JSON.stringify({ product, openingStock }),
  });
}

export async function createPayrollPayment(payload) {
  return requestJson("/api/company-data/payroll-payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resolvePayrollReconciliation(payload) {
  return requestJson("/api/company-data/payroll-reconciliation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setDirectorPassword(currentPassword, newPassword) {
  return requestJson("/api/company-data/director-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function verifyDirectorPassword(password) {
  return requestJson("/api/company-data/director-password/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function fetchPayrollWorkflow() {
  return requestJson("/api/payroll/workflow");
}

export async function fetchTasks() {
  return requestJson("/api/tasks", { cache: "no-store" });
}

export async function saveAppData(data, expectedVersion) {
  return requestJson("/api/data", {
    method: "PUT",
    body: JSON.stringify({ data, expectedVersion }),
  });
}

export async function listEmployees() {
  return requestJson("/api/employees", { cache: "no-store" });
}

export async function saveEmployees(employees) {
  return requestJson("/api/employees", {
    method: "PUT",
    body: JSON.stringify({ employees }),
  });
}

export async function upsertEmployeeWithAccount(employee, password = "") {
  return requestJson("/api/employees/upsert", {
    method: "POST",
    body: JSON.stringify({ employee, password }),
  });
}

export async function deleteEmployee(employeeId) {
  return requestJson("/api/employees", {
    method: "DELETE",
    body: JSON.stringify({ employeeId }),
  });
}

export async function listUsers() {
  return requestJson("/api/users");
}

export async function saveUser(user) {
  return requestJson("/api/users", {
    method: "POST",
    body: JSON.stringify(user),
  });
}

export async function deleteUser(email) {
  return requestJson("/api/users", {
    method: "DELETE",
    body: JSON.stringify({ email }),
  });
}

export async function fetchChatConversations() {
  return requestJson("/api/chat/conversations");
}

export async function fetchChatUnread() {
  return requestJson("/api/chat/unread", { cache: "no-store" });
}

function appendQuery(path, params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export async function fetchChatMessages(peerEmail, options = {}) {
  return requestJson(appendQuery("/api/chat/messages", { peer: peerEmail, ...options }));
}

export async function fetchChatReadReceipts(peerEmail, options = {}) {
  return requestJson(appendQuery("/api/chat/messages/read-receipts", { peer: peerEmail, ...options }));
}

export async function fetchChatGroups() {
  return requestJson("/api/chat/groups");
}

export async function fetchChatGroupMessages(groupId, options = {}) {
  return requestJson(appendQuery("/api/chat/group-messages", { groupId, ...options }));
}

export async function sendChatMessage(recipientEmail, body) {
  return requestJson("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({ recipientEmail, body }),
  });
}

export async function assignSupportRequest(payload) {
  return requestJson("/api/support/assign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmSupportRequest(caseId) {
  return requestJson("/api/support/confirm", {
    method: "POST",
    body: JSON.stringify({ caseId }),
  });
}

export async function reportSupportCase(caseId, resultNote) {
  return requestJson("/api/support/report", {
    method: "POST",
    body: JSON.stringify({ caseId, resultNote }),
  });
}

export async function approveSupportCase(caseId) {
  return requestJson("/api/support/approve", {
    method: "POST",
    body: JSON.stringify({ caseId }),
  });
}

export async function rejectSupportCase(caseId, reason) {
  return requestJson("/api/support/reject", {
    method: "POST",
    body: JSON.stringify({ caseId, reason }),
  });
}

export async function createCrmOrder(payload) {
  return requestJson("/api/company-data/crm-orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Xóa đơn CRM nguyên tử (chỉ Admin): server tự hủy đơn (hoàn tồn + bút toán đảo) rồi xóa
// hẳn đơn cùng giao dịch thu/công nợ/đơn phân phối liên quan trong MỘT request.
export async function deleteCrmOrder(orderId) {
  return requestJson("/api/company-data/crm-orders/delete", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function sendChatGroupMessage(groupId, body) {
  return requestJson("/api/chat/group-messages", {
    method: "POST",
    body: JSON.stringify({ groupId, body }),
  });
}

export async function deleteChatMessage(messageId) {
  return requestJson("/api/chat/messages/delete", {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
}

export async function clearChatConversation(peerEmail) {
  return requestJson("/api/chat/messages/clear", {
    method: "POST",
    body: JSON.stringify({ peerEmail }),
  });
}

export async function deleteChatGroupMessage(messageId) {
  return requestJson("/api/chat/group-messages/delete", {
    method: "POST",
    body: JSON.stringify({ messageId }),
  });
}

export async function clearChatGroupConversation(groupId) {
  return requestJson("/api/chat/group-messages/clear", {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}

export async function markChatRead(peerEmail) {
  return requestJson("/api/chat/read", {
    method: "POST",
    body: JSON.stringify({ peerEmail }),
  });
}

export async function markChatGroupRead(groupId) {
  return requestJson("/api/chat/group-read", {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}

export async function createChatGroup(name, memberEmails) {
  return requestJson("/api/chat/groups", {
    method: "POST",
    body: JSON.stringify({ name, memberEmails }),
  });
}

export async function updateChatGroupMembers(groupId, name, memberEmails) {
  return requestJson("/api/chat/groups/members", {
    method: "POST",
    body: JSON.stringify({ groupId, name, memberEmails }),
  });
}

export async function deleteChatGroup(groupId) {
  return requestJson("/api/chat/groups/delete", {
    method: "POST",
    body: JSON.stringify({ groupId }),
  });
}

export async function changePassword(currentPassword, newPassword) {
  return requestJson("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}


export async function sendAiMessage(payload) {
  return requestJson("/api/ai/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
