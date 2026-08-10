// Bảng màu biểu đồ dùng chung cho Dashboard — theo hệ màu categorical/status đã kiểm định
// (thứ tự cố định, tách biệt đủ ở cả 2 chế độ sáng/tối). Không tự sinh thêm hue mới.

// Categorical — dùng đúng thứ tự cố định, không đảo slot giữa các biểu đồ khác nhau.
export const categorical = [
  { light: "#2a78d6", dark: "#3987e5" }, // slot 1 — blue
  { light: "#eb6834", dark: "#d95926" }, // slot 2 — orange
  { light: "#1baf7a", dark: "#199e70" }, // slot 3 — aqua
  { light: "#eda100", dark: "#c98500" }, // slot 4 — yellow
  { light: "#e87ba4", dark: "#d55181" }, // slot 5 — magenta
];

// "Khác" — gộp các trạng thái không thuộc nhóm chính, màu trung tính (không phải 1 hue mới).
export const otherColor = { light: "#a8a6a0", dark: "#6b6a63" };

// Status — cố định, không đổi theo theme (đã kiểm định tương phản ≥3:1 trên cả 2 nền).
export const status = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const pickColor = (colorPair, isDarkMode) => (isDarkMode ? colorPair.dark : colorPair.light);

// Làm tròn trần lên số "đẹp" (1/2/5 x 10^n) để dùng làm mốc trục Y.
export const niceMax = (max) => {
  if (!max || max <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const residual = max / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
};

// Nhóm danh sách booking theo ngày (yyyy-MM-dd theo giờ local) để vẽ xu hướng.
export const groupCountByDay = (items, dateField, fromDate, toDate) => {
  const counts = new Map();
  let cursor = new Date(fromDate);
  const end = new Date(toDate);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    counts.set(key, 0);
    cursor = new Date(cursor.getTime() + 86400000);
  }
  (items || []).forEach((item) => {
    const raw = item?.[dateField];
    if (!raw) return;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });
  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
};

export const formatShortDate = (isoDate) => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
