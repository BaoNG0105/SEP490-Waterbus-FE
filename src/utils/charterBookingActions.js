export const WORKFLOW_STEPS = [
  { id: "PendingQuote", icon: "edit_note", labelVn: "Yêu cầu", labelEn: "Request" },
  { id: "Quoted", icon: "request_quote", labelVn: "Báo giá", labelEn: "Quote" },
  { id: "PendingPayment", icon: "account_balance_wallet", labelVn: "Thanh toán", labelEn: "Payment" },
  { id: "Confirmed", icon: "verified", labelVn: "Đã xác nhận", labelEn: "Confirmed" },
  { id: "Completed", icon: "task_alt", labelVn: "Hoàn tất", labelEn: "Done" },
];

const TERMINAL_STATUSES = ["Cancelled", "Expired", "Refunded"];

export const isTerminalBookingStatus = (status) =>
  TERMINAL_STATUSES.includes(String(status || ""));

export const getWorkflowStepIndex = (status) => {
  const normalized = String(status || "");
  if (isTerminalBookingStatus(normalized)) return -1;
  const index = WORKFLOW_STEPS.findIndex((step) => step.id === normalized);
  return index >= 0 ? index : 0;
};

/** Đánh dấu tab đã xem trên trang chi tiết booking của khách — riêng biệt với bên admin. */
const CUSTOMER_CHARTER_TAB_BADGES_KEY = "customerCharterAcknowledgedTabBadges";

export const readAcknowledgedCustomerTabBadges = (bookingId) => {
  if (!bookingId) return {};
  try {
    const stored = localStorage.getItem(CUSTOMER_CHARTER_TAB_BADGES_KEY);
    if (!stored) return {};
    const map = JSON.parse(stored);
    const bookingState = map[bookingId];
    return bookingState && typeof bookingState === "object" ? bookingState : {};
  } catch {
    return {};
  }
};

