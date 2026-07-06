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
import { createBookingPayment, syncBookingPayment } from "../../../services/paymentService";
import { getApiErrorMessage } from "../../../utils/apiError";

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
    paymentStatus: pick(item, ["paymentStatus"], "--"),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: Number(pick(item, ["depositAmount"], paidDepositAmount)),
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
  const loadedIdRef = useRef("");
  const importInputRef = useRef(null);
  const syncedPaymentRef = useRef("");
  const autoSyncPaymentRef = useRef("");

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
    if (!booking) return;
    setPaymentOption(booking.hasDepositPaid && booking.paymentStatus !== "Paid" ? "Remaining" : "Full");
    setPaymentCheckoutUrl(booking.latestPaymentCheckoutUrl || "");
    setPaymentPromotionCode((prev) => prev || booking.promotionCode || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only when these specific fields change, not on every booking refetch
  }, [booking?.id, booking?.hasDepositPaid, booking?.paymentStatus, booking?.latestPaymentCheckoutUrl, booking?.promotionCode]);

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
  }, [booking?.id, booking?.latestPaymentId, booking?.paymentStatus, loadDetail]);

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
          lang === "VN" ? "Không thể tạo link thanh toán PayOS. Vui lòng kiểm tra trạng thái booking hoặc mã khuyến mãi." : "Unable to create the PayOS payment link. Please check the booking status or promotion code.",
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

  const statusInfo = getStatusInfo(booking.status);
  const isPaid = String(booking.paymentStatus).toLowerCase() === "paid";
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
  const storedPaymentId = sessionStorage.getItem(`charterPayment:${booking.id}`);
  const activePendingPayment = Array.isArray(booking.payments)
    ? booking.payments.find((payment) => String(payment.paymentStatus).toLowerCase() === "pending")
    : null;
  const pendingPaymentId = pick(activePendingPayment, ["paymentId", "id"], booking.latestPaymentId || storedPaymentId);
  const effectiveCheckoutUrl = paymentCheckoutUrl || pick(activePendingPayment, ["checkoutUrl", "paymentUrl"], booking.latestPaymentCheckoutUrl);
  const hasPendingPayOs = Boolean(pendingPaymentId || effectiveCheckoutUrl);
  const canCreatePayment = ["Quoted", "PendingPayment", "Confirmed"].includes(booking.status) && !isPaid && !hasPendingPayOs;
  const remainingAmount = Math.max(quoteTotal - paidAmount, 0);
  const depositPaymentAmount = Math.round((quoteTotal * Number(depositPercent || 0)) / 100);
  const selectedPaymentAmount = paymentOption === "Deposit"
    ? depositPaymentAmount
    : paymentOption === "Remaining"
      ? remainingAmount
      : booking.hasDepositPaid
        ? remainingAmount
        : quoteTotal;
  const paymentChoices = [
    { id: "Deposit", label: lang === "VN" ? "Đặt cọc" : "Deposit", disabled: booking.hasDepositPaid, amount: depositPaymentAmount },
    { id: "Full", label: lang === "VN" ? "Thanh toán đủ" : "Full", disabled: false, amount: booking.hasDepositPaid ? remainingAmount : quoteTotal },
    { id: "Remaining", label: lang === "VN" ? "Phần còn lại" : "Remaining", disabled: !booking.hasDepositPaid, amount: remainingAmount },
  ];
  const routeStops = booking.route && booking.route !== "--" ? booking.route.split(/\s+-\s+/) : [];
  const routeFrom = booking.fromStationName || routeStops[0] || "--";
  const routeTo = booking.toStationName || routeStops[1] || "--";
  const scheduleItems = [
    { icon: "event", label: lang === "VN" ? "Ngày giờ đi" : "Schedule", value: `${formatDate(booking.departureDate)} ${String(booking.startTime).slice(0, 5)}` },
    { icon: "timer", label: lang === "VN" ? "Thời lượng thuê" : "Duration", value: `${booking.durationValue} ${booking.rentalUnit}` },
    { icon: "groups", label: lang === "VN" ? "Hành khách" : "Passengers", value: `${booking.passengerCount} (${booking.adultCount} adult / ${booking.childCount} child)` },
    { icon: "route", label: lang === "VN" ? "Ước tính lộ trình" : "Route Estimate", value: formatRouteEstimate(booking.routeEstimate) },
  ];
  const contactItems = [
    { icon: "person", label: lang === "VN" ? "Người liên hệ" : "Contact Name", value: booking.contactName },
    { icon: "call", label: lang === "VN" ? "Số điện thoại" : "Phone", value: booking.contactPhone },
    { icon: "mail", label: lang === "VN" ? "Email" : "Email", value: booking.contactEmail },
  ];

  return (
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
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_18px_50px_rgba(15,23,42,0.06)] border border-slate-200/70 dark:border-slate-700/70 px-6 py-6 md:px-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-headline font-black text-slate-800 dark:text-white uppercase tracking-wide text-sm">
              {lang === "VN" ? "Tổng quan yêu cầu" : "Request Overview"}
            </h2>
            <p className="text-[11px] font-bold text-slate-400">
              {lang === "VN" ? "Gửi lúc" : "Submitted"} {formatDateTime(booking.createdAt)}
            </p>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {scheduleItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
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

          {Array.isArray(booking.itineraryStops) && booking.itineraryStops.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#F8FBFC] dark:bg-slate-900 px-4 py-4">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Điểm dừng lộ trình" : "Itinerary Stops"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-headline font-black text-[#124757] dark:text-yellow-400">{routeFrom}</span>
                {booking.itineraryStops.map((stop, index) => (
                  <span key={`${stop.stationId || stop.stationName}-${index}`} className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-slate-300">arrow_forward</span>
                    <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                      {stop.stationName || "--"}
                      {Number(stop.stayDurationMinutes) > 0 ? ` · ${stop.stayDurationMinutes} ${lang === "VN" ? "phút" : "min"}` : ""}
                    </span>
                  </span>
                ))}
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-slate-300">arrow_forward</span>
                  <span className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-headline font-black text-[#124757] dark:text-yellow-400">{routeTo}</span>
                </span>
              </div>
            </div>
          )}

          {Array.isArray(booking.requestedBoats) && booking.requestedBoats.length > 0 && (
            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3 rounded-2xl border border-dashed border-[#BFD4D9] dark:border-slate-700 bg-[#FBFDFD] dark:bg-slate-900 px-4 py-4">
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

          <div className="mt-4 grid md:grid-cols-3 gap-3">
            {contactItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[#F8FBFC] dark:bg-slate-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-[#124757] dark:text-yellow-400">{item.icon}</span>
                  <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                </div>
                <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200 break-words">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Yêu cầu về tàu" : "Boat Requirements"}</p>
              <p className="mt-2 font-medium text-slate-700 dark:text-slate-200 break-words">{booking.boatRequirements}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4">
              <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">{lang === "VN" ? "Ghi chú đặc biệt" : "Special Requests"}</p>
              <p className="mt-2 font-medium text-slate-700 dark:text-slate-200 break-words">{booking.specialRequests}</p>
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
                  <p className="mt-1 text-sm font-medium">{lang === "VN" ? "Admin đang chọn tàu và chốt giá. Khi có báo giá, ảnh tàu và chi tiết giá sẽ hiển thị ở mục này." : "The administrator is assigning boats and pricing. Boat photos and quote details will appear here."}</p>
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
                  ) : hasPendingPayOs ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                      <p className="flex-1 text-xs font-bold text-amber-800 dark:text-amber-200">
                        {lang === "VN" ? "Đang có giao dịch PayOS chờ xử lý." : "A PayOS payment is pending."}
                      </p>
                      <div className="flex shrink-0 gap-2">
                        {effectiveCheckoutUrl && (
                          <button type="button" onClick={() => window.location.assign(effectiveCheckoutUrl)} className="rounded-lg bg-[#124757] dark:bg-yellow-400 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-white dark:text-slate-900">
                            {lang === "VN" ? "Mở PayOS" : "Open PayOS"}
                          </button>
                        )}
                        <button type="button" onClick={() => handleSyncPayment(pendingPaymentId)} disabled={isSubmitting || !pendingPaymentId} className="rounded-lg border border-amber-300 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 disabled:opacity-50">
                          {lang === "VN" ? "Đồng bộ" : "Sync"}
                        </button>
                      </div>
                    </div>
                  ) : canCreatePayment ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {paymentChoices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            disabled={choice.disabled}
                            onClick={() => setPaymentOption(choice.id)}
                            className={`min-w-28 flex-1 rounded-xl border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                              paymentOption === choice.id
                                ? "border-[#124757] bg-[#F2F8F9] dark:border-yellow-400 dark:bg-slate-900"
                                : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                            }`}
                          >
                            <span className="block text-[10px] font-headline font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{choice.label}</span>
                            <span className="block text-sm font-headline font-black text-[#0E4050] dark:text-yellow-400">{choice.amount > 0 ? currencyFormatter.format(choice.amount) : "--"}</span>
                          </button>
                        ))}
                      </div>

                      {paymentOption === "Deposit" && (
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
                          className="shrink-0 rounded-xl bg-[#124757] dark:bg-yellow-400 px-6 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-white dark:text-slate-900 disabled:opacity-50"
                        >
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
              <div>
                <h2 className="text-xl font-headline font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Danh sách hành khách" : "Passenger Manifest"}</h2>
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
