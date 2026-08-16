import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getBookingsReport, getRevenueReport } from "../../../api/reportApi";
import { fetchAllStations } from "../../../services/stationService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { FormSelect } from "../../../components/FormSelect";
import { CompositionBar } from "../../../components/charts/CompositionBar";
import { RevenueTrendChart } from "../../../components/charts/RevenueTrendChart";
import { categorical, otherColor } from "../../../utils/chartPalette";
import { getServiceTypeColor, getPaymentMethodColor } from "../../../utils/revenueReport";
import {
  serviceTypeOptions,
  paymentMethodOptions,
  getBookingStatusLabel,
  getServiceTypeLabel,
  getPaymentMethodLabel,
  formatCurrency,
} from "../../../utils/bookingReport";

export const Dashboard = () => {
  const { lang, isDarkMode } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = isAdminUser(user);

  // Chỉ cần summary tổng hợp cho 2 khối "Phân bổ trạng thái" / "Kênh bán" — danh sách booking
  // chi tiết đã chuyển sang trang Tổng hợp Booking (/admin/booking-summary), nên gọi API với page/pageSize tối thiểu.
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadSummary = useCallback(async () => {
    if (!canAccess) return;
    try {
      setIsLoading(true);
      setErrorMsg("");
      const result = await getBookingsReport({ page: 1, pageSize: 1 });
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
  }, [canAccess, lang]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const summary = useMemo(() => data?.summary || {}, [data]);

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

  // ===== Tổng quan doanh thu (GET /reports/revenue) =====
  const [stations, setStations] = useState([]);
  const [revenueFilters, setRevenueFilters] = useState({
    fromDate: "",
    toDate: "",
    serviceType: "All",
    paymentMethod: "All",
    fromStationId: "All",
    toStationId: "All",
  });
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueErrorMsg, setRevenueErrorMsg] = useState("");

  useEffect(() => {
    if (!canAccess) return;
    fetchAllStations().then(setStations).catch((error) => {
      console.error("Lỗi tải danh sách nhà ga cho bộ lọc doanh thu:", error);
    });
  }, [canAccess]);

  const loadRevenue = useCallback(async () => {
    if (!canAccess) return;
    try {
      setRevenueLoading(true);
      setRevenueErrorMsg("");
      const params = {};
      if (revenueFilters.fromDate) params.fromDate = revenueFilters.fromDate;
      if (revenueFilters.toDate) params.toDate = revenueFilters.toDate;
      if (revenueFilters.serviceType !== "All") params.serviceType = revenueFilters.serviceType;
      if (revenueFilters.paymentMethod !== "All") params.paymentMethod = revenueFilters.paymentMethod;
      if (revenueFilters.fromStationId !== "All") params.fromStationId = revenueFilters.fromStationId;
      if (revenueFilters.toStationId !== "All") params.toStationId = revenueFilters.toStationId;

      const result = await getRevenueReport(params);
      setRevenueData(result);
    } catch (error) {
      console.error("Lỗi tải tổng quan doanh thu:", error);
      setRevenueErrorMsg(
        lang === "VN"
          ? "Không thể tải dữ liệu tổng quan doanh thu."
          : "Failed to load the revenue overview."
      );
    } finally {
      setRevenueLoading(false);
    }
  }, [canAccess, revenueFilters, lang]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  const updateRevenueFilter = (key, value) => {
    setRevenueFilters((prev) => ({ ...prev, [key]: value }));
  };

  const stationOptions = useMemo(() => ([
    { value: "All", label: lang === "VN" ? "Tất cả bến" : "All Stations" },
    ...stations.map((s) => ({ value: s.stationId, label: s.stationName })),
  ]), [stations, lang]);

  const serviceTypeRevenueSegments = useMemo(() => (
    (revenueData?.byServiceType || []).map((item) => ({
      key: item.key,
      label: getServiceTypeLabel(item.key, lang),
      value: item.netRevenue || 0,
      color: getServiceTypeColor(item.key),
    }))
  ), [revenueData, lang]);

  const paymentMethodRevenueSegments = useMemo(() => (
    (revenueData?.byPaymentMethod || []).map((item) => ({
      key: item.key,
      label: getPaymentMethodLabel(item.key, lang),
      value: item.netRevenue || 0,
      color: getPaymentMethodColor(item.key),
    }))
  ), [revenueData, lang]);

  // Thẻ thống kê đầu trang: tổng doanh thu (ròng), đã hoàn tiền, số booking, số vé.
  const revenueStatCards = useMemo(() => ([
    { key: "net", labelVn: "Tổng doanh thu", labelEn: "Total Revenue", value: formatCurrency(revenueData?.netRevenue), color: "text-[#124757] dark:text-yellow-400" },
    { key: "refund", labelVn: "Đã hoàn tiền", labelEn: "Refunded", value: formatCurrency(revenueData?.refundAmount), color: "text-rose-500 dark:text-rose-400" },
    { key: "bookings", labelVn: "Số booking", labelEn: "Bookings", value: revenueData?.bookingCount ?? 0, color: "text-sky-600 dark:text-sky-400" },
    { key: "tickets", labelVn: "Số vé", labelEn: "Tickets", value: revenueData?.ticketCount ?? 0, color: "text-indigo-600 dark:text-indigo-400" },
  ]), [revenueData]);

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
    <div className="space-y-4 font-body pb-10 px-1.5 md:px-4 animate-fade-in">

      {/* HEADER */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Bảng điều khiển doanh thu" : "Sales Dashboard"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Theo dõi tổng quan booking, doanh thu và trạng thái thanh toán toàn hệ thống."
              : "Monitor bookings, revenue and payment status across the system."}
          </p>
        </div>
        <Link
          to="/admin/booking-summary"
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-[#FFD100] dark:bg-yellow-400 px-4 py-2.5 text-xs font-headline font-black uppercase tracking-wider text-slate-900 hover:opacity-90 transition-opacity shrink-0"
        >
          {lang === "VN" ? "Xem danh sách chi tiết" : "View detailed list"}
        </Link>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}
      {revenueErrorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {revenueErrorMsg}
        </div>
      )}

      {/* ===== TRÊN: BỘ LỌC + THẺ TỔNG DOANH THU / HOÀN TIỀN / BOOKING / VÉ ===== */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
            {lang === "VN" ? "Tổng quan doanh thu" : "Revenue Overview"}
          </h3>
          {revenueData?.from && revenueData?.to && (
            <span className="text-[11px] font-bold text-slate-400">
              {new Date(revenueData.from).toLocaleDateString("vi-VN")} — {new Date(revenueData.to).toLocaleDateString("vi-VN")}
            </span>
          )}
        </div>

        {/* Bộ lọc doanh thu */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Từ ngày" : "From Date"}</span>
            <input
              type="date"
              value={revenueFilters.fromDate}
              onChange={(e) => updateRevenueFilter("fromDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Đến ngày" : "To Date"}</span>
            <input
              type="date"
              value={revenueFilters.toDate}
              onChange={(e) => updateRevenueFilter("toDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Dịch vụ" : "Service Type"}</span>
            <FormSelect
              value={revenueFilters.serviceType}
              onChange={(v) => updateRevenueFilter("serviceType", v)}
              options={serviceTypeOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Phương thức TT" : "Payment Method"}</span>
            <FormSelect
              value={revenueFilters.paymentMethod}
              onChange={(v) => updateRevenueFilter("paymentMethod", v)}
              options={paymentMethodOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Bến đi" : "From Station"}</span>
            <FormSelect
              value={revenueFilters.fromStationId}
              onChange={(v) => updateRevenueFilter("fromStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm bến..." : "Search station..."}
              emptyLabel={lang === "VN" ? "Không có kết quả" : "No results"}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">{lang === "VN" ? "Bến đến" : "To Station"}</span>
            <FormSelect
              value={revenueFilters.toStationId}
              onChange={(v) => updateRevenueFilter("toStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm bến..." : "Search station..."}
              emptyLabel={lang === "VN" ? "Không có kết quả" : "No results"}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>

        {/* Thẻ: tổng doanh thu, đã hoàn tiền, số booking, số vé */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {revenueStatCards.map((item) => (
            <div key={item.key} className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{lang === "VN" ? item.labelVn : item.labelEn}</p>
              <h4 className={`text-base font-black font-headline mt-0.5 ${item.color}`}>
                {revenueLoading ? "..." : item.value}
              </h4>
            </div>
          ))}
        </div>
      </div>

      {/* ===== DƯỚI: BIỂU ĐỒ DOANH THU THEO NGÀY (TRÁI) + CÁC KHỐI PHÂN BỔ (PHẢI) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Trái: biểu đồ doanh thu theo ngày */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
          <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Doanh thu theo ngày" : "Revenue by day"}
          </h3>
          <RevenueTrendChart points={revenueData?.daily || []} lang={lang} isDarkMode={isDarkMode} isLoading={revenueLoading} />
        </div>

        {/* Phải: phân bổ trạng thái, kênh bán, doanh thu theo dịch vụ, doanh thu theo phương thức TT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-3">
              {lang === "VN" ? "Phân bổ trạng thái booking" : "Booking status breakdown"}
            </h3>
            {isLoading ? (
              <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ) : (
              <CompositionBar segments={statusSegments} isDarkMode={isDarkMode} />
            )}
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-3">
              {lang === "VN" ? "Kênh bán" : "Sales channel"}
            </h3>
            {isLoading ? (
              <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ) : (
              <CompositionBar segments={channelSegments} isDarkMode={isDarkMode} />
            )}
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-3">
              {lang === "VN" ? "Doanh thu theo dịch vụ" : "Revenue by service"}
            </h3>
            {revenueLoading ? (
              <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ) : (
              <CompositionBar segments={serviceTypeRevenueSegments} isDarkMode={isDarkMode} valueFormatter={formatCurrency} />
            )}
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
            <h3 className="text-[11px] font-headline font-black uppercase text-slate-400 tracking-wider mb-3">
              {lang === "VN" ? "Doanh thu theo phương thức TT" : "Revenue by payment method"}
            </h3>
            {revenueLoading ? (
              <div className="h-6 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
            ) : (
              <CompositionBar segments={paymentMethodRevenueSegments} isDarkMode={isDarkMode} valueFormatter={formatCurrency} />
            )}
          </div>
        </div>
      </div>

    </div>
  );
};