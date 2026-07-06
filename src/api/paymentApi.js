import api from "./axios";

export const createPayment = (data) =>
  api.post("/payments", data).then((response) => response.data);

export const syncPayment = (paymentId) =>
  api
    .post(`/payments/${encodeURIComponent(paymentId)}/sync`)
    .then((response) => response.data);

export const syncPaymentByOrderCode = (orderCode) =>
  api
    .post(`/payments/order-code/${encodeURIComponent(orderCode)}/sync`)
    .then((response) => response.data);
