import {
  createPayment as apiCreatePayment,
  refundPayment as apiRefundPayment,
  syncPayment as apiSyncPayment,
  syncPaymentByOrderCode as apiSyncPaymentByOrderCode,
} from "../api/paymentApi";

export const createBookingPayment = (paymentPayload) =>
  apiCreatePayment(paymentPayload);

export const refundBookingPayment = (paymentId, refundPayload) =>
  apiRefundPayment(paymentId, refundPayload);

export const syncBookingPayment = (paymentId) =>
  apiSyncPayment(paymentId);

export const syncBookingPaymentByOrderCode = (orderCode) =>
  apiSyncPaymentByOrderCode(orderCode);
