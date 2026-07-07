import {
  createPayment as apiCreatePayment,
  manualRefundPayment as apiManualRefundPayment,
  refundPayment as apiRefundPayment,
  syncPayment as apiSyncPayment,
  syncPaymentByOrderCode as apiSyncPaymentByOrderCode,
} from "../api/paymentApi";

export const createBookingPayment = (paymentPayload) =>
  apiCreatePayment(paymentPayload);

export const refundBookingPayment = (paymentId, refundPayload) =>
  apiRefundPayment(paymentId, refundPayload);

export const manualRefundBookingPayment = (paymentId, manualPayload) =>
  apiManualRefundPayment(paymentId, manualPayload);

export const syncBookingPayment = (paymentId) =>
  apiSyncPayment(paymentId);

export const syncBookingPaymentByOrderCode = (orderCode) =>
  apiSyncPaymentByOrderCode(orderCode);
