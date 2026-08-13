// Danh mục filter + badge màu dùng cho trang báo cáo booking (GET /reports/bookings).

// requestOnly: trạng thái chỉ tồn tại ở dịch vụ Request/Charter (thuê tàu) — chỉ hiện trong
// dropdown filter khi serviceType đang là "Charter" hoặc "All".
export const bookingStatusOptions = [
  { value: "All", labelVn: "Tất cả trạng thái", labelEn: "All Status" },
  { value: "PendingPayment", labelVn: "Chờ thanh toán", labelEn: "Pending Payment" },
  { value: "PendingQuote", labelVn: "Chờ báo giá", labelEn: "Pending Quote", requestOnly: true },
  { value: "Confirmed", labelVn: "Đã xác nhận", labelEn: "Confirmed" },
  { value: "Completed", labelVn: "Hoàn tất", labelEn: "Completed" },
  { value: "Cancelled", labelVn: "Đã hủy", labelEn: "Cancelled", requestOnly: true },
  { value: "Expired", labelVn: "Hết hạn", labelEn: "Expired" },
  { value: "Refunded", labelVn: "Đã hoàn tiền", labelEn: "Refunded", requestOnly: true },
  { value: "PartiallyRefunded", labelVn: "Hoàn tiền một phần", labelEn: "Partially Refunded", requestOnly: true },
];

export const paymentStatusOptions = [
  { value: "All", labelVn: "Tất cả thanh toán", labelEn: "All Payments" },
  { value: "Unpaid", labelVn: "Chưa thanh toán", labelEn: "Unpaid" },
  { value: "DepositPaid", labelVn: "Đã đặt cọc", labelEn: "Deposit Paid", requestOnly: true },
  { value: "Paid", labelVn: "Đã thanh toán", labelEn: "Paid" },
  { value: "Refunded", labelVn: "Đã hoàn tiền", labelEn: "Refunded", requestOnly: true },
  { value: "PartiallyRefunded", labelVn: "Hoàn tiền một phần", labelEn: "Partially Refunded", requestOnly: true },
];

export const serviceTypeOptions = [
  { value: "All", labelVn: "Tất cả dịch vụ", labelEn: "All Services" },
  { value: "Waterbus", labelVn: "Waterbus", labelEn: "Waterbus" },
  { value: "Sightseeing", labelVn: "Water Sightseeing", labelEn: "Sightseeing" },
  { value: "Charter", labelVn: "Request trip", labelEn: "Request trip" },
];

/** Ẩn các option requestOnly khi đang lọc theo 1 dịch vụ cụ thể khác "Charter". */
export const getVisibleStatusOptions = (options, serviceType) => {
  const showRequestOnly = !serviceType || serviceType === "All" || serviceType === "Charter";
  return showRequestOnly ? options : options.filter((o) => !o.requestOnly);
};

export const paymentMethodOptions = [
  { value: "All", labelVn: "Tất cả phương thức", labelEn: "All Methods" },
  { value: "Cash", labelVn: "Tiền mặt", labelEn: "Cash" },
  { value: "PayOS", labelVn: "Chuyển khoản (PayOS)", labelEn: "Bank transfer (PayOS)" },
  { value: "Free", labelVn: "Miễn phí", labelEn: "Free" },
];

const bookingStatusStyles = {
  PendingPayment: "text-amber-600 dark:text-amber-400",
  PendingQuote: "text-amber-600 dark:text-amber-400",
  Confirmed: "text-sky-600 dark:text-sky-400",
  Completed: "text-emerald-600 dark:text-emerald-400",
  Cancelled: "text-slate-500 dark:text-slate-400",
  Expired: "text-rose-500 dark:text-rose-400",
  Refunded: "text-violet-600 dark:text-violet-400",
  PartiallyRefunded: "text-violet-600 dark:text-violet-400",
};

const paymentStatusStyles = {
  Unpaid: "text-rose-500 dark:text-rose-400",
  DepositPaid: "text-amber-600 dark:text-amber-400",
  Paid: "text-emerald-600 dark:text-emerald-400",
  Refunded: "text-violet-600 dark:text-violet-400",
  PartiallyRefunded: "text-violet-600 dark:text-violet-400",
};

const findLabel = (options, value) => options.find((o) => o.value === value);

export const getBookingStatusLabel = (status, lang = "VN") => {
  const opt = findLabel(bookingStatusOptions, status);
  if (opt) return lang === "VN" ? opt.labelVn : opt.labelEn;
  return status || "--";
};

export const getPaymentStatusLabel = (status, lang = "VN") => {
  const opt = findLabel(paymentStatusOptions, status);
  if (opt) return lang === "VN" ? opt.labelVn : opt.labelEn;
  return status || "--";
};

export const getBookingStatusClass = (status) =>
  bookingStatusStyles[status] || "text-slate-500 dark:text-slate-400";

export const getPaymentStatusClass = (status) =>
  paymentStatusStyles[status] || "text-slate-500 dark:text-slate-400";

export const formatCurrency = (value) => `${(Number(value) || 0).toLocaleString("vi-VN")} VND`;

export const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};
