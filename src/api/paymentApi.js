import api from "./axios";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orderCodePattern = /^\d+$/;

export const createPayment = (data) =>
  api.post("/payments", data).then((response) => response.data);

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
