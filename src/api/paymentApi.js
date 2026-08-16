import api from "./axios";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderCodePattern = /^\d+$/;

export const createPayment = (data) =>
  api.post("/payments", data).then((response) => response.data);

export const refundPayment = (paymentId, refundPayload = {}) => {
  const value = String(paymentId || "").trim();

  if (!value) {
    return Promise.reject(new Error("paymentId is required to refund a payment."));
  }

  return api
    .post(`/payments/${encodeURIComponent(value)}/refund`, refundPayload)
    .then((response) => response.data);
};

/**
 * GET /payments/{paymentId}/refund/otp-options
 * Trả refundAmount, defaultChannel, channels[{ channel, maskedDestination, ... }].
 */
export const getRefundOtpOptions = (paymentId) => {
  const value = String(paymentId || "").trim();

  if (!value) {
    return Promise.reject(new Error("paymentId is required to load refund OTP options."));
  }

  return api
    .get(`/payments/${encodeURIComponent(value)}/refund/otp-options`)
    .then((response) => response.data);
};

/**
 * POST /payments/{paymentId}/refund/otp
 * Body: { otpChannel: "phone" | "email" }.
 * Response: challengeId / otpChallengeId, maskedDestination, expiresAt, resendAvailableAt.
 */
export const requestRefundOtp = (paymentId, payload = {}) => {
  const value = String(paymentId || "").trim();

  if (!value) {
    return Promise.reject(new Error("paymentId is required to request refund OTP."));
  }

  return api
    .post(`/payments/${encodeURIComponent(value)}/refund/otp`, payload || {})
    .then((response) => response.data);
};

/**
 * GET /charter-bookings/{bookingId}/refund-summary
 * Trả về policyPercent (0-100), policyMessage, refundAmount, payableAmount, currency.
 * BE dùng để khách xem trước khi mở form refund; nếu policyPercent === 0 thì
 * BE skip bank/OTP và chỉ cần reason + confirmZeroRefund=true.
 */
export const getCharterRefundSummary = (bookingId) => {
  const value = String(bookingId || "").trim();
  if (!value) {
    return Promise.reject(new Error("bookingId is required to load refund summary."));
  }
  return api
    .get(`/charter-bookings/${encodeURIComponent(value)}/refund-summary`)
    .then((response) => response.data);
};

export const manualRefundPayment = (paymentId, manualPayload = {}) => {
  const value = String(paymentId || "").trim();

  if (!value) {
    return Promise.reject(new Error("paymentId is required to record a manual refund."));
  }

  return api
    .post(`/payments/${encodeURIComponent(value)}/manual-refund`, manualPayload)
    .then((response) => response.data);
};

export const syncPayment = (paymentId) => {
  const value = String(paymentId || "").trim();

  if (orderCodePattern.test(value)) return syncPaymentByOrderCode(value);
  if (!uuidPattern.test(value)) {
    return Promise.reject(new Error("paymentId must be an internal UUID. Use orderCode sync for PayOS orderCode."));
  }

  return api
    .post(`/payments/${encodeURIComponent(value)}/sync`)
    .then((response) => response.data);
};

export const syncPaymentByOrderCode = (orderCode) => {
  const value = String(orderCode || "").trim();

  if (!orderCodePattern.test(value)) {
    return Promise.reject(new Error("orderCode must be a PayOS numeric int64 value."));
  }

  return api
    .post(`/payments/order-code/${encodeURIComponent(value)}/sync`)
    .then((response) => response.data);
};
