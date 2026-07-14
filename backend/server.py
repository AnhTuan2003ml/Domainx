from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import mimetypes
import ssl
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from config import DEFAULT_DB_PATH, DIST_DIR
from db.schema import init_db
from db.state_store import read_state, write_state
from services import auth_service, chat_service, employee_service, registration_service, user_service


def _task_visible_to_user(task, employee_emails, user):
    if not isinstance(task, dict):
        return False
    if task.get("visibility") != "private":
        return True
    employee_email = employee_emails.get(str(task.get("employeeId")), "")
    return employee_email == (user.get("email") or "").strip().lower()


def filter_state_for_user(db_path, state, user):
    if not state or user.get("role") == "admin":
        return state
    data = state.get("data")
    if not isinstance(data, dict):
        return state
    filtered_data = dict(data)
    tasks = data.get("tasks")
    if isinstance(tasks, list):
        employee_emails = employee_service.employee_emails_by_id(db_path)
        filtered_data["tasks"] = [
            task for task in tasks
            if _task_visible_to_user(task, employee_emails, user)
        ]
    filtered_state = dict(state)
    filtered_state["data"] = filtered_data
    return filtered_state


def preserve_restricted_state_fields(db_path, incoming_data, user):
    if user.get("role") == "admin" or not isinstance(incoming_data, dict):
        return incoming_data
    existing = read_state(db_path)
    existing_data = existing.get("data") if existing else None
    if not isinstance(existing_data, dict):
        return incoming_data
    merged = dict(incoming_data)
    if "tasks" in existing_data:
        merged["tasks"] = existing_data["tasks"]
    return merged


