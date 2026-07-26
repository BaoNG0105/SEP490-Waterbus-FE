import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchMyBookings } from "../../../services/bookingService";
import { BOOKING_SERVICE_CONFIG, getBookingServiceConfig } from "../../../utils/bookingServiceType";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeBooking = (item) => ({
  id: String(pick(item, ["bookingId", "id"], "")),
  bookingCode: pick(item, ["bookingCode", "code"], "--"),
  bookedAt: pick(item, ["bookedAt", "createdAt"], ""),
  status: pick(item, ["bookingStatus", "status"], "--"),
  totalAmount: Number(pick(item, ["totalAmount"], 0)),
  itemCount: Number(pick(item, ["itemCount"], 0)),
  serviceType: pick(item, ["serviceType"], ""),
});

const STATUS_STYLES = {
  pendingpayment: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  completed: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600",
  expired: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
};

const getStatusClasses = (status) => STATUS_STYLES[String(status || "").toLowerCase()]
  || "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700/40 dark:text-slate-400 dark:border-slate-600";

const STATUS_LABELS = {
  pendingpayment: { vn: "Chờ thanh toán", en: "Pending payment" },
  confirmed: { vn: "Đã xác nhận", en: "Confirmed" },
  completed: { vn: "Hoàn thành", en: "Completed" },
  cancelled: { vn: "Đã hủy", en: "Cancelled" },
  expired: { vn: "Hết hạn", en: "Expired" },
  paid: { vn: "Đã thanh toán", en: "Paid" },
};

const getStatusLabel = (status, lang = "VN") => {
  const key = String(status || "").toLowerCase().replace(/[\s_-]/g, "");
  const entry = STATUS_LABELS[key];
  if (!entry) return status || "--";
  return lang === "VN" ? entry.vn : entry.en;
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
};

const SERVICE_TABS = Object.values(BOOKING_SERVICE_CONFIG);

const ListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((item) => (
      <div key={item} className="animate-pulse rounded-3xl border border-slate-100 bg-white p-5 dark:border-slate-700/50 dark:bg-slate-800">
        <div className="flex gap-4">
          <div className="h-12 w-1 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-2/3 rounded-lg bg-slate-100 dark:bg-slate-700/70" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function BookingListPage() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const activeServiceType = getBookingServiceConfig(
    location.state?.serviceType || searchParams.get("type") || "Waterbus",
  ).serviceType;
  const config = getBookingServiceConfig(activeServiceType);

  const [allBookings, setAllBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const highlightBookingId = location.state?.highlightBookingId || "";
  const paymentOutcome = location.state?.paymentOutcome
    || new URLSearchParams(location.search).get("paymentOutcome")
    || "";
  const returnedOrderCode = location.state?.orderCode
    || new URLSearchParams(location.search).get("orderCode")
    || "";
  const fromPayOs = new URLSearchParams(location.search).has("fromPayOs")
    || Boolean(location.state?.paymentOutcome);

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
      const data = await fetchMyBookings();
      const normalized = Array.isArray(data) ? data.map(normalizeBooking) : [];
      setAllBookings(normalized);
    } catch (error) {
      console.error("Lỗi tải lịch sử đặt vé:", error);
      setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể tải lịch sử đặt vé." : "Unable to load your booking history."));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, lang, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    loadBookings();
  }, [loadBookings]);

  const handleTabChange = (serviceType) => {
    setSearchTerm("");
    setStatusFilter("All");
    setSearchParams({ type: serviceType }, { replace: true });
  };

  const bookingsForTab = useMemo(
    () => allBookings.filter((booking) => booking.serviceType === config.serviceType),
    [allBookings, config.serviceType],
  );

  const tabCounts = useMemo(() => {
    const counts = {};
    SERVICE_TABS.forEach((tab) => {
      counts[tab.serviceType] = allBookings.filter((b) => b.serviceType === tab.serviceType).length;
    });
    return counts;
  }, [allBookings]);

  const statusOptions = useMemo(() => {
    const distinct = [...new Set(bookingsForTab.map((b) => b.status).filter(Boolean))];
    return ["All", ...distinct];
  }, [bookingsForTab]);

  const filteredBookings = useMemo(() => bookingsForTab.filter((booking) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch = booking.bookingCode.toLowerCase().includes(searchValue);
    const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [bookingsForTab, searchTerm, statusFilter]);

  const hasFilters = searchTerm || statusFilter !== "All";
  const emptyMessage = bookingsForTab.length === 0
    ? (lang === "VN" ? config.emptyVn : config.emptyEn)
    : (lang === "VN" ? "Không có vé phù hợp với bộ lọc hiện tại." : "No bookings match your current filters.");

  return (
    <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#124757] dark:text-slate-400 dark:hover:text-yellow-400"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          {lang === "VN" ? "Về hồ sơ" : "Back to profile"}
        </button>

        <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
          <div className="bg-linear-to-br from-[#124757] via-[#165a6d] to-[#0e3540] px-6 py-8 text-white md:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-widest text-white/60">
                  {lang === "VN" ? "Lịch sử đặt vé" : "Booking history"}
                </p>
                <h1 className="mt-1 font-headline text-2xl font-black md:text-3xl">
                  {lang === "VN" ? config.titleVn : config.titleEn}
                </h1>
                <p className="mt-2 max-w-lg text-sm font-medium text-white/75">
                  {lang === "VN" ? config.descVn : config.descEn}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(config.newBookingPath)}
                  className="rounded-xl bg-[#FFD100] px-5 py-3 font-headline text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-black/10 transition hover:scale-[1.02] active:scale-95"
                >
                  {lang === "VN" ? config.newBookingLabelVn : config.newBookingLabelEn}
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              {SERVICE_TABS.map((tab) => (
                <button
                  key={tab.serviceType}
                  type="button"
                  onClick={() => handleTabChange(tab.serviceType)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-headline font-black uppercase tracking-widest transition-all ${
                    tab.serviceType === config.serviceType
                      ? "bg-white text-[#124757] shadow-md dark:bg-yellow-400 dark:text-slate-900"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {lang === "VN" ? tab.titleVn : tab.titleEn}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                    tab.serviceType === config.serviceType
                      ? "bg-[#124757]/10 dark:bg-slate-900/10"
                      : "bg-white/10"
                  }`}
                  >
                    {tabCounts[tab.serviceType] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-6 md:p-8">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">search</span>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={lang === "VN" ? "Tìm mã đặt vé..." : "Search booking code..."}
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
                    {status === "All"
                      ? (lang === "VN" ? "Tất cả trạng thái" : "All statuses")
                      : getStatusLabel(status, lang)}
                  </option>
                ))}
              </select>
            </div>

            {fromPayOs ? (
              <div className={`rounded-2xl border p-4 text-xs font-bold ${
                paymentOutcome === "cancel"
                  ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
              }`}>
                {paymentOutcome === "cancel"
                  ? (lang === "VN"
                    ? "Bạn đã hủy thanh toán trên PayOS. Booking có thể vẫn ở trạng thái chờ thanh toán."
                    : "You cancelled PayOS checkout. The booking may still be pending payment.")
                  : (lang === "VN"
                    ? "Đã nhận phản hồi PayOS và đồng bộ thanh toán. Kiểm tra trạng thái booking bên dưới (Paid/Confirmed)."
                    : "PayOS response received and payment synced. Check booking status below (Paid/Confirmed).")}
                {returnedOrderCode ? (
                  <span className="mt-1 block font-mono text-[10px] opacity-70">orderCode: {returnedOrderCode}</span>
                ) : null}
              </div>
            ) : null}

            {errorMsg && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                {errorMsg}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          {isLoading ? (
            <ListSkeleton />
          ) : filteredBookings.length === 0 ? (
            <div className="rounded-4xl border border-dashed border-slate-200 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
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
                  onClick={() => navigate(config.newBookingPath)}
                  className="mt-4 rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900"
                >
                  {lang === "VN" ? config.firstBookingLabelVn : config.firstBookingLabelEn}
                </button>
              )}
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <article
                key={booking.id || booking.bookingCode}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`${config.basePath}/${booking.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    navigate(`${config.basePath}/${booking.id}`);
                  }
                }}
                className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg dark:bg-slate-800 ${
                  highlightBookingId && String(highlightBookingId) === booking.id
                    ? "border-[#124757] ring-2 ring-[#124757]/20 dark:border-yellow-400 dark:ring-yellow-400/20"
                    : "border-slate-100 dark:border-slate-700/50"
                }`}
              >
                <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline text-lg font-black text-[#124757] dark:text-white">
                        {booking.bookingCode}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${getStatusClasses(booking.status)}`}>
                        {getStatusLabel(booking.status, lang)}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">
                      {lang === "VN" ? "Đặt lúc" : "Booked at"}: {formatDateTime(booking.bookedAt)}
                      {booking.itemCount > 0 ? (
                        <>
                          {" · "}
                          {booking.itemCount}{" "}
                          {(() => {
                            const statusKey = String(booking.status || "").toLowerCase().replace(/[\s_-]/g, "");
                            const isInactive = statusKey === "expired" || statusKey === "cancelled";
                            if (lang === "VN") {
                              return isInactive ? "vé" : "vé còn hiệu lực";
                            }
                            return isInactive ? "ticket(s)" : "active ticket(s)";
                          })()}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                        {lang === "VN" ? "Tổng tiền" : "Total"}
                      </p>
                      <p className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
                        {currencyFormatter.format(booking.totalAmount)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600">chevron_right</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
