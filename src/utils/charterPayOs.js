/**
 * PayOS helpers for charter — especially insurance top-up after passenger add.
 */

const pick = (source, keys, fallback = "") => {
  if (!source || typeof source !== "object") return fallback;
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

/**
 * Số tiền còn thiếu.
 * Ưu tiên field BE remainingAmount khi field này có mặt, kể cả khi bằng 0.
 * additionalInsuranceAmount chỉ là fallback cho response cũ không có remainingAmount.
 * Fallback: totalAmount − paidAmount.
 */
export const getCharterBalanceDue = (booking) => {
  if (!booking || typeof booking !== "object") return 0;

  const additional = Number(booking.additionalInsuranceAmount);
  const hasAdditional = Number.isFinite(additional) && additional > 0;

  if (
    booking.remainingAmount !== undefined
    && booking.remainingAmount !== null
    && booking.remainingAmount !== ""
  ) {
    const remaining = Number(booking.remainingAmount);
    return Number.isFinite(remaining) ? Math.max(remaining, 0) : 0;
  }

  // Fallback cuối: nếu BE đánh dấu requiresAdditionalPayment nhưng remainingAmount chưa update,
  // ưu tiên additionalInsuranceAmount trước khi tính total-paid.
  if (hasAdditional) return additional;

  const total = Number(booking.totalAmount ?? booking.estimatedPrice ?? booking.finalAmount ?? 0) || 0;
  const paid = Number(booking.paidAmount ?? 0) || 0;
  return Math.max(total - paid, 0);
};

/** Còn phải thu (BH tăng sau thêm HK, hoặc trả dở). */
export const hasCharterBalanceDue = (booking) => {
  if (!booking || typeof booking !== "object") return false;
  if (booking.requiresAdditionalPayment === true) return true;
  return getCharterBalanceDue(booking) > 0;
};

/** Meta thanh toán phụ từ response passenger approve/import/update. */
export const extractCharterAdditionalPaymentMeta = (payload) => {
  const root = payload && typeof payload === "object" ? payload : {};
  const nested = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root;
  const booking = nested.booking && typeof nested.booking === "object" ? nested.booking : nested;

  const requiresAdditionalPayment = Boolean(
    booking.requiresAdditionalPayment ?? nested.requiresAdditionalPayment ?? root.requiresAdditionalPayment,
  );
  const remainingAmount = Number(
    booking.remainingAmount ?? nested.remainingAmount ?? root.remainingAmount ?? 0,
  ) || 0;
  const additionalInsuranceAmount = Number(
    booking.additionalInsuranceAmount
    ?? nested.additionalInsuranceAmount
    ?? root.additionalInsuranceAmount
    ?? 0,
  ) || 0;
  const paymentStatus = String(
    pick(booking, ["paymentStatus"], "")
    || pick(nested, ["paymentStatus"], "")
    || pick(root, ["paymentStatus"], "")
    || "",
  );
  const totalAmount = Number(
    booking.totalAmount ?? nested.totalAmount ?? root.totalAmount ?? 0,
  ) || 0;
  const depositAmount = Number(
    booking.depositAmount ?? nested.depositAmount ?? root.depositAmount ?? 0,
  ) || 0;

  return {
    requiresAdditionalPayment,
    remainingAmount: Math.max(remainingAmount, 0),
    additionalInsuranceAmount,
    paymentStatus,
    totalAmount,
    depositAmount,
    insurance: booking.insurance || nested.insurance || root.insurance || null,
  };
};

/**
 * Đã từng thanh toán đủ / đang có dư nợ phụ (vd. phí BH khi thêm người).
 * Dùng để vẫn hiện vé/HK khi paymentStatus có thể không còn Paid.
 */
export const canShowCharterTicketsWithBalance = (booking) => {
  if (!booking || typeof booking !== "object") return false;
  const status = String(booking.paymentStatus || "").toLowerCase();
  if (status === "paid") return true;
  const paid = Number(booking.paidAmount || 0) || 0;
  const balance = getCharterBalanceDue(booking);
  const bookingStatus = String(booking.status || booking.bookingStatus || "");
  return paid > 0 && balance > 0 && ["Confirmed", "Completed"].includes(bookingStatus);
};

/** Lấy checkout / orderCode từ body API (approve, PUT passengers, POST /payments…). */
export const extractPayOsPaymentFields = (payload) => {
  const root = payload && typeof payload === "object" ? payload : {};
  const payment = root.payment || root.data?.payment || root.data || root;

  const checkoutUrl = pick(payment, [
    "checkoutUrl",
    "paymentUrl",
    "paymentLink",
    "payUrl",
    "url",
  ], "") || pick(root, [
    "checkoutUrl",
    "paymentUrl",
    "payment.checkoutUrl",
    "data.checkoutUrl",
    "data.payment.checkoutUrl",
  ], "");

  const orderCode = pick(payment, [
    "orderCode",
    "paymentOrderCode",
    "payosOrderCode",
  ], "") || pick(root, [
    "orderCode",
    "paymentOrderCode",
    "data.orderCode",
    "payment.orderCode",
    "data.payment.orderCode",
  ], "");

  const paymentId = pick(payment, [
    "paymentId",
    "id",
  ], "") || pick(root, [
    "paymentId",
    "data.paymentId",
    "payment.id",
    "data.payment.id",
  ], "");

  const amount = Number(pick(payment, [
    "amount",
    "paymentAmount",
  ], 0) || pick(root, [
    "amount",
    "paymentAmount",
    "additionalAmount",
    "insuranceAdditionalAmount",
    "data.amount",
  ], 0)) || 0;

  const expiresAt = pick(payment, ["expiresAt"], "") || pick(root, [
    "expiresAt",
    "data.expiresAt",
    "payment.expiresAt",
  ], "");

  const qrCode = pick(payment, ["qrCode"], "") || pick(root, [
    "qrCode",
    "data.qrCode",
    "payment.qrCode",
  ], "");

  if (!checkoutUrl && !orderCode && !paymentId && !(amount > 0)) {
    return null;
  }

  return {
    checkoutUrl: checkoutUrl || "",
    orderCode: orderCode || "",
    paymentId: paymentId || "",
    amount,
    expiresAt: expiresAt || "",
    qrCode: qrCode || "",
  };
};

export const rememberCharterPayOsSession = (bookingId, fields = {}) => {
  if (!bookingId) return;
  const id = String(bookingId);
  if (fields.orderCode) {
    sessionStorage.setItem(`charterPaymentOrderCode:${id}`, String(fields.orderCode));
    sessionStorage.removeItem(`charterPayment:${id}`);
  } else if (fields.paymentId) {
    sessionStorage.setItem(`charterPayment:${id}`, String(fields.paymentId));
  }
  sessionStorage.setItem("latestCharterPaymentBooking", id);
  if (fields.paymentId) {
    sessionStorage.setItem(`paymentBooking:${fields.paymentId}`, id);
  }
};

/** Tránh tạo nhiều link PayOS cho cùng mức dư nợ. */
export const markCharterTopUpPayOsStarted = (bookingId, amount) => {
  if (!bookingId || !(amount > 0)) return false;
  const key = `charterTopUpPayos:${bookingId}:${Math.round(amount)}`;
  const startedAt = Number(sessionStorage.getItem(key));
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 30_000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  return true;
};

export const clearCharterTopUpPayOsStarted = (bookingId, amount) => {
  if (!bookingId || !(amount > 0)) return;
  sessionStorage.removeItem(`charterTopUpPayos:${bookingId}:${Math.round(amount)}`);
};
