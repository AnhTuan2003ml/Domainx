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
  if (!response.ok) throw new Error(data.error || `Lỗi API (${response.status})`);
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

export async function saveAppData(data) {
  return requestJson("/api/data", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function listEmployees() {
  return requestJson("/api/employees");
}

export async function saveEmployees(employees) {
  return requestJson("/api/employees", {
    method: "PUT",
    body: JSON.stringify({ employees }),
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
  return requestJson("/api/chat/unread");
}

export async function fetchChatMessages(peerEmail) {
  return requestJson(`/api/chat/messages?peer=${encodeURIComponent(peerEmail)}`);
}

export async function fetchChatGroups() {
  return requestJson("/api/chat/groups");
}

export async function fetchChatGroupMessages(groupId) {
  return requestJson(`/api/chat/group-messages?groupId=${encodeURIComponent(groupId)}`);
}

export async function sendChatMessage(recipientEmail, body) {
  return requestJson("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({ recipientEmail, body }),
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

export async function deleteChatGroupMessage(messageId) {
  return requestJson("/api/chat/group-messages/delete", {
    method: "POST",
    body: JSON.stringify({ messageId }),
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
