const formatVND = (value) => `${Math.round(Number(value) || 0).toLocaleString("vi-VN")}đ`;

export const TT133_ACCOUNTS = {
  "111": "Tiền mặt", "112": "Tiền gửi ngân hàng", "131": "Phải thu của khách hàng",
  "133": "Thuế GTGT được khấu trừ", "138": "Phải thu khác", "156": "Hàng hóa",
  "211": "Tài sản cố định hữu hình", "214": "Hao mòn tài sản cố định", "242": "Chi phí trả trước (CCDC phân bổ)",
  "331": "Phải trả cho người bán",
  "3331": "Thuế GTGT phải nộp (đầu ra)", "3335": "Thuế TNCN phải nộp",
  "3383": "Bảo hiểm xã hội", "3384": "Bảo hiểm y tế", "3385": "Bảo hiểm thất nghiệp",
  "334": "Phải trả người lao động", "338": "Phải trả, phải nộp khác",
  "411": "Vốn đầu tư của chủ sở hữu", "421": "Lợi nhuận sau thuế chưa phân phối",
  "511": "Doanh thu bán hàng và cung cấp dịch vụ", "515": "Doanh thu hoạt động tài chính",
  "632": "Giá vốn hàng bán", "641": "Chi phí bán hàng (marketing, quảng cáo)",
  "642": "Chi phí quản lý kinh doanh", "811": "Chi phí khác",
};
// MỘT mapping danh mục → TK duy nhất, ĐỒNG BỘ với backend ledger_sync_service
// (_EXPENSE_ACCOUNT_BY_CATEGORY / _INCOME_ACCOUNT_BY_CATEGORY) — nhãn TK hiển thị ở
// giao diện phải trùng đúng tài khoản sổ cái hạch toán, không được mỗi nơi một số.
const EXPENSE_ACCOUNT_BY_CATEGORY = {
  marketing_ads: "641",
  an_uong_tiep_khach: "642",
};
// Gợi ý TK dựa trên loại giao dịch (Thu/Chi) và nguồn gốc — kế toán vẫn có thể sửa tay nếu cần
// hạch toán khác đi, đây chỉ là gợi ý mặc định để đỡ phải tra cứu từ đầu.
export function suggestAccountCode(t) {
  if (t.source === "bangluong") return "334";
  // Thu/chi CÔNG NỢ (mọi biến thể nguồn: congno, congno_payment...) là nghiệp vụ 131/331 —
  // tuyệt đối KHÔNG phải doanh thu: thu nợ chỉ giảm phải thu, không phát sinh 511/515.
  const source = String(t.source || t.sourceModule || "");
  if (source.startsWith("congno")) return t.kind === "thu" ? "131" : "331";
  if (t.kind === "thu") {
    if (source === "crm" || source === "hoptac") return "511";
    const cat = String(t.category || "").toLowerCase();
    if (cat.includes("công nợ") || cat === "thu_cong_no") return "131";
    // 515 CHỈ dành cho doanh thu tài chính đúng bản chất (lãi tiền gửi, chênh lệch tài chính).
    if (cat.includes("lãi") || cat.includes("tài chính") || cat === "tai_chinh") return "515";
    return "511";
  }
  const cat = (t.category || "").toLowerCase();
  if (EXPENSE_ACCOUNT_BY_CATEGORY[cat]) return EXPENSE_ACCOUNT_BY_CATEGORY[cat];
  if (source === "marketing_daily" || cat.includes("marketing") || cat.includes("quảng cáo")) return "641";
  if (cat.includes("lương")) return "334";
  if (cat.includes("thuê") || cat.includes("mặt bằng")) return "642";
  if (cat.includes("hàng") || t.source === "hoptac_muahang") return "156";
  if (cat.includes("hoa hồng") || cat.includes("phí")) return "642";
  return "642";
}

