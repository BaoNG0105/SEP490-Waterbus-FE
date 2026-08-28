// Helpers riêng cho báo cáo doanh thu (GET /reports/revenue) — số liệu theo Payments đã Paid.
import { categorical, pickColor } from "./chartPalette";

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

// Trả thẳng chuỗi màu theo theme (SVG fill/stroke cần string, không phải object).
export const getServiceTypeColor = (key, isDarkMode = false) =>
  pickColor(serviceTypeColorByKey[key] || categorical[4], isDarkMode);
export const getPaymentMethodColor = (key, isDarkMode = false) =>
  pickColor(paymentMethodColorByKey[key] || categorical[4], isDarkMode);

export const getPaymentMethodLabel = (key, lang = "VN") => {
  const labels = {
    Cash: { VN: "Tiền mặt", EN: "Cash" },
    PayOS: { VN: "PayOS", EN: "PayOS" },
    Free: { VN: "Miễn phí", EN: "Free" },
  };
  return labels[key]?.[lang] || key || "";
};

// Đảm bảo donut luôn render đủ các category (kể cả khi API trả về thiếu hoặc value = 0).
// - masterKeys: danh sách key đầy đủ cần hiển thị.
// - getLabel / getColor: map key -> label/color.
// - items: mảng segment từ API (mỗi item có key + value).
// Kết quả: mảng segments đủ slot, segment nào API không trả về sẽ value = 0.
export const normalizeSegments = ({ items, masterKeys, getLabel, getColor, lang, isDarkMode }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const present = new Map(safeItems.map((it) => [it.key, it]));
  return masterKeys.map((key) => {
    const it = present.get(key);
    return {
      key,
      label: getLabel(key, lang),
      value: Number(it?.netRevenue ?? it?.value ?? 0) || 0,
      color: getColor(key, isDarkMode),
    };
  });
};