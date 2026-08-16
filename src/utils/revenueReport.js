// Helpers riêng cho báo cáo doanh thu (GET /reports/revenue) — số liệu theo Payments đã Paid.
import { categorical } from "./chartPalette";

// Rút gọn số tiền lớn để hiện trên trục/nhãn biểu đồ (1.535.000 -> "1,5tr"); giá trị đầy đủ
// vẫn dùng formatCurrency (bookingReport.js) ở tooltip/thẻ số liệu.
export const formatCompactCurrency = (value, lang = "VN") => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const trim = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, ""));
  if (abs >= 1e9) return `${trim(n / 1e9)}${lang === "VN" ? " tỷ" : "B"}`;
  if (abs >= 1e6) return `${trim(n / 1e6)}${lang === "VN" ? "tr" : "M"}`;
  if (abs >= 1e3) return `${trim(n / 1e3)}${lang === "VN" ? "k" : "K"}`;
  return String(n);
};

// API trả `date` dạng "dd/MM/yyyy" đã sắp theo thứ tự tăng dần — chỉ cần rút gọn hiển thị.
export const shortenDayLabel = (ddMmYyyy) => String(ddMmYyyy || "").slice(0, 5);

// Màu cố định theo "key" của byServiceType/byPaymentMethod — cùng thứ tự categorical với
// các biểu đồ khác trong trang (không đảo slot để giữ nhất quán nhận diện màu toàn app).
const serviceTypeColorByKey = {
  Waterbus: categorical[0],
  Charter: categorical[1],
  Sightseeing: categorical[2],
};

const paymentMethodColorByKey = {
  Cash: categorical[0],
  PayOS: categorical[1],
  Free: categorical[3],
};

export const getServiceTypeColor = (key) => serviceTypeColorByKey[key] || categorical[4];
export const getPaymentMethodColor = (key) => paymentMethodColorByKey[key] || categorical[4];