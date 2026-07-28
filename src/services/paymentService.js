import {
  createPayment as apiCreatePayment,
  manualRefundPayment as apiManualRefundPayment,
  refundPayment as apiRefundPayment,
  requestRefundOtp as apiRequestRefundOtp,
  syncPayment as apiSyncPayment,
  syncPaymentByOrderCode as apiSyncPaymentByOrderCode,
} from "../api/paymentApi";

export const createBookingPayment = (paymentPayload) =>
  apiCreatePayment(paymentPayload);

export const refundBookingPayment = (paymentId, refundPayload) =>
  apiRefundPayment(paymentId, refundPayload);

/** POST /payments/{id}/refund/otp — lấy challengeId trước khi refund. */
export const requestRefundBookingOtp = (paymentId, { otpChannel } = {}) =>
  apiRequestRefundOtp(paymentId, otpChannel ? { otpChannel } : {});

export const manualRefundBookingPayment = (paymentId, manualPayload) =>
  apiManualRefundPayment(paymentId, manualPayload);

export const syncBookingPayment = (paymentId) =>
  apiSyncPayment(paymentId);

export const syncBookingPaymentByOrderCode = (orderCode) =>
  apiSyncPaymentByOrderCode(orderCode);
