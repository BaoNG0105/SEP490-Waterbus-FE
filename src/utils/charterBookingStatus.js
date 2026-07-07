const baseClasses = {
  pendingQuote: {
    classes: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    dot: "bg-amber-500",
  },
  quoted: {
    classes: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
    dot: "bg-indigo-500",
  },
  pendingPayment: {
    classes: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
    dot: "bg-orange-500",
  },
  confirmed: {
    classes: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
    dot: "bg-sky-500",
  },
  completed: {
    classes: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  cancelled: {
    classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
    dot: "bg-rose-500",
  },
  expired: {
    classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
  },
  refunded: {
    classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20",
    dot: "bg-teal-500",
  },
  default: {
    classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export const getCharterBookingStatusInfo = (bookingStatus, paymentStatus, lang) => {
  const status = String(bookingStatus || "").toLowerCase();
  const payment = String(paymentStatus || "").toLowerCase();
  const isVn = lang === "VN";

  if (status === "cancelled") {
    return { label: isVn ? "Đã hủy" : "Cancelled", ...baseClasses.cancelled };
  }
  if (status === "expired") {
    return { label: isVn ? "Hết hạn" : "Expired", ...baseClasses.expired };
  }
  if (status === "refunded") {
    return { label: isVn ? "Đã hoàn tiền" : "Refunded", ...baseClasses.refunded };
  }
  if (status === "completed") {
    return { label: isVn ? "Hoàn tất chuyến" : "Trip completed", ...baseClasses.completed };
  }
  if (status === "pendingquote") {
    return { label: isVn ? "Chờ báo giá" : "Pending quote", ...baseClasses.pendingQuote };
  }
  if (status === "quoted" && (!payment || payment === "unpaid")) {
    return { label: isVn ? "Đã báo giá - chờ thanh toán" : "Quoted - waiting for payment", ...baseClasses.quoted };
  }
  if (status === "confirmed" && payment === "depositpaid") {
    return { label: isVn ? "Đã đặt cọc - chờ thanh toán phần còn lại" : "Deposit paid - waiting for remaining payment", ...baseClasses.pendingPayment };
  }
  if (status === "confirmed" && payment === "paid") {
    return { label: isVn ? "Đã thanh toán đủ" : "Fully paid", ...baseClasses.completed };
  }
  if (status === "pendingpayment") {
    return { label: isVn ? "Chờ thanh toán" : "Pending payment", ...baseClasses.pendingPayment };
  }
  if (status === "quoted") {
    return { label: isVn ? "Đã báo giá" : "Quoted", ...baseClasses.quoted };
  }
  if (status === "confirmed") {
    return { label: isVn ? "Đã xác nhận" : "Confirmed", ...baseClasses.confirmed };
  }

  return { label: bookingStatus || "--", ...baseClasses.default };
};
