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
  updateMyCharterBookingPassengers,
} from "../../../services/charterBookingService";
import { createBookingPayment, syncBookingPayment, syncBookingPaymentByOrderCode } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { PaymentLottieIcon } from "../../../components/PaymentLottieIcon";

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

const PayOSLogo = ({ inverted = false }) => (
  <span className="inline-flex shrink-0 items-center gap-1.5" aria-label="PayOS">
    <span
      className={`flex h-6 w-6 items-center justify-center overflow-hidden rounded-md ${
        inverted
          ? "bg-white text-[#124757] dark:bg-slate-900 dark:text-yellow-400"
          : "bg-white text-[#124757] ring-1 ring-[#D8E7EA] dark:bg-slate-900 dark:text-yellow-400 dark:ring-slate-700"
      }`}
    >
      <PaymentLottieIcon className="h-7 w-7" />
    </span>
    <span
      className={`font-headline text-sm font-black normal-case tracking-normal ${
        inverted ? "text-white dark:text-slate-900" : "text-[#124757] dark:text-yellow-400"
      }`}
    >
      pay<span className={inverted ? "text-[#FFD100] dark:text-[#124757]" : "text-cyan-500"}>OS</span>
    </span>
  </span>
);

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
  const fromName = pick(item, ["fromStationName", "fromStation.stationName", "fromStation.name"]);
  const toName = pick(item, ["toStationName", "toStation.stationName", "toStation.name"]);
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  const pendingPayment = payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending");
  const paidPayments = payments.filter(isPaidPayment);
  const paidPaymentWithId = paidPayments.find((payment) => getPaymentId(payment));
  const paymentStatus = pick(item, ["paymentStatus"], "--");
  const rawDepositAmount = Number(pick(item, ["depositAmount"], 0)) || 0;
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
    fromStationName: fromName,
    toStationName: toName,
    departureDate: pick(item, ["departureDate", "startDate"]),
    startTime: pick(item, ["startTime"], "--"),
    rentalUnit: pick(item, ["rentalUnit"], "Day"),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 1)),
    adultCount,
    childCount,
    passengerCount,
    status: pick(item, ["bookingStatus", "status"], "PendingQuote"),
    paymentStatus,
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
    bookingHoldExpiresAt: pick(item, ["bookingHoldExpiresAt"], pick(pendingPayment, ["bookingHoldExpiresAt"], "")),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: rawDepositAmount || paidDepositAmount,
    promotionCode: pick(item, ["promotionCode"], ""),
    specialRequests: pick(item, ["specialRequests"], "--"),
    boatRequirements: pick(item, ["boatRequirements"], "--"),
    contactName: pick(item, ["contactName"], "--"),
    contactPhone: pick(item, ["contactPhone"], "--"),
    contactEmail: pick(item, ["contactEmail"], "--"),
    fromStationId: pick(item, ["fromStationId", "fromStation.id", "fromStation.stationId"], ""),
    toStationId: pick(item, ["toStationId", "toStation.id", "toStation.stationId"], ""),
    itineraryStops: pick(item, ["itineraryStops"], []),
    preferredSeatSetupType: pick(item, ["preferredSeatSetupType"], "FullStandard"),
    routeEstimate: pick(item, ["routeEstimate"], null),
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
  const durationMinutes = pick(estimate, ["durationMinutes", "estimatedDurationMinutes"]);
  const durationHours = pick(estimate, ["durationHours", "estimatedDurationHours"]);
  const parts = [];

  if (distance !== "") parts.push(`${distance} km`);
  if (durationMinutes !== "") parts.push(`${durationMinutes} phút`);
  else if (durationHours !== "") parts.push(`${durationHours} giờ`);
  return parts.join(" / ") || "--";
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

