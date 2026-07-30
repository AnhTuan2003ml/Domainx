import { splitVAT } from "../accounting/config.js";

// Hoa hồng đối tác phân phối theo BẬC doanh thu (doanh thu càng cao, % hoa hồng càng thấp —
// khác chiều với hoa hồng Sale). Tìm bậc cao nhất có minRevenue <= doanh thu đơn đó.
export function lookupCommissionTier(revenue, tiers) {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);
  let pct = sorted[0].pct;
  for (const t of sorted) { if (revenue >= t.minRevenue) pct = t.pct; }
  return pct;
}
// Cộng dồn doanh thu CẢ THÁNG với 1 đối tác (không tính đơn nhập hàng) — dùng để tra mốc % áp
// dụng CHUNG cho mọi đơn trong tháng đó, tự động nhảy mốc khi tổng tháng vượt ngưỡng mới, thay vì
// khoá cứng % theo từng đơn lẻ (đơn lẻ nhỏ sẽ không bao giờ tự đạt mốc cao được).
export function getPartnerMonthlyRevenue(partnerId, dateStr, allDistOrders) {
  const ym = (dateStr || "").slice(0, 7);
  return (allDistOrders || [])
    .filter((o) => o.partnerId === partnerId && o.orderKind !== "purchase" && (o.date || "").slice(0, 7) === ym)
    .reduce((a, o) => a + (o.revenue || 0), 0);
}
// Đúng luồng thực tế: đối tác xuất VAT trước trên doanh thu thu được, PHẦN CÒN LẠI SAU THUẾ
// mới đem tính % hoa hồng đối tác được hưởng; phần còn lại sau hoa hồng mới là số đối tác nộp
// (trả) về công ty.
export function computeDistributionSplit(revenue, vatRatePct, commissionPct) {
  const { beforeTax: netOfVat, vatAmount } = splitVAT(revenue, vatRatePct);
  const commissionAmount = netOfVat * (commissionPct / 100);
  const remittedToCompany = netOfVat - commissionAmount;
  return { netOfVat, vatAmount, commissionAmount, remittedToCompany };
}
// Áp dụng ĐỒNG NHẤT cho mọi vai trò đối tác: doanh thu → trừ VAT (đối tác xuất/chịu VAT) trước
// → phần còn lại sau VAT mới tính % hoa hồng/phí theo bậc. Kể cả vai trò "Nhượng quyền" cũng
// trừ VAT trước rồi mới tính % — không còn bỏ qua bước VAT như trước nữa.
export function computePartnerAmount(revenue, vatRatePct, commissionPct, partnerRole) {
  return computeDistributionSplit(revenue, vatRatePct, commissionPct);
}

// Ba mô hình hợp tác phân phối phổ biến — mỗi mô hình khác nhau ở việc AI XUẤT HÓA ĐƠN VAT
// cho khách hàng cuối, vì đây là yếu tố pháp lý/thuế quan trọng nhất, không phải chi tiết phụ.
export const PARTNER_ROLES = {
  dai_ly: {
    label: "Đại lý bán hộ (hoa hồng)",
    desc: "Đối tác trực tiếp bán & xuất hóa đơn VAT cho khách. Đối tác giữ % hoa hồng, nộp lại phần còn lại cho công ty bạn. (Cũng dùng đúng cho trường hợp NGƯỢC LẠI: bạn nhượng quyền/giao sản phẩm cho bên khác bán hộ, họ giữ % hoa hồng, nộp phần còn lại về công ty bạn — chỉ cần tạo đối tác đó với vai trò này.)",
    who_invoices_customer: "Đối tác",
  },
  nha_cung_cap: {
    label: "Nhà cung cấp (mua đứt bán lại)",
    desc: "Công ty bạn MUA sản phẩm từ đối tác (có hóa đơn VAT đầu vào), rồi TỰ BÁN lại cho khách và TỰ xuất hóa đơn VAT. Lợi nhuận = giá bán − giá mua.",
    who_invoices_customer: "Công ty bạn",
  },
  nhuong_quyen: {
    label: "Bên nhượng quyền thương hiệu (bạn trả phí cho họ)",
    desc: "Khách ký hợp đồng với công ty bạn. Công ty bạn bán & xuất hóa đơn VAT cho khách, sau đó trả phí nhượng quyền (%) cho đối tác theo thỏa thuận — dùng khi ĐỐI TÁC là bên cấp quyền/sản phẩm cho bạn.",
    who_invoices_customer: "Công ty bạn",
  },
};
