import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchAdminCharterBookings, fetchAssignedCharterBookings } from "../../../services/charterBookingService";
import {
  getAdminActionInfo,
  getPaginationWindow,
  getPriorityBookings,
  matchesSmartFilter,
} from "../../../utils/charterBookingActions";
import { getCharterBookingStatusInfo } from "../../../utils/charterBookingStatus";
import {
  formatDate,
  formatDuration,
  getPaymentStatusInfo,
  itemsPerPage,
  normalizeBooking,
  statusOptions,
} from "../../../utils/charterBookingAdmin";
import { shouldUseAssignedCharterApi, getCharterCapabilities, getDefaultCharterTab } from "../../../utils/charterBookingAccess";
import { isAdminUser } from "../../../utils/roleHelpers";
import { useCharterBookingListHub } from "../../../hooks/useCharterBookingListHub";

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
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setIsLoading(true);
      setErrorMsg("");
      const bookingData = useAssignedApi
        ? await fetchAssignedCharterBookings()
        : await fetchAdminCharterBookings();
      setBookings(Array.isArray(bookingData) ? bookingData.map(normalizeBooking) : []);
    } catch (error) {
      console.error("Lỗi tải charter booking:", error);
      if (!silent) {
        setErrorMsg(error.response?.data?.message || (lang === "VN"
          ? "Không thể tải danh sách yêu cầu thuê tàu."
          : "Unable to load charter booking requests."));
      }
    } finally {
      if (!silent) setIsLoading(false);
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

    const matchesStatus = statusFilter === "All" || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedBookings = sortField
    ? [...filteredBookings].sort((a, b) => {
      const timeA = new Date(a[sortField]).getTime() || 0;
      const timeB = new Date(b[sortField]).getTime() || 0;
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

  const priorityBookings = getPriorityBookings(bookings, 4);
  const showManagerColumn = isAdminUser(user);

  const resolveBookingTab = (booking) => {
    const caps = getCharterCapabilities(user, booking);
    const assignmentTab = getDefaultCharterTab(booking, caps);
    if (assignmentTab === "assignment") return "assignment";
    return getAdminActionInfo(booking, lang).tab;
  };

  const openAdminBooking = (booking, tab) => {
    navigate(`/admin/charter-bookings-management/${booking.id}`, { state: tab ? { tab } : undefined });
  };

  const getStatusInfo = (status, paymentStatus) => getCharterBookingStatusInfo(status, paymentStatus, lang);
  const tableColSpan = showManagerColumn ? 6 : 5;

  return (
    <div className="space-y-8 font-body pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Quản Lý Thuê Tàu" : "Charter Booking Management"}
          </h2>
          <p className="text-sm font-medium text-slate-400">
            {isAdminUser(user)
              ? (lang === "VN"
                ? "Xử lý yêu cầu thuê tàu, nhập tàu, chốt giá và cập nhật trạng thái booking."
                : "Handle charter requests, assign boats, submit quotes, and update booking status.")
              : (lang === "VN"
                ? "Chỉ hiển thị các chuyến thuê tàu được phân công cho bạn."
                : "Only shows charter bookings assigned to you.")}
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

      {priorityBookings.length > 0 && (
        <section className="rounded-4xl border border-amber-100 bg-linear-to-br from-amber-50/80 to-white p-5 shadow-sm dark:border-amber-500/20 dark:from-amber-500/5 dark:to-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Hàng đợi ưu tiên" : "Priority queue"}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === "VN" ? "Booking cần báo giá, thanh toán hoặc hoàn tiền ngay." : "Bookings needing quote, payment, or refund attention."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {priorityBookings.map((booking) => {
              const actionInfo = getAdminActionInfo(booking, lang);
              return (
                <button
                  key={`queue-${booking.id || booking.bookingCode}`}
                  type="button"
                  onClick={() => openAdminBooking(booking, resolveBookingTab(booking))}
                  className="rounded-3xl border border-white bg-white/90 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-headline font-black text-[#124757] dark:text-white">{booking.bookingCode}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-300">{booking.customerName}</p>
                    </div>
                    {actionInfo.urgent && (
                      <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#FFD100]" />
                    )}
                  </div>
                  <div className={`mt-3 rounded-2xl border px-3 py-2 ${actionInfo.classes}`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">{actionInfo.icon}</span>
                      <span className="text-[10px] font-headline font-black uppercase tracking-wider">{actionInfo.label}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

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
                <th className="py-4 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort("departureDate")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-[#124757] dark:hover:text-yellow-400"
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
                    className="inline-flex items-center gap-1 transition-colors hover:text-[#124757] dark:hover:text-yellow-400"
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
                  <td colSpan={tableColSpan} className="text-center py-14">
                    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : currentBookings.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    <span className="material-symbols-outlined text-4xl block mb-2">event_busy</span>
                    {lang === "VN" ? "Không có yêu cầu thuê tàu phù hợp." : "No charter requests match your filters."}
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
                        <p className="text-[10px] text-slate-400 mt-1">{booking.passengerCount} {lang === "VN" ? "khách" : "guests"} / {formatDuration(booking.durationValue, booking.rentalUnit, lang)}</p>
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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusInfo.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                          {statusInfo.label}
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">{getPaymentStatusInfo(booking.paymentStatus, lang).label}</p>
                      </td>
                      {showManagerColumn ? (
                        <td className="py-4 px-4">
                          {booking.assignedManagerName ? (
                            <p className="font-bold text-slate-800 dark:text-white">{booking.assignedManagerName}</p>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-headline font-black uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                              {lang === "VN" ? "Chưa gán" : "Unassigned"}
                            </span>
                          )}
                          {Array.isArray(booking.staffAssignments) && booking.staffAssignments.length > 0 ? (
                            <p className="mt-1 text-[10px] text-slate-400">
                              {booking.staffAssignments.length} {lang === "VN" ? "NV" : "staff"}
                            </p>
                          ) : null}
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
