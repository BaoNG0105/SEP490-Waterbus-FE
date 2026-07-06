import {
  createPayment as apiCreatePayment,
  syncPayment as apiSyncPayment,
  syncPaymentByOrderCode as apiSyncPaymentByOrderCode,
} from "../api/paymentApi";

export const createBookingPayment = (paymentPayload) =>
  apiCreatePayment(paymentPayload);

export const syncBookingPayment = (paymentId) =>
  apiSyncPayment(paymentId);

export const syncBookingPaymentByOrderCode = (orderCode) =>
  apiSyncPaymentByOrderCode(orderCode);
