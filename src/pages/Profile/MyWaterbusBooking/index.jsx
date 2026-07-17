import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchMyBookings } from "../../../services/bookingService";

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

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
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
          </div>
        </div>
      </div>
    ))}
  </div>
);

export function MyWaterbusBookingList() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useSelector((state) => state.auth);

  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const highlightBookingId = location.state?.highlightBookingId || "";

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
      setBookings(Array.isArray(data) ? data.map(normalizeBooking) : []);
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

  const statusOptions = useMemo(() => {
    const distinct = [...new Set(bookings.map((b) => b.status).filter(Boolean))];
    return ["All", ...distinct];
  }, [bookings]);

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch = booking.bookingCode.toLowerCase().includes(searchValue);
    const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [bookings, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pendingPayment: bookings.filter((b) => String(b.status).toLowerCase() === "pendingpayment").length,
    confirmed: bookings.filter((b) => String(b.status).toLowerCase() === "confirmed").length,
  }), [bookings]);

  const hasFilters = searchTerm || statusFilter !== "All";
  const emptyMessage = bookings.length === 0
    ? (lang === "VN" ? "Bạn chưa có vé Waterbus nào." : "You have no Waterbus bookings yet.")
    : (lang === "VN" ? "Không có vé phù hợp với bộ lọc hiện tại." : "No bookings match your current filters.");

  return (
    <div className="min-h-screen bg-slate-50 py-30 px-4 font-body transition-colors dark:bg-slate-900 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-xl dark:border-slate-700/50 dark:bg-slate-800">
          <div className="bg-linear-to-br from-[#124757] via-[#165a6d] to-[#0e3540] px-6 py-8 text-white md:px-8 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-[10px] font-headline font-black uppercase tracking-[0.2em] text-white/60">
                  My Waterbus Booking
                </p>
                <h1 className="mt-1 font-headline text-2xl font-black md:text-3xl">
                  {lang === "VN" ? "Vé Waterbus của tôi" : "My Waterbus Bookings"}
                </h1>
                <p className="mt-2 max-w-lg text-sm font-medium text-white/75">
                  {lang === "VN"
                    ? "Xem lại lịch sử đặt vé, trạng thái và tổng tiền của các chuyến đã đặt."
                    : "Review your booking history, status, and total amount for each trip."}
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
                  onClick={() => navigate("/waterbus-booking")}
                  className="rounded-xl bg-[#FFD100] px-5 py-3 font-headline text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-black/10 transition hover:scale-[1.02] active:scale-95"
                >
                  {lang === "VN" ? "Đặt vé mới" : "New booking"}
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
                    {status === "All" ? (lang === "VN" ? "Tất cả trạng thái" : "All statuses") : status}
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

        <section className="grid grid-cols-3 gap-3">
          {[
            { key: "total", icon: "folder_open", label: lang === "VN" ? "Tổng số vé" : "Total bookings", value: stats.total, tone: "text-[#124757] dark:text-yellow-400", bg: "bg-slate-50 dark:bg-slate-900" },
            { key: "pending", icon: "hourglass_top", label: lang === "VN" ? "Chờ thanh toán" : "Pending payment", value: stats.pendingPayment, tone: "text-amber-600 dark:text-amber-300", bg: "bg-amber-50 dark:bg-amber-500/10" },
            { key: "confirmed", icon: "verified", label: lang === "VN" ? "Đã xác nhận" : "Confirmed", value: stats.confirmed, tone: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          ].map((item) => (
            <div key={item.key} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
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
              <span className="material-symbols-outlined mb-3 block text-5xl text-slate-300 dark:text-slate-600">directions_boat</span>
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
                  onClick={() => navigate("/waterbus-booking")}
                  className="mt-4 rounded-xl bg-[#FFD100] px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900"
                >
                  {lang === "VN" ? "Đặt vé đầu tiên" : "Book your first trip"}
                </button>
              )}
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <article
                key={booking.id || booking.bookingCode}
                className={`group relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all dark:bg-slate-800 ${
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
                        {booking.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400">
                      {lang === "VN" ? "Đặt lúc" : "Booked at"}: {formatDateTime(booking.bookedAt)} · {booking.itemCount} {lang === "VN" ? "vé còn hiệu lực" : "active ticket(s)"}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
                      {lang === "VN" ? "Tổng tiền" : "Total"}
                    </p>
                    <p className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
                      {currencyFormatter.format(booking.totalAmount)}
                    </p>
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
