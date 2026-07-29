import { normalizeCharterTicketRows } from "./charterBookingTickets";
import { getCharterDepositAmount } from "./charterBookingActions";
import { getBookingInsurancePackageId, normalizeInsuranceFromBooking, resolveInsuranceSelected } from "./insurancePreview";
import { resolveRouteLabelKey } from "./routeTypes";

export const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired"];
export const manualStatusOptions = ["Cancelled", "Expired", "Completed"];

/** Filter Cancelled gồm cả booking status Refunded (UI gộp thành Đã hủy). */
export const matchesCharterStatusFilter = (bookingStatus, statusFilter) => {
  if (!statusFilter || statusFilter === "All") return true;
  const status = String(bookingStatus || "");
  if (statusFilter === "Cancelled") {
    return status === "Cancelled" || status === "Refunded";
  }
  return status === statusFilter;
};
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

/** Trạng thái booking đang giữ tàu (không cho gán trùng cùng ngày/giờ). */
export const CHARTER_BOAT_HOLDING_STATUSES = new Set([
  "Quoted",
  "PendingPayment",
  "Confirmed",
]);

export const normalizeCharterScheduleDate = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const vnMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vnMatch) {
    return `${vnMatch[3]}-${String(vnMatch[2]).padStart(2, "0")}-${String(vnMatch[1]).padStart(2, "0")}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeCharterScheduleTime = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object") {
    const hours = Number(value.hours ?? value.Hours ?? value.hour);
    const minutes = Number(value.minutes ?? value.Minutes ?? value.minute);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  const text = String(value).trim();
  if (!text || text === "--") return "";
  // .NET TimeSpan may be "1.09:30:00" (days.hours:minutes:seconds) or "09:30:00".
  const withDays = text.match(/(?:(\d+)\.)?(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!withDays) return "";
  return `${String(Number(withDays[2])).padStart(2, "0")}:${withDays[3]}`;
};

export const getAssignedBoatIdsFromBooking = (booking) => {
  const ids = new Set();
  const push = (value) => {
    const id = String(value || "").trim();
    if (id) ids.add(id);
  };

  push(booking?.boatId);
  push(pick(booking, ["boat.id", "assignedBoatId", "primaryBoatId"], ""));

  const collections = [
    booking?.selectedBoats,
    booking?.quoteBoats,
    booking?.assignedBoats,
    booking?.boats,
    booking?.charterBoats,
    booking?.quoteBreakdown?.boats,
    booking?.pricing?.boats,
  ];

  collections.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((boat) => {
      push(getBoatId(boat));
      push(pick(boat, ["boat.id", "id", "boatId"], ""));
    });
  });

  (Array.isArray(booking?.boatIds) ? booking.boatIds : []).forEach(push);

  return [...ids];
};

/** TripId đã gắn từ booking / charter boats (sau khi Admin tạo trip). */
export const getCharterBookingLinkedTripIds = (booking) => {
  const ids = new Set();
  const push = (value) => {
    const id = String(value || "").trim();
    if (id) ids.add(id);
  };

  push(booking?.tripId);
  push(pick(booking, ["sourceTripId", "charterTripId"], ""));
  (Array.isArray(booking?.tripIds) ? booking.tripIds : []).forEach(push);

  const tripCollections = [
    booking?.trips,
    booking?.charterTrips,
    booking?.linkedTrips,
  ];
  tripCollections.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((trip) => {
      push(pick(trip, ["tripId", "id", "TripId"], ""));
    });
  });

  const boatCollections = [
    booking?.selectedBoats,
    booking?.quoteBoats,
    booking?.assignedBoats,
    booking?.boats,
    booking?.charterBoats,
  ];
  boatCollections.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((boat) => {
      push(pick(boat, ["tripId", "TripId", "trip.id"], ""));
    });
  });

  return [...ids];
};

/** Lấy tripId từ response POST .../trip (nhiều shape BE). */
export const extractTripIdsFromCharterTripCreateResponse = (payload) => {
  const ids = new Set();
  const push = (value) => {
    const id = String(value || "").trim();
    if (id) ids.add(id);
  };

  if (!payload || typeof payload !== "object") return [];

  push(payload.tripId);
  push(payload.id);
  (Array.isArray(payload.tripIds) ? payload.tripIds : []).forEach(push);
  (Array.isArray(payload.trips) ? payload.trips : []).forEach((trip) => {
    push(pick(trip, ["tripId", "id", "TripId"], ""));
  });
  (Array.isArray(payload.charterBoats) ? payload.charterBoats : []).forEach((boat) => {
    push(pick(boat, ["tripId", "TripId", "trip.id"], ""));
  });
  (Array.isArray(payload.boats) ? payload.boats : []).forEach((boat) => {
    push(pick(boat, ["tripId", "TripId", "trip.id"], ""));
  });
  if (payload.data && typeof payload.data === "object") {
    extractTripIdsFromCharterTripCreateResponse(payload.data).forEach(push);
  }

  return [...ids];
};

/**
 * Điều kiện FE để bật nút Tạo chuyến (BE vẫn là nguồn xác thực cuối).
 * Không yêu cầu GPS / gần giờ khởi hành.
 */
export const evaluateCharterTripCreateGate = (booking, {
  otherBookings = [],
  lang = "VN",
} = {}) => {
  const reasons = [];
  const status = String(booking?.status || "");
  const departureDate = booking?.departureDate;
  const boatIds = getAssignedBoatIdsFromBooking(booking);
  const tripIds = getCharterBookingLinkedTripIds(booking);
  const hasStartTime = Boolean(normalizeCharterScheduleTime(booking?.startTime));

  if (status !== "Confirmed") {
    reasons.push(lang === "VN"
      ? "Booking phải ở trạng thái Confirmed (đã thanh toán / xác nhận)."
      : "Booking must be Confirmed (paid / confirmed).");
  }

  if (!normalizeCharterScheduleDate(departureDate)) {
    reasons.push(lang === "VN"
      ? "Chưa có ngày khởi hành."
      : "Departure date is missing.");
  }

  if (boatIds.length === 0) {
    reasons.push(lang === "VN"
      ? "Chưa chốt tàu trong báo giá."
      : "No boats locked in the quote yet.");
  }

  if (tripIds.length > 0) {
    reasons.push(lang === "VN"
      ? "Booking đã có trip — không tạo lại."
      : "Trips already exist for this booking.");
  }

  let conflicts = [];
  if (boatIds.length > 0 && normalizeCharterScheduleDate(departureDate)) {
    conflicts = findCharterBoatScheduleConflicts({
      currentBookingId: booking?.id,
      departureDate,
      startTime: booking?.startTime,
      boatIds,
      otherBookings,
      matchMode: hasStartTime ? "datetime" : "day",
    });
    if (conflicts.length > 0) {
      reasons.push(getCharterBoatScheduleConflictMessage(conflicts, lang));
    }
  }

  return {
    canCreate: reasons.length === 0,
    reasons,
    boatIds,
    tripIds,
    conflicts,
  };
};

/**
 * BE giữ tàu theo ngày khởi hành ("trong ngày này") — mặc định matchMode = "day".
 * matchMode "datetime" chỉ dùng khi cần lọc đúng cả giờ.
 */
export const findCharterBoatScheduleConflicts = ({
  currentBookingId,
  departureDate,
  startTime,
  boatIds = [],
  otherBookings = [],
  matchMode = "day",
} = {}) => {
  const dateKey = normalizeCharterScheduleDate(departureDate);
  const timeKey = normalizeCharterScheduleTime(startTime);
  const targetBoatIds = [...new Set(
    (Array.isArray(boatIds) ? boatIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  )];

  if (!dateKey || targetBoatIds.length === 0) return [];
  if (matchMode === "datetime" && !timeKey) return [];

  const conflicts = [];
  for (const other of otherBookings) {
    if (!other) continue;
    if (String(other.id || "") === String(currentBookingId || "")) continue;
    if (!CHARTER_BOAT_HOLDING_STATUSES.has(String(other.status || ""))) continue;
    if (normalizeCharterScheduleDate(other.departureDate) !== dateKey) continue;
    if (
      matchMode === "datetime"
      && normalizeCharterScheduleTime(other.startTime) !== timeKey
    ) {
      continue;
    }

    const otherBoatIds = getAssignedBoatIdsFromBooking(other);
    targetBoatIds.forEach((boatId) => {
      if (otherBoatIds.includes(boatId)) {
        conflicts.push({
          boatId,
          bookingId: other.id,
          bookingCode: other.bookingCode || "--",
          status: other.status,
        });
      }
    });
  }

  return conflicts;
};

/** Collect occupied boat ids for a departure date (BE same-day hold). */
export const collectOccupiedBoatIdsForSchedule = ({
  currentBookingId,
  departureDate,
  startTime,
  otherBookings = [],
  matchMode = "day",
} = {}) => {
  const dateKey = normalizeCharterScheduleDate(departureDate);
  if (!dateKey) return [];

  const occupied = new Set();
  (Array.isArray(otherBookings) ? otherBookings : []).forEach((other) => {
    if (!other) return;
    if (String(other.id || "") === String(currentBookingId || "")) return;
    if (!CHARTER_BOAT_HOLDING_STATUSES.has(String(other.status || ""))) return;
    if (normalizeCharterScheduleDate(other.departureDate) !== dateKey) return;
    if (
      matchMode === "datetime"
      && normalizeCharterScheduleTime(startTime)
      && normalizeCharterScheduleTime(other.startTime) !== normalizeCharterScheduleTime(startTime)
    ) {
      return;
    }
    getAssignedBoatIdsFromBooking(other).forEach((boatId) => occupied.add(boatId));
  });
  return [...occupied];
};

export const getCharterBoatScheduleConflictMessage = (conflicts = [], lang = "VN", boats = []) => {
  const first = conflicts[0];
  if (!first) {
    return lang === "VN"
      ? "Đã có tàu đặt cho đơn khác trong ngày này. Vui lòng chọn tàu khác."
      : "A boat is already booked for another request on this day. Please choose another boat.";
  }

  const boat = (Array.isArray(boats) ? boats : []).find((item) => getBoatId(item) === first.boatId);
  const boatLabel = boat
    ? (pick(boat, ["code", "boatCode", "name", "boatName"], first.boatId) || first.boatId)
    : first.boatId;

  if (lang === "VN") {
    return `Tàu ${boatLabel} đã được giữ cho đơn ${first.bookingCode} trong ngày này. Vui lòng chọn tàu khác.`;
  }
  return `Boat ${boatLabel} is already held by booking ${first.bookingCode} on this day. Please choose another boat.`;
};

export const isCharterBoatScheduleConflictError = (errorOrMessage) => {
  const message = String(
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : (errorOrMessage?.response?.data?.message
        || errorOrMessage?.response?.data?.detail
        || errorOrMessage?.message
        || ""),
  ).toLowerCase();

  if (!message) return false;
  return (
    message.includes("đã có tàu")
    || message.includes("đã có chuyến")
    || message.includes("đã được đặt")
    || message.includes("đã được giữ")
    || message.includes("giữ cho booking")
    || message.includes("trong ngày này")
    || message.includes("chon tàu khác")
    || message.includes("chọn tàu khác")
    || message.includes("trùng")
    || message.includes("overlap")
    || message.includes("overlapping")
    || message.includes("already booked")
    || message.includes("already assigned")
    || message.includes("already held")
    || message.includes("boat conflict")
    || message.includes("schedule conflict")
    || message.includes("boat busy")
    || message.includes("insufficient turnaround")
    || (message.includes("boat") && message.includes("conflict"))
    || (message.includes("trip") && (message.includes("conflict") || message.includes("overlap")))
  );
};

export const extractCharterBookingList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};
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
  const normalized = String(status || "").toLowerCase().replace(/[_-\s]/g, "");
  switch (normalized) {
    case "unpaid":
      return { label: lang === "VN" ? "Chưa thanh toán" : "Unpaid", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" };
    case "pending":
    case "pendingpayment":
      return { label: lang === "VN" ? "Chờ thanh toán" : "Pending", classes: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20" };
    case "paid":
      return { label: lang === "VN" ? "Đã thanh toán" : "Paid", classes: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" };
    case "depositpaid":
      return { label: lang === "VN" ? "Đã đặt cọc" : "Deposit Paid", classes: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20" };
    case "refunded":
    case "manualrefunded":
      return { label: lang === "VN" ? "Đã hoàn tiền" : "Refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" };
    case "partiallyrefunded":
      return { label: lang === "VN" ? "Hoàn tiền một phần" : "Partially refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" };
    case "refundpending":
    case "refundprocessing":
      return { label: lang === "VN" ? "Đang hoàn tiền" : "Refund Processing", classes: "bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20" };
    case "refundfailed":
      return { label: lang === "VN" ? "Hoàn tiền lỗi" : "Refund Failed", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    case "failed":
      return { label: lang === "VN" ? "Thanh toán thất bại" : "Failed", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    case "cancelled":
    case "canceled":
      return { label: lang === "VN" ? "Đã hủy" : "Cancelled", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20" };
    case "":
    case "--":
    case "null":
    case "undefined":
      return { label: lang === "VN" ? "—" : "—", classes: "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700" };
    default:
      // Không hiện raw enum (RefundPending…) — tránh chữ khó hiểu khi data chưa ổn.
      return { label: lang === "VN" ? "—" : "—", classes: "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700" };
  }
};
export const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;
export const getRefundAmount = (payment) =>
  Number(pick(payment, [
    "refundAmount",
    "refundedAmount",
    "refund.amount",
    "refundAmountVnd",
    "RefundAmount",
    "RefundedAmount",
  ], 0)) || 0;
export const getRefundRequestedAmount = (payment) =>
  Number(pick(payment, ["refundRequestedAmount", "refund.requestedAmount", "refund.refundRequestedAmount"], 0)) || 0;
export const getRefundStatus = (payment) =>
  pick(payment, [
    "refundStatus",
    "RefundStatus",
    "refund.status",
    "refund.Status",
    "refundPaymentStatus",
    "refundState",
    "refundResult",
    "payoutStatus",
    "payosRefundStatus",
  ], "");
export const getRefundMethod = (payment) =>
  pick(payment, ["refundMethod", "refund.method", "RefundMethod"], "");
export const getRefundReferenceId = (payment) =>
  pick(payment, ["refundReferenceId", "refund.referenceId", "refund.refundReferenceId", "payoutId", "RefundReferenceId"], "");
export const getRefundMessage = (payment) =>
  pick(payment, ["refundMessage", "refund.message", "refundError", "refund.error", "refundFailureReason", "refund.reason", "RefundMessage"], "");
export const getRefundBankValue = (payment, booking, keys) =>
  pick(payment, keys, pick(booking?.raw, keys, pick(booking, keys, "")));

const PAYMENT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Internal payment UUID only — never PayOS paymentLinkId / orderCode. */
export const isPaymentUuid = (value) => PAYMENT_UUID_PATTERN.test(String(value || "").trim());

/** Lấy danh sách payment từ nhiều hình dạng DTO list/detail. */
export const collectCharterPayments = (item) => {
  if (!item || typeof item !== "object") return [];
  const candidates = [
    item.payments,
    item.Payments,
    item.paymentList,
    item.paymentHistory,
    item.latestPayments,
  ];
  for (const list of candidates) {
    if (Array.isArray(list)) return list;
  }
  const single = item.payment || item.latestPayment || item.Payment || item.LatestPayment;
  return single && typeof single === "object" ? [single] : [];
};

const COMPLETED_REFUND_STATUSES = new Set([
  "success",
  "succeeded",
  "completed",
  "refunded",
  "manualrefunded",
  "manual_refunded",
]);

/** Booking/payment đã hoàn xong (kể cả BE vẫn để PaymentStatus = Paid). */
export const isRefundDone = (payment) => {
  if (!payment || typeof payment !== "object") return false;
  const paymentStatus = String(pick(payment, ["paymentStatus", "PaymentStatus", "status"], "")).toLowerCase().replace(/[_-\s]/g, "");
  const refundStatus = String(getRefundStatus(payment) || "").toLowerCase().replace(/[_-\s]/g, "");
  if (paymentStatus === "refunded" || paymentStatus === "manualrefunded") return true;
  if (COMPLETED_REFUND_STATUSES.has(refundStatus)) return true;
  // Một số list DTO chỉ có số tiền đã hoàn, không có refundStatus.
  const refunded = getRefundAmount(payment);
  if (refunded > 0 && !["pending", "processing", "requested", "created", "failed", "error", "cancelled", "rejected"].includes(refundStatus)) {
    return true;
  }
  return false;
};

export const hasCompletedCharterRefund = (item) => {
  if (!item || typeof item !== "object") return false;
  const topPayment = String(pick(item, ["paymentStatus", "PaymentStatus"], "") || "").toLowerCase().replace(/[_-\s]/g, "");
  if (["refunded", "manualrefunded", "partiallyrefunded"].includes(topPayment)) return true;

  const topRefund = String(pick(item, [
    "refundStatus",
    "RefundStatus",
    "latestRefundStatus",
    "paymentRefundStatus",
  ], "") || "").toLowerCase().replace(/[_-\s]/g, "");
  if (COMPLETED_REFUND_STATUSES.has(topRefund)) return true;

  const topRefundedAmount = Number(pick(item, [
    "refundedAmount",
    "totalRefundedAmount",
    "refundAmount",
    "RefundedAmount",
    "TotalRefundedAmount",
  ], 0)) || 0;
  if (topRefundedAmount > 0) return true;

  if (pick(item, ["isRefunded", "hasRefunded", "refunded"], false) === true) return true;

  return collectCharterPayments(item).some((payment) => isRefundDone(payment));
};

/** Ưu tiên Cancelled/Refunded nếu BE trả lệch giữa bookingStatus và status. */
export const resolveCharterBookingStatus = (item) => {
  const candidates = [
    pick(item, ["bookingStatus", "BookingStatus"], ""),
    pick(item, ["status", "Status"], ""),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const lowered = candidates.map((value) => value.toLowerCase().replace(/[_-\s]/g, ""));
  if (lowered.some((value) => ["cancelled", "canceled", "cancel"].includes(value))) return "Cancelled";
  if (lowered.some((value) => value === "refunded")) return "Cancelled";
  if (lowered.some((value) => value === "expired")) return "Expired";
  if (lowered.some((value) => value === "completed")) return "Completed";

  // BE đôi khi giữ Confirmed/Paid dù đã hoàn tiền → FE map sang Đã hủy.
  if (hasCompletedCharterRefund(item)) return "Cancelled";

  return pick(item, ["bookingStatus", "BookingStatus", "status", "Status"], "PendingQuote") || "PendingQuote";
};

/** Ưu tiên trạng thái hoàn tiền từ payments[] nếu top-level còn Paid. */
export const resolveCharterPaymentStatus = (item) => {
  const top = String(pick(item, ["paymentStatus", "PaymentStatus"], "") || "").trim();
  const payments = collectCharterPayments(item);
  const paymentStatuses = payments
    .map((payment) => String(pick(payment, ["paymentStatus", "PaymentStatus"], "") || "").trim().toLowerCase())
    .filter(Boolean);

  const has = (...keys) => {
    const set = new Set(paymentStatuses);
    return keys.some((key) => set.has(key) || String(top || "").toLowerCase() === key);
  };

  if (hasCompletedCharterRefund(item) || has("refunded", "manualrefunded", "manual_refunded")) {
    return "Refunded";
  }
  if (has("partiallyrefunded", "partially_refunded")) return "PartiallyRefunded";
  if (has("refundpending", "refund_pending", "refundprocessing", "refund_processing")) return "RefundPending";
  if (has("refundfailed", "refund_failed")) return "RefundFailed";
  if (top) return top;
  if (paymentStatuses.includes("paid")) return "Paid";
  if (paymentStatuses.includes("depositpaid")) return "DepositPaid";
  if (paymentStatuses.includes("pending")) return "Pending";
  return top || "--";
};
/**
 * Resolve id for POST /payments/{id}/refund|sync|manual-refund.
 * Prefer payment entity `id`, then `paymentId` — only if UUID.
 */
export const getRefundPaymentId = (payment) => {
  const candidates = [
    pick(payment, ["id"], ""),
    pick(payment, ["paymentId"], ""),
    pick(payment, ["payment.id"], ""),
    pick(payment, ["payment.paymentId"], ""),
  ];
  for (const value of candidates) {
    const trimmed = String(value || "").trim();
    if (isPaymentUuid(trimmed)) return trimmed;
  }
  return "";
};
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
  ["paid", "depositpaid", "success", "succeeded", "completed"].includes(String(pick(payment, ["paymentStatus", "PaymentStatus"], "")).toLowerCase());
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
  isRefundFailed(payment)
  && !isRefundDone(payment)
  && ["cancelled", "refunded"].includes(String(bookingStatus || "").toLowerCase());
export const hasRefundablePayment = (booking) =>
  collectCharterPayments(booking).some((payment) => (isPaidPayment(payment) || hasRefundableAmount(payment)) && !isRefundDone(payment));
export const paymentWaitsCustomerRefundInfo = (payment, bookingStatus) =>
  String(bookingStatus || "").toLowerCase() === "cancelled"
  && (isPaidPayment(payment) || hasRefundableAmount(payment))
  && !isRefundDone(payment)
  && !isRefundProcessing(payment)
  && !isRefundFailed(payment);
export const isActiveBoat = (boat) => String(pick(boat, ["status", "boatStatus", "boat.status"], "Active")).toLowerCase() === "active";

/** Tàu cứu hộ — không dùng cho charter quote / chọn tàu thuê. */
export const isRescueBoat = (boat) => {
  const service = String(pick(boat, ["serviceType", "ServiceType", "boat.serviceType"], "")).toLowerCase();
  if (service === "rescue") return true;

  const code = String(pick(boat, ["boatCode", "code", "boat.code", "name", "boatName"], "")).toUpperCase();
  return code.startsWith("SOS") || code.startsWith("RS_") || code.includes("CỨU HỘ") || code.includes("CUU HO");
};

/** Active Passenger boat — đủ điều kiện hiện trong dropdown chốt giá charter. */
export const isCharterSelectableBoat = (boat) => isActiveBoat(boat) && !isRescueBoat(boat);

/** Giá thuê chung theo số tầng + Hour/Day (policy admin), không còn giá riêng từng tàu. */
export const findRentalPolicyUnitPrice = (policies, numberOfDecks, rentalUnit) => {
  const decks = Number(numberOfDecks) || 0;
  const unit = String(rentalUnit || "Hour");
  if (decks <= 0) return 0;
  const list = Array.isArray(policies) ? policies : [];
  const match = list.find((policy) => (
    Number(policy.numberOfDecks) === decks
    && String(policy.rentalUnit) === unit
    && policy.isActive !== false
  ));
  return Number(match?.unitPrice) || 0;
};

export const getBoatPrice = (boat, unit, policies = []) =>
  findRentalPolicyUnitPrice(policies, getBoatDeckCount(boat), unit);

export const formatRouteEstimate = (routeEstimate, lang) => {
  if (!routeEstimate) return "";
  if (typeof routeEstimate === "string") return routeEstimate;
  if (typeof routeEstimate !== "object") return String(routeEstimate);

  const parts = [];
  const distance = Number(routeEstimate.totalDistanceKm);
  const travelMinutes = Number(
    Number.isFinite(Number(routeEstimate.estimatedTravelMinutes)) && Number(routeEstimate.estimatedTravelMinutes) > 0
      ? routeEstimate.estimatedTravelMinutes
      : routeEstimate.estimatedDurationMinutes,
  );
  const estimatedStayMinutes = Number(routeEstimate.estimatedStayMinutes);
  const chargeableStayMinutes = Number(routeEstimate.chargeableStayMinutes);
  const freeStayMinutes = Number(routeEstimate.freeStayMinutes);
  const bufferMinutes = Number(routeEstimate.estimatedBufferMinutes);
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
    parts.push(`${lang === "VN" ? "Di chuyển" : "Travel"}: ${travelMinutes} ${lang === "VN" ? "phút" : "min"}`);
  }
  if (Number.isFinite(estimatedStayMinutes) && estimatedStayMinutes > 0) {
    const freeLabel = Number.isFinite(freeStayMinutes) && freeStayMinutes > 0 ? freeStayMinutes : 30;
    parts.push(`${lang === "VN" ? "Dừng nghỉ" : "Stay"}: ${estimatedStayMinutes} ${lang === "VN" ? "phút" : "min"} (${lang === "VN" ? "miễn" : "free"} ${freeLabel})`);
  }
  if (Number.isFinite(chargeableStayMinutes) && chargeableStayMinutes > 0) {
    parts.push(`${lang === "VN" ? "Dừng tính phí" : "Billable stay"}: ${chargeableStayMinutes} ${lang === "VN" ? "phút" : "min"}`);
  }
  if (Number.isFinite(bufferMinutes) && bufferMinutes > 0) {
    parts.push(`${lang === "VN" ? "Buffer" : "Buffer"}: +${bufferMinutes} ${lang === "VN" ? "phút" : "min"}`);
  }
  if (Number.isFinite(chargeableDurationValue) && chargeableDurationValue > 0) {
    parts.push(
      chargeableIsMinutes
        ? `${lang === "VN" ? "Tính tiền" : "Chargeable"}: ${chargeableDurationValue} ${lang === "VN" ? "phút" : "min"}`
        : `${lang === "VN" ? "Tính tiền" : "Chargeable"}: ${formatDuration(chargeableDurationValue, rentalUnit, lang)}`,
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

/** True when booking has stations (quote still needs admin routePlan). */
export const hasCharterRouteStations = (booking) => Boolean(
  booking?.fromStationId && booking?.toStationId
);

/** @deprecated Prefer hasCharterRouteStations + isCharterRoutePlanComplete for quote. */
export const hasCharterRouteForPricing = (booking) => {
  if (!hasCharterRouteStations(booking)) return false;
  // After quote, BE returns selectedRoute — treat as priced.
  if (booking?.selectedRoute?.routeId || booking?.selectedRouteId) return true;
  return getRouteEstimateCompleteness(booking.routeEstimate).isComplete;
};

export const getRouteCandidateLegKey = (leg) => {
  const fromId = String(leg?.fromStationId || "").trim();
  const toId = String(leg?.toStationId || "").trim();
  if (fromId && toId) return `${fromId}|${toId}`;
  return `leg-${Number(leg?.legOrder) || 0}`;
};

export const normalizeRouteCandidateOption = (item) => {
  if (!item || typeof item !== "object") return null;
  const routeId = String(pick(item, ["routeId", "id", "route.id"], "") || "").trim();
  if (!routeId) return null;
  const distanceRaw = pick(item, ["distanceKm", "totalDistanceKm"], null);
  const durationRaw = pick(item, [
    "estimatedDurationMin",
    "estimatedDurationMinutes",
    "travelMinutes",
    "estimatedTravelMinutes",
  ], null);
  const distanceKm = distanceRaw === null || distanceRaw === undefined || distanceRaw === ""
    ? null
    : Number(distanceRaw);
  const estimatedDurationMin = durationRaw === null || durationRaw === undefined || durationRaw === ""
    ? null
    : Number(durationRaw);

  const routeType = pick(item, ["routeType", "type", "route.routeType"], "") || "";
  const routeLabel = pick(item, ["routeLabel", "route.label"], "") || "";
  const selectableRaw = pick(item, ["isSelectableForCharterQuote"], undefined);
  const generatedRaw = pick(item, ["isGeneratedForBooking"], undefined);

  return {
    routeId,
    routeCode: pick(item, ["routeCode", "code", "route.routeCode"], "") || "",
    routeName: pick(item, ["routeName", "name", "route.routeName", "route.name"], "") || "",
    routeType,
    routeLabel,
    status: pick(item, ["status", "routeStatus", "route.status"], "Active") || "Active",
    isSelectableForCharterQuote: selectableRaw === undefined ? undefined : Boolean(selectableRaw),
    isGeneratedForBooking: generatedRaw === undefined ? undefined : Boolean(generatedRaw),
    fromStationName: pick(item, ["fromStationName", "fromStation.stationName"], "") || "",
    toStationName: pick(item, ["toStationName", "toStation.stationName"], "") || "",
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
    estimatedDurationMin: Number.isFinite(estimatedDurationMin) ? estimatedDurationMin : null,
  };
};

/** Normalize GET .../route-candidates (array or { legs } / { routeCandidates }). */
export const normalizeRouteCandidateLegs = (payload, booking = null) => {
  const nested = payload?.data ?? payload;
  const rawLegs = Array.isArray(nested)
    ? nested
    : Array.isArray(nested?.legs)
      ? nested.legs
      : Array.isArray(nested?.routeCandidates)
        ? nested.routeCandidates
        : Array.isArray(nested?.items)
          ? nested.items
          : [];

  const fromBooking = Array.isArray(booking?.routeLegs) && booking.routeLegs.length > 0
    ? booking.routeLegs
    : normalizeRouteEstimateLegs(booking?.routeEstimate);

  const legs = rawLegs.length > 0
    ? rawLegs.map((leg, index) => {
      const candidatesRaw = Array.isArray(leg?.candidates)
        ? leg.candidates
        : Array.isArray(leg?.routes)
          ? leg.routes
          : Array.isArray(leg?.options)
            ? leg.options
            : [];
      return {
        legOrder: Number(pick(leg, ["legOrder", "order"], index + 1)) || index + 1,
        fromStationId: String(pick(leg, ["fromStationId", "fromStation.id"], "") || ""),
        fromStationName: pick(leg, ["fromStationName", "fromStation.stationName", "fromStation.name"], "") || "",
        toStationId: String(pick(leg, ["toStationId", "toStation.id"], "") || ""),
        toStationName: pick(leg, ["toStationName", "toStation.stationName", "toStation.name"], "") || "",
        candidates: candidatesRaw
          .map(normalizeRouteCandidateOption)
          .filter(Boolean)
          .filter((candidate) => isUsableRouteCandidateForBooking(candidate)),
      };
    })
    : fromBooking.map((leg) => ({
      legOrder: leg.legOrder,
      fromStationId: leg.fromStationId,
      fromStationName: leg.fromStationName,
      toStationId: leg.toStationId,
      toStationName: leg.toStationName,
      candidates: [],
    }));

  return legs.filter((leg) => leg.fromStationId && leg.toStationId);
};

export const normalizeSelectedRoute = (item) => {
  const raw = pick(item, [
    "selectedRoute",
    "finalizedRoute",
    "charterReference",
    "charterReferenceRoute",
    "mergedRoute",
  ], null);
  if (raw && typeof raw === "object") {
    const option = normalizeRouteCandidateOption(raw);
    if (option) return option;
  }
  const routeId = String(pick(item, ["selectedRouteId", "finalizedRouteId"], "") || "").trim();
  if (!routeId) return null;
  return normalizeRouteCandidateOption({
    routeId,
    routeCode: pick(item, ["selectedRouteCode", "finalizedRouteCode"], ""),
    routeName: pick(item, ["selectedRouteName", "finalizedRouteName"], ""),
    routeType: pick(item, ["selectedRouteType", "finalizedRouteType"], ""),
    distanceKm: pick(item, ["selectedRouteDistanceKm"], null),
    estimatedDurationMin: pick(item, ["selectedRouteDurationMin"], null),
  });
};

/** Build default { [legKey]: routeId } from candidates / prior selections. */
export const buildInitialRoutePlanSelections = (legs, booking = null) => {
  const selections = {};
  const existingPlan = Array.isArray(booking?.routePlan) ? booking.routePlan : [];

  (Array.isArray(legs) ? legs : []).forEach((leg) => {
    const key = getRouteCandidateLegKey(leg);
    const fromPlan = existingPlan.find((row) => (
      String(row?.fromStationId || "") === String(leg.fromStationId || "")
      && String(row?.toStationId || "") === String(leg.toStationId || "")
    ));
    const fromExisting = String(fromPlan?.routeId || "").trim();
    // Không auto lấy matchedRoute* / không tự chọn candidate — admin phải chọn trong select.
    if (fromExisting && (leg.candidates || []).some((c) => c.routeId === fromExisting)) {
      selections[key] = fromExisting;
    } else {
      selections[key] = "";
    }
  });

  return selections;
};

export const buildCharterRoutePlan = (legs, selections = {}) => (
  (Array.isArray(legs) ? legs : []).map((leg) => ({
    fromStationId: String(leg.fromStationId || "").trim(),
    toStationId: String(leg.toStationId || "").trim(),
    routeId: String(selections[getRouteCandidateLegKey(leg)] || "").trim(),
  })).filter((row) => row.fromStationId && row.toStationId)
);

export const isCharterRoutePlanComplete = (routePlan, legs = null) => {
  const plan = Array.isArray(routePlan) ? routePlan : [];
  if (plan.length === 0) return false;
  if (Array.isArray(legs) && legs.length > 0 && plan.length < legs.length) return false;
  return plan.every((row) => row.fromStationId && row.toStationId && row.routeId);
};

export const hasEmptyRouteCandidateLegs = (legs) => (
  Array.isArray(legs) && legs.some((leg) => !Array.isArray(leg.candidates) || leg.candidates.length === 0)
);

/**
 * FE nhận định "đủ tuyến" bằng mã tuyến (routeCode) đã chọn từng chặng.
 * Mỗi chặng phải có candidate được chọn và có routeCode (không phải tuyến CH-CB booking).
 */
export const hasSelectedRouteCodesForAllLegs = (legs, selections = {}) => {
  if (!Array.isArray(legs) || legs.length === 0) return false;

  return legs.every((leg) => {
    const routeId = String(selections[getRouteCandidateLegKey(leg)] || "").trim();
    if (!routeId) return false;

    const candidate = (Array.isArray(leg.candidates) ? leg.candidates : [])
      .find((item) => String(item?.routeId || item?.id || "").trim() === routeId);

    if (candidate && isCharterBookingGeneratedRoute(candidate)) return false;

    const code = String(
      candidate?.routeCode
      || candidate?.code
      || "",
    ).trim();

    // Có mã tuyến → đủ; thiếu mã nhưng có routeId GPS/Sightseeing hợp lệ vẫn chấp nhận.
    if (code) return !/^CH[-_]?CB-/i.test(code);
    if (!candidate) return Boolean(routeId);
    return isUsableRouteCandidateForBooking(candidate);
  });
};

/** Lấy stops theo stopOrder từ route catalog / detail. */
export const getOrderedRouteStops = (route) => (
  (Array.isArray(route?.stops) ? route.stops : Array.isArray(route?.routeStops) ? route.routeStops : [])
    .slice()
    .sort((a, b) => (Number(a.stopOrder) || 0) - (Number(b.stopOrder) || 0))
    .map((stop) => ({
      stationId: String(pick(stop, ["stationId", "station.id", "station.stationId", "id"], "") || "").trim(),
      stopOrder: Number(pick(stop, ["stopOrder"], 0)) || 0,
      stationName: pick(stop, ["stationName", "station.stationName", "station.name", "name"], "") || "",
    }))
    .filter((stop) => stop.stationId)
);

/**
 * Route chứa đủ 2 station của chặng và đúng chiều stopOrder
 * (fromStop.StopOrder < toStop.StopOrder) — không auto-match đường.
 */
export const routeMatchesLegStations = (route, fromStationId, toStationId) => {
  const fromId = String(fromStationId || "").trim();
  const toId = String(toStationId || "").trim();
  if (!fromId || !toId) return false;
  const stops = getOrderedRouteStops(route);
  const fromIdx = stops.findIndex((stop) => stop.stationId === fromId);
  const toIdx = stops.findIndex((stop) => stop.stationId === toId);
  if (fromIdx < 0 || toIdx < 0) return false;
  return fromIdx < toIdx;
};

/**
 * Candidate có đủ stops để verify theo bến không.
 * Ưu tiên stops trên chính candidate, rồi bản catalog/detail cùng routeId.
 */
export const resolveCandidateRouteForStationCheck = (candidate, catalogById = null) => {
  if (!candidate) return null;
  const stops = getOrderedRouteStops(candidate);
  if (stops.length >= 2) return candidate;
  const id = String(candidate.routeId || candidate.id || "").trim();
  if (!id || !catalogById) return candidate;
  const fromCatalog = catalogById.get(id);
  if (!fromCatalog) return candidate;
  return { ...candidate, ...fromCatalog };
};

/**
 * Giữ candidate chỉ khi khớp 2 bến chặng (đúng chiều).
 * Không có stops để verify → loại (tránh dropdown đầy route lệch bến).
 */
export const filterCandidatesByLegStations = (
  candidates,
  fromStationId,
  toStationId,
  catalogRoutes = [],
) => {
  const catalogById = new Map();
  (Array.isArray(catalogRoutes) ? catalogRoutes : []).forEach((route) => {
    const id = String(route?.routeId || route?.id || "").trim();
    if (id) catalogById.set(id, route);
  });

  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => isUsableRouteCandidateForBooking(candidate))
    .filter((candidate) => {
      const full = resolveCandidateRouteForStationCheck(candidate, catalogById);
      const stops = getOrderedRouteStops(full);
      if (stops.length < 2) {
        // Không verify được: chỉ giữ khi không có catalog để đối chiếu (fallback tin BE).
        return catalogById.size === 0;
      }
      return routeMatchesLegStations(full, fromStationId, toStationId);
    });
};

const isSelectableGpsCatalogRoute = (route) => {
  const status = String(route?.status || "Active").toLowerCase();
  if (status && status !== "active") return false;

  // Prefer BE flags when present.
  if (route?.isSelectableForCharterQuote === false) return false;
  if (route?.isGeneratedForBooking === true) return false;
  if (String(route?.routeType || "") === "Charter") return false;
  if (route?.isSelectableForCharterQuote === true) return true;

  const type = String(route?.routeType || "");
  const label = String(route?.routeLabel || "").toLowerCase();
  if (type === "CharterReference" || type === "SightseeingLoop") return true;
  if (label === "gps" || label === "sightseeing") return true;
  if (route?.fromGps === true || route?.isFromGps === true || route?.createdFromGps === true) return true;
  if (String(route?.source || route?.createdVia || "").toLowerCase().includes("gps")) return true;
  return false;
};

/** Route do booking charter tạo (CH-CB-... / Charter CB-...) — không đẩy vào picker. */
export const isCharterBookingGeneratedRoute = (routeOrCandidate) => {
  if (!routeOrCandidate) return false;
  if (routeOrCandidate.isGeneratedForBooking === true) return true;
  if (String(routeOrCandidate.routeType || "") === "Charter") return true;
  if (String(routeOrCandidate.routeLabel || "").toLowerCase() === "charter") return true;
  const code = String(routeOrCandidate?.routeCode || "").trim();
  const name = String(routeOrCandidate?.routeName || routeOrCandidate?.name || "").trim();
  return /^CH[-_]?CB-/i.test(code) || /^Charter\s+CB-/i.test(name);
};

/** Candidate picker charter: chỉ GPS / Sightseeing Active — ẩn Charter, Bus, Inactive. */
export const isUsableRouteCandidateForBooking = (routeOrCandidate) => {
  if (!routeOrCandidate) return false;
  const status = String(routeOrCandidate.status || "Active").toLowerCase();
  if (status && status !== "active") return false;
  if (routeOrCandidate.isSelectableForCharterQuote === false) return false;
  if (routeOrCandidate.isGeneratedForBooking === true) return false;
  if (isCharterBookingGeneratedRoute(routeOrCandidate)) return false;

  const key = resolveRouteLabelKey(routeOrCandidate);
  if (key === "Charter" || key === "Bus") return false;
  if (key === "GPS" || key === "Sightseeing") return true;

  // BE đã gắn flag chọn được nhưng chưa có label ngắn.
  if (routeOrCandidate.isSelectableForCharterQuote === true) return true;
  return false;
};

export const normalizeCatalogRouteAsCandidate = (route) => normalizeRouteCandidateOption({
  routeId: route?.routeId || route?.id,
  routeCode: route?.routeCode,
  routeName: route?.routeName || route?.name,
  routeType: route?.routeType,
  routeLabel: route?.routeLabel,
  status: route?.status,
  isSelectableForCharterQuote: route?.isSelectableForCharterQuote,
  isGeneratedForBooking: route?.isGeneratedForBooking,
  distanceKm: route?.distanceKm ?? route?.baseDistanceKm ?? route?.totalDistanceKm,
  estimatedDurationMin: route?.estimatedDurationMin
    ?? route?.estimatedDurationMinutes
    ?? route?.travelMinutes,
});

/**
 * Khi BE route-candidates trống: FE lọc Route nguồn GPS/Sightseeing theo đúng 2 station
 * — dùng catalog `usage=charter-source`, không ghép / không ước đoán tuyến.
 */
export const buildManualGpsCandidatesForLeg = (catalogRoutes, fromStationId, toStationId) => (
  (Array.isArray(catalogRoutes) ? catalogRoutes : [])
    .filter((route) => isSelectableGpsCatalogRoute(route))
    .filter((route) => isUsableRouteCandidateForBooking(route))
    .filter((route) => routeMatchesLegStations(route, fromStationId, toStationId))
    .map(normalizeCatalogRouteAsCandidate)
    .filter(Boolean)
);

export const enrichCandidateLegsWithManualGpsRoutes = (legs, catalogRoutes) => (
  (Array.isArray(legs) ? legs : []).map((leg) => {
    // BE candidates cũng phải khớp 2 bến — trước đây chỉ lọc loại GPS nên ra nhiều option lệch.
    const beCandidates = filterCandidatesByLegStations(
      leg.candidates,
      leg.fromStationId,
      leg.toStationId,
      catalogRoutes,
    );
    const manual = buildManualGpsCandidatesForLeg(
      catalogRoutes,
      leg.fromStationId,
      leg.toStationId,
    );
    const byId = new Map();
    [...beCandidates, ...manual].forEach((candidate) => {
      if (!candidate?.routeId || byId.has(candidate.routeId)) return;
      byId.set(candidate.routeId, candidate);
    });
    return {
      ...leg,
      candidates: [...byId.values()],
    };
  })
);

/** Chuỗi bến trên route GPS — dùng giải thích vì sao không khớp chặng booking. */
export const formatGpsRouteStationsSummary = (route) => {
  const code = route?.routeCode || "";
  const name = route?.routeName || route?.name || "";
  const title = [code, name].filter(Boolean).join(" · ") || (route?.routeId || route?.id || "—");
  const stops = getOrderedRouteStops(route);
  const chain = stops.length > 0
    ? stops.map((stop) => stop.stationName || stop.stationId).join(" → ")
    : "(chưa có stops)";
  return `${title}: ${chain}`;
};

export const getCharterRoutePricingWarning = (booking, lang = "VN", options = {}) => {
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

  const { routeCandidateLegs = null, routePlanComplete = false, routeCandidatesLoaded } = options;

  if (routeCandidatesLoaded === false) {
    return lang === "VN"
      ? "Đang tải tuyến theo từng chặng..."
      : "Loading routes for each leg...";
  }

  if (Array.isArray(routeCandidateLegs)) {
    if (routeCandidateLegs.length === 0) {
      return lang === "VN"
        ? "Chưa có chặng lộ trình để chọn tuyến. Kiểm tra bến đón / trả / điểm dừng."
        : "No itinerary legs available for route selection. Check pickup / drop-off / stops.";
    }
    if (hasEmptyRouteCandidateLegs(routeCandidateLegs)) {
      return lang === "VN"
        ? "Có chặng chưa có route GPS chứa đủ 2 bến (đúng chiều). Chọn Route nguồn GPS / Vòng tham quan có đủ stationId, hoặc tạo route GPS mới."
        : "Some legs have no GPS route containing both stations (correct direction). Pick a GPS / loop route with those stationIds, or create one.";
    }
    if (!routePlanComplete) {
      return lang === "VN"
        ? "Chọn một route cho mỗi chặng trước khi preview / chốt giá."
        : "Select one route for every leg before preview / finalize quote.";
    }
    return "";
  }

  if (booking?.selectedRoute?.routeId || booking?.selectedRouteId) return "";

  const completeness = getRouteEstimateCompleteness(booking.routeEstimate);
  if (completeness.hasRawDistance && completeness.hasRawTravelTime) {
    return lang === "VN"
      ? "Chọn route từ candidates ở form chốt giá (mỗi chặng 1 routeId)."
      : "Select routes from candidates in the quote form (one routeId per leg).";
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

export const isCharterRoutePricingBlocked = (booking, options = {}) => {
  if (!hasCharterRouteStations(booking)) return true;
  if (booking?.selectedRoute?.routeId || booking?.selectedRouteId) return false;

  const { routeCandidateLegs = null, routePlanComplete = false, routeCandidatesLoaded } = options;
  if (routeCandidatesLoaded === false) return true;
  if (Array.isArray(routeCandidateLegs)) {
    return !routePlanComplete || hasEmptyRouteCandidateLegs(routeCandidateLegs) || routeCandidateLegs.length === 0;
  }

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

/** Duration gửi kèm chốt giá — ưu tiên tổng phút route đã chọn, rồi routeEstimate. */
export const resolveQuoteDurationValue = (
  booking,
  rentalUnit = "Hour",
  { routeCandidateLegs = null, routePlanSelections = null } = {},
) => {
  const estimate = booking?.routeEstimate;
  const bookingDuration = Number(booking?.durationValue) || 0;

  if (rentalUnit === "Day") {
    const dayValue = Number(estimate?.chargeableDurationValue) || bookingDuration || 1;
    return Math.max(1, Math.round(dayValue));
  }

  // Tổng thời gian từ route GPS admin đã chọn theo từng chặng.
  if (Array.isArray(routeCandidateLegs) && routeCandidateLegs.length > 0 && routePlanSelections) {
    let selectedMinutes = 0;
    let selectedCount = 0;
    routeCandidateLegs.forEach((leg) => {
      const selectedId = String(routePlanSelections[getRouteCandidateLegKey(leg)] || "").trim();
      if (!selectedId) return;
      const candidate = (Array.isArray(leg.candidates) ? leg.candidates : [])
        .find((item) => String(item.routeId) === selectedId);
      const minutes = Number(candidate?.estimatedDurationMin);
      if (Number.isFinite(minutes) && minutes > 0) {
        selectedMinutes += minutes;
        selectedCount += 1;
      }
    });
    if (selectedCount > 0 && selectedMinutes > 0) {
      return Math.max(1, Math.ceil(selectedMinutes / 60));
    }
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
  const selectedRoute = normalizeSelectedRoute(item);
  const routePlanRaw = pick(item, ["routePlan", "selectedRoutePlan"], []);
  const routePlan = Array.isArray(routePlanRaw)
    ? routePlanRaw.map((row) => ({
      fromStationId: String(pick(row, ["fromStationId", "fromStation.id"], "") || ""),
      toStationId: String(pick(row, ["toStationId", "toStation.id"], "") || ""),
      routeId: String(pick(row, ["routeId", "route.id", "id"], "") || ""),
    })).filter((row) => row.fromStationId && row.toStationId)
    : [];
  const matchedRouteId = String(pick(item, [
    "matchedRouteId",
    "routeId",
    "matchedRoute.routeId",
    "matchedRoute.id",
    "route.routeId",
    "route.id",
  ], "") || selectedRoute?.routeId || matchedSummary.matchedRouteId || "");
  const matchedRouteCode = pick(item, [
    "matchedRouteCode",
    "routeCode",
    "matchedRoute.routeCode",
    "route.routeCode",
  ], "") || selectedRoute?.routeCode || matchedSummary.matchedRouteCode || "";
  const matchedRouteName = pick(item, [
    "matchedRouteName",
    "routeName",
    "matchedRoute.routeName",
    "route.routeName",
    "route.name",
  ], "") || selectedRoute?.routeName || matchedSummary.matchedRouteName || "";
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
    selectedRoute,
    selectedRouteId: selectedRoute?.routeId || "",
    charterRouteId: String(pick(item, ["charterRouteId", "charterRoute.routeId", "charterRoute.id"], "") || ""),
    routeDrawRequest: pick(item, ["routeDrawRequest", "latestRouteDrawRequest", "activeRouteDrawRequest"], null),
    routePlan,
    routeLegs,
    fromStationId: String(pick(item, ["fromStationId", "fromStation.id", "fromStation.stationId"], "")),
    fromStationName: fromName || "",
    toStationId: String(pick(item, ["toStationId", "toStation.id", "toStation.stationId"], "")),
    toStationName: toName || "",
    departureDate: pick(item, ["departureDate", "startDate"]),
    startTime: pick(item, ["startTime"], "--"),
    itineraryStops: normalizeItineraryStops(item),
    routeEstimate,
    rentalUnit: pick(item, ["rentalUnit"], ""),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 0)) || 0,
    adultCount,
    childCount,
    passengerCount,
    status: resolveCharterBookingStatus(item),
    paymentStatus: resolveCharterPaymentStatus(item),
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
    bookingHoldExpiresAt: pick(item, ["bookingHoldExpiresAt"], ""),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    totalAmount: Number(pick(item, ["finalAmount", "totalAmount"], 0)) || 0,
    subtotalAmount: Number(pick(item, ["subtotalAmount", "subtotalBeforeDiscount"], 0)) || 0,
    discountAmount: Number(pick(item, ["discountAmount"], 0)) || 0,
    depositAmount: Number(pick(item, ["depositAmount"], 0)),
    remainingAmount: (() => {
      const raw = pick(item, ["remainingAmount"], "");
      if (raw === "" || raw === null || raw === undefined) return undefined;
      const value = Number(raw);
      return Number.isFinite(value) ? Math.max(value, 0) : undefined;
    })(),
    requiresAdditionalPayment: Boolean(
      item?.requiresAdditionalPayment === true || item?.RequiresAdditionalPayment === true,
    ),
    additionalInsuranceAmount: Number(pick(item, ["additionalInsuranceAmount"], 0)) || 0,
    paidAmount: Number(pick(item, ["paidAmount", "paidPaymentAmount"], 0)) || 0,
    promotionCode: pick(item, ["promotionCode"], ""),
    quoteBoats: pick(item, ["quoteBoats", "quoteBreakdown.boats", "pricing.boats", "pricePreview.boats"], []),
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
    payments: collectCharterPayments(item),
    trips: Array.isArray(item?.trips) ? item.trips : (Array.isArray(item?.charterTrips) ? item.charterTrips : []),
    tripIds: getCharterBookingLinkedTripIds(item),
    createdAt: pick(item, ["createdAt", "createdDate"]),
    assignedManagerId: String(pick(item, ["assignedManagerId", "managerUserId", "assignedManager.id", "assignedManager.userId"], "")),
    assignedManagerName: pick(item, ["assignedManagerName", "assignedManager.fullName", "assignedManager.name"], ""),
  };
};
