import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getBookingsReport } from "../../../api/reportApi";
import { isAdminUser } from "../../../utils/roleHelpers";
import { FormSelect } from "../../../components/FormSelect";
import { CompositionBar } from "../../../components/charts/CompositionBar";
import { BookingTrendChart } from "../../../components/charts/BookingTrendChart";
import { categorical, otherColor, groupCountByDay } from "../../../utils/chartPalette";
import {
  bookingStatusOptions,
  paymentStatusOptions,
  serviceTypeOptions,
  paymentMethodOptions,
  getBookingStatusLabel,
  getPaymentStatusLabel,
  getBookingStatusClass,
  getPaymentStatusClass,
  formatCurrency,
  formatDateTime,
} from "../../../utils/bookingReport";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const TREND_DAYS = 14;

export const Dashboard = () => {
  const { lang, isDarkMode } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = isAdminUser(user);

  const [keywordInput, setKeywordInput] = useState("");
  const [filters, setFilters] = useState({
    keyword: "",
    bookingStatus: "All",
    paymentStatus: "All",
    serviceType: "All",
    paymentMethod: "All",
    createdFrom: "",
    createdTo: "",
    departureFrom: "",
    departureTo: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Debounce ô tìm kiếm để tránh gọi API liên tục khi đang gõ.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.keyword === keywordInput.trim() ? prev : { ...prev, keyword: keywordInput.trim() }));
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const loadReport = useCallback(async () => {
    if (!canAccess) return;
    try {
      setIsLoading(true);
      setErrorMsg("");
      const params = { page, pageSize };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.bookingStatus !== "All") params.bookingStatus = filters.bookingStatus;
      if (filters.paymentStatus !== "All") params.paymentStatus = filters.paymentStatus;
      if (filters.serviceType !== "All") params.serviceType = filters.serviceType;
      if (filters.paymentMethod !== "All") params.paymentMethod = filters.paymentMethod;
      if (filters.createdFrom) params.createdFrom = filters.createdFrom;
      if (filters.createdTo) params.createdTo = filters.createdTo;
      if (filters.departureFrom) params.departureFrom = filters.departureFrom;
      if (filters.departureTo) params.departureTo = filters.departureTo;

      const result = await getBookingsReport(params);
      setData(result);
    } catch (error) {
      console.error("Lỗi tải báo cáo booking:", error);
      setErrorMsg(
        lang === "VN"
          ? "Không thể tải dữ liệu báo cáo booking."
          : "Failed to load the booking report."
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, page, pageSize, filters]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Dữ liệu xu hướng booking theo ngày — gọi riêng vì cần lấy nhiều bản ghi hơn (không theo trang
  // đang xem) và luôn có khoảng ngày mặc định (14 ngày gần nhất) khi user chưa chọn createdFrom/To.
  const [trendPoints, setTrendPoints] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const loadTrend = useCallback(async () => {
    if (!canAccess) return;
    try {
      setTrendLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const defaultFrom = new Date(Date.now() - (TREND_DAYS - 1) * 86400000).toISOString().slice(0, 10);
      const from = filters.createdFrom || defaultFrom;
      const to = filters.createdTo || todayStr;

      const params = { page: 1, pageSize: 200, createdFrom: from, createdTo: to };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.bookingStatus !== "All") params.bookingStatus = filters.bookingStatus;
      if (filters.paymentStatus !== "All") params.paymentStatus = filters.paymentStatus;
      if (filters.serviceType !== "All") params.serviceType = filters.serviceType;
      if (filters.paymentMethod !== "All") params.paymentMethod = filters.paymentMethod;

      const result = await getBookingsReport(params);
      setTrendPoints(groupCountByDay(result?.items || [], "bookedAt", from, to));
    } catch (error) {
      console.error("Lỗi tải xu hướng booking:", error);
      setTrendPoints([]);
    } finally {
      setTrendLoading(false);
    }
  }, [canAccess, filters]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const summary = useMemo(() => data?.summary || {}, [data]);
  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const statCards = useMemo(() => ([
    { key: "total", labelVn: "Tổng booking", labelEn: "Total Bookings", value: summary.totalBookings, color: "text-[#124757] dark:text-yellow-400" },
    { key: "pending", labelVn: "Chờ thanh toán", labelEn: "Pending Payment", value: summary.pendingPaymentCount, color: "text-amber-600 dark:text-amber-400" },
    { key: "confirmed", labelVn: "Đã xác nhận", labelEn: "Confirmed", value: summary.confirmedCount, color: "text-sky-600 dark:text-sky-400" },
    { key: "completed", labelVn: "Hoàn tất", labelEn: "Completed", value: summary.completedCount, color: "text-emerald-600 dark:text-emerald-400" },
    { key: "cancelled", labelVn: "Đã hủy", labelEn: "Cancelled", value: summary.cancelledCount, color: "text-slate-500 dark:text-slate-400" },
    { key: "expired", labelVn: "Hết hạn", labelEn: "Expired", value: summary.expiredCount, color: "text-rose-500 dark:text-rose-400" },
    { key: "counter", labelVn: "Bán tại quầy", labelEn: "Counter Sales", value: summary.counterBookingCount, color: "text-indigo-600 dark:text-indigo-400" },
    { key: "online", labelVn: "Bán trực tuyến", labelEn: "Online Sales", value: summary.onlineBookingCount, color: "text-cyan-600 dark:text-cyan-400" },
  ]), [summary]);

  // Phân bổ trạng thái booking — 5 trạng thái chính theo màu categorical cố định + "Khác" gộp phần dư.
  const statusSegments = useMemo(() => {
    const known = [
      { key: "pending", label: getBookingStatusLabel("PendingPayment", lang), value: summary.pendingPaymentCount || 0, color: categorical[3] },
      { key: "confirmed", label: getBookingStatusLabel("Confirmed", lang), value: summary.confirmedCount || 0, color: categorical[0] },
      { key: "completed", label: getBookingStatusLabel("Completed", lang), value: summary.completedCount || 0, color: categorical[2] },
      { key: "cancelled", label: getBookingStatusLabel("Cancelled", lang), value: summary.cancelledCount || 0, color: categorical[4] },
      { key: "expired", label: getBookingStatusLabel("Expired", lang), value: summary.expiredCount || 0, color: categorical[1] },
    ];
    const knownSum = known.reduce((sum, s) => sum + s.value, 0);
    const otherCount = Math.max(0, (summary.totalBookings || 0) - knownSum);
    if (otherCount > 0) {
      known.push({ key: "other", label: lang === "VN" ? "Khác" : "Other", value: otherCount, color: otherColor });
    }
    return known;
  }, [summary, lang]);

  // Kênh bán: quầy (counter) vs trực tuyến (online).
  const channelSegments = useMemo(() => ([
    { key: "counter", label: lang === "VN" ? "Bán tại quầy" : "Counter", value: summary.counterBookingCount || 0, color: categorical[0] },
    { key: "online", label: lang === "VN" ? "Bán trực tuyến" : "Online", value: summary.onlineBookingCount || 0, color: categorical[1] },
  ]), [summary, lang]);

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <span className="material-symbols-outlined text-4xl text-slate-300">lock</span>
        <p className="text-sm font-bold text-slate-400">
          {lang === "VN" ? "Bạn không có quyền truy cập trang này." : "You do not have permission to access this page."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body pb-10 px-1.5 md:px-4 animate-fade-in">

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
          {lang === "VN" ? "Tổng hợp & Quản lý Booking" : "Booking Reports"}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {lang === "VN"
            ? "Theo dõi tổng quan booking, doanh thu và trạng thái thanh toán toàn hệ thống."
            : "Monitor bookings, revenue and payment status across the system."}
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      {/* THẺ THỐNG KÊ SỐ LƯỢNG */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((item) => (
          <div key={item.key} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === "VN" ? item.labelVn : item.labelEn}</p>
            <h3 className={`text-lg font-black font-headline mt-0.5 ${item.color}`}>
              {isLoading ? "..." : (item.value ?? 0)}
            </h3>
          </div>
        ))}
      </div>

      {/* BIỂU ĐỒ: PHÂN BỔ TRẠNG THÁI & KÊNH BÁN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-4">
            {lang === "VN" ? "Phân bổ trạng thái booking" : "Booking status breakdown"}
          </h3>
          {isLoading ? (
            <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : (
            <CompositionBar segments={statusSegments} isDarkMode={isDarkMode} />
          )}
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-4">
            {lang === "VN" ? "Kênh bán: Quầy vs Trực tuyến" : "Sales channel: Counter vs Online"}
          </h3>
          {isLoading ? (
            <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
          ) : (
            <CompositionBar segments={channelSegments} isDarkMode={isDarkMode} />
          )}
        </div>
      </div>

      {/* BIỂU ĐỒ: DOANH THU & XU HƯỚNG THEO NGÀY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm lg:col-span-1">
          <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-4">
            {lang === "VN" ? "Doanh thu: Đã thu / Còn lại" : "Revenue: Paid / Remaining"}
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Tổng giá trị" : "Total Amount"}</p>
              <p className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">
                {isLoading ? "..." : formatCurrency(summary.totalAmount)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Đã thu" : "Paid"}</p>
                <p className="text-base font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {isLoading ? "..." : formatCurrency(summary.paidAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Còn lại" : "Remaining"}</p>
                <p className="text-base font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">
                  {isLoading ? "..." : formatCurrency(summary.remainingAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm lg:col-span-2">
          <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Xu hướng booking theo ngày" : "Booking trend by day"}
          </h3>
          <p className="text-[10px] text-slate-400 mb-2">
            {lang === "VN"
              ? "Theo ngày đặt; mặc định 14 ngày gần nhất nếu chưa chọn khoảng ngày."
              : "By booking date; defaults to the last 14 days when no date range is set."}
          </p>
          <BookingTrendChart points={trendPoints} lang={lang} isDarkMode={isDarkMode} isLoading={trendLoading} />
        </div>
      </div>

      {/* BỘ LỌC */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder={lang === "VN" ? "Tìm theo mã booking, tên/SĐT/email khách..." : "Search booking code, contact name/phone/email..."}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Trạng thái booking" : "Booking Status"}</span>
            <FormSelect
              value={filters.bookingStatus}
              onChange={(v) => updateFilter("bookingStatus", v)}
              options={bookingStatusOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Trạng thái thanh toán" : "Payment Status"}</span>
            <FormSelect
              value={filters.paymentStatus}
              onChange={(v) => updateFilter("paymentStatus", v)}
              options={paymentStatusOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Dịch vụ" : "Service Type"}</span>
            <FormSelect
              value={filters.serviceType}
              onChange={(v) => updateFilter("serviceType", v)}
              options={serviceTypeOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Phương thức TT" : "Payment Method"}</span>
            <FormSelect
              value={filters.paymentMethod}
              onChange={(v) => updateFilter("paymentMethod", v)}
              options={paymentMethodOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Đặt từ ngày" : "Created From"}</span>
            <input
              type="date"
              value={filters.createdFrom}
              onChange={(e) => updateFilter("createdFrom", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Đặt đến ngày" : "Created To"}</span>
            <input
              type="date"
              value={filters.createdTo}
              onChange={(e) => updateFilter("createdTo", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Khởi hành từ" : "Departure From"}</span>
            <input
              type="date"
              value={filters.departureFrom}
              onChange={(e) => updateFilter("departureFrom", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Khởi hành đến" : "Departure To"}</span>
            <input
              type="date"
              value={filters.departureTo}
              onChange={(e) => updateFilter("departureTo", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* BẢNG DANH SÁCH BOOKING */}
      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-275">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Booking" : "Booking"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Khách hàng" : "Customer"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Dịch vụ / Tuyến" : "Service / Route"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Khởi hành" : "Departure"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-4 text-right">{lang === "VN" ? "Tổng tiền" : "Total"}</th>
                <th className="py-4 px-4 text-right">{lang === "VN" ? "Đã thu / Còn lại" : "Paid / Remaining"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    <span className="material-symbols-outlined text-4xl block mb-2">receipt_long</span>
                    {lang === "VN" ? "Không có booking nào phù hợp bộ lọc." : "No bookings found matching filters."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.bookingId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-4 px-6">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-slate-800 dark:text-white text-xs tracking-tight">{item.bookingCode}</h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{formatDateTime(item.bookedAt)}</span>
                        {item.soldByStaffName && (
                          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold block">
                            {lang === "VN" ? "Quầy: " : "Counter: "}{item.soldByStaffName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.contactName || "--"}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{item.contactPhone || "--"}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-45">{item.contactEmail || "--"}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.serviceType}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-40">{item.routeName || item.tripCode || "--"}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatDateTime(item.departureAt)}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-black uppercase tracking-wide ${getBookingStatusClass(item.bookingStatus)}`}>
                          {getBookingStatusLabel(item.bookingStatus, lang)}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-headline font-black uppercase tracking-wide ${getPaymentStatusClass(item.paymentStatus)}`}>
                          {getPaymentStatusLabel(item.paymentStatus, lang)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-xs font-black text-slate-800 dark:text-white">{formatCurrency(item.totalAmount)}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.paidAmount)}</p>
                      <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400">{formatCurrency(item.remainingAmount)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHÂN TRANG */}
      <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">
            {lang === "VN"
              ? `Hiển thị ${startIndex}-${endIndex} trong số ${totalCount} kết quả`
              : `Showing ${startIndex}-${endIndex} of ${totalCount} entries`}
          </span>
          <FormSelect
            value={pageSize}
            onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            fullWidth={false}
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: `${n}/${lang === "VN" ? "trang" : "page"}` }))}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer dark:text-white"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${page === 1
              ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
              : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
              }`}
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <span className="text-xs font-black font-headline text-[#124757] dark:text-yellow-400 px-2">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={page >= totalPages}
            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${page >= totalPages
              ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
              : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
              }`}
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </div>

    </div>
  );
};