export const acknowledgeCustomerTabBadge = (bookingId, tabId, badgeValue) => {
  if (!bookingId || !tabId || !badgeValue) return;
  try {
    const stored = localStorage.getItem(CUSTOMER_CHARTER_TAB_BADGES_KEY);
    const map = stored ? JSON.parse(stored) : {};
    map[bookingId] = { ...(map[bookingId] || {}), [tabId]: String(badgeValue) };
    localStorage.setItem(CUSTOMER_CHARTER_TAB_BADGES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
};

export const shouldShowCustomerTabBadge = (bookingId, tabId, badgeValue, acknowledged = readAcknowledgedCustomerTabBadges(bookingId)) => {
  if (!badgeValue) return false;
  return acknowledged[tabId] !== String(badgeValue);
};

const isPaidLike = (paymentStatus) =>
  ["paid", "depositpaid", "partiallyrefunded", "partially_refunded"].includes(
    String(paymentStatus || "").toLowerCase(),
  );

const isRefundFailedPayment = (payment) => {
  const refundStatus = String(payment?.refundStatus || payment?.refund?.status || "").toLowerCase();
  return ["failed", "error", "rejected"].includes(refundStatus);
};

/** BE đôi khi chỉ điền refundAmount mà không đổi paymentStatus/refundStatus. */
const getPaymentRefundAmount = (payment) =>
  Number(
    payment?.refundAmount
    ?? payment?.refundedAmount
    ?? payment?.refund?.amount
    ?? payment?.refundAmountVnd
    ?? payment?.RefundAmount
    ?? payment?.RefundedAmount
    ?? 0,
  ) || 0;

const isRefundInFlightPayment = (payment) =>
  ["pending", "processing", "requested", "created"].includes(
    String(payment?.refundStatus || payment?.refund?.status || "").toLowerCase(),
  );

/** Hoàn tất kể cả khi BE vẫn để paymentStatus = Paid, chỉ điền refundAmount. */
const isRefundSettledPayment = (payment) => {
  const paymentStatus = String(payment?.paymentStatus || "").toLowerCase();
  const refundStatus = String(payment?.refundStatus || payment?.refund?.status || "").toLowerCase();
  if (paymentStatus === "refunded" || paymentStatus === "partiallyrefunded") return true;
  if (["success", "succeeded", "completed", "refunded", "paid"].includes(refundStatus)) return true;
  if (getPaymentRefundAmount(payment) > 0 && !isRefundInFlightPayment(payment) && !isRefundFailedPayment(payment)) {
    return true;
  }
  return false;
};

/** Admin chỉ cần vào khi PayOS refund fail (manual-refund). */
export const bookingNeedsAdminRefundAttention = (booking) => {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  return payments.some(isRefundFailedPayment);
};

/**
 * Cancelled + đã thu tiền + chưa hoàn xong → chờ khách nhập STK.
 * (Không còn bắt admin nhập bank trên flow hủy.)
 */
export const bookingWaitsCustomerRefundInfo = (booking) => {
  const status = String(booking?.status || "").toLowerCase();
  if (status !== "cancelled") return false;
  if (bookingNeedsAdminRefundAttention(booking)) return false;

  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  const hasCollectedMoney = isPaidLike(paymentStatus)
    || Number(booking?.paidAmount || 0) > 0
    || payments.some((payment) => {
      const ps = String(payment?.paymentStatus || "").toLowerCase();
      return ["paid", "depositpaid"].includes(ps)
        || Number(payment?.amount || payment?.paymentAmount || 0) > 0;
    });
  if (!hasCollectedMoney) return false;

  if (payments.length === 0) return true;
  return payments.some((payment) => !isRefundSettledPayment(payment) && !isRefundInFlightPayment(payment));
};

/** @deprecated Prefer bookingNeedsAdminRefundAttention / bookingWaitsCustomerRefundInfo */
export const bookingNeedsRefundAttention = (booking) =>
  bookingNeedsAdminRefundAttention(booking) || bookingWaitsCustomerRefundInfo(booking);

export const getCustomerActionInfo = (booking, lang) => {
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();
  const status = booking?.status;

  if (bookingWaitsCustomerRefundInfo(booking)) {
    return {
      icon: "account_balance",
      label: lang === "VN" ? "Booking đã hủy — nhập thông tin hoàn tiền" : "Cancelled — enter refund details",
      cta: lang === "VN" ? "Nhập thông tin hoàn" : "Enter refund info",
      tone: "refund",
      urgent: true,
      classes: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      buttonClasses: "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-500/20",
    };
  }

  if (status === "PendingQuote") {
    return {
      label: lang === "VN" ? "Chờ báo giá" : "Waiting for quote",
      cta: lang === "VN" ? "Xem tiến độ" : "Track progress",
      tone: "wait",
      urgent: false,
      classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      buttonClasses: "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20",
    };
  }

  if (status === "Quoted" && paymentStatus !== "paid") {
    return {
      icon: "payments",
      label: lang === "VN" ? "Báo giá sẵn sàng — thanh toán ngay" : "Quote ready — pay now",
      cta: lang === "VN" ? "Thanh toán ngay" : "Pay now",
      tone: "pay",
      urgent: true,
      classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
      buttonClasses: "bg-[#124757] text-white hover:bg-[#0d3541] shadow-[#124757]/20 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300",
    };
  }

  if (status === "PendingPayment" || (status === "Confirmed" && paymentStatus === "depositpaid")) {
    return {
      icon: "account_balance_wallet",
      label: paymentStatus === "depositpaid"
        ? (lang === "VN" ? "Đã cọc — thanh toán phần còn lại" : "Deposit paid — pay remainder")
        : (lang === "VN" ? "Đang chờ hoàn tất thanh toán" : "Payment in progress"),
      cta: paymentStatus === "depositpaid"
        ? (lang === "VN" ? "Thanh toán còn lại" : "Pay remainder")
        : (lang === "VN" ? "Tiếp tục thanh toán" : "Continue payment"),
      tone: "pay",
      urgent: true,
      classes: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
      buttonClasses: "bg-[#124757] text-white hover:bg-[#0d3541] shadow-[#124757]/20 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300",
    };
  }

  // Đã thanh toán đủ: chuyển thẳng sang xem chi tiết
  if (paymentStatus === "paid") {
    return {
      icon: "confirmation_number",
      label: lang === "VN" ? "Thanh toán thành công — xem chi tiết booking" : "Payment successful — view booking details",
      cta: lang === "VN" ? "Xem chi tiết" : "View details",
      tone: "view",
      urgent: false,
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
      buttonClasses: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20",
    };
  }

  // Approved (đã admin duyệt báo giá — chờ khách thanh toán)
  if (status === "Approved" && paymentStatus !== "paid") {
    return {
      icon: "payments",
      label: lang === "VN" ? "Đã duyệt — thanh toán để chốt booking" : "Approved — pay to finalize booking",
      cta: lang === "VN" ? "Thanh toán ngay" : "Pay now",
      tone: "pay",
      urgent: true,
      classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
      buttonClasses: "bg-[#124757] text-white hover:bg-[#0d3541] shadow-[#124757]/20 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300",
    };
  }

  // PendingApproval (chờ admin duyệt)
  if (status === "PendingApproval") {
    return {
      icon: "pending_actions",
      label: lang === "VN" ? "Chờ admin duyệt yêu cầu" : "Waiting for admin to approve the request",
      cta: lang === "VN" ? "Xem tiến độ" : "Track progress",
      tone: "wait",
      urgent: false,
      classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      buttonClasses: "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20",
    };
  }

  if (["Confirmed", "Completed"].includes(status)) {
    return {
      icon: "confirmation_number",
      label: lang === "VN" ? "Sẵn sàng quản lý hành khách & vé" : "Ready to manage passengers & tickets",
      cta: lang === "VN" ? "Quản lý hành khách" : "Manage passengers",
      tone: "manage",
      urgent: false,
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
      buttonClasses: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20",
    };
  }

  if (status === "Refunded") {
    return {
      icon: "task_alt",
      label: lang === "VN" ? "Đã đóng sổ — yêu cầu hoàn tất" : "Closed — refund finalized",
      cta: lang === "VN" ? "Xem chi tiết" : "View details",
      tone: "closed",
      urgent: false,
      classes: "bg-teal-50/70 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20",
      buttonClasses: "border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 dark:border-teal-500/30 dark:bg-slate-900 dark:text-teal-300",
    };
  }

  if (isTerminalBookingStatus(status)) {
    return {
      label: lang === "VN" ? "Yêu cầu đã đóng" : "Request closed",
      cta: lang === "VN" ? "Xem chi tiết" : "View details",
      tone: "closed",
      urgent: false,
      classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
      buttonClasses: "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
    };
  }

  return {
    icon: "visibility",
    label: lang === "VN" ? "Xem thông tin booking" : "View booking details",
    cta: lang === "VN" ? "Xem chi tiết" : "View details",
    tone: "view",
    urgent: false,
    classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    buttonClasses: "border border-slate-200 bg-white text-[#124757] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400",
  };
};

export const getAdminActionInfo = (booking, lang) => {
  const status = booking?.status;
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();

  if (bookingNeedsAdminRefundAttention(booking)) {
    return {
      icon: "currency_exchange",
      label: lang === "VN" ? "PayOS hoàn lỗi — cần ghi nhận thủ công" : "PayOS refund failed — manual record needed",
      cta: lang === "VN" ? "Xử lý hoàn" : "Process refund",
      tab: "payments",
      urgent: true,
      classes: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
      buttonClasses: "bg-rose-600 text-white hover:bg-rose-700",
    };
  }

  if (bookingWaitsCustomerRefundInfo(booking)) {
    return {
      icon: "hourglass_top",
      label: lang === "VN" ? "Chờ khách nhập thông tin hoàn tiền" : "Waiting for customer refund info",
      cta: lang === "VN" ? "Theo dõi" : "Monitor",
      tab: "payments",
      urgent: false,
      classes: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      buttonClasses: "border border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-300",
    };
  }

  if (status === "PendingQuote") {
    return {
      icon: "request_quote",
      label: lang === "VN" ? "Cần báo giá" : "Quote needed",
      cta: lang === "VN" ? "Báo giá" : "Quote",
      tab: "actions",
      urgent: true,
      classes: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      buttonClasses: "bg-[#124757] text-white hover:bg-[#0d3541] dark:bg-yellow-400 dark:text-slate-900",
    };
  }

  if (status === "Quoted" && !isPaidLike(paymentStatus)) {
    return {
      icon: "schedule",
      label: lang === "VN" ? "Chờ khách thanh toán" : "Awaiting payment",
      cta: lang === "VN" ? "Theo dõi" : "Monitor",
      tab: "payments",
      urgent: false,
      classes: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
      buttonClasses: "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-300",
    };
  }

  if (status === "PendingPayment" || (status === "Confirmed" && paymentStatus === "depositpaid")) {
    return {
      icon: "payments",
      label: lang === "VN" ? "Theo dõi thanh toán" : "Payment follow-up",
      cta: lang === "VN" ? "Thanh toán" : "Payments",
      tab: "payments",
      urgent: true,
      classes: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
      buttonClasses: "bg-[#124757] text-white hover:bg-[#0d3541] dark:bg-yellow-400 dark:text-slate-900",
    };
  }

  if (status === "Confirmed" && isPaidLike(paymentStatus)) {
    return {
      icon: "directions_boat",
      label: lang === "VN" ? "Sẵn sàng vận hành" : "Ready for operation",
      cta: lang === "VN" ? "Vận hành" : "Operate",
      tab: "tickets",
      urgent: false,
      classes: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
      buttonClasses: "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:bg-slate-900 dark:text-sky-300",
    };
  }

  if (status === "Completed") {
    return {
      icon: "task_alt",
      label: lang === "VN" ? "Đã hoàn tất" : "Completed",
      cta: lang === "VN" ? "Xem lại" : "Review",
      tab: "overview",
      urgent: false,
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
      buttonClasses: "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300",
    };
  }

  return {
    icon: "visibility",
    label: lang === "VN" ? "Xem chi tiết" : "View details",
    cta: lang === "VN" ? "Mở" : "Open",
    tab: "overview",
    urgent: false,
    classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    buttonClasses: "border border-slate-200 bg-white text-[#124757] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400",
  };
};

export const SMART_FILTERS = {
  all: {
    labelVn: "Tất cả",
    labelEn: "All",
    icon: "apps",
  },
  needsAction: {
    labelVn: "Cần xử lý",
    labelEn: "Needs action",
    icon: "priority_high",
  },
  waitingQuote: {
    labelVn: "Chờ báo giá",
    labelEn: "Waiting quote",
    icon: "hourglass_top",
  },
  toPay: {
    labelVn: "Cần thanh toán",
    labelEn: "To pay",
    icon: "payments",
  },
  active: {
    labelVn: "Đang hiệu lực",
    labelEn: "Active",
    icon: "event_available",
  },
  closed: {
    labelVn: "Đã đóng",
    labelEn: "Closed",
    icon: "archive",
  },
};

export const matchesSmartFilter = (booking, filterKey) => {
  const status = booking?.status;
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();

  switch (filterKey) {
    case "needsAction":
      return (
        status === "PendingQuote"
        || (status === "Quoted" && paymentStatus !== "paid")
        || status === "PendingPayment"
        || (status === "Confirmed" && paymentStatus === "depositpaid")
        || bookingNeedsRefundAttention(booking)
      );
    case "waitingQuote":
      return status === "PendingQuote";
    case "toPay":
      return (status === "Quoted" && paymentStatus !== "paid")
        || status === "PendingPayment"
        || (status === "Confirmed" && paymentStatus === "depositpaid");
    case "active":
      return ["PendingPayment", "Confirmed", "Quoted"].includes(status) && !isTerminalBookingStatus(status);
    case "closed":
      return isTerminalBookingStatus(status);
    default:
      return true;
  }
};

export const getPaginationWindow = (currentPage, totalPages, windowSize = 5) => {
  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages = [];
  for (let page = start; page <= end; page += 1) pages.push(page);
  return pages;
};

const CLOSED_BOOKING_STATUSES = ["Cancelled", "Expired", "Completed", "Refunded"];

export const CHARTER_QUOTE_HOLD_MS = 12 * 60 * 60 * 1000;
export const CHARTER_DEFAULT_DEPOSIT_RATE = 0.5;

export const getCharterDepositAmount = (quoteTotal, adminDepositAmount = 0) => {
  const total = Number(quoteTotal) || 0;
  const adminAmount = Number(adminDepositAmount) || 0;
  if (total <= 0) return 0;
  if (adminAmount > 0) return Math.min(adminAmount, total);
  return Math.round(total * CHARTER_DEFAULT_DEPOSIT_RATE);
};

const pickDeadline = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const getQuoteAnchorTime = (booking) => {
  const anchor = pickDeadline(
    booking?.quotedAt,
    booking?.quoteSubmittedAt,
    booking?.quoteAt,
    booking?.quotedDate,
  );
  if (anchor) {
    const time = new Date(anchor).getTime();
    if (!Number.isNaN(time)) return time;
  }
  if (["Quoted", "PendingPayment", "Confirmed"].includes(String(booking?.status || ""))) {
    const fallback = pickDeadline(booking?.updatedAt, booking?.modifiedAt, booking?.createdAt);
    if (fallback) {
      const time = new Date(fallback).getTime();
      if (!Number.isNaN(time)) return time;
    }
  }
  return 0;
};

export const getCharterQuotePaymentDeadline = (booking) => {
  const anchorTime = getQuoteAnchorTime(booking);
  const computedDeadline = anchorTime
    ? new Date(anchorTime + CHARTER_QUOTE_HOLD_MS).toISOString()
    : "";

  const apiDeadline = pickDeadline(booking?.bookingHoldExpiresAt, booking?.holdExpiresAt);
  if (computedDeadline && apiDeadline) {
    const computedTime = new Date(computedDeadline).getTime();
    const apiTime = new Date(apiDeadline).getTime();
    if (!Number.isNaN(computedTime) && !Number.isNaN(apiTime)) {
      return new Date(Math.max(computedTime, apiTime)).toISOString();
    }
  }
  return computedDeadline || apiDeadline || "";
};

export const shouldShowCharterQuotePaymentCountdown = (booking) => {
  if (!booking) return false;
  if (isBookingClosed(booking)) return false;
  if (isBookingFullyPaid(booking)) return false;
  if (isBookingPaymentClosed(booking)) return false;
  if (!["Quoted", "PendingPayment", "Confirmed"].includes(String(booking?.status || ""))) return false;
  return Boolean(getCharterQuotePaymentDeadline(booking));
};

export const isBookingFullyPaid = (booking) =>
  String(booking?.paymentStatus || "").toLowerCase() === "paid";

export const isBookingPaymentClosed = (booking) => {
  const paymentStatus = String(booking?.paymentStatus || "").toLowerCase();
  return ["paid", "refunded", "depositpaid"].includes(paymentStatus);
};

export const isBookingClosed = (booking) =>
  CLOSED_BOOKING_STATUSES.includes(String(booking?.status || ""))
  || ["cancelled", "refunded", "expired", "completed"].includes(String(booking?.status || "").toLowerCase());

/** Chỉ đếm ngược khi khách đã chấp nhận báo giá (PendingPayment) nhưng chưa thanh toán xong. */
export const shouldShowBookingHoldCountdown = (booking) =>
  shouldShowCharterQuotePaymentCountdown(booking);

export const shouldShowPaymentDeadlineCountdown = (payment, booking) => {
  if (!payment) return false;
  if (booking) {
    if (isBookingClosed(booking)) return false;
    if (isBookingFullyPaid(booking)) return false;
    if (isBookingPaymentClosed(booking)) return false;
  }
  const paymentStatus = String(payment?.paymentStatus || payment?.status || "").toLowerCase();
  if (["paid", "refunded", "depositpaid", "cancelled", "failed"].includes(paymentStatus)) return false;
  return paymentStatus === "pending";
};

export const getDefaultAdminTab = (booking) => {
  if (!booking) return "overview";
  if (booking.status === "PendingQuote") return "actions";
  if (bookingNeedsRefundAttention(booking)) return "payments";
  if (["Quoted", "PendingPayment"].includes(booking.status)) return "overview";
  return "overview";
};
