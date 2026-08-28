import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";

import {
  cancelMyCharterBooking,
  downloadAllCharterBookingTickets,
  downloadCharterBookingTicketsPdf,
  downloadCharterBookingTicketsPdfByQrToken,
  downloadSelectedCharterBookingTickets,
  fetchCharterBookingManifestByCode,
  fetchCharterBookingQrImage,
  fetchMyCharterBookingDetail,
  importMyCharterBookingPassengers,
  respondToCharterBookingQuote,
  updateMyCharterBookingPassengers,
  addMyCharterBookingPassengers,
} from "../../../services/charterBookingService";
import { listBookingPassengers, normalizePassengerApprovalStatus } from "../../../utils/charterPassengerAdd";
import { checkPromotionCode, normalizePromotionValidateResult } from "../../../services/promotionService";
import { createBookingPayment, syncBookingPayment, syncBookingPaymentByOrderCode } from "../../../services/paymentService";
import { fetchMyPointBalance, getMaxPointsToUse } from "../../../services/pointService";
import { fetchBoatDetail } from "../../../services/boatService";

import { CharterWorkflowStepper } from "../../../components/CharterWorkflowStepper";
import { CharterRouteMapPanel } from "../../../components/CharterRouteMapPanel";
import { CharterInsuranceInfo } from "../../../components/CharterInsuranceInfo";
import { CharterQuotePreviewTable } from "../../../components/CharterQuotePreviewTable";
import { BoatSeatLayoutPreviewButton } from "../../../components/BoatLayoutPreview";
import { NullImageIcon } from "../../../components/NullImageIcon";

import { getApiErrorMessage } from "../../../utils/apiError";
import { getBookingInsurancePackageId, normalizeInsuranceFromBooking, resolveInsuranceSelected } from "../../../utils/insurancePreview";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import {
  shouldShowCharterQuotePaymentCountdown,
  getCharterQuotePaymentDeadline,
  getCharterDepositAmount,
  bookingWaitsCustomerRefundInfo,
  getCustomerActionInfo,
  readAcknowledgedCustomerTabBadges,
  acknowledgeCustomerTabBadge,
  shouldShowCustomerTabBadge,
} from "../../../utils/charterBookingActions";
import { buildBookingQuotePreview } from "../../../utils/charterQuotePreview";
import { getPassengerBirthYear, hasCharterPassengerName } from "../../../utils/charterBookingTickets";
import {
  canShowCharterTicketsWithBalance,
  extractCharterAdditionalPaymentMeta,
  extractPayOsPaymentFields,
  getCharterBalanceDue,
  hasCharterBalanceDue,
  markCharterTopUpPayOsStarted,
  rememberCharterPayOsSession,
} from "../../../utils/charterPayOs";
import { buildConfirmBodyHtml, showAlertDialog, showConfirmDialog, showToast } from "../../../utils/swalToast";

import { useCharterBookingDetailHub } from "../../../hooks/useCharterBookingDetailHub";
import { MyCharterPaymentPanel, MyCharterPaymentStickyBar } from "./MyCharterPaymentPanel";
import { MyCharterTicketsPanel } from "./MyCharterTicketsPanel";
import { getRefundPaymentId, isPaymentUuid, normalizeSelectedRoute, resolveCharterBookingStatus, resolveCharterPaymentStatus } from "../../../utils/charterBookingAdmin";
import { charterLog, charterLogError } from "../../../utils/charterDebugLog";


const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const getDeadlineTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const getRemainingMs = (deadline, now = Date.now()) => {
  const time = getDeadlineTime(deadline);
  return time ? Math.max(0, time - now) : 0;
};

const isDeadlineExpired = (deadline, now = Date.now()) => {
  const time = getDeadlineTime(deadline);
  return Boolean(time && now >= time);
};

/** Chỉ dùng expiresAt từ BE — không tự cộng thêm phút trên FE. */
const getPaymentExpiresAt = (payment) => pick(payment, ["expiresAt"], "");

const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;

const getPaymentPurpose = (payment) =>
  String(pick(payment, ["paymentPurpose", "purpose", "type"], "")).toLowerCase();

const isPaidPayment = (payment) =>
  ["paid", "depositpaid"].includes(String(payment?.paymentStatus || "").toLowerCase());

/**
 * Trả về timestamp (ms) khi admin duyệt thêm hành khách gần nhất, hoặc null nếu không có.
 *
 * Lưu ý BE: hiện tại chưa trả field này. Khi BE thêm, cập nhật helper này để đọc từ:
 *   - booking.latestPassengerAddedAt          (ISO string, ưu tiên)
 *   - booking.passengers[*].approvedAt        (fallback: max timestamp)
 *   - booking.tickets[*].createdAt / approvedAt
 *
 * Đây là anchor để tính đếm ngược 12h "grace period" sau khi thêm HK mới.
 */
const getLatestPassengerAddedAt = (booking) => {
  if (!booking) return null;
  // Ưu tiên 1: field explicit từ BE
  const explicit = pick(booking, ["latestPassengerAddedAt"], null);
  if (explicit) {
    const ts = Date.parse(explicit);
    if (!Number.isNaN(ts)) return ts;
  }
  // Fallback: tìm max approvedAt/createdAt trong passengers/tickets
  const candidates = [];
  const collect = (arr, keys) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((row) => {
      keys.forEach((k) => {
        const v = row?.[k];
        if (v) {
          const ts = Date.parse(v);
          if (!Number.isNaN(ts)) candidates.push(ts);
        }
      });
    });
  };
  collect(booking.passengers, ["approvedAt", "updatedAt", "createdAt"]);
  collect(booking.tickets, ["approvedAt", "updatedAt", "createdAt"]);
  return candidates.length ? Math.max(...candidates) : null;
};

/**
 * Grace period 12h sau khi admin duyệt thêm HK mới.
 * Sau thời điểm này, nút thanh toán nên disable (BE sẽ quyết định hành vi cuối).
 */
const PASSENGER_ADD_GRACE_MS = 12 * 60 * 60 * 1000;
const isPastPassengerAddGrace = (booking, nowMs = Date.now()) => {
  const anchor = getLatestPassengerAddedAt(booking);
  if (!anchor) return false;
  return nowMs - anchor >= PASSENGER_ADD_GRACE_MS;
};
const getPassengerAddDeadline = (booking) => {
  const anchor = getLatestPassengerAddedAt(booking);
  return anchor ? anchor + PASSENGER_ADD_GRACE_MS : null;
};
const formatCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// CustomerPassengerManifest has been merged into MyCharterTicketsPanel — see that file.

const getPaymentId = (payment) => getRefundPaymentId(payment);

