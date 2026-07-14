# DOMIX — Kế toán · Nhân sự · CRM · Bán hàng (bản demo prototype)

Đây là bản đóng gói đầy đủ source code của app DOMIX thành 1 dự án React (Vite) chạy độc lập được trên máy bạn, ngoài môi trường Claude.

## ⚠️ Lưu ý quan trọng trước khi chạy

Đây vẫn là **bản demo prototype**, không phải hệ thống production hoàn chỉnh:
- **Chưa có backend/server thật** — toàn bộ dữ liệu chỉ sống trong bộ nhớ trình duyệt (state của React), **mất hết khi tải lại trang F5**. Dùng chức năng "Sao lưu & Phục hồi dữ liệu" trong Cài đặt công ty để xuất/nhập file JSON, tránh mất dữ liệu.
- **Chưa có đăng nhập/phân quyền thật** — ai mở link cũng vào được, không phân biệt tài khoản.
- **Chat công ty** chỉ hoạt động trong đúng 1 phiên trình duyệt hiện tại, chưa đồng bộ giữa các máy khác nhau.
- Không phải hệ thống kế toán kép (double-entry) đầy đủ theo Thông tư 133/99 — chỉ hỗ trợ một phần (mã tài khoản, mẫu Phiếu Thu/Chi).

Phù hợp để: xem trước giao diện, demo cho nội bộ, làm nền tảng phát triển tiếp lên hệ thống thật (thêm backend, database, xác thực).

## Cài đặt & chạy thử

Yêu cầu: đã cài [Node.js](https://nodejs.org) bản 18 trở lên.

```bash
# 1. Giải nén file zip, mở terminal tại đúng thư mục dự án
cd domix-project

# 2. Cài đặt các thư viện cần thiết
npm install

# 3. Chạy thử ở máy local
npm run dev
```

Sau khi chạy `npm run dev`, mở trình duyệt vào địa chỉ hiện ra (thường là `http://localhost:5173`).

## Build bản chạy thật (deploy lên hosting)

```bash
npm run build
```

Lệnh này tạo ra thư mục `dist/` chứa các file tĩnh (HTML/CSS/JS) — có thể tải lên bất kỳ dịch vụ hosting tĩnh nào (Vercel, Netlify, Cloudflare Pages, hoặc server riêng của công ty).

## Cấu trúc thư mục

```
domix-project/
├── index.html          ← Trang HTML gốc
├── package.json        ← Danh sách thư viện cần cài
├── vite.config.js       ← Cấu hình công cụ build (Vite)
├── tailwind.config.js   ← Cấu hình Tailwind CSS
├── postcss.config.js
└── src/
    ├── main.jsx         ← Điểm khởi động, gắn App vào trang HTML
    ├── index.css        ← CSS gốc (nạp Tailwind)
    └── App.jsx          ← TOÀN BỘ logic + giao diện app (1 file duy nhất, ~9300 dòng)
```

## Thư viện đang dùng
- **React 18** — nền tảng giao diện
- **lucide-react** — bộ icon
- **recharts** — biểu đồ (Dashboard)
- **xlsx** (SheetJS) — xuất file Excel

## Các bước tiếp theo nếu muốn đưa vào dùng thật
1. Xây dựng backend (Node.js/Python/...) + database thật (Postgres/MySQL...) để lưu dữ liệu vĩnh viễn
2. Thêm hệ thống đăng nhập/phân quyền theo đúng vai trò (Sếp/Kế toán/Sale/Kỹ thuật...)
3. Nối API thật cho Chat công ty để đồng bộ nhiều người dùng cùng lúc
4. Rà soát lại với kế toán/luật sư thật về các phần thuế, hợp đồng trước khi vận hành chính thức
