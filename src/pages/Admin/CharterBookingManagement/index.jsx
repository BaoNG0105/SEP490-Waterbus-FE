import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats } from "../../../services/boatService";
import {
  fetchAdminCharterBookingDetail,
  fetchAdminCharterBookings,
  fetchCharterBookingManifestByCode,
  modifyAdminCharterBookingStatus,
  previewAdminCharterBookingQuote,
  submitAdminCharterBookingQuote,
  // updateCharterAttendance,
} from "../../../services/charterBookingService";
import { getApiErrorMessage } from "../../../utils/apiError";

const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired", "Refunded"];
const rentalUnits = ["Day", "Hour"];
const itemsPerPage = 8;

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const getBoatSeatCount = (boat) =>
  Number(pick(boat, ["seatCount", "capacity", "totalSeats", "seatsCount", "maxPassengers"], 0)) || 0;

const getBoatId = (boat) => pick(boat, ["id", "boatId"]);
const getBoatSeatSetupType = (boat) => pick(boat, ["seatSetupType", "requiredSeatSetupType", "boat.seatSetupType"], "");
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
    parts.push(`${lang === "VN" ? "Thời lượng tính tiền" : "Chargeable duration"}: ${chargeableDurationValue} ${rentalUnit || ""}`.trim());
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
      requiredSeatSetupType: requestedBoat.requiredSeatSetupType,
      boatId: getBoatId(selectedBoat) || (requestedBoats.length === 1 && booking?.boatId ? booking.boatId : ""),
    };
  });
};

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
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    depositAmount: Number(pick(item, ["depositAmount"], 0)),
    promotionCode: pick(item, ["promotionCode"], ""),
    note: pick(item, ["specialRequests", "boatRequirements", "note"], "--"),
    qrToken: pick(item, ["charterBookingQrToken", "qrToken"], ""),
    tickets: pick(item, ["tickets", "passengers"], []),
    payments: pick(item, ["payments"], []),
    createdAt: pick(item, ["createdAt", "createdDate"]),
  };
};

