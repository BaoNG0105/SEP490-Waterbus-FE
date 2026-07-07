import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchMyCharterBookings } from "../../../services/charterBookingService";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";

const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired", "Refunded"];

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

  return {
    id: pick(item, ["id", "charterBookingId", "bookingId"]),
    bookingCode: pick(item, ["bookingCode", "code"], "--"),
    boatName: pick(item, ["boatName", "boat.name"], "--"),
    route: pick(item, ["routeName", "route", "itineraryName"], fromName || toName ? `${fromName || "--"} - ${toName || "--"}` : "--"),
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
  };
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

export function CharterList() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const currencyFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

  const loadBookings = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchMyCharterBookings();
      setBookings(Array.isArray(data) ? data.map(normalizeBooking) : []);
    } catch (error) {
      console.error("Lỗi tải yêu cầu thuê tàu:", error);
      setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải danh sách yêu cầu thuê tàu." : "Unable to load charter requests."));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadBookings();
  }, [loadBookings]);

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);

  const getActionInfo = (booking) => {
    const paymentStatus = String(booking.paymentStatus).toLowerCase();

    if (booking.status === "PendingQuote") {
      return {
        icon: "hourglass_top",
        label: lang === "VN" ? "Chờ báo giá" : "Waiting for quote",
        classes: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
      };
    }

    if (booking.status === "Quoted" && paymentStatus !== "paid") {
      return {
        icon: "payments",
        label: lang === "VN" ? "Xem báo giá & thanh toán" : "Review quote & pay",
        classes: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
      };
    }

    if (booking.status === "PendingPayment" || (booking.status === "Confirmed" && paymentStatus === "depositpaid")) {
      return {
        icon: "sync",
        label: paymentStatus === "depositpaid"
          ? (lang === "VN" ? "Thanh toán phần còn lại" : "Pay remaining balance")
          : (lang === "VN" ? "Tiếp tục hoặc đồng bộ thanh toán" : "Continue or sync payment"),
        classes: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20",
      };
    }

    if (["Confirmed", "Completed"].includes(booking.status) || paymentStatus === "paid") {
      return {
        icon: "confirmation_number",
        label: lang === "VN" ? "Quản lý hành khách/vé" : "Manage passengers/tickets",
        classes: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
      };
    }

    if (["Cancelled", "Expired", "Refunded"].includes(booking.status)) {
      return {
        icon: "event_busy",
        label: getStatusInfo(booking.status).label,
        classes: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
      };
    }

    return {
      icon: "visibility",
      label: lang === "VN" ? "Xem chi tiết" : "View details",
      classes: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
    };
  };

  const filteredBookings = bookings.filter((booking) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch =
      booking.bookingCode.toLowerCase().includes(searchValue) ||
      booking.boatName.toLowerCase().includes(searchValue) ||
      booking.route.toLowerCase().includes(searchValue);
    const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: bookings.length,
    waitingQuote: bookings.filter((booking) => booking.status === "PendingQuote").length,
    readyToPay: bookings.filter((booking) => booking.status === "Quoted" && String(booking.paymentStatus).toLowerCase() !== "paid").length,
    activeTrips: bookings.filter((booking) => ["PendingPayment", "Confirmed"].includes(booking.status)).length,
    paidTrips: bookings.filter((booking) => String(booking.paymentStatus).toLowerCase() === "paid").length,
  };

  const workflowSteps = ["PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed"];
  const getProgressPercent = (status) => {
    if (["Cancelled", "Expired", "Refunded"].includes(status)) return 100;
    const stepIndex = Math.max(workflowSteps.indexOf(status), 0);
    return Math.round((stepIndex / (workflowSteps.length - 1)) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-30 px-4 sm:px-6 lg:px-8 font-body transition-colors">
      <main className="max-w-5xl mx-auto space-y-6">
        <section className="bg-white dark:bg-slate-800 rounded-4xl p-6 md:p-8 shadow-xl border border-slate-100 dark:border-slate-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Yêu cầu thuê tàu của tôi" : "My Charter Requests"}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {lang === "VN" ? "Theo dõi báo giá, thanh toán và danh sách hành khách." : "Track quotes, payments, and passenger manifests."}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadBookings} className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#124757] dark:text-yellow-400 flex items-center justify-center">
                <span className={`material-symbols-outlined ${isLoading ? "animate-spin" : ""}`}>refresh</span>
              </button>
              <button onClick={() => navigate("/charter-booking")} className="px-5 py-3 rounded-xl bg-yellow-400 text-slate-900 font-headline font-black uppercase tracking-widest text-xs">
                {lang === "VN" ? "Tạo yêu cầu" : "New Request"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-[1fr_220px] gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={lang === "VN" ? "Tìm mã đặt chỗ, tàu, lộ trình..." : "Search booking code, boat, route..."} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-headline font-black uppercase text-[#124757] dark:text-yellow-400 outline-none">
              {statusOptions.map((status) => <option key={status} value={status}>{status === "All" ? (lang === "VN" ? "Tất cả" : "All") : getStatusInfo(status).label}</option>)}
            </select>
          </div>

          {errorMsg && <div className="mt-4 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 text-xs font-bold border border-red-100 dark:border-red-500/20">{errorMsg}</div>}
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { icon: "folder_open", label: lang === "VN" ? "Tổng yêu cầu" : "Total", value: stats.total, tone: "text-[#124757] dark:text-yellow-400", bg: "bg-slate-100 dark:bg-slate-900" },
            { icon: "request_quote", label: lang === "VN" ? "Chờ báo giá" : "Waiting", value: stats.waitingQuote, tone: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10" },
            { icon: "payments", label: lang === "VN" ? "Cần thanh toán" : "To Pay", value: stats.readyToPay, tone: "text-indigo-600 dark:text-indigo-300", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
            { icon: "verified", label: lang === "VN" ? "Đã thanh toán" : "Paid", value: stats.paidTrips, tone: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { icon: "event_available", label: lang === "VN" ? "Đang hiệu lực" : "Active", value: stats.activeTrips, tone: "text-sky-600 dark:text-sky-300", bg: "bg-sky-50 dark:bg-sky-500/10" },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${item.bg} ${item.tone}`}>
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
              </div>
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`mt-1 text-2xl font-headline font-black ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          {isLoading ? (
            <div className="bg-white dark:bg-slate-800 rounded-4xl p-16 border border-slate-100 dark:border-slate-700/50 flex justify-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-4xl p-16 border border-slate-100 dark:border-slate-700/50 text-center text-slate-400 font-bold">
              <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
              {lang === "VN" ? "Chưa có yêu cầu thuê tàu phù hợp." : "No matching charter requests."}
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
              const actionInfo = getActionInfo(booking);
              return (
                <article key={booking.id || booking.bookingCode} className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusInfo.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-200 truncate">{booking.route}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(booking.departureDate)} {String(booking.startTime).slice(0, 5)} / {booking.passengerCount} {lang === "VN" ? "khách" : "guests"} / {booking.durationValue} {booking.rentalUnit}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(`/profile/my-charter-booking/${booking.id}`, { state: { booking } })}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-colors shrink-0"
                      >
                        {lang === "VN" ? "Xem chi tiết" : "View details"}
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                      <div className="h-2 max-w-xl overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                        <div
                          className={`h-full rounded-full ${["Cancelled", "Expired", "Refunded"].includes(booking.status) ? "bg-slate-400" : "bg-[#FFD100]"}`}
                          style={{ width: `${getProgressPercent(booking.status)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between lg:justify-end gap-4">
                      <div className={`hidden min-w-44 rounded-2xl border px-3 py-2 text-left sm:block ${actionInfo.classes}`}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">{actionInfo.icon}</span>
                          <span className="text-[10px] font-headline font-black uppercase tracking-wider leading-4">{actionInfo.label}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-black text-slate-400">{lang === "VN" ? "Giá chốt" : "Quote"}</p>
                        <p className="font-headline font-black text-[#124757] dark:text-yellow-400">{booking.estimatedPrice > 0 ? currencyFormatter.format(booking.estimatedPrice) : "--"}</p>
                      </div>

                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