const getRefundablePayment = (booking) => {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  const paidPayment = payments.find((payment) => isPaidPayment(payment) && getPaymentId(payment));
  if (paidPayment) return paidPayment;

  const bookingPaymentId = pick(booking, ["paidPaymentId", "latestPaymentId", "paymentId", "payment.id"], "");
  if (isPaymentUuid(bookingPaymentId)) {
    return { paymentId: bookingPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  const storedPaymentId = booking?.id ? sessionStorage.getItem(`charterPayment:${booking.id}`) : "";
  if (isPaymentUuid(storedPaymentId)) {
    return { paymentId: storedPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  return null;
};

const normalizeBooking = (item) => {
  const adultCount = Number(pick(item, ["adultCount"], 0));
  const childCount = Number(pick(item, ["childCount"], 0));
  const passengerCount = Number(pick(item, ["passengerCount"], adultCount + childCount));
  const routeEstimate = pick(item, ["routeEstimate"], null);
  const estimateLegs = Array.isArray(routeEstimate?.legs) ? routeEstimate.legs : [];
  const firstLeg = estimateLegs[0] || null;
  const lastLeg = estimateLegs[estimateLegs.length - 1] || null;
  const fromName = pick(item, ["fromStationName", "fromStation.stationName", "fromStation.name"], "")
    || pick(firstLeg, ["fromStationName", "fromStation.stationName", "fromStation.name"], "");
  const toName = pick(item, ["toStationName", "toStation.stationName", "toStation.name"], "")
    || pick(lastLeg, ["toStationName", "toStation.stationName", "toStation.name"], "");
  const routeLegs = estimateLegs.map((leg, index) => ({
    legOrder: Number(pick(leg, ["legOrder", "order"], index + 1)) || index + 1,
    fromStationId: String(pick(leg, ["fromStationId"], "")),
    fromStationName: pick(leg, ["fromStationName"], ""),
    toStationId: String(pick(leg, ["toStationId"], "")),
    toStationName: pick(leg, ["toStationName"], ""),
    matchedRouteId: String(pick(leg, [
      "matchedRouteId",
      "routeId",
      "matchedRoute.routeId",
      "matchedRoute.id",
    ], "") || ""),
    matchedRouteCode: pick(leg, ["matchedRouteCode", "routeCode", "matchedRoute.routeCode"], "") || "",
    matchedRouteName: pick(leg, ["matchedRouteName", "routeName", "matchedRoute.routeName", "matchedRoute.name"], "") || "",
  }));
  const matchedRouteId = String(pick(item, [
    "matchedRouteId",
    "routeId",
    "matchedRoute.routeId",
    "matchedRoute.id",
  ], "")
    || pick(routeEstimate, ["matchedRouteId", "routeId"], "")
    || pick(firstLeg, ["matchedRouteId", "routeId", "matchedRoute.routeId", "matchedRoute.id"], "")
    || routeLegs.find((leg) => leg.matchedRouteId)?.matchedRouteId
    || "");
  const selectedRoute = normalizeSelectedRoute(item);
  const routePlanRaw = pick(item, ["routePlan", "selectedRoutePlan"], []);
  const routePlan = Array.isArray(routePlanRaw)
    ? routePlanRaw.map((row) => ({
      fromStationId: String(pick(row, ["fromStationId", "fromStation.id"], "") || ""),
      toStationId: String(pick(row, ["toStationId", "toStation.id"], "") || ""),
      routeId: String(pick(row, ["routeId", "route.id", "id"], "") || ""),
    })).filter((row) => row.fromStationId && row.toStationId)
    : [];
  const itineraryStops = Array.isArray(item?.itineraryStops)
    ? item.itineraryStops.map((stop, index) => ({
      stationId: String(pick(stop, ["stationId", "station.id", "station.stationId"], "")),
      stationName: pick(stop, ["stationName", "station.stationName", "station.name"], "") || "--",
      stopOrder: Number(pick(stop, ["stopOrder"], index + 1)) || index + 1,
      stayDurationMinutes: Number(pick(stop, ["stayDurationMinutes"], 0)) || 0,
      note: pick(stop, ["note"], ""),
    }))
    : [];
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  const pendingPayment = payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending");
  const paidPayments = payments.filter(isPaidPayment);
  const paidPaymentWithId = paidPayments.find((payment) => getPaymentId(payment));
  const paymentStatus = pick(item, ["paymentStatus"], "--");
  const rawDepositAmount = Number(pick(item, [
    "depositAmount",
    "requiredDepositAmount",
    "quoteBreakdown.depositAmount",
    "pricing.depositAmount",
  ], 0)) || 0;
  const paidAmountFromPayments = paidPayments.reduce((total, payment) => total + getPaymentAmount(payment), 0);
  const paidDepositAmountFromPayments = paidPayments
    .filter((payment) => getPaymentPurpose(payment) === "deposit")
    .reduce((total, payment) => total + getPaymentAmount(payment), 0);
  const hasDepositPaid = paidDepositAmountFromPayments > 0 || String(paymentStatus).toLowerCase() === "depositpaid";
  const paidDepositAmount = paidDepositAmountFromPayments || (hasDepositPaid ? rawDepositAmount : 0);
  const paidAmount = paidAmountFromPayments || Number(pick(item, ["paidAmount", "paidPaymentAmount"], 0)) || paidDepositAmount;

  return {
    raw: item,
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
    createdAt: pick(item, ["createdAt"], ""),
    boatName: pick(item, ["boatName", "boat.name"], "--"),
    route: pick(item, ["routeName", "route", "itineraryName"], fromName || toName ? `${fromName || "--"} - ${toName || "--"}` : "--"),
    fromStationName: fromName || "",
    toStationName: toName || "",
    departureDate: pick(item, ["departureDate", "DepartureDate", "startDate", "StartDate", "scheduledDepartureAt"]),
    startTime: (() => {
      const raw = pick(item, ["startTime", "StartTime", "departureTime", "DepartureTime"], "");
      const normalized = String(raw || "").trim();
      if (normalized && normalized !== "--") {
        const match = normalized.match(/(\d{1,2}):(\d{2})/);
        if (match) return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
      }
      const dateRaw = String(pick(item, ["departureDate", "DepartureDate", "scheduledDepartureAt"], "") || "");
      const fromIso = dateRaw.match(/T(\d{1,2}):(\d{2})/);
      if (fromIso) return `${String(Number(fromIso[1])).padStart(2, "0")}:${fromIso[2]}`;
      return "";
    })(),
    rentalUnit: pick(item, ["rentalUnit"], ""),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 0)) || 0,
    adultCount,
    childCount,
    passengerCount,
    status: resolveCharterBookingStatus(item),
    paymentStatus: (() => {
      const resolved = resolveCharterPaymentStatus(item);
      return resolved !== "--" ? resolved : paymentStatus;
    })(),
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
    bookingHoldExpiresAt: pick(item, ["bookingHoldExpiresAt"], pick(pendingPayment, ["bookingHoldExpiresAt"], "")),
    quotedAt: pick(item, ["quotedAt", "quoteSubmittedAt", "quoteAt", "quotedDate"], ""),
    updatedAt: pick(item, ["updatedAt", "modifiedAt"], ""),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: rawDepositAmount || paidDepositAmount,
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
    promotionCode: pick(item, ["promotionCode"], ""),
    specialRequests: pick(item, ["specialRequests"], "--"),
    insuranceSelected: resolveInsuranceSelected(item),
    insurancePackageId: getBookingInsurancePackageId(item),
    insurance: normalizeInsuranceFromBooking(item) || pick(item, ["insurance"], null),
    contactName: pick(item, ["contactName", "customerName", "fullName", "user.fullName"], "--"),
    contactPhone: pick(item, ["contactPhone"], "--"),
    contactEmail: pick(item, ["contactEmail"], "--"),
    fromStationId: pick(item, ["fromStationId", "fromStation.id", "fromStation.stationId"], ""),
    toStationId: pick(item, ["toStationId", "toStation.id", "toStation.stationId"], ""),
    itineraryStops,
    matchedRouteId,
    matchedRouteCode: pick(item, ["matchedRouteCode", "matchedRoute.routeCode", "routeCode"], "")
      || pick(routeEstimate, ["matchedRouteCode", "routeCode"], "")
      || routeLegs.find((leg) => leg.matchedRouteCode)?.matchedRouteCode
      || "",
    matchedRouteName: pick(item, ["matchedRouteName", "matchedRoute.routeName", "routeName"], "")
      || pick(routeEstimate, ["matchedRouteName", "routeName"], "")
      || routeLegs.find((leg) => leg.matchedRouteName)?.matchedRouteName
      || "",
    selectedRoute,
    selectedRouteId: selectedRoute?.routeId || "",
    routePlan,
    routeLegs,
    preferredSeatSetupType: pick(item, ["preferredSeatSetupType"], "FullStandard"),
    routeEstimate,
    requestedBoats: pick(item, ["requestedBoats"], []),
    selectedBoats: pick(item, ["selectedBoats", "boats"], []),
    quoteBoats: pick(item, ["quoteBoats", "quoteBreakdown.boats", "pricing.boats", "pricePreview.boats"], []),
    subtotalAmount: Number(pick(item, ["subtotalAmount", "quoteBreakdown.subtotalAmount", "pricing.subtotalAmount"], 0)),
    discountAmount: Number(pick(item, ["discountAmount", "quoteBreakdown.discountAmount", "pricing.discountAmount"], 0)),
    totalAmount: Number(pick(item, ["totalAmount", "finalAmount", "quoteBreakdown.totalAmount", "pricing.totalAmount"], 0)),
    passengers: pick(item, ["passengers"], []),
    tickets: pick(item, ["tickets"], []),
    payments,
    paidAmount,
    paidDepositAmount,
    hasDepositPaid,
    paidPaymentId: getPaymentId(paidPaymentWithId || {}) || pick(item, ["paidPaymentId", "paymentId", "payment.id"], ""),
    latestPaymentId: pick(pendingPayment, ["paymentId", "id"], pick(item, ["paymentId", "latestPaymentId", "payment.id"], "")),
    latestPaymentOrderCode: pick(pendingPayment, ["orderCode", "paymentOrderCode", "payosOrderCode"], pick(item, ["orderCode", "paymentOrderCode", "latestPaymentOrderCode", "payment.orderCode"], "")),
    latestPaymentAmount: getPaymentAmount(pendingPayment) || Number(pick(item, ["paymentAmount", "latestPaymentAmount", "payment.amount"], 0)) || 0,
    latestPaymentCheckoutUrl: pick(pendingPayment, ["checkoutUrl", "paymentUrl"], pick(item, ["checkoutUrl", "paymentUrl", "latestPaymentCheckoutUrl"], "")),
    latestPaymentExpiresAt: pick(pendingPayment, ["expiresAt"], pick(item, ["expiresAt", "payment.expiresAt", "latestPaymentExpiresAt"], "")),
    latestPaymentQrCode: pick(pendingPayment, ["qrCode"], pick(item, ["qrCode", "payment.qrCode", "latestPaymentQrCode"], "")),
    qrToken: pick(item, ["charterBookingQrToken", "qrToken"], ""),
  };
};

const getBoatDisplayName = (boat, fallback = "--") => {
  const code = pick(boat, ["code", "boatCode", "boat.code"], "");
  const name = pick(boat, ["name", "boatName", "boat.name"], "");
  if (code && name) return `${code} - ${name}`;
  return name || code || fallback;
};

const getRequestedDeckCount = (boat) => {
  const directDeckCount = Number(pick(boat, ["requiredNumberOfDecks", "numberOfDecks", "preferredNumberOfDecks", "deckCount", "boat.numberOfDecks"], 0)) || 0;
  if (directDeckCount > 0) return directDeckCount;

  const legacySeatSetupType = pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType", "boat.seatSetupType"], "");
  if (legacySeatSetupType === "StandardAndVip") return 2;
  if (legacySeatSetupType === "FullStandard") return 1;
  return 0;
};

const formatDeckCount = (deckCount, lang) => (
  Number(deckCount) > 0
    ? `${deckCount} ${lang === "VN" ? "tầng" : Number(deckCount) === 1 ? "deck" : "decks"}`
    : ""
);

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
};

const formatRouteEstimate = (estimate) => {
  if (!estimate) return "--";
  if (typeof estimate === "string" || typeof estimate === "number") return String(estimate);

  const distance = pick(estimate, ["distanceKm", "totalDistanceKm", "distance"]);
  const durationMinutes = pick(estimate, [
    "durationMinutes",
    "estimatedDurationMinutes",
    "estimatedTravelMinutes",
    "travelMinutes",
  ]);
  const durationHours = pick(estimate, ["durationHours", "estimatedDurationHours"]);
  const parts = [];

  if (distance !== "" && distance != null) {
    const distanceNumber = Number(distance);
    parts.push(Number.isFinite(distanceNumber) ? `${distanceNumber} km` : `${distance} km`);
  }
  if (durationMinutes !== "" && durationMinutes != null) {
    parts.push(`${durationMinutes} phút`);
  } else if (durationHours !== "" && durationHours != null) {
    parts.push(`${durationHours} giờ`);
  }
  return parts.join(" · ") || "--";
};

const getDownloadName = (response, fallbackName) => {
  const disposition = response.headers?.["content-disposition"] || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  const encodedName = utf8Match?.[1] || plainMatch?.[1];

  if (!encodedName) return fallbackName;

  try {
    return decodeURIComponent(encodedName);
  } catch {
    return encodedName;
  }
};

const downloadBlobResponse = (response, fallbackName) => {
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getDownloadName(response, fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const isUsableText = (value) => {
  const text = String(value || "").trim();
  return Boolean(text && text !== "--");
};

const looksLikeEmail = (value) => String(value || "").includes("@");

/** Họ tên người đặt — luôn dùng cho hành khách số 1. */
const getBookerPassengerName = (booking, user = null) => {
  const candidates = [
    booking?.contactName,
    booking?.customerName,
    pick(booking?.raw || {}, ["contactName", "customerName", "fullName", "user.fullName"], ""),
    user?.fullName,
    user?.name,
  ];
  for (const value of candidates) {
    const name = String(value || "").trim();
    if (isUsableText(name) && !looksLikeEmail(name)) return name;
  }
  return "";
};

const hasPassengerName = (passenger) =>
  isUsableText(pick(passenger, ["fullName", "passengerName", "name"], ""));

const hasSavedPassengerManifest = (booking) =>
  (Array.isArray(booking?.passengers) && booking.passengers.some(hasPassengerName))
  || (Array.isArray(booking?.tickets) && booking.tickets.some(hasPassengerName));

const getBookingPassengerCount = (booking) => {
  const declaredPassengerCount = Number(booking?.passengerCount || 0) || 0;
  const summedPassengerCount = (Number(booking?.adultCount || 0) || 0) + (Number(booking?.childCount || 0) || 0);
  return Math.max(declaredPassengerCount, summedPassengerCount, 1);
};

const isSinglePassengerWithContact = (booking, user = null) =>
  getBookingPassengerCount(booking) <= 1 && Boolean(getBookerPassengerName(booking, user));

/** Có thể khóa tên dòng #1 = người đặt (vẫn cho nhập năm sinh). */
const canPrefillBookerAsFirstPassenger = (booking, user = null) =>
  Boolean(getBookerPassengerName(booking, user));

const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;

const buildEmptyPassengerRows = (booking, user = null) => {
  const adultCount = Number(booking?.adultCount || 0);
  const childCount = Number(booking?.childCount || 0);
  const passengerCount = getBookingPassengerCount(booking);
  const bookerName = getBookerPassengerName(booking, user);

  const withBookerFirst = (rows) => {
    if (!bookerName || rows.length === 0) return rows;
    return rows.map((row, index) => (
      index === 0
        ? { ...row, fullName: bookerName, passengerType: row.passengerType || "Adult", isContactPassenger: true }
        : { ...row, isContactPassenger: false }
    ));
  };

  if (passengerCount <= 1 && bookerName) {
    return [{
      fullName: bookerName,
      birthYear: "",
      passengerType: "Adult",
      isContactPassenger: true,
    }];
  }

  if (adultCount > 0 || childCount > 0) {
    return withBookerFirst([
      ...Array.from({ length: adultCount }, () => ({ fullName: "", birthYear: "", passengerType: "Adult" })),
      ...Array.from({ length: childCount }, () => ({ fullName: "", birthYear: "", passengerType: "Child" })),
    ]);
  }

  return withBookerFirst(
    Array.from({ length: Math.max(passengerCount, 1) }, () => ({ fullName: "", birthYear: "", passengerType: "Adult" })),
  );
};

const parsePassengerDate = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const vnMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : vnMatch
      ? new Date(Number(vnMatch[3]), Number(vnMatch[2]) - 1, Number(vnMatch[1]))
      : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getPassengerAgeFromBirthYear = (birthYear, referenceDate) => {
  const year = Number(birthYear);
  if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR || year > CURRENT_YEAR) return null;
  const refYear = (parsePassengerDate(referenceDate) || new Date()).getFullYear();
  return refYear - year;
};

/** BE bắt buộc BirthYear hợp lệ — không cho gửi 0 / bỏ trống. */
const buildPassengerPayload = (booking, rows, lang, user = null) => {
  const passengerCount = getBookingPassengerCount(booking);
  const normalizedRows = rows.map((row, index) => ({
    ...row,
    passengerType: row.passengerType || (index < Number(booking?.adultCount || 0) ? "Adult" : "Child"),
  }));
  const filledRows = normalizedRows.filter((row) => row.fullName?.trim() || String(row.birthYear || "").trim());
  const rowsToSubmit = filledRows;

  if (rowsToSubmit.length === 0) {
    return {
      errorTitle: lang === "VN" ? "Chưa có hành khách" : "No passengers",
      errorText: lang === "VN" ? "Vui lòng nhập ít nhất một hành khách." : "Please enter at least one passenger.",
    };
  }

  if (rowsToSubmit.length > passengerCount) {
    return {
      errorTitle: lang === "VN" ? "Vượt quá số khách" : "Too many passengers",
      errorText: lang === "VN" ? "Tổng số hành khách không được vượt quá số lượng đã đăng ký." : "Passenger count must not exceed the registered count.",
    };
  }

  if (!isSinglePassengerWithContact(booking, user) && passengerCount > 1 && rowsToSubmit.length < passengerCount) {
    return {
      errorTitle: lang === "VN" ? "Chưa đủ hành khách" : "Missing passengers",
      errorText: lang === "VN" ? `Booking có ${passengerCount} khách, vui lòng nhập đủ ${passengerCount} dòng hành khách.` : `This booking has ${passengerCount} passengers. Please enter all ${passengerCount} passenger rows.`,
    };
  }

  for (const row of rowsToSubmit) {
    const fullName = row.fullName?.trim();
    const birthYear = String(row.birthYear || "").trim();

    if (fullName && !birthYear) {
      return {
        errorTitle: lang === "VN" ? "Chưa có năm sinh" : "Birth year needed",
        errorText: lang === "VN"
          ? "Họ tên đã sẵn sàng. Vui lòng nhập năm sinh rồi lưu — hệ thống cần năm sinh để hoàn tất."
          : "The name is ready. Please enter the birth year to finish saving.",
      };
    }

    if (!fullName || !birthYear) {
      return {
        errorTitle: lang === "VN" ? "Thiếu thông tin hành khách" : "Missing passenger info",
        errorText: lang === "VN" ? "Vui lòng nhập đủ họ tên và năm sinh cho từng hành khách." : "Please enter full name and birth year for each passenger.",
      };
    }

    const age = getPassengerAgeFromBirthYear(birthYear, booking?.departureDate);
    if (age === null) {
      return {
        errorTitle: lang === "VN" ? "Năm sinh không hợp lệ" : "Invalid birth year",
        errorText: lang === "VN" ? `Năm sinh phải từ ${MIN_BIRTH_YEAR} đến ${CURRENT_YEAR}.` : `Birth year must be between ${MIN_BIRTH_YEAR} and ${CURRENT_YEAR}.`,
      };
    }
  }

  return {
    passengers: rowsToSubmit.map((row) => ({
      fullName: row.fullName.trim(),
      birthYear: Number(String(row.birthYear).trim()),
    })),
  };
};

export function CharterDetail() {
  const { lang } = useApp();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [booking, setBooking] = useState(() => {
    const fallbackBooking = location.state?.booking;
    return fallbackBooking ? normalizeBooking(fallbackBooking) : null;
  });
  const [passengerRows, setPassengerRows] = useState([{ fullName: "", birthYear: "" }]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [paymentOption, setPaymentOption] = useState("Full");
  const [paymentPromotionCode, setPaymentPromotionCode] = useState("");
  const [useAllPoints, setUseAllPoints] = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointBalanceLoaded, setPointBalanceLoaded] = useState(false);
  const [promoPreview, setPromoPreview] = useState(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const promoValidateSeqRef = useRef(0);
  const lastAppliedPromoRef = useRef({ code: "", subtotal: 0 });
  const promoClearedByUserRef = useRef(false);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState("");
  const [paymentExpiresAt, setPaymentExpiresAt] = useState("");
  const [paymentQrCode, setPaymentQrCode] = useState("");
  const [paymentBookingHoldExpiresAt, setPaymentBookingHoldExpiresAt] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentWatcher, setPaymentWatcher] = useState({
    isActive: false,
    orderCode: "",
    checkoutUrl: "",
    amount: 0,
    deadline: "",
    statusText: "",
  });
  const [nowTick, setNowTick] = useState(() => Date.now());
  const loadedIdRef = useRef("");
  const importInputRef = useRef(null);
  const paymentSectionRef = useRef(null);
  const syncedPaymentRef = useRef("");
  const autoSyncPaymentRef = useRef("");
  const refreshedDeadlineRef = useRef("");
  const prevBalanceDueRef = useRef(null);
  const insuranceTopUpInFlightRef = useRef(false);
  const [boatImageOverrides, setBoatImageOverrides] = useState({});
  const fetchedBoatImageIdsRef = useRef(new Set());
  const [activeTab, setActiveTab] = useState("overview");
  const [acknowledgedTabBadges, setAcknowledgedTabBadges] = useState(() => readAcknowledgedCustomerTabBadges(id));

  const goToTab = (tabId, badgeValue) => {
    setActiveTab(tabId);
    if (!badgeValue) return;
    acknowledgeCustomerTabBadge(id, tabId, badgeValue);
    setAcknowledgedTabBadges((prev) => ({ ...prev, [tabId]: String(badgeValue) }));
  };

  const currencyFormatter = useMemo(() => ({
    format: (value) => `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} VND`,
  }), []);

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated) {
      navigate("/login");
      return null;
    }

    try {
      if (!silent) setIsLoading(true);
      setLoadError("");
      let detail;
      try {
        detail = await fetchMyCharterBookingDetail(id);
      } catch (detailError) {
        const bookingCode = booking?.bookingCode;
        if (!bookingCode || bookingCode === "--") throw detailError;
        detail = await fetchCharterBookingManifestByCode(bookingCode);
      }
      const normalized = normalizeBooking(detail);
      charterLog("load-detail-response", {
        bookingId: normalized?.id,
        bookingCode: normalized?.bookingCode,
        bookingStatus: normalized?.status,
        paymentStatus: normalized?.paymentStatus,
        passengerCount: normalized?.passengers?.length,
        ticketCount: normalized?.tickets?.length,
        hasQrToken: Boolean(normalized?.qrToken),
        hasPayments: Array.isArray(normalized?.payments) && normalized.payments.length > 0,
      });
      setBooking(normalized);
      // Cache payments[] so list page can show correct balance
      if (normalized?.id && Array.isArray(normalized?.payments) && normalized.payments.length > 0) {
        try {
          sessionStorage.setItem(`charterPayments:${normalized.id}`, JSON.stringify(normalized.payments));
        } catch (_) { /* quota full — ignore */ }
      }
      const passengerSource = normalized.passengers.length > 0 ? normalized.passengers : normalized.tickets;
      const initialPassengers = passengerSource.length > 0
        ? (() => {
          const mapped = passengerSource.map((passenger, index) => {
            const matchingTicket = normalized.tickets[index] || {};
            const yearFromPassenger = getPassengerBirthYear(passenger) || getPassengerBirthYear(matchingTicket);
            const savedName = pick(passenger, ["fullName", "passengerName", "name"], "");
            return {
              id: pick(passenger, ["ticketId", "id"], pick(matchingTicket, ["ticketId", "id"])),
              ticketCode: pick(passenger, ["ticketCode", "code"], pick(matchingTicket, ["ticketCode", "code"], "")),
              qrToken: pick(passenger, ["qrToken"], pick(matchingTicket, ["qrToken"], "")),
              fullName: savedName,
              birthYear: yearFromPassenger || "",
              passengerType: index < normalized.adultCount ? "Adult" : "Child",
              approvalStatus: pick(passenger, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], ""),
              requestBatchId: pick(passenger, ["requestBatchId", "passengerAddRequestId", "addRequestId", "batchId"], ""),
              reviewNote: pick(passenger, ["reviewNote", "rejectNote", "note"], ""),
              isContactPassenger: false,
            };
          });
          // BE đôi khi trả passengers chỉ có 1 record dù booking khai báo nhiều khách hơn.
          // Pad thêm row trống theo adultCount/childCount để user nhập tiếp cho đủ.
          const expectedTotal = getBookingPassengerCount(normalized);
          if (mapped.length >= expectedTotal) return mapped;
          const padded = [...mapped];
          for (let i = mapped.length; i < expectedTotal; i += 1) {
            padded.push({
              id: "",
              ticketCode: "",
              qrToken: "",
              fullName: "",
              birthYear: "",
              passengerType: i < Number(normalized.adultCount || 0) ? "Adult" : "Child",
              approvalStatus: "",
              requestBatchId: "",
              reviewNote: "",
              isContactPassenger: false,
            });
          }
          return padded;
        })()
        : buildEmptyPassengerRows(normalized, user);
      setPassengerRows(initialPassengers);
      setSelectedTicketIds([]);
      return normalized;
    } catch (error) {
      if (!silent) {
        setLoadError(
          error.response?.data?.message
          || (lang === "VN"
            ? "Máy chủ chưa thể trả về đầy đủ chi tiết. Dữ liệu tóm tắt từ danh sách đang được hiển thị."
            : "The server could not return full details. Summary data from the list is being shown."),
        );
      }
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [booking?.bookingCode, id, isAuthenticated, lang, navigate, user]);

  const refreshDetailSilently = useCallback(() => {
    loadDetail({ silent: true });
  }, [loadDetail]);

  useCharterBookingDetailHub({
    enabled: isAuthenticated && Boolean(id),
    bookingId: id,
    onRefresh: refreshDetailSilently,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    loadDetail();
  }, [id, loadDetail]);

  // Fetch point balance khi component mount và user authenticated.
  // Charter chỉ áp dụng dùng điểm 1 lần khi tạo payment — BE dùng /payments tổng quát,
  // giống trip. Sau khi booking Completed, điểm sẽ được cộng tự động bởi BE.
  useEffect(() => {
    if (!isAuthenticated) {
      setPointBalance(0);
      setPointBalanceLoaded(true);
      return;
    }
    let cancelled = false;
    setPointBalanceLoaded(false);
    fetchMyPointBalance()
      .then((balance) => {
        if (cancelled) return;
        setPointBalance(Math.max(0, Number(balance) || 0));
      })
      .catch(() => {
        if (cancelled) return;
        setPointBalance(0);
      })
      .finally(() => {
        if (!cancelled) setPointBalanceLoaded(true);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    setAcknowledgedTabBadges(readAcknowledgedCustomerTabBadges(id));
  }, [id]);

  useEffect(() => {
    if (!location.state?.focusPayment || isLoading || !booking) return;
    setActiveTab("payment");
    const timer = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [booking, isLoading, location.state?.focusPayment]);

  useEffect(() => {
    if (!booking?.qrToken) {
      setQrImageUrl("");
      return undefined;
    }

    let active = true;
    let objectUrl = "";

    fetchCharterBookingQrImage(booking.qrToken)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setQrImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setQrImageUrl("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [booking?.qrToken]);

  useEffect(() => {
    promoClearedByUserRef.current = false;
    lastAppliedPromoRef.current = { code: "", subtotal: 0 };
    setPromoPreview(null);
    setPaymentPromotionCode("");
  }, [booking?.id]);

  useEffect(() => {
    if (!booking) return;
    setPaymentOption(booking.hasDepositPaid && booking.paymentStatus !== "Paid" ? "Remaining" : "Full");
    setPaymentCheckoutUrl(booking.latestPaymentCheckoutUrl || "");
    setPaymentExpiresAt(booking.latestPaymentExpiresAt || "");
    setPaymentQrCode(booking.latestPaymentQrCode || "");
    setPaymentBookingHoldExpiresAt(booking.bookingHoldExpiresAt || "");
    setPaymentAmount(booking.latestPaymentAmount || 0);
    // Không tự nhét lại booking.promotionCode sau khi user đã xóa mã.
    if (!promoClearedByUserRef.current) {
      setPaymentPromotionCode((prev) => prev || booking.promotionCode || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when these specific fields change, not on every booking refetch
  }, [booking?.id, booking?.hasDepositPaid, booking?.paymentStatus, booking?.latestPaymentAmount, booking?.latestPaymentCheckoutUrl, booking?.latestPaymentExpiresAt, booking?.latestPaymentQrCode, booking?.bookingHoldExpiresAt, booking?.promotionCode]);

  const getPromoSubtotalAmount = useCallback(() => {
    if (!booking) return 0;
    const total = Math.max(0, Number(booking.totalAmount || booking.estimatedPrice) || 0);
    const paid = Math.max(0, Number(booking.paidAmount) || 0);
    const depositFallback = booking.hasDepositPaid
      ? Math.max(0, Number(booking.paidDepositAmount) || Number(booking.depositAmount) || 0)
      : 0;
    const effectivePaid = Math.max(paid, depositFallback);
    if (booking.hasDepositPaid) return Math.max(total - effectivePaid, 0);
    return total;
  }, [booking]);

  const handleApplyPromotionCode = useCallback(async (codeOverride) => {
    const code = String(codeOverride ?? paymentPromotionCode).trim();
    if (!code) {
      setPromoPreview(null);
      return;
    }
    const subtotal = getPromoSubtotalAmount();
    if (subtotal <= 0) {
      setPromoPreview({
        ok: false,
        error: lang === "VN" ? "Chưa có số tiền để áp dụng mã." : "No amount available for this promo.",
      });
      return;
    }

    const normalizedCode = code.toUpperCase();
    if (
      lastAppliedPromoRef.current.code === normalizedCode
      && lastAppliedPromoRef.current.subtotal === subtotal
    ) {
      return;
    }

    const seq = ++promoValidateSeqRef.current;
    setPromoChecking(true);
    try {
      const payload = await checkPromotionCode(code, subtotal);
      if (seq !== promoValidateSeqRef.current) return;
      const normalized = normalizePromotionValidateResult(payload, subtotal);
      if (!normalized.ok) {
        lastAppliedPromoRef.current = { code: "", subtotal: 0 };
        setPromoPreview({
          ok: false,
          error: normalized.message || (lang === "VN" ? "Mã không hợp lệ" : "Invalid promo code"),
        });
        return;
      }
      const nextCode = normalized.code || code;
      lastAppliedPromoRef.current = { code: String(nextCode).trim().toUpperCase(), subtotal };
      promoClearedByUserRef.current = false;
      setPaymentPromotionCode((prev) => (String(prev).trim() === nextCode ? prev : nextCode));
      setPromoPreview({
        ok: true,
        discountAmount: normalized.discountAmount,
        finalAmount: normalized.finalAmount,
        baseAmount: normalized.baseAmount,
        message: normalized.message,
        code: nextCode,
      });
    } catch (error) {
      if (seq !== promoValidateSeqRef.current) return;
      lastAppliedPromoRef.current = { code: "", subtotal: 0 };
      setPromoPreview({
        ok: false,
        error: getApiErrorMessage(
          error,
          lang === "VN" ? "Không kiểm tra được mã khuyến mãi." : "Could not validate promo code.",
        ),
      });
    } finally {
      if (seq === promoValidateSeqRef.current) setPromoChecking(false);
    }
  }, [getPromoSubtotalAmount, lang, paymentPromotionCode]);

  const handleClearPromotionCode = useCallback(() => {
    promoValidateSeqRef.current += 1;
    lastAppliedPromoRef.current = { code: "", subtotal: 0 };
    promoClearedByUserRef.current = true;
    setPaymentPromotionCode("");
    setPromoPreview(null);
    setPromoChecking(false);
  }, []);

  const handlePaymentPromotionCodeChange = useCallback((value) => {
    const next = String(value || "");
    lastAppliedPromoRef.current = { code: "", subtotal: 0 };
    promoClearedByUserRef.current = !next.trim();
    setPaymentPromotionCode(next);
    setPromoPreview(null);
  }, []);

  useEffect(() => {
    const code = String(paymentPromotionCode || "").trim();
    if (!code || code.length < 3) {
      if (!code) setPromoPreview(null);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      handleApplyPromotionCode(code);
    }, 600);
    return () => window.clearTimeout(timer);
    // Only re-validate when the typed code (or booking) changes — not when preview state updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentPromotionCode, booking?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const openPaymentPage = useCallback((checkoutUrl = "", { orderCode = "", amount = 0, expiresAt = "" } = {}) => {
    if (!checkoutUrl) return false;

    if (booking?.id) {
      sessionStorage.setItem("latestCharterPaymentBooking", booking.id);
      if (orderCode) {
        sessionStorage.setItem(`charterPaymentOrderCode:${booking.id}`, orderCode);
        sessionStorage.removeItem(`charterPayment:${booking.id}`);
      }
    }

    const deadline = expiresAt || "";
    setPaymentWatcher({
      isActive: false,
      orderCode,
      checkoutUrl,
      amount: Number(amount || 0),
      deadline,
      statusText: lang === "VN" ? "Đang chờ thanh toán trên PayOS" : "Waiting for PayOS payment",
    });
    window.location.assign(checkoutUrl);
    return true;
  }, [booking?.id, lang]);

  const handleSyncPayment = useCallback(async (paymentId, { silent = false } = {}) => {
    if (!paymentId) return;
    if (!isPaymentUuid(paymentId)) {
      if (!silent) {
        showAlertDialog({
          icon: "warning",
          title: lang === "VN" ? "Thiếu mã payment nội bộ" : "Internal payment ID missing",
          text: lang === "VN"
            ? "Không dùng được paymentLinkId để đồng bộ. Hãy đồng bộ bằng orderCode PayOS."
            : "paymentLinkId cannot be used for sync. Sync with the PayOS orderCode instead.",
        });
      }
      return;
    }

    try {
      if (!silent) setIsSubmitting(true);
      charterLog("sync-payment-start", { paymentId, bookingId: booking?.id });
      await syncBookingPayment(paymentId);
      await loadDetail({ silent: true });
      charterLog("sync-payment-reload", {
        paymentId,
        bookingId: booking?.id,
        paymentStatus: booking?.paymentStatus,
        ticketCount: booking?.tickets?.length,
      });
      if (!silent) {
        showAlertDialog({
          icon: "success",
          title: lang === "VN" ? "Đã đồng bộ thanh toán" : "Payment synchronized",
        });
      }
    } catch (error) {
      charterLogError("sync-payment", error);
      if (!silent) {
        const detail = String(error?.response?.data?.detail || error?.response?.data?.title || "");
        const isNotFound = error?.response?.status === 404 || /payment not found/i.test(detail);
        showAlertDialog({
          icon: "error",
          title: lang === "VN" ? "Không thể đồng bộ" : "Unable to synchronize",
          text: isNotFound
            ? (lang === "VN"
              ? "Không tìm thấy giao dịch thanh toán. Thử tải lại trang hoặc đồng bộ lại."
              : "Payment was not found. Try reload or sync again.")
            : (error.response?.data?.message || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later.")),
        });
      }
    } finally {
      if (!silent) setIsSubmitting(false);
    }
  }, [lang, loadDetail, booking]);

  const handleSyncPaymentByOrderCode = useCallback(async (orderCode, { silent = false } = {}) => {
    if (!orderCode) return;

    try {
      if (!silent) setIsSubmitting(true);
      charterLog("sync-payment-by-ordercode-start", { orderCode, bookingId: booking?.id });
      await syncBookingPaymentByOrderCode(orderCode);
      await loadDetail({ silent: true });
      charterLog("sync-payment-by-ordercode-reload", {
        orderCode,
        bookingId: booking?.id,
        paymentStatus: booking?.paymentStatus,
        ticketCount: booking?.tickets?.length,
        hasTickets: Array.isArray(booking?.tickets) && booking.tickets.length > 0,
      });
      if (!silent) {
        showAlertDialog({
          icon: "success",
          title: lang === "VN" ? "Đã đồng bộ thanh toán" : "Payment synchronized",
        });
      }
    } catch (error) {
      charterLogError("sync-payment-by-ordercode", error);
      if (!silent) {
        showAlertDialog({
          icon: "error",
          title: lang === "VN" ? "Không thể đồng bộ" : "Unable to synchronize",
          text: error.response?.data?.message || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later."),
        });
      }
    } finally {
      if (!silent) setIsSubmitting(false);
    }
  }, [lang, loadDetail, booking]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderCode = params.get("orderCode") || "";
    const returnedFromPayOs = params.has("status") || params.has("code") || Boolean(orderCode);

    if (!returnedFromPayOs) return;

    setPaymentWatcher((current) => ({ ...current, isActive: false }));

    if (!orderCode || syncedPaymentRef.current === orderCode) {
      navigate(location.pathname, { replace: true });
      return;
    }

    syncedPaymentRef.current = orderCode;
    sessionStorage.setItem(`charterPaymentOrderCode:${id}`, orderCode);
    sessionStorage.removeItem(`charterPayment:${id}`);
    handleSyncPaymentByOrderCode(orderCode, { silent: true });
    navigate(location.pathname, { replace: true });
  }, [handleSyncPaymentByOrderCode, id, location.pathname, location.search, navigate]);

  useEffect(() => {
    const orderCode = booking?.latestPaymentOrderCode || (booking?.id ? sessionStorage.getItem(`charterPaymentOrderCode:${booking.id}`) : "");
    const balanceDue = getCharterBalanceDue(booking);
    const isBookingPaid = String(booking?.paymentStatus).toLowerCase() === "paid" && balanceDue <= 0;
    const latestPaymentExpired = isDeadlineExpired(booking?.latestPaymentExpiresAt);

    if (!orderCode || isBookingPaid || latestPaymentExpired) return undefined;

    autoSyncPaymentRef.current = orderCode;
    const syncSilently = async () => {
      try {
        await syncBookingPaymentByOrderCode(orderCode);
        if (autoSyncPaymentRef.current === orderCode) {
          await loadDetail();
        }
      } catch {
        // Keep polling quietly; payment may still be pending at PayOS.
      }
    };

    syncSilently();
    const interval = window.setInterval(syncSilently, 6000);
    return () => {
      autoSyncPaymentRef.current = "";
      window.clearInterval(interval);
    };
  }, [booking?.id, booking?.latestPaymentExpiresAt, booking?.latestPaymentOrderCode, booking?.paymentStatus, booking?.totalAmount, booking?.paidAmount, loadDetail]);

  const applyCreatedPayOsPayment = useCallback((payment, {
    fallbackAmount = 0,
    openCheckout = true,
  } = {}) => {
    const extracted = extractPayOsPaymentFields(payment) || {};
    const paymentId = getRefundPaymentId(payment)
      || getRefundPaymentId(payment?.data)
      || getRefundPaymentId(payment?.payment)
      || getRefundPaymentId(payment?.data?.payment)
      || extracted.paymentId;
    const orderCode = extracted.orderCode
      || pick(payment, ["orderCode", "paymentOrderCode", "payosOrderCode", "data.orderCode", "data.paymentOrderCode", "data.payosOrderCode", "payment.orderCode", "data.payment.orderCode"]);
    const createdPaymentAmount = Number(
      extracted.amount
      || pick(payment, ["amount", "paymentAmount", "data.amount", "data.paymentAmount", "payment.amount", "data.payment.amount"], fallbackAmount),
    ) || fallbackAmount;
    const checkoutUrl = extracted.checkoutUrl || pick(payment, [
      "checkoutUrl",
      "paymentUrl",
      "paymentLink",
      "payUrl",
      "url",
      "data.checkoutUrl",
      "data.paymentUrl",
      "data.paymentLink",
      "data.payUrl",
      "data.url",
      "payment.checkoutUrl",
      "payment.paymentUrl",
      "data.payment.checkoutUrl",
      "data.payment.paymentUrl",
    ]);
    const expiresAt = extracted.expiresAt || pick(payment, ["expiresAt", "data.expiresAt", "payment.expiresAt", "data.payment.expiresAt"]);
    const qrCode = extracted.qrCode || pick(payment, ["qrCode", "data.qrCode", "payment.qrCode", "data.payment.qrCode"]);
    const bookingHoldExpiresAt = pick(payment, [
      "bookingHoldExpiresAt",
      "data.bookingHoldExpiresAt",
      "payment.bookingHoldExpiresAt",
      "data.payment.bookingHoldExpiresAt",
    ]);

    if (booking?.id) {
      rememberCharterPayOsSession(booking.id, { orderCode, paymentId });
    }

    setPaymentCheckoutUrl(checkoutUrl || "");
    setPaymentExpiresAt(expiresAt || "");
    setPaymentQrCode(qrCode || "");
    setPaymentBookingHoldExpiresAt(bookingHoldExpiresAt || "");
    setPaymentAmount(createdPaymentAmount);
    setPaymentWatcher((current) => ({
      ...current,
      isActive: false,
      orderCode,
      checkoutUrl,
      amount: createdPaymentAmount,
      deadline: expiresAt || current.deadline || "",
      statusText: lang === "VN" ? "Đang chờ thanh toán trên PayOS" : "Waiting for PayOS payment",
    }));

    if (openCheckout && checkoutUrl) {
      openPaymentPage(checkoutUrl, {
        orderCode,
        amount: createdPaymentAmount,
        expiresAt: expiresAt || "",
      });
      return { opened: true, checkoutUrl, orderCode, paymentId, amount: createdPaymentAmount };
    }

    return { opened: false, checkoutUrl, orderCode, paymentId, amount: createdPaymentAmount };
  }, [booking?.id, lang, openPaymentPage]);

  /** Tạo PayOS phần còn lại khi BH tăng sau thêm hành khách. */
  const createInsuranceTopUpPayOs = useCallback(async (balanceDue, {
    openCheckout = true,
    silent = false,
  } = {}) => {
    if (!booking?.id || !(balanceDue > 0)) return null;
    if (insuranceTopUpInFlightRef.current) return null;
    if (!markCharterTopUpPayOsStarted(booking.id, balanceDue)) return null;

    insuranceTopUpInFlightRef.current = true;
    try {
      if (!silent) setIsSubmitting(true);
      setPaymentOption("Remaining");
      const payment = await createBookingPayment({
        bookingId: booking.id,
        paymentOption: "Remaining",
        promotionCode: promoClearedByUserRef.current
          ? null
          : (String(paymentPromotionCode || "").trim() || null),
        // Áp dụng điểm cho cả top-up BH (vẫn cap 50% số tiền).
        useAllPoints: pointsToUse > 0,
        pointsToUse: pointsToUse > 0 ? pointsToUse : 0,
      });
      const applied = applyCreatedPayOsPayment(payment, {
        fallbackAmount: balanceDue,
        openCheckout,
      });

      if (!applied.opened && !silent) {
        showAlertDialog({
          icon: "success",
          title: lang === "VN" ? "Cần thanh toán phí bảo hiểm thêm" : "Additional insurance payment due",
          text: lang === "VN"
            ? `Đã tạo giao dịch PayOS ${currencyFormatter.format(applied.amount || balanceDue)}. Thanh toán để hoàn tất bảo hiểm cho hành khách mới.`
            : `PayOS payment of ${currencyFormatter.format(applied.amount || balanceDue)} was created for the extra passenger insurance.`,
        });
      }
      return applied;
    } catch (error) {
      if (!silent) {
        showAlertDialog({
          icon: "error",
          title: lang === "VN" ? "Không thể tạo thanh toán bảo hiểm thêm" : "Unable to create insurance top-up payment",
          text: getApiErrorMessage(
            error,
            lang === "VN"
              ? "Phí bảo hiểm đã tăng sau khi thêm hành khách. Vui lòng thử tạo lại link PayOS."
              : "Insurance increased after passengers were added. Please try creating the PayOS link again.",
          ),
        });
      }
      return null;
    } finally {
      insuranceTopUpInFlightRef.current = false;
      if (!silent) setIsSubmitting(false);
    }
  }, [applyCreatedPayOsPayment, booking?.id, currencyFormatter, lang, paymentPromotionCode]);

  // Sau khi admin duyệt thêm HK (SignalR refresh): BH tăng → tự tạo PayOS Remaining.
  useEffect(() => {
    if (!booking?.id) {
      prevBalanceDueRef.current = null;
      return undefined;
    }
    const balanceDue = getCharterBalanceDue(booking);
    const prev = prevBalanceDueRef.current;
    prevBalanceDueRef.current = balanceDue;

    if (prev === null) return undefined;
    if (!(balanceDue > 0) || balanceDue <= prev) return undefined;
    if (booking.insuranceSelected === false && !booking.requiresAdditionalPayment) return undefined;
    if (!["Confirmed", "Completed", "PendingPayment"].includes(booking.status)) return undefined;

    const hasPending = Array.isArray(booking.payments)
      && booking.payments.some((payment) => {
        const isPending = String(payment.paymentStatus).toLowerCase() === "pending";
        const expiresAt = pick(payment, ["expiresAt"], "");
        return isPending && (!expiresAt || !isDeadlineExpired(expiresAt));
      });
    if (hasPending || paymentCheckoutUrl) return undefined;

    createInsuranceTopUpPayOs(balanceDue, { openCheckout: true, silent: false });
    return undefined;
  }, [
    booking?.id,
    booking?.totalAmount,
    booking?.paidAmount,
    booking?.remainingAmount,
    booking?.requiresAdditionalPayment,
    booking?.additionalInsuranceAmount,
    booking?.status,
    booking?.insuranceSelected,
    booking?.payments,
    paymentCheckoutUrl,
    createInsuranceTopUpPayOs,
  ]);

  const handleCreatePayment = async () => {
    if (!booking?.id) return;
    const activePendingPayment = Array.isArray(booking.payments)
      ? booking.payments.find((payment) => {
        const isPending = String(payment.paymentStatus).toLowerCase() === "pending";
        const expiresAt = pick(payment, ["expiresAt"], "");
        return isPending && (!expiresAt || !isDeadlineExpired(expiresAt));
      })
      : null;
    const existingPaymentId = activePendingPayment ? pick(activePendingPayment, ["paymentId", "id"], booking.latestPaymentId) : "";
    const existingOrderCode = activePendingPayment ? pick(activePendingPayment, ["orderCode", "paymentOrderCode", "payosOrderCode"], booking.latestPaymentOrderCode) : "";
    const existingCheckoutUrl = activePendingPayment ? pick(activePendingPayment, ["checkoutUrl", "paymentUrl"], booking.latestPaymentCheckoutUrl || paymentCheckoutUrl) : "";
    const existingExpiresAt = activePendingPayment ? pick(activePendingPayment, ["expiresAt"], booking.latestPaymentExpiresAt || paymentExpiresAt) : "";
    const existingPaymentAmount = activePendingPayment ? getPaymentAmount(activePendingPayment) || booking.latestPaymentAmount || 0 : 0;
    const quoteHoldExpired = ["Quoted", "PendingPayment", "Confirmed"].includes(booking.status)
      && isDeadlineExpired(getCharterQuotePaymentDeadline(booking));

    if (quoteHoldExpired) {
      await loadDetail();
      showAlertDialog({
        icon: "info",
        title: lang === "VN" ? "Báo giá đã hết hạn" : "Quote expired",
        text: lang === "VN" ? "Hệ thống đã tải lại booking để cập nhật trạng thái mới nhất." : "The booking has been refreshed for the latest status.",
      });
      return;
    }

    if (existingPaymentId || existingCheckoutUrl) {
      if (existingCheckoutUrl) {
        openPaymentPage(existingCheckoutUrl, {
          orderCode: existingOrderCode,
          amount: existingPaymentAmount || selectedPaymentAmount,
          expiresAt: existingExpiresAt,
        });
        return;
      }
      if (existingOrderCode) {
        await handleSyncPaymentByOrderCode(existingOrderCode);
        return;
      }
      await handleSyncPayment(existingPaymentId);
      return;
    }

    try {
      setIsSubmitting(true);
      const paymentPayload = {
        bookingId: booking.id,
        paymentOption: paymentSelectValue,
        promotionCode: promoClearedByUserRef.current
          ? null
          : (String(paymentPromotionCode || "").trim() || null),
        // Áp dụng điểm: cap 50% tổng tiền lần thanh toán này (BE sẽ validate lại).
        useAllPoints: pointsToUse > 0,
        pointsToUse: pointsToUse > 0 ? pointsToUse : 0,
      };
      charterLog("create-payment-start", {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        paymentOption: paymentPayload.paymentOption,
        selectedPaymentAmount,
        hasPromotionCode: Boolean(paymentPayload.promotionCode),
      });
      const payment = await createBookingPayment(paymentPayload);
      charterLog("create-payment-success", {
        bookingId: booking.id,
        paymentId: payment?.paymentId,
        paymentCode: payment?.paymentCode,
        paymentPurpose: payment?.paymentPurpose,
        amount: payment?.amount,
        paymentStatus: payment?.status,
        hasCheckoutUrl: Boolean(payment?.checkoutUrl),
      });
      const applied = applyCreatedPayOsPayment(payment, {
        fallbackAmount: selectedPaymentAmount,
        openCheckout: true,
      });

      charterLog("payos-checkout-navigation", {
        bookingId: booking.id,
        checkoutOpened: applied.opened,
        checkoutUrl: applied.checkoutUrl ? "[present]" : "[missing]",
      });

      if (!applied.opened) {
        showAlertDialog({
          icon: "success",
          title: lang === "VN" ? "Đã tạo giao dịch" : "Payment created",
          text: lang === "VN" ? "Hệ thống sẽ tự động đồng bộ trạng thái thanh toán." : "Payment status will be synchronized automatically.",
        });
      }
    } catch (error) {
      setPaymentWatcher((current) => ({ ...current, isActive: false }));
      charterLogError("create-payment", error);
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể tạo thanh toán" : "Unable to create payment",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể tạo link thanh toán PayOS. Vui lòng kiểm tra trạng thái booking hoặc mã khuyến mãi." : "Unable to create the PayOS payment link. Please check the booking status or promotion code.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToQuote = async (action) => {
    if (!booking?.id || isSubmitting) return;
    if (action !== "Accept" && action !== "Reject") return;

    let note = null;

    if (action === "Reject") {
      const result = await showConfirmDialog({
        tone: "danger",
        icon: "warning",
        title: lang === "VN" ? "Từ chối báo giá?" : "Reject this quote?",
        html: buildConfirmBodyHtml({
          code: booking.bookingCode,
          text: lang === "VN"
            ? "Booking sẽ bị hủy sau khi từ chối."
            : "The booking will be cancelled after rejection.",
        }),
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Từ chối" : "Reject",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      });
      if (!result.isConfirmed) return;
    }

    if (action === "Accept") {
      const result = await showConfirmDialog({
        tone: "brand",
        icon: "question",
        title: lang === "VN" ? "Chấp nhận báo giá?" : "Accept this quote?",
        html: buildConfirmBodyHtml({
          code: booking.bookingCode,
          text: lang === "VN"
            ? "Sau khi chấp nhận, yêu cầu chuyển sang thanh toán."
            : "After accepting, you can proceed to payment.",
        }),
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Chấp nhận báo giá" : "Accept quote",
        cancelButtonText: lang === "VN" ? "Không, xem lại" : "No, go back",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      const response = await respondToCharterBookingQuote(booking.id, { action, note });

      // Prefer Accept response body (BE now returns updated booking), then silent refetch.
      const responseBooking = response?.booking || response?.data || response;
      const responseStatus = pick(responseBooking, ["bookingStatus", "status"], "");
      if (responseBooking && typeof responseBooking === "object" && (responseBooking.id || responseBooking.bookingCode || responseStatus)) {
        const normalizedFromResponse = normalizeBooking({
          ...booking,
          ...responseBooking,
          bookingStatus: responseStatus || responseBooking.bookingStatus || responseBooking.status,
          paymentStatus: pick(responseBooking, ["paymentStatus"], booking.paymentStatus),
          holdExpiresAt: pick(responseBooking, ["holdExpiresAt"], booking.holdExpiresAt),
          bookingHoldExpiresAt: pick(responseBooking, ["bookingHoldExpiresAt", "holdExpiresAt"], booking.bookingHoldExpiresAt),
        });
        setBooking(normalizedFromResponse);
      }

      const refreshed = await loadDetail({ silent: true });
      const effectiveStatus = refreshed?.status || responseStatus || booking.status;

      if (action === "Accept") {
        if (effectiveStatus === "Quoted") {
          showToast({
            icon: "warning",
            title: lang === "VN" ? "Chưa chuyển sang thanh toán" : "Still waiting for payment status",
            text: lang === "VN"
              ? "Máy chủ chưa đổi trạng thái sang PendingPayment. Vui lòng thử lại hoặc liên hệ hỗ trợ."
              : "The server did not change status to PendingPayment. Please try again or contact support.",
            timer: 4500,
          });
          return;
        }

        showToast({
          icon: "success",
          title: lang === "VN" ? "Đã chấp nhận báo giá" : "Quote accepted",
          text: lang === "VN"
            ? "Yêu cầu đã chuyển sang chờ thanh toán."
            : "The request is now pending payment.",
          timer: 2200,
        });
        window.setTimeout(() => {
          paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      } else {
        showToast({
          icon: "success",
          title: lang === "VN" ? "Đã từ chối báo giá" : "Quote rejected",
          timer: 1800,
        });
      }
    } catch (error) {
      console.error("Lỗi phản hồi báo giá:", error?.response?.data || error);
      const message = getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể phản hồi báo giá. Vui lòng tải lại trang rồi thử lại." : "Unable to respond to the quote. Please refresh and try again.",
      );
      await showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể phản hồi báo giá" : "Unable to respond to quote",
        html: `<p style="text-align:left;white-space:pre-wrap;margin:0;font-size:14px;line-height:1.5;">${String(message)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")}</p>`,
      });
      await loadDetail({ silent: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!booking?.id) return;

    const quoteDeadline = getCharterQuotePaymentDeadline(booking);
    const deadlines = [
      quoteDeadline ? { key: `quote-hold:${booking.id}:${quoteDeadline}`, value: quoteDeadline } : null,
      paymentExpiresAt ? { key: `payment:${booking.id}:${paymentExpiresAt}`, value: paymentExpiresAt } : null,
      paymentBookingHoldExpiresAt ? { key: `booking-hold:${booking.id}:${paymentBookingHoldExpiresAt}`, value: paymentBookingHoldExpiresAt } : null,
    ].filter(Boolean);

    const expiredDeadline = deadlines.find((deadline) => isDeadlineExpired(deadline.value, nowTick));
    if (!expiredDeadline || refreshedDeadlineRef.current === expiredDeadline.key) return;

    refreshedDeadlineRef.current = expiredDeadline.key;
    loadDetail();
  }, [booking, loadDetail, nowTick, paymentBookingHoldExpiresAt, paymentExpiresAt]);

  const handleOpenRefundForm = () => {
    if (!booking) return;
    const refundablePayment = getRefundablePayment(booking);
    const refundablePaymentId = getPaymentId(refundablePayment || {});
    if (!refundablePaymentId) {
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không tìm thấy giao dịch" : "Payment not found",
        text: lang === "VN"
          ? "Booking đã có thanh toán nhưng hệ thống chưa xác định được mã giao dịch cần hoàn tiền."
          : "This booking has a paid amount, but the system cannot identify the transaction to refund.",
      });
      return;
    }
    navigate(`/profile/my-charter-booking/${booking.id}/refund`, {
      state: {
        booking,
        payment: refundablePayment,
        paymentId: refundablePaymentId,
      },
    });
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    const hasPaidPayment = ["paid", "depositpaid"].includes(String(booking.paymentStatus).toLowerCase())
      || Number(booking.paidAmount || 0) > 0;
    const refundablePayment = hasPaidPayment ? getRefundablePayment(booking) : null;
    const refundablePaymentId = getPaymentId(refundablePayment || {});

    if (hasPaidPayment) {
      if (!refundablePaymentId) {
        showAlertDialog({
          icon: "error",
          title: lang === "VN" ? "Không tìm thấy giao dịch" : "Payment not found",
          text: lang === "VN"
            ? "Booking đã có thanh toán nhưng hệ thống chưa xác định được mã giao dịch cần hoàn tiền."
            : "This booking has a paid amount, but the system cannot identify the transaction to refund.",
        });
        return;
      }

      navigate(`/profile/my-charter-booking/${booking.id}/refund`, {
        state: {
          booking,
          payment: refundablePayment,
          paymentId: refundablePaymentId,
        },
      });
      return;
    } else {
      const result = await showConfirmDialog({
        tone: "danger",
        icon: "warning",
        title: lang === "VN" ? "Hủy yêu cầu thuê tàu?" : "Cancel this booking request?",
        html: buildConfirmBodyHtml({
          code: booking.bookingCode,
          text: lang === "VN"
            ? "Yêu cầu sẽ bị hủy và không thể thanh toán tiếp."
            : "The request will be cancelled and payment will no longer be available.",
        }),
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Hủy yêu cầu" : "Cancel request",
        cancelButtonText: lang === "VN" ? "Không, giữ lại" : "No, keep it",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      await cancelMyCharterBooking(booking.id, {});
      await loadDetail();
      showAlertDialog({
        icon: "success",
        title: lang === "VN" ? "Đã hủy yêu cầu" : "Request cancelled",
      });
    } catch (error) {
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể hủy" : "Unable to cancel",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Yêu cầu này có thể không còn được phép hủy." : "This request may no longer be cancellable.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengerRows((prev) => prev.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      return { ...row, [field]: value };
    }));
  };

  const handleImportPassengers = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file || !booking?.id) return;
    // Trước paid vẫn cho nhập file khách — danh sách cần để admin quote.
    const normalizedStatusForImport = String(booking.status || "").toLowerCase();
    const isPrePaymentForImport = ["pendingquote", "quoted", "pendingpayment"].includes(normalizedStatusForImport);
    if (!isPrePaymentForImport && String(booking.paymentStatus).toLowerCase() !== "paid") return;

    try {
      setIsSubmitting(true);
      const beforeBalance = getCharterBalanceDue(booking);
      const response = await importMyCharterBookingPassengers(booking.id, file);
      const paymentMeta = extractCharterAdditionalPaymentMeta(response);
      const embeddedPayment = extractPayOsPaymentFields(response);
      const refreshed = await loadDetail({ silent: true });
      const afterBalance = Math.max(
        getCharterBalanceDue(refreshed || booking),
        paymentMeta.remainingAmount,
        embeddedPayment?.amount || 0,
      );
      const needsTopUp = paymentMeta.requiresAdditionalPayment
        || paymentMeta.additionalInsuranceAmount > 0
        || afterBalance > beforeBalance;

      if (embeddedPayment?.checkoutUrl) {
        rememberCharterPayOsSession(booking.id, embeddedPayment);
        applyCreatedPayOsPayment(embeddedPayment, {
          fallbackAmount: afterBalance || embeddedPayment.amount,
          openCheckout: true,
        });
        return;
      }

      if (needsTopUp && afterBalance > 0) {
        await createInsuranceTopUpPayOs(afterBalance, { openCheckout: true });
        return;
      }

      showAlertDialog({
        icon: "success",
        title: lang === "VN" ? "Đã nhập danh sách hành khách" : "Passenger list imported",
      });
    } catch (error) {
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể nhập file" : "Unable to import file",
        text: error.response?.data?.message || (lang === "VN" ? "Chỉ hỗ trợ .xlsx, .csv, .tsv, .txt và booking phải được thanh toán đủ." : "Use .xlsx, .csv, .tsv, or .txt after the booking is fully paid."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketFileAction = async (action) => {
    if (!booking?.id) return;
    if (String(booking.paymentStatus).toLowerCase() !== "paid") return;

    const missingManifestPayload = !hasSavedPassengerManifest(booking)
      ? buildPassengerPayload(booking, passengerRows, lang, user)
      : null;

    if (missingManifestPayload?.errorTitle) {
      showAlertDialog({
        icon: "info",
        title: missingManifestPayload.errorTitle,
        text: missingManifestPayload.errorText,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      if (missingManifestPayload?.passengers) {
        await updateMyCharterBookingPassengers(booking.id, { passengers: missingManifestPayload.passengers });
      }

      const ticketIds = selectedTicketIds.length > 0 ? selectedTicketIds : null;
      let response;

      if (action === "zip") {
        response = ticketIds
          ? await downloadSelectedCharterBookingTickets(booking.id, ticketIds)
          : await downloadAllCharterBookingTickets(booking.id);
        downloadBlobResponse(response, `${booking.bookingCode}-tickets.zip`);
      } else if (action === "pdf") {
        try {
          response = await downloadCharterBookingTicketsPdf(booking.id, ticketIds);
        } catch (pdfError) {
          if (ticketIds || !booking.qrToken) throw pdfError;
          response = await downloadCharterBookingTicketsPdfByQrToken(booking.qrToken);
        }
        downloadBlobResponse(response, `${booking.bookingCode}-tickets.pdf`);
      } else {
        throw new Error(lang === "VN" ? "Chỉ hỗ trợ tải PDF vé." : "Only PDF download is supported.");
      }
    } catch (error) {
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể xuất vé" : "Unable to export tickets",
        text: getApiErrorMessage(error, lang === "VN" ? "Không thể tải PDF. Vui lòng lưu danh sách hành khách rồi thử lại." : "Unable to download PDF. Please save the passenger list and try again."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePassengers = async () => {
    if (!booking?.id) return;
    // Trước khi thanh toán (PendingQuote / Quoted) user vẫn phải nhập được hành khách
    // để admin tính giá theo danh sách. Sau khi thanh toán: đã có ticket → khóa.
    const normalizedStatus = String(booking.status || "").toLowerCase();
    const isPrePayment = ["pendingquote", "quoted", "pendingpayment"].includes(normalizedStatus);
    const isPaidStatus = String(booking.paymentStatus).toLowerCase() === "paid";
    if (!isPrePayment && !isPaidStatus && !booking.hasDepositPaid) {
      showAlertDialog({
        icon: "info",
        title: lang === "VN" ? "Booking chưa thanh toán" : "Booking is not paid",
        text: lang === "VN"
          ? "Chỉ có thể nhập hành khách sau khi đã đặt cọc hoặc thanh toán đủ."
          : "Passengers can only be entered after a deposit is paid or the booking is fully paid.",
      });
      return;
    }
    const passengerPayload = buildPassengerPayload(booking, passengerRows, lang, user);
    if (passengerPayload.errorTitle) {
      showAlertDialog({
        icon: "info",
        title: passengerPayload.errorTitle,
        text: passengerPayload.errorText,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const beforeBalance = getCharterBalanceDue(booking);
      const beforeInsuranceTotal = Number(booking.insurance?.totalAmount || 0) || 0;
      const response = await updateMyCharterBookingPassengers(booking.id, { passengers: passengerPayload.passengers });
      const paymentMeta = extractCharterAdditionalPaymentMeta(response);
      const embeddedPayment = extractPayOsPaymentFields(response);
      const refreshed = await loadDetail({ silent: true });
      const afterBalance = Math.max(
        getCharterBalanceDue(refreshed || booking),
        paymentMeta.remainingAmount,
        embeddedPayment?.amount || 0,
      );
      const afterInsuranceTotal = Number((refreshed || booking)?.insurance?.totalAmount || 0) || 0;
      const insuranceGrew = afterInsuranceTotal > beforeInsuranceTotal
        || paymentMeta.additionalInsuranceAmount > 0
        || paymentMeta.requiresAdditionalPayment;
      const balanceDue = afterBalance;

      if (embeddedPayment?.checkoutUrl) {
        rememberCharterPayOsSession(booking.id, embeddedPayment);
        applyCreatedPayOsPayment(embeddedPayment, {
          fallbackAmount: balanceDue || embeddedPayment.amount,
          openCheckout: true,
        });
        return;
      }

      if ((insuranceGrew || afterBalance > beforeBalance || paymentMeta.requiresAdditionalPayment) && balanceDue > 0) {
        await createInsuranceTopUpPayOs(balanceDue, { openCheckout: true });
        return;
      }

      showAlertDialog({
        icon: "success",
        title: lang === "VN" ? "Đã lưu danh sách hành khách" : "Passenger list saved",
      });
    } catch (error) {
      // BE trả 409 cho 2 trường hợp:
      //   1) RowVersion concurrency (DbUpdateConcurrencyException) — retry sau khi refetch.
      //   2) Anti-spam lock "Mỗi lần đã được cập nhật một yêu cầu khác." — BE chặn
      //      2 PUT passengers liên tiếp quá nhanh. Phải đợi BE cooldown.
      const status = Number(error?.response?.status || 0);
      const errorTitle = String(error?.response?.data?.title || error?.response?.data?.message || "");
      const isAntiSpamLock = /mỗi\s*lần\s*đã\s*được\s*cập\s*nhật|already\s*updated|another\s*update\s*request/i.test(errorTitle);

      if (status === 409 && !isAntiSpamLock) {
        try {
          charterLog("update-passengers-retry-on-409", { bookingId: booking.id });
          await loadDetail({ silent: true });
          const retryResponse = await updateMyCharterBookingPassengers(booking.id, {
            passengers: passengerPayload.passengers,
          });
          const paymentMetaRetry = extractCharterAdditionalPaymentMeta(retryResponse);
          const embeddedPaymentRetry = extractPayOsPaymentFields(retryResponse);
          const refreshedRetry = await loadDetail({ silent: true });
          const afterBalanceRetry = Math.max(
            getCharterBalanceDue(refreshedRetry || booking),
            paymentMetaRetry.remainingAmount,
            embeddedPaymentRetry?.amount || 0,
          );
          const afterInsuranceTotalRetry = Number((refreshedRetry || booking)?.insurance?.totalAmount || 0) || 0;
          const insuranceGrewRetry = afterInsuranceTotalRetry > beforeInsuranceTotal
            || paymentMetaRetry.additionalInsuranceAmount > 0
            || paymentMetaRetry.requiresAdditionalPayment;

          if (embeddedPaymentRetry?.checkoutUrl) {
            rememberCharterPayOsSession(booking.id, embeddedPaymentRetry);
            applyCreatedPayOsPayment(embeddedPaymentRetry, {
              fallbackAmount: afterBalanceRetry || embeddedPaymentRetry.amount,
              openCheckout: true,
            });
            return;
          }

          if ((insuranceGrewRetry || afterBalanceRetry > beforeBalance || paymentMetaRetry.requiresAdditionalPayment) && afterBalanceRetry > 0) {
            await createInsuranceTopUpPayOs(afterBalanceRetry, { openCheckout: true });
            return;
          }

          showAlertDialog({
            icon: "success",
            title: lang === "VN" ? "Đã lưu danh sách hành khách" : "Passenger list saved",
          });
          return;
        } catch (retryError) {
          console.error("Retry save passengers failed:", retryError);
        }
      }
      console.error("Không thể lưu hành khách charter:", {
        bookingId: booking.id,
        passengerCount: booking.passengerCount,
        adultCount: booking.adultCount,
        childCount: booking.childCount,
        submittedPassengers: passengerPayload.passengers,
        response: error.response?.data,
      });
      const fallbackText = isAntiSpamLock
        ? lang === "VN"
          ? "Bạn vừa cập nhật hành khách xong. Vui lòng đợi vài giây rồi thử lại — máy chủ đang khóa tạm thời để tránh gửi trùng yêu cầu."
          : "You just updated the passenger list. Please wait a few seconds and retry — the server is briefly locked to prevent duplicate requests."
        : (lang === "VN"
            ? "Hệ thống chưa lưu được danh sách hành khách này. Vui lòng kiểm tra lại tổng số khách, số người lớn và số trẻ em của booking."
            : "The system could not save this passenger list. Please verify the booking passenger totals, adult count, and child count.");
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể lưu hành khách" : "Unable to save passengers",
        text: getApiErrorMessage(error, fallbackText),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPassengers = async (rows = []) => {
    if (!booking?.id) return false;
    if (String(booking.paymentStatus).toLowerCase() !== "paid") {
      showAlertDialog({
        icon: "info",
        title: lang === "VN" ? "Chưa thanh toán" : "Not fully paid",
        text: lang === "VN" ? "Chỉ thêm hành khách sau khi đã thanh toán đủ." : "Passengers can only be added after the booking is fully paid.",
      });
      return false;
    }

    const passengers = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        fullName: String(row.fullName || "").trim(),
        birthYear: Number(row.birthYear),
      }))
      .filter((row) => row.fullName && Number.isInteger(row.birthYear) && row.birthYear >= 1900);

    if (passengers.length === 0) {
      showAlertDialog({
        icon: "info",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing info",
        text: lang === "VN" ? "Nhập họ tên và năm sinh hợp lệ cho ít nhất 1 hành khách." : "Enter a valid full name and birth year for at least one passenger.",
      });
      return false;
    }

    try {
      setIsSubmitting(true);
      const beforeBalance = getCharterBalanceDue(booking);
      const beforeInsuranceTotal = Number(booking.insurance?.totalAmount || 0) || 0;
      const response = await addMyCharterBookingPassengers(booking.id, { passengers });
      const paymentMeta = extractCharterAdditionalPaymentMeta(response);
      const embeddedPayment = extractPayOsPaymentFields(response);
      const refreshed = await loadDetail({ silent: true });
      const afterBalance = Math.max(
        getCharterBalanceDue(refreshed || booking),
        paymentMeta.remainingAmount,
        embeddedPayment?.amount || 0,
      );
      const afterInsuranceTotal = Number((refreshed || booking)?.insurance?.totalAmount || 0) || 0;
      const insuranceGrew = afterInsuranceTotal > beforeInsuranceTotal
        || paymentMeta.additionalInsuranceAmount > 0
        || paymentMeta.requiresAdditionalPayment;
      const balanceDue = afterBalance;

      if (embeddedPayment?.checkoutUrl) {
        rememberCharterPayOsSession(booking.id, embeddedPayment);
        applyCreatedPayOsPayment(response, {
          fallbackAmount: balanceDue || embeddedPayment.amount,
          openCheckout: true,
        });
        return true;
      }

      if ((insuranceGrew || afterBalance > beforeBalance || paymentMeta.requiresAdditionalPayment) && balanceDue > 0) {
        await createInsuranceTopUpPayOs(balanceDue, { openCheckout: true });
        return true;
      }

      showAlertDialog({
        icon: "success",
        title: lang === "VN" ? "Đã gửi yêu cầu thêm" : "Add request submitted",
        text: lang === "VN" ? "Yêu cầu đang chờ đội vận hành duyệt." : "Your request is pending operations review.",
      });
      return true;
    } catch (error) {
      showAlertDialog({
        icon: "error",
        title: lang === "VN" ? "Không thể thêm hành khách" : "Unable to add passengers",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Không gửi được yêu cầu thêm hành khách." : "Could not submit the add-passenger request.",
        ),
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Booking detail chỉ trả thông tin tối thiểu cho tàu đã gán/báo giá (không kèm imageUrl).
  // Admin bù ảnh bằng cách gọi catalog tàu riêng; ở đây ta gọi chi tiết từng tàu thiếu ảnh qua boatId.
  useEffect(() => {
    const sourceBoats = Array.isArray(booking?.quoteBoats) && booking.quoteBoats.length > 0
      ? booking.quoteBoats
      : (Array.isArray(booking?.selectedBoats) ? booking.selectedBoats : []);

    const missingIds = [...new Set(
      sourceBoats
        .map((boat) => {
          const boatId = String(pick(boat, ["boatId", "id", "boat.id"], ""));
          const hasImage = Boolean(pick(boat, ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl", "imageUrls.0", "boat.imageUrls.0"], ""));
          return boatId && !hasImage ? boatId : "";
        })
        .filter((boatId) => boatId && !fetchedBoatImageIdsRef.current.has(boatId))
    )];

    if (missingIds.length === 0) return;
    missingIds.forEach((boatId) => fetchedBoatImageIdsRef.current.add(boatId));

    let isActive = true;
    (async () => {
      const entries = await Promise.all(missingIds.map(async (boatId) => {
        try {
          const detail = await fetchBoatDetail(boatId);
          return [boatId, pick(detail, ["imageUrl", "thumbnailUrl", "imageUrls.0"], "")];
        } catch {
          return [boatId, ""];
        }
      }));
      if (!isActive) return;
      setBoatImageOverrides((prev) => {
        const next = { ...prev };
        entries.forEach(([boatId, imageUrl]) => {
          if (imageUrl) next[boatId] = imageUrl;
        });
        return next;
      });
    })();

    return () => {
      isActive = false;
    };
  }, [booking?.quoteBoats, booking?.selectedBoats]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          <p className="text-xs font-headline font-black uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Đang tải..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-30 px-4 sm:px-6 lg:px-8 font-body">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-100 dark:border-slate-700/50 text-center shadow-sm">
            <h1 className="mt-3 text-xl font-headline font-black text-[#124757] dark:text-white">
              {lang === "VN" ? "Không thể tải chi tiết yêu cầu" : "Unable to load request details"}
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {loadError || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later.")}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <button onClick={() => navigate("/profile/my-charter-booking")} className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 font-bold text-sm">
                {lang === "VN" ? "Quay lại danh sách" : "Back to requests"}
              </button>
              <button onClick={loadDetail} className="px-5 py-3 rounded-xl bg-[#124757] text-white font-bold text-sm">
                {lang === "VN" ? "Thử lại" : "Retry"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
  const balanceDue = getCharterBalanceDue(booking);
  const isPaymentStatusPaid = String(booking.paymentStatus).toLowerCase() === "paid";
  const isPaid = isPaymentStatusPaid && balanceDue <= 0;
  const isTerminalBooking = ["Cancelled", "Expired", "Refunded"].includes(booking.status);
  const canShowPayOsSection = !isTerminalBooking
    && !["Quoted", "PendingQuote", "Completed"].includes(booking.status)
    && hasCharterBalanceDue(booking);
  const canUseContactAsSinglePassenger = isSinglePassengerWithContact(booking, user) && !hasSavedPassengerManifest(booking);
  const bookerAsFirstPassenger = canPrefillBookerAsFirstPassenger(booking, user);
  const paidAmount = Number(booking.paidAmount || 0);
  const quoteBoatRows = (Array.isArray(booking.quoteBoats) && booking.quoteBoats.length > 0
    ? booking.quoteBoats
    : booking.selectedBoats
  ).map((boat, index) => {
    const boatOrder = pick(boat, ["boatOrder", "order"], index + 1);
    const selectedBoat = Array.isArray(booking.selectedBoats)
      ? booking.selectedBoats.find((item) => String(pick(item, ["boatOrder", "order"], index + 1)) === String(boatOrder))
      : null;
    const extractedBoatId = String(pick(boat, ["boatId", "id", "boat.id"], ""));
    const fallbackBoatId = String(pick(selectedBoat, ["boatId", "id", "boat.id"], ""));
    const resolvedBoatId = extractedBoatId || fallbackBoatId || "";

    return {
      boatOrder,
      boatId: resolvedBoatId,
      name: getBoatDisplayName(boat, getBoatDisplayName(selectedBoat, `${lang === "VN" ? "Tàu" : "Boat"} ${boatOrder}`)),
      numberOfDecks: getRequestedDeckCount(boat) || getRequestedDeckCount(selectedBoat),
      seatSetupType: pick(boat, ["seatSetupType", "requiredSeatSetupType", "boat.seatSetupType"], pick(selectedBoat, ["seatSetupType", "requiredSeatSetupType"], "--")),
      imageUrl: pick(
        boat,
        ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl", "imageUrls.0", "boat.imageUrls.0"],
        pick(selectedBoat, ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl", "imageUrls.0", "boat.imageUrls.0"], ""),
      ) || boatImageOverrides[resolvedBoatId] || "",
      seatCount: pick(boat, ["seatCount", "capacity", "boat.seatCount", "boat.capacity"], pick(selectedBoat, ["seatCount", "capacity", "boat.seatCount", "boat.capacity"], "")),
      status: pick(boat, ["status", "boat.status"], pick(selectedBoat, ["status", "boat.status"], "")),
      unitPrice: Number(pick(boat, ["unitPrice", "price", "boat.unitPrice"], 0)) || 0,
      chargeableDurationValue: pick(boat, ["chargeableDurationValue", "chargeableDuration", "durationValue"], ""),
      subtotalAmount: Number(pick(boat, ["subtotalAmount", "totalAmount", "amount"], 0)) || 0,
    };
  });
  const quoteTotal = booking.totalAmount || booking.estimatedPrice;
  const boatsRentalTotal = quoteBoatRows.reduce((sum, boat) => sum + (Number(boat.subtotalAmount) || 0), 0);
  const defaultInsuranceAmount = Number(booking.defaultInsuranceAmount ?? booking.insurance?.defaultInsuranceAmount ?? 0) || 0;
  const optionalInsuranceAmount = Number(booking.optionalInsuranceAmount ?? booking.insurance?.optionalInsuranceAmount ?? 0) || 0;
  const legacyInsuranceTotal = Number(booking.insurance?.totalAmount) || 0;
  const insuranceQuoteAmount = booking.insuranceSelected !== false
    ? Math.max(defaultInsuranceAmount + optionalInsuranceAmount, legacyInsuranceTotal)
    : 0;
  const quoteDiscountAmount = Number(booking.discountAmount) || 0;
  const displayQuoteTotal = quoteTotal > 0
    ? quoteTotal
    : Math.max(boatsRentalTotal + insuranceQuoteAmount - quoteDiscountAmount, 0);
  const customerQuotePreview = buildBookingQuotePreview(booking) || {
    boats: [],
    totalAmount: displayQuoteTotal,
  };
  const hasQuote = booking.status !== "PendingQuote" && (quoteBoatRows.length > 0 || booking.estimatedPrice > 0);
  const storedPaymentOrderCode = sessionStorage.getItem(`charterPaymentOrderCode:${booking.id}`);
  const storedPaymentId = sessionStorage.getItem(`charterPayment:${booking.id}`);
  const activePendingPayment = Array.isArray(booking.payments)
    ? booking.payments.find((payment) => {
      const isPending = String(payment.paymentStatus).toLowerCase() === "pending";
      const expiresAt = getPaymentExpiresAt(payment);
      return isPending && (!expiresAt || !isDeadlineExpired(expiresAt, nowTick));
    })
    : null;
  const statePaymentIsActive = Boolean(paymentCheckoutUrl || booking.latestPaymentCheckoutUrl || paymentQrCode || booking.latestPaymentQrCode)
    && (!paymentExpiresAt || !isDeadlineExpired(paymentExpiresAt, nowTick));
  const pendingPaymentId = activePendingPayment
    ? pick(activePendingPayment, ["paymentId", "id"], booking.latestPaymentId || storedPaymentId)
    : (statePaymentIsActive ? (booking.latestPaymentId || storedPaymentId) : "");
  const pendingPaymentOrderCode = activePendingPayment
    ? pick(activePendingPayment, ["orderCode", "paymentOrderCode", "payosOrderCode"], booking.latestPaymentOrderCode || storedPaymentOrderCode)
    : (statePaymentIsActive ? (booking.latestPaymentOrderCode || storedPaymentOrderCode) : "");
  const effectiveCheckoutUrl = activePendingPayment
    ? pick(activePendingPayment, ["checkoutUrl", "paymentUrl"], booking.latestPaymentCheckoutUrl)
    : (statePaymentIsActive ? (paymentCheckoutUrl || booking.latestPaymentCheckoutUrl) : "");
  const effectivePaymentExpiresAt = activePendingPayment
    ? pick(activePendingPayment, ["expiresAt"], booking.latestPaymentExpiresAt)
    : (statePaymentIsActive ? (paymentExpiresAt || booking.latestPaymentExpiresAt) : "");
  const expiredPendingPayment = Array.isArray(booking.payments)
    ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending" && isDeadlineExpired(getPaymentExpiresAt(payment), nowTick))
    : null;
  const expiredPaymentCheckoutUrl = pick(expiredPendingPayment, ["checkoutUrl", "paymentUrl"], "");
  const quotePaymentDeadline = getCharterQuotePaymentDeadline(booking);
  const showQuotePaymentCountdown = shouldShowCharterQuotePaymentCountdown(booking);
  const quotePaymentRemainingMs = showQuotePaymentCountdown ? getRemainingMs(quotePaymentDeadline, nowTick) : 0;
  const hasQuotePaymentDeadline = showQuotePaymentCountdown && Boolean(getDeadlineTime(quotePaymentDeadline));
  const isQuotePaymentExpired = hasQuotePaymentDeadline && quotePaymentRemainingMs <= 0;
  const isQuoteHoldExpired = isQuotePaymentExpired;
  const paymentRemainingMs = getRemainingMs(effectivePaymentExpiresAt, nowTick);
  const hasPaymentDeadline = Boolean(getDeadlineTime(effectivePaymentExpiresAt));
  const isPaymentLinkExpired = hasPaymentDeadline && paymentRemainingMs <= 0;
  const isBookingHoldExpired = isQuotePaymentExpired;
  const hasPendingPayOs = Boolean(pendingPaymentId || effectiveCheckoutUrl);
  // BE đang block việc dùng điểm khi booking đã có payment pending/paid (xem validation
  // `Booking.Payments.Any(p => Status in {Pending, Paid})` trong service BE). Workaround
  // phía FE: ẩn checkbox "Dùng điểm" cho tới khi BE cho phép. Khi BE fix xong, xoá block này.
  const hasBlockingPaymentForPoints = Boolean(
    Array.isArray(booking.payments)
    && booking.payments.some((payment) => {
      const status = String(payment?.paymentStatus || "").toLowerCase();
      return status === "pending" || isPaidPayment(payment);
    })
  );
  const canCreatePayment = (
    ["PendingPayment", "Confirmed"].includes(booking.status)
    || (balanceDue > 0 && ["Approved", "Confirmed", "PendingPayment"].includes(booking.status))
  )
    && balanceDue > 0
    && !hasPendingPayOs
    && !isQuoteHoldExpired
    && !isBookingHoldExpired
    && !isPastPassengerAddGrace(booking, nowTick)
    && !["Expired", "Cancelled", "Completed", "Refunded"].includes(booking.status);
  const passengerAddDeadline = getPassengerAddDeadline(booking);
  const isInPassengerAddGrace = Boolean(passengerAddDeadline)
    && nowTick < passengerAddDeadline
    && getLatestPassengerAddedAt(booking);
  const passengerAddRemainingMs = isInPassengerAddGrace
    ? Math.max(0, passengerAddDeadline - nowTick)
    : 0;
  const paidDepositAmount = Number(booking.paidDepositAmount || 0);
  const promoApplied =
    Boolean(promoPreview?.ok)
    && String(promoPreview?.code || "").trim().toUpperCase() === String(paymentPromotionCode || "").trim().toUpperCase();
  const payableQuoteTotal = promoApplied && !booking.hasDepositPaid
    ? Math.max(0, Number(promoPreview.finalAmount) || 0)
    : quoteTotal;
  const quoteDepositAmount = getCharterDepositAmount(quoteTotal, booking.depositAmount);
  const depositPaymentAmount = getCharterDepositAmount(payableQuoteTotal, booking.depositAmount);
  const canPayDeposit = depositPaymentAmount > 0 && !booking.hasDepositPaid;
  const usesDefaultDeposit = !(Number(booking.depositAmount) > 0);
  const effectivePaidAmount = Math.max(paidAmount, booking.hasDepositPaid ? paidDepositAmount || quoteDepositAmount : 0);
  const computedRemaining = promoApplied && booking.hasDepositPaid
    ? Math.max(0, Number(promoPreview.finalAmount) || 0)
    : Math.max(payableQuoteTotal - effectivePaidAmount, 0);
  const remainingAmount = booking.remainingAmount !== undefined && booking.remainingAmount !== null
    ? Math.max(0, Number(booking.remainingAmount) || 0)
    : computedRemaining;
  const needsBalancePayment = Boolean(booking.requiresAdditionalPayment && booking.hasDepositPaid)
    || (remainingAmount > 0 && effectivePaidAmount > 0 && booking.hasDepositPaid)
    || (Number(booking.additionalInsuranceAmount) > 0 && booking.hasDepositPaid);
  const normalizedPaymentOption = (needsBalancePayment || booking.hasDepositPaid)
    ? "Remaining"
    : paymentOption === "Remaining"
      ? "Full"
      : paymentOption;
  const paymentChoices = [
    {
      id: "Deposit",
      label: lang === "VN" ? "Đặt cọc" : "Deposit",
      disabled: booking.hasDepositPaid || depositPaymentAmount <= 0,
      amount: depositPaymentAmount,
      originalAmount: promoApplied ? quoteDepositAmount : null,
    },
    {
      id: "Full",
      label: lang === "VN" ? "Thanh toán đủ" : "Full",
      disabled: booking.hasDepositPaid, // Full chỉ chọn được khi chưa đặt cọc
      amount: booking.hasDepositPaid ? remainingAmount : payableQuoteTotal,
      originalAmount: promoApplied && !booking.hasDepositPaid ? quoteTotal : null,
    },
    {
      id: "Remaining",
      label: lang === "VN" ? "Phần còn lại" : "Remaining",
      // Chỉ hiển thị và chọn được khi ĐÃ đặt cọc
      disabled: !booking.hasDepositPaid,
      amount: remainingAmount,
      originalAmount: promoApplied && booking.hasDepositPaid
        ? Math.max(quoteTotal - effectivePaidAmount, 0)
        : null,
    },
  ];
  // Chỉ hiển thị Remaining khi đã đặt cọc
  const selectablePaymentChoices = booking.hasDepositPaid
    ? paymentChoices
    : paymentChoices.filter((choice) => choice.id !== "Remaining");
  const paymentSelectValue = selectablePaymentChoices.some((choice) => choice.id === normalizedPaymentOption)
    ? normalizedPaymentOption
    : selectablePaymentChoices.find((choice) => choice.id === "Full")?.id || selectablePaymentChoices[0]?.id || "Full";
  const selectedPaymentAmount = paymentSelectValue === "Deposit"
    ? depositPaymentAmount
    : paymentSelectValue === "Remaining"
      ? remainingAmount
      : booking.hasDepositPaid
        ? remainingAmount
        : payableQuoteTotal;
  // User chỉ có 2 lựa chọn: KHÔNG dùng điểm (0) hoặc dùng TỐI ĐA (maxPointsToUse).
  // Áp dụng cho cả Deposit/Full/Remaining — tương tự flow trip.
  const maxPointsToUse = pointBalanceLoaded
    ? getMaxPointsToUse(pointBalance, selectedPaymentAmount)
    : 0;
  const pointsToUse = useAllPoints ? maxPointsToUse : 0;
  const estimatedPayable = Math.max(0, selectedPaymentAmount - pointsToUse);
  const effectivePendingPaymentAmount = activePendingPayment
    ? getPaymentAmount(activePendingPayment) || selectedPaymentAmount
    : Number(paymentAmount || booking.latestPaymentAmount || selectedPaymentAmount) || selectedPaymentAmount;
  const effectivePaymentDeadline = effectivePaymentExpiresAt || paymentWatcher.deadline || "";
  const paymentWatcherRemainingMs = getRemainingMs(effectivePaymentDeadline, nowTick);
  const routeStops = booking.route && booking.route !== "--" ? booking.route.split(/\s+-\s+/) : [];
  const estimateLegs = Array.isArray(booking.routeEstimate?.legs) ? booking.routeEstimate.legs : [];
  const routeFrom = booking.fromStationName
    || estimateLegs[0]?.fromStationName
    || routeStops[0]
    || "--";
  const routeTo = booking.toStationName
    || estimateLegs[estimateLegs.length - 1]?.toStationName
    || routeStops[1]
    || "--";
  const scheduleItems = [
    { label: lang === "VN" ? "Ngày giờ đi" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime || "--").slice(0, 5)}` },
    {
      label: lang === "VN" ? "Hình thức thuê" : "Rental type",
      value: booking.rentalUnit === "Hour"
        ? (lang === "VN" ? "Theo giờ" : "Hourly")
        : booking.rentalUnit === "Day"
          ? (lang === "VN" ? "Theo ngày" : "Daily")
          : (lang === "VN" ? "Chờ báo giá" : "Pending quote"),
      description: booking.rentalUnit
        ? (lang === "VN"
          ? "Thời lượng tính tiền do hệ thống ước tính từ lộ trình"
          : "Chargeable duration is estimated from the route")
        : (lang === "VN"
          ? "Hình thức và thời lượng tính tiền sẽ có khi admin chốt giá"
          : "Rental type and chargeable duration appear once quoted"),
    },
    {
      label: lang === "VN" ? "Hành khách" : "Passengers",
      value: lang === "VN" ? `${booking.passengerCount} khách` : `${booking.passengerCount} guests`,
      description: lang === "VN"
        ? `${booking.adultCount} người lớn / ${booking.childCount} trẻ em`
        : `${booking.adultCount} adults / ${booking.childCount} children`,
    },
  ];
  const contactItems = [
    { label: lang === "VN" ? "Người liên hệ" : "Contact Name", value: booking.contactName },
    { label: lang === "VN" ? "Số điện thoại" : "Phone", value: booking.contactPhone },
    { label: "Email", value: booking.contactEmail },
  ];
  const itineraryTimelineItems = [
    { type: "start", label: lang === "VN" ? "Bến đón" : "Pickup", name: routeFrom },
    ...(Array.isArray(booking.itineraryStops) ? booking.itineraryStops.map((stop, index) => ({
      type: "stop",
      label: lang === "VN" ? `Điểm dừng ${index + 1}` : `Stop ${index + 1}`,
      name: stop.stationName || "--",
      meta: Number(stop.stayDurationMinutes) > 0 ? `${stop.stayDurationMinutes} ${lang === "VN" ? "phút dừng" : "min stay"}` : "",
    })) : []),
    { type: "end", label: lang === "VN" ? "Bến trả" : "Drop-off", name: routeTo },
  ];
  const requestedDeckItems = Array.isArray(booking.requestedBoats)
    ? booking.requestedBoats.map((boat, index) => ({
      order: pick(boat, ["boatOrder", "order"], index + 1),
      deckText: formatDeckCount(getRequestedDeckCount(boat), lang),
      seatSetupType: pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "--"),
    }))
    : [];
  const showTicketsTab = isPaymentStatusPaid || canShowCharterTicketsWithBalance(booking) || booking.hasDepositPaid;
  // Badge tab: "!" khi có hành động khẩn (báo giá cần trả lời, cần thanh toán, chờ nhập hoàn tiền);
  // số lượng payments/tickets khi tab đó có dữ liệu mới — giống cơ chế bên Admin.
  const actionInfo = getCustomerActionInfo(booking, lang);
  const needsPaymentAttention = actionInfo.urgent && ["pay", "refund"].includes(actionInfo.tone);
  const paymentsCount = Array.isArray(booking.payments) ? booking.payments.length : 0;
  const paymentBadge = needsPaymentAttention ? "!" : (paymentsCount || "");
  const ticketsCount = Array.isArray(booking.tickets) ? booking.tickets.length : 0;
  const ticketsBadge = showTicketsTab ? (ticketsCount || "") : "";
  const manifestRows = listBookingPassengers(booking).filter((row) => {
    if (!hasCharterPassengerName(row)) return false;
    return normalizePassengerApprovalStatus(
      pick(row, ["approvalStatus", "passengerApprovalStatus", "addRequestStatus"], "Approved"),
    ) === "Approved";
  });
  const passengersCount = manifestRows.length;
  const passengersBadge = passengersCount > 0 ? String(passengersCount) : "";

  const detailTabs = [
    { id: "overview", label: lang === "VN" ? "Tổng quan" : "Overview" },
    { id: "quote", label: lang === "VN" ? "Tàu/báo giá" : "Boat/Quote" },
    { id: "payment", label: lang === "VN" ? "Thanh toán" : "Payment", badge: paymentBadge },
    {
      id: "tickets",
      label: lang === "VN" ? "Hành khách & vé" : "Passengers & tickets",
      badge: ticketsBadge || passengersBadge,
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-30 px-4 sm:px-6 lg:px-8 font-body transition-colors">
        <main className="max-w-6xl mx-auto space-y-6">
          {loadError && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 text-amber-800 dark:text-amber-300">
              <p className="text-xs font-bold">{loadError}</p>
              <button onClick={loadDetail} className="shrink-0 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 text-xs font-black uppercase">
                {lang === "VN" ? "Thử lại" : "Retry"}
              </button>
            </div>
          )}

          {/* ===== TITLE ===== */}
          <section className="overflow-hidden bg-white dark:bg-slate-800 rounded-4xl shadow-[0_24px_70px_rgba(15,23,42,0.10)] border border-slate-200/70 dark:border-slate-700/70">
            <div className="px-6 py-6 md:px-8">
              <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                <div className="flex min-w-0 items-start gap-3">
                  {/* Nút back gắn trong section header, cùng pattern với TripDetail.jsx (Admin) */}
                  <button
                    type="button"
                    onClick={() => navigate("/profile/my-charter-booking")}
                    aria-label={lang === "VN" ? "Quay lại danh sách" : "Back to Requests"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-[#124757] hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-yellow-400 dark:hover:text-slate-900"
                  >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl md:text-4xl font-headline font-black text-[#0E4050] dark:text-yellow-400 tracking-tight">{booking.bookingCode}</h1>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-headline font-black uppercase tracking-wide ${statusInfo.classes
                        .split(" ")
                        .filter((cls) => cls.includes("text-"))
                        .join(" ")
                        }`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {lang === "VN" ? "Tạo vào lúc" : "Created at"} {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row xl:flex-col gap-3 xl:items-end">
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {booking.status === "PendingQuote" && (
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/my-charter-booking/edit/${booking.id}`)}
                        disabled={isSubmitting}
                        className="px-5 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60 shadow-sm"
                      >
                        {lang === "VN" ? "Chỉnh sửa" : "Edit"}
                      </button>
                    )}
                    {bookingWaitsCustomerRefundInfo(booking) && (
                      <button
                        type="button"
                        onClick={handleOpenRefundForm}
                        disabled={isSubmitting}
                        className="px-5 py-3 rounded-xl bg-amber-600 text-white font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60 shadow-sm"
                      >
                        {lang === "VN" ? "Nhập thông tin hoàn tiền" : "Enter refund info"}
                      </button>
                    )}
                    {!["Cancelled", "Completed", "Refunded"].includes(booking.status) && (
                      <button onClick={handleCancelBooking} disabled={isSubmitting} className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60 shadow-sm">
                        {lang === "VN" ? "Hủy yêu cầu" : "Cancel Request"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===== TABS ===== */}
          <div className="sticky top-35 z-20 rounded-3xl border border-slate-100 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95">
            <div className={`grid grid-cols-2 gap-2 ${detailTabs.length >= 4 ? "md:grid-cols-4" : detailTabs.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {detailTabs.map((tab) => {
                const active = activeTab === tab.id;
                const showBadge = tab.badge
                  && activeTab !== tab.id
                  && shouldShowCustomerTabBadge(id, tab.id, tab.badge, acknowledgedTabBadges);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => goToTab(tab.id, tab.badge)}
                    className={`relative flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[10px] font-headline font-black uppercase tracking-wider transition-all ${active
                      ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                      }`}
                  >
                    <span className="truncate">{tab.label}</span>
                    {showBadge ? (
                      <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-black ${tab.badge === "!" ? "bg-rose-500 text-white" : "bg-[#FFD100] text-slate-900"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== WORKFLOW STEPPER ===== */}
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {lang === "VN" ? "Tiến trình booking" : "Booking progress"}
            </p>
            <CharterWorkflowStepper status={booking.status} lang={lang} booking={booking} paymentStatus={booking.paymentStatus} />
          </div>

          {/* ===== SECTION 1: REQUEST OVERVIEW ===== */}
          {activeTab === "overview" && (
            <section className="overflow-hidden bg-white dark:bg-slate-800 rounded-4xl shadow-[0_18px_50px_rgba(15,23,42,0.07)] border border-slate-200/70 dark:border-slate-700/70">
              <div className="border-b border-slate-100 dark:border-slate-700/70 px-6 py-5 md:px-8">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">
                      {lang === "VN" ? "Tổng quan yêu cầu" : "Request Overview"}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      {lang === "VN" ? "Thông tin lộ trình, hành khách và liên hệ" : "Route, passenger, and contact details"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 md:px-8">
                <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl border border-[#D8E7EA] bg-[#F7FAFB] p-4 dark:border-slate-700 dark:bg-slate-900">
                    <div className="min-w-0">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                        {lang === "VN" ? "Lộ trình dự kiến" : "Planned Route"}
                      </p>
                      <p className="mt-0.5 truncate text-base font-headline font-black text-[#0E4050] dark:text-white sm:text-lg">
                        {routeFrom} <span className="text-slate-300">/</span> {routeTo}
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {itineraryTimelineItems.map((item, index) => {
                        const isLast = index === itineraryTimelineItems.length - 1;
                        const isEndpoint = item.type !== "stop";
                        const marker =
                          item.type === "start"
                            ? "A"
                            : item.type === "end"
                              ? "B"
                              : String(index);
                        return (
                          <div
                            key={`${item.type}-${item.name}-${index}`}
                            className="grid grid-cols-[24px_1fr] items-stretch gap-2.5"
                          >
                            <div className="flex flex-col items-center">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-headline font-black leading-none ${isEndpoint
                                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                                  : "bg-white text-slate-500 ring-2 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600"
                                  }`}
                              >
                                {marker}
                              </span>
                              {!isLast ? (
                                <span className="mt-1 w-0.5 min-h-2 flex-1 bg-slate-200 dark:bg-slate-600" />
                              ) : null}
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-headline font-black uppercase tracking-widest leading-none text-slate-400">{item.label}</p>
                                  <p className="mt-1 truncate text-sm font-headline font-black leading-tight text-[#0E4050] dark:text-slate-100">{item.name}</p>
                                </div>
                                {item.meta ? (
                                  <span className="w-max text-[10px] font-bold text-amber-700 dark:text-yellow-300">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col rounded-3xl border border-slate-200 bg-[#F8FBFC] px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Thông tin liên hệ" : "Contact details"}
                    </p>
                    <div className="mt-3 grid flex-1 gap-3 sm:grid-cols-2">
                      {contactItems.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                          <p className="mt-1 wrap-break-words text-sm font-bold text-slate-700 dark:text-slate-200">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Ghi chú" : "Special requests"}</p>
                      <p className="mt-1 wrap-break-words text-sm font-bold text-slate-700 dark:text-slate-200">{booking.specialRequests || (lang === "VN" ? "Không có" : "None")}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {scheduleItems.map((item) => (
                      <div key={item.label} className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900">
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                        <p className="mt-1 text-lg font-headline font-black leading-snug text-slate-800 dark:text-white wrap-break-words">{item.value}</p>
                        {item.description && (
                          <p className="mt-1 text-xs font-bold leading-snug text-slate-400 dark:text-slate-500">{item.description}</p>
                        )}
                      </div>
                    ))}

                    <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tàu yêu cầu" : "Requested Boats"}</p>
                      <p className="mt-1 text-lg font-headline font-black leading-snug text-slate-800 dark:text-white wrap-break-words">
                        {requestedDeckItems.length > 0
                          ? (lang === "VN" ? `${requestedDeckItems.length} tàu` : `${requestedDeckItems.length} boat${requestedDeckItems.length > 1 ? "s" : ""}`)
                          : (lang === "VN" ? "Chờ báo giá" : "Pending quote")}
                      </p>
                      {requestedDeckItems.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {requestedDeckItems.map((boat) => (
                            <span key={`${boat.order}-${boat.deckText || boat.seatSetupType}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-headline font-black text-[#124757] shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#124757] text-[8px] text-white dark:bg-yellow-400 dark:text-slate-900">{boat.order}</span>
                              {boat.deckText || boat.seatSetupType}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex">
                    <CharterInsuranceInfo
                      booking={booking}
                      lang={lang}
                      currencyFormatter={currencyFormatter}
                      className="flex w-full flex-col"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ===== SECTION 1B + 3: PASSENGER LIST + TICKETS (merged) ===== */}
          {activeTab === "tickets" && (
            <div className="space-y-6">
              <MyCharterTicketsPanel
                lang={lang}
                booking={booking}
                isPaid={isPaid || canShowCharterTicketsWithBalance(booking) || booking.hasDepositPaid}
                isSubmitting={isSubmitting}
                qrImageUrl={qrImageUrl}
                selectedTicketIds={selectedTicketIds}
                setSelectedTicketIds={setSelectedTicketIds}
                passengerRows={passengerRows}
                canUseContactAsSinglePassenger={canUseContactAsSinglePassenger}
                bookerAsFirstPassenger={bookerAsFirstPassenger}
                bookerName={getBookerPassengerName(booking, user)}
                importInputRef={importInputRef}
                isUsableText={isUsableText}
                handleTicketFileAction={handleTicketFileAction}
                handleImportPassengers={handleImportPassengers}
                handlePassengerChange={handlePassengerChange}
                handleSavePassengers={handleSavePassengers}
                handleAddPassengers={handleAddPassengers}
                readOnlyMode={!showTicketsTab}
              />
            </div>
          )}

          {/* ===== SECTION 2: BOAT & QUOTE ===== */}
          {activeTab === "quote" && (
            <section className="bg-white dark:bg-slate-800 rounded-4xl shadow-[0_18px_50px_rgba(15,23,42,0.06)] border border-slate-200/70 dark:border-slate-700/70 px-6 py-6 md:px-8">
              <h2 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">
                {lang === "VN" ? "Tàu & báo giá" : "Boat & Quote"}
              </h2>

              {booking.status === "PendingQuote" ? (
                <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <h3 className="font-headline text-lg font-black">{lang === "VN" ? "Chưa có báo giá" : "No quote yet"}</h3>
                  <p className="mt-1 text-sm font-medium">{lang === "VN" ? "Đội vận hành đang chọn tàu và chốt giá. Khi có báo giá, tàu và chi tiết giá sẽ hiển thị ở mục này." : "The operations team is assigning boats and pricing. Boat and quote details will appear here."}</p>
                </div>
              ) : hasQuote && (
                <div className="mt-4 overflow-hidden rounded-3xl border border-[#D8E7EA] dark:border-slate-700 bg-[#F7FAFB] dark:bg-slate-900">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5">
                    <div>
                      <h3 className="mt-1 text-xl font-headline font-black text-[#0E4050] dark:text-yellow-400">{lang === "VN" ? "Chi tiết tàu và chi phí" : "Boat and pricing details"}</h3>
                    </div>
                  </div>

                  <div className="border-b border-[#D8E7EA] px-5 py-4 dark:border-slate-700">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Lộ trình" : "Route"}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến đón" : "Pickup"}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">{routeFrom}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Bến trả" : "Drop-off"}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">{routeTo}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ngày giờ đi" : "Departure"}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">
                          {formatDate(booking.departureDate)} · {String(booking.startTime || "--").slice(0, 5)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ước tính" : "Estimate"}</p>
                        <p className="mt-0.5 text-sm font-bold text-slate-800 dark:text-white">
                          {formatRouteEstimate(booking.routeEstimate)}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(booking.itineraryStops) && booking.itineraryStops.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {lang === "VN" ? "Điểm dừng" : "Stops"}
                        </p>
                        {booking.itineraryStops.map((stop, index) => (
                          <p key={`${stop.stationId || "stop"}-${index}`} className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {lang === "VN" ? `Dừng ${stop.stopOrder || index + 1}` : `Stop ${stop.stopOrder || index + 1}`}
                            {": "}
                            {stop.stationName || "--"}
                            {Number(stop.stayDurationMinutes) > 0
                              ? ` · ${stop.stayDurationMinutes} ${lang === "VN" ? "phút" : "min"}`
                              : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <CharterRouteMapPanel
                        lang={lang}
                        booking={booking}
                        heightClassName="h-64 md:h-72"
                        className="border-[#D8E7EA] dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {quoteBoatRows.length > 0 ? (
                    <div className="divide-y divide-[#D8E7EA] dark:divide-slate-700">
                      {quoteBoatRows.map((boat) => (
                        <div key={`${boat.boatOrder}-${boat.name}`} className="flex items-center gap-4 px-5 py-4">
                          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
                            {boat.imageUrl ? (
                              <img src={boat.imageUrl} alt={boat.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-500">
                                <NullImageIcon className="h-8 w-8" />
                              </div>
                            )}
                            <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#124757] text-[10px] font-headline font-black text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900">
                              {boat.boatOrder}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="min-w-0 truncate font-headline font-black text-slate-900 dark:text-white">{boat.name}</p>
                              <BoatSeatLayoutPreviewButton
                                boatId={boat.boatId}
                                boatName={boat.name}
                                boatImageUrl={boat.imageUrl}
                                lang={lang}
                                boatMeta={{
                                  seatCount: boat.seatCount,
                                  numberOfDecks: boat.numberOfDecks,
                                  seatSetupType: boat.seatSetupType,
                                  imageUrl: boat.imageUrl,
                                }}
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-headline font-black text-[#124757] dark:text-yellow-400">
                                {formatDeckCount(boat.numberOfDecks, lang) || boat.seatSetupType}
                              </span>
                              {boat.seatCount !== "" && (
                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                                  {boat.seatCount} {lang === "VN" ? "ghế" : "seats"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8">
                      <div className="rounded-2xl border border-dashed border-[#BFD4D9] bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="font-headline text-lg font-black text-[#0E4050] dark:text-white">{lang === "VN" ? "Chưa nhận được chi tiết tàu" : "Boat details are not available"}</h3>
                        <p className="mx-auto mt-1 max-w-lg text-sm font-medium text-slate-500 dark:text-slate-400">
                          {lang === "VN" ? "Chưa có thông tin chi tiết từng tàu cho yêu cầu này. Tổng giá đã chốt vẫn được hiển thị ở phần bên dưới." : "Detailed boat information isn't available for this request yet. The confirmed total is still shown below."}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5">
                    {(() => {
                      const previewHasPricedBoats = Array.isArray(customerQuotePreview?.boats)
                        && customerQuotePreview.boats.some((boat) => (
                          Number(boat?.subtotalAmount) > 0 || Number(boat?.unitPrice) > 0
                        ));
                      const previewHasTotal = Number(customerQuotePreview?.totalAmount) > 0 || displayQuoteTotal > 0;

                      if (previewHasPricedBoats || (customerQuotePreview?.boats?.length > 0 && previewHasTotal)) {
                        return (
                          <CharterQuotePreviewTable
                            preview={{
                              ...customerQuotePreview,
                              totalAmount: Number(customerQuotePreview?.totalAmount) > 0
                                ? customerQuotePreview.totalAmount
                                : displayQuoteTotal,
                            }}
                            booking={booking}
                            lang={lang}
                            currencyFormatter={currencyFormatter}
                          />
                        );
                      }

                      if (displayQuoteTotal > 0) {
                        return (
                          <div className="overflow-hidden rounded-2xl bg-[#124757] text-white shadow-[0_12px_30px_rgba(18,71,87,0.25)] dark:bg-yellow-400 dark:text-slate-900">
                            <div className="flex items-end justify-between gap-3 px-4 py-4">
                              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/70 dark:text-slate-900/60">
                                {lang === "VN" ? "Tổng chốt giá" : "Quote total"}
                              </p>
                              <p className="font-headline text-2xl font-black tabular-nums tracking-tight">
                                {currencyFormatter.format(displayQuoteTotal)}
                              </p>
                            </div>
                            {quoteDepositAmount > 0 ? (
                              <div className="flex items-center justify-between gap-3 border-t border-white/15 px-4 py-3 dark:border-slate-900/15">
                                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/70 dark:text-slate-900/60">
                                  {lang === "VN" ? "Đặt cọc 50%" : "Deposit 50%"}
                                </p>
                                <p className="text-sm font-headline font-black tabular-nums text-emerald-200 dark:text-emerald-800">
                                  {currencyFormatter.format(quoteDepositAmount)}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <div className="rounded-2xl border border-dashed border-[#BFD4D9] bg-[#F7FAFB] px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-900">
                          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                            {lang === "VN"
                              ? "Đã có báo giá nhưng chưa nhận được chi tiết số tiền. Thử tải lại trang."
                              : "A quote exists but pricing details are missing. Try refreshing the page."}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ===== SECTION 2B: PAYMENT ===== */}
          {activeTab === "payment" && (
            <section className="bg-white dark:bg-slate-800 rounded-4xl shadow-[0_18px_50px_rgba(15,23,42,0.06)] border border-slate-200/70 dark:border-slate-700/70 px-6 py-6 md:px-8">
              <h2 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">
                {lang === "VN" ? "Thanh toán" : "Payment"}
              </h2>

              {hasQuote ? (
                <MyCharterPaymentPanel
                  lang={lang}
                  booking={booking}
                  currencyFormatter={currencyFormatter}
                  paymentSectionRef={paymentSectionRef}
                  isPaid={isPaid}
                  isTerminalBooking={isTerminalBooking}
                  canShowPayOsSection={canShowPayOsSection}
                  isSubmitting={isSubmitting}
                  isQuoteHoldExpired={isQuoteHoldExpired}
                  isQuotePaymentExpired={isQuotePaymentExpired}
                  showQuotePaymentCountdown={showQuotePaymentCountdown}
                  quotePaymentRemainingMs={quotePaymentRemainingMs}
                  expiredPendingPayment={expiredPendingPayment}
                  expiredPaymentCheckoutUrl={expiredPaymentCheckoutUrl}
                  paymentCheckoutUrl={paymentCheckoutUrl}
                  isPaymentLinkExpired={isPaymentLinkExpired}
                  hasPendingPayOs={hasPendingPayOs}
                  canCreatePayment={canCreatePayment}
                  isInPassengerAddGrace={isInPassengerAddGrace}
                  passengerAddRemainingMs={passengerAddRemainingMs}
                  passengerAddDeadline={passengerAddDeadline}
                  selectablePaymentChoices={selectablePaymentChoices}
                  paymentSelectValue={paymentSelectValue}
                  setPaymentOption={setPaymentOption}
                  usesDefaultDeposit={usesDefaultDeposit}
                  canPayDeposit={canPayDeposit}
                  selectedPaymentAmount={selectedPaymentAmount}
                  effectivePaidAmount={effectivePaidAmount}
                  remainingAmount={remainingAmount}
                  paymentPromotionCode={paymentPromotionCode}
                  setPaymentPromotionCode={handlePaymentPromotionCodeChange}
                  promoPreview={promoPreview}
                  promoChecking={promoChecking}
                  onApplyPromotionCode={handleApplyPromotionCode}
                  onClearPromotionCode={handleClearPromotionCode}
                  effectiveCheckoutUrl={effectiveCheckoutUrl}
                  pendingPaymentOrderCode={pendingPaymentOrderCode}
                  pendingPaymentId={pendingPaymentId}
                  effectivePendingPaymentAmount={effectivePendingPaymentAmount}
                  effectivePaymentDeadline={effectivePaymentDeadline}
                  paymentWatcherRemainingMs={paymentWatcherRemainingMs}
                  handleRespondToQuote={handleRespondToQuote}
                  handleCreatePayment={handleCreatePayment}
                  openPaymentPage={openPaymentPage}
                  handleSyncPayment={handleSyncPayment}
                  handleSyncPaymentByOrderCode={handleSyncPaymentByOrderCode}
                  loadDetail={loadDetail}
                  useAllPoints={useAllPoints}
                  setUseAllPoints={setUseAllPoints}
                  pointBalance={pointBalance}
                  pointBalanceLoaded={pointBalanceLoaded}
                  pointsToUse={pointsToUse}
                  maxPointsToUse={maxPointsToUse}
                  estimatedPayable={estimatedPayable}
                  hasBlockingPaymentForPoints={hasBlockingPaymentForPoints}
                />
              ) : (
                <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <h3 className="font-headline text-lg font-black">{lang === "VN" ? "Chưa có báo giá" : "No quote yet"}</h3>
                  <p className="mt-1 text-sm font-medium">{lang === "VN" ? "Bạn cần chờ báo giá trước khi có thể thanh toán." : "Wait for a quote before you can make a payment."}</p>
                </div>
              )}
            </section>
          )}

          {/* ===== SECTION 3: TICKETS & PASSENGERS (merged into "tickets" tab above) ===== */}
        </main>
      </div>

      <MyCharterPaymentStickyBar
        lang={lang}
        isPaid={isPaid}
        isSubmitting={isSubmitting}
        canCreatePayment={canCreatePayment}
        hasPendingPayOs={hasPendingPayOs}
        selectedPaymentAmount={selectedPaymentAmount}
        effectivePendingPaymentAmount={effectivePendingPaymentAmount}
        effectiveCheckoutUrl={effectiveCheckoutUrl}
        pendingPaymentOrderCode={pendingPaymentOrderCode}
        effectivePaymentDeadline={effectivePaymentDeadline}
        currencyFormatter={currencyFormatter}
        openPaymentPage={openPaymentPage}
        handleCreatePayment={handleCreatePayment}
        useAllPoints={useAllPoints}
        pointsToUse={pointsToUse}
        estimatedPayable={estimatedPayable}
      />
    </>
  );
}
