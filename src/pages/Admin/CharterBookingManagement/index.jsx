import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchAdminCharterBookings, fetchAdminCharterBookingDetail, fetchAssignedCharterBookings, fetchAssignedCharterBookingDetail } from "../../../services/charterBookingService";
import {
  getPaginationWindow,
  matchesSmartFilter,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import {
  formatDate,
  formatDuration,
  getPaymentStatusInfo,
  hasCompletedCharterRefund,
  extractCharterBookingList,
  itemsPerPage,
  matchesCharterStatusFilter,
  normalizeBooking,
  statusOptions,
} from "../../../utils/charterBookingAdmin";
import { shouldUseAssignedCharterApi, getCharterCapabilities, getDefaultCharterTab } from "../../../utils/charterBookingAccess";
import { isAdminUser } from "../../../utils/roleHelpers";
import { useCharterBookingListHub } from "../../../hooks/useCharterBookingListHub";
import { PageLoading } from "../../../components/PageLoading";

/** List DTO thường thiếu payments/refund — enrich vài booking Confirmed+Paid từ detail. */
const enrichListRefundStatuses = async (bookings, useAssignedApi) => {
  const fetchDetail = useAssignedApi ? fetchAssignedCharterBookingDetail : fetchAdminCharterBookingDetail;
  const targets = bookings.filter((booking) => {
    if (!booking?.id) return false;
    if (hasCompletedCharterRefund(booking)) return false;
    const status = String(booking.status || "");
    const payment = String(booking.paymentStatus || "").toLowerCase();
    return status === "Confirmed" && ["paid", "depositpaid"].includes(payment);
  });
  if (targets.length === 0) return bookings;

  const enrichedById = new Map();
  const batchSize = 4;
  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    const rows = await Promise.all(batch.map(async (booking) => {
      try {
        const detail = await fetchDetail(booking.id);
        return normalizeBooking(detail);
      } catch {
        return null;
      }
    }));
    rows.forEach((row) => {
      if (row?.id) enrichedById.set(String(row.id), row);
    });
  }

  if (enrichedById.size === 0) return bookings;
  return bookings.map((booking) => enrichedById.get(String(booking.id)) || booking);
};

