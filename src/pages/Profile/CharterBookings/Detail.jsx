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
import {
  createBookingPayment,
  syncBookingPayment,
} from "../../../services/paymentService";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeBooking = (item) => {
  const adultCount = Number(pick(item, ["adultCount"], 0));
  const childCount = Number(pick(item, ["childCount"], 0));
  const passengerCount = Number(pick(item, ["passengerCount"], adultCount + childCount));
  const fromName = pick(item, ["fromStationName", "fromStation.stationName", "fromStation.name"]);
  const toName = pick(item, ["toStationName", "toStation.stationName", "toStation.name"]);
  const payments = Array.isArray(item?.payments) ? item.payments : [];
  const pendingPayment = payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending");
  const paidPayments = payments.filter((payment) => String(payment.paymentStatus).toLowerCase() === "paid");
  const paidAmount = paidPayments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const paidDepositAmount = paidPayments
    .filter((payment) => String(payment.paymentPurpose).toLowerCase() === "deposit")
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);

  return {
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
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
    paymentStatus: pick(item, ["paymentStatus"], "--"),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: Number(pick(item, ["depositAmount"], paidDepositAmount)),
    promotionCode: pick(item, ["promotionCode"], ""),
    specialRequests: pick(item, ["specialRequests", "boatRequirements", "note"], "--"),
    boatRequirements: pick(item, ["boatRequirements"], ""),
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
    hasDepositPaid: paidDepositAmount > 0,
    latestPaymentId: pick(pendingPayment, ["paymentId", "id"], pick(item, ["paymentId", "latestPaymentId", "payment.id"], "")),
    latestPaymentCheckoutUrl: pick(pendingPayment, ["checkoutUrl", "paymentUrl"], pick(item, ["checkoutUrl", "paymentUrl", "latestPaymentCheckoutUrl"], "")),
    qrToken: pick(item, ["charterBookingQrToken", "qrToken"], ""),
  };
};

const getBoatDisplayName = (boat, fallback = "--") => {
  const code = pick(boat, ["code", "boatCode", "boat.code"], "");
  const name = pick(boat, ["name", "boatName", "boat.name"], "");
  if (code && name) return `${code} - ${name}`;
  return name || code || fallback;
};

const DEFAULT_BOAT_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png";

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
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

const getApiErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message;
  if (typeof data.title === "string") return data.title;
  if (data.errors && typeof data.errors === "object") {
    const firstError = Object.values(data.errors).flat().find(Boolean);
    if (firstError) return String(firstError);
  }
  return fallback;
};

