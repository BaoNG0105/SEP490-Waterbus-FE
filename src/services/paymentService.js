import {
  createPayment as apiCreatePayment,
  getCharterRefundSummary as apiGetCharterRefundSummary,
  getRefundOtpOptions as apiGetRefundOtpOptions,
  manualRefundPayment as apiManualRefundPayment,
  refundPayment as apiRefundPayment,
  requestRefundOtp as apiRequestRefundOtp,
  syncPayment as apiSyncPayment,
  syncPaymentByOrderCode as apiSyncPaymentByOrderCode,
} from "../api/paymentApi";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const createBookingPayment = (paymentPayload) =>
  apiCreatePayment(paymentPayload);

export const refundBookingPayment = (paymentId, refundPayload) =>
  apiRefundPayment(paymentId, refundPayload);

/** Chuẩn hoá kênh OTP: BE trả "Phone"/"Email", POST body cần "phone"/"email". */
export const normalizeRefundOtpChannel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  if (key === "phone" || key === "sms" || key === "mobile") return "phone";
  if (key === "email" || key === "mail") return "email";
  return key;
};

/** GET /payments/{id}/refund/otp-options */
export const fetchRefundOtpOptions = async (paymentId) => {
  const data = await apiGetRefundOtpOptions(paymentId);
  const root = data?.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : data;
  const rawChannels = Array.isArray(root?.channels)
    ? root.channels
    : Array.isArray(root?.options)
      ? root.options
      : Array.isArray(root?.availableChannels)
        ? root.availableChannels
        : [];

  const channels = rawChannels.map((item) => {
    if (typeof item === "string") {
      const channel = normalizeRefundOtpChannel(item);
      return {
        channel,
        maskedDestination: "",
        isDefault: false,
        label: channel,
      };
    }
    const channel = normalizeRefundOtpChannel(
      pick(item, ["channel", "otpChannel", "type", "name"], ""),
    );
    return {
      channel,
      maskedDestination: pick(item, ["maskedDestination", "destination", "masked"], "") || "",
      isDefault: Boolean(item?.isDefault ?? item?.IsDefault),
      label: pick(item, ["label", "displayName"], "") || channel,
      raw: item,
    };
  }).filter((item) => item.channel === "phone" || item.channel === "email");

  const defaultFromFlag = channels.find((item) => item.isDefault)?.channel || "";
  const defaultChannel = normalizeRefundOtpChannel(
    defaultFromFlag
    || pick(root, ["defaultChannel", "otpChannel", "preferredChannel"], "")
    || channels[0]?.channel
    || "phone",
  );

  return {
    paymentId: pick(root, ["paymentId", "id"], "") || "",
    refundAmount: Number(pick(root, ["refundAmount", "amount", "payableAmount"], 0)) || 0,
    defaultChannel: defaultChannel === "email" ? "email" : "phone",
    channels,
    raw: root,
  };
};

/** POST /payments/{id}/refund/otp — body { otpChannel: "phone" | "email" }. */
export const requestRefundBookingOtp = (paymentId, { otpChannel } = {}) => {
  const channel = normalizeRefundOtpChannel(otpChannel) || "phone";
  return apiRequestRefundOtp(paymentId, {
    otpChannel: channel === "email" ? "email" : "phone",
  });
};

export const manualRefundBookingPayment = (paymentId, manualPayload) =>
  apiManualRefundPayment(paymentId, manualPayload);

export const syncBookingPayment = (paymentId) =>
  apiSyncPayment(paymentId);

export const syncBookingPaymentByOrderCode = (orderCode) =>
  apiSyncPaymentByOrderCode(orderCode);

/**
 * GET /charter-bookings/{bookingId}/refund-summary
 * Trả về { policyPercent, policyMessage, refundAmount, payableAmount, currency }.
 * Nếu policyPercent === 0 → BE sẽ skip bank/OTP ở POST /refund,
 * FE chỉ cần gửi { reason, confirmZeroRefund: true }.
 */
export const fetchCharterRefundSummary = async (bookingId) => {
  const data = await apiGetCharterRefundSummary(bookingId);
  const root = data?.data && typeof data.data === "object" && !Array.isArray(data.data) ? data.data : data;

  const policyPercentRaw = pick(root, ["policyPercent", "refundPolicyPercent", "percent"], null);
  const policyPercent = policyPercentRaw === null || policyPercentRaw === ""
    ? null
    : Number(policyPercentRaw);

  const refundAmountRaw = pick(root, ["refundAmount", "amount", "payableAmount"], 0);
  const refundAmount = Number(refundAmountRaw) || 0;

  const payableAmountRaw = pick(root, ["payableAmount", "paidAmount"], 0);
  const payableAmount = Number(payableAmountRaw) || 0;

  return {
    bookingId: pick(root, ["bookingId", "charterBookingId", "id"], "") || "",
    policyPercent: Number.isFinite(policyPercent) ? policyPercent : null,
    policyMessage: pick(root, ["policyMessage", "message", "description"], "") || "",
    refundAmount,
    payableAmount,
    currency: pick(root, ["currency"], "VND") || "VND",
    isZeroRefundPolicy: policyPercent === 0 || refundAmount <= 0,
    raw: root,
  };
};
