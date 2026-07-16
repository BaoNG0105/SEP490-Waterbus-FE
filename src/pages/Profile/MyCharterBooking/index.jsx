import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CharterWorkflowStepper } from "../../../components/CharterWorkflowStepper";
import { useApp } from "../../../context/AppContext";
import { fetchMyCharterBookings } from "../../../services/charterBookingService";
import {
  getCustomerActionInfo,
  matchesSmartFilter,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import { resolveCharterBookingStatus, resolveCharterPaymentStatus, matchesCharterStatusFilter } from "../../../utils/charterBookingAdmin";

const statusOptions = ["All", "PendingQuote", "Quoted", "PendingPayment", "Confirmed", "Completed", "Cancelled", "Expired"];

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
    rentalUnit: pick(item, ["rentalUnit"], ""),
    durationValue: Number(pick(item, ["durationValue", "durationHours"], 0)) || 0,
    adultCount,
    childCount,
    passengerCount,
    status: resolveCharterBookingStatus(item),
    paymentStatus: resolveCharterPaymentStatus(item),
    estimatedPrice: Number(pick(item, ["finalAmount", "totalAmount", "subtotalAmount", "estimatedPrice", "quoteAmount"], 0)),
    holdExpiresAt: pick(item, ["holdExpiresAt"], ""),
  };
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("vi-VN");
};

const ListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((item) => (
      <div key={item} className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex gap-4">
          <div className="h-12 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded-lg bg-slate-100 dark:bg-slate-700/70" />
            <div className="h-8 w-full max-w-md rounded-xl bg-slate-100 dark:bg-slate-700/70" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function CharterList() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState(() => location.state?.searchCode || "");
  const [pendingOpenCode, setPendingOpenCode] = useState(() => location.state?.searchCode || "");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = location.state?.searchCode;
    if (!code) return;
    setSearchTerm(String(code));
    setPendingOpenCode(String(code));
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state?.searchCode, navigate]);

  useEffect(() => {
    if (!pendingOpenCode || isLoading) return;

    const match = bookings.find(
      (booking) => String(booking.bookingCode).toLowerCase() === String(pendingOpenCode).toLowerCase()
    );
    setPendingOpenCode("");
    if (match?.id) {
      navigate(`/profile/my-charter-booking/${match.id}`, { state: { booking: match } });
    }
  }, [bookings, isLoading, navigate, pendingOpenCode]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    []
  );

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

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch =
      booking.bookingCode.toLowerCase().includes(searchValue)
      || booking.boatName.toLowerCase().includes(searchValue)
      || booking.route.toLowerCase().includes(searchValue);
    const matchesStatus = matchesCharterStatusFilter(booking.status, statusFilter);
    return matchesSearch && matchesStatus;
  }), [bookings, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: bookings.length,
    waitingQuote: bookings.filter((booking) => booking.status === "PendingQuote").length,
    readyToPay: bookings.filter((booking) => booking.status === "Quoted" && String(booking.paymentStatus).toLowerCase() !== "paid").length,
    activeTrips: bookings.filter((booking) => ["PendingPayment", "Confirmed"].includes(booking.status)).length,
    paidTrips: bookings.filter((booking) => String(booking.paymentStatus).toLowerCase() === "paid").length,
    needsAction: bookings.filter((booking) => matchesSmartFilter(booking, "needsAction")).length,
  }), [bookings]);

  const openBooking = (booking, focusPayment = false) => {
    navigate(`/profile/my-charter-booking/${booking.id}`, {
      state: { booking, focusPayment },
    });
  };

  const statCards = [
    { key: "all", icon: "folder_open", label: lang === "VN" ? "Tổng yêu cầu" : "Total", value: stats.total, tone: "text-[#124757] dark:text-yellow-400", ring: "ring-[#124757]/10 dark:ring-yellow-400/20", bg: "bg-slate-50 dark:bg-slate-900" },
    { key: "needsAction", icon: "priority_high", label: lang === "VN" ? "Cần xử lý" : "Action needed", value: stats.needsAction, tone: "text-rose-600 dark:text-rose-300", ring: "ring-rose-500/15", bg: "bg-rose-50 dark:bg-rose-500/10" },
    { key: "waitingQuote", icon: "request_quote", label: lang === "VN" ? "Chờ báo giá" : "Waiting", value: stats.waitingQuote, tone: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/15", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { key: "toPay", icon: "payments", label: lang === "VN" ? "Cần thanh toán" : "To pay", value: stats.readyToPay, tone: "text-indigo-600 dark:text-indigo-300", ring: "ring-indigo-500/15", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
    { key: "active", icon: "event_available", label: lang === "VN" ? "Đang hiệu lực" : "Active", value: stats.activeTrips, tone: "text-sky-600 dark:text-sky-300", ring: "ring-sky-500/15", bg: "bg-sky-50 dark:bg-sky-500/10" },
  ];

  const hasFilters = searchTerm || statusFilter !== "All";
  const emptyMessage = bookings.length === 0
    ? (lang === "VN" ? "Bạn chưa có yêu cầu thuê tàu nào." : "You have no charter requests yet.")
    : (lang === "VN" ? "Không có yêu cầu phù hợp với bộ lọc hiện tại." : "No requests match your current filters.");

  return (
    <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
          <div className="bg-linear-to-br from-[#124757] via-[#165a6d] to-[#0e3540] px-6 py-8 text-white md:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-[0.2em] text-white/60">
                  Waterbus Charter
                </p>
                <h1 className="mt-1 font-headline text-2xl font-black md:text-3xl">
                  {lang === "VN" ? "Yêu cầu thuê tàu" : "My Charter Requests"}
                </h1>
                <p className="mt-2 max-w-lg text-sm font-medium text-white/75">
                  {lang === "VN"
                    ? "Theo dõi tiến trình, thanh toán và quản lý hành khách — mọi thứ ở một nơi."
                    : "Track progress, payments, and passengers — everything in one place."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadBookings}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                  <span className={`material-symbols-outlined ${isLoading ? "animate-spin" : ""}`}>refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/charter-booking")}
                  className="rounded-xl bg-[#FFD100] px-5 py-3 font-headline text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-black/10 transition hover:scale-[1.02] active:scale-95"
                >
                  {lang === "VN" ? "Tạo yêu cầu" : "New request"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6 md:p-8">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={lang === "VN" ? "Tìm mã đặt chỗ, tàu, lộ trình..." : "Search code, boat, route..."}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium outline-none transition focus:ring-2 focus:ring-[#FFD100] dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-headline font-black uppercase text-[#124757] outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "All" ? (lang === "VN" ? "Tất cả trạng thái" : "All statuses") : getStatusInfo(status).label}
                  </option>
                ))}
              </select>
            </div>

            {errorMsg && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                {errorMsg}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {statCards.map((item) => (
            <div
              key={item.key}
              className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${item.bg} ${item.tone}`}>
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
              </div>
              <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`mt-1 font-headline text-2xl font-black ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          {isLoading ? (
            <ListSkeleton />
          ) : filteredBookings.length === 0 ? (
            <div className="rounded-4xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
              <span className="material-symbols-outlined mb-3 block text-5xl text-slate-300 dark:text-slate-600">sailing</span>
              <p className="font-headline text-lg font-black text-slate-500 dark:text-slate-300">{emptyMessage}</p>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(""); setStatusFilter("All"); }}
                  className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-[#124757] dark:border-slate-700 dark:text-yellow-400"
                >
                  {lang === "VN" ? "Xóa bộ lọc" : "Clear filters"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate("/charter-booking")}
                  className="mt-4 rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900"
                >
                  {lang === "VN" ? "Tạo yêu cầu đầu tiên" : "Create your first request"}
                </button>
              )}
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
              const actionInfo = getCustomerActionInfo(booking, lang);
              const focusPayment = ["pay", "manage"].includes(actionInfo.tone) && actionInfo.urgent;

              return (
                <article
                  key={booking.id || booking.bookingCode}
                  className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-800 ${
                    actionInfo.urgent
                      ? "border-[#124757]/20 ring-1 ring-[#124757]/10 dark:border-yellow-400/20 dark:ring-yellow-400/10"
                      : "border-slate-100 dark:border-slate-700/50"
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 w-1 ${
                      actionInfo.urgent ? "bg-[#FFD100]" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />

                  <div className="flex flex-col gap-5 p-5 pl-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBooking(booking)}
                          className="font-headline text-lg font-black text-[#124757] transition hover:text-[#0d3541] dark:text-white dark:hover:text-yellow-400"
                        >
                          {booking.bookingCode}
                        </button>
                        <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${statusInfo.classes}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                        {actionInfo.urgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFD100]/20 px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD100]" />
                            {lang === "VN" ? "Ưu tiên" : "Priority"}
                          </span>
                        )}
                      </div>

                      <div className="grid gap-1 sm:grid-cols-2">
                        <p className="truncate text-sm font-bold text-slate-700 dark:text-slate-200">{booking.route}</p>
                        <p className="text-[11px] font-bold text-slate-400 sm:col-span-2">
                          {formatDate(booking.departureDate)} · {String(booking.startTime).slice(0, 5)} · {booking.passengerCount} {lang === "VN" ? "khách" : "guests"}
                          {Number(booking.durationValue) > 0
                            ? ` · ${booking.durationValue} ${booking.rentalUnit === "Hour" ? (lang === "VN" ? "giờ" : "hr") : (lang === "VN" ? "ngày" : "day(s)")}`
                            : ""}
                        </p>
                      </div>

                      <CharterWorkflowStepper status={booking.status} lang={lang} compact />
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-3 sm:min-w-52 lg:items-end">
                      <div className="text-left lg:text-right">
                        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                          {lang === "VN" ? "Giá chốt" : "Quote"}
                        </p>
                        <p className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
                          {booking.estimatedPrice > 0 ? currencyFormatter.format(booking.estimatedPrice) : "--"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openBooking(booking, focusPayment)}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider shadow-sm transition hover:scale-[1.02] active:scale-95 ${actionInfo.buttonClasses}`}
                      >
                        <span className="material-symbols-outlined text-base">{actionInfo.icon}</span>
                        {actionInfo.cta}
                      </button>
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
