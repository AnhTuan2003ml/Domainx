# DOMIX

DOMIX gồm frontend React/Vite, backend Python và **một nguồn dữ liệu PostgreSQL duy nhất**. Hệ thống không đọc hoặc ghi SQLite trong bất kỳ chế độ chạy nào.

## Khởi động chuẩn bằng Docker

Yêu cầu: Docker Desktop có Docker Compose v2.

1. Sao chép `.env.example` thành `.env` và thay toàn bộ giá trị mẫu bằng bí mật mạnh.
2. Trên Windows, chạy `run.bat`; hoặc chạy lệnh tương đương:

```bash
docker compose up -d --build
```

3. Mở `http://127.0.0.1:8848`.

Dữ liệu được lưu trong volume Docker `domix_postgres_data`. Dừng dịch vụ bằng `docker compose down`; lệnh này không xóa volume. Chỉ người vận hành có chủ đích mới được dùng tùy chọn `--volumes`.

Các lệnh vận hành:

```bash
docker compose ps
docker compose logs -f --tail=200 backend
docker compose down
```

Tài khoản quản trị đầu tiên lấy từ `DOMIX_ADMIN_EMAIL` và `DOMIX_ADMIN_PASSWORD` trong `.env`; không dùng tài khoản/mật khẩu mặc định trong bản phát hành.

## Kiểm thử

Toàn bộ test backend, kể cả test nghiệp vụ và sổ tài chính, chạy trên PostgreSQL tạm thời:

```bash
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from backend-tests
docker compose -f docker-compose.test.yml down --volumes --remove-orphans
```

Frontend:

```bash
npm ci
npm test
npm run lint
npm run build
```

Không dùng `node_modules` được sao chép từ máy hoặc hệ điều hành khác. `npm ci` phải cài đúng dependency từ `package-lock.json` trước khi đánh giá build.

## Chạy phát triển không qua Docker

Chỉ dùng khi đã có PostgreSQL đang chạy. Khai báo `DOMIX_DATABASE_URL=postgresql://...` hoặc đầy đủ các biến `DOMIX_DB_HOST`, `DOMIX_DB_PORT`, `DOMIX_DB_NAME`, `DOMIX_DB_USER`, `DOMIX_DB_PASSWORD`, sau đó:

```bash
npm ci
npm run dev
python backend/server.py --host 0.0.0.0 --port 8000
```

Backend sẽ dừng ngay nếu thiếu cấu hình PostgreSQL; không có fallback sang database file.

## Quyền truy cập

Quyền tài khoản gồm `admin`, `accountant`, `user`. Vị trí nghiệp vụ như Sale, Ads, Kỹ thuật, HR và CSKH là lớp quyền thứ hai. Backend kiểm tra cả hai lớp tại API; việc ẩn nút trên frontend không được xem là biện pháp phân quyền.

## Đóng gói phát hành

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\build-release.ps1
```

Script tạo `Domix.zip` và tự kiểm tra để loại `data/`, database file, `node_modules/`, `dist/`, `__pycache__/`, `.env`, log, backup và công cụ nội bộ. Có thể kiểm tra độc lập bằng `scripts\verify-release.ps1 -ArchivePath Domix.zip`.

## Cấu trúc chính

- `backend/routes/`: API và kiểm tra quyền.
- `backend/services/`: nghiệp vụ và đối soát.
- `backend/db/`: kết nối, schema và kho dữ liệu PostgreSQL.
- `backend/tests/`: test nghiệp vụ/API trên PostgreSQL.
- `src/`: frontend React.
- `docker/`: image backend, frontend và Nginx.
