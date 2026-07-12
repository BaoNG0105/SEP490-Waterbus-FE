import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Swal from "sweetalert2";
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
  printSelectedCharterBookingTickets,
  respondToCharterBookingQuote,
  updateMyCharterBookingPassengers,
} from "../../../services/charterBookingService";
import { createBookingPayment, syncBookingPayment, syncBookingPaymentByOrderCode } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { CharterRouteMapPanel } from "../../../components/CharterRouteMapPanel";
import { CharterInsuranceInfo } from "../../../components/CharterInsuranceInfo";
import { getBookingInsurancePackageId, normalizeInsuranceFromBooking, resolveInsuranceSelected } from "../../../utils/insurancePreview";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { shouldShowCharterQuotePaymentCountdown, getCharterQuotePaymentDeadline, getCharterDepositAmount } from "../../../utils/charterBookingActions";
import { buildBookingQuotePreview } from "../../../utils/charterQuotePreview";
import { getPassengerBirthYear } from "../../../utils/charterBookingTickets";
import { useCharterBookingDetailHub } from "../../../hooks/useCharterBookingDetailHub";
import { CharterQuotePreviewTable } from "../../../components/CharterQuotePreviewTable";
import { BoatSeatLayoutPreviewButton } from "../../../components/BoatSeatLayoutPreview";
import { MyCharterPaymentPanel, MyCharterPaymentStickyBar } from "./MyCharterPaymentPanel";
import { MyCharterTicketsPanel } from "./MyCharterTicketsPanel";

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

const DEFAULT_PAYMENT_LINK_MS = 5 * 60 * 1000;

const isDeadlineExpired = (deadline, now = Date.now()) => {
  const time = getDeadlineTime(deadline);
  return Boolean(time && now >= time);
};

const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;

const getPaymentCreatedAt = (payment) =>
  pick(payment, ["createdAt", "paymentCreatedAt", "createdDate", "createdTime"], "");

const getPaymentPurpose = (payment) =>
  String(pick(payment, ["paymentPurpose", "purpose", "type"], "")).toLowerCase();

const isPaidPayment = (payment) =>
  ["paid", "depositpaid", "success", "succeeded", "completed"].includes(String(payment?.paymentStatus).toLowerCase());

const getPaymentId = (payment) => pick(payment, [
  "paymentId",
  "id",
  "payment.id",
  "payment.paymentId",
  "paymentLinkId",
  "paymentLink.id",
  "linkPaymentId",
], "");

