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

/**
 * Dòng phụ khi booking đã hủy:
 * - đã hoàn → "Đã hoàn tiền"
 * - hủy trước khi thanh toán → "Chưa thanh toán"
 * - đã thu tiền nhưng chưa hoàn xong → "Chưa hoàn tiền"
 */
export const getCharterCancelledPaymentSubLabel = (paymentStatus, lang) => {
  const payment = String(paymentStatus || "").toLowerCase().replace(/[_-\s]/g, "");
  const isVn = lang === "VN";

  if (["refunded", "partiallyrefunded"].includes(payment)) {
    return isVn ? "Đã hoàn tiền" : "Refunded";
  }
  if (["paid", "depositpaid"].includes(payment)) {
    return isVn ? "Chưa hoàn tiền" : "Not refunded";
  }
  return isVn ? "Chưa thanh toán" : "Unpaid";
};

export const getCharterBookingStatusInfo = (bookingStatus, paymentStatus, lang, booking) => {
  const status = String(bookingStatus || "").toLowerCase().replace(/[_-\s]/g, "");
  const payment = String(paymentStatus || "").toLowerCase().replace(/[_-\s]/g, "");
  const isVn = lang === "VN";
  const isCancelled = ["cancelled", "canceled", "cancel"].includes(status);
  const isRefundedPayment = ["refunded", "partiallyrefunded"].includes(payment);
  const cancelledLabel = isVn ? "Đã hủy" : "Cancelled";

  // BE đôi khi trả paymentStatus="Paid" cho cả booking mới đặt cọc (còn dư nợ).
  // Tránh hiển thị "Đã thanh toán" khi còn balance dương — hiện "Đã đặt cọc" thay thế.
  const hasRemainingBalance = Boolean(
    booking
    && (
      booking.hasDepositPaid === true
      || Number(booking.charterBalanceDue ?? booking.balanceDue ?? 0) > 0
    ),
  );

  // Trạng thái chính luôn "Đã hủy"; chi tiết thanh toán/hoàn tiền ở dòng phụ.
  if (isCancelled || status === "refunded" || isRefundedPayment) {
    return {
      label: cancelledLabel,
      subLabel: getCharterCancelledPaymentSubLabel(isRefundedPayment ? "refunded" : paymentStatus, lang),
      ...baseClasses.cancelled,
    };
  }
  if (status === "expired") {
    return { label: isVn ? "Hết hạn" : "Expired", ...baseClasses.expired };
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
    return { label: isVn ? "Đã đặt cọc" : "Deposit paid", ...baseClasses.pendingPayment };
  }
  // Chỉ hiện "Đã xác nhận" khi còn Confirmed và payment vẫn Paid (chưa hủy/hoàn).
  // Nếu còn dư nợ (đã đặt cọc nhưng chưa thanh toán hết), hiển thị "Đã đặt cọc".
  if (status === "confirmed" && payment === "paid") {
    if (hasRemainingBalance) {
      return { label: isVn ? "Đã đặt cọc" : "Deposit paid", ...baseClasses.pendingPayment };
    }
    return { label: isVn ? "Đã xác nhận" : "Confirmed", ...baseClasses.confirmed };
  }
  if (status === "pendingpayment") {
    return { label: isVn ? "Chờ thanh toán" : "Pending payment", ...baseClasses.pendingPayment };
  }
  if (status === "approved") {
    return { label: isVn ? "Đã duyệt" : "Approved", ...baseClasses.quoted };
  }
  if (status === "pendingapproval") {
    return { label: isVn ? "Chờ duyệt" : "Pending approval", ...baseClasses.pendingQuote };
  }
  if (status === "quoted") {
    return { label: isVn ? "Đã báo giá" : "Quoted", ...baseClasses.quoted };
  }
  if (status === "confirmed") {
    return { label: isVn ? "Đã xác nhận" : "Confirmed", ...baseClasses.confirmed };
  }

  return { label: bookingStatus || "--", ...baseClasses.default };
};
