import { normalizeCharterTicketRows } from "./charterBookingTickets";
import { getCharterDepositAmount } from "./charterBookingActions";
import { getBookingInsurancePackageId, normalizeInsuranceFromBooking, resolveInsuranceSelected } from "./insurancePreview";

export const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired", "Refunded"];
export const manualStatusOptions = ["Cancelled", "Expired", "Completed"];
export const rentalUnits = ["Day", "Hour"];
export const itemsPerPage = 8;
const ADMIN_CHARTER_TAB_BADGES_KEY = "adminCharterAcknowledgedTabBadges";

export const readAcknowledgedTabBadges = (bookingId) => {
  if (!bookingId) return {};
  try {
    const stored = localStorage.getItem(ADMIN_CHARTER_TAB_BADGES_KEY);
    if (!stored) return {};
    const map = JSON.parse(stored);
    const bookingState = map[bookingId];
    return bookingState && typeof bookingState === "object" ? bookingState : {};
  } catch {
    return {};
  }
};

export const acknowledgeTabBadge = (bookingId, tabId, badgeValue) => {
  if (!bookingId || !tabId || !badgeValue) return;
  try {
    const stored = localStorage.getItem(ADMIN_CHARTER_TAB_BADGES_KEY);
    const map = stored ? JSON.parse(stored) : {};
    map[bookingId] = { ...(map[bookingId] || {}), [tabId]: String(badgeValue) };
    localStorage.setItem(ADMIN_CHARTER_TAB_BADGES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
};

export const shouldShowTabBadge = (bookingId, tabId, badgeValue, acknowledged = readAcknowledgedTabBadges(bookingId)) => {
  if (!badgeValue) return false;
  return acknowledged[tabId] !== String(badgeValue);
};

export const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const DEFAULT_BOAT_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1782999909/xpsin48malhqhy5c53oi.png";

export const getBoatImageUrl = (boat, fallback = DEFAULT_BOAT_IMAGE) => {
  if (!boat) return fallback;
  const direct = pick(boat, ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl"], "");
  if (direct) return direct;
  const nestedUrls = boat?.boat?.imageUrls ?? boat?.imageUrls;
  if (Array.isArray(nestedUrls) && nestedUrls[0]) return nestedUrls[0];
  return fallback;
};

export const getBoatCode = (boat) => pick(boat, ["code", "boatCode", "boat.code"], "");

export const getBoatNameOnly = (boat, fallback = "--") =>
  pick(boat, ["name", "boatName", "boat.name"], fallback);

export const getBoatDisplayName = (boat, fallback = "--") => {
  const code = pick(boat, ["code", "boatCode", "boat.code"], "");
  const name = pick(boat, ["name", "boatName", "boat.name"], "");
  if (code && name) return `${code} · ${name}`;
  return name || code || fallback;
};

export const getBoatStatusLabel = (boat) => pick(boat, ["status", "boat.status"], "");

export const enrichAssignedBoat = (assigned, catalogBoats = []) => {
  if (!assigned) return null;
  const boatId = getBoatId(assigned);
  const catalogBoat = catalogBoats.find((boat) => getBoatId(boat) === boatId);
  if (!catalogBoat) return assigned;
  return {
    ...catalogBoat,
    ...assigned,
    code: getBoatCode(catalogBoat) || getBoatCode(assigned),
    name: getBoatNameOnly(catalogBoat, getBoatNameOnly(assigned)),
    imageUrl: getBoatImageUrl(catalogBoat, getBoatImageUrl(assigned)),
    imageUrls: Array.isArray(catalogBoat.imageUrls) && catalogBoat.imageUrls.length > 0
      ? catalogBoat.imageUrls
      : assigned.imageUrls,
    status: getBoatStatusLabel(catalogBoat) || getBoatStatusLabel(assigned),
  };
};

export const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

export const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

export const getDeadlineTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const getRemainingMs = (deadline, now = Date.now()) => {
  const time = getDeadlineTime(deadline);
  return time ? Math.max(0, time - now) : 0;
};

export const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const getBoatSeatCount = (boat) =>
  Number(pick(boat, ["seatCount", "capacity", "totalSeats", "seatsCount", "maxPassengers"], 0)) || 0;

export const getBoatId = (boat) => pick(boat, ["id", "boatId"]);
export const getBoatDeckCount = (boat) =>
  Number(pick(boat, ["numberOfDecks", "deckCount", "decks", "boat.numberOfDecks", "boat.deckCount"], 0)) || 0;
export const getBoatSeatSetupType = (boat) => pick(boat, ["seatSetupType", "requiredSeatSetupType", "boat.seatSetupType"], "");
export const getRequestedDeckCount = (boat) => {
  const directDeckCount = Number(pick(boat, ["requiredNumberOfDecks", "numberOfDecks", "preferredNumberOfDecks", "deckCount"], 0)) || 0;
  if (directDeckCount > 0) return directDeckCount;

  const legacySeatSetupType = String(pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "")).toLowerCase();
  if (["standardandvip", "standard_and_vip"].includes(legacySeatSetupType)) return 2;
  if (["fullstandard", "full_standard"].includes(legacySeatSetupType)) return 1;
  return 0;
};
export const formatDeckCount = (deckCount, lang) => (
  Number(deckCount) > 0
    ? `${deckCount} ${lang === "VN" ? "tầng" : Number(deckCount) === 1 ? "deck" : "decks"}`
    : ""
);
export const formatRentalUnit = (unit, lang) => {
  switch (unit) {
    case "Day":
      return lang === "VN" ? "ngày" : "day";
    case "Hour":
      return lang === "VN" ? "giờ" : "hour";
    default:
      return unit || "--";
  }
};
export const formatDuration = (value, unit, lang) => {
  const amount = Number(value) || 0;
  const unitLabel = formatRentalUnit(unit, lang);
  if (lang === "VN") return `${amount} ${unitLabel}`;
  const pluralSuffix = amount === 1 || ["--", ""].includes(unitLabel) ? "" : "s";
  return `${amount} ${unitLabel}${pluralSuffix}`;
};
export const formatPassengerSummary = (booking, lang) => {
  const passengerCount = Number(booking?.passengerCount) || 0;
  const adultCount = Number(booking?.adultCount) || 0;
  const childCount = Number(booking?.childCount) || 0;
  if (lang === "VN") {
    return `${passengerCount} khách (${adultCount} người lớn / ${childCount} trẻ em)`;
  }
  return `${passengerCount} guests (${adultCount} adult${adultCount === 1 ? "" : "s"} / ${childCount} child${childCount === 1 ? "" : "ren"})`;
};
export const getPaymentStatusInfo = (status, lang) => {
  switch (String(status || "").toLowerCase()) {
    case "unpaid":
      return { label: lang === "VN" ? "Chưa thanh toán" : "Unpaid", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
    case "pending":
    case "pendingpayment":
      return { label: lang === "VN" ? "Đang chờ thanh toán" : "Pending Payment", classes: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20" };
    case "paid":
      return { label: lang === "VN" ? "Đã thanh toán" : "Paid", classes: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" };
    case "depositpaid":
      return { label: lang === "VN" ? "Đã đặt cọc" : "Deposit Paid", classes: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20" };
    case "refunded":
      return { label: lang === "VN" ? "Đã hoàn tiền" : "Refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" };
    case "refundpending":
    case "refund_pending":
    case "refundprocessing":
    case "refund_processing":
      return { label: lang === "VN" ? "Đang hoàn tiền" : "Refund Processing", classes: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20" };
    case "refundfailed":
    case "refund_failed":
      return { label: lang === "VN" ? "Hoàn tiền lỗi" : "Refund Failed", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    case "failed":
      return { label: lang === "VN" ? "Thanh toán thất bại" : "Failed", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    case "cancelled":
      return { label: lang === "VN" ? "Đã hủy thanh toán" : "Cancelled", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    default:
      return { label: status || "--", classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
  }
};
export const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;
export const getRefundAmount = (payment) =>
  Number(pick(payment, ["refundAmount", "refundedAmount", "refund.amount", "refundAmountVnd"], 0)) || 0;
export const getRefundRequestedAmount = (payment) =>
  Number(pick(payment, ["refundRequestedAmount", "refund.requestedAmount", "refund.refundRequestedAmount"], 0)) || 0;
export const getRefundStatus = (payment) =>
  pick(payment, ["refundStatus", "refund.status", "refundPaymentStatus", "refundState", "payoutStatus"], "");
export const getRefundMethod = (payment) =>
  pick(payment, ["refundMethod", "refund.method"], "");
export const getRefundReferenceId = (payment) =>
  pick(payment, ["refundReferenceId", "refund.referenceId", "refund.refundReferenceId", "payoutId"], "");
export const getRefundMessage = (payment) =>
  pick(payment, ["refundMessage", "refund.message", "refundError", "refund.error", "refundFailureReason", "refund.reason"], "");
export const getRefundBankValue = (payment, booking, keys) =>
  pick(payment, keys, pick(booking?.raw, keys, pick(booking, keys, "")));
export const getRefundPaymentId = (payment) => pick(payment, [
  "paymentId",
  "id",
  "payment.id",
  "payment.paymentId",
  "paymentLinkId",
  "paymentLink.id",
  "linkPaymentId",
], "");
export const buildRefundFormDefaults = (payment, booking) => ({
  reason: getRefundBankValue(payment, booking, ["refundReason", "reason"]) || "Customer refund",
  bankBin: getRefundBankValue(payment, booking, ["bankBin", "refundBankBin", "payoutBankBin", "customer.bankBin", "user.bankBin"]),
  accountNumber: getRefundBankValue(payment, booking, ["accountNumber", "refundAccountNumber", "payoutAccountNumber", "bankAccountNumber", "customer.accountNumber", "user.accountNumber"]),
  accountName: getRefundBankValue(payment, booking, ["accountName", "refundAccountName", "payoutAccountName", "bankAccountName", "customer.accountName", "user.accountName", "contactName", "customerName"]),
});
export const buildRefundRequestBody = (form) => ({
  reason: form.reason?.trim() || "Customer refund",
  bankBin: form.bankBin?.trim() || "",
  accountNumber: form.accountNumber?.trim() || "",
  accountName: form.accountName?.trim() || "",
});
export const getRefundValidationMessage = (payload, lang) => {
  if (!/^\d{6}$/.test(payload.bankBin)) {
    return lang === "VN" ? "bankBin phải gồm đúng 6 chữ số." : "bankBin must contain exactly 6 digits.";
  }
  if (!/^\d{4,20}$/.test(payload.accountNumber)) {
    return lang === "VN" ? "Số tài khoản chỉ gồm 4-20 chữ số." : "Account number must contain 4-20 digits.";
  }
  if (payload.accountName.trim().length < 3) {
    return lang === "VN" ? "Tên tài khoản cần có ít nhất 3 ký tự." : "Account name must contain at least 3 characters.";
  }
  if (payload.reason.trim().length > 200) {
    return lang === "VN" ? "Lý do hoàn tiền không được vượt quá 200 ký tự." : "Refund reason must not exceed 200 characters.";
  }
  return "";
};
export const buildManualRefundPayload = (form) => {
  const refundedAt = form.refundedAt ? new Date(form.refundedAt).toISOString() : new Date().toISOString();
  return {
    reason: form.reason?.trim() || "Admin refunded by bank transfer after PayOS payout failed",
    referenceId: form.referenceId?.trim() || "",
    payoutId: form.payoutId?.trim() || null,
    refundedAt,
  };
};
export const getCurrentDatetimeLocalValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};
export const getManualRefundValidationMessage = (form, lang) => {
  if (form.reason.trim().length < 3) {
    return lang === "VN" ? "Lý do ghi nhận hoàn thủ công cần có ít nhất 3 ký tự." : "Manual refund reason must contain at least 3 characters.";
  }
  if (form.reason.trim().length > 200) {
    return lang === "VN" ? "Lý do ghi nhận hoàn thủ công không được vượt quá 200 ký tự." : "Manual refund reason must not exceed 200 characters.";
  }
  if (form.referenceId.trim().length < 3) {
    return lang === "VN" ? "Mã giao dịch ngân hàng cần có ít nhất 3 ký tự." : "Bank transfer reference must contain at least 3 characters.";
  }
  if (form.referenceId.trim().length > 100) {
    return lang === "VN" ? "Mã giao dịch ngân hàng không được vượt quá 100 ký tự." : "Bank transfer reference must not exceed 100 characters.";
  }
  if (form.refundedAt && Number.isNaN(new Date(form.refundedAt).getTime())) {
    return lang === "VN" ? "Thời điểm hoàn thủ công không hợp lệ." : "Manual refund time is invalid.";
  }
  return "";
};
export const getRefundStatusInfo = (payment, lang) => {
  const paymentStatus = String(pick(payment, ["paymentStatus"], "")).toLowerCase();
  const refundStatus = String(getRefundStatus(payment)).toLowerCase();
  if (paymentStatus === "refunded") {
    return { label: lang === "VN" ? "Đã hoàn tiền" : "Refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" };
  }
  if (["success", "succeeded", "completed", "refunded", "paid", "manualrefunded", "manual_refunded"].includes(refundStatus)) {
    return { label: lang === "VN" ? "Đã hoàn tiền" : "Refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" };
  }
  if (["pending", "processing", "requested", "created"].includes(refundStatus)) {
    return { label: lang === "VN" ? "Đang hoàn tiền" : "Refund Processing", classes: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20" };
  }
  if (["failed", "error", "cancelled", "rejected"].includes(refundStatus) || paymentStatus === "refundfailed" || paymentStatus === "refund_failed") {
    return { label: lang === "VN" ? "Hoàn tiền lỗi" : "Refund Failed", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
  }
  return { label: "--", classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
};
export const isPaidPayment = (payment) =>
  ["paid", "depositpaid", "success", "succeeded", "completed"].includes(String(pick(payment, ["paymentStatus"], "")).toLowerCase());
export const isRefundDone = (payment) => {
  const paymentStatus = String(pick(payment, ["paymentStatus"], "")).toLowerCase();
  const refundStatus = String(getRefundStatus(payment)).toLowerCase();
  return paymentStatus === "refunded" || ["success", "succeeded", "completed", "refunded", "paid", "manualrefunded", "manual_refunded"].includes(refundStatus);
};
export const isRefundProcessing = (payment) =>
  ["pending", "processing", "requested", "created"].includes(String(getRefundStatus(payment)).toLowerCase());
export const isRefundFailed = (payment) => {
  const paymentStatus = String(pick(payment, ["paymentStatus"], "")).toLowerCase();
  const refundStatus = String(getRefundStatus(payment)).toLowerCase();
  return paymentStatus === "refundfailed" || paymentStatus === "refund_failed" || ["failed", "error", "cancelled", "rejected"].includes(refundStatus);
};
export const getRemainingRefundAmount = (payment) => {
  const heldAmount = isRefundProcessing(payment) ? Math.max(getRefundAmount(payment), getRefundRequestedAmount(payment)) : getRefundAmount(payment);
  return Math.max(0, getPaymentAmount(payment) - heldAmount);
};
export const canRecordManualRefund = (payment) =>
  String(getRefundMethod(payment)).toLowerCase() === "payos"
  && isRefundFailed(payment)
  && getRefundRequestedAmount(payment) > 0
  && Boolean(getRefundReferenceId(payment))
  && Boolean(getRefundMessage(payment));
export const hasRefundableAmount = (payment) => getRemainingRefundAmount(payment) > 0 || canRecordManualRefund(payment);
export const canAdminHandleRefund = (payment, bookingStatus) =>
  (isPaidPayment(payment) || isRefundFailed(payment) || hasRefundableAmount(payment))
  && !isRefundDone(payment)
  && !isRefundProcessing(payment)
  && (isRefundFailed(payment) || ["cancelled", "refunded"].includes(String(bookingStatus || "").toLowerCase()));
export const hasRefundablePayment = (booking) =>
  Array.isArray(booking?.payments) && booking.payments.some((payment) => (isPaidPayment(payment) || hasRefundableAmount(payment)) && !isRefundDone(payment));
export const isActiveBoat = (boat) => String(pick(boat, ["status", "boatStatus", "boat.status"], "Active")).toLowerCase() === "active";
export const getBoatPrice = (boat, unit) => {
  const directPrice = Number(
    pick(boat, unit === "Hour" ? ["hourlyRentalPrice", "hourlyPrice"] : ["dailyRentalPrice", "dailyPrice"], 0),
  );
  if (directPrice > 0) return directPrice;

  const rentalPrice = Array.isArray(boat?.rentalPrices)
    ? boat.rentalPrices.find((price) => price.rentalUnit === unit)
    : null;
  return Number(rentalPrice?.unitPrice) || 0;
};

export const formatRouteEstimate = (routeEstimate, lang) => {
  if (!routeEstimate) return "";
  if (typeof routeEstimate === "string") return routeEstimate;
  if (typeof routeEstimate !== "object") return String(routeEstimate);

  const parts = [];
  const distance = Number(routeEstimate.totalDistanceKm);
  const estimatedDurationMinutes = Number(routeEstimate.estimatedDurationMinutes);
  const travelMinutes = Number.isFinite(estimatedDurationMinutes) && estimatedDurationMinutes > 0
    ? estimatedDurationMinutes
    : Number(routeEstimate.estimatedTravelMinutes);
  const chargeableDurationMinutes = Number(routeEstimate.chargeableDurationMinutes);
  const chargeableIsMinutes = Number.isFinite(chargeableDurationMinutes) && chargeableDurationMinutes > 0;
  const chargeableDurationValue = chargeableIsMinutes
    ? chargeableDurationMinutes
    : Number(routeEstimate.chargeableDurationValue);
  const rentalUnit = routeEstimate.rentalUnit;

  if (Number.isFinite(distance) && distance > 0) {
    parts.push(`${lang === "VN" ? "Quãng đường" : "Distance"}: ${distance.toFixed(1)} km`);
  }
  if (Number.isFinite(travelMinutes) && travelMinutes > 0) {
    parts.push(`${lang === "VN" ? "Thời gian di chuyển" : "Travel time"}: ${travelMinutes} ${lang === "VN" ? "phút" : "min"}`);
  }
  if (Number.isFinite(chargeableDurationValue) && chargeableDurationValue > 0) {
    parts.push(
      chargeableIsMinutes
        ? `${lang === "VN" ? "Thời lượng tính tiền" : "Chargeable duration"}: ${chargeableDurationValue} ${lang === "VN" ? "phút" : "min"}`
        : `${lang === "VN" ? "Thời lượng tính tiền" : "Chargeable duration"}: ${formatDuration(chargeableDurationValue, rentalUnit, lang)}`,
    );
  }

  return parts.join(" · ");
};

/** Normalize routeEstimate.legs with per-leg matched Route Master info (admin pricing). */
export const normalizeRouteEstimateLegs = (routeEstimate) => {
  const legs = Array.isArray(routeEstimate?.legs) ? routeEstimate.legs : [];
  return legs.map((leg, index) => {
    const distanceKmRaw = pick(leg, ["distanceKm", "totalDistanceKm"], null);
    const travelMinutesRaw = pick(leg, ["travelMinutes", "estimatedTravelMinutes", "estimatedDurationMinutes"], null);
    const distanceKm = distanceKmRaw === null || distanceKmRaw === undefined || distanceKmRaw === ""
      ? null
      : Number(distanceKmRaw);
    const travelMinutes = travelMinutesRaw === null || travelMinutesRaw === undefined || travelMinutesRaw === ""
      ? null
      : Number(travelMinutesRaw);

    return {
      legOrder: Number(pick(leg, ["legOrder", "order"], index + 1)) || index + 1,
      fromStationId: String(pick(leg, ["fromStationId", "fromStation.id"], "")),
      fromStationName: pick(leg, ["fromStationName", "fromStation.stationName", "fromStation.name"], ""),
      toStationId: String(pick(leg, ["toStationId", "toStation.id"], "")),
      toStationName: pick(leg, ["toStationName", "toStation.stationName", "toStation.name"], ""),
      distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
      travelMinutes: Number.isFinite(travelMinutes) ? travelMinutes : null,
      matchedRouteId: String(pick(leg, ["matchedRouteId", "routeId", "matchedRoute.routeId", "matchedRoute.id"], "") || ""),
      matchedRouteCode: pick(leg, ["matchedRouteCode", "routeCode", "matchedRoute.routeCode"], "") || "",
      matchedRouteName: pick(leg, ["matchedRouteName", "routeName", "matchedRoute.routeName", "matchedRoute.name"], "") || "",
    };
  });
};

export const formatMatchedRouteLabel = (legOrRoute) => {
  if (!legOrRoute) return "";
  const code = legOrRoute.matchedRouteCode || "";
  const name = legOrRoute.matchedRouteName || "";
  if (code && name) return `${code} - ${name}`;
  return code || name || legOrRoute.matchedRouteId || "";
};

export const hasMatchedRouteOnLeg = (leg) => Boolean(
  leg?.matchedRouteId || leg?.matchedRouteCode || leg?.matchedRouteName
);

/**
 * Top-level routeEstimate.matchedRoute* exists only when every leg shares the same Route Master.
 * Falls back to the single matched leg when there is exactly one.
 */
export const getMatchedRouteSummary = (routeEstimate, routeLegs = null) => {
  const legs = Array.isArray(routeLegs) ? routeLegs : normalizeRouteEstimateLegs(routeEstimate);
  const topLevel = {
    matchedRouteId: String(pick(routeEstimate, ["matchedRouteId", "routeId"], "") || ""),
    matchedRouteCode: pick(routeEstimate, ["matchedRouteCode", "routeCode"], "") || "",
    matchedRouteName: pick(routeEstimate, ["matchedRouteName", "routeName"], "") || "",
  };

  if (hasMatchedRouteOnLeg(topLevel)) {
    return { ...topLevel, source: "estimate" };
  }

  if (legs.length === 1 && hasMatchedRouteOnLeg(legs[0])) {
    return {
      matchedRouteId: legs[0].matchedRouteId,
      matchedRouteCode: legs[0].matchedRouteCode,
      matchedRouteName: legs[0].matchedRouteName,
      source: "leg",
    };
  }

  const matchedLegs = legs.filter(hasMatchedRouteOnLeg);
  if (matchedLegs.length > 1) {
    const firstId = matchedLegs[0].matchedRouteId || matchedLegs[0].matchedRouteCode;
    const allSame = matchedLegs.every((leg) => (
      (leg.matchedRouteId && leg.matchedRouteId === matchedLegs[0].matchedRouteId)
      || (leg.matchedRouteCode && leg.matchedRouteCode === matchedLegs[0].matchedRouteCode)
    ));
    if (allSame && firstId) {
      return {
        matchedRouteId: matchedLegs[0].matchedRouteId,
        matchedRouteCode: matchedLegs[0].matchedRouteCode,
        matchedRouteName: matchedLegs[0].matchedRouteName,
        source: "legs-same",
      };
    }
  }

  return {
    matchedRouteId: "",
    matchedRouteCode: "",
    matchedRouteName: "",
    source: "none",
  };
};

/** Read BE routeEstimate completeness flags (with numeric / legs fallback). */
export const getRouteEstimateCompleteness = (routeEstimate) => {
  if (!routeEstimate || typeof routeEstimate !== "object") {
    return {
      hasDistance: false,
      hasTravelTime: false,
      isComplete: false,
      unmatchedRouteLegs: [],
      incompleteMetricLegs: [],
    };
  }

  const legs = normalizeRouteEstimateLegs(routeEstimate);
  const unmatchedRouteLegs = legs.filter((leg) => !hasMatchedRouteOnLeg(leg));
  const incompleteMetricLegs = legs.filter((leg) => leg.distanceKm == null || leg.travelMinutes == null);

  const hasDistanceFlag = routeEstimate.hasCompleteDistanceEstimate;
  const hasTravelTimeFlag = routeEstimate.hasCompleteTravelTimeEstimate;
  const distance = Number(routeEstimate.totalDistanceKm);
  const estimatedDurationMinutes = Number(routeEstimate.estimatedDurationMinutes);
  const travelMinutes = Number(routeEstimate.estimatedTravelMinutes);

  const hasDistance = typeof hasDistanceFlag === "boolean"
    ? hasDistanceFlag
    : legs.length > 0
      ? legs.every((leg) => leg.distanceKm != null)
      : Number.isFinite(distance) && distance > 0;
  const hasTravelTime = typeof hasTravelTimeFlag === "boolean"
    ? hasTravelTimeFlag
    : legs.length > 0
      ? legs.every((leg) => leg.travelMinutes != null)
      : (
        (Number.isFinite(estimatedDurationMinutes) && estimatedDurationMinutes > 0)
        || (Number.isFinite(travelMinutes) && travelMinutes > 0)
      );

  // Valid charter estimate requires BE complete flags AND every leg matched to Route Master.
  const topLevelMatched = hasMatchedRouteOnLeg({
    matchedRouteId: pick(routeEstimate, ["matchedRouteId"], ""),
    matchedRouteCode: pick(routeEstimate, ["matchedRouteCode"], ""),
    matchedRouteName: pick(routeEstimate, ["matchedRouteName"], ""),
  });
  const allLegsMatched = legs.length > 0
    ? unmatchedRouteLegs.length === 0
    : topLevelMatched;

  return {
    hasDistance: hasDistance && allLegsMatched,
    hasTravelTime: hasTravelTime && allLegsMatched,
    unmatchedRouteLegs,
    incompleteMetricLegs,
    unmatchedLegs: unmatchedRouteLegs,
    hasRawDistance: hasDistance,
    hasRawTravelTime: hasTravelTime,
    allLegsMatched,
    isComplete: hasDistance && hasTravelTime && allLegsMatched,
  };
};

/** True when booking has enough route data for BE to calculate a quote. */
export const hasCharterRouteForPricing = (booking) => {
  if (!booking?.fromStationId || !booking?.toStationId) return false;
  return getRouteEstimateCompleteness(booking.routeEstimate).isComplete;
};

export const getCharterRoutePricingWarning = (booking, lang = "VN") => {
  if (!booking?.fromStationId) {
    return lang === "VN"
      ? "Thiếu bến đón khách. Yêu cầu khách cập nhật yêu cầu — không sửa lộ trình khi chốt giá."
      : "Pickup station is missing. Ask the customer to update the request — do not change the route while quoting.";
  }
  if (!booking?.toStationId) {
    return lang === "VN"
      ? "Thiếu bến trả khách. Yêu cầu khách cập nhật yêu cầu — không sửa lộ trình khi chốt giá."
      : "Drop-off station is missing. Ask the customer to update the request — do not change the route while quoting.";
  }

  const completeness = getRouteEstimateCompleteness(booking.routeEstimate);
  if (completeness.isComplete) return "";

  if (!completeness.allLegsMatched || completeness.unmatchedRouteLegs?.length > 0) {
    return lang === "VN"
      ? "Chưa có ước tính lộ trình hợp lệ vì chưa match Route Master. Vui lòng cấu hình Route Master trước khi chốt giá."
      : "No valid route estimate because Route Master is not matched. Configure Route Master before quoting.";
  }

  const missing = [];
  if (!completeness.hasRawDistance) {
    missing.push(lang === "VN" ? "quãng đường" : "distance");
  }
  if (!completeness.hasRawTravelTime) {
    missing.push(lang === "VN" ? "thời gian di chuyển" : "travel time");
  }

  return lang === "VN"
    ? `Chưa có ước tính lộ trình (thiếu ${missing.join(" / ")}). Kiểm tra tọa độ bến / GeoJSON hoặc nhờ khách đổi bến.`
    : `No route estimate yet (missing ${missing.join(" / ")}). Check station coordinates / GeoJSON or ask the customer to change stations.`;
};

export const isCharterRoutePricingBlocked = (booking) => {
  if (!booking?.fromStationId || !booking?.toStationId) return true;
  return !getRouteEstimateCompleteness(booking.routeEstimate).isComplete;
};

export const normalizeItineraryStops = (item) => {
  const stops = pick(item, ["itineraryStops"], []);
  if (!Array.isArray(stops)) return [];
  return stops.map((stop, index) => ({
    stationId: String(pick(stop, ["stationId", "station.id", "station.stationId"], "")),
    stationName: pick(stop, ["stationName", "station.stationName", "station.name"], ""),
    stopOrder: Number(pick(stop, ["stopOrder"], index + 1)) || index + 1,
    stayDurationMinutes: Number(pick(stop, ["stayDurationMinutes"], 0)) || 0,
    note: pick(stop, ["note"], ""),
  }));
};

export const normalizeRequestedBoats = (item, selectedBoats = []) => {
  const requestedBoats = pick(item, ["requestedBoats"], []);
  const requestedBoatCount = Number(pick(item, ["requestedBoatCount"], 0));
  const source = Array.isArray(requestedBoats) && requestedBoats.length > 0
    ? requestedBoats
    : Array.from({ length: requestedBoatCount || Math.max(selectedBoats.length, 1) }, (_, index) => ({ boatOrder: index + 1 }));

  return source.map((boat, index) => ({
    boatOrder: Number(pick(boat, ["boatOrder", "order"], index + 1)) || index + 1,
    requiredNumberOfDecks: getRequestedDeckCount(boat),
    requiredSeatSetupType: pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], ""),
  }));
};

export const buildQuoteBoatRows = (booking) => {
  const selectedBoats = Array.isArray(booking?.selectedBoats) ? booking.selectedBoats : [];
  const requestedBoats = normalizeRequestedBoats(booking, selectedBoats);

  return requestedBoats.map((requestedBoat, index) => {
    const selectedBoat = selectedBoats.find((boat) =>
      Number(pick(boat, ["boatOrder", "order"], index + 1)) === requestedBoat.boatOrder
    ) || selectedBoats[index];

    return {
      boatOrder: requestedBoat.boatOrder,
      requiredNumberOfDecks: requestedBoat.requiredNumberOfDecks,
      requiredSeatSetupType: requestedBoat.requiredSeatSetupType,
      boatId: getBoatId(selectedBoat) || (requestedBoats.length === 1 && booking?.boatId ? booking.boatId : ""),
    };
  });
};

export const buildQuoteFormFromBooking = (booking) => {
  const requestedUnit = pick(booking, ["rentalUnit"], "");
  const estimateUnit = pick(booking?.routeEstimate, ["rentalUnit"], "");
  const rentalUnit = requestedUnit === "Day" || requestedUnit === "Hour"
    ? requestedUnit
    : (estimateUnit === "Day" || estimateUnit === "Hour" ? estimateUnit : "Hour");

  return {
    rentalUnit,
    boats: buildQuoteBoatRows(booking),
  };
};

export const resolveQuoteDepositAmount = (quotePreview) => {
  const total = Number(pick(quotePreview, ["totalAmount", "finalAmount"], 0)) || 0;
  return getCharterDepositAmount(total, 0) || null;
};

/** Duration gửi kèm chốt giá — lấy từ routeEstimate khi khách không còn nhập duration. */
export const resolveQuoteDurationValue = (booking, rentalUnit = "Hour") => {
  const estimate = booking?.routeEstimate;
  const bookingDuration = Number(booking?.durationValue) || 0;

  if (rentalUnit === "Day") {
    const dayValue = Number(estimate?.chargeableDurationValue) || bookingDuration || 1;
    return Math.max(1, Math.round(dayValue));
  }

  const chargeableMinutes = Number(estimate?.chargeableDurationMinutes);
  if (Number.isFinite(chargeableMinutes) && chargeableMinutes > 0) {
    return Math.max(1, Math.ceil(chargeableMinutes / 60));
  }

  const hourValue = Number(estimate?.chargeableDurationValue) || bookingDuration || 1;
  return Math.max(1, Math.round(hourValue));
};

export const normalizeBooking = (item) => {
  const adultCount = Number(pick(item, ["adultCount"], 0));
  const childCount = Number(pick(item, ["childCount"], 0));
  const passengerCount = Number(pick(item, ["passengerCount"], adultCount + childCount));
  const fromName = pick(item, ["fromStationName", "fromStation.stationName", "fromStation.name"]);
  const toName = pick(item, ["toStationName", "toStation.stationName", "toStation.name"]);
  const routeEstimate = pick(item, ["routeEstimate"], null);
  const routeLegs = normalizeRouteEstimateLegs(routeEstimate);
  const matchedSummary = getMatchedRouteSummary(routeEstimate, routeLegs);
  const matchedRouteId = String(pick(item, [
    "matchedRouteId",
    "routeId",
    "matchedRoute.routeId",
    "matchedRoute.id",
    "route.routeId",
    "route.id",
  ], "") || matchedSummary.matchedRouteId || "");
  const matchedRouteCode = pick(item, [
    "matchedRouteCode",
    "routeCode",
    "matchedRoute.routeCode",
    "route.routeCode",
  ], "") || matchedSummary.matchedRouteCode || "";
  const matchedRouteName = pick(item, [
    "matchedRouteName",
    "routeName",
    "matchedRoute.routeName",
    "route.routeName",
    "route.name",
  ], "") || matchedSummary.matchedRouteName || "";
  const route = matchedRouteName
    || pick(item, ["route", "itineraryName"], "")
    || (fromName || toName ? `${fromName || "--"} - ${toName || "--"}` : "--");

  return {
    raw: item,
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
    customerName: pick(item, ["customerName", "contactName", "fullName", "user.fullName", "customer.fullName"], "--"),
    phone: pick(item, ["contactPhone", "phoneNumber", "phone", "customerPhone", "user.phoneNumber", "customer.phoneNumber"], "--"),
    email: pick(item, ["contactEmail", "email", "customerEmail", "user.email", "customer.email"], "--"),
    boatId: pick(item, ["boatId", "boat.id"]),
    boatName: pick(item, ["boatName", "boat.name"], "--"),
    requestedBoatCount: Number(pick(item, ["requestedBoatCount"], 0)),
    requestedBoats: pick(item, ["requestedBoats"], []),
    selectedBoats: pick(item, ["selectedBoats"], []),
    route,
    matchedRouteId,
    matchedRouteCode,
    matchedRouteName,
    routeLegs,
    fromStationId: String(pick(item, ["fromStationId", "fromStation.id", "fromStation.stationId"], "")),
    fromStationName: fromName || "",
    toStationId: String(pick(item, ["toStationId", "toStation.id", "toStation.stationId"], "")),
    toStationName: toName || "",
    departureDate: pick(item, ["departureDate", "startDate"]),
    startTime: pick(item, ["startTime"], "--"),
    itineraryStops: normalizeItineraryStops(item),
    routeEstimate,
    rentalUnit: pick(item, ["rentalUnit"], "Day"),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 1)),
    adultCount,
    childCount,
    passengerCount,
    status: pick(item, ["bookingStatus", "status"], "PendingQuote"),
    paymentStatus: pick(item, ["paymentStatus"], "--"),
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
    bookingHoldExpiresAt: pick(item, ["bookingHoldExpiresAt"], ""),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: Number(pick(item, ["depositAmount"], 0)),
    promotionCode: pick(item, ["promotionCode"], ""),
    specialRequests: pick(item, ["specialRequests"], ""),
    note: pick(item, ["specialRequests"], "--"),
    insuranceSelected: resolveInsuranceSelected(item),
    insurancePackageId: getBookingInsurancePackageId(item),
    insurance: normalizeInsuranceFromBooking(item) || pick(item, ["insurance"], null),
    qrToken: pick(item, ["charterBookingQrToken", "qrToken"], ""),
    passengers: Array.isArray(item?.passengers) ? item.passengers : [],
    tickets: normalizeCharterTicketRows(item, {
      adultCount,
      passengerCount,
      contactName: pick(item, ["contactName", "customerName", "fullName"], ""),
    }),
    payments: pick(item, ["payments"], []),
    createdAt: pick(item, ["createdAt", "createdDate"]),
    assignedManagerId: String(pick(item, ["assignedManagerId", "managerUserId", "assignedManager.id", "assignedManager.userId"], "")),
    assignedManagerName: pick(item, ["assignedManagerName", "assignedManager.fullName", "assignedManager.name"], ""),
  };
};