// Đọc số tiền bằng chữ — bắt buộc phải có trên Phiếu Thu/Phiếu Chi theo đúng mẫu TT133.
export function soTienBangChu(num) {
  if (!num || num <= 0) return "Không đồng";
  const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const docBaSo = (n, hasHundredsBefore) => {
    const tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), donvi = n % 10;
    let s = "";
    if (tram > 0 || hasHundredsBefore) s += chuSo[tram] + " trăm ";
    if (chuc === 0 && donvi > 0 && (tram > 0 || hasHundredsBefore)) s += "lẻ ";
    if (chuc >= 2) { s += chuSo[chuc] + " mươi "; if (donvi === 1) s += "mốt "; else if (donvi === 5) s += "lăm "; else if (donvi > 0) s += chuSo[donvi] + " "; }
    else if (chuc === 1) { s += "mười "; if (donvi === 5) s += "lăm "; else if (donvi > 0) s += chuSo[donvi] + " "; }
    else if (donvi > 0) s += chuSo[donvi] + " ";
    return s.trim();
  };
  const units = ["", " nghìn", " triệu", " tỷ"];
  let n = Math.floor(num);
  const groups = [];
  while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
  let result = "";
  groups.forEach((g, i) => {
    if (g === 0) return;
    const hasHundredsBefore = i > 0 && g < 100;
    result += docBaSo(g, hasHundredsBefore) + units[groups.length - 1 - i] + " ";
  });
  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
}
// Phiếu Thu (Mẫu 01-TT) / Phiếu Chi (Mẫu 02-TT) theo đúng mẫu Thông tư 133/2016/TT-BTC — in ra
// dùng thật được, kế toán ký tay trực tiếp lên bản in.
export function buildPhieuThuChiHtml(t, company, accountCode) {
  const isThu = t.kind === "thu";
  const mauSo = isThu ? "01-TT" : "02-TT";
  const tenPhieu = isThu ? "PHIẾU THU" : "PHIẾU CHI";
  return `
    <div style="font-family: 'Times New Roman', serif; max-width: 760px; margin: 0 auto; padding: 24px; color: #111;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div style="font-size:13px; line-height:1.5;">
          <div><strong>${company?.name || "CÔNG TY"}</strong></div>
          <div>Địa chỉ: ${company?.address || "—"}</div>
          <div>Mã số thuế: ${company?.taxCode || "—"}</div>
        </div>
        <div style="text-align:right; font-size:12px;">
          <div>Mẫu số ${mauSo}</div>
          <div>(Ban hành theo Thông tư số 133/2016/TT-BTC</div>
          <div>ngày 26/8/2016 của Bộ Tài chính)</div>
        </div>
      </div>
      <h2 style="text-align:center; margin:18px 0 4px; letter-spacing:2px;">${tenPhieu}</h2>
      <div style="text-align:center; font-size:13px; margin-bottom:4px;">Ngày ${(t.date || "").split("-")[2]} tháng ${(t.date || "").split("-")[1]} năm ${(t.date || "").split("-")[0]}</div>
      <div style="text-align:center; font-size:13px; margin-bottom:16px;">Số: ......................</div>
      <table style="width:100%; font-size:14px; line-height:1.9; border-collapse:collapse;">
        <tr><td style="width:220px;">Nợ TK ......................</td><td>${accountCode || "—"}</td></tr>
        <tr><td>Có TK ......................</td><td>${isThu ? "111 / 112" : "111 / 112"}</td></tr>
      </table>
      <div style="font-size:14px; line-height:2; margin-top:8px;">
        <div>Họ tên người ${isThu ? "nộp" : "nhận"} tiền: <strong>${t.partnerName || "......................"}</strong></div>
        <div>Địa chỉ: ......................................................................................</div>
        <div>Lý do ${isThu ? "nộp" : "chi"}: <strong>${t.desc || t.category || "......................"}</strong></div>
        <div>Số tiền: <strong>${formatVND(t.amount)}</strong> (Viết bằng chữ): <em>${soTienBangChu(t.amount)}</em></div>
        <div>Kèm theo: ...................... chứng từ gốc.</div>
      </div>
      <table style="width:100%; text-align:center; font-size:13px; margin-top:36px;">
        <tr>
          <td style="width:20%;"><strong>Giám đốc</strong><br/>(Ký, họ tên, đóng dấu)</td>
          <td style="width:20%;"><strong>Kế toán trưởng</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Người lập phiếu</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Thủ quỹ</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Người ${isThu ? "nộp" : "nhận"} tiền</strong><br/>(Ký, họ tên)</td>
        </tr>
        <tr><td style="height:70px;"></td><td></td><td></td><td></td><td></td></tr>
      </table>
    </div>
  `;
}
export function downloadPhieuThuChi(t, company, accountCode) {
  const html = buildPhieuThuChiHtml(t, company, accountCode);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t.kind === "thu" ? "Phieu Thu" : "Phieu Chi"} ${t.date}</title></head><body>${html}</body></html>`;
  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${t.kind === "thu" ? "PhieuThu" : "PhieuChi"}_${t.date}_${t.id}.html`; a.click();
  URL.revokeObjectURL(url);
}

export const INVOICE_TYPES = [
  "Hóa đơn GTGT (VAT)",
  "Hóa đơn bán hàng",
  "Hóa đơn điện tử",
  "Biên lai / Phiếu thu nội bộ",
  "Thu hộ đối tác (VAT do đối tác chịu)",
  // "Không cần hóa đơn (dưới 200.000đ)" đã bị LOẠI BỎ: theo NĐ 123/2020/NĐ-CP (sửa đổi bởi
  // NĐ 70/2025/NĐ-CP, hiệu lực 01/6/2025), bán hàng hóa/dịch vụ phải lập hóa đơn không phân
  // biệt giá trị từng lần bán. Bản ghi cũ mang giá trị này vẫn hiển thị kèm cảnh báo hết hiệu lực.
  "Chưa xác định",
];
export const DEPRECATED_INVOICE_TYPE_NO_INVOICE = "Không cần hóa đơn (dưới 200.000đ)";
// Chỉ hóa đơn GTGT mới cần khai thuế VAT tách riêng.
export const VAT_INVOICE_TYPES = ["Hóa đơn GTGT (VAT)"];
export const VAT_RATE_OPTIONS = [0, 5, 8, 10]; // % — mức 8%/10% thay đổi theo chính sách từng giai đoạn, kiểm tra lại quy định hiện hành
// Giả định "Số tiền" nhập vào đã là tổng thanh toán (đã gồm VAT) — tách ngược ra tiền hàng + thuế.
export function splitVAT(amount, vatRatePct) {
  if (!vatRatePct) return { beforeTax: amount, vatAmount: 0 };
  const beforeTax = amount / (1 + vatRatePct / 100);
  return { beforeTax, vatAmount: amount - beforeTax };
}