export function ProfileCharterBookingDetail() {
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
  const [paymentMethod, setPaymentMethod] = useState("PayOS");
  const [paymentPromotionCode, setPaymentPromotionCode] = useState("");
  const [isQuoteAccepted, setIsQuoteAccepted] = useState(false);
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState("overview");
  const loadedIdRef = useRef("");
  const syncedPaymentRef = useRef("");
  const autoSyncPaymentRef = useRef("");
  const importInputRef = useRef(null);

  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

  const getStatusInfo = (status) => {
    switch (status) {
      case "PendingQuote":
        return { label: lang === "VN" ? "Chờ báo giá" : "Pending Quote", classes: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20", dot: "bg-amber-500" };
      case "Quoted":
        return { label: lang === "VN" ? "Đã báo giá" : "Quoted", classes: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20", dot: "bg-indigo-500" };
      case "PendingPayment":
        return { label: lang === "VN" ? "Chờ thanh toán" : "Pending Payment", classes: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20", dot: "bg-orange-500" };
      case "Confirmed":
        return { label: lang === "VN" ? "Đã xác nhận" : "Confirmed", classes: "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20", dot: "bg-sky-500" };
      case "Completed":
        return { label: lang === "VN" ? "Hoàn tất" : "Completed", classes: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20", dot: "bg-emerald-500" };
      case "Cancelled":
        return { label: lang === "VN" ? "Đã hủy" : "Cancelled", classes: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20", dot: "bg-rose-500" };
      case "Expired":
        return { label: lang === "VN" ? "Hết hạn" : "Expired", classes: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700", dot: "bg-slate-400" };
      case "Refunded":
        return { label: lang === "VN" ? "Đã hoàn tiền" : "Refunded", classes: "bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20", dot: "bg-teal-500" };
      default:
        return { label: status || "--", classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700", dot: "bg-slate-400" };
    }
  };

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
      setPaymentOption(normalized.hasDepositPaid && normalized.paymentStatus !== "Paid" ? "Remaining" : "Full");
      setPaymentCheckoutUrl(normalized.latestPaymentCheckoutUrl || "");
      setPaymentPromotionCode((prev) => prev || normalized.promotionCode || "");
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
          };
        })
        : Array.from({ length: Math.max(normalized.passengerCount, 1) }, () => ({ fullName: "", dateOfBirth: "" }));
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
    if (!booking?.id) return;
    const acceptedFromSession = sessionStorage.getItem(`charterQuoteAccepted:${booking.id}`) === "true";
    const acceptedByStatus = ["PendingPayment", "Confirmed", "Completed"].includes(booking.status);
    const acceptedByPayment = String(booking.paymentStatus).toLowerCase() !== "unpaid" && booking.paymentStatus !== "--";
    const acceptedByPaymentHistory = Array.isArray(booking.payments)
      && booking.payments.some((payment) => ["pending", "paid"].includes(String(payment.paymentStatus).toLowerCase()));

    if (booking.status === "Quoted") {
      if (!acceptedFromSession && !acceptedByPaymentHistory) {
        sessionStorage.removeItem(`charterPayment:${booking.id}`);
        setPaymentCheckoutUrl("");
      }
      setIsQuoteAccepted(acceptedFromSession || acceptedByPaymentHistory);
      return;
    }

    setIsQuoteAccepted(acceptedByStatus || acceptedByPayment || acceptedByPaymentHistory);
  }, [booking?.id, booking?.paymentStatus, booking?.status, booking?.payments]);

  const handleAcceptQuote = () => {
    if (!booking?.id) return;
    sessionStorage.setItem(`charterQuoteAccepted:${booking.id}`, "true");
    setIsQuoteAccepted(true);
    setActiveDetailTab("payment");
    Swal.fire({
      icon: "success",
      title: lang === "VN" ? "Đã chấp nhận báo giá" : "Quote accepted",
      text: lang === "VN" ? "Bạn có thể tiếp tục tạo thanh toán." : "You can now continue to payment.",
      confirmButtonColor: "#124757",
    });
  };

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

  useEffect(() => {
    const storedPaymentId = sessionStorage.getItem(`charterPayment:${id}`);
    const returnedFromPayOs = new URLSearchParams(location.search).has("status")
      || new URLSearchParams(location.search).has("code")
      || new URLSearchParams(location.search).has("orderCode");

    if (!storedPaymentId || !returnedFromPayOs || syncedPaymentRef.current === storedPaymentId) return;
    syncedPaymentRef.current = storedPaymentId;
    handleSyncPayment(storedPaymentId, { silent: true });
  }, [handleSyncPayment, id, location.search]);

  useEffect(() => {
    if (booking?.status === "Quoted" && !isQuoteAccepted) return undefined;
    const paymentId = booking?.latestPaymentId || (booking?.id ? sessionStorage.getItem(`charterPayment:${booking.id}`) : "");
    const isBookingPaid = String(booking?.paymentStatus).toLowerCase() === "paid";

    if (!paymentId || isBookingPaid) return undefined;

    autoSyncPaymentRef.current = paymentId;
    const syncSilently = async () => {
      try {
        await syncBookingPayment(paymentId);
        if (autoSyncPaymentRef.current === paymentId) {
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
  }, [booking?.id, booking?.latestPaymentId, booking?.paymentStatus, booking?.status, isQuoteAccepted, loadDetail]);

  const handleCreatePayment = async () => {
    if (!booking?.id) return;
    const activePendingPayment = Array.isArray(booking.payments)
      ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending")
      : null;
    const existingPaymentId = pick(activePendingPayment, ["paymentId", "id"], booking.latestPaymentId);
    const existingCheckoutUrl = pick(activePendingPayment, ["checkoutUrl", "paymentUrl"], booking.latestPaymentCheckoutUrl || paymentCheckoutUrl);

    if (existingPaymentId || existingCheckoutUrl) {
      if (existingCheckoutUrl) {
        window.location.assign(existingCheckoutUrl);
        return;
      }
      await handleSyncPayment(existingPaymentId);
      return;
    }

    try {
      setIsSubmitting(true);
      const paymentPayload = {
        bookingId: booking.id,
        paymentOption,
        promotionCode: paymentPromotionCode.trim() || null,
      };
      if (paymentOption === "Deposit") {
        paymentPayload.depositPercent = Number(depositPercent);
      }
      const payment = await createBookingPayment(paymentPayload);
      const paymentId = pick(payment, ["id", "paymentId", "data.id", "data.paymentId", "payment.id", "data.payment.id"]);
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

      if (paymentId) {
        sessionStorage.setItem(`charterPayment:${booking.id}`, paymentId);
        sessionStorage.setItem(`paymentBooking:${paymentId}`, booking.id);
        sessionStorage.setItem("latestCharterPaymentBooking", booking.id);
      }
      setPaymentCheckoutUrl(checkoutUrl || "");

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã tạo giao dịch" : "Payment created",
        text: lang === "VN" ? "Hệ thống sẽ tự động đồng bộ trạng thái thanh toán." : "Payment status will be synchronized automatically.",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể tạo thanh toán" : "Unable to create payment",
        text: getApiErrorMessage(
          error,
          lang === "VN" ? "Backend từ chối tạo link PayOS. Vui lòng kiểm tra trạng thái booking hoặc mã khuyến mãi." : "The backend rejected the PayOS link request. Please check the booking status or promotion code.",
        ),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
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

    try {
      setIsSubmitting(true);
      await cancelMyCharterBooking(booking.id);
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
        text: error.response?.data?.message || (lang === "VN" ? "Yêu cầu này có thể không còn được phép hủy." : "This request may no longer be cancellable."),
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

    const popup = action === "print" ? window.open("", "_blank") : null;

    try {
      setIsSubmitting(true);
      const ticketIds = selectedTicketIds.length > 0 ? selectedTicketIds : null;
      let response;

      if (action === "zip") {
        response = ticketIds
          ? await downloadSelectedCharterBookingTickets(booking.id, ticketIds)
          : await downloadAllCharterBookingTickets(booking.id);
        downloadBlobResponse(response, `${booking.bookingCode}-tickets.zip`);
      } else if (action === "pdf") {
        response = booking.qrToken && !ticketIds
          ? await downloadCharterBookingTicketsPdfByQrToken(booking.qrToken)
          : await downloadCharterBookingTicketsPdf(booking.id, ticketIds);
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
        text: error.response?.data?.message || (lang === "VN" ? "Booking cần được thanh toán đủ và có danh sách hành khách." : "The booking must be fully paid and have a passenger list."),
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
    const passengers = passengerRows
      .filter((row) => row.fullName.trim() || row.dateOfBirth.trim())
      .map((row) => ({ fullName: row.fullName.trim(), dateOfBirth: row.dateOfBirth.trim() }));

    if (passengers.length === 0) {
      Swal.fire({
        icon: "info",
        title: lang === "VN" ? "Chưa có hành khách" : "No passengers",
        text: lang === "VN" ? "Vui lòng nhập ít nhất một hành khách." : "Please enter at least one passenger.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await updateMyCharterBookingPassengers(booking.id, { passengers });
      await loadDetail();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã lưu danh sách hành khách" : "Passenger list saved",
        confirmButtonColor: "#124757",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể lưu hành khách" : "Unable to save passengers",
        text: error.response?.data?.message || (lang === "VN" ? "Số hành khách không được vượt quá số lượng đã đăng ký." : "Passenger count must not exceed the registered count."),
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
              <button onClick={() => navigate("/profile/charter-bookings")} className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 font-bold text-sm">
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

  const statusInfo = getStatusInfo(booking.status);
  const isPaid = String(booking.paymentStatus).toLowerCase() === "paid";
  const storedPaymentId = sessionStorage.getItem(`charterPayment:${booking.id}`);
  const activePendingPayment = Array.isArray(booking.payments)
    ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending")
    : null;
  const paidAmount = Number(booking.paidAmount || 0);
  const pendingPaymentId = pick(activePendingPayment, ["paymentId", "id"], booking.latestPaymentId || storedPaymentId);
  const effectiveCheckoutUrl = paymentCheckoutUrl || pick(activePendingPayment, ["checkoutUrl", "paymentUrl"], booking.latestPaymentCheckoutUrl);
  const hasPendingPayOs = Boolean(pendingPaymentId || effectiveCheckoutUrl);
  const quoteNeedsAcceptance = booking.status === "Quoted" && !isPaid && !isQuoteAccepted && !hasPendingPayOs;
  const canCreatePayment = ["Quoted", "PendingPayment", "Confirmed"].includes(booking.status) && !isPaid && isQuoteAccepted && !hasPendingPayOs;
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
  const remainingAmount = Math.max(quoteTotal - paidAmount, 0);
  const depositPaymentAmount = Math.round((quoteTotal * Number(depositPercent || 0)) / 100);
  const selectedPaymentAmount = paymentOption === "Deposit"
    ? depositPaymentAmount
    : paymentOption === "Remaining"
      ? remainingAmount
      : booking.hasDepositPaid
        ? remainingAmount
        : quoteTotal;
  const routeStops = booking.route && booking.route !== "--" ? booking.route.split(/\s+-\s+/) : [];
  const routeFrom = booking.fromStationName || routeStops[0] || "--";
  const routeTo = booking.toStationName || routeStops[1] || "--";
  const overviewItems = [
    { icon: "directions_boat", label: lang === "VN" ? "Tàu được gán" : "Assigned Boat", value: booking.boatName },
    { icon: "event", label: lang === "VN" ? "Ngày giờ đi" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` },
    { icon: "groups", label: lang === "VN" ? "Hành khách" : "Passengers", value: `${booking.passengerCount} (${booking.adultCount} adult / ${booking.childCount} child)` },
    { icon: "timer", label: lang === "VN" ? "Thời lượng thuê" : "Duration", value: `${booking.durationValue} ${booking.rentalUnit}` },
  ];
  const secondaryItems = [
    { label: lang === "VN" ? "Thanh toán" : "Payment", value: booking.paymentStatus },
    { label: lang === "VN" ? "Đặt cọc" : "Deposit", value: booking.depositAmount > 0 ? currencyFormatter.format(booking.depositAmount) : "--" },
    { label: lang === "VN" ? "Ước tính lộ trình" : "Route Estimate", value: formatRouteEstimate(booking.routeEstimate) },
  ];
  const paymentChoices = [
    {
      id: "Deposit",
      icon: "savings",
      title: lang === "VN" ? "Đặt cọc" : "Deposit",
      eyebrow: lang === "VN" ? "Giữ lịch tàu" : "Reserve",
      description: lang === "VN" ? "Thanh toán trước một phần để giữ lịch, phần còn lại xử lý sau." : "Pay a partial amount now and settle the rest later.",
      disabled: booking.hasDepositPaid,
      amount: depositPaymentAmount,
    },
    {
      id: "Full",
      icon: "verified",
      title: lang === "VN" ? "Thanh toán đủ" : "Full",
      eyebrow: lang === "VN" ? "Hoàn tất ngay" : "Complete",
      description: lang === "VN" ? "Thanh toán toàn bộ hoặc phần còn lại nếu đã đặt cọc." : "Pay in full, or the remaining amount if a deposit was already paid.",
      disabled: false,
      amount: booking.hasDepositPaid ? remainingAmount : quoteTotal,
    },
    {
      id: "Remaining",
      icon: "price_check",
      title: lang === "VN" ? "Phần còn lại" : "Remaining",
      eyebrow: lang === "VN" ? "Sau đặt cọc" : "After Deposit",
      description: lang === "VN" ? "Dùng khi booking đã ghi nhận khoản đặt cọc thành công." : "Use after the booking already has a paid deposit.",
      disabled: !booking.hasDepositPaid,
      amount: remainingAmount,
    },
  ];
  const paymentRows = Array.isArray(booking.payments)
    ? booking.payments.map((payment, index) => ({
      id: pick(payment, ["paymentId", "id"], `${booking.id}-payment-${index}`),
      provider: pick(payment, ["provider", "paymentProvider"], "PayOS"),
      method: pick(payment, ["paymentMethod", "method"], "--"),
      purpose: pick(payment, ["paymentPurpose", "purpose"], "--"),
      status: pick(payment, ["paymentStatus", "status"], "--"),
      amount: Number(pick(payment, ["amount", "totalAmount"], 0)),
      checkoutUrl: pick(payment, ["checkoutUrl", "paymentUrl"], ""),
      createdAt: pick(payment, ["createdAt", "createdDate", "paidAt", "updatedAt"], ""),
    }))
    : [];
  const paymentStatusTone = isPaid
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
    : hasPendingPayOs
      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
      : booking.status === "Cancelled"
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
  const detailTabs = [
    { id: "overview", icon: "dashboard", label: lang === "VN" ? "Tổng quan" : "Overview" },
    { id: "quote", icon: "directions_boat", label: lang === "VN" ? "Tàu & báo giá" : "Boats & Quote" },
    { id: "payment", icon: "payments", label: lang === "VN" ? "Thanh toán" : "Payment" },
    ...(isPaid ? [{ id: "tickets", icon: "confirmation_number", label: lang === "VN" ? "Vé & hành khách" : "Tickets" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-10 px-4 sm:px-6 lg:px-8 font-body transition-colors">
      <main className="max-w-6xl mx-auto space-y-6">
        <button onClick={() => navigate("/profile/charter-bookings")} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#124757] dark:hover:text-yellow-400 transition-colors">
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

        <section className="overflow-hidden bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_24px_70px_rgba(15,23,42,0.10)] border border-slate-200/70 dark:border-slate-700/70">
          <div className="border-b border-slate-200/80 dark:border-slate-700/70 px-6 py-6 md:px-8">
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
                <div className="rounded-2xl border border-[#D8E7EA] dark:border-slate-700 bg-[#F8FBFC] dark:bg-slate-900 px-5 py-4 min-w-56">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Giá chốt" : "Final Quote"}</p>
                  <p className="mt-1 text-2xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                    {quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{lang === "VN" ? "Tổng đã bao gồm phần quote hiện có" : "Based on current quote data"}</p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {booking.status === "PendingQuote" && (
                    <button
                      type="button"
                      onClick={() => navigate("/charter-booking", { state: { editBooking: booking } })}
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

          <div className="px-6 py-6 md:px-8">
            <div className="mb-6 overflow-x-auto">
              <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#F8FBFC] dark:bg-slate-900 p-2">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={tab.disabled}
                    onClick={() => setActiveDetailTab(tab.id)}
                    className={`flex min-w-fit items-center gap-2 rounded-xl px-4 py-3 text-xs font-headline font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      activeDetailTab === tab.id
                        ? "bg-[#124757] text-white shadow-sm dark:bg-yellow-400 dark:text-slate-900"
                        : "text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeDetailTab === "overview" && (
              <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {overviewItems.map((item) => (
                <div key={item.label} className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined rounded-xl bg-[#EAF3F5] dark:bg-slate-800 p-2 text-xl text-[#124757] dark:text-yellow-400">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                      <p className="mt-1 font-headline font-black text-slate-800 dark:text-white break-words">{item.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-3">
              {secondaryItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#F8FBFC] dark:bg-slate-900 px-4 py-3">
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
                </div>
              ))}
            </div>

            {Array.isArray(booking.requestedBoats) && booking.requestedBoats.length > 0 && (
              <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3 rounded-2xl border border-dashed border-[#BFD4D9] dark:border-slate-700 bg-[#FBFDFD] dark:bg-slate-900 px-4 py-4">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Loại tàu đã yêu cầu" : "Requested Boats"}</p>
                <div className="flex flex-wrap gap-2">
                  {booking.requestedBoats.map((boat, index) => (
                    <span key={`${pick(boat, ["seatSetupType"], "boat")}-${index}`} className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-headline font-black text-[#124757] dark:text-yellow-400">
                      {pick(boat, ["seatSetupType"], "--")}
                    </span>
                  ))}
                </div>
              </div>
            )}
              </>
            )}

            {activeDetailTab === "quote" && booking.status !== "PendingQuote" && (quoteBoatRows.length > 0 || booking.estimatedPrice > 0) && (
              <div className="mt-6 overflow-hidden rounded-3xl border border-[#D8E7EA] dark:border-slate-700 bg-[#F7FAFB] dark:bg-slate-900">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5">
                  <div>
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Báo giá đã chốt" : "Confirmed Quote"}</p>
                    <h2 className="mt-1 text-xl font-headline font-black text-[#0E4050] dark:text-yellow-400">{lang === "VN" ? "Chi tiết tàu và chi phí" : "Boat and pricing details"}</h2>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tổng thanh toán" : "Amount Due"}</p>
                    <p className="mt-1 text-2xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                      {quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}
                    </p>
                  </div>
                </div>

                {quoteBoatRows.length > 0 && (
                  <div className="grid gap-4 border-b border-[#D8E7EA] bg-[#F8FBFC] p-5 dark:border-slate-700 dark:bg-slate-900 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                    <div className="relative min-h-72 overflow-hidden rounded-3xl bg-slate-200 dark:bg-slate-800">
                      <img src={quoteBoatRows[0].imageUrl || DEFAULT_BOAT_IMAGE} alt={quoteBoatRows[0].name} className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#062A34]/90 to-transparent p-5 text-white">
                        <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] text-white/60">{lang === "VN" ? "Tàu đã chốt" : "Assigned Boat"}</p>
                        <h3 className="mt-1 text-2xl font-headline font-black">{quoteBoatRows[0].name}</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-headline font-black">{quoteBoatRows[0].seatSetupType}</span>
                          {quoteBoatRows[0].seatCount !== "" && (
                            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-headline font-black">{quoteBoatRows[0].seatCount} {lang === "VN" ? "ghế" : "seats"}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid content-start gap-3">
                      {[
                        { icon: "payments", label: lang === "VN" ? "Đơn giá" : "Unit Price", value: quoteBoatRows[0].unitPrice > 0 ? currencyFormatter.format(quoteBoatRows[0].unitPrice) : "--" },
                        { icon: "timer", label: lang === "VN" ? "Thời lượng tính tiền" : "Chargeable Duration", value: quoteBoatRows[0].chargeableDurationValue !== "" ? `${quoteBoatRows[0].chargeableDurationValue} ${booking.rentalUnit}` : "--" },
                        { icon: "confirmation_number", label: lang === "VN" ? "Thành tiền tàu chính" : "Main Boat Subtotal", value: quoteBoatRows[0].subtotalAmount > 0 ? currencyFormatter.format(quoteBoatRows[0].subtotalAmount) : "--" },
                        { icon: "route", label: lang === "VN" ? "Ước tính lộ trình" : "Route Estimate", value: formatRouteEstimate(booking.routeEstimate) },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-[#D8E7EA] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                          <span className="material-symbols-outlined grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF3F5] text-xl text-[#124757] dark:bg-slate-900 dark:text-yellow-400">{item.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                            <p className="mt-0.5 text-sm font-headline font-black text-[#0E4050] dark:text-white">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                                  {boat.seatSetupType}
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
                        {lang === "VN" ? "Backend chưa trả selectedBoats/quoteBoats cho booking này. FE vẫn hiển thị tổng giá đã chốt ở phần bên dưới." : "The backend did not return selectedBoats/quoteBoats for this booking. The confirmed amount is still shown below."}
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
                </div>
              </div>
            )}

            {activeDetailTab === "quote" && quoteNeedsAcceptance && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#D8E7EA] bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-headline font-black text-[#0E4050] dark:text-yellow-400">{lang === "VN" ? "Báo giá này đang chờ bạn xác nhận" : "This quote is waiting for your approval"}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{lang === "VN" ? "Chấp nhận xong hệ thống sẽ mở phần thanh toán ở tab kế tiếp." : "After acceptance, the payment tab will be ready."}</p>
                </div>
                <button type="button" onClick={handleAcceptQuote} disabled={isSubmitting} className="px-5 py-3 rounded-xl bg-[#124757] text-white font-headline font-black uppercase text-xs tracking-wider shadow-sm disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900">
                  {lang === "VN" ? "Chấp nhận báo giá" : "Accept Quote"}
                </button>
              </div>
            )}

            {activeDetailTab === "quote" && booking.status === "PendingQuote" && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-3xl">hourglass_top</span>
                  <div>
                    <h2 className="font-headline text-lg font-black">{lang === "VN" ? "Chưa có báo giá" : "No quote yet"}</h2>
                    <p className="mt-1 text-sm font-medium">{lang === "VN" ? "Admin đang chọn tàu và chốt giá. Khi có báo giá, ảnh tàu và chi tiết giá sẽ hiển thị ở mục này." : "The administrator is assigning boats and pricing. Boat photos and quote details will appear here."}</p>
                  </div>
                </div>
              </div>
            )}

            {activeDetailTab === "overview" && (
              <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Ghi chú" : "Notes"}</p>
                <p className="mt-2 font-medium text-slate-700 dark:text-slate-200">{booking.specialRequests}</p>
              </div>
            )}
          </div>
        </section>

        {activeDetailTab === "payment" && quoteNeedsAcceptance && (
          <section className="rounded-[2rem] border border-[#D8E7EA] dark:border-slate-700 bg-white dark:bg-slate-800 p-6 md:p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined rounded-2xl bg-[#EAF3F5] dark:bg-slate-900 p-3 text-2xl text-[#124757] dark:text-yellow-400">fact_check</span>
                <div>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Bước tiếp theo" : "Next Step"}</p>
                  <h2 className="mt-1 text-xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                    {lang === "VN" ? "Xác nhận báo giá để mở thanh toán" : "Accept the quote to continue"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                    {lang === "VN"
                      ? "Bạn có thể xem lại tàu, thời lượng và tổng tiền phía trên. Sau khi chấp nhận, hệ thống mới mở phần tạo thanh toán."
                      : "Review the boat, duration, and amount above. Payment becomes available after you accept this quote."}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
                <p className="text-2xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                  {quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}
                </p>
                <button type="button" onClick={handleAcceptQuote} disabled={isSubmitting} className="px-6 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider disabled:opacity-50 shadow-sm">
                  {lang === "VN" ? "Chấp nhận báo giá" : "Accept Quote"}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeDetailTab === "payment" && (canCreatePayment || pendingPaymentId || effectiveCheckoutUrl) && (
          <section className="overflow-hidden rounded-[2rem] border border-[#D8E7EA] bg-white shadow-[0_24px_70px_rgba(14,64,80,0.12)] dark:border-slate-700 dark:bg-slate-800">
            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_390px]">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] text-[#B48A00]">
                      {lang === "VN" ? "Thanh toán charter" : "Charter Checkout"}
                    </p>
                    <h2 className="mt-2 text-2xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                      {lang === "VN" ? "Hoàn tất giữ lịch tàu" : "Complete Your Charter"}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                      {lang === "VN"
                        ? "Chọn cách thanh toán phù hợp. PayOS sẽ tự động đối soát, tiền mặt cần Waterbus xác nhận thủ công."
                        : "Choose a payment method. PayOS reconciles automatically, while cash requires Waterbus confirmation."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#D8E7EA] bg-[#F8FBFC] px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Cần thanh toán" : "Pay Now"}</p>
                    <p className="mt-1 text-2xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                      {selectedPaymentAmount > 0 ? currencyFormatter.format(selectedPaymentAmount) : "--"}
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      id: "PayOS",
                      icon: "qr_code_2",
                      title: "PayOS",
                      description: lang === "VN" ? "Quét QR hoặc chuyển khoản, tự động đồng bộ trạng thái." : "Scan QR or bank transfer with automatic sync.",
                    },
                    {
                      id: "Cash",
                      icon: "local_atm",
                      title: lang === "VN" ? "Tiền mặt" : "Cash",
                      description: hasPendingPayOs
                        ? (lang === "VN" ? "Đang có PayOS pending nên không đổi sang tiền mặt." : "A pending PayOS payment is active.")
                        : (lang === "VN" ? "Waterbus liên hệ xác nhận và ghi nhận thanh toán." : "Waterbus confirms and records the payment manually."),
                      disabled: hasPendingPayOs,
                    },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      disabled={method.disabled}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`group flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        paymentMethod === method.id
                          ? "border-[#124757] bg-[#F2F8F9] shadow-[0_12px_32px_rgba(18,71,87,0.13)] dark:border-yellow-400 dark:bg-slate-900"
                          : "border-slate-200 bg-white hover:border-[#9CBAC2] dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      <span className={`material-symbols-outlined grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${
                        paymentMethod === method.id
                          ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                          : "bg-[#EAF3F5] text-[#124757] dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {method.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-headline text-base font-black text-[#0E4050] dark:text-white">{method.title}</span>
                          <span className={`material-symbols-outlined text-xl ${paymentMethod === method.id ? "text-[#124757] dark:text-yellow-400" : "text-slate-300"}`}>
                            {paymentMethod === method.id ? "check_circle" : "radio_button_unchecked"}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{method.description}</span>
                      </span>
                    </button>
                  ))}
                </div>

                {paymentMethod === "PayOS" ? (
                  <div className="mt-6 space-y-5">
                    {!hasPendingPayOs && (
                      <>
                        <div>
                          <p className="text-[10px] font-headline font-black uppercase tracking-[0.22em] text-slate-400">
                            {lang === "VN" ? "Khoản thanh toán" : "Payment Type"}
                          </p>
                          <div className="mt-3 space-y-3">
                            {paymentChoices.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                disabled={option.disabled}
                                onClick={() => setPaymentOption(option.id)}
                                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                                  paymentOption === option.id
                                    ? "border-[#124757] bg-[#F2F8F9] shadow-[0_10px_28px_rgba(18,71,87,0.10)] dark:border-yellow-400 dark:bg-slate-900"
                                    : "border-slate-200 bg-white hover:border-[#9CBAC2] dark:border-slate-700 dark:bg-slate-900"
                                }`}
                              >
                                <span className={`material-symbols-outlined grid size-11 shrink-0 place-items-center rounded-xl text-xl ${
                                  paymentOption === option.id
                                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                                    : "bg-[#EAF3F5] text-[#124757] dark:bg-slate-800 dark:text-slate-300"
                                }`}>
                                  {option.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{option.eyebrow}</span>
                                  <span className="mt-0.5 block font-headline text-sm font-black text-[#0E4050] dark:text-white">{option.title}</span>
                                  <span className="mt-1 block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{option.description}</span>
                                </span>
                                <span className="text-right">
                                  <span className="block text-sm font-headline font-black text-[#0E4050] dark:text-yellow-400">
                                    {option.amount > 0 ? currencyFormatter.format(option.amount) : "--"}
                                  </span>
                                  <span className={`material-symbols-outlined mt-2 text-xl ${paymentOption === option.id ? "text-[#124757] dark:text-yellow-400" : "text-slate-300"}`}>
                                    {paymentOption === option.id ? "check_circle" : "radio_button_unchecked"}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {paymentOption === "Deposit" && (
                          <div className="rounded-2xl border border-[#D8E7EA] bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                                {lang === "VN" ? "Tỷ lệ đặt cọc" : "Deposit Rate"}
                              </p>
                              <p className="text-lg font-headline font-black text-[#0E4050] dark:text-yellow-400">{depositPercent}%</p>
                            </div>
                            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                              <input
                                type="range"
                                min="10"
                                max="100"
                                step="5"
                                value={depositPercent}
                                onChange={(event) => setDepositPercent(event.target.value)}
                                className="h-2 flex-1 accent-[#124757] dark:accent-yellow-400"
                              />
                              <input
                                type="number"
                                min="10"
                                max="100"
                                step="5"
                                value={depositPercent}
                                onChange={(event) => setDepositPercent(Math.min(100, Math.max(10, Number(event.target.value) || 10)))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-headline font-black text-[#0E4050] outline-none focus:border-[#124757] focus:ring-4 focus:ring-[#124757]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-28"
                              />
                            </div>
                          </div>
                        )}

                        <label className="block">
                          <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                            {lang === "VN" ? "Mã khuyến mãi" : "Promotion Code"}
                          </span>
                          <div className="relative mt-2">
                            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#124757] dark:text-yellow-400">sell</span>
                            <input
                              value={paymentPromotionCode}
                              onChange={(event) => setPaymentPromotionCode(event.target.value)}
                              maxLength={80}
                              placeholder={lang === "VN" ? "Nhập mã nếu có" : "Enter code if any"}
                              className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-headline font-black uppercase text-slate-800 outline-none transition focus:border-[#124757] focus:ring-4 focus:ring-[#124757]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-yellow-400"
                            />
                          </div>
                        </label>

                        <button
                          type="button"
                          onClick={handleCreatePayment}
                          disabled={isSubmitting || !canCreatePayment}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#124757] px-6 py-4 font-headline text-xs font-black uppercase tracking-widest text-white shadow-[0_14px_28px_rgba(18,71,87,0.24)] transition hover:bg-[#0E4050] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-yellow-400 dark:text-slate-900"
                        >
                          <span className="material-symbols-outlined text-lg">lock</span>
                          {isSubmitting
                            ? (lang === "VN" ? "Đang tạo thanh toán..." : "Creating payment...")
                            : paymentOption === "Deposit"
                              ? (lang === "VN" ? "Tạo thanh toán đặt cọc" : "Create Deposit Payment")
                              : paymentOption === "Remaining"
                                ? (lang === "VN" ? "Thanh toán phần còn lại" : "Pay Remaining Amount")
                                : (lang === "VN" ? "Thanh toán qua PayOS" : "Pay With PayOS")}
                        </button>
                      </>
                    )}

                    {hasPendingPayOs && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex items-start gap-4">
                          <span className="material-symbols-outlined grid size-11 shrink-0 place-items-center rounded-xl bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-300">hourglass_top</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-headline text-sm font-black text-amber-800 dark:text-amber-200">
                              {lang === "VN" ? "PayOS đang chờ thanh toán" : "PayOS Payment Pending"}
                            </p>
                            <p className="mt-1 text-xs font-medium leading-5 text-amber-700/80 dark:text-amber-300/80">
                              {lang === "VN" ? "Booking đã có giao dịch đang mở. Mở lại PayOS hoặc đồng bộ trạng thái, FE sẽ không tạo thêm link trùng." : "This booking already has an open payment. Reopen PayOS or sync its status; the app will not create a duplicate link."}
                            </p>
                            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                              {effectiveCheckoutUrl && (
                                <button type="button" onClick={() => window.location.assign(effectiveCheckoutUrl)} className="rounded-xl bg-[#124757] px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
                                  {lang === "VN" ? "Mở PayOS" : "Open PayOS"}
                                </button>
                              )}
                              <button type="button" onClick={() => handleSyncPayment(pendingPaymentId)} disabled={isSubmitting || !pendingPaymentId} className="rounded-xl border border-amber-300 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 disabled:opacity-50 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-300">
                                {lang === "VN" ? "Đồng bộ lại" : "Sync Again"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl border border-[#D8E7EA] bg-[#F8FBFC] p-5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[#124757] shadow-sm dark:bg-slate-800 dark:text-yellow-400">storefront</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-headline text-base font-black text-[#0E4050] dark:text-white">
                          {lang === "VN" ? "Thanh toán tiền mặt với Waterbus" : "Cash Payment With Waterbus"}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                          {lang === "VN"
                            ? "Nhân viên sẽ xác nhận lịch tàu, địa điểm và thời hạn thanh toán. Booking chỉ được xác nhận sau khi khoản tiền được ghi nhận."
                            : "Staff will confirm the boat schedule, location, and payment deadline. The booking is confirmed after payment is recorded."}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        [lang === "VN" ? "Gửi yêu cầu" : "Request", "support_agent"],
                        [lang === "VN" ? "Xác nhận lịch" : "Confirm", "event_available"],
                        [lang === "VN" ? "Ghi nhận tiền" : "Record", "payments"],
                      ].map(([label, icon], index) => (
                        <div key={label} className="rounded-xl border border-white bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="grid size-6 place-items-center rounded-md bg-[#124757] text-[10px] font-black text-white dark:bg-yellow-400 dark:text-slate-900">{index + 1}</span>
                            <span className="material-symbols-outlined text-lg text-[#124757] dark:text-yellow-400">{icon}</span>
                          </div>
                          <p className="mt-2 text-[11px] font-headline font-black text-slate-700 dark:text-slate-200">{label}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/contact", { state: { charterBookingId: booking.id, bookingCode: booking.bookingCode } })}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#124757] px-6 py-4 font-headline text-xs font-black uppercase tracking-widest text-white shadow-[0_12px_24px_rgba(18,71,87,0.20)] transition hover:bg-[#0E4050] dark:bg-yellow-400 dark:text-slate-900"
                    >
                      <span className="material-symbols-outlined text-lg">support_agent</span>
                      {lang === "VN" ? "Liên hệ xác nhận tiền mặt" : "Arrange Cash Payment"}
                    </button>
                  </div>
                )}
              </div>

              <aside className="border-t border-[#D8E7EA] bg-[#F5F9FA] p-6 dark:border-slate-700 dark:bg-slate-900 lg:border-l lg:border-t-0 md:p-8">
                <div className="overflow-hidden rounded-[1.75rem] border border-[#D8E7EA] bg-white shadow-[0_18px_48px_rgba(14,64,80,0.08)] dark:border-slate-700 dark:bg-slate-800">
                  <div className="bg-[#0E4050] px-5 py-5 text-white dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] text-white/55">
                          {lang === "VN" ? "Tóm tắt" : "Summary"}
                        </p>
                        <p className="mt-1 font-headline text-lg font-black">{booking.bookingCode}</p>
                      </div>
                      <span className="material-symbols-outlined grid size-11 place-items-center rounded-2xl bg-white/10 text-2xl">receipt_long</span>
                    </div>
                    <div className="mt-5 rounded-2xl bg-white/10 px-4 py-3">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/55">{lang === "VN" ? "Sẽ thanh toán" : "Pay Now"}</p>
                      <p className="mt-1 text-2xl font-headline font-black text-yellow-300">{selectedPaymentAmount > 0 ? currencyFormatter.format(selectedPaymentAmount) : "--"}</p>
                    </div>
                  </div>

                  <div className="space-y-4 p-5">
                    <div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Hành trình" : "Route"}</p>
                      <p className="mt-1 text-sm font-headline font-black text-[#0E4050] dark:text-white">{routeFrom} - {routeTo}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{formatDate(booking.departureDate)} · {String(booking.startTime).slice(0, 5)}</p>
                    </div>

                    {quoteBoatRows.length > 0 && (
                      <div>
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Tàu" : "Boat"}</p>
                        <div className="mt-2 space-y-2">
                          {quoteBoatRows.slice(0, 2).map((boat) => (
                            <div key={`${boat.boatOrder}-${boat.name}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F8FBFC] p-2 dark:border-slate-700 dark:bg-slate-900">
                              <img src={boat.imageUrl || DEFAULT_BOAT_IMAGE} alt={boat.name} className="size-12 rounded-lg object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-headline font-black text-[#0E4050] dark:text-white">{boat.name}</p>
                                <p className="mt-0.5 text-[10px] font-bold text-slate-400">{boat.seatSetupType}</p>
                              </div>
                              <p className="text-[11px] font-headline font-black text-[#0E4050] dark:text-yellow-400">{boat.subtotalAmount > 0 ? currencyFormatter.format(boat.subtotalAmount) : "--"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 border-t border-dashed border-[#D8E7EA] pt-4 text-sm dark:border-slate-700">
                      <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
                        <span>{lang === "VN" ? "Tạm tính" : "Subtotal"}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{quoteSubtotal > 0 ? currencyFormatter.format(quoteSubtotal) : "--"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
                        <span>{lang === "VN" ? "Giảm giá" : "Discount"}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{booking.discountAmount > 0 ? `-${currencyFormatter.format(booking.discountAmount)}` : "--"}</span>
                      </div>
                      {paidAmount > 0 && (
                        <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
                          <span>{lang === "VN" ? "Đã thanh toán" : "Paid"}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">-{currencyFormatter.format(paidAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#D8E7EA] bg-[#F8FBFC] px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                          {paymentMethod === "PayOS" ? (lang === "VN" ? "Qua PayOS" : "Via PayOS") : (lang === "VN" ? "Tiền mặt" : "Cash")}
                        </span>
                        <span className="material-symbols-outlined text-lg text-[#124757] dark:text-yellow-400">{paymentMethod === "PayOS" ? "shield_lock" : "handshake"}</span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                        {paymentMethod === "PayOS"
                          ? (lang === "VN" ? "Bạn sẽ được chuyển sang cổng thanh toán bảo mật." : "You will continue to the secure checkout.")
                          : (lang === "VN" ? "Waterbus sẽ xác nhận thủ công trước khi giữ vé." : "Waterbus will manually confirm before holding tickets.")}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeDetailTab === "payment" && !quoteNeedsAcceptance && !canCreatePayment && !pendingPaymentId && !effectiveCheckoutUrl && booking.status !== "PendingQuote" && (
          <section className="overflow-hidden rounded-[2rem] border border-[#D8E7EA] bg-white shadow-[0_24px_70px_rgba(14,64,80,0.10)] dark:border-slate-700 dark:bg-slate-800">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-6 md:p-8">
                <div className={`rounded-3xl border p-6 ${paymentStatusTone}`}>
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined grid size-14 shrink-0 place-items-center rounded-2xl bg-white/70 text-3xl dark:bg-slate-950/40">
                        {isPaid ? "verified" : booking.status === "Cancelled" ? "cancel" : "receipt_long"}
                      </span>
                      <div>
                        <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] opacity-70">
                          {lang === "VN" ? "Trạng thái thanh toán" : "Payment Status"}
                        </p>
                        <h2 className="mt-1 text-2xl font-headline font-black">
                          {isPaid
                            ? (lang === "VN" ? "Booking đã thanh toán" : "Booking is paid")
                            : booking.status === "Cancelled"
                              ? (lang === "VN" ? "Booking đã hủy" : "Booking is cancelled")
                              : (lang === "VN" ? "Chưa có giao dịch mở" : "No active payment")}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 opacity-80">
                          {isPaid
                            ? (lang === "VN" ? "Hệ thống đã ghi nhận khoản thanh toán. Nếu đã thanh toán đủ, bạn có thể chuyển sang mục Vé & hành khách." : "Payment has been recorded. If fully paid, continue to tickets and passengers.")
                            : booking.status === "Cancelled"
                              ? (lang === "VN" ? "Yêu cầu này đã hủy nên không còn mở tạo thanh toán mới. Lịch sử giao dịch nếu có được liệt kê bên dưới." : "This request is cancelled, so new payments are no longer available. Any payment history is listed below.")
                              : (lang === "VN" ? "Hiện không có link PayOS đang chờ và trạng thái booking chưa cho tạo thanh toán mới." : "There is no pending PayOS link and the booking status is not eligible for a new payment.")}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-5 py-4 text-left shadow-sm dark:bg-slate-950/30 md:text-right">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest opacity-60">{lang === "VN" ? "Đã thanh toán" : "Paid"}</p>
                      <p className="mt-1 text-2xl font-headline font-black">{paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--"}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] text-slate-400">
                        {lang === "VN" ? "Lịch sử giao dịch" : "Payment History"}
                      </p>
                      <h3 className="mt-1 text-xl font-headline font-black text-[#0E4050] dark:text-yellow-400">
                        {lang === "VN" ? "Các lần tạo thanh toán" : "Payment Attempts"}
                      </h3>
                    </div>
                    <p className="text-xs font-bold text-slate-400">{paymentRows.length} {lang === "VN" ? "giao dịch" : "records"}</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {paymentRows.length > 0 ? paymentRows.map((payment) => {
                      const status = String(payment.status).toLowerCase();
                      const tone = status === "paid"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : status === "pending"
                          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                          : status === "cancelled" || status === "canceled"
                            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
                            : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

                      return (
                        <div key={payment.id} className="grid gap-3 rounded-2xl border border-[#D8E7EA] bg-[#F8FBFC] p-4 dark:border-slate-700 dark:bg-slate-900 md:grid-cols-[1fr_130px_130px_auto] md:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-headline font-black text-[#0E4050] dark:text-white">{payment.provider} · {payment.purpose}</p>
                            <p className="mt-1 break-all text-[11px] font-bold text-slate-400">ID: {payment.id}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Số tiền" : "Amount"}</p>
                            <p className="mt-1 text-sm font-headline font-black text-[#0E4050] dark:text-yellow-400">{payment.amount > 0 ? currencyFormatter.format(payment.amount) : "--"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Trạng thái" : "Status"}</p>
                            <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${tone}`}>{payment.status}</span>
                          </div>
                          {payment.checkoutUrl ? (
                            <button type="button" onClick={() => window.location.assign(payment.checkoutUrl)} className="rounded-xl bg-[#124757] px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900">
                              {lang === "VN" ? "Mở link" : "Open"}
                            </button>
                          ) : (
                            <span className="hidden md:block"></span>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="rounded-2xl border border-dashed border-[#BFD4D9] bg-[#F8FBFC] p-6 text-center dark:border-slate-700 dark:bg-slate-900">
                        <span className="material-symbols-outlined text-4xl text-[#124757] dark:text-yellow-400">payments</span>
                        <p className="mt-2 font-headline text-base font-black text-[#0E4050] dark:text-white">{lang === "VN" ? "Chưa có giao dịch thanh toán" : "No payment records"}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                          {lang === "VN" ? "Khi bạn tạo link PayOS hoặc nhân viên ghi nhận tiền mặt, lịch sử sẽ hiển thị ở đây." : "PayOS links or recorded cash payments will appear here."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside className="border-t border-[#D8E7EA] bg-[#F5F9FA] p-6 dark:border-slate-700 dark:bg-slate-900 lg:border-l lg:border-t-0 md:p-8">
                <div className="rounded-[1.75rem] border border-[#D8E7EA] bg-white p-5 shadow-[0_18px_48px_rgba(14,64,80,0.08)] dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-[10px] font-headline font-black uppercase tracking-[0.25em] text-slate-400">{lang === "VN" ? "Tóm tắt thanh toán" : "Payment Summary"}</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-slate-500 dark:text-slate-400">{lang === "VN" ? "Giá chốt" : "Final Quote"}</span>
                      <span className="font-headline font-black text-[#0E4050] dark:text-white">{quoteTotal > 0 ? currencyFormatter.format(quoteTotal) : "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-slate-500 dark:text-slate-400">{lang === "VN" ? "Đã thanh toán" : "Paid"}</span>
                      <span className="font-headline font-black text-emerald-600 dark:text-emerald-400">{paidAmount > 0 ? currencyFormatter.format(paidAmount) : "--"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-dashed border-[#D8E7EA] pt-3 dark:border-slate-700">
                      <span className="font-bold text-slate-500 dark:text-slate-400">{lang === "VN" ? "Còn lại" : "Remaining"}</span>
                      <span className="font-headline font-black text-[#0E4050] dark:text-yellow-400">{remainingAmount > 0 ? currencyFormatter.format(remainingAmount) : "--"}</span>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl bg-[#F8FBFC] p-4 dark:bg-slate-900">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Ghi chú" : "Note"}</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                      {booking.status === "Cancelled"
                        ? (lang === "VN" ? "Booking đã hủy nên chỉ còn xem lịch sử, không tạo thanh toán mới." : "This booking is cancelled, so payment creation is unavailable.")
                        : isPaid
                          ? (lang === "VN" ? "Thanh toán đã được ghi nhận. Vé/hành khách mở theo trạng thái booking." : "Payment has been recorded. Tickets/passengers depend on booking status.")
                          : (lang === "VN" ? "Nếu cần thanh toán tiếp, booking phải ở trạng thái cho phép tạo payment." : "To continue payment, the booking must be in an eligible status.")}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activeDetailTab === "payment" && !isPaid && booking.status === "PendingQuote" && (
          <section className="rounded-4xl p-6 md:p-8 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-3xl text-amber-500">hourglass_top</span>
              <div>
                <h2 className="text-lg font-headline font-black text-amber-800 dark:text-amber-300">
                  {lang === "VN" ? "Đang chờ báo giá" : "Waiting for a quote"}
                </h2>
                <p className="text-sm text-amber-700/80 dark:text-amber-300/80 mt-1">
                  {lang === "VN"
                    ? "Admin đang kiểm tra tàu phù hợp và giá thuê. Sau khi có báo giá, bạn mới có thể thanh toán; danh sách hành khách và vé chỉ mở sau khi thanh toán đủ."
                    : "An administrator is assigning a boat and preparing the quote. Payment becomes available after quoting, and passenger tickets unlock only after full payment."}
                </p>
              </div>
            </div>
          </section>
        )}

        {activeDetailTab === "tickets" && isPaid && (
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

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
                <button type="button" onClick={() => importInputRef.current?.click()} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {lang === "VN" ? "Nhập file khách" : "Import Passengers"}
                </button>
                <button type="button" onClick={() => handleTicketFileAction("zip")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {lang === "VN" ? "Tải ZIP vé/QR" : "Download ZIP"}
                </button>
                <button type="button" onClick={() => handleTicketFileAction("print")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {lang === "VN" ? "In vé" : "Print Tickets"}
                </button>
                <button type="button" onClick={() => handleTicketFileAction("pdf")} disabled={isSubmitting || !isPaid} className="px-4 py-3 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 font-headline font-black uppercase text-[10px] tracking-wider disabled:opacity-50">
                  {lang === "VN" ? "Tải PDF" : "Download PDF"}
                </button>
              </div>
              <input ref={importInputRef} type="file" accept=".xlsx,.csv,.tsv,.txt" onChange={handleImportPassengers} className="hidden" />
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Danh sách hành khách" : "Passenger Manifest"}</h2>
              <p className="text-xs text-slate-400 mt-1">{lang === "VN" ? "API nhận fullName và dateOfBirth. Ngày sinh nên nhập dạng dd/MM/yyyy." : "API accepts fullName and dateOfBirth. Use dd/MM/yyyy."}</p>
            </div>
            <button onClick={() => setPassengerRows((prev) => [...prev, { fullName: "", dateOfBirth: "" }])} disabled={!isPaid} className="px-5 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-50">
              {lang === "VN" ? "Thêm dòng" : "Add Row"}
            </button>
          </div>

          <div className="space-y-3 mt-6">
            {passengerRows.map((row, index) => (
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
                <input value={row.fullName} onChange={(e) => handlePassengerChange(index, "fullName", e.target.value)} disabled={!isPaid} placeholder={lang === "VN" ? "Họ tên" : "Full name"} className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] disabled:opacity-60" />
                <input value={row.dateOfBirth} onChange={(e) => handlePassengerChange(index, "dateOfBirth", e.target.value)} disabled={!isPaid} placeholder="dd/MM/yyyy" className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#FFD100] col-start-2 md:col-start-auto disabled:opacity-60" />
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={handleSavePassengers} disabled={isSubmitting || !isPaid} className="w-full sm:w-auto min-w-56 rounded-xl bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 py-3 px-6 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
              {isSubmitting ? (lang === "VN" ? "Đang lưu..." : "Saving...") : (lang === "VN" ? "Lưu hành khách" : "Save Passengers")}
            </button>
          </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
