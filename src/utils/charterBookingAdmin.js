import { normalizeCharterTicketRows } from "./charterBookingTickets";
import { getCharterDepositAmount } from "./charterBookingActions";

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
  const travelMinutes = Number(routeEstimate.estimatedTravelMinutes);
  const chargeableDurationValue = Number(routeEstimate.chargeableDurationValue);
  const rentalUnit = routeEstimate.rentalUnit;

  if (Number.isFinite(distance) && distance > 0) {
    parts.push(`${lang === "VN" ? "Quãng đường" : "Distance"}: ${distance.toFixed(1)} km`);
  }
  if (Number.isFinite(travelMinutes) && travelMinutes > 0) {
    parts.push(`${lang === "VN" ? "Thời gian di chuyển" : "Travel time"}: ${travelMinutes} ${lang === "VN" ? "phút" : "min"}`);
  }
  if (Number.isFinite(chargeableDurationValue) && chargeableDurationValue > 0) {
    parts.push(`${lang === "VN" ? "Thời lượng tính tiền" : "Chargeable duration"}: ${formatDuration(chargeableDurationValue, rentalUnit, lang)}`);
  }

  return parts.join(" · ");
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

export const buildQuoteFormFromBooking = (booking) => ({
  boats: buildQuoteBoatRows(booking),
  rentalUnit: booking?.rentalUnit || "Day",
  durationValue: booking?.durationValue || 1,
  promotionCode: booking?.promotionCode || "",
});

export const resolveQuoteDepositAmount = (quotePreview) => {
  const total = Number(pick(quotePreview, ["totalAmount", "finalAmount"], 0)) || 0;
  return getCharterDepositAmount(total, 0) || null;
};

export const normalizeBooking = (item) => {
  const adultCount = Number(pick(item, ["adultCount"], 0));
  const childCount = Number(pick(item, ["childCount"], 0));
  const passengerCount = Number(pick(item, ["passengerCount"], adultCount + childCount));
  const fromName = pick(item, ["fromStationName", "fromStation.stationName", "fromStation.name"]);
  const toName = pick(item, ["toStationName", "toStation.stationName", "toStation.name"]);
  const route = pick(item, ["routeName", "route", "itineraryName"], fromName || toName ? `${fromName || "--"} - ${toName || "--"}` : "--");

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
    departureDate: pick(item, ["departureDate", "startDate"]),
    startTime: pick(item, ["startTime"], "--"),
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
    staffAssignments: Array.isArray(item?.staffAssignments) ? item.staffAssignments : [],
  };
};