export function CharterBookingManagement() {
  const { lang } = useApp();
  const [bookings, setBookings] = useState([]);
  const [boats, setBoats] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    boats: [],
    subtotalAmount: "",
    rentalUnit: "",
    durationValue: "",
    promotionCode: "",
  });
  const [quotePreview, setQuotePreview] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [quotePreviewError, setQuotePreviewError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedAttendanceTicketIds, setSelectedAttendanceTicketIds] = useState([]);

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
    pendingQuote: bookings.filter((item) => item.status === "PendingQuote").length,
    quoted: bookings.filter((item) => item.status === "Quoted").length,
    confirmed: bookings.filter((item) => item.status === "Confirmed").length,
    revenue: bookings
      .filter((item) => ["Quoted", "Confirmed", "Completed"].includes(item.status))
      .reduce((sum, item) => sum + item.estimatedPrice, 0),
  };

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

  const getAdminActionInfo = (booking) => {
    const paymentStatus = String(booking.paymentStatus || "").toLowerCase();

    if (booking.status === "PendingQuote") {
      return {
        icon: "assignment_add",
        label: lang === "VN" ? "Cần nhập tàu & chốt giá" : "Assign boats & quote",
        classes: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
        weight: 1,
      };
    }

    if (booking.status === "Quoted" && paymentStatus !== "paid") {
      return {
        icon: "payments",
        label: lang === "VN" ? "Chờ khách thanh toán" : "Waiting for payment",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
        weight: 2,
      };
    }

    if (booking.status === "PendingPayment") {
      return {
        icon: "sync",
        label: lang === "VN" ? "Theo dõi giao dịch" : "Track transaction",
        classes: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
        weight: 3,
      };
    }

    if (booking.status === "Confirmed") {
      return {
        icon: "fact_check",
        label: lang === "VN" ? "Chuẩn bị vận hành" : "Prepare operation",
        classes: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
        weight: 4,
      };
    }

    return {
      icon: "visibility",
      label: lang === "VN" ? "Theo dõi" : "Monitor",
      classes: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
      weight: 9,
    };
  };

  // const priorityBookings = bookings
  //   .filter((booking) => ["PendingQuote", "Quoted", "PendingPayment", "Confirmed"].includes(booking.status))
  //   .sort((a, b) => getAdminActionInfo(a).weight - getAdminActionInfo(b).weight)
  //   .slice(0, 4);

  const openDetail = async (booking) => {
    try {
      setIsDetailLoading(true);
      let detail;
      try {
        detail = await fetchAdminCharterBookingDetail(booking.id);
      } catch (detailError) {
        if (!booking.bookingCode || booking.bookingCode === "--") throw detailError;
        detail = await fetchCharterBookingManifestByCode(booking.bookingCode);
      }
      const normalized = normalizeBooking(detail);
      setSelectedBooking(normalized);
      setSelectedAttendanceTicketIds([]);
      setQuotePreview(null);
      setQuotePreviewError("");
      setQuoteForm({
        boats: buildQuoteBoatRows(normalized),
        subtotalAmount: normalized.estimatedPrice || "",
        rentalUnit: normalized.rentalUnit || "Day",
        durationValue: normalized.durationValue || 1,
        promotionCode: normalized.promotionCode || "",
      });
    } catch (error) {
      console.error("Lỗi tải chi tiết charter booking:", error);
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Không thể tải chi tiết" : "Unable to load details",
        text: error.response?.data?.message || (lang === "VN" ? "Vui lòng thử lại sau." : "Please try again later."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsDetailLoading(false);
    }
  };

  const refreshAfterChange = async () => {
    await loadData();
    if (selectedBooking?.id) {
      const detail = await fetchAdminCharterBookingDetail(selectedBooking.id);
      setSelectedBooking(normalizeBooking(detail));
    }
  };

  const buildQuotePayload = useCallback(() => ({
    boats: quoteForm.boats.map((boat) => ({
      boatOrder: Number(boat.boatOrder),
      boatId: boat.boatId,
    })),
    subtotalAmount: quoteForm.subtotalAmount === "" ? null : Number(quoteForm.subtotalAmount),
    rentalUnit: quoteForm.rentalUnit || null,
    durationValue: quoteForm.durationValue === "" ? null : Number(quoteForm.durationValue),
    promotionCode: quoteForm.promotionCode?.trim() || null,
  }), [quoteForm]);

  const isQuoteBoatSelectionComplete = quoteForm.boats.length > 0 && quoteForm.boats.every((boat) => boat.boatId);
  const hasBlockingPayment = Array.isArray(selectedBooking?.payments)
    && selectedBooking.payments.some((payment) => ["Pending", "Paid"].includes(payment.paymentStatus));
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
    try {
      setIsSubmitting(true);
      await modifyAdminCharterBookingStatus(id, nextStatus);
      await refreshAfterChange();
      Swal.fire({
        icon: "success",
        title: lang === "VN" ? "Đã cập nhật trạng thái" : "Status updated",
        confirmButtonColor: "#124757",
        timer: 1400,
        showConfirmButton: false,
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
  //       text: lang === "VN" ? "Các vé không hợp lệ sẽ được backend bỏ qua." : "Invalid ticket transitions are skipped by the server.",
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
          { icon: "map", labelVn: "Tổng yêu cầu", labelEn: "Total Requests", value: isLoading ? "..." : stats.total, color: "text-[#124757] dark:text-yellow-400", bg: "bg-slate-500/10 dark:bg-slate-900" },
          { icon: "pending_actions", labelVn: "Chờ báo giá", labelEn: "Pending Quote", value: isLoading ? "..." : stats.pendingQuote, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { icon: "request_quote", labelVn: "Đã báo giá", labelEn: "Quoted", value: isLoading ? "..." : stats.quoted, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
          { icon: "event_available", labelVn: "Đã xác nhận", labelEn: "Confirmed", value: isLoading ? "..." : stats.confirmed, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
          { icon: "payments", labelVn: "Giá trị báo giá", labelEn: "Quoted Value", value: isLoading ? "..." : currencyFormatter.format(stats.revenue), color: "text-[#124757] dark:text-white", bg: "bg-yellow-400/20" },
        ].map((item) => (
          <div key={item.icon} className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === "VN" ? item.labelVn : item.labelEn}</p>
              <h3 className={`text-lg font-headline font-black mt-0.5 truncate ${item.color}`}>{item.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Hàng đợi xử lý" : "Operations Queue"}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-400">
                {lang === "VN" ? "Ưu tiên booking cần báo giá, thanh toán hoặc chuẩn bị vận hành." : "Prioritizes requests that need quoting, payment follow-up, or operation prep."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("PendingQuote");
                setCurrentPage(1);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <span className="material-symbols-outlined text-base">assignment_add</span>
              {lang === "VN" ? "Lọc chờ báo giá" : "Pending quotes"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {priorityBookings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-400 dark:border-slate-700 lg:col-span-2">
                <span className="material-symbols-outlined mb-2 block text-3xl">task_alt</span>
                {lang === "VN" ? "Không có booking cần xử lý ngay." : "No urgent charter requests right now."}
              </div>
            ) : (
              priorityBookings.map((booking) => {
                const actionInfo = getAdminActionInfo(booking);
                return (
                  <button
                    key={`queue-${booking.id || booking.bookingCode}`}
                    type="button"
                    onClick={() => openDetail(booking)}
                    className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition-all hover:border-[#124757]/30 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-yellow-400/40 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-300">{booking.customerName}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[9px] font-headline font-black uppercase tracking-wider ${getStatusInfo(booking.status).classes}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getStatusInfo(booking.status).dot}`}></span>
                        {getStatusInfo(booking.status).label}
                      </span>
                    </div>
                    <div className={`mt-3 rounded-2xl border px-3 py-2 ${actionInfo.classes}`}>
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg">{actionInfo.icon}</span>
                        <span className="text-[10px] font-headline font-black uppercase tracking-wider">{actionInfo.label}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-400">
                      <span>{formatDate(booking.departureDate)}</span>
                      <span className="text-center">{booking.passengerCount} {lang === "VN" ? "khách" : "guests"}</span>
                      <span className="text-right">{booking.estimatedPrice > 0 ? currencyFormatter.format(booking.estimatedPrice) : "--"}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div> */}

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
                  const statusInfo = getStatusInfo(booking.status);
                  return (
                    <tr key={booking.id || booking.bookingCode} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                      <td className="py-4 px-6">
                        <p className="font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{booking.passengerCount} {lang === "VN" ? "khách" : "guests"} / {booking.durationValue} {booking.rentalUnit}</p>
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
                        <p className="text-[9px] text-slate-400 mt-1">{booking.paymentStatus}</p>
                      </td>
                      <td className="py-4 px-6 text-right font-headline font-black text-[#124757] dark:text-yellow-400">
                        {booking.estimatedPrice > 0 ? currencyFormatter.format(booking.estimatedPrice) : "--"}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => openDetail(booking)}
                          disabled={isDetailLoading}
                          className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center text-slate-400 hover:text-[#124757] hover:bg-slate-50 dark:hover:text-yellow-400 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
                          title={lang === "VN" ? "Xem chi tiết" : "View details"}
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
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
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button key={page} type="button" onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-xl font-headline font-black text-xs ${currentPage === page ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900" : "border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"}`}>
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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${getStatusInfo(selectedBooking.status).classes}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusInfo(selectedBooking.status).dot}`}></span>
                    {getStatusInfo(selectedBooking.status).label}
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
                    { label: lang === "VN" ? "Thời lượng" : "Duration", value: `${selectedBooking.durationValue} ${selectedBooking.rentalUnit}` },
                    { label: lang === "VN" ? "Hành khách" : "Passengers", value: `${selectedBooking.passengerCount} (${selectedBooking.adultCount} adult / ${selectedBooking.childCount} child)` },
                    { label: lang === "VN" ? "Thanh toán" : "Payment", value: selectedBooking.paymentStatus },
                    { label: lang === "VN" ? "Giá chốt" : "Quote", value: selectedBooking.estimatedPrice > 0 ? currencyFormatter.format(selectedBooking.estimatedPrice) : "--" },
                    { label: lang === "VN" ? "Đặt cọc" : "Deposit", value: selectedBooking.depositAmount > 0 ? currencyFormatter.format(selectedBooking.depositAmount) : "--" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="font-bold text-slate-800 dark:text-white mt-1 break-words">{item.value}</p>
                    </div>
                  ))}
                  <div className="sm:col-span-2 rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Yêu cầu/Ghi chú" : "Requests / Notes"}</p>
                    <p className="font-medium text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">{selectedBooking.note}</p>
                  </div>
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
                        {lang === "VN" ? "Chọn đúng loại ghế từng dòng, không trùng tàu." : "Select matching seat setup for each row without duplicates."}
                      </p>
                    </div>
                    {quoteForm.boats.map((quoteBoat) => {
                      const selectedBoatIds = quoteForm.boats
                        .filter((boat) => boat.boatOrder !== quoteBoat.boatOrder && boat.boatId)
                        .map((boat) => boat.boatId);
                      const availableBoats = boats.filter((boat) => {
                        const boatId = getBoatId(boat);
                        const matchesSeatSetup = !quoteBoat.requiredSeatSetupType || getBoatSeatSetupType(boat) === quoteBoat.requiredSeatSetupType;
                        return matchesSeatSetup && (!selectedBoatIds.includes(boatId) || boatId === quoteBoat.boatId);
                      });

                      return (
                        <div key={quoteBoat.boatOrder} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                              {lang === "VN" ? `Dòng ${quoteBoat.boatOrder}` : `Boat ${quoteBoat.boatOrder}`}
                            </p>
                            {quoteBoat.requiredSeatSetupType && (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 dark:text-slate-300">
                                {quoteBoat.requiredSeatSetupType}
                              </span>
                            )}
                          </div>
                          <select value={quoteBoat.boatId} onChange={(e) => handleQuoteBoatChange(quoteBoat.boatOrder, e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-white outline-none">
                            <option value="">{lang === "VN" ? "Chọn tàu active" : "Select active boat"}</option>
                            {availableBoats.map((boat) => {
                              const boatId = getBoatId(boat);
                              return (
                                <option key={boatId} value={boatId}>
                                  {boat.code ? `${boat.code} - ` : ""}{boat.name} ({getBoatSeatCount(boat)} {lang === "VN" ? "ghế" : "seats"}) - {currencyFormatter.format(getBoatPrice(boat, quoteForm.rentalUnit || selectedBooking.rentalUnit || "Day"))}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Đơn vị" : "Unit"}</label>
                      <select value={quoteForm.rentalUnit} onChange={(e) => setQuoteForm((prev) => ({ ...prev, rentalUnit: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none">
                        <option value="">{lang === "VN" ? "Giữ nguyên" : "Keep current"}</option>
                        {rentalUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Thời lượng" : "Duration"}</label>
                      <input type="number" min="1" max="60" value={quoteForm.durationValue} onChange={(e) => setQuoteForm((prev) => ({ ...prev, durationValue: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Tổng giá thủ công" : "Manual total override"}</label>
                    <input type="number" min="0" value={quoteForm.subtotalAmount} onChange={(e) => setQuoteForm((prev) => ({ ...prev, subtotalAmount: e.target.value }))} placeholder={lang === "VN" ? "Để trống để backend tự tính" : "Leave empty for backend calculation"} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Mã khuyến mãi" : "Promotion Code"}</label>
                    <input value={quoteForm.promotionCode} onChange={(e) => setQuoteForm((prev) => ({ ...prev, promotionCode: e.target.value }))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none" />
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-xs tracking-wider">
                        {lang === "VN" ? "Preview giá" : "Quote Preview"}
                      </h5>
                      {isPreviewLoading && <span className="text-[10px] font-bold text-slate-400">{lang === "VN" ? "Đang tính..." : "Calculating..."}</span>}
                    </div>
                    {quotePreviewError ? (
                      <p className="text-xs font-bold text-red-500">{quotePreviewError}</p>
                    ) : quotePreview ? (
                      <div className="space-y-3">
                        {Array.isArray(quotePreview.boats) && quotePreview.boats.map((boat, index) => (
                          <div key={`${pick(boat, ["boatOrder"], index + 1)}-${index}`} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-black text-slate-500 dark:text-slate-300">{lang === "VN" ? `Tàu ${pick(boat, ["boatOrder"], index + 1)}` : `Boat ${pick(boat, ["boatOrder"], index + 1)}`}</span>
                              <span className="font-headline font-black text-[#124757] dark:text-yellow-400">{currencyFormatter.format(Number(pick(boat, ["subtotalAmount"], 0)) || 0)}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {lang === "VN" ? "Đơn giá" : "Unit price"}: {currencyFormatter.format(Number(pick(boat, ["unitPrice"], 0)) || 0)} · {lang === "VN" ? "Thời lượng tính tiền" : "Chargeable duration"}: {pick(boat, ["chargeableDurationValue"], "--")}
                            </p>
                          </div>
                        ))}
                        <div className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                          <div className="flex justify-between"><span>{lang === "VN" ? "Tổng trước giảm" : "Subtotal"}</span><span>{currencyFormatter.format(Number(pick(quotePreview, ["subtotalAmount"], 0)) || 0)}</span></div>
                          <div className="flex justify-between"><span>{lang === "VN" ? "Giảm giá" : "Discount"}</span><span>{currencyFormatter.format(Number(pick(quotePreview, ["discountAmount"], 0)) || 0)}</span></div>
                          <div className="flex justify-between text-[#124757] dark:text-yellow-400 font-headline font-black"><span>{lang === "VN" ? "Tổng cuối" : "Total"}</span><span>{currencyFormatter.format(Number(pick(quotePreview, ["totalAmount"], 0)) || 0)}</span></div>
                        </div>
                        {formatRouteEstimate(pick(quotePreview, ["routeEstimate"], ""), lang) && (
                          <p className="text-[10px] leading-relaxed text-slate-400">{formatRouteEstimate(pick(quotePreview, ["routeEstimate"], ""), lang)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-400">
                        {isQuoteBoatSelectionComplete
                          ? (lang === "VN" ? "Preview sẽ hiển thị sau khi backend tính giá." : "Preview will appear after pricing is calculated.")
                          : (lang === "VN" ? "Chọn đủ tàu để preview giá." : "Select all boats to preview pricing.")}
                      </p>
                    )}
                  </div>
                  <button type="submit" disabled={isSubmitting || !isQuoteBoatSelectionComplete || !canManageQuote} className="w-full px-6 py-3 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-60">
                    {isSubmitting ? (lang === "VN" ? "Đang xử lý..." : "Submitting...") : (lang === "VN" ? "Chốt giá" : "Submit Quote")}
                  </button>
                  </fieldset>
                </form>

                <div className="rounded-3xl bg-slate-50 dark:bg-slate-800 p-5 border border-slate-100 dark:border-slate-700 space-y-3">
                  <h4 className="font-headline font-black text-[#124757] dark:text-yellow-400 uppercase text-sm tracking-wider">
                    {lang === "VN" ? "Cập nhật trạng thái" : "Update Status"}
                  </h4>
                  <select value={selectedBooking.status} onChange={(event) => handleStatusChange(selectedBooking.id, event.target.value)} disabled={isSubmitting} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white outline-none disabled:opacity-60">
                    {statusOptions.filter((status) => status !== "All").map((status) => (
                      <option key={status} value={status}>{getStatusInfo(status).label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] leading-relaxed text-slate-400 font-medium">
                    {lang === "VN"
                      ? "Theo API, Completed yêu cầu paymentStatus = Paid; Refunded yêu cầu paymentStatus = Refunded."
                      : "API rules require Paid payment for Completed and Refunded payment for Refunded."}
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