const getRefundablePayment = (booking) => {
  const payments = Array.isArray(booking?.payments) ? booking.payments : [];
  const paidPayment = payments.find((payment) => isPaidPayment(payment) && getPaymentId(payment));
  if (paidPayment) return paidPayment;

  const bookingPaymentId = pick(booking, ["paidPaymentId", "latestPaymentId", "paymentId", "payment.id"], "");
  if (bookingPaymentId) {
    return { paymentId: bookingPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  const storedPaymentId = booking?.id ? sessionStorage.getItem(`charterPayment:${booking.id}`) : "";
  if (storedPaymentId) {
    return { paymentId: storedPaymentId, paymentStatus: booking.paymentStatus, amount: booking.paidAmount };
  }

  return null;
};

const getEstimatedPaymentDeadline = (payment) => {
  const createdAt = getPaymentCreatedAt(payment);
  const createdTime = getDeadlineTime(createdAt);
  return createdTime ? new Date(createdTime + DEFAULT_PAYMENT_LINK_MS).toISOString() : "";
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
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
    createdAt: pick(item, ["createdAt"], ""),
    boatName: pick(item, ["boatName", "boat.name"], "--"),
    route: pick(item, ["routeName", "route", "itineraryName"], fromName || toName ? `${fromName || "--"} - ${toName || "--"}` : "--"),
    fromStationName: fromName || "",
    toStationName: toName || "",
    departureDate: pick(item, ["departureDate", "startDate"]),
    startTime: pick(item, ["startTime"], "--"),
    rentalUnit: pick(item, ["rentalUnit"], ""),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 0)) || 0,
    adultCount,
    childCount,
    passengerCount,
    status: pick(item, ["bookingStatus", "status"], "PendingQuote"),
    paymentStatus,
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
    bookingHoldExpiresAt: pick(item, ["bookingHoldExpiresAt"], pick(pendingPayment, ["bookingHoldExpiresAt"], "")),
    quotedAt: pick(item, ["quotedAt", "quoteSubmittedAt", "quoteAt", "quotedDate"], ""),
    updatedAt: pick(item, ["updatedAt", "modifiedAt"], ""),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: rawDepositAmount || paidDepositAmount,
    promotionCode: pick(item, ["promotionCode"], ""),
    specialRequests: pick(item, ["specialRequests"], "--"),
    insuranceSelected: resolveInsuranceSelected(item),
    insurancePackageId: getBookingInsurancePackageId(item),
    insurance: normalizeInsuranceFromBooking(item) || pick(item, ["insurance"], null),
    contactName: pick(item, ["contactName"], "--"),
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

const DEFAULT_BOAT_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png";

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

const isSinglePassengerWithContact = (booking) =>
  getBookingPassengerCount(booking) <= 1 && isUsableText(booking?.contactName);

const CURRENT_YEAR = new Date().getFullYear();
const MIN_BIRTH_YEAR = 1900;

const buildEmptyPassengerRows = (booking) => {
  const adultCount = Number(booking?.adultCount || 0);
  const childCount = Number(booking?.childCount || 0);
  const passengerCount = getBookingPassengerCount(booking);

  if (isSinglePassengerWithContact(booking)) {
    return [{
      fullName: booking.contactName.trim(),
      birthYear: "",
      passengerType: "Adult",
      isContactPassenger: true,
    }];
  }

  if (adultCount > 0 || childCount > 0) {
    return [
      ...Array.from({ length: adultCount }, () => ({ fullName: "", birthYear: "", passengerType: "Adult" })),
      ...Array.from({ length: childCount }, () => ({ fullName: "", birthYear: "", passengerType: "Child" })),
    ];
  }

  return Array.from({ length: Math.max(passengerCount, 1) }, () => ({ fullName: "", birthYear: "", passengerType: "Adult" }));
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

const buildPassengerPayload = (booking, rows, lang, { allowSingleContactWithoutBirthYear = false } = {}) => {
  const passengerCount = getBookingPassengerCount(booking);
  const normalizedRows = rows.map((row, index) => ({
    ...row,
    passengerType: row.passengerType || (index < Number(booking?.adultCount || 0) ? "Adult" : "Child"),
  }));
  const filledRows = normalizedRows.filter((row) => row.fullName?.trim() || String(row.birthYear || "").trim());
  const canUseSingleContact = allowSingleContactWithoutBirthYear && isSinglePassengerWithContact(booking);
  const rowsToSubmit = canUseSingleContact
    ? (filledRows.length > 0 ? [filledRows[0]] : buildEmptyPassengerRows(booking))
    : filledRows;

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

  if (!canUseSingleContact && passengerCount > 1 && rowsToSubmit.length < passengerCount) {
    return {
      errorTitle: lang === "VN" ? "Chưa đủ hành khách" : "Missing passengers",
      errorText: lang === "VN" ? `Booking có ${passengerCount} khách, vui lòng nhập đủ ${passengerCount} dòng hành khách.` : `This booking has ${passengerCount} passengers. Please enter all ${passengerCount} passenger rows.`,
    };
  }

  for (const row of rowsToSubmit) {
    const fullName = row.fullName?.trim();
    const birthYear = String(row.birthYear || "").trim();
    const skipBirthYearValidation = canUseSingleContact && !birthYear;

    if (!fullName || (!birthYear && !skipBirthYearValidation)) {
      return {
        errorTitle: lang === "VN" ? "Thiếu thông tin hành khách" : "Missing passenger info",
        errorText: lang === "VN" ? "Vui lòng nhập đủ họ tên và năm sinh cho từng hành khách." : "Please enter full name and birth year for each passenger.",
      };
    }

    if (!skipBirthYearValidation) {
      const age = getPassengerAgeFromBirthYear(birthYear, booking?.departureDate);
      if (age === null) {
        return {
          errorTitle: lang === "VN" ? "Năm sinh không hợp lệ" : "Invalid birth year",
          errorText: lang === "VN" ? `Năm sinh phải từ ${MIN_BIRTH_YEAR} đến ${CURRENT_YEAR}.` : `Birth year must be between ${MIN_BIRTH_YEAR} and ${CURRENT_YEAR}.`,
        };
      }
      if (row.passengerType === "Adult" && age < 12) {
        return {
          errorTitle: lang === "VN" ? "Tuổi người lớn chưa hợp lệ" : "Invalid adult age",
          errorText: lang === "VN" ? "Hành khách người lớn phải từ 12 tuổi trở lên." : "Adult passengers must be at least 12 years old.",
        };
      }
      if (row.passengerType === "Child" && age >= 12) {
        return {
          errorTitle: lang === "VN" ? "Tuổi trẻ em chưa hợp lệ" : "Invalid child age",
          errorText: lang === "VN" ? "Hành khách trẻ em phải dưới 12 tuổi." : "Child passengers must be under 12 years old.",
        };
      }
    }
  }

  return {
    passengers: rowsToSubmit.map((row) => ({
      fullName: row.fullName.trim(),
      birthYear: Number(row.birthYear),
    })),
  };
};

export function CharterDetail() {
  const { lang } = useApp();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
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

  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

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
      setBooking(normalized);
      const passengerSource = normalized.passengers.length > 0 ? normalized.passengers : normalized.tickets;
      const initialPassengers = passengerSource.length > 0
        ? passengerSource.map((passenger, index) => {
          const matchingTicket = normalized.tickets[index] || {};
          return {
            id: pick(passenger, ["ticketId", "id"], pick(matchingTicket, ["ticketId", "id"])),
            ticketCode: pick(passenger, ["ticketCode", "code"], pick(matchingTicket, ["ticketCode", "code"], "")),
            qrToken: pick(passenger, ["qrToken"], pick(matchingTicket, ["qrToken"], "")),
            fullName: pick(passenger, ["fullName", "passengerName", "name"], ""),
            birthYear: getPassengerBirthYear(passenger),
            passengerType: index < normalized.adultCount ? "Adult" : "Child",
          };
        })
        : buildEmptyPassengerRows(normalized);
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
  }, [booking?.bookingCode, id, isAuthenticated, lang, navigate]);

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

  useEffect(() => {
    if (!location.state?.focusPayment || isLoading || !booking) return;
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
    if (!booking) return;
    setPaymentOption(booking.hasDepositPaid && booking.paymentStatus !== "Paid" ? "Remaining" : "Full");
    setPaymentCheckoutUrl(booking.latestPaymentCheckoutUrl || "");
    setPaymentExpiresAt(booking.latestPaymentExpiresAt || "");
    setPaymentQrCode(booking.latestPaymentQrCode || "");
    setPaymentBookingHoldExpiresAt(booking.bookingHoldExpiresAt || "");
    setPaymentAmount(booking.latestPaymentAmount || 0);
    setPaymentPromotionCode((prev) => prev || booking.promotionCode || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when these specific fields change, not on every booking refetch
  }, [booking?.id, booking?.hasDepositPaid, booking?.paymentStatus, booking?.latestPaymentAmount, booking?.latestPaymentCheckoutUrl, booking?.latestPaymentExpiresAt, booking?.latestPaymentQrCode, booking?.bookingHoldExpiresAt, booking?.promotionCode]);

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

    const deadline = expiresAt || new Date(Date.now() + DEFAULT_PAYMENT_LINK_MS).toISOString();
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

    try {
      setIsSubmitting(true);
      await syncBookingPayment(paymentId);
      await loadDetail();
      if (!silent) {
        Swal.fire({
          icon: "success",
          title: lang === "VN" ? "Đã đồng bộ thanh toán" : "Payment synchronized",
          confirmButtonColor: "#124757",
        });
      }
    } catch (error) {
      if (!silent) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không thể đồng bộ" : "Unable to synchronize",
          text: error.response?.data?.message || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later."),
          confirmButtonColor: "#124757",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [lang, loadDetail]);

  const handleSyncPaymentByOrderCode = useCallback(async (orderCode, { silent = false } = {}) => {
    if (!orderCode) return;

    try {
      setIsSubmitting(true);
      await syncBookingPaymentByOrderCode(orderCode);
      await loadDetail();
      if (!silent) {
        Swal.fire({
          icon: "success",
          title: lang === "VN" ? "Đã đồng bộ thanh toán" : "Payment synchronized",
          confirmButtonColor: "#124757",
        });
      }
    } catch (error) {
      if (!silent) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không thể đồng bộ" : "Unable to synchronize",
          text: error.response?.data?.message || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later."),
          confirmButtonColor: "#124757",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [lang, loadDetail]);

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
    const isBookingPaid = String(booking?.paymentStatus).toLowerCase() === "paid";
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
  }, [booking?.id, booking?.latestPaymentExpiresAt, booking?.latestPaymentOrderCode, booking?.paymentStatus, loadDetail]);

  const handleCreatePayment = async () => {
    if (!booking?.id) return;
    const activePendingPayment = Array.isArray(booking.payments)
      ? booking.payments.find((payment) => {
        const isPending = String(payment.paymentStatus).toLowerCase() === "pending";
        const expiresAt = pick(payment, ["expiresAt"], "") || getEstimatedPaymentDeadline(payment);
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
      Swal.fire({
        icon: "info",
        title: lang === "VN" ? "Báo giá đã hết hạn" : "Quote expired",
        text: lang === "VN" ? "Hệ thống đã tải lại booking để cập nhật trạng thái mới nhất." : "The booking has been refreshed for the latest status.",
        confirmButtonColor: "#124757",
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
        promotionCode: paymentPromotionCode.trim() || null,
      };
      const payment = await createBookingPayment(paymentPayload);
      const paymentId = pick(payment, ["id", "paymentId", "data.id", "data.paymentId", "payment.id", "data.payment.id"]);
      const orderCode = pick(payment, ["orderCode", "paymentOrderCode", "payosOrderCode", "data.orderCode", "data.paymentOrderCode", "data.payosOrderCode", "payment.orderCode", "data.payment.orderCode"]);
      const createdPaymentAmount = Number(pick(payment, ["amount", "paymentAmount", "data.amount", "data.paymentAmount", "payment.amount", "data.payment.amount"], selectedPaymentAmount)) || selectedPaymentAmount;
      const checkoutUrl = pick(payment, [
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
      const expiresAt = pick(payment, ["expiresAt", "data.expiresAt", "payment.expiresAt", "data.payment.expiresAt"]);
      const qrCode = pick(payment, ["qrCode", "data.qrCode", "payment.qrCode", "data.payment.qrCode"]);
      const bookingHoldExpiresAt = pick(payment, [
        "bookingHoldExpiresAt",
        "data.bookingHoldExpiresAt",
        "payment.bookingHoldExpiresAt",
        "data.payment.bookingHoldExpiresAt",
      ]);

      if (orderCode) {
        sessionStorage.setItem(`charterPaymentOrderCode:${booking.id}`, orderCode);
        sessionStorage.removeItem(`charterPayment:${booking.id}`);
      } else if (paymentId) {
        sessionStorage.setItem(`charterPayment:${booking.id}`, paymentId);
      }
      sessionStorage.setItem("latestCharterPaymentBooking", booking.id);
      if (paymentId) {
        sessionStorage.setItem(`paymentBooking:${paymentId}`, booking.id);
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
        deadline: expiresAt || current.deadline || new Date(Date.now() + DEFAULT_PAYMENT_LINK_MS).toISOString(),
        statusText: lang === "VN" ? "Đang chờ thanh toán trên PayOS" : "Waiting for PayOS payment",
      }));

      if (checkoutUrl) {
        openPaymentPage(checkoutUrl, {
          orderCode,
          amount: createdPaymentAmount,
          expiresAt: expiresAt || new Date(Date.now() + DEFAULT_PAYMENT_LINK_MS).toISOString(),
        });
        return;
      }

      setPaymentWatcher((current) => ({ ...current, isActive: false }));

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã tạo giao dịch" : "Payment created",
        text: lang === "VN" ? "Hệ thống sẽ tự động đồng bộ trạng thái thanh toán." : "Payment status will be synchronized automatically.",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      setPaymentWatcher((current) => ({ ...current, isActive: false }));
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể tạo thanh toán" : "Unable to create payment",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể tạo link thanh toán PayOS. Vui lòng kiểm tra trạng thái booking hoặc mã khuyến mãi." : "Unable to create the PayOS payment link. Please check the booking status or promotion code.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRespondToQuote = async (action) => {
    if (!booking?.id || isSubmitting) return;

    let note = null;
    if (action === "RequestChanges") {
      const result = await Swal.fire({
        icon: "question",
        title: lang === "VN" ? "Yêu cầu chỉnh sửa báo giá" : "Request quote changes",
        input: "textarea",
        inputLabel: lang === "VN" ? "Ghi chú (tuỳ chọn)" : "Note (optional)",
        inputPlaceholder: lang === "VN" ? "Mô tả thay đổi bạn muốn..." : "Describe the changes you want...",
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Gửi yêu cầu" : "Submit request",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
        confirmButtonColor: "#124757",
      });
      if (!result.isConfirmed) return;
      note = String(result.value || "").trim() || null;
    }

    if (action === "Reject") {
      const result = await Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Từ chối báo giá?" : "Reject this quote?",
        text: lang === "VN"
          ? "Booking sẽ bị hủy sau khi từ chối."
          : "The booking will be cancelled after rejection.",
        showCancelButton: true,
        confirmButtonText: lang === "VN" ? "Từ chối" : "Reject",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
        confirmButtonColor: "#dc2626",
      });
      if (!result.isConfirmed) return;
    }

    if (action === "Accept") {
      const result = await Swal.fire({
        icon: "question",
        title: lang === "VN" ? "Bạn chắc chắn chấp nhận báo giá?" : "Accept this quote?",
        text: lang === "VN"
          ? "Sau khi chấp nhận, yêu cầu chuyển sang thanh toán."
          : "After accepting, you can proceed to payment.",
        showCancelButton: true,
        reverseButtons: true,
        focusCancel: true,
        confirmButtonText: lang === "VN" ? "Chấp nhận báo giá" : "Accept quote",
        cancelButtonText: lang === "VN" ? "Không, xem lại" : "No, go back",
        confirmButtonColor: "#124757",
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
          await Swal.fire({
            icon: "warning",
            title: lang === "VN" ? "Chưa chuyển sang thanh toán" : "Still waiting for payment status",
            text: lang === "VN"
              ? "Máy chủ chưa đổi trạng thái sang PendingPayment. Vui lòng thử lại hoặc liên hệ hỗ trợ."
              : "The server did not change status to PendingPayment. Please try again or contact support.",
            confirmButtonColor: "#124757",
          });
          return;
        }

        await Swal.fire({
          icon: "success",
          title: lang === "VN" ? "Đã chấp nhận báo giá" : "Quote accepted",
          text: lang === "VN"
            ? "Yêu cầu đã chuyển sang chờ thanh toán. Bạn có thể thanh toán bên dưới."
            : "The request is now pending payment. You can pay below.",
          confirmButtonColor: "#124757",
          timer: 1800,
          showConfirmButton: false,
        });
        window.setTimeout(() => {
          paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      } else if (action === "RequestChanges") {
        await Swal.fire({
          icon: "success",
          title: lang === "VN" ? "Đã gửi yêu cầu chỉnh sửa" : "Change request sent",
          text: lang === "VN" ? "Booking đã chuyển về chờ báo giá lại." : "The booking is pending a new quote.",
          confirmButtonColor: "#124757",
          timer: 1600,
          showConfirmButton: false,
        });
      } else {
        await Swal.fire({
          icon: "success",
          title: lang === "VN" ? "Đã từ chối báo giá" : "Quote rejected",
          confirmButtonColor: "#124757",
          timer: 1400,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Lỗi phản hồi báo giá:", error?.response?.data || error);
      const message = getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể phản hồi báo giá. Vui lòng tải lại trang rồi thử lại." : "Unable to respond to the quote. Please refresh and try again.",
      );
      await Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể phản hồi báo giá" : "Unable to respond to quote",
        html: `<p style="text-align:left;white-space:pre-wrap;margin:0;font-size:14px;line-height:1.5;">${String(message)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")}</p>`,
        confirmButtonColor: "#124757",
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

  const handleCancelBooking = async () => {
    if (!booking) return;
    const hasPaidPayment = ["paid", "depositpaid"].includes(String(booking.paymentStatus).toLowerCase())
      || Number(booking.paidAmount || 0) > 0;
    const refundablePayment = hasPaidPayment ? getRefundablePayment(booking) : null;
    const refundablePaymentId = getPaymentId(refundablePayment || {});

    if (hasPaidPayment) {
      if (!refundablePaymentId) {
        Swal.fire({
          icon: "error",
          title: lang === "VN" ? "Không tìm thấy paymentId" : "Payment ID not found",
          text: lang === "VN"
            ? "Booking đã có thanh toán nhưng hệ thống chưa xác định được mã giao dịch cần hoàn tiền."
            : "This booking has a paid amount, but the system cannot identify the transaction to refund.",
          confirmButtonColor: "#124757",
        });
        return;
      }

      console.log("Resolved refund payment:", {
        paymentId: refundablePaymentId,
        payment: refundablePayment,
        bookingPaymentIds: {
          paidPaymentId: booking.paidPaymentId,
          latestPaymentId: booking.latestPaymentId,
          storedPaymentId: sessionStorage.getItem(`charterPayment:${booking.id}`),
        },
      });
      navigate(`/profile/my-charter-booking/${booking.id}/refund`, {
        state: {
          booking,
          payment: refundablePayment,
          paymentId: refundablePaymentId,
        },
      });
      return;
    } else {
      const result = await Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Bạn chắc chắn muốn hủy?" : "Are you sure you want to cancel?",
        html: lang === "VN"
          ? `<p style="margin:0;text-align:left;font-size:14px;line-height:1.55;color:#475569;">
              Mã yêu cầu <strong style="color:#124757;">${String(booking.bookingCode || "--")}</strong> sẽ bị hủy và không thể thanh toán tiếp.<br/><br/>
              Thao tác này không hoàn tác được.
            </p>`
          : `<p style="margin:0;text-align:left;font-size:14px;line-height:1.55;color:#475569;">
              Request <strong style="color:#124757;">${String(booking.bookingCode || "--")}</strong> will be cancelled and payment will no longer be available.<br/><br/>
              This action cannot be undone.
            </p>`,
        showCancelButton: true,
        reverseButtons: true,
        focusCancel: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#124757",
        confirmButtonText: lang === "VN" ? "Tôi chắc chắn, hủy yêu cầu" : "Yes, cancel request",
        cancelButtonText: lang === "VN" ? "Không, giữ lại" : "No, keep it",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      await cancelMyCharterBooking(booking.id, {});
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã hủy yêu cầu" : "Request cancelled",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể hủy" : "Unable to cancel",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Yêu cầu này có thể không còn được phép hủy." : "This request may no longer be cancellable.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengerRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  };

  const handleImportPassengers = async (event) => {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file || !booking?.id) return;
    if (String(booking.paymentStatus).toLowerCase() !== "paid") return;

    try {
      setIsSubmitting(true);
      await importMyCharterBookingPassengers(booking.id, file);
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã nhập danh sách hành khách" : "Passenger list imported",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể nhập file" : "Unable to import file",
        text: error.response?.data?.message || (lang === "VN" ? "Chỉ hỗ trợ .xlsx, .csv, .tsv, .txt và booking phải được thanh toán đủ." : "Use .xlsx, .csv, .tsv, or .txt after the booking is fully paid."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTicketFileAction = async (action) => {
    if (!booking?.id) return;
    if (String(booking.paymentStatus).toLowerCase() !== "paid") return;

    const missingManifestPayload = !hasSavedPassengerManifest(booking)
      ? buildPassengerPayload(booking, passengerRows, lang, { allowSingleContactWithoutBirthYear: true })
      : null;

    if (missingManifestPayload?.errorTitle) {
      Swal.fire({
        icon: "info",
        title: missingManifestPayload.errorTitle,
        text: missingManifestPayload.errorText,
        confirmButtonColor: "#124757",
      });
      return;
    }

    const popup = action === "print" ? window.open("", "_blank") : null;

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
        response = await printSelectedCharterBookingTickets(booking.id, ticketIds);
        const url = URL.createObjectURL(response.data);
        if (popup) popup.location.href = url;
        else window.open(url, "_blank");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (error) {
      if (popup) popup.close();
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể xuất vé" : "Unable to export tickets",
        text: getApiErrorMessage(error, lang === "VN" ? "Không thể xuất PDF/vé. Vui lòng lưu danh sách hành khách rồi thử lại." : "Unable to export tickets. Please save the passenger list and try again."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePassengers = async () => {
    if (!booking?.id) return;
    if (String(booking.paymentStatus).toLowerCase() !== "paid") {
      Swal.fire({
        icon: "info",
        title: lang === "VN" ? "Booking chưa thanh toán đủ" : "Booking is not fully paid",
        text: lang === "VN" ? "Chỉ có thể nhập hành khách khi paymentStatus = Paid." : "Passengers can only be entered when paymentStatus is Paid.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    const passengerPayload = buildPassengerPayload(booking, passengerRows, lang, { allowSingleContactWithoutBirthYear: true });
    if (passengerPayload.errorTitle) {
      Swal.fire({
        icon: "info",
        title: passengerPayload.errorTitle,
        text: passengerPayload.errorText,
        confirmButtonColor: "#124757",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await updateMyCharterBookingPassengers(booking.id, { passengers: passengerPayload.passengers });
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã lưu danh sách hành khách" : "Passenger list saved",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      console.error("Không thể lưu hành khách charter:", {
        bookingId: booking.id,
        passengerCount: booking.passengerCount,
        adultCount: booking.adultCount,
        childCount: booking.childCount,
        submittedPassengers: passengerPayload.passengers,
        response: error.response?.data,
      });
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể lưu hành khách" : "Unable to save passengers",
        text: getApiErrorMessage(
          error,
          lang === "VN"
            ? "Hệ thống chưa lưu được danh sách hành khách này. Vui lòng kiểm tra lại tổng số khách, số người lớn và số trẻ em của booking."
            : "The system could not save this passenger list. Please verify the booking passenger totals, adult count, and child count.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body">
        <main className="max-w-3xl mx-auto">
          <section className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-100 dark:border-slate-700/50 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
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
  const isPaid = String(booking.paymentStatus).toLowerCase() === "paid";
  const isTerminalBooking = ["Cancelled", "Expired", "Refunded"].includes(booking.status);
  const canShowPayOsSection = !isPaid
    && !isTerminalBooking
    && !["Quoted", "PendingQuote", "Completed"].includes(booking.status);
  const canUseContactAsSinglePassenger = isSinglePassengerWithContact(booking) && !hasSavedPassengerManifest(booking);
  const paidAmount = Number(booking.paidAmount || 0);
  const quoteBoatRows = (Array.isArray(booking.quoteBoats) && booking.quoteBoats.length > 0
    ? booking.quoteBoats
    : booking.selectedBoats
  ).map((boat, index) => {
    const boatOrder = pick(boat, ["boatOrder", "order"], index + 1);
    const selectedBoat = Array.isArray(booking.selectedBoats)
      ? booking.selectedBoats.find((item) => String(pick(item, ["boatOrder", "order"], index + 1)) === String(boatOrder))
      : null;

    return {
      boatOrder,
      boatId: String(pick(
        boat,
        ["boatId", "id", "boat.id"],
        pick(selectedBoat, ["boatId", "id", "boat.id"], ""),
      ) || ""),
      name: getBoatDisplayName(boat, getBoatDisplayName(selectedBoat, `${lang === "VN" ? "Tàu" : "Boat"} ${boatOrder}`)),
      numberOfDecks: getRequestedDeckCount(boat) || getRequestedDeckCount(selectedBoat),
      seatSetupType: pick(boat, ["seatSetupType", "requiredSeatSetupType", "boat.seatSetupType"], pick(selectedBoat, ["seatSetupType", "requiredSeatSetupType"], "--")),
      imageUrl: pick(
        boat,
        ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl", "imageUrls.0", "boat.imageUrls.0"],
        pick(selectedBoat, ["imageUrl", "thumbnailUrl", "boat.imageUrl", "boat.thumbnailUrl", "imageUrls.0", "boat.imageUrls.0"], DEFAULT_BOAT_IMAGE),
      ),
      seatCount: pick(boat, ["seatCount", "capacity", "boat.seatCount", "boat.capacity"], pick(selectedBoat, ["seatCount", "capacity", "boat.seatCount", "boat.capacity"], "")),
      status: pick(boat, ["status", "boat.status"], pick(selectedBoat, ["status", "boat.status"], "")),
      unitPrice: Number(pick(boat, ["unitPrice", "price", "boat.unitPrice"], 0)) || 0,
      chargeableDurationValue: pick(boat, ["chargeableDurationValue", "chargeableDuration", "durationValue"], ""),
      subtotalAmount: Number(pick(boat, ["subtotalAmount", "totalAmount", "amount"], 0)) || 0,
    };
  });
  const quoteTotal = booking.totalAmount || booking.estimatedPrice;
  const boatsRentalTotal = quoteBoatRows.reduce((sum, boat) => sum + (Number(boat.subtotalAmount) || 0), 0);
  const insuranceQuoteAmount = booking.insuranceSelected !== false
    && Number(booking.insurance?.quantity) > 0
    && Number(booking.insurance?.totalAmount) > 0
    ? Number(booking.insurance.totalAmount)
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
      const expiresAt = pick(payment, ["expiresAt"], "") || getEstimatedPaymentDeadline(payment);
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
    ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending" && isDeadlineExpired(pick(payment, ["expiresAt"], "") || getEstimatedPaymentDeadline(payment), nowTick))
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
  const canCreatePayment = ["PendingPayment", "Confirmed"].includes(booking.status)
    && !isPaid
    && !hasPendingPayOs
    && !isQuoteHoldExpired
    && !isBookingHoldExpired
    && !["Expired", "Cancelled", "Completed", "Refunded"].includes(booking.status);
  const paidDepositAmount = Number(booking.paidDepositAmount || 0);
  const depositPaymentAmount = getCharterDepositAmount(quoteTotal, booking.depositAmount);
  const canPayDeposit = depositPaymentAmount > 0 && !booking.hasDepositPaid;
  const usesDefaultDeposit = !(Number(booking.depositAmount) > 0);
  const effectivePaidAmount = Math.max(paidAmount, booking.hasDepositPaid ? paidDepositAmount || depositPaymentAmount : 0);
  const remainingAmount = Math.max(quoteTotal - effectivePaidAmount, 0);
  const normalizedPaymentOption = booking.hasDepositPaid
    ? "Remaining"
    : paymentOption === "Remaining"
      ? "Full"
      : paymentOption;
  const paymentChoices = [
    { id: "Deposit", label: lang === "VN" ? "Đặt cọc" : "Deposit", disabled: booking.hasDepositPaid || depositPaymentAmount <= 0, amount: depositPaymentAmount },
    { id: "Full", label: lang === "VN" ? "Thanh toán đủ" : "Full", disabled: false, amount: booking.hasDepositPaid ? remainingAmount : quoteTotal },
    { id: "Remaining", label: lang === "VN" ? "Phần còn lại" : "Remaining", disabled: !booking.hasDepositPaid, amount: remainingAmount },
  ];
  const selectablePaymentChoices = booking.hasDepositPaid
    ? paymentChoices.filter((choice) => choice.id === "Remaining")
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
        : quoteTotal;
  const estimatedPendingPaymentDeadline = activePendingPayment ? getEstimatedPaymentDeadline(activePendingPayment) : "";
  const effectivePendingPaymentAmount = activePendingPayment
    ? getPaymentAmount(activePendingPayment) || selectedPaymentAmount
    : Number(paymentAmount || booking.latestPaymentAmount || selectedPaymentAmount) || selectedPaymentAmount;
  const effectivePaymentDeadline = effectivePaymentExpiresAt || paymentWatcher.deadline || estimatedPendingPaymentDeadline;
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
    { icon: "event", label: lang === "VN" ? "Ngày giờ đi" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` },
    {
      icon: "payments",
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
      icon: "timer",
      label: lang === "VN" ? "Thời lượng ước tính" : "Estimated duration",
      value: (() => {
        const estimatedMinutes = Number(pick(booking.routeEstimate, ["estimatedDurationMinutes", "estimatedTravelMinutes"], 0));
        const chargeableMinutes = Number(pick(booking.routeEstimate, ["chargeableDurationMinutes"], 0));
        const chargeableValue = Number(pick(booking.routeEstimate, ["chargeableDurationValue"], 0));
        const hasChargeable = (Number.isFinite(chargeableMinutes) && chargeableMinutes > 0)
          || (Number.isFinite(chargeableValue) && chargeableValue > 0);

        // Pending quote: don't show partial travel-only minutes (waiting/stops/buffer still missing).
        if (booking.status === "PendingQuote" && !hasChargeable) {
          return lang === "VN" ? "Có trong báo giá" : "Shown in quote";
        }

        if (booking.rentalUnit === "Hour" && Number.isFinite(chargeableMinutes) && chargeableMinutes > 0) {
          const hours = Math.max(1, Math.ceil(chargeableMinutes / 60));
          return lang === "VN" ? `${hours} giờ` : `${hours} hr`;
        }
        if (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
          return lang === "VN" ? `${estimatedMinutes} phút di chuyển` : `${estimatedMinutes} min travel`;
        }
        if (Number(booking.durationValue) > 0) {
          return booking.rentalUnit === "Hour"
            ? (lang === "VN" ? `${booking.durationValue} giờ` : `${booking.durationValue} hr`)
            : (lang === "VN" ? `${booking.durationValue} ngày` : `${booking.durationValue} day(s)`);
        }
        return lang === "VN" ? "Có trong báo giá" : "Shown in quote";
      })(),
    },
    {
      icon: "groups",
      label: lang === "VN" ? "Hành khách" : "Passengers",
      value: lang === "VN" ? `${booking.passengerCount} khách` : `${booking.passengerCount} guests`,
      description: lang === "VN"
        ? `${booking.adultCount} người lớn / ${booking.childCount} trẻ em`
        : `${booking.adultCount} adults / ${booking.childCount} children`,
    },
  ];
  const contactItems = [
    { icon: "person", label: lang === "VN" ? "Người liên hệ" : "Contact Name", value: booking.contactName },
    { icon: "call", label: lang === "VN" ? "Số điện thoại" : "Phone", value: booking.contactPhone },
    { icon: "mail", label: "Email", value: booking.contactEmail },
  ];
  const itineraryTimelineItems = [
    { type: "start", label: lang === "VN" ? "Bến đi" : "From", name: routeFrom },
    ...(Array.isArray(booking.itineraryStops) ? booking.itineraryStops.map((stop, index) => ({
      type: "stop",
      label: lang === "VN" ? `Điểm dừng ${index + 1}` : `Stop ${index + 1}`,
      name: stop.stationName || "--",
      meta: Number(stop.stayDurationMinutes) > 0 ? `${stop.stayDurationMinutes} ${lang === "VN" ? "phút dừng" : "min stay"}` : "",
    })) : []),
    { type: "end", label: lang === "VN" ? "Bến đến" : "To", name: routeTo },
  ];
  const requestedDeckItems = Array.isArray(booking.requestedBoats)
    ? booking.requestedBoats.map((boat, index) => ({
      order: pick(boat, ["boatOrder", "order"], index + 1),
      deckText: formatDeckCount(getRequestedDeckCount(boat), lang),
      seatSetupType: pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "--"),
    }))
    : [];

  return (
    <>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body transition-colors">
      <main className="max-w-6xl mx-auto space-y-6">
        <button onClick={() => navigate("/profile/my-charter-booking")} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Quay lại danh sách" : "Back to Requests"}
        </button>

        {loadError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-4 py-3 text-amber-800 dark:text-amber-300">
            <p className="text-xs font-bold">{loadError}</p>
            <button onClick={loadDetail} className="shrink-0 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-500/30 text-xs font-black uppercase">
              {lang === "VN" ? "Thử lại" : "Retry"}
            </button>
          </div>
        )}

        {/* ===== TITLE ===== */}
        <section className="overflow-hidden bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_24px_70px_rgba(15,23,42,0.10)] border border-slate-200/70 dark:border-slate-700/70">
          <div className="px-6 py-6 md:px-8">
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-headline font-black text-[#0E4050] dark:text-yellow-400 tracking-tight">{booking.bookingCode}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-headline font-black uppercase tracking-wide border ${statusInfo.classes}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 text-[#0E4050] dark:text-slate-100">
                  <div className="min-w-0">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Bến đi" : "From"}</p>
                    <p className="mt-1 text-lg font-headline font-black truncate">{routeFrom}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 px-2 text-slate-300">
                    <span className="h-px w-10 bg-slate-300 dark:bg-slate-600"></span>
                    <span className="material-symbols-outlined text-xl">east</span>
                    <span className="h-px w-10 bg-slate-300 dark:bg-slate-600"></span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Bến đến" : "To"}</p>
                    <p className="mt-1 text-lg font-headline font-black truncate">{routeTo}</p>
                  </div>
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

        {/* ===== SECTION 1: REQUEST OVERVIEW ===== */}
        <section className="overflow-hidden bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_18px_50px_rgba(15,23,42,0.07)] border border-slate-200/70 dark:border-slate-700/70">
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
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
                <span className="material-symbols-outlined text-base text-[#124757] dark:text-yellow-400">schedule</span>
                {lang === "VN" ? "Gửi lúc" : "Submitted"} {formatDateTime(booking.createdAt)}
              </span>
            </div>
          </div>

          <div className="px-6 py-6 md:px-8">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-[#D8E7EA] bg-[#F7FAFB] p-5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900">
                    <span className="material-symbols-outlined text-2xl">route</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Lộ trình dự kiến" : "Planned Route"}
                    </p>
                    <p className="mt-1 truncate text-xl font-headline font-black text-[#0E4050] dark:text-white">
                      {routeFrom} <span className="text-slate-300">/</span> {routeTo}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {itineraryTimelineItems.map((item, index) => {
                    const isLast = index === itineraryTimelineItems.length - 1;
                    const isEndpoint = item.type !== "stop";
                    return (
                      <div key={`${item.type}-${item.name}-${index}`} className="grid grid-cols-[32px_1fr] gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-headline font-black ${isEndpoint
                            ? "border-[#124757] bg-white text-[#124757] dark:border-yellow-400 dark:bg-slate-800 dark:text-yellow-400"
                            : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                            }`}
                          >
                            {item.type === "start" ? "A" : item.type === "end" ? "B" : index}
                          </span>
                          {!isLast && <span className="mt-2 h-8 w-px bg-[#C9DADF] dark:bg-slate-700"></span>}
                        </div>
                        <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                              <p className="mt-0.5 truncate text-sm font-headline font-black text-[#0E4050] dark:text-slate-100">{item.name}</p>
                            </div>
                            {item.meta && <span className="w-max rounded-full bg-yellow-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-yellow-400/10 dark:text-yellow-300">{item.meta}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {scheduleItems.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-slate-700 dark:bg-slate-900">
                    <span className="material-symbols-outlined rounded-2xl bg-[#EAF3F5] p-2.5 text-2xl text-[#124757] dark:bg-slate-800 dark:text-yellow-400">{item.icon}</span>
                    <p className="mt-4 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className="mt-1 text-lg font-headline font-black leading-snug text-slate-800 dark:text-white break-words">{item.value}</p>
                    {item.description && (
                      <p className="mt-1 text-xs font-bold leading-snug text-slate-400 dark:text-slate-500">{item.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {requestedDeckItems.length > 0 && (
              <div className="mt-4 rounded-2xl bg-[#FBFDFD] px-4 py-3 ring-1 ring-[#D8E7EA] dark:bg-slate-900 dark:ring-slate-700">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF3F5] text-[#124757] dark:bg-slate-800 dark:text-yellow-400">
                      <span className="material-symbols-outlined text-lg">directions_boat</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tàu yêu cầu" : "Requested Boats"}</p>
                      <p className="truncate text-sm font-bold text-slate-600 dark:text-slate-300">
                        {lang === "VN" ? `${requestedDeckItems.length} tàu` : `${requestedDeckItems.length} boat${requestedDeckItems.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {requestedDeckItems.map((boat) => (
                      <span key={`${boat.order}-${boat.deckText || boat.seatSetupType}`} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-headline font-black text-[#124757] shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#124757] text-[9px] text-white dark:bg-yellow-400 dark:text-slate-900">{boat.order}</span>
                        {boat.deckText || boat.seatSetupType}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {contactItems.map((item) => (
                <div key={item.label} className="rounded-3xl border border-slate-200 bg-[#F8FBFC] px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#124757] ring-1 ring-slate-200 dark:bg-slate-800 dark:text-yellow-400 dark:ring-slate-700">
                      <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                      <p className="mt-1 break-words text-sm font-bold text-slate-700 dark:text-slate-200">{item.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-lg">sticky_note_2</span>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest">{lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}</p>
                </div>
                <p className="mt-3 min-h-10 font-medium text-slate-700 dark:text-slate-200 break-words">{booking.specialRequests || (lang === "VN" ? "Không có" : "None")}</p>
              </div>
              <CharterInsuranceInfo
                booking={booking}
                lang={lang}
                currencyFormatter={currencyFormatter}
              />
            </div>
          </div>
        </section>

        {/* ===== SECTION 2: BOAT & QUOTE + PAYMENT ===== */}
        <section className="bg-white dark:bg-slate-800 rounded-4xl shadow-[0_18px_50px_rgba(15,23,42,0.06)] border border-slate-200/70 dark:border-slate-700/70 px-6 py-6 md:px-8">
          <h2 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">
            {lang === "VN" ? "Tàu & báo giá" : "Boat & Quote"}
          </h2>

          {booking.status === "PendingQuote" ? (
            <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-3xl">hourglass_top</span>
                <div>
                  <h3 className="font-headline text-lg font-black">{lang === "VN" ? "Chưa có báo giá" : "No quote yet"}</h3>
                  <p className="mt-1 text-sm font-medium">{lang === "VN" ? "Đội vận hành đang chọn tàu và chốt giá. Khi có báo giá, ảnh tàu và chi tiết giá sẽ hiển thị ở mục này." : "The operations team is assigning boats and pricing. Boat photos and quote details will appear here."}</p>
                </div>
              </div>
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
                      {formatDate(booking.departureDate)} · {String(booking.startTime).slice(0, 5)}
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
                    preferOfficial
                    heightClassName="h-64 md:h-72"
                    className="border-[#D8E7EA] dark:border-slate-700"
                    title={lang === "VN" ? "Tuyến đã chốt" : "Confirmed route"}
                    subtitle={lang === "VN"
                      ? "Đường đi theo Route Master dùng khi admin chốt giá."
                      : "Route Master path used when the quote was finalized."}
                  />
                </div>
              </div>

              {quoteBoatRows.length > 0 ? (
                <div className="divide-y divide-[#D8E7EA] dark:divide-slate-700">
                  {quoteBoatRows.map((boat) => (
                    <div key={`${boat.boatOrder}-${boat.name}`} className="flex items-center gap-4 px-5 py-4">
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
                        <img src={boat.imageUrl || DEFAULT_BOAT_IMAGE} alt={boat.name} className="h-full w-full object-cover" />
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
                            boatImageUrl={boat.imageUrl || DEFAULT_BOAT_IMAGE}
                            lang={lang}
                            boatMeta={{
                              seatCount: boat.seatCount,
                              numberOfDecks: boat.numberOfDecks,
                              seatSetupType: boat.seatSetupType,
                              imageUrl: boat.imageUrl || DEFAULT_BOAT_IMAGE,
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
                    <span className="material-symbols-outlined text-4xl text-[#124757] dark:text-yellow-400">directions_boat</span>
                    <h3 className="mt-2 font-headline text-lg font-black text-[#0E4050] dark:text-white">{lang === "VN" ? "Chưa nhận được chi tiết tàu" : "Boat details are not available"}</h3>
                    <p className="mx-auto mt-1 max-w-lg text-sm font-medium text-slate-500 dark:text-slate-400">
                      {lang === "VN" ? "Chưa có thông tin chi tiết từng tàu cho yêu cầu này. Tổng giá đã chốt vẫn được hiển thị ở phần bên dưới." : "Detailed boat information isn't available for this request yet. The confirmed total is still shown below."}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5">
                {customerQuotePreview?.boats?.length > 0 ? (
                  <CharterQuotePreviewTable
                    preview={customerQuotePreview}
                    booking={booking}
                    lang={lang}
                    currencyFormatter={currencyFormatter}
                  />
                ) : displayQuoteTotal > 0 ? (
                  <div className="overflow-hidden rounded-2xl bg-[#124757] text-white shadow-[0_12px_30px_rgba(18,71,87,0.25)] dark:bg-yellow-400 dark:text-slate-900">
                    <div className="flex items-end justify-between gap-3 px-4 py-4">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/70 dark:text-slate-900/60">
                        {lang === "VN" ? "Tổng chốt giá" : "Quote total"}
                      </p>
                      <p className="font-headline text-2xl font-black tabular-nums tracking-tight">
                        {currencyFormatter.format(displayQuoteTotal)}
                      </p>
                    </div>
                    {depositPaymentAmount > 0 ? (
                      <div className="flex items-center justify-between gap-3 border-t border-white/15 px-4 py-3 dark:border-slate-900/15">
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/70 dark:text-slate-900/60">
                          {lang === "VN" ? "Đặt cọc 50%" : "Deposit 50%"}
                        </p>
                        <p className="text-sm font-headline font-black tabular-nums text-emerald-200 dark:text-emerald-800">
                          {currencyFormatter.format(depositPaymentAmount)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

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
                  selectablePaymentChoices={selectablePaymentChoices}
                  paymentSelectValue={paymentSelectValue}
                  setPaymentOption={setPaymentOption}
                  usesDefaultDeposit={usesDefaultDeposit}
                  canPayDeposit={canPayDeposit}
                  selectedPaymentAmount={selectedPaymentAmount}
                  effectivePaidAmount={effectivePaidAmount}
                  remainingAmount={remainingAmount}
                  paymentPromotionCode={paymentPromotionCode}
                  setPaymentPromotionCode={setPaymentPromotionCode}
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
                />
              </div>
            </div>
          )}
        </section>

        {/* ===== SECTION 3: TICKETS & PASSENGERS ===== */}
        {isPaid && (
          <MyCharterTicketsPanel
            lang={lang}
            booking={booking}
            isPaid={isPaid}
            isSubmitting={isSubmitting}
            qrImageUrl={qrImageUrl}
            selectedTicketIds={selectedTicketIds}
            setSelectedTicketIds={setSelectedTicketIds}
            passengerRows={passengerRows}
            canUseContactAsSinglePassenger={canUseContactAsSinglePassenger}
            importInputRef={importInputRef}
            isUsableText={isUsableText}
            handleTicketFileAction={handleTicketFileAction}
            handleImportPassengers={handleImportPassengers}
            handlePassengerChange={handlePassengerChange}
            handleSavePassengers={handleSavePassengers}
          />
        )}
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
    />
    </>
  );
}
