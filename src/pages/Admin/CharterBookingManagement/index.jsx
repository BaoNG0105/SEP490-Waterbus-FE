import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import {
  AdminBookingActionsTab,
  AdminBookingOverviewTab,
  AdminBookingTicketsTab,
} from "../../../components/AdminCharterDetailWorkspace";
import { BankBinSelect } from "../../../components/BankBinSelect";
import { CharterWorkflowStepper } from "../../../components/CharterWorkflowStepper";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats } from "../../../services/boatService";
import {
  fetchAdminCharterBookingDetail,
  fetchAdminCharterBookings,
  modifyAdminCharterBookingStatus,
  previewAdminCharterBookingQuote,
  submitAdminCharterBookingQuote,
  // updateCharterAttendance,
} from "../../../services/charterBookingService";
import { refundBookingPayment, syncBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { canShowCharterTickets, normalizeCharterTicketRows } from "../../../utils/charterBookingTickets";
import {
  bookingNeedsRefundAttention,
  getDefaultAdminTab,
  getCharterQuotePaymentDeadline,
  getCharterDepositAmount,
  getPaginationWindow,
  isBookingPaymentClosed,
  matchesSmartFilter,
  shouldShowBookingHoldCountdown,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { CharterQuotePreviewPanel } from "../../../components/CharterQuotePreviewTable";

const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired", "Refunded"];
const manualStatusOptions = ["Cancelled", "Expired", "Completed"];
const rentalUnits = ["Day", "Hour"];
const itemsPerPage = 8;

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const resolveQuoteDepositAmount = (quotePreview) => {
  const total = Number(pick(quotePreview, ["totalAmount", "finalAmount"], 0)) || 0;
  return getCharterDepositAmount(total, 0) || null;
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return `${date.toLocaleDateString("vi-VN")} ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
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

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const getBoatSeatCount = (boat) =>
  Number(pick(boat, ["seatCount", "capacity", "totalSeats", "seatsCount", "maxPassengers"], 0)) || 0;

const getBoatId = (boat) => pick(boat, ["id", "boatId"]);
const getBoatDeckCount = (boat) =>
  Number(pick(boat, ["numberOfDecks", "deckCount", "decks", "boat.numberOfDecks", "boat.deckCount"], 0)) || 0;
const getBoatSeatSetupType = (boat) => pick(boat, ["seatSetupType", "requiredSeatSetupType", "boat.seatSetupType"], "");
const getRequestedDeckCount = (boat) => {
  const directDeckCount = Number(pick(boat, ["requiredNumberOfDecks", "numberOfDecks", "preferredNumberOfDecks", "deckCount"], 0)) || 0;
  if (directDeckCount > 0) return directDeckCount;

  const legacySeatSetupType = String(pick(boat, ["requiredSeatSetupType", "seatSetupType", "preferredSeatSetupType"], "")).toLowerCase();
  if (["standardandvip", "standard_and_vip"].includes(legacySeatSetupType)) return 2;
  if (["fullstandard", "full_standard"].includes(legacySeatSetupType)) return 1;
  return 0;
};
const formatDeckCount = (deckCount, lang) => (
  Number(deckCount) > 0
    ? `${deckCount} ${lang === "VN" ? "tầng" : Number(deckCount) === 1 ? "deck" : "decks"}`
    : ""
);
const formatRentalUnit = (unit, lang) => {
  switch (unit) {
    case "Day":
      return lang === "VN" ? "ngày" : "day";
    case "Hour":
      return lang === "VN" ? "giờ" : "hour";
    default:
      return unit || "--";
  }
};
const formatDuration = (value, unit, lang) => {
  const amount = Number(value) || 0;
  const unitLabel = formatRentalUnit(unit, lang);
  if (lang === "VN") return `${amount} ${unitLabel}`;
  const pluralSuffix = amount === 1 || ["--", ""].includes(unitLabel) ? "" : "s";
  return `${amount} ${unitLabel}${pluralSuffix}`;
};
const formatPassengerSummary = (booking, lang) => {
  const passengerCount = Number(booking?.passengerCount) || 0;
  const adultCount = Number(booking?.adultCount) || 0;
  const childCount = Number(booking?.childCount) || 0;
  if (lang === "VN") {
    return `${passengerCount} khách (${adultCount} người lớn / ${childCount} trẻ em)`;
  }
  return `${passengerCount} guests (${adultCount} adult${adultCount === 1 ? "" : "s"} / ${childCount} child${childCount === 1 ? "" : "ren"})`;
};
const getPaymentStatusInfo = (status, lang) => {
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
const getPaymentAmount = (payment) =>
  Number(pick(payment, ["amount", "paymentAmount", "paidAmount", "totalAmount"], 0)) || 0;
const getRefundAmount = (payment) =>
  Number(pick(payment, ["refundAmount", "refundedAmount", "refund.amount", "refundAmountVnd"], 0)) || 0;
const getRefundRequestedAmount = (payment) =>
  Number(pick(payment, ["refundRequestedAmount", "refund.requestedAmount", "refund.refundRequestedAmount"], 0)) || 0;
const getRefundStatus = (payment) =>
  pick(payment, ["refundStatus", "refund.status", "refundPaymentStatus", "refundState", "payoutStatus"], "");
const getRefundMethod = (payment) =>
  pick(payment, ["refundMethod", "refund.method"], "");
const getRefundReferenceId = (payment) =>
  pick(payment, ["refundReferenceId", "refund.referenceId", "refund.refundReferenceId", "payoutId"], "");
const getRefundMessage = (payment) =>
  pick(payment, ["refundMessage", "refund.message", "refundError", "refund.error", "refundFailureReason", "refund.reason"], "");
const getRefundBankValue = (payment, booking, keys) =>
  pick(payment, keys, pick(booking?.raw, keys, pick(booking, keys, "")));
const getRefundPaymentId = (payment) => pick(payment, [
  "paymentId",
  "id",
  "payment.id",
  "payment.paymentId",
  "paymentLinkId",
  "paymentLink.id",
  "linkPaymentId",
], "");
const buildRefundFormDefaults = (payment, booking) => ({
  reason: getRefundBankValue(payment, booking, ["refundReason", "reason"]) || "Customer refund",
  bankBin: getRefundBankValue(payment, booking, ["bankBin", "refundBankBin", "payoutBankBin", "customer.bankBin", "user.bankBin"]),
  accountNumber: getRefundBankValue(payment, booking, ["accountNumber", "refundAccountNumber", "payoutAccountNumber", "bankAccountNumber", "customer.accountNumber", "user.accountNumber"]),
  accountName: getRefundBankValue(payment, booking, ["accountName", "refundAccountName", "payoutAccountName", "bankAccountName", "customer.accountName", "user.accountName", "contactName", "customerName"]),
});
const buildRefundRequestBody = (form) => ({
  reason: form.reason?.trim() || "Customer refund",
  bankBin: form.bankBin?.trim() || "",
  accountNumber: form.accountNumber?.trim() || "",
  accountName: form.accountName?.trim() || "",
});
const getRefundValidationMessage = (payload, lang) => {
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
const getRefundStatusInfo = (payment, lang) => {
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
const isPaidPayment = (payment) =>
  ["paid", "depositpaid", "success", "succeeded", "completed"].includes(String(pick(payment, ["paymentStatus"], "")).toLowerCase());
const isRefundDone = (payment) => {
  const paymentStatus = String(pick(payment, ["paymentStatus"], "")).toLowerCase();
  const refundStatus = String(getRefundStatus(payment)).toLowerCase();
  return paymentStatus === "refunded" || ["success", "succeeded", "completed", "refunded", "paid", "manualrefunded", "manual_refunded"].includes(refundStatus);
};
const isRefundProcessing = (payment) =>
  ["pending", "processing", "requested", "created"].includes(String(getRefundStatus(payment)).toLowerCase());
const isRefundFailed = (payment) => {
  const paymentStatus = String(pick(payment, ["paymentStatus"], "")).toLowerCase();
  const refundStatus = String(getRefundStatus(payment)).toLowerCase();
  return paymentStatus === "refundfailed" || paymentStatus === "refund_failed" || ["failed", "error", "cancelled", "rejected"].includes(refundStatus);
};
const getRemainingRefundAmount = (payment) => {
  const heldAmount = isRefundProcessing(payment) ? Math.max(getRefundAmount(payment), getRefundRequestedAmount(payment)) : getRefundAmount(payment);
  return Math.max(0, getPaymentAmount(payment) - heldAmount);
};
const hasRefundableAmount = (payment) => getRemainingRefundAmount(payment) > 0;
const canAdminHandleRefund = (payment, bookingStatus) =>
  (isPaidPayment(payment) || isRefundFailed(payment) || hasRefundableAmount(payment))
  && !isRefundDone(payment)
  && !isRefundProcessing(payment)
  && (isRefundFailed(payment) || ["cancelled", "refunded"].includes(String(bookingStatus || "").toLowerCase()));
const hasRefundablePayment = (booking) =>
  Array.isArray(booking?.payments) && booking.payments.some((payment) => (isPaidPayment(payment) || hasRefundableAmount(payment)) && !isRefundDone(payment));
const isActiveBoat = (boat) => String(pick(boat, ["status", "boatStatus", "boat.status"], "Active")).toLowerCase() === "active";
const getBoatPrice = (boat, unit) => {
  const directPrice = Number(
    pick(boat, unit === "Hour" ? ["hourlyRentalPrice", "hourlyPrice"] : ["dailyRentalPrice", "dailyPrice"], 0),
  );
  if (directPrice > 0) return directPrice;

  const rentalPrice = Array.isArray(boat?.rentalPrices)
    ? boat.rentalPrices.find((price) => price.rentalUnit === unit)
    : null;
  return Number(rentalPrice?.unitPrice) || 0;
};

const formatRouteEstimate = (routeEstimate, lang) => {
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

const normalizeRequestedBoats = (item, selectedBoats = []) => {
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

const buildQuoteBoatRows = (booking) => {
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

const buildQuoteFormFromBooking = (booking) => ({
  boats: buildQuoteBoatRows(booking),
  rentalUnit: booking?.rentalUnit || "Day",
  durationValue: booking?.durationValue || 1,
  promotionCode: booking?.promotionCode || "",
});

const normalizeBooking = (item) => {
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
    quotedAt: pick(item, ["quotedAt", "quoteSubmittedAt", "quoteAt", "quotedDate"], ""),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: Number(pick(item, ["depositAmount", "requiredDepositAmount", "quoteBreakdown.depositAmount", "pricing.depositAmount"], 0)),
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
  };
};

export function CharterBookingManagement() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [boats, setBoats] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    boats: [],
    rentalUnit: "",
    durationValue: "",
    promotionCode: "",
  });
  const [quotePreview, setQuotePreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedAttendanceTicketIds, setSelectedAttendanceTicketIds] = useState([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
  );

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const [bookingData, boatData] = await Promise.all([
        fetchAdminCharterBookings(),
        fetchAllBoats({ status: "Active" }).catch(() => []),
      ]);
      setBookings(Array.isArray(bookingData) ? bookingData.map(normalizeBooking) : []);
      setBoats(Array.isArray(boatData) ? boatData : []);
    } catch (error) {
      console.error("Lỗi tải charter booking:", error);
      setErrorMsg(error.response?.data?.message || (lang === "VN"
        ? "Không thể tải danh sách yêu cầu thuê tàu."
        : "Unable to load charter booking requests."));
    } finally {
      setIsLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredBookings = bookings.filter((booking) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch =
      booking.bookingCode.toLowerCase().includes(searchValue) ||
      booking.customerName.toLowerCase().includes(searchValue) ||
      booking.phone.toLowerCase().includes(searchValue) ||
      booking.boatName.toLowerCase().includes(searchValue) ||
      booking.route.toLowerCase().includes(searchValue);

    const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const currentBookings = filteredBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = {
    total: bookings.length,
    needsAction: bookings.filter((item) => matchesSmartFilter(item, "needsAction")).length,
    pendingQuote: bookings.filter((item) => item.status === "PendingQuote").length,
    quoted: bookings.filter((item) => item.status === "Quoted").length,
    confirmed: bookings.filter((item) => item.status === "Confirmed").length,
    revenue: bookings
      .filter((item) => ["Quoted", "Confirmed", "Completed"].includes(item.status))
      .reduce((sum, item) => sum + item.estimatedPrice, 0),
  };

  const openAdminBooking = (booking, tab) => {
    navigate(`/admin/charter-bookings-management/${booking.id}`, { state: tab ? { tab } : undefined });
  };

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const refreshAfterChange = async () => {
    await loadData();
    if (selectedBooking?.id) {
      const detail = await fetchAdminCharterBookingDetail(selectedBooking.id);
      const normalized = normalizeBooking(detail);
      setSelectedBooking(normalized);
      setQuoteForm(buildQuoteFormFromBooking(normalized));
    }
  };

  const buildQuotePayload = useCallback(() => ({
    boats: quoteForm.boats.map((boat) => ({
      boatOrder: Number(boat.boatOrder),
      boatId: boat.boatId,
    })),
    subtotalAmount: null,
    rentalUnit: quoteForm.rentalUnit || null,
    durationValue: quoteForm.durationValue === "" ? null : Number(quoteForm.durationValue),
    promotionCode: quoteForm.promotionCode?.trim() || null,
    depositAmount: resolveQuoteDepositAmount(quotePreview),
  }), [quoteForm, quotePreview]);

  const requiredQuoteBoatCount = selectedBooking ? normalizeRequestedBoats(selectedBooking, selectedBooking.selectedBoats).length : 0;
  const isQuoteBoatSelectionComplete = requiredQuoteBoatCount > 0
    && quoteForm.boats.length === requiredQuoteBoatCount
    && quoteForm.boats.every((boat) => boat.boatId);
  const hasBlockingPayment = Array.isArray(selectedBooking?.payments)
    && selectedBooking.payments.some((payment) => ["pending", "paid"].includes(String(payment.paymentStatus).toLowerCase()));
  const canManageQuote = Boolean(selectedBooking)
    && ["PendingQuote", "Quoted"].includes(selectedBooking.status)
    && !hasBlockingPayment;

  useEffect(() => {
    if (!selectedBooking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) {
      setQuotePreview(null);
      setQuotePreviewError("");
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      const payload = buildQuotePayload();
      try {
        setIsPreviewLoading(true);
        setQuotePreviewError("");
        const preview = await previewAdminCharterBookingQuote(selectedBooking.id, payload);
        if (isActive) setQuotePreview(preview);
      } catch (error) {
        if (!isActive) return;
        console.error("Lỗi preview giá charter:", {
          error,
          response: error.response?.data,
          payload,
        });
        setQuotePreview(null);
        setQuotePreviewError(getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể preview giá." : "Unable to preview quote.",
        ));
      } finally {
        if (isActive) setIsPreviewLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [buildQuotePayload, canManageQuote, isQuoteBoatSelectionComplete, lang, selectedBooking?.id]);

  const handleQuoteBoatChange = (boatOrder, boatId) => {
    setQuoteForm((prev) => ({
      ...prev,
      boats: prev.boats.map((boat) => (
        boat.boatOrder === boatOrder ? { ...boat, boatId } : boat
      )),
    }));
  };

  const handleStatusChange = async (id, nextStatus) => {
    if (!manualStatusOptions.includes(nextStatus)) return;

    const targetBooking = selectedBooking?.id === id
      ? selectedBooking
      : bookings.find((booking) => booking.id === id);
    if (nextStatus === "Cancelled") {
      const hasPaid = hasRefundablePayment(targetBooking);
      const result = await Swal.fire({
        icon: hasPaid ? "warning" : "question",
        title: lang === "VN" ? "Hủy booking này?" : "Cancel this booking?",
        text: hasPaid
          ? (lang === "VN"
            ? "Booking đã có thanh toán. Sau khi hủy, mở tab Thanh toán để gửi yêu cầu hoàn tiền với tài khoản nhận hoàn."
            : "This booking has paid payments. After cancellation, use the Payments tab to submit the refund with the recipient bank account.")
          : (lang === "VN" ? "Booking sẽ chuyển sang trạng thái Đã hủy." : "The booking will be marked as cancelled."),
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#124757",
        confirmButtonText: lang === "VN" ? "Xác nhận hủy" : "Cancel booking",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      await modifyAdminCharterBookingStatus(id, nextStatus);
      setBookings((prev) => prev.map((booking) => (
        booking.id === id ? { ...booking, status: nextStatus } : booking
      )));
      setSelectedBooking((prev) => (
        prev?.id === id ? { ...prev, status: nextStatus } : prev
      ));
      await refreshAfterChange();
      Swal.fire({
        icon: "success",
        title: nextStatus === "Cancelled" && hasRefundablePayment(targetBooking)
          ? (lang === "VN" ? "Đã hủy, đang theo dõi refund" : "Cancelled, refund is being tracked")
          : (lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated"),
        text: nextStatus === "Cancelled" && hasRefundablePayment(targetBooking)
          ? (lang === "VN" ? "Booking có giao dịch đã thu tiền. Vào tab Thanh toán để gửi yêu cầu hoàn tiền." : "This booking has collected payments. Open the Payments tab to submit the refund request.")
          : undefined,
        confirmButtonColor: "#124757",
        timer: nextStatus === "Cancelled" && hasRefundablePayment(targetBooking) ? undefined : 1400,
        showConfirmButton: nextStatus === "Cancelled" && hasRefundablePayment(targetBooking),
      });
    } catch (error) {
      console.error("Lỗi đổi trạng thái charter:", error);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Trạng thái này có thể chưa hợp lệ theo điều kiện thanh toán." : "This status may not be valid for the current payment state."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundPayment = async (payment) => {
    const paymentId = getRefundPaymentId(payment);
    if (!paymentId || !selectedBooking?.id) return;
    navigate(`/admin/charter-bookings-management/${selectedBooking.id}/payments/${encodeURIComponent(paymentId)}/refund`);
  };

  const handleSubmitQuote = async (event) => {
    event.preventDefault();
    if (!selectedBooking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) return;

    const payload = buildQuotePayload();

    try {
      setIsSubmitting(true);
      console.log("Charter quote request body:", {
        id: selectedBooking.id,
        endpoint: `/charter-bookings/admin/${selectedBooking.id}/quote`,
        payload,
      });
      await submitAdminCharterBookingQuote(selectedBooking.id, payload);
      await refreshAfterChange();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã chốt giá thuê tàu" : "Quote submitted",
        text: lang === "VN" ? "Booking đã chuyển sang trạng thái đã báo giá." : "The booking has been moved to quoted status.",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      console.error("Lỗi chốt giá charter:", {
        error,
        response: error.response?.data,
        payload,
      });
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể chốt giá" : "Unable to submit quote",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Vui lòng kiểm tra tàu, số khách, thời lượng và giá chốt." : "Please check boat, passenger count, duration, and subtotal.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleAttendance = async (action) => {
  //   if (!selectedBooking?.qrToken) {
  //     Swal.fire({
  //       icon: "info",
  //       title: lang === "VN" ? "Booking chưa có QR tổng" : "Group QR is unavailable",
  //       confirmButtonColor: "#124757",
  //     });
  //     return;
  //   }

  //   const payload = selectedAttendanceTicketIds.length > 0
  //     ? { action, mode: "Selected", ticketIds: selectedAttendanceTicketIds }
  //     : { action, mode: "All", ticketIds: null };

  //   try {
  //     setIsSubmitting(true);
  //     const manifest = await updateCharterAttendance(selectedBooking.qrToken, payload);
  //     setSelectedBooking(normalizeBooking(manifest));
  //     setSelectedAttendanceTicketIds([]);
  //     await loadData();
  //     Swal.fire({
  //       icon: "success",
  //       title: action === "CheckIn"
  //         ? (lang === "VN" ? "Đã xử lý check-in" : "Check-in processed")
  //         : (lang === "VN" ? "Đã xử lý check-out" : "Check-out processed"),
  //       text: lang === "VN" ? "Các vé không hợp lệ sẽ được hệ thống bỏ qua." : "Invalid ticket transitions are skipped by the server.",
  //       confirmButtonColor: "#124757",
  //     });
  //   } catch (error) {
  //     Swal.fire({
  //       icon: "error",
  //       title: lang === "VN" ? "Không thể cập nhật lượt đi" : "Unable to update attendance",
  //       text: error.response?.data?.message || (lang === "VN" ? "Vui lòng kiểm tra QR và trạng thái vé." : "Please check the QR token and ticket states."),
  //       confirmButtonColor: "#124757",
  //     });
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  return (
    <div className="space-y-8 font-body pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Quản Lý Thuê Tàu" : "Charter Booking Management"}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            {lang === "VN"
              ? "Xử lý yêu cầu thuê tàu, nhập tàu, chốt giá và cập nhật trạng thái booking."
              : "Handle charter requests, assign boats, submit quotes, and update booking status."}
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="bg-[#FFD100] text-[#124757] font-headline font-black uppercase text-xs tracking-wider px-6 py-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center gap-2 w-max shrink-0"
        >
          <span className={`material-symbols-outlined text-base font-black ${isLoading ? "animate-spin" : ""}`}>refresh</span>
          {lang === "VN" ? "Tải lại" : "Refresh"}
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { key: "all", icon: "map", labelVn: "Tổng yêu cầu", labelEn: "Total Requests", value: isLoading ? "..." : stats.total, color: "text-[#124757] dark:text-yellow-400", bg: "bg-slate-500/10 dark:bg-slate-900" },
          { key: "needsAction", icon: "priority_high", labelVn: "Cần xử lý", labelEn: "Needs Action", value: isLoading ? "..." : stats.needsAction, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
          { key: "waitingQuote", icon: "pending_actions", labelVn: "Chờ báo giá", labelEn: "Pending Quote", value: isLoading ? "..." : stats.pendingQuote, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { key: "toPay", icon: "request_quote", labelVn: "Đã báo giá", labelEn: "Quoted", value: isLoading ? "..." : stats.quoted, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
          { key: "active", icon: "event_available", labelVn: "Đã xác nhận", labelEn: "Confirmed", value: isLoading ? "..." : stats.confirmed, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
        ].map((item) => (
          <div
            key={item.key}
            className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg} ${item.color}`}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? item.labelVn : item.labelEn}</p>
                <h3 className={`mt-0.5 truncate font-headline text-lg font-black ${item.color}`}>{item.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col lg:flex-row items-center gap-4 justify-between">
        <div className="relative w-full lg:max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder={lang === "VN" ? "Tìm mã booking, khách hàng, tàu, lộ trình..." : "Search booking code, customer, boat, route..."}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] transition-all dark:text-white"
          />
        </div>

        <div className="relative w-full lg:w-68">
          <button
            type="button"
            onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
            className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-left flex items-center justify-between gap-3 text-[#124757] dark:text-yellow-400 outline-none focus:ring-2 focus:ring-[#FFD100] transition-all shadow-sm hover:bg-white dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-xl text-slate-400">filter_list</span>
              <span className="truncate text-xs font-headline font-black uppercase tracking-wider">
                {statusFilter === "All" ? (lang === "VN" ? "Tất cả trạng thái" : "All statuses") : getStatusInfo(statusFilter).label}
              </span>
            </span>
            <span className={`material-symbols-outlined text-xl text-slate-400 transition-transform ${isStatusDropdownOpen ? "rotate-180" : ""}`}>expand_more</span>
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-full min-w-64 rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl p-2">
              {statusOptions.map((status) => {
                const active = statusFilter === status;
                const info = getStatusInfo(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                      setIsStatusDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all ${
                      active
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-sm"
                        : "text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${status === "All" ? "bg-slate-400" : info.dot}`}></span>
                      <span className="truncate text-[11px] font-headline font-black uppercase tracking-wider">
                        {status === "All" ? (lang === "VN" ? "Tất cả" : "All") : info.label}
                      </span>
                    </span>
                    {active && <span className="material-symbols-outlined text-lg">check</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-250">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Booking" : "Booking"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Khách hàng" : "Customer"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Tàu & lộ trình" : "Boat & Route"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Lịch thuê" : "Schedule"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-6 text-right">{lang === "VN" ? "Giá chốt" : "Quote"}</th>
                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : currentBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
                    {lang === "VN" ? "Không có yêu cầu thuê tàu phù hợp." : "No charter requests match your filters."}
                  </td>
                </tr>
              ) : (
                currentBookings.map((booking) => {
                  const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
                  const detailTab = getDefaultAdminTab(booking);
                  return (
                    <tr
                      key={booking.id || booking.bookingCode}
                      onClick={() => openAdminBooking(booking, detailTab)}
                      className="cursor-pointer transition-colors hover:bg-[#124757]/5 dark:hover:bg-yellow-400/5 group"
                    >
                      <td className="py-4 px-6">
                        <p className="font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{booking.passengerCount} {lang === "VN" ? "khách" : "guests"} / {formatDuration(booking.durationValue, booking.rentalUnit, lang)}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 dark:text-white">{booking.customerName}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{booking.phone}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 dark:text-white">{booking.boatName}</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-55 truncate">{booking.route}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <p className="font-headline font-black text-slate-800 dark:text-white">{formatDate(booking.departureDate)}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{String(booking.startTime).slice(0, 5)}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusInfo.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">{getPaymentStatusInfo(booking.paymentStatus, lang).label}</p>
                      </td>
                      <td className="py-4 px-6 text-right font-headline font-black text-[#124757] dark:text-yellow-400">
                        {booking.estimatedPrice > 0 ? currencyFormatter.format(booking.estimatedPrice) : "--"}
                      </td>
                      <td className="py-4 px-6 text-center" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openAdminBooking(booking, detailTab)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] shadow-sm transition hover:scale-105 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                          {lang === "VN" ? "Chi tiết" : "Details"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 0 && (
        <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
          <span className="text-xs font-bold text-slate-400">
            {lang === "VN" ? `Hiển thị ${currentBookings.length} trong số ${filteredBookings.length} yêu cầu` : `Showing ${currentBookings.length} of ${filteredBookings.length} requests`}
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center justify-center text-slate-500 dark:text-slate-300">
              <span className="material-symbols-outlined text-base">chevron_left</span>
            </button>
            {getPaginationWindow(currentPage, totalPages).map((page) => (
              <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`min-w-8 h-8 px-2 rounded-xl font-headline font-black text-xs ${currentPage === page ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900" : "border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"}`}>
                {page}
              </button>
            ))}
            <button type="button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 disabled:opacity-40 flex items-center justify-center text-slate-500 dark:text-slate-300">
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-4xl shadow-2xl border border-transparent dark:border-slate-700 custom-scrollbar">
            <div className="sticky top-0 z-10 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start gap-4 bg-slate-50 dark:bg-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">{selectedBooking.bookingCode}</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).classes}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).dot}`}></span>
                    {getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).label}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-400 mt-1">{selectedBooking.customerName}</p>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 xl:grid-cols-5 gap-6">
              <div className="xl:col-span-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    { label: lang === "VN" ? "Khách hàng" : "Customer", value: selectedBooking.customerName },
                    { label: lang === "VN" ? "Liên hệ" : "Contact", value: `${selectedBooking.phone} / ${selectedBooking.email}` },
                    { label: lang === "VN" ? "Tàu đã gán" : "Assigned Boat", value: selectedBooking.boatName },
                    { label: lang === "VN" ? "Lộ trình" : "Route", value: selectedBooking.route },
                    { label: lang === "VN" ? "Ngày đi" : "Departure", value: `${formatDate(selectedBooking.departureDate)} ${String(selectedBooking.startTime).slice(0, 5)}` },
                    { label: lang === "VN" ? "Thời lượng" : "Duration", value: formatDuration(selectedBooking.durationValue, selectedBooking.rentalUnit, lang) },
                    { label: lang === "VN" ? "Hành khách" : "Passengers", value: formatPassengerSummary(selectedBooking, lang) },
                    { label: lang === "VN" ? "Thanh toán" : "Payment", value: getPaymentStatusInfo(selectedBooking.paymentStatus, lang).label },
                    { label: lang === "VN" ? "Giá chốt" : "Quote", value: selectedBooking.estimatedPrice > 0 ? currencyFormatter.format(selectedBooking.estimatedPrice) : "--" },
                    { label: lang === "VN" ? "Đặt cọc" : "Deposit", value: getCharterDepositAmount(selectedBooking.estimatedPrice, selectedBooking.depositAmount) > 0 ? currencyFormatter.format(getCharterDepositAmount(selectedBooking.estimatedPrice, selectedBooking.depositAmount)) : "--" },
                    {
                      label: lang === "VN" ? "Hạn phản hồi báo giá" : "Quote Deadline",
                      value: selectedBooking.holdExpiresAt
                        ? `${formatDateTime(selectedBooking.holdExpiresAt)} · ${getRemainingMs(selectedBooking.holdExpiresAt, nowTick) > 0 ? formatCountdown(getRemainingMs(selectedBooking.holdExpiresAt, nowTick)) : (lang === "VN" ? "Hết hạn" : "Expired")}`
                        : "--",
                    },
                    {
                      label: lang === "VN" ? "Hạn giữ booking/tàu" : "Booking Hold",
                      value: selectedBooking.bookingHoldExpiresAt
                        ? `${formatDateTime(selectedBooking.bookingHoldExpiresAt)} · ${getRemainingMs(selectedBooking.bookingHoldExpiresAt, nowTick) > 0 ? formatCountdown(getRemainingMs(selectedBooking.bookingHoldExpiresAt, nowTick)) : (lang === "VN" ? "Hết hạn" : "Expired")}`
                        : "--",
                    },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="font-bold text-slate-800 dark:text-white mt-1 break-words">{item.value}</p>
                    </div>
                  ))}
                  <div className="sm:col-span-2 rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Ghi chú đặc biệt" : "Special requests"}</p>
                    <p className="font-medium text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">{selectedBooking.specialRequests || (lang === "VN" ? "Không có" : "None")}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-100 dark:border-slate-700 space-y-3">
                  <h4 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-sm tracking-wider">
                    {lang === "VN" ? "Payment links" : "Payment Links"}
                  </h4>
                  {Array.isArray(selectedBooking.payments) && selectedBooking.payments.length > 0 ? (
                    <div className="space-y-2">
	                      {selectedBooking.payments.map((payment, index) => {
	                        const paymentId = pick(payment, ["paymentId", "id"], `#${index + 1}`);
	                        const expiresAt = pick(payment, ["expiresAt"], "");
	                        const remainingMs = getRemainingMs(expiresAt, nowTick);
	                        const refundInfo = getRefundStatusInfo(payment, lang);
	                        const refundAmount = getRefundAmount(payment);
	                        const refundMessage = getRefundMessage(payment);
	                        const canHandleRefund = canAdminHandleRefund(payment, selectedBooking.status);
	                        return (
	                          <div key={`${paymentId}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
	                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
	                              <div className="min-w-0">
	                                <p className="font-headline font-black text-[#124757] dark:text-yellow-400">{paymentId}</p>
	                                <div className="mt-2 flex flex-wrap items-center gap-2">
	                                  <span className={`rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).classes}`}>
	                                    {getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).label}
	                                  </span>
	                                  <span className={`rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${refundInfo.classes}`}>
	                                    {lang === "VN" ? "Refund" : "Refund"}: {refundInfo.label}
	                                  </span>
	                                </div>
	                                <p className="mt-2 text-[10px] font-bold text-slate-400">
	                                  {lang === "VN" ? "Đã thu" : "Paid"}: {getPaymentAmount(payment) > 0 ? currencyFormatter.format(getPaymentAmount(payment)) : "--"}
	                                  {" · "}
	                                  {lang === "VN" ? "Đã refund" : "Refunded"}: {refundAmount > 0 ? currencyFormatter.format(refundAmount) : "--"}
	                                </p>
	                                {refundMessage && <p className="mt-1 text-[10px] font-bold text-rose-500">{refundMessage}</p>}
	                                {pick(payment, ["checkoutUrl"], "") && (
	                                  <p className="mt-1 truncate text-[10px] font-medium text-slate-400">{pick(payment, ["checkoutUrl"], "")}</p>
	                                )}
	                              </div>
	                              <div className="shrink-0 text-left sm:text-right">
	                                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">expiresAt</p>
	                                <p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{expiresAt ? formatDateTime(expiresAt) : "--"}</p>
	                                {expiresAt && (
	                                  <p className="mt-1 font-headline font-black text-[#124757] dark:text-yellow-400 tabular-nums">
	                                    {remainingMs > 0 ? formatCountdown(remainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}
	                                  </p>
	                                )}
	                                {canHandleRefund && (
	                                  <button
	                                    type="button"
	                                    onClick={() => handleRefundPayment(payment)}
	                                    disabled={isSubmitting}
	                                    className="mt-2 rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
	                                  >
	                                    {lang === "VN" ? "Xử lý hoàn tiền" : "Process refund"}
	                                  </button>
	                                )}
	                              </div>
	                            </div>
	                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-900">
                      {lang === "VN" ? "Booking chưa có payment link." : "No payment links yet."}
                    </p>
                  )}
                </div>

                <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-100 dark:border-slate-700 space-y-4">
                  {/* <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-sm tracking-wider">
                        {lang === "VN" ? "Manifest & điểm danh" : "Manifest & Attendance"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {selectedAttendanceTicketIds.length > 0
                          ? (lang === "VN" ? `Đang chọn ${selectedAttendanceTicketIds.length} vé.` : `${selectedAttendanceTicketIds.length} tickets selected.`)
                          : (lang === "VN" ? "Không chọn vé để xử lý toàn bộ." : "Leave unselected to process all tickets.")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleAttendance("CheckIn")} disabled={isSubmitting || !selectedBooking.qrToken} className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-40">
                        Check-in
                      </button>
                      <button type="button" onClick={() => handleAttendance("CheckOut")} disabled={isSubmitting || !selectedBooking.qrToken} className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-40">
                        Check-out
                      </button>
                    </div>
                  </div> */}

                  {Array.isArray(selectedBooking.tickets) && selectedBooking.tickets.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto space-y-2 custom-scrollbar">
                      {selectedBooking.tickets.map((ticket, index) => {
                        const ticketId = pick(ticket, ["id", "ticketId"]);
                        const ticketCode = pick(ticket, ["ticketCode", "code"], `#${index + 1}`);
                        const passengerName = pick(ticket, ["fullName", "passengerName", "name"], "--");
                        const attendanceStatus = pick(ticket, ["attendanceStatus", "ticketStatus", "status"], "--");

                        return (
                          <label key={ticketId || ticketCode} className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 px-3 py-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!ticketId}
                              checked={ticketId ? selectedAttendanceTicketIds.includes(ticketId) : false}
                              onChange={(event) => setSelectedAttendanceTicketIds((prev) => event.target.checked ? [...prev, ticketId] : prev.filter((id) => id !== ticketId))}
                              className="accent-[#124757]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{passengerName}</p>
                              <p className="text-[9px] text-slate-400">{ticketCode}</p>
                            </div>
                            <span className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-300">{attendanceStatus}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs font-bold text-slate-400">
                      {lang === "VN" ? "Booking chưa có danh sách vé hành khách." : "No passenger tickets are available yet."}
                    </p>
                  )}
                </div>
              </div>

              <div className="xl:col-span-2 space-y-4">
                <form onSubmit={handleSubmitQuote} className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-100 dark:border-slate-700 space-y-4">
                  <h4 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-sm tracking-wider">
                    {lang === "VN" ? "Nhập tàu & chốt giá" : "Assign Boat & Quote"}
                  </h4>
                  {!canManageQuote && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                      {hasBlockingPayment
                        ? (lang === "VN"
                          ? "Booking đã có giao dịch đang chờ hoặc đã thanh toán. Không thể đổi tàu hay báo giá."
                          : "This booking has a pending or paid transaction. Boats and pricing can no longer be changed.")
                        : (lang === "VN"
                          ? "Trạng thái hiện tại không cho phép cập nhật báo giá."
                          : "The current status does not allow quote changes.")}
                    </div>
                  )}
                  <fieldset disabled={!canManageQuote} className="space-y-4 disabled:opacity-60">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tàu" : "Boats"}</label>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {lang === "VN" ? "Chọn đúng số tầng từng dòng, không trùng tàu." : "Select matching deck count for each row without duplicates."}
                      </p>
                    </div>
                    {quoteForm.boats.map((quoteBoat) => {
                      const selectedBoatIds = quoteForm.boats
                        .filter((boat) => boat.boatOrder !== quoteBoat.boatOrder && boat.boatId)
                        .map((boat) => boat.boatId);
                      const availableBoats = boats.filter((boat) => {
                        const boatId = getBoatId(boat);
                        const requiredDecks = Number(quoteBoat.requiredNumberOfDecks) || 0;
                        const matchesDeck = !requiredDecks || getBoatDeckCount(boat) === requiredDecks;
                        const matchesSeatSetup = requiredDecks
                          ? true
                          : (!quoteBoat.requiredSeatSetupType || getBoatSeatSetupType(boat) === quoteBoat.requiredSeatSetupType);
                        return isActiveBoat(boat) && matchesDeck && matchesSeatSetup && (!selectedBoatIds.includes(boatId) || boatId === quoteBoat.boatId);
                      });

                      return (
                        <div key={quoteBoat.boatOrder} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                              {lang === "VN" ? `Tàu ${quoteBoat.boatOrder}` : `Boat ${quoteBoat.boatOrder}`}
                            </p>
                            {quoteBoat.requiredNumberOfDecks ? (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 dark:text-slate-300">
                                {formatDeckCount(quoteBoat.requiredNumberOfDecks, lang)}
                              </span>
                            ) : quoteBoat.requiredSeatSetupType && (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 dark:text-slate-300">
                                {quoteBoat.requiredSeatSetupType}
                              </span>
                            )}
                          </div>
                          <select value={quoteBoat.boatId} onChange={(e) => handleQuoteBoatChange(quoteBoat.boatOrder, e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white outline-none">
                            <option value="">{lang === "VN" ? "Chọn tàu" : "Select boat"}</option>
                            {availableBoats.map((boat) => {
                              const boatId = getBoatId(boat);
                              const deckCount = getBoatDeckCount(boat);
                              const deckText = formatDeckCount(deckCount, lang);
                              return (
                                <option key={boatId} value={boatId}>
                                  {boat.code ? `${boat.code} - ` : ""}{boat.name} ({getBoatSeatCount(boat)} {lang === "VN" ? "ghế" : "seats"}{deckText ? `, ${deckText}` : ""}) - {currencyFormatter.format(getBoatPrice(boat, quoteForm.rentalUnit || selectedBooking.rentalUnit || "Day"))}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Đơn vị" : "Unit"}</label>
                      <select value={quoteForm.rentalUnit} onChange={(e) => setQuoteForm((prev) => ({ ...prev, rentalUnit: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none">
                        <option value="">{lang === "VN" ? "Giữ nguyên" : "Keep current"}</option>
                        {rentalUnits.map((unit) => <option key={unit} value={unit}>{formatRentalUnit(unit, lang)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời lượng" : "Duration"}</label>
                      <input type="number" min="1" max="60" value={quoteForm.durationValue} onChange={(e) => setQuoteForm((prev) => ({ ...prev, durationValue: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Mã khuyến mãi" : "Promo code"}</label>
                      <input value={quoteForm.promotionCode} onChange={(e) => setQuoteForm((prev) => ({ ...prev, promotionCode: e.target.value }))} placeholder={lang === "VN" ? "Tùy chọn" : "Optional"} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none" />
                    </div>
                  </div>
                  <CharterQuotePreviewPanel
                    lang={lang}
                    currencyFormatter={currencyFormatter}
                    isPreviewLoading={isPreviewLoading}
                    quotePreviewError={quotePreviewError}
                    quotePreview={quotePreview}
                    quoteForm={quoteForm}
                    isQuoteBoatSelectionComplete={isQuoteBoatSelectionComplete}
                    compact
                  />
                  <button type="submit" disabled={isSubmitting || !isQuoteBoatSelectionComplete || !canManageQuote} className="w-full px-6 py-3 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
                    {isSubmitting ? (lang === "VN" ? "Đang xử lý..." : "Submitting...") : (lang === "VN" ? "Chốt giá" : "Submit Quote")}
                  </button>
                  </fieldset>
                </form>

                <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-100 dark:border-slate-700 space-y-3">
                  <h4 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-sm tracking-wider">
                    {lang === "VN" ? "Cập nhật trạng thái" : "Update Status"}
                  </h4>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Trạng thái hiện tại" : "Current Status"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).dot}`}></span>
                        {getStatusInfo(selectedBooking.status, selectedBooking.paymentStatus).label}
                      </span>
                    </div>
                  </div>
                  <select defaultValue="" onChange={(event) => handleStatusChange(selectedBooking.id, event.target.value)} disabled={isSubmitting} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none disabled:opacity-60">
                    <option value="" disabled>{lang === "VN" ? "Chọn trạng thái cập nhật thủ công" : "Select manual status update"}</option>
                    {manualStatusOptions.map((status) => (
                      <option key={status} value={status}>{getStatusInfo(status).label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                    {lang === "VN"
                      ? "Hệ thống tự chuyển Chờ báo giá, Đã báo giá, Đã xác nhận và Đã hoàn tiền theo quy trình. Quản trị chỉ cập nhật thủ công: Đã hủy, Hết hạn, Hoàn tất."
                      : "Pending Quote, Quoted, Confirmed, and Refunded are handled automatically by the workflow. Admins can manually set only Cancelled, Expired, or Completed."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCharterBookingDetail() {
  const { lang } = useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [boats, setBoats] = useState([]);
  const [activeTab, setActiveTab] = useState(() => location.state?.tab || "overview");
  const [quoteForm, setQuoteForm] = useState({
    boats: [],
    rentalUnit: "",
    durationValue: "",
    promotionCode: "",
  });
  const [quotePreview, setQuotePreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
  );

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setLoadError("");
      const [detail, boatData] = await Promise.all([
        fetchAdminCharterBookingDetail(id),
        fetchAllBoats({ status: "Active" }).catch(() => []),
      ]);
      const normalized = normalizeBooking(detail);
      setBooking(normalized);
      setBoats(Array.isArray(boatData) ? boatData : []);
      setQuoteForm(buildQuoteFormFromBooking(normalized));
      setQuotePreview(null);
      setQuotePreviewError("");
      if (!location.state?.tab) {
        setActiveTab(getDefaultAdminTab(normalized));
      }
    } catch (error) {
      console.error("Lỗi tải chi tiết charter booking:", error);
      setLoadError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể tải chi tiết thuê tàu." : "Unable to load charter booking detail.",
      ));
    } finally {
      setIsLoading(false);
    }
  }, [id, lang, location.state?.tab]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const buildDetailQuotePayload = useCallback(() => ({
    boats: quoteForm.boats.map((boat) => ({
      boatOrder: Number(boat.boatOrder),
      boatId: boat.boatId,
    })),
    subtotalAmount: null,
    rentalUnit: quoteForm.rentalUnit || null,
    durationValue: quoteForm.durationValue === "" ? null : Number(quoteForm.durationValue),
    promotionCode: quoteForm.promotionCode?.trim() || null,
    depositAmount: resolveQuoteDepositAmount(quotePreview),
  }), [quoteForm, quotePreview]);

  const requiredQuoteBoatCount = booking ? normalizeRequestedBoats(booking, booking.selectedBoats).length : 0;
  const isQuoteBoatSelectionComplete = requiredQuoteBoatCount > 0
    && quoteForm.boats.length === requiredQuoteBoatCount
    && quoteForm.boats.every((boat) => boat.boatId);
  const hasBlockingPayment = Array.isArray(booking?.payments)
    && booking.payments.some((payment) => ["pending", "paid"].includes(String(payment.paymentStatus).toLowerCase()));
  const canManageQuote = Boolean(booking)
    && ["PendingQuote", "Quoted"].includes(booking.status)
    && !hasBlockingPayment;

  const bookingPaidAmount = useMemo(() => {
    if (!Array.isArray(booking?.payments)) return 0;
    return booking.payments
      .filter((payment) => isPaidPayment(payment))
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);
  }, [booking?.payments]);

  const adminActionsPhase = useMemo(() => {
    if (!booking) return "closed";
    const status = booking.status;
    if (["Cancelled", "Expired", "Refunded", "Completed"].includes(status)) return "closed";
    if (isBookingPaymentClosed(booking) && status !== "PendingQuote") return "closed";
    if (status === "PendingQuote" || (status === "Quoted" && canManageQuote)) return "quote";
    if (["Quoted", "PendingPayment"].includes(status)) return "payment";
    if (status === "Confirmed") return "operate";
    return "closed";
  }, [booking, canManageQuote]);

  useEffect(() => {
    if (!booking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) {
      setQuotePreview(null);
      setQuotePreviewError("");
      return;
    }

    let isActive = true;
    const timer = setTimeout(async () => {
      const payload = buildDetailQuotePayload();
      try {
        setIsPreviewLoading(true);
        setQuotePreviewError("");
        const preview = await previewAdminCharterBookingQuote(booking.id, payload);
        if (isActive) setQuotePreview(preview);
      } catch (error) {
        if (!isActive) return;
        setQuotePreview(null);
        setQuotePreviewError(getApiErrorMessage(
          error,
          lang === "VN" ? "Không thể preview giá." : "Unable to preview quote.",
        ));
      } finally {
        if (isActive) setIsPreviewLoading(false);
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [booking?.id, buildDetailQuotePayload, canManageQuote, isQuoteBoatSelectionComplete, lang]);

  const handleDetailQuoteBoatChange = (boatOrder, boatId) => {
    setQuoteForm((prev) => ({
      ...prev,
      boats: prev.boats.map((boat) => (
        boat.boatOrder === boatOrder ? { ...boat, boatId } : boat
      )),
    }));
  };

  const handleDetailSubmitQuote = async (event) => {
    event.preventDefault();
    if (!booking?.id || !isQuoteBoatSelectionComplete || !canManageQuote) return;

    const payload = buildDetailQuotePayload();

    try {
      setIsSubmitting(true);
      await submitAdminCharterBookingQuote(booking.id, payload);
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã chốt giá thuê tàu" : "Quote submitted",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể chốt giá" : "Unable to submit quote",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Vui lòng kiểm tra tàu, số khách, thời lượng và giá chốt." : "Please check boat, passenger count, duration, and subtotal.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailStatusChange = async (nextStatus) => {
    if (!booking?.id || !manualStatusOptions.includes(nextStatus)) return;

    if (nextStatus === "Cancelled") {
      const hasPaid = hasRefundablePayment(booking);
      const result = await Swal.fire({
        icon: hasPaid ? "warning" : "question",
        title: lang === "VN" ? "Hủy booking này?" : "Cancel this booking?",
        text: hasPaid
          ? (lang === "VN"
            ? "Booking đã có thanh toán. Sau khi hủy, mở tab Thanh toán để gửi yêu cầu hoàn tiền với tài khoản nhận hoàn."
            : "This booking has paid payments. After cancellation, use the Payments tab to submit the refund with the recipient bank account.")
          : (lang === "VN" ? "Booking sẽ chuyển sang trạng thái Đã hủy." : "The booking will be marked as cancelled."),
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#124757",
        confirmButtonText: lang === "VN" ? "Xác nhận hủy" : "Cancel booking",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setIsSubmitting(true);
      await modifyAdminCharterBookingStatus(booking.id, nextStatus);
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: nextStatus === "Cancelled" && hasRefundablePayment(booking)
          ? (lang === "VN" ? "Đã hủy, đang theo dõi refund" : "Cancelled, refund is being tracked")
          : (lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated"),
        text: nextStatus === "Cancelled" && hasRefundablePayment(booking)
          ? (lang === "VN" ? "Booking có giao dịch đã thu tiền. Vào tab Thanh toán để gửi yêu cầu hoàn tiền." : "This booking has collected payments. Open the Payments tab to submit the refund request.")
          : undefined,
        confirmButtonColor: "#124757",
        timer: nextStatus === "Cancelled" && hasRefundablePayment(booking) ? undefined : 1400,
        showConfirmButton: nextStatus === "Cancelled" && hasRefundablePayment(booking),
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
        text: error.response?.data?.message || (lang === "VN" ? "Trạng thái này có thể chưa hợp lệ theo điều kiện thanh toán." : "This status may not be valid for the current payment state."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailRefundPayment = async (payment) => {
    const paymentId = getRefundPaymentId(payment);
    if (!paymentId || !booking?.id) return;
    navigate(`/admin/charter-bookings-management/${booking.id}/payments/${encodeURIComponent(paymentId)}/refund`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 animate-spin"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-4 font-body">
        <button type="button" onClick={() => navigate("/admin/charter-bookings-management")} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-400">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {lang === "VN" ? "Quay lại danh sách" : "Back to list"}
        </button>
        <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <p className="font-bold">{loadError || (lang === "VN" ? "Không có dữ liệu booking." : "No booking data.")}</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
  const showBookingHoldCountdown = shouldShowBookingHoldCountdown(booking);
  const quotePaymentDeadline = getCharterQuotePaymentDeadline(booking);
  const bookingHoldRemainingMs = showBookingHoldCountdown
    ? getRemainingMs(quotePaymentDeadline, nowTick)
    : 0;
  const quoteTotal = Number(booking?.estimatedPrice || 0);
  const remainingAmount = Math.max(quoteTotal - bookingPaidAmount, 0);
  const selectedBoats = Array.isArray(booking.selectedBoats) ? booking.selectedBoats : [];
  const requestedBoats = Array.isArray(booking.requestedBoats) ? booking.requestedBoats : [];
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const tickets = canShowCharterTickets(booking)
    ? (Array.isArray(booking.tickets) ? booking.tickets : [])
    : [];
  const workspaceTabs = [
    { id: "actions", icon: "edit_square", label: lang === "VN" ? "Thao tác" : "Actions" },
    { id: "overview", icon: "dashboard", label: lang === "VN" ? "Tổng quan" : "Overview" },
    { id: "payments", icon: "payments", label: lang === "VN" ? "Thanh toán" : "Payments", badge: payments.length || (bookingNeedsRefundAttention(booking) ? "!" : "") },
    { id: "tickets", icon: "confirmation_number", label: lang === "VN" ? "Vé/khách" : "Tickets", badge: tickets.length || "" },
  ];

  return (
    <div className="space-y-6 pb-10 font-body">
      <div className="flex flex-col gap-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate("/admin/charter-bookings-management")} className="mb-4 inline-flex items-center gap-2 text-xs font-headline font-black uppercase tracking-wider text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Danh sách thuê tàu" : "Charter booking list"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 md:text-3xl">{booking.bookingCode}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${statusInfo.classes}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`}></span>
              {statusInfo.label}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-slate-300">{booking.customerName} · {booking.route}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadDetail} className="inline-flex w-max items-center gap-2 rounded-2xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] shadow-sm">
            <span className="material-symbols-outlined text-base">refresh</span>
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sticky top-4 z-20 rounded-3xl border border-slate-100 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95">
        <div className={`grid grid-cols-2 gap-2 ${workspaceTabs.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {workspaceTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-[10px] font-headline font-black uppercase tracking-wider transition-all ${
                  active
                    ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
              >
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {tab.badge ? (
                  <span className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                    tab.badge === "!" ? "bg-rose-500 text-white" : "bg-[#FFD100] text-slate-900"
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

      <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <p className="mb-3 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Tiến trình booking" : "Booking progress"}
        </p>
        <CharterWorkflowStepper status={booking.status} lang={lang} />
      </div>

      {bookingNeedsRefundAttention(booking) && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-2xl text-rose-600 dark:text-rose-300">currency_exchange</span>
              <div>
                <p className="font-headline text-sm font-black uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  {lang === "VN" ? "Cần xử lý hoàn tiền" : "Refund attention required"}
                </p>
                <p className="mt-1 text-xs font-bold text-rose-600/80 dark:text-rose-200">
                  {lang === "VN" ? "Booking đã hủy hoặc hoàn lỗi — mở tab Thanh toán để xử lý." : "Booking cancelled or refund failed — open the Payments tab to process."}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setActiveTab("payments")} className="rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white">
              {lang === "VN" ? "Đến thanh toán" : "Go to payments"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "actions" && (
        <AdminBookingActionsTab
          lang={lang}
          phase={adminActionsPhase}
          booking={booking}
          statusInfo={statusInfo}
          boats={boats}
          quoteForm={quoteForm}
          setQuoteForm={setQuoteForm}
          rentalUnits={rentalUnits}
          canManageQuote={canManageQuote}
          hasBlockingPayment={hasBlockingPayment}
          isSubmitting={isSubmitting}
          isQuoteBoatSelectionComplete={isQuoteBoatSelectionComplete}
          isPreviewLoading={isPreviewLoading}
          quotePreviewError={quotePreviewError}
          quotePreview={quotePreview}
          currencyFormatter={currencyFormatter}
          formatDate={formatDate}
          formatDuration={formatDuration}
          formatPassengerSummary={formatPassengerSummary}
          formatDeckCount={formatDeckCount}
          getRequestedDeckCount={getRequestedDeckCount}
          getBoatDeckCount={getBoatDeckCount}
          getBoatSeatSetupType={getBoatSeatSetupType}
          getBoatId={getBoatId}
          getBoatSeatCount={getBoatSeatCount}
          getBoatPrice={getBoatPrice}
          isActiveBoat={isActiveBoat}
          showBookingHoldCountdown={showBookingHoldCountdown}
          bookingHoldRemainingMs={bookingHoldRemainingMs}
          formatDateTime={formatDateTime}
          formatCountdown={formatCountdown}
          quotePaymentDeadline={quotePaymentDeadline}
          quoteTotal={quoteTotal}
          bookingPaidAmount={bookingPaidAmount}
          selectedBoats={selectedBoats}
          payments={payments}
          manualStatusOptions={manualStatusOptions}
          getStatusInfo={getStatusInfo}
          onSubmitQuote={handleDetailSubmitQuote}
          onQuoteBoatChange={handleDetailQuoteBoatChange}
          onStatusChange={handleDetailStatusChange}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === "overview" && (
        <AdminBookingOverviewTab
          lang={lang}
          booking={booking}
          showBookingHoldCountdown={showBookingHoldCountdown}
          bookingHoldRemainingMs={bookingHoldRemainingMs}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          formatCountdown={formatCountdown}
          quotePaymentDeadline={quotePaymentDeadline}
          formatDuration={formatDuration}
          formatPassengerSummary={formatPassengerSummary}
          formatDeckCount={formatDeckCount}
          getRequestedDeckCount={getRequestedDeckCount}
          getBoatDeckCount={getBoatDeckCount}
          getBoatSeatSetupType={getBoatSeatSetupType}
          getBoatId={getBoatId}
          getBoatSeatCount={getBoatSeatCount}
          getPaymentStatusInfo={getPaymentStatusInfo}
          currencyFormatter={currencyFormatter}
          quoteTotal={quoteTotal}
          bookingPaidAmount={bookingPaidAmount}
          remainingAmount={remainingAmount}
          requestedBoats={requestedBoats}
          selectedBoats={selectedBoats}
        />
      )}


      {activeTab === "payments" && (
      <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Theo dõi thanh toán" : "Payment Monitoring"}</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {lang === "VN"
                ? "Hiển thị các giao dịch thanh toán của booking: trạng thái, hạn thanh toán và đường dẫn PayOS để quản trị kiểm tra."
                : "Shows booking payment transactions: status, payment deadline, and PayOS link for admin review."}
            </p>
          </div>
          <span className="w-max rounded-xl bg-slate-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {payments.length} {lang === "VN" ? "giao dịch" : "payments"}
          </span>
        </div>
	        <div className="mt-4 overflow-x-auto">
	          <table className="w-full min-w-250 text-left text-xs">
	            <thead className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
	              <tr className="border-b border-slate-100 dark:border-slate-700">
	                <th className="py-3 pr-4">ID</th>
	                <th className="py-3 pr-4">Status</th>
	                <th className="py-3 pr-4">{lang === "VN" ? "Số tiền" : "Amount"}</th>
	                <th className="py-3 pr-4">Refund</th>
	                <th className="py-3 pr-4">expiresAt</th>
	                <th className="py-3 pr-4">checkoutUrl</th>
	                <th className="py-3 pr-4 text-right">{lang === "VN" ? "Xử lý" : "Action"}</th>
	              </tr>
	            </thead>
	            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
	              {payments.length > 0 ? payments.map((payment, index) => {
	                const expiresAt = pick(payment, ["expiresAt"], "");
	                const remainingMs = getRemainingMs(expiresAt, nowTick);
	                const refundInfo = getRefundStatusInfo(payment, lang);
	                const refundAmount = getRefundAmount(payment);
	                const refundMessage = getRefundMessage(payment);
	                const canHandleRefund = canAdminHandleRefund(payment, booking.status);
	                return (
	                  <tr key={`${pick(payment, ["id", "paymentId"], index)}-${index}`}>
	                    <td className="py-3 pr-4 font-bold text-slate-800 dark:text-white">{pick(payment, ["paymentId", "id"], "--")}</td>
	                    <td className="py-3 pr-4">
	                      <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).classes}`}>
	                        {getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).label}
	                      </span>
	                    </td>
	                    <td className="py-3 pr-4 font-bold text-slate-600 dark:text-slate-300">
	                      {getPaymentAmount(payment) > 0 ? currencyFormatter.format(getPaymentAmount(payment)) : "--"}
	                    </td>
	                    <td className="py-3 pr-4">
	                      <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${refundInfo.classes}`}>
	                        {refundInfo.label}
	                      </span>
	                      <p className="mt-1 text-[10px] font-bold text-slate-400">
	                        {refundAmount > 0 ? currencyFormatter.format(refundAmount) : "--"}
	                      </p>
	                      {refundMessage && <p className="mt-1 max-w-60 break-words text-[10px] font-bold text-rose-500">{refundMessage}</p>}
	                    </td>
	                    <td className="py-3 pr-4 font-bold text-slate-600 dark:text-slate-300">
	                      {expiresAt ? `${formatDateTime(expiresAt)} · ${remainingMs > 0 ? formatCountdown(remainingMs) : (lang === "VN" ? "Hết hạn" : "Expired")}` : "--"}
	                    </td>
	                    <td className="max-w-100 truncate py-3 pr-4 text-slate-400">{pick(payment, ["checkoutUrl", "paymentUrl"], "--")}</td>
	                    <td className="py-3 pr-4 text-right">
	                      {canHandleRefund ? (
	                        <button
	                          type="button"
	                          onClick={() => handleDetailRefundPayment(payment)}
	                          disabled={isSubmitting}
	                          className="rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50"
	                        >
	                          {lang === "VN" ? "Xử lý hoàn tiền" : "Process refund"}
	                        </button>
	                      ) : (
	                        <span className="text-[10px] font-bold text-slate-400">--</span>
	                      )}
	                    </td>
	                  </tr>
	                );
	              }) : (
	                <tr>
	                  <td colSpan={7} className="py-8 text-center font-bold text-slate-400">{lang === "VN" ? "Chưa có payment link." : "No payment links yet."}</td>
	                </tr>
	              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === "tickets" && (
        <AdminBookingTicketsTab
          lang={lang}
          booking={booking}
          tickets={tickets}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
          formatPassengerSummary={formatPassengerSummary}
          getPaymentStatusInfo={getPaymentStatusInfo}
        />
      )}
    </div>
  );
}

export function AdminCharterBookingRefund() {
  const { lang } = useApp();
  const { id, paymentId } = useParams();
  const navigate = useNavigate();
  const decodedPaymentId = paymentId ? decodeURIComponent(paymentId) : "";
  const [booking, setBooking] = useState(null);
  const [payment, setPayment] = useState(null);
  const [form, setForm] = useState(() => buildRefundFormDefaults({}, {}));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitResult, setSubmitResult] = useState(null);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }),
    []
  );

  const endpoint = `/api/payments/${encodeURIComponent(decodedPaymentId)}/refund`;

  const loadRefundDetail = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setLoadError("");
      const detail = await fetchAdminCharterBookingDetail(id);
      const normalized = normalizeBooking(detail);
      const targetPayment = normalized.payments.find((item) => getRefundPaymentId(item) === decodedPaymentId);

      setBooking(normalized);
      setPayment(targetPayment || null);
      setForm(buildRefundFormDefaults(targetPayment || {}, normalized));

      if (!targetPayment) {
        setLoadError(lang === "VN"
          ? "Không tìm thấy payment cần refund trong booking này."
          : "Unable to find this payment in the selected booking.");
      }
    } catch (error) {
      console.error("Lỗi tải trang refund:", error);
      setLoadError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể tải dữ liệu refund." : "Unable to load refund data.",
      ));
    } finally {
      setIsLoading(false);
    }
  }, [decodedPaymentId, id, lang]);

  useEffect(() => {
    loadRefundDetail();
  }, [loadRefundDetail]);

  const handleFieldChange = (field) => (event) => {
    const value = field === "accountNumber"
      ? event.target.value.replace(/\D/g, "").slice(0, 20)
      : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setSubmitError("");
    setSubmitResult(null);
  };

  const handleBankBinChange = (bankBin) => {
    setForm((prev) => ({ ...prev, bankBin }));
    setSubmitError("");
    setSubmitResult(null);
  };

  const handleSyncPayment = async () => {
    if (!decodedPaymentId) return;

    try {
      setIsSyncing(true);
      setSubmitError("");
      setSubmitResult(null);
      const response = await syncBookingPayment(decodedPaymentId);
      setSubmitResult(response || { ok: true });
      await loadRefundDetail();
    } catch (error) {
      console.error("Sync payment failed:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể đồng bộ trạng thái payment. Vui lòng tải lại booking hoặc thử lại." : "Unable to sync payment status. Please reload the booking or try again.",
      ));
      setSubmitResult(error.response?.data || null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmitRefund = async (event) => {
    event.preventDefault();
    const payload = buildRefundRequestBody(form);
    const validationMessage = getRefundValidationMessage(payload, lang);

    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    if (!payment || getRemainingRefundAmount(payment) <= 0 || isRefundDone(payment) || isRefundProcessing(payment)) {
      setSubmitError(lang === "VN" ? "Payment này hiện không còn số tiền có thể gửi yêu cầu hoàn tự động." : "This payment has no amount available for a new automatic refund request.");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitResult(null);
      const response = await refundBookingPayment(decodedPaymentId, payload);
      setSubmitResult(response || { ok: true });
      await loadRefundDetail();
    } catch (error) {
      console.error("Refund failed:", error);
      setSubmitError(getApiErrorMessage(
        error,
        lang === "VN" ? "Không thể gửi yêu cầu hoàn tiền. Vui lòng kiểm tra trạng thái giao dịch hoặc thử lại." : "Unable to request refund. Please check the transaction status or try again.",
      ));
      setSubmitResult(error.response?.data || null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-4xl border border-slate-100 bg-white p-10 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#124757] dark:text-yellow-400">progress_activity</span>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-300">{lang === "VN" ? "Đang tải dữ liệu refund..." : "Loading refund data..."}</p>
        </div>
      </div>
    );
  }

  const refundInfo = payment ? getRefundStatusInfo(payment, lang) : getRefundStatusInfo({}, lang);
  const bookingStatusInfo = booking ? getCharterBookingStatusInfo(booking.status, booking.paymentStatus, lang) : null;
  const paidAmount = payment ? getPaymentAmount(payment) : 0;
  const refundedAmount = payment ? getRefundAmount(payment) : 0;
  const refundRequestedAmount = payment ? getRefundRequestedAmount(payment) : 0;
  const remainingRefundAmount = payment ? getRemainingRefundAmount(payment) : 0;
  const canSubmitPayOsRefund = Boolean(payment) && remainingRefundAmount > 0 && !isRefundDone(payment) && !isRefundProcessing(payment);
  const amountNeedAction = isRefundProcessing(payment || {})
    ? refundRequestedAmount
    : remainingRefundAmount;
  const syncEndpoint = `/api/payments/${encodeURIComponent(decodedPaymentId)}/sync`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(id ? `/admin/charter-bookings-management/${id}` : "/admin/charter-bookings-management")}
            className="mb-3 inline-flex items-center gap-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 transition-colors hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {lang === "VN" ? "Quay lại booking" : "Back to booking"}
          </button>
          <h2 className="font-headline text-3xl font-black uppercase tracking-tight text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Xử lý hoàn tiền" : "Process Refund"}
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-400">
            {booking?.bookingCode || "--"} · {decodedPaymentId || "--"}
          </p>
        </div>
        {payment && (
          <span className={`w-max rounded-xl border px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider ${refundInfo.classes}`}>
            Refund: {refundInfo.label}
          </span>
        )}
      </div>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {loadError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Thông tin booking" : "Booking Info"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { label: "Booking", value: booking?.bookingCode },
                { label: lang === "VN" ? "Khách hàng" : "Customer", value: booking?.customerName },
                { label: lang === "VN" ? "Liên hệ" : "Contact", value: booking ? `${booking.phone} / ${booking.email}` : "" },
                { label: lang === "VN" ? "Lộ trình" : "Route", value: booking?.route },
                { label: lang === "VN" ? "Ngày đi" : "Departure", value: booking ? `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` : "" },
                { label: lang === "VN" ? "Trạng thái" : "Status", value: bookingStatusInfo?.label },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 break-words font-bold text-slate-800 dark:text-white">{item.value || "--"}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Thông tin payment" : "Payment Info"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { label: "Payment ID", value: getRefundPaymentId(payment || {}) || decodedPaymentId },
                { label: "Payment status", value: payment ? getPaymentStatusInfo(pick(payment, ["paymentStatus"], "--"), lang).label : "--" },
                { label: lang === "VN" ? "Đã thu" : "Paid amount", value: paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--" },
                { label: lang === "VN" ? "Đã hoàn" : "Refunded amount", value: refundedAmount > 0 ? currencyFormatter.format(refundedAmount) : "--" },
                { label: lang === "VN" ? "Đã yêu cầu hoàn" : "Requested refund", value: refundRequestedAmount > 0 ? currencyFormatter.format(refundRequestedAmount) : "--" },
                { label: lang === "VN" ? "Còn cần xử lý" : "Amount to handle", value: amountNeedAction > 0 ? currencyFormatter.format(amountNeedAction) : "--" },
                { label: "Refund method", value: getRefundMethod(payment || {}) || "--" },
                { label: "Refund reference", value: getRefundReferenceId(payment || {}) || "--" },
                { label: "Refund status", value: refundInfo.label },
                { label: "expiresAt", value: payment && pick(payment, ["expiresAt"], "") ? formatDateTime(pick(payment, ["expiresAt"], "")) : "--" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 break-words font-bold text-slate-800 dark:text-white">{item.value || "--"}</p>
                </div>
              ))}
              {payment && getRefundMessage(payment) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {getRefundMessage(payment)}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6 xl:col-span-3">
          <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Ngữ cảnh hoàn tiền" : "Refund Context"}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {lang === "VN" ? "FE không gửi amount. Backend tự tính số tiền hoàn theo payment và chính sách." : "The frontend does not send amount. Backend calculates the refund from payment data and policy."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncPayment}
                disabled={!payment || isSyncing || isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-[#124757] transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-base">{isSyncing ? "progress_activity" : "sync"}</span>
                {isSyncing ? (lang === "VN" ? "Đang đồng bộ" : "Syncing") : (lang === "VN" ? "Đồng bộ payment" : "Sync payment")}
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: lang === "VN" ? "Đã thu" : "Paid", value: paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--" },
                { label: lang === "VN" ? "Đã hoàn" : "Refunded", value: refundedAmount > 0 ? currencyFormatter.format(refundedAmount) : "--" },
                { label: lang === "VN" ? "Đã yêu cầu" : "Requested", value: refundRequestedAmount > 0 ? currencyFormatter.format(refundRequestedAmount) : "--" },
                { label: lang === "VN" ? "Còn cần xử lý" : "To handle", value: amountNeedAction > 0 ? currencyFormatter.format(amountNeedAction) : "--", highlight: true },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.highlight ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10" : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-lg font-headline font-black ${item.highlight ? "text-rose-600 dark:text-rose-300" : "text-[#124757] dark:text-yellow-400"}`}>{item.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 dark:text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">PayOS refund</p>
                <p className="mt-1 break-all font-mono text-[11px]">POST {endpoint}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">Sync</p>
                <p className="mt-1 break-all font-mono text-[11px]">POST {syncEndpoint}</p>
              </div>
            </div>
          </section>

          <form onSubmit={handleSubmitRefund} className="space-y-6">
            <section className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-headline font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Hoàn tiền PayOS" : "PayOS Refund"}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {canSubmitPayOsRefund
                      ? (lang === "VN" ? "Nhập tài khoản nhận hoàn, hệ thống sẽ gọi refund PayOS trước." : "Enter the receiving account; the system will attempt PayOS refund first.")
                      : (lang === "VN" ? "Payment này chưa đủ điều kiện tạo yêu cầu hoàn PayOS mới." : "This payment is not eligible for a new PayOS refund request.")}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!canSubmitPayOsRefund || isSubmitting || isSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-headline font-black uppercase tracking-wider text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">{isSubmitting ? "progress_activity" : "payments"}</span>
                  {isSubmitting ? (lang === "VN" ? "Đang gửi" : "Submitting") : (lang === "VN" ? "Gửi hoàn PayOS" : "Submit PayOS refund")}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Lý do" : "Reason"}</span>
                  <input
                    value={form.reason}
                    onChange={handleFieldChange("reason")}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder={lang === "VN" ? "Khách hàng yêu cầu hoàn tiền" : "Customer refund"}
                  />
                </label>
                <div className="sm:col-span-2">
                  <BankBinSelect
                    value={form.bankBin}
                    onChange={handleBankBinChange}
                    lang={lang}
                    disabled={!canSubmitPayOsRefund || isSubmitting || isSyncing}
                    label={lang === "VN" ? "Ngân hàng nhận hoàn" : "Refund bank"}
                    searchInputClassName="mt-1 w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    fallbackInputClassName="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                  />
                </div>
                <label>
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Số tài khoản" : "Account number"}</span>
                  <input
                    value={form.accountNumber}
                    onChange={handleFieldChange("accountNumber")}
                    inputMode="numeric"
                    maxLength={20}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder="123456789"
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tên tài khoản" : "Account name"}</span>
                  <input
                    value={form.accountName}
                    onChange={handleFieldChange("accountName")}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                    placeholder="NGUYEN VAN A"
                  />
                </label>
              </div>
            </section>
          </form>

          {(submitError || submitResult) && (
            <section className={`overflow-hidden rounded-4xl border shadow-sm ${submitError ? "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"}`}>
              <div className="border-b border-current/10 px-5 py-3">
                <p className={`text-[10px] font-headline font-black uppercase tracking-widest ${submitError ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                  {submitError ? (lang === "VN" ? "Hoàn tiền lỗi" : "Refund failed") : (lang === "VN" ? "Kết quả xử lý" : "Processing result")}
                </p>
                {submitError && <p className="mt-1 text-sm font-bold text-rose-600 dark:text-rose-300">{submitError}</p>}
              </div>
              {submitResult && (
                <pre className="max-h-80 overflow-auto p-5 text-sm leading-6 text-slate-800 dark:text-slate-100">{JSON.stringify(submitResult, null, 2)}</pre>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