export function CharterBookingManagement() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const useAssignedApi = shouldUseAssignedCharterApi(user);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg("");
      const bookingData = useAssignedApi
        ? await fetchAssignedCharterBookings()
        : await fetchAdminCharterBookings();
      const normalized = extractCharterBookingList(bookingData).map(normalizeBooking);
      // Chỉ set sau khi enrich xong — tránh hiện trạng thái nửa mùa khi load chậm.
      const enriched = await enrichListRefundStatuses(normalized, useAssignedApi);
      setBookings(enriched);
    } catch (error) {
      console.error("Lỗi tải charter booking:", error);
      if (!silent) {
        setErrorMsg(error.response?.data?.message || (lang === "VN"
          ? "Không thể tải danh sách yêu cầu thuê tàu."
          : "Unable to load booking requests."));
      }
    } finally {
      if (silent) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }, [lang, useAssignedApi]);

  const refreshListSilently = useCallback(() => {
    loadData({ silent: true });
  }, [loadData]);

  useCharterBookingListHub({
    enabled: isAuthenticated,
    listMode: useAssignedApi ? "assigned" : "admin",
    onRefresh: refreshListSilently,
  });

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

    const matchesStatus = matchesCharterStatusFilter(booking.status, statusFilter);
    return matchesSearch && matchesStatus;
  });

  const getSortableTime = (booking, field) => {
    if (field === "departureDate") {
      const datePart = String(booking.departureDate || "").slice(0, 10);
      const timePart = String(booking.startTime || "00:00:00").slice(0, 8);
      if (!datePart) return 0;
      // Prefer local date+time so same-day bookings still reorder by startTime.
      const combined = `${datePart}T${/^\d{2}:\d{2}$/.test(timePart) ? `${timePart}:00` : timePart}`;
      const time = new Date(combined).getTime();
      if (!Number.isNaN(time)) return time;
      const fallback = new Date(booking.departureDate).getTime();
      return Number.isNaN(fallback) ? 0 : fallback;
    }

    const time = new Date(booking[field]).getTime();
    return Number.isNaN(time) ? 0 : time;
  };

  const sortedBookings = sortField
    ? [...filteredBookings].sort((a, b) => {
      const timeA = getSortableTime(a, sortField);
      const timeB = getSortableTime(b, sortField);
      if (timeA === timeB) {
        return String(a.bookingCode || "").localeCompare(String(b.bookingCode || ""));
      }
      return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
    })
    : filteredBookings;

  const totalPages = Math.ceil(sortedBookings.length / itemsPerPage);
  const currentBookings = sortedBookings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return "unfold_more";
    return sortDirection === "asc" ? "arrow_upward" : "arrow_downward";
  };

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

  const showManagerColumn = isAdminUser(user);

  const resolveBookingTab = (booking) => {
    const caps = getCharterCapabilities(user, booking);
    return getDefaultCharterTab(booking, caps);
  };

  const openAdminBooking = (booking, tab) => {
    navigate(`/admin/charter-bookings-management/${booking.id}`, { state: tab ? { tab } : undefined });
  };

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);
  const tableColSpan = showManagerColumn ? 6 : 5;

  return (
    <div className="space-y-8 font-body pb-10">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Quản Lý Thuê Tàu" : "Request Booking Management"}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            {isAdminUser(user)
              ? (lang === "VN"
              ? "Xử lý yêu cầu thuê tàu, nhập tàu, chốt giá và cập nhật trạng thái booking."
                : "Handle booking requests, assign boats, submit quotes, and update booking status.")
              : (lang === "VN"
                ? "Chỉ hiển thị các chuyến thuê tàu được phân công cho bạn."
                : "Only shows booking requests assigned to you.")}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { key: "all", labelVn: "Tổng yêu cầu", labelEn: "Total Requests", value: isLoading ? "..." : stats.total, color: "text-[#124757] dark:text-yellow-400", bg: "bg-slate-500/10 dark:bg-slate-900" },
          { key: "needsAction", labelVn: "Cần xử lý", labelEn: "Needs Action", value: isLoading ? "..." : stats.needsAction, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
          { key: "waitingQuote", labelVn: "Chờ báo giá", labelEn: "Pending Quote", value: isLoading ? "..." : stats.pendingQuote, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
          { key: "toPay", labelVn: "Đã báo giá", labelEn: "Quoted", value: isLoading ? "..." : stats.quoted, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
          { key: "active", labelVn: "Đã xác nhận", labelEn: "Confirmed", value: isLoading ? "..." : stats.confirmed, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
        ].map((item) => (
          <div
            key={item.key}
            className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-800"
          >
            <div className="flex items-center gap-3.5">
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

        <div className="relative w-full lg:w-52">
          <button
            type="button"
            onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
            className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 text-left flex items-center justify-between gap-2 text-[#124757] dark:text-yellow-400 outline-none focus:ring-2 focus:ring-[#FFD100] transition-all shadow-sm hover:bg-white dark:hover:bg-slate-800"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-lg text-slate-400 shrink-0">filter_list</span>
              <span className="truncate text-[11px] font-headline font-black uppercase tracking-wider">
                {statusFilter === "All" ? (lang === "VN" ? "Tất cả" : "All") : getStatusInfo(statusFilter).label}
              </span>
            </span>
            <span className={`material-symbols-outlined text-lg text-slate-400 shrink-0 transition-transform ${isStatusDropdownOpen ? "rotate-180" : ""}`}>expand_more</span>
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-full min-w-56 rounded-3xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl p-2">
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

      <div className="relative bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        {isRefreshing ? (
          <PageLoading
            lang={lang}
            overlay
            message={lang === "VN" ? "Đang cập nhật..." : "Refreshing..."}
          />
        ) : null}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-250">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Booking" : "Booking"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Khách hàng" : "Customer"}</th>
                <th className="py-4 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort("departureDate")}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-[#124757] dark:hover:text-yellow-400 ${
                      sortField === "departureDate" ? "text-[#124757] dark:text-yellow-400" : ""
                    }`}
                    title={lang === "VN" ? "Sắp xếp theo ngày/giờ khởi hành" : "Sort by departure date/time"}
                  >
                    {lang === "VN" ? "Lịch thuê" : "Schedule"}
                    <span className="material-symbols-outlined text-sm">{getSortIcon("departureDate")}</span>
                  </button>
                </th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                {showManagerColumn ? (
                  <th className="py-4 px-4">{lang === "VN" ? "Quản lý phụ trách" : "Manager"}</th>
                ) : null}
                <th className="py-4 px-6 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort("createdAt")}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-[#124757] dark:hover:text-yellow-400 ${
                      sortField === "createdAt" ? "text-[#124757] dark:text-yellow-400" : ""
                    }`}
                    title={lang === "VN" ? "Sắp xếp theo ngày tạo" : "Sort by created date"}
                  >
                    {lang === "VN" ? "Ngày tạo" : "Created At"}
                    <span className="material-symbols-outlined text-sm">{getSortIcon("createdAt")}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={tableColSpan} className="py-16">
                    <PageLoading lang={lang} />
                  </td>
                </tr>
              ) : currentBookings.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
                    {lang === "VN" ? "Không có yêu cầu thuê tàu phù hợp." : "No booking requests match your filters."}
                  </td>
                </tr>
              ) : (
                currentBookings.map((booking) => {
                  const statusInfo = getStatusInfo(booking.status, booking.paymentStatus);
                  return (
                    <tr
                      key={booking.id || booking.bookingCode}
                      onClick={() => openAdminBooking(booking, resolveBookingTab(booking))}
                      className="cursor-pointer transition-colors hover:bg-[#124757]/5 dark:hover:bg-yellow-400/5 group"
                    >
                      <td className="py-4 px-6">
                        <p className="font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {booking.passengerCount} {lang === "VN" ? "khách" : "guests"}
                          {Number(booking.durationValue) > 0
                            ? ` / ${formatDuration(booking.durationValue, booking.rentalUnit, lang)}`
                            : (booking.rentalUnit
                              ? ` / ${booking.rentalUnit === "Hour" ? (lang === "VN" ? "Theo giờ" : "Hourly") : (lang === "VN" ? "Theo ngày" : "Daily")}`
                              : "")}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 dark:text-white">{booking.customerName}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{booking.phone}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <p className="font-headline font-black text-slate-800 dark:text-white">{formatDate(booking.departureDate)}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{String(booking.startTime).slice(0, 5)}</p>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-headline font-black uppercase tracking-wide ${statusInfo.text || "text-slate-600"}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                        <p className="mt-1 text-[9px] text-slate-400">
                          {statusInfo.subLabel || getPaymentStatusInfo(booking.paymentStatus, lang).label}
                        </p>
                      </td>
                      {showManagerColumn ? (
                        <td className="py-4 px-4">
                          {booking.assignedManagerName ? (
                            <p className="font-bold text-slate-800 dark:text-white">{booking.assignedManagerName}</p>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              {lang === "VN" ? "Chưa gán" : "Unassigned"}
                            </span>
                          )}
                      </td>
                      ) : null}
                      <td className="py-4 px-6 text-right">
                        <p className="font-bold text-slate-800 dark:text-white">{formatDate(booking.createdAt)}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{booking.createdAt ? new Date(booking.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
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
    </div>
  );
}

export { AdminCharterBookingRefund } from "./Refund";
export { AdminCharterBookingDetail } from "./Detail";