class DomixHandler(BaseHTTPRequestHandler):
    db_path = DEFAULT_DB_PATH
    static_dir = DIST_DIR

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if route == "/api/health":
            return self.send_json({"ok": True})
        if route == "/api/auth/me":
            user = self.require_user()
            return self.send_json({"user": user}) if user else None
        if route == "/api/users":
            if not self.require_user("admin"):
                return
            return self.send_json({"users": user_service.list_users(self.db_path)})
        if route == "/api/chat/conversations":
            user = self.require_user()
            if not user:
                return
            return self.send_json(chat_service.conversations(self.db_path, user))
        if route == "/api/chat/unread":
            user = self.require_user()
            if not user:
                return
            return self.send_json(chat_service.unread(self.db_path, user))
        if route == "/api/chat/groups":
            user = self.require_user()
            if not user:
                return
            return self.send_json(chat_service.groups(self.db_path, user))
        if route == "/api/chat/messages":
            user = self.require_user()
            if not user:
                return
            peer_email = parse_qs(parsed.query).get("peer", [""])[0]
            try:
                return self.send_json(chat_service.messages(self.db_path, user, peer_email))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/group-messages":
            user = self.require_user()
            if not user:
                return
            group_id = parse_qs(parsed.query).get("groupId", ["0"])[0]
            try:
                return self.send_json(chat_service.group_messages(self.db_path, user, group_id))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/employees":
            user = self.require_user()
            if not user:
                return
            return self.send_json({"employees": employee_service.list_employees(self.db_path)})
        if route == "/api/data":
            user = self.require_user()
            if not user:
                return
            state = read_state(self.db_path)
            state = filter_state_for_user(self.db_path, state, user)
            return self.send_json(state or {"data": None, "updatedAt": None})
        if route.startswith("/api/"):
            return self.send_error(404, "Not found")
        return self.serve_static()

    def do_POST(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if route == "/api/auth/login":
            data = self.read_json()
            if data is None:
                return
            result = auth_service.login(
                self.db_path,
                data.get("email", ""),
                data.get("password", ""),
            )
            if not result:
                return self.send_json({"error": "Sai tài khoản hoặc mật khẩu"}, 401)
            return self.send_json(result)
        if route == "/api/auth/register/request-otp":
            data = self.read_json()
            if data is None:
                return
            try:
                result = registration_service.request_registration_otp(
                    self.db_path,
                    data.get("email", ""),
                    data.get("password", ""),
                    data.get("confirmPassword", ""),
                )
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            except Exception as exc:
                print(f"[OTP EMAIL ERROR] {exc}")
                return self.send_json({"error": "Không gửi được OTP. Vui lòng kiểm tra cấu hình email gửi mã."}, 503)
            return self.send_json(result)
        if route == "/api/auth/register/verify":
            data = self.read_json()
            if data is None:
                return
            try:
                result = registration_service.verify_registration_otp(
                    self.db_path,
                    data.get("email", ""),
                    data.get("otp", ""),
                )
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            return self.send_json(result)
        if route == "/api/auth/logout":
            auth_service.logout(self.db_path, self.bearer_token())
            return self.send_json({"ok": True})
        if route == "/api/auth/password":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                auth_service.change_password(
                    self.db_path,
                    user["email"],
                    data.get("currentPassword", ""),
                    data.get("newPassword", ""),
                )
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            return self.send_json({"ok": True})
        if route == "/api/chat/messages":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.send_message(
                    self.db_path,
                    user,
                    data.get("recipientEmail", ""),
                    data.get("body", ""),
                ))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/messages/delete":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.delete_message(self.db_path, user, data.get("messageId", 0)))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/group-messages":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.send_group_message(
                    self.db_path,
                    user,
                    data.get("groupId", 0),
                    data.get("body", ""),
                ))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/group-messages/delete":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.delete_group_message(self.db_path, user, data.get("messageId", 0)))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/read":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.mark_read(self.db_path, user, data.get("peerEmail", "")))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/group-read":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.mark_group_read(self.db_path, user, data.get("groupId", 0)))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/groups":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.create_group(
                    self.db_path,
                    user,
                    data.get("name", ""),
                    data.get("memberEmails", []),
                ))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/groups/members":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.update_group_members(
                    self.db_path,
                    user,
                    data.get("groupId", 0),
                    data.get("name", ""),
                    data.get("memberEmails", []),
                ))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/chat/groups/delete":
            user = self.require_user()
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                return self.send_json(chat_service.delete_group(self.db_path, user, data.get("groupId", 0)))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
        if route == "/api/users":
            if not self.require_user("admin"):
                return
            data = self.read_json()
            if data is None:
                return
            try:
                user_service.create_or_update_user(
                    self.db_path,
                    data.get("email", ""),
                    data.get("password", ""),
                    data.get("role", "user"),
                    data.get("active", 1),
                )
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            return self.send_json({"ok": True, "users": user_service.list_users(self.db_path)})
        self.send_error(404, "Not found")

    def do_DELETE(self):
        if self.path != "/api/users":
            self.send_error(404, "Not found")
            return
        user = self.require_user("admin")
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        email = (data.get("email") or "").strip().lower()
        deleted_current_user = email == user["email"]
        try:
            user_service.delete_user(self.db_path, email)
        except ValueError as exc:
            return self.send_json({"error": str(exc)}, 400)
        return self.send_json({"ok": True, "users": user_service.list_users(self.db_path), "deletedCurrentUser": deleted_current_user})

    def do_PUT(self):
        route = urlparse(self.path).path
        if route == "/api/employees":
            user = self.require_user({"admin", "user"})
            if not user:
                return
            data = self.read_json()
            if data is None:
                return
            try:
                employees = employee_service.replace_all(self.db_path, data.get("employees", []))
            except ValueError as exc:
                return self.send_json({"error": str(exc)}, 400)
            return self.send_json({"ok": True, "employees": employees})
        if route != "/api/data":
            self.send_error(404, "Not found")
            return
        user = self.require_user({"admin", "user"})
        if not user:
            return
        data = self.read_json()
        if data is None:
            return
        data = preserve_restricted_state_fields(self.db_path, data, user)
        write_state(self.db_path, data)
        self.send_json({"ok": True})

    def bearer_token(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return ""
        return auth.removeprefix("Bearer ").strip()

    def require_user(self, roles=None):
        user = auth_service.current_user(self.db_path, self.bearer_token())
        if not user:
            self.send_json({"error": "Chưa đăng nhập"}, 401)
            return None
        if roles:
            allowed = {roles} if isinstance(roles, str) else set(roles)
            if user["role"] not in allowed:
                self.send_json({"error": "Không đủ quyền"}, 403)
                return None
        return user

    def read_json(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(body or "{}")
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"JSON không hợp lệ: {exc}"}, 400)
            return None

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self):
        if not self.static_dir.exists():
            return self.send_json({"error": "Chưa có dist. Chạy npm.cmd run build trước."}, 404)
        request_path = unquote(self.path.split("?", 1)[0]).lstrip("/")
        relative = Path(request_path or "index.html")
        candidate = (self.static_dir / relative).resolve()
        static_root = self.static_dir.resolve()
        if not str(candidate).startswith(str(static_root)):
            return self.send_error(403, "Forbidden")
        if not candidate.exists() or candidate.is_dir():
            candidate = static_root / "index.html"
        content = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        return


def main():
    parser = argparse.ArgumentParser(description="DOMIX SQLite server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH))
    parser.add_argument("--certfile", default="")
    parser.add_argument("--keyfile", default="")
    parser.add_argument("--create-user", nargs=3, metavar=("EMAIL", "PASSWORD", "ROLE"))
    args = parser.parse_args()

    DomixHandler.db_path = Path(args.db)
    init_db(DomixHandler.db_path)

    if args.create_user:
        email, password, role = args.create_user
        user_service.create_or_update_user(DomixHandler.db_path, email, password, role)
        print(f"Saved user {email} with role {role}.")
        return

    user_service.ensure_admin_from_env(DomixHandler.db_path)
    setup_message = user_service.setup_message_if_needed(DomixHandler.db_path)
    if setup_message:
        print(setup_message)

    server = ThreadingHTTPServer((args.host, args.port), DomixHandler)
    protocol = "http"
    if args.certfile and args.keyfile:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.certfile, args.keyfile)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        protocol = "https"
    print(f"DOMIX server running at {protocol}://{args.host}:{args.port}")
    print(f"SQLite database: {DomixHandler.db_path}")
    print("Build frontend with: npm.cmd run build")
    server.serve_forever()


if __name__ == "__main__":
    main()
