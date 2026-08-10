import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getBookingsReport } from "../../../api/reportApi";
import { isAdminUser } from "../../../utils/roleHelpers";
import { CompositionBar } from "../../../components/charts/CompositionBar";
import { BookingTrendChart } from "../../../components/charts/BookingTrendChart";
import { categorical, otherColor, groupCountByDay } from "../../../utils/chartPalette";
import { getBookingStatusLabel, formatCurrency } from "../../../utils/bookingReport";

const TREND_DAYS = 14;

export const Dashboard = () => {
  const { lang, isDarkMode } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = isAdminUser(user);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Chỉ cần summary tổng hợp cho các thẻ/biểu đồ — danh sách booking chi tiết đã chuyển
  // sang trang Doanh thu (/admin/revenue), nên gọi API với page/pageSize tối thiểu.
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

  // Dữ liệu xu hướng booking theo ngày (14 ngày gần nhất) — gọi riêng vì cần lấy nhiều
  // bản ghi hơn để nhóm theo ngày thay vì chỉ đọc summary.
  const [trendPoints, setTrendPoints] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const loadTrend = useCallback(async () => {
    if (!canAccess) return;
    try {
      setTrendLoading(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - (TREND_DAYS - 1) * 86400000).toISOString().slice(0, 10);
      const result = await getBookingsReport({ page: 1, pageSize: 200, createdFrom: from, createdTo: todayStr });
      setTrendPoints(groupCountByDay(result?.items || [], "bookedAt", from, todayStr));
    } catch (error) {
      console.error("Lỗi tải xu hướng booking:", error);
      setTrendPoints([]);
    } finally {
      setTrendLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

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
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Tổng quan Booking" : "Booking Overview"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Theo dõi tổng quan booking, doanh thu và trạng thái thanh toán toàn hệ thống."
              : "Monitor bookings, revenue and payment status across the system."}
          </p>
        </div>
        <Link
          to="/admin/revenue"
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

    </div>
  );
};