const buildEmptyPassengerRows = (booking) => {
  const adultCount = Number(booking?.adultCount || 0);
  const childCount = Number(booking?.childCount || 0);
  const passengerCount = getBookingPassengerCount(booking);

  if (isSinglePassengerWithContact(booking)) {
    return [{
      fullName: booking.contactName.trim(),
      dateOfBirth: "",
      passengerType: "Adult",
      isContactPassenger: true,
    }];
  }

  if (adultCount > 0 || childCount > 0) {
    return [
      ...Array.from({ length: adultCount }, () => ({ fullName: "", dateOfBirth: "", passengerType: "Adult" })),
      ...Array.from({ length: childCount }, () => ({ fullName: "", dateOfBirth: "", passengerType: "Child" })),
    ];
  }

  return Array.from({ length: Math.max(passengerCount, 1) }, () => ({ fullName: "", dateOfBirth: "", passengerType: "Adult" }));
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

const formatPassengerDateForApi = (value) => {
  const date = parsePassengerDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPassengerAge = (dateOfBirth, referenceDate) => {
  const birthDate = parsePassengerDate(dateOfBirth);
  const refDate = parsePassengerDate(referenceDate) || new Date();
  if (!birthDate) return null;

  let age = refDate.getFullYear() - birthDate.getFullYear();
  const monthDelta = refDate.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && refDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
};

const buildPassengerPayload = (booking, rows, lang, { allowSingleContactWithoutDob = false } = {}) => {
  const passengerCount = getBookingPassengerCount(booking);
  const normalizedRows = rows.map((row, index) => ({
    ...row,
    passengerType: row.passengerType || (index < Number(booking?.adultCount || 0) ? "Adult" : "Child"),
  }));
  const filledRows = normalizedRows.filter((row) => row.fullName?.trim() || row.dateOfBirth?.trim());
  const canUseSingleContact = allowSingleContactWithoutDob && isSinglePassengerWithContact(booking);
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
    const dateOfBirth = row.dateOfBirth?.trim();
    const skipDateValidation = canUseSingleContact && !dateOfBirth;

    if (!fullName || (!dateOfBirth && !skipDateValidation)) {
      return {
        errorTitle: lang === "VN" ? "Thiếu thông tin hành khách" : "Missing passenger info",
        errorText: lang === "VN" ? "Vui lòng nhập đủ họ tên và ngày sinh cho từng hành khách." : "Please enter full name and date of birth for each passenger.",
      };
    }

    if (!skipDateValidation) {
      const age = getPassengerAge(dateOfBirth, booking?.departureDate);
      if (age === null) {
        return {
          errorTitle: lang === "VN" ? "Ngày sinh không hợp lệ" : "Invalid date of birth",
          errorText: lang === "VN" ? "Ngày sinh dùng định dạng dd/MM/yyyy hoặc yyyy-MM-dd." : "Use dd/MM/yyyy or yyyy-MM-dd for date of birth.",
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
    passengers: rowsToSubmit.map((row) => {
      const passenger = { fullName: row.fullName.trim() };
      const dateOfBirth = formatPassengerDateForApi(row.dateOfBirth);
      if (dateOfBirth) passenger.dateOfBirth = dateOfBirth;
      return passenger;
    }),
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
  const [passengerRows, setPassengerRows] = useState([{ fullName: "", dateOfBirth: "" }]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [paymentOption, setPaymentOption] = useState("Full");
  const [depositPercent, setDepositPercent] = useState(50);
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
  const syncedPaymentRef = useRef("");
  const autoSyncPaymentRef = useRef("");
  const refreshedDeadlineRef = useRef("");

  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const loadDetail = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
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
            dateOfBirth: pick(passenger, ["dateOfBirth", "dob"], ""),
            passengerType: index < normalized.adultCount ? "Adult" : "Child",
          };
        })
        : buildEmptyPassengerRows(normalized);
      setPassengerRows(initialPassengers);
      setSelectedTicketIds([]);
    } catch (error) {
      setLoadError(
        error.response?.data?.message
          || (lang === "VN"
            ? "Máy chủ chưa thể trả về đầy đủ chi tiết. Dữ liệu tóm tắt từ danh sách đang được hiển thị."
            : "The server could not return full details. Summary data from the list is being shown."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [booking?.bookingCode, id, isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (loadedIdRef.current === id) return;
    loadedIdRef.current = id;
    loadDetail();
  }, [id, loadDetail]);

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
    const quoteHoldExpired = booking.status === "Quoted" && isDeadlineExpired(booking.holdExpiresAt);

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
        paymentOption: normalizedPaymentOption,
        promotionCode: paymentPromotionCode.trim() || null,
      };
      if (normalizedPaymentOption === "Deposit") {
        paymentPayload.depositPercent = Number(depositPercent);
      }
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

  useEffect(() => {
    if (!booking?.id) return;

    const deadlines = [
      booking.status === "Quoted" && booking.holdExpiresAt ? { key: `hold:${booking.id}:${booking.holdExpiresAt}`, value: booking.holdExpiresAt } : null,
      paymentExpiresAt ? { key: `payment:${booking.id}:${paymentExpiresAt}`, value: paymentExpiresAt } : null,
      paymentBookingHoldExpiresAt ? { key: `booking-hold:${booking.id}:${paymentBookingHoldExpiresAt}`, value: paymentBookingHoldExpiresAt } : null,
    ].filter(Boolean);

    const expiredDeadline = deadlines.find((deadline) => isDeadlineExpired(deadline.value, nowTick));
    if (!expiredDeadline || refreshedDeadlineRef.current === expiredDeadline.key) return;

    refreshedDeadlineRef.current = expiredDeadline.key;
    loadDetail();
  }, [booking?.holdExpiresAt, booking?.id, booking?.status, loadDetail, nowTick, paymentBookingHoldExpiresAt, paymentExpiresAt]);

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
        title: lang === "VN" ? "Hủy yêu cầu thuê tàu?" : "Cancel charter request?",
        text: lang === "VN" ? `Mã đặt chỗ ${booking.bookingCode} sẽ được hủy nếu còn hợp lệ.` : `Booking ${booking.bookingCode} will be cancelled if it is still eligible.`,
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#124757",
        confirmButtonText: lang === "VN" ? "Hủy yêu cầu" : "Cancel request",
        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
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
      ? buildPassengerPayload(booking, passengerRows, lang, { allowSingleContactWithoutDob: true })
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
    const passengerPayload = buildPassengerPayload(booking, passengerRows, lang, { allowSingleContactWithoutDob: true });
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
  const quoteSubtotal = booking.subtotalAmount || booking.estimatedPrice;
  const quoteTotal = booking.totalAmount || booking.estimatedPrice;
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
  const effectivePaymentQrCode = activePendingPayment
    ? pick(activePendingPayment, ["qrCode"], booking.latestPaymentQrCode)
    : (statePaymentIsActive ? (paymentQrCode || booking.latestPaymentQrCode) : "");
  const expiredPendingPayment = Array.isArray(booking.payments)
    ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending" && isDeadlineExpired(pick(payment, ["expiresAt"], "") || getEstimatedPaymentDeadline(payment), nowTick))
    : null;
  const expiredPaymentCheckoutUrl = pick(expiredPendingPayment, ["checkoutUrl", "paymentUrl"], "");
  const holdRemainingMs = getRemainingMs(booking.holdExpiresAt, nowTick);
  const hasHoldDeadline = Boolean(getDeadlineTime(booking.holdExpiresAt));
  const isQuoteHoldExpired = booking.status === "Quoted" && hasHoldDeadline && holdRemainingMs <= 0;
  const paymentRemainingMs = getRemainingMs(effectivePaymentExpiresAt, nowTick);
  const hasPaymentDeadline = Boolean(getDeadlineTime(effectivePaymentExpiresAt));
  const isPaymentLinkExpired = hasPaymentDeadline && paymentRemainingMs <= 0;
  const bookingHoldDeadline = paymentBookingHoldExpiresAt || booking.bookingHoldExpiresAt;
  const bookingHoldRemainingMs = getRemainingMs(bookingHoldDeadline, nowTick);
  const hasBookingHoldDeadline = Boolean(getDeadlineTime(bookingHoldDeadline));
  const isBookingHoldExpired = hasBookingHoldDeadline && bookingHoldRemainingMs <= 0;
  const hasPendingPayOs = Boolean(pendingPaymentId || effectiveCheckoutUrl);
  const canCreatePayment = ["Quoted", "PendingPayment", "Confirmed"].includes(booking.status)
    && !isPaid
    && !hasPendingPayOs
    && !isQuoteHoldExpired
    && !isBookingHoldExpired
    && !["Expired", "Cancelled", "Completed", "Refunded"].includes(booking.status);
  const paidDepositAmount = Number(booking.paidDepositAmount || 0);
  const depositPaymentAmount = booking.depositAmount > 0
    ? Math.min(Number(booking.depositAmount), quoteTotal)
    : Math.round((quoteTotal * Number(depositPercent || 0)) / 100);
  const effectivePaidAmount = Math.max(paidAmount, booking.hasDepositPaid ? paidDepositAmount || depositPaymentAmount : 0);
  const remainingAmount = Math.max(quoteTotal - effectivePaidAmount, 0);
  const normalizedPaymentOption = booking.hasDepositPaid
    ? "Remaining"
    : paymentOption === "Remaining"
      ? "Full"
      : paymentOption;
  const selectedPaymentAmount = normalizedPaymentOption === "Deposit"
    ? depositPaymentAmount
    : normalizedPaymentOption === "Remaining"
      ? remainingAmount
      : booking.hasDepositPaid
        ? remainingAmount
        : quoteTotal;
  const estimatedPendingPaymentDeadline = activePendingPayment ? getEstimatedPaymentDeadline(activePendingPayment) : "";
  const effectivePendingPaymentAmount = activePendingPayment
    ? getPaymentAmount(activePendingPayment) || selectedPaymentAmount
    : Number(paymentAmount || booking.latestPaymentAmount || selectedPaymentAmount) || selectedPaymentAmount;
  const effectivePaymentDeadline = effectivePaymentExpiresAt || paymentWatcher.deadline || estimatedPendingPaymentDeadline;
  const isEstimatedPaymentDeadline = Boolean(!effectivePaymentExpiresAt && effectivePaymentDeadline);
  const paymentWatcherRemainingMs = getRemainingMs(effectivePaymentDeadline, nowTick);
  const paymentChoices = [
    { id: "Deposit", label: lang === "VN" ? "Đặt cọc" : "Deposit", disabled: booking.hasDepositPaid, amount: depositPaymentAmount },
    { id: "Full", label: lang === "VN" ? "Thanh toán đủ" : "Full", disabled: false, amount: booking.hasDepositPaid ? remainingAmount : quoteTotal },
    { id: "Remaining", label: lang === "VN" ? "Phần còn lại" : "Remaining", disabled: !booking.hasDepositPaid, amount: remainingAmount },
  ];
  const selectablePaymentChoices = booking.hasDepositPaid
    ? paymentChoices.filter((choice) => choice.id === "Remaining")
    : paymentChoices.filter((choice) => choice.id !== "Remaining");
  const paymentSelectValue = selectablePaymentChoices.some((choice) => choice.id === normalizedPaymentOption)
    ? normalizedPaymentOption
    : selectablePaymentChoices[0]?.id || "Full";
  const routeStops = booking.route && booking.route !== "--" ? booking.route.split(/\s+-\s+/) : [];
  const routeFrom = booking.fromStationName || routeStops[0] || "--";
  const routeTo = booking.toStationName || routeStops[1] || "--";
  const scheduleItems = [
    { icon: "event", label: lang === "VN" ? "Ngày giờ đi" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` },
    { icon: "timer", label: lang === "VN" ? "Thời lượng thuê" : "Duration", value: `${booking.durationValue} ${booking.rentalUnit}` },
    {
      icon: "groups",
      label: lang === "VN" ? "Hành khách" : "Passengers",
      value: lang === "VN" ? `${booking.passengerCount} khách` : `${booking.passengerCount} guests`,
      description: lang === "VN"
        ? `${booking.adultCount} người lớn / ${booking.childCount} trẻ em`
        : `${booking.adultCount} adults / ${booking.childCount} children`,
    },
    { icon: "route", label: lang === "VN" ? "Ước tính lộ trình" : "Route Estimate", value: formatRouteEstimate(booking.routeEstimate) },
  ];
  const contactItems = [
    { icon: "person", label: lang === "VN" ? "Người liên hệ" : "Contact Name", value: booking.contactName },
    { icon: "call", label: lang === "VN" ? "Số điện thoại" : "Phone", value: booking.contactPhone },
    { icon: "mail", label: lang === "VN" ? "Email" : "Email", value: booking.contactEmail },
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
                  <span className="material-symbols-outlined text-lg">tune</span>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest">{lang === "VN" ? "Yêu cầu về tàu" : "Boat Requirements"}</p>
                </div>
                <p className="mt-3 min-h-10 font-medium text-slate-700 dark:text-slate-200 break-words">{booking.boatRequirements}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="material-symbols-outlined text-lg">sticky_note_2</span>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest">{lang === "VN" ? "Ghi chú đặc biệt" : "Special Requests"}</p>
                </div>
                <p className="mt-3 min-h-10 font-medium text-slate-700 dark:text-slate-200 break-words">{booking.specialRequests}</p>
              </div>
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

              {quoteBoatRows.length > 0 ? (
                <div className="divide-y divide-[#D8E7EA] dark:divide-slate-700">
                  {quoteBoatRows.map((boat) => (
                    <div key={`${boat.boatOrder}-${boat.name}`} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1.5fr)_0.7fr_0.7fr_0.7fr] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-4">
                          <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800">
                            <img src={boat.imageUrl || DEFAULT_BOAT_IMAGE} alt={boat.name} className="h-full w-full object-cover" />
                            <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#124757] text-[10px] font-headline font-black text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900">
                              {boat.boatOrder}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-headline font-black text-slate-900 dark:text-white truncate">{boat.name}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-headline font-black text-[#124757] dark:text-yellow-400">
                                {formatDeckCount(boat.numberOfDecks, lang) || boat.seatSetupType}
                              </span>
                              {boat.seatCount !== "" && (
                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-300">
                                  {boat.seatCount} {lang === "VN" ? "ghế" : "seats"}
                                </span>
                              )}
                              {boat.status && (
                                <span className="rounded-full border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  {boat.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Đơn giá" : "Unit Price"}</p>
                        <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{boat.unitPrice > 0 ? currencyFormatter.format(boat.unitPrice) : "--"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tính tiền" : "Chargeable"}</p>
                        <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                          {boat.chargeableDurationValue !== "" ? `${boat.chargeableDurationValue} ${booking.rentalUnit}` : "--"}
                        </p>
                      </div>
                      <div className="lg:text-right">
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Thành tiền" : "Subtotal"}</p>
                        <p className="mt-1 text-base font-headline font-black text-[#0E4050] dark:text-yellow-400">{boat.subtotalAmount > 0 ? currencyFormatter.format(boat.subtotalAmount) : "--"}</p>
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
                <div className="ml-auto max-w-md space-y-3">
                  <div className="flex items-center justify-between gap-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Tổng trước giảm" : "Subtotal"}</span>
                    <span>{quoteSubtotal > 0 ? currencyFormatter.format(quoteSubtotal) : "--"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
                    <span>{booking.discountAmount > 0 ? `-${currencyFormatter.format(booking.discountAmount)}` : "--"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                    <span className="text-[11px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tổng cuối" : "Total"}</span>
                    <span className="text-xl font-headline font-black text-[#0E4050] dark:text-yellow-400">{quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}</span>
                  </div>
                </div>

                {hasHoldDeadline && booking.status === "Quoted" && (
                  <div className={`mt-5 rounded-2xl border px-4 py-3 ${
                    isQuoteHoldExpired
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                      : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300"
                  }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-xl">{isQuoteHoldExpired ? "timer_off" : "hourglass_top"}</span>
                        <div>
                          <p className="text-[10px] font-headline font-black uppercase tracking-widest">
                            {lang === "VN" ? "Thời hạn phản hồi báo giá" : "Quote response deadline"}
                          </p>
                          <p className="text-xs font-bold opacity-80">{formatDateTime(booking.holdExpiresAt)}</p>
                        </div>
                      </div>
                      <p className="font-headline text-2xl font-black tabular-nums">
                        {isQuoteHoldExpired ? (lang === "VN" ? "Hết hạn" : "Expired") : formatCountdown(holdRemainingMs)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-dashed border-slate-200 dark:border-slate-700 pt-4">
                  {isPaid ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-xl">verified</span>
                      {lang === "VN" ? `Đã thanh toán đủ · ${currencyFormatter.format(paidAmount)}` : `Fully paid · ${currencyFormatter.format(paidAmount)}`}
                    </div>
                  ) : booking.status === "Cancelled" ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400">
                      <span className="material-symbols-outlined text-xl">cancel</span>
                      {lang === "VN" ? "Yêu cầu đã hủy, không thể thanh toán" : "Request cancelled, payment unavailable"}
                    </div>
                  ) : isQuoteHoldExpired ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                      <p className="text-xs font-bold">
                        {lang === "VN" ? "Báo giá đã quá hạn phản hồi. Booking đã được tải lại để cập nhật trạng thái mới nhất." : "The quote response deadline has passed. The booking has been refreshed with the latest status."}
                      </p>
                      <button type="button" onClick={loadDetail} className="w-max rounded-lg border border-rose-300 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider">
                        {lang === "VN" ? "Tải lại booking" : "Refresh booking"}
                      </button>
                    </div>
                  ) : isBookingHoldExpired ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                      <p className="text-xs font-bold">
                        {lang === "VN" ? "Thời hạn giữ tàu đã hết. Vui lòng tải lại booking để cập nhật trạng thái." : "The booking hold deadline has passed. Refresh the booking for the latest status."}
                      </p>
                      <button type="button" onClick={loadDetail} className="w-max rounded-lg border border-rose-300 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider">
                        {lang === "VN" ? "Tải lại booking" : "Refresh booking"}
                      </button>
                    </div>
                  ) : (expiredPendingPayment || (Boolean(expiredPaymentCheckoutUrl || paymentCheckoutUrl) && isPaymentLinkExpired)) ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-xl text-slate-400">timer_off</span>
                        <p className="text-xs font-bold">
                          {lang === "VN" ? "Link/QR thanh toán cũ đã hết hạn. Vui lòng tạo giao dịch thanh toán mới." : "The previous payment link or QR has expired. Create a new payment transaction."}
                        </p>
                      </div>
                      <button type="button" onClick={handleCreatePayment} disabled={isSubmitting} className="w-max rounded-lg bg-[#124757] px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900">
                        {isSubmitting ? (lang === "VN" ? "Đang tạo..." : "Creating...") : (lang === "VN" ? "Tạo lại link thanh toán" : "Create new payment link")}
                      </button>
                    </div>
                  ) : hasPendingPayOs ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                      <div className="flex-1 space-y-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                        <div className="flex flex-wrap items-center gap-2">
                          <PayOSLogo />
                          <p>{lang === "VN" ? "Đang có giao dịch PayOS chờ xử lý." : "A PayOS payment is pending."}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-lg bg-white px-3 py-1.5 font-headline text-sm font-black text-[#0E4050] ring-1 ring-amber-200 dark:bg-slate-900 dark:text-yellow-400 dark:ring-amber-500/20">
                            {effectivePendingPaymentAmount > 0 ? currencyFormatter.format(effectivePendingPaymentAmount) : "--"}
                          </span>
                          {effectivePaymentDeadline && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-headline text-sm font-black tabular-nums text-amber-700 ring-1 ring-amber-200 dark:bg-slate-900 dark:text-amber-300 dark:ring-amber-500/20">
                              <span className="material-symbols-outlined text-base">timer</span>
                              {formatCountdown(paymentWatcherRemainingMs)}
                            </span>
                          )}
                        </div>
                        {effectivePaymentDeadline && (
                          <p className="text-[11px] opacity-80">
                            {isEstimatedPaymentDeadline
                              ? (lang === "VN" ? "Thời gian tạm tính trong lúc chờ hạn thanh toán PayOS chính thức." : "Estimated time while waiting for the confirmed PayOS payment deadline.")
                              : (lang === "VN" ? "Thời gian còn lại để hoàn tất thanh toán PayOS." : "Time left to complete the PayOS payment.")}
                          </p>
                        )}
                        {hasBookingHoldDeadline && (
                          <p className="text-[11px] opacity-80">
                            {lang === "VN" ? "Giữ booking/tàu đến " : "Booking hold until "}{formatDateTime(bookingHoldDeadline)}
                            {bookingHoldRemainingMs > 0 ? ` (${formatCountdown(bookingHoldRemainingMs)})` : ""}
                          </p>
                        )}
                        {!effectiveCheckoutUrl && effectivePaymentQrCode && (
                          <img src={effectivePaymentQrCode} alt="PayOS QR" className="mt-2 h-36 w-36 rounded-xl bg-white object-contain p-2 ring-1 ring-amber-200" />
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {effectiveCheckoutUrl && (
                          <button
                            type="button"
                            onClick={() => openPaymentPage(effectiveCheckoutUrl, { orderCode: pendingPaymentOrderCode, amount: effectivePendingPaymentAmount, expiresAt: effectivePaymentDeadline })}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#124757] dark:bg-yellow-400 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:text-slate-900"
                          >
                            <PayOSLogo inverted />
                            {lang === "VN" ? "Mở PayOS" : "Open PayOS"}{effectivePendingPaymentAmount > 0 ? ` · ${currencyFormatter.format(effectivePendingPaymentAmount)}` : ""}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => pendingPaymentOrderCode ? handleSyncPaymentByOrderCode(pendingPaymentOrderCode) : handleSyncPayment(pendingPaymentId)}
                          disabled={isSubmitting || (!pendingPaymentOrderCode && !pendingPaymentId)}
                          className="rounded-lg border border-amber-300 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 disabled:opacity-50"
                        >
                          {lang === "VN" ? "Đồng bộ" : "Sync"}
                        </button>
                      </div>
                    </div>
                  ) : canCreatePayment ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                        <label className="block">
                          <span className="mb-1.5 block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                            {lang === "VN" ? "Trạng thái thanh toán" : "Payment option"}
                          </span>
                          <select
                            value={paymentSelectValue}
                            onChange={(event) => setPaymentOption(event.target.value)}
                            disabled={booking.hasDepositPaid}
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-headline font-black text-[#0E4050] outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-80 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
                          >
                            {selectablePaymentChoices.map((choice) => (
                              <option key={choice.id} value={choice.id}>
                                {choice.label} - {choice.amount > 0 ? currencyFormatter.format(choice.amount) : "--"}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                          <div className="border-r border-slate-200 px-3 py-2 dark:border-slate-700">
                            <p className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Đã chuyển" : "Paid"}</p>
                            <p className="mt-1 text-xs font-headline font-black text-[#0E4050] dark:text-yellow-400">{effectivePaidAmount > 0 ? currencyFormatter.format(effectivePaidAmount) : "--"}</p>
                          </div>
                          <div className="border-r border-slate-200 px-3 py-2 dark:border-slate-700">
                            <p className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Còn lại" : "Remaining"}</p>
                            <p className="mt-1 text-xs font-headline font-black text-[#0E4050] dark:text-yellow-400">{remainingAmount > 0 ? currencyFormatter.format(remainingAmount) : "--"}</p>
                          </div>
                          <div className="px-3 py-2">
                            <p className="text-[9px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Lần này" : "This payment"}</p>
                            <p className="mt-1 text-xs font-headline font-black text-[#0E4050] dark:text-yellow-400">{selectedPaymentAmount > 0 ? currencyFormatter.format(selectedPaymentAmount) : "--"}</p>
                          </div>
                        </div>
                      </div>

                      {booking.hasDepositPaid && (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {lang === "VN"
                            ? `Booking đã ghi nhận ${currencyFormatter.format(effectivePaidAmount)}. Lần thanh toán tiếp theo chỉ thu phần còn lại ${currencyFormatter.format(remainingAmount)}.`
                            : `This booking has recorded ${currencyFormatter.format(effectivePaidAmount)}. The next payment only charges the remaining ${currencyFormatter.format(remainingAmount)}.`}
                        </p>
                      )}

                      {normalizedPaymentOption === "Deposit" && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{lang === "VN" ? "Tỷ lệ đặt cọc" : "Deposit rate"}</span>
                          <input
                            type="number"
                            min="10"
                            max="100"
                            step="5"
                            value={depositPercent}
                            onChange={(event) => setDepositPercent(Math.min(100, Math.max(10, Number(event.target.value) || 10)))}
                            className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-[#FFD100]"
                          />
                          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">%</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          value={paymentPromotionCode}
                          onChange={(event) => setPaymentPromotionCode(event.target.value)}
                          maxLength={80}
                          placeholder={lang === "VN" ? "Mã khuyến mãi (nếu có)" : "Promo code (optional)"}
                          className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-bold uppercase text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100]"
                        />
                        <button
                          type="button"
                          onClick={handleCreatePayment}
                          disabled={isSubmitting || !canCreatePayment}
                          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#124757] dark:bg-yellow-400 px-6 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-white dark:text-slate-900 disabled:opacity-50"
                        >
                          {!isSubmitting && <PayOSLogo inverted />}
                          {isSubmitting
                            ? (lang === "VN" ? "Đang xử lý..." : "Processing...")
                            : `${lang === "VN" ? "Thanh toán qua PayOS" : "Pay via PayOS"}${selectedPaymentAmount > 0 ? ` · ${currencyFormatter.format(selectedPaymentAmount)}` : ""}`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-400">
                      {lang === "VN" ? "Booking hiện chưa ở trạng thái cho phép thanh toán." : "This booking isn't eligible for payment right now."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ===== SECTION 3: TICKETS & PASSENGERS ===== */}
        {isPaid && (
          <>
            <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
                <div className="flex-1">
                  <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">
                    {lang === "VN" ? "QR tổng & vé hành khách" : "Group QR & Passenger Tickets"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedTicketIds.length > 0
                      ? (lang === "VN" ? `Đã chọn ${selectedTicketIds.length} vé để xuất.` : `${selectedTicketIds.length} tickets selected.`)
                      : (lang === "VN" ? "Không chọn vé để xuất toàn bộ danh sách." : "Leave tickets unselected to export all.")}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3 mt-5">
                    <button type="button" onClick={() => handleTicketFileAction("print")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                      {lang === "VN" ? "In vé" : "Print Tickets"}
                    </button>
                    <button type="button" onClick={() => handleTicketFileAction("pdf")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                      {lang === "VN" ? "Tải PDF" : "Download PDF"}
                    </button>
                  </div>
                </div>

                <div className="w-36 h-36 shrink-0 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt={lang === "VN" ? "QR tổng booking" : "Booking group QR"} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="text-center text-slate-400 px-3">
                      <span className="material-symbols-outlined text-3xl">qr_code_2</span>
                      <p className="text-[9px] font-bold mt-1">{lang === "VN" ? "QR có sau khi booking hợp lệ" : "QR available when eligible"}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Danh sách hành khách" : "Passenger Manifest"}</h2>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    {canUseContactAsSinglePassenger
                      ? (lang === "VN" ? "Booking 1 khách sẽ dùng thông tin liên hệ làm hành khách." : "Single-passenger bookings use the contact information.")
                      : (lang === "VN" ? "Nhập file hoặc chỉnh trực tiếp từng hành khách." : "Import a file or edit passengers directly.")}
                  </p>
                </div>
                <button type="button" onClick={() => importInputRef.current?.click()} disabled={isSubmitting || !isPaid} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400 sm:w-auto">
                  {lang === "VN" ? "Nhập file khách" : "Import Passengers"}
                </button>
                <input ref={importInputRef} type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={handleImportPassengers} className="hidden" />
              </div>

              <div className="space-y-3 mt-6">
                {canUseContactAsSinglePassenger ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                      {lang === "VN" ? "Tự dùng thông tin liên hệ" : "Using contact info"}
                    </p>
                    <p className="mt-2 font-headline text-lg font-black text-[#0E4050] dark:text-yellow-400">{booking.contactName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                      {[booking.contactPhone, booking.contactEmail].filter(isUsableText).join(" · ") || "--"}
                    </p>
                  </div>
                ) : passengerRows.map((row, index) => (
                  <div key={row.id || `passenger-${index}`} className="grid grid-cols-[42px_1fr] md:grid-cols-[42px_1fr_170px] gap-2 items-center">
                    <label className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-black text-slate-400" title={row.ticketCode || undefined}>
                      {row.id ? (
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.includes(row.id)}
                          onChange={(event) => setSelectedTicketIds((prev) => event.target.checked ? [...prev, row.id] : prev.filter((ticketId) => ticketId !== row.id))}
                          className="accent-[#124757]"
                        />
                      ) : index + 1}
                    </label>
                    <div className="relative">
                      <input value={row.fullName} onChange={(e) => handlePassengerChange(index, "fullName", e.target.value)} disabled={!isPaid} placeholder={lang === "VN" ? "Họ tên" : "Full name"} className="w-full px-3 py-3 pr-20 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60" />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-white px-2 py-1 text-[9px] font-headline font-black uppercase tracking-wider text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        {row.passengerType === "Child" ? (lang === "VN" ? "Trẻ em" : "Child") : (lang === "VN" ? "Người lớn" : "Adult")}
                      </span>
                    </div>
                    <input value={row.dateOfBirth} onChange={(e) => handlePassengerChange(index, "dateOfBirth", e.target.value)} disabled={!isPaid} placeholder="dd/MM/yyyy" className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] col-start-2 md:col-start-auto disabled:opacity-60" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-6">
                <button onClick={handleSavePassengers} disabled={isSubmitting || !isPaid} className="w-full sm:w-auto min-w-56 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 py-3 px-6 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
                  {isSubmitting
                    ? (lang === "VN" ? "Đang lưu..." : "Saving...")
                    : canUseContactAsSinglePassenger
                      ? (lang === "VN" ? "Lưu thông tin liên hệ" : "Save Contact Info")
                      : (lang === "VN" ? "Lưu hành khách" : "Save Passengers")}
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
    </>
  );
}
