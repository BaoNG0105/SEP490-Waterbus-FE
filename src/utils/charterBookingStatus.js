const baseClasses = {
  pendingQuote: {
    classes: "bg-amber-50/70 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  quoted: {
    classes: "bg-indigo-50/70 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  pendingPayment: {
    classes: "bg-orange-50/70 text-orange-700 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/15",
    text: "text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  confirmed: {
    classes: "bg-sky-50/70 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/15",
    text: "text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
  completed: {
    classes: "bg-emerald-50/70 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  cancelled: {
    classes: "bg-rose-50/70 text-rose-700 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  expired: {
    classes: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    text: "text-slate-600 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  refunded: {
    classes: "bg-teal-50/70 text-teal-700 border-teal-100 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/15",
    text: "text-teal-700 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  default: {
    classes: "bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    text: "text-slate-500 dark:text-slate-400",
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
    return { label: isVn ? "Hoàn tất" : "Completed", ...baseClasses.completed };
  }
  if (status === "pendingquote") {
    return { label: isVn ? "Chờ báo giá" : "Pending quote", ...baseClasses.pendingQuote };
  }
  // Payment detail stays on the secondary line in list views — keep booking label short.
  if (status === "quoted" && (!payment || payment === "unpaid")) {
    return { label: isVn ? "Đã báo giá" : "Quoted", ...baseClasses.quoted };
  }
  if (status === "confirmed" && payment === "depositpaid") {
    return { label: isVn ? "Đã xác nhận" : "Confirmed", ...baseClasses.pendingPayment };
  }
  if (status === "confirmed" && payment === "paid") {
    return { label: isVn ? "Đã thanh toán" : "Paid", ...baseClasses.completed };
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
