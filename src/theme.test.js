import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";


function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => {
    const channel = Number.parseInt(value, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(background, foreground) {
  const values = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("thanh thông báo đạt tương phản WCAG ở cả sáng và tối", () => {
  assert.ok(contrast("#FFF9E8", "#1B2A4A") >= 4.5);
  assert.ok(contrast("#211D13", "#F8E8B0") >= 4.5);
});

test("surface và chữ chính đạt tương phản ở cả hai theme", () => {
  assert.ok(contrast("#FFFFFF", "#201F1C") >= 4.5);
  assert.ok(contrast("#F7F5F0", "#55503F") >= 4.5);
  assert.ok(contrast("#171A22", "#F2F1ED") >= 4.5);
  assert.ok(contrast("#1E222C", "#AEB6C5") >= 4.5);
});

test("thanh thông báo dùng token theme, không còn nền sáng cố định", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /domix-company-notice/);
  assert.match(source, /--notice-surface: #211D13/);
  assert.doesNotMatch(source, /domix-company-notice[^\n]*bg-\[#fff9e8\]/);
});

test("dark mode phủ form, bảng và các nền sáng cố định", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /color-scheme: dark/);
  assert.match(source, /\.ktns-app\.dark input, \.ktns-app\.dark select, \.ktns-app\.dark textarea/);
  assert.match(source, /--domix-table-sticky-bg: #171A22/);
  assert.match(source, /hover:bg-white\/60/);
  for (const lightBackground of ["edf3ff", "eef4ff", "f3eee7", "f3f6fb", "f5f8ff", "faf8f4", "fbfaf7", "fff5f4", "fff7f6"]) {
    assert.match(source, new RegExp(`bg-\\\\?\\[#${lightBackground}\\\\?\\]`));
  }
});

test("ticker thông báo chạy liên tục từ phải sang trái", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /@keyframes domixCompanyNoticeMarquee/);
  assert.match(source, /animation: domixCompanyNoticeMarquee/);
  assert.match(source, /padding-left: 100%/);
  assert.match(source, /to \{ transform: translateX\(-100%\); \}/);
  assert.match(source, /className="domix-company-notice-track/);
  assert.match(source, /const tickerText = parts\.join/);
});

test("tổng bảng không suy đoán cột tiền từ nội dung ô", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /const containsCurrency/);
  assert.match(source, /data-disable-generated-total="true" className="domix-db-table/);
  assert.match(source, /<strong>\{ui\("TỔNG NHÂN SỰ", "TOTAL EMPLOYEES"\)\}<\/strong>/);
});

test("báo cáo quý tự quản lý tổng tiền và số giao dịch riêng", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /summarizeQuarterSnapshots\(snapshots, TODAY\)/);
  assert.match(source, /data-disable-generated-total="true" className="w-full text-sm"/);
  assert.match(source, /quarterTotal\.missingInvoices/);
  assert.match(source, /\(chưa đến kỳ\)/);
});

test("hộp thoại công nợ và vốn góp có tên nút đóng hỗ trợ truy cập", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="Đóng biểu mẫu vốn góp" title="Đóng"/);
  assert.match(source, /aria-label="Đóng biểu mẫu công nợ" title="Đóng"/);
});

test("English dùng ngày và điều hướng không mơ hồ", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("./components/layout/CompanySidebar.jsx", import.meta.url), "utf8");
  assert.match(source, /return `\$\{weekdays\.en\[TODAY\.getDay\(\)\]\}, \$\{dd\} \$\{monthNames\[TODAY\.getMonth\(\)\]\} \$\{yyyy\}`/);
  assert.match(source, /sidebar_light_mode: "Light mode"/);
  assert.match(source, /sidebar_search: "Quick search\.\.\."/);
  // Bộ chọn ngôn ngữ đã chuyển từ sidebar lên header khi tái cấu trúc menu 3 nhóm —
  // sidebar chỉ còn điều hướng; header giữ ngôn ngữ/sáng-tối/tìm kiếm.
  assert.match(source, /aria-label="Ngôn ngữ"/);
  assert.doesNotMatch(sidebar, /sidebar_language/);
});

test("Dashboard, Hiệu suất và AI cùng dùng trạng thái FinancialSummary", () => {
  const source = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(source, /function performanceOf\(employee, financialSummary\)/);
  assert.match(source, /const warnCount = warnedEmployees\.length/);
  assert.match(source, /performanceStatus: resolvedPerformance\.status/);
  assert.match(source, /performanceOf\(e, financialSummary\)\.status === "canh_bao"/);
  assert.doesNotMatch(source, /const sharedPerformanceStatus = \(employee\)/);
});
