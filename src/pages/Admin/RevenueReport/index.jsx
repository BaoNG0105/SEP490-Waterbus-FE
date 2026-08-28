import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import {
  getBookingsReport,
  getRevenueReport,
  getRevenueToday,
  getRevenueTodayHourly,
  getBookingsByStatus,
  getTopRoutes,
  getTopCustomersReport,
  getWaterbusStationRevenue,
} from "../../../api/reportApi";
import { fetchAllStations } from "../../../services/stationService";
import { hasRole } from "../../../utils/roleHelpers";
import { FormSelect } from "../../../components/FormSelect";
import { Sparkline } from "../../../components/charts/Sparkline";
import { RevenueDonutChart } from "../../../components/charts/RevenueDonutChart";
import { RevenueVsPrevChart } from "../../../components/charts/RevenueVsPrevChart";
import {
  serviceTypeOptions,
  paymentMethodOptions,
  getBookingStatusLabel,
  getServiceTypeLabel,
  getPaymentStatusLabel,
  getBookingStatusClass,
  getPaymentStatusClass,
  getPaymentMethodLabel,
  formatCurrency,
  formatDateTime,
} from "../../../utils/bookingReport";
import {
  formatCompactCurrency,
  getServiceTypeColor,
  getPaymentMethodColor,
  normalizeSegments,
} from "../../../utils/revenueReport";

// ==================== HELPERS ====================

const stripAllSentinels = (params) => {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "string" && v.trim().toLowerCase() === "all") return;
    out[k] = v;
  });
  return out;
};

const bookingStatusBarColors = {
  PendingPayment: "bg-amber-400 dark:bg-amber-500",
  Confirmed: "bg-sky-500 dark:bg-sky-400",
  Completed: "bg-emerald-500 dark:bg-emerald-400",
  Cancelled: "bg-rose-400 dark:bg-rose-500",
  Expired: "bg-slate-400 dark:bg-slate-500",
  Refunded: "bg-violet-400 dark:bg-violet-500",
  PartiallyRefunded: "bg-violet-400 dark:bg-violet-500",
};
const barColorForStatus = (status) =>
  bookingStatusBarColors[status] || "bg-[#124757] dark:bg-yellow-400";

const numFmt = new Intl.NumberFormat("vi-VN");
const formatNumber = (v) => numFmt.format(Math.round(Number(v || 0)));

const toLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeReportDateKey = (value) => {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const getVietnamHour = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return -1;
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).find((part) => part.type === "hour")?.value;
  return Number(hour);
};

const getVietnamDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
};

// ==================== MAIN COMPONENT ====================

export const RevenueReport = () => {
  const { lang, isDarkMode } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = hasRole(user, "ADMIN", "MANAGER");

  const today = useMemo(() => toLocalDateKey(), []);
  const firstOfMonth = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);

  // ===== Filters =====
  const [filters, setFilters] = useState({
    fromDate: firstOfMonth,
    toDate: today,
    serviceType: "All",
    paymentMethod: "All",
    fromStationId: "All",
    toStationId: "All",
  });

  // ===== Stations =====
  const [stations, setStations] = useState([]);
  useEffect(() => {
    if (!canAccess) return;
    fetchAllStations().then(setStations).catch(() => {});
  }, [canAccess]);

  // ===== Detail panel =====
  const [detailTab, setDetailTab] = useState("recent");

  const stationOptions = useMemo(() => [
    { value: "All", label: lang === "VN" ? "Tất cả bến" : "All Stations" },
    ...stations.map((s) => ({ value: s.stationId, label: s.stationName })),
  ], [stations, lang]);

  const updateFilter = (key, value) => setFilters((p) => ({ ...p, [key]: value }));

  // ===== Data: Revenue (current period) =====
  const [revenueCurrent, setRevenueCurrent] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState("");

  // ===== Data: Revenue today =====
  const [revenueToday, setRevenueToday] = useState(null);
  const [revenueTodayLoading, setRevenueTodayLoading] = useState(true);
  const [todayHourly, setTodayHourly] = useState(() => Array.from({ length: 24 }, () => ({ revenue: 0, bookings: 0 })));

  // ===== Data: Recent bookings =====
  const [recentBookings, setRecentBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [recentBookingsError, setRecentBookingsError] = useState("");

  // ===== Data: Top customers (group from bookings) =====
  const [topCustomers, setTopCustomers] = useState([]);
  const [topCustomersLoading, setTopCustomersLoading] = useState(true);
  const [topCustomersError, setTopCustomersError] = useState("");

  // ===== Data: Waterbus stations =====
  const [waterbus, setWaterbus] = useState(null);
  const [waterbusLoading, setWaterbusLoading] = useState(true);

  // ===== LOADERS =====

  const loadRevenue = useCallback(async () => {
    if (!canAccess) return;
    try {
      setRevenueLoading(true);
      setRevenueError("");
      const baseParams = stripAllSentinels({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        serviceType: filters.serviceType,
        paymentMethod: filters.paymentMethod,
        fromStationId: filters.fromStationId,
        toStationId: filters.toStationId,
      });
      const res = await getRevenueReport(baseParams);
      setRevenueCurrent(res);
    } catch (e) {
      console.error("[RevenueReport] revenue error:", e);
      setRevenueError(lang === "VN" ? "Không thể tải dữ liệu doanh thu." : "Failed to load revenue data.");
    } finally {
      setRevenueLoading(false);
    }
  }, [canAccess, filters]);

  const loadRevenueToday = useCallback(async () => {
    if (!canAccess) return;
    try {
      setRevenueTodayLoading(true);
      const [res, hourlyResult, firstPage] = await Promise.all([
        getRevenueToday(),
        // Endpoint chính thức do BE cung cấp. Lỗi/404 vẫn không làm hỏng fallback bên dưới.
        getRevenueTodayHourly().catch(() => null),
        // /reports/bookings nhận lọc ngày (yyyy-MM-dd), không nhận ISO datetime.
        getBookingsReport({ createdFrom: today, createdTo: today, page: 1, pageSize: 100 }),
      ]);
      setRevenueToday(res);

      const hourlyRows = Array.isArray(hourlyResult)
        ? hourlyResult
        : (hourlyResult?.hours || hourlyResult?.items || []);
      if (hourlyRows.length > 0) {
        const hourly = Array.from({ length: 24 }, () => ({ revenue: 0, bookings: 0 }));
        hourlyRows.forEach((row) => {
          const hour = Number(row?.hour ?? row?.hourOfDay);
          if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
          hourly[hour] = {
            revenue: Math.max(0, Number(row?.netRevenue ?? row?.revenue ?? row?.amount) || 0),
            bookings: Math.max(0, Number(row?.bookingCount ?? row?.bookings ?? row?.count) || 0),
          };
        });
        setTodayHourly(hourly);
        return;
      }

      const totalCount = Number(firstPage?.totalCount || 0);
      const totalPages = Math.max(1, Math.ceil(totalCount / 100));
      const restPages = await Promise.all(
        Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
          getBookingsReport({ createdFrom: today, createdTo: today, page: index + 2, pageSize: 100 }),
        ),
      );
      let bookings = [firstPage, ...restPages].flatMap((page) => page?.items || []);

      // Một số bản BE cũ xử lý createdTo như đầu ngày. Khi đó lấy trang mới nhất
      // và tự giữ các booking đúng ngày hôm nay để biểu đồ vẫn phản ánh dữ liệu thật.
      if (bookings.length === 0) {
        const latestPage = await getBookingsReport({ page: 1, pageSize: 100 });
        bookings = (latestPage?.items || []).filter((booking) => {
          const occurredAt = booking?.bookedAt || booking?.createdAt || booking?.createdOn || booking?.createdDate;
          return getVietnamDateKey(occurredAt) === today;
        });
      }
      const hourly = Array.from({ length: 24 }, () => ({ revenue: 0, bookings: 0 }));
      bookings.forEach((booking) => {
        const bookedAt = booking?.bookedAt || booking?.createdAt || booking?.createdOn || booking?.createdDate;
        const hour = getVietnamHour(bookedAt);
        if (hour < 0 || hour > 23) return;
        hourly[hour].bookings += 1;
        hourly[hour].revenue += Math.max(0, Number(booking?.paidAmount) || 0);
      });
      setTodayHourly(hourly);
    } catch {
      setRevenueToday(null);
      setTodayHourly(Array.from({ length: 24 }, () => ({ revenue: 0, bookings: 0 })));
    } finally {
      setRevenueTodayLoading(false);
    }
  }, [canAccess, today]);

  const loadBookingsByStatus = useCallback(async () => {
    if (!canAccess) return;
    try {
      setBookingsByStatusLoading(true);
      const params = stripAllSentinels({
        serviceType: filters.serviceType,
        paymentMethod: filters.paymentMethod,
      });
      const res = await getBookingsByStatus(params);
      setBookingsByStatus(res);
    } catch {
      setBookingsByStatus(null);
    } finally {
      setBookingsByStatusLoading(false);
    }
  }, [canAccess, filters.serviceType, filters.paymentMethod]);

  const loadTopRoutes = useCallback(async () => {
    if (!canAccess) return;
    try {
      setTopRoutesLoading(true);
      const params = stripAllSentinels({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        serviceType: filters.serviceType,
        fromStationId: filters.fromStationId,
        toStationId: filters.toStationId,
        limit: 10,
      });
      const res = await getTopRoutes(params);
      setTopRoutes(res?.items || []);
    } catch {
      setTopRoutes([]);
    } finally {
      setTopRoutesLoading(false);
    }
  }, [canAccess, filters.fromDate, filters.toDate, filters.serviceType, filters.fromStationId, filters.toStationId]);

  const loadRecentBookings = useCallback(async () => {
    if (!canAccess) return;
    try {
      setBookingsLoading(true);
      const res = await getBookingsReport({ page: 1, pageSize: 5 });
      setRecentBookings(res?.items || []);
      setRecentBookingsError("");
    } catch (e) {
      setRecentBookings([]);
      setRecentBookingsError(e?.response?.status === 404 ? "no_endpoint" : "error");
    } finally {
      setBookingsLoading(false);
    }
  }, [canAccess]);

  const loadTopCustomers = useCallback(async () => {
    if (!canAccess) return;
    try {
      setTopCustomersLoading(true);
      const params = stripAllSentinels({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        limit: 5,
      });
      const res = await getTopCustomersReport(params);
      const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      // BE shape: { customerKey, customerName, customerPhone, customerEmail,
      //   bookingCount, ticketCount, totalAmount, paidAmount, source, ... }
      const top = items.map((c) => ({
        key: c.customerKey || c.customerPhone || c.customerEmail || c.customerName,
        name: c.customerName || c.customerPhone || c.customerEmail || "--",
        phone: c.customerPhone || "",
        email: c.customerEmail || "",
        source: c.source || "",
        bookingCount: Number(c.bookingCount || 0),
        ticketCount: Number(c.ticketCount || 0),
        netRevenue: Number(c.paidAmount || 0),
        totalAmount: Number(c.totalAmount || 0),
      }));
      setTopCustomers(top);
      setTopCustomersError("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[TopCustomers] err:", e?.response?.status, e?.message);
      setTopCustomers([]);
      setTopCustomersError(e?.response?.status === 404 ? "no_endpoint" : "error");
    } finally {
      setTopCustomersLoading(false);
    }
  }, [canAccess, filters.fromDate, filters.toDate]);

  const loadWaterbus = useCallback(async () => {
    if (!canAccess) return;
    try {
      setWaterbusLoading(true);
      const params = stripAllSentinels({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        serviceType: filters.serviceType,
      });
      const res = await getWaterbusStationRevenue(params);
      setWaterbus(res);
    } catch {
      setWaterbus(null);
    } finally {
      setWaterbusLoading(false);
    }
  }, [canAccess, filters.fromDate, filters.toDate, filters.serviceType]);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);
  useEffect(() => { loadRevenueToday(); }, [loadRevenueToday]);
  useEffect(() => { loadBookingsByStatus(); }, [loadBookingsByStatus]);
  useEffect(() => { loadTopRoutes(); }, [loadTopRoutes]);
  useEffect(() => { loadRecentBookings(); }, [loadRecentBookings]);
  useEffect(() => { loadTopCustomers(); }, [loadTopCustomers]);
  useEffect(() => { loadWaterbus(); }, [loadWaterbus]);

  // ===== DERIVED =====

  const deriveCount = (rootVal, segments, key) => {
    const fromRoot = Number(rootVal);
    if (Number.isFinite(fromRoot) && fromRoot >= 0) return fromRoot;
    const arr = Array.isArray(segments) ? segments : [];
    return arr.reduce((acc, s) => Math.max(acc, 0) + Math.max(Number(s?.[key]) || 0, 0), 0);
  };

  const totalBookings = useMemo(
    () => deriveCount(revenueCurrent?.bookingCount, revenueCurrent?.byServiceType, "bookingCount"),
    [revenueCurrent]
  );

  const SERVICE_TYPE_MASTER_KEYS = ["Waterbus", "Charter", "Sightseeing"];
  const PAYMENT_METHOD_MASTER_KEYS = ["Cash", "PayOS", "Free"];

  const serviceTypeSegments = useMemo(
    () => normalizeSegments({
      items: revenueCurrent?.byServiceType || [],
      masterKeys: SERVICE_TYPE_MASTER_KEYS,
      getLabel: getServiceTypeLabel,
      getColor: getServiceTypeColor,
      lang,
      isDarkMode,
    }),
    [revenueCurrent, lang, isDarkMode]
  );

  const paymentMethodSegments = useMemo(
    () => normalizeSegments({
      items: revenueCurrent?.byPaymentMethod || [],
      masterKeys: PAYMENT_METHOD_MASTER_KEYS,
      getLabel: getPaymentMethodLabel,
      getColor: getPaymentMethodColor,
      lang,
      isDarkMode,
    }),
    [revenueCurrent, lang, isDarkMode]
  );

  // Revenue today
  const reportToday = useMemo(() => (
    (revenueCurrent?.daily || []).find((item) => normalizeReportDateKey(item?.date) === today) || null
  ), [revenueCurrent, today]);
  const apiTodayRevenue = Number(revenueToday?.todayNetRevenue) || 0;
  const apiTodayBookings = Number(revenueToday?.todayBookingCount) || 0;
  const hourlyTodayRevenue = todayHourly.reduce((sum, item) => sum + item.revenue, 0);
  const hourlyTodayBookings = todayHourly.reduce((sum, item) => sum + item.bookings, 0);
  const reportTodayRevenue = Number(reportToday?.netRevenue ?? reportToday?.grossRevenue) || 0;
  const reportTodayBookings = Number(reportToday?.bookingCount) || 0;
  // Endpoint snapshot đôi lúc chậm cập nhật sau khi thanh toán. Khi đó dùng cùng dữ liệu
  // báo cáo theo ngày để KPI vẫn phản ánh booking/tiền đã xuất hiện trên trang.
  const todayRevenue = apiTodayRevenue || hourlyTodayRevenue || reportTodayRevenue;
  const todayBookings = apiTodayBookings || hourlyTodayBookings || reportTodayBookings;
  const todayDateLabel = revenueToday?.date
    ? new Date(revenueToday.date).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US", { weekday: "short", day: "2-digit", month: "2-digit" })
    : (lang === "VN" ? "Hôm nay" : "Today");

  const recentDaily = useMemo(() => (revenueCurrent?.daily || []).slice(-7), [revenueCurrent]);
  const recentRevenuePoints = useMemo(
    () => recentDaily.map((item) => Number(item?.netRevenue ?? item?.grossRevenue) || 0),
    [recentDaily],
  );
  const recentBookingPoints = useMemo(
    () => recentDaily.map((item) => Number(item?.bookingCount) || 0),
    [recentDaily],
  );
  const recentRefundPoints = useMemo(
    () => recentDaily.map((item) => Number(item?.refundAmount) || 0),
    [recentDaily],
  );

  const dailyRevenuePoints = useMemo(
    () => (revenueCurrent?.daily || []).map((p) => p.netRevenue || 0),
    [revenueCurrent]
  );
  const dailyBookingPoints = useMemo(
    () => (revenueCurrent?.daily || []).map((p) => p.bookingCount || 0),
    [revenueCurrent]
  );
  const dailyRefundPoints = useMemo(
    () => (revenueCurrent?.daily || []).map((p) => p.refundAmount || 0),
    [revenueCurrent]
  );

  // Waterbus stations derived
  const wbStations = useMemo(() => {
    if (!Array.isArray(waterbus?.stations)) return [];
    return waterbus.stations.map((s) => ({
      stationId: s.stationId ?? s.id,
      stationName: s.stationName ?? s.name ?? `Bến #${s.stationId ?? s.id}`,
      stationCode: s.stationCode ?? s.code ?? "",
      departureCount: Number(s.departureCount || 0),
      arrivalCount: Number(s.arrivalCount || 0),
      departureTicketCount: Number(s.departureTicketCount || 0),
      arrivalTicketCount: Number(s.arrivalTicketCount || 0),
      departureGross: Number(s.departureGross ?? s.grossRevenue ?? s.totalGross ?? 0),
      departureRefund: Number(s.departureRefund ?? s.refundAmount ?? s.totalRefund ?? 0),
      totalGross: Number(s.totalGross || 0),
      totalRefund: Number(s.totalRefund || 0),
      totalNet: Number(s.totalNet || 0),
    }));
  }, [waterbus]);

  const wbSorted = useMemo(() => {
    return [...wbStations].sort((a, b) => (b.departureGross || 0) - (a.departureGross || 0));
  }, [wbStations]);

  const wbTop = useMemo(() => wbSorted.slice(0, 8), [wbSorted]);

  const wbTotalGross = Number(waterbus?.totalGross || 0);
  const wbTotalRefund = Number(waterbus?.totalRefund || 0);
  const wbTotalNet = Number(waterbus?.totalNet || 0);
  const totalDepBookings = wbStations.reduce((s, r) => s + Number(r.departureCount || 0), 0);
  const totalArrBookings = wbStations.reduce((s, r) => s + Number(r.arrivalCount || 0), 0);

  // Top stations from waterbus API (sorted by totalNet desc, top 8)
  const topStations = useMemo(() => {
    if (!Array.isArray(wbStations)) return [];
    return [...wbStations]
      .sort((a, b) => (b.totalNet || 0) - (a.totalNet || 0))
      .slice(0, 8);
  }, [wbStations]);

  // ===== KPI CARDS =====

  const kpiCards = useMemo(() => {
    return [
      {
        key: "today",
        title: lang === "VN" ? `Doanh thu ${todayDateLabel}` : `Revenue ${todayDateLabel}`,
        value: formatCurrency(todayRevenue),
        icon: "today",
        iconBg: "bg-emerald-500 text-white",
        sparkColor: "#10b981",
        footer: lang === "VN" ? "Theo giờ hôm nay" : "Hourly today",
        sparkPoints: todayHourly.map((item) => item.revenue),
        loading: revenueTodayLoading,
      },
      {
        key: "today_bookings",
        title: lang === "VN" ? `Booking ${todayDateLabel}` : `Bookings ${todayDateLabel}`,
        value: todayBookings,
        icon: "event_available",
        iconBg: "bg-violet-500 text-white",
        sparkColor: "#8b5cf6",
        footer: lang === "VN" ? "Theo giờ hôm nay" : "Hourly today",
        // Thẻ "hôm nay" chỉ phản ánh đúng số liệu hôm nay, không trộn xu hướng 7 ngày.
        sparkPoints: todayHourly.map((item) => item.bookings),
        loading: revenueTodayLoading,
      },
      {
        key: "net",
        title: lang === "VN" ? "Tổng doanh thu" : "Total Revenue",
        value: formatCurrency(revenueCurrent?.netRevenue),
        icon: "payments",
        iconBg: "bg-[#FFD100] text-slate-900",
        sparkColor: isDarkMode ? "#facc15" : "#124757",
        footer: lang === "VN" ? "Xu hướng 7 ngày" : "7-day trend",
        sparkPoints: dailyRevenuePoints,
      },
      {
        key: "bookings",
        title: lang === "VN" ? "Số booking" : "Bookings",
        value: totalBookings,
        icon: "confirmation_number",
        iconBg: "bg-sky-500 text-white",
        sparkColor: "#0ea5e9",
        footer: lang === "VN" ? "Xu hướng 7 ngày" : "7-day trend",
        sparkPoints: dailyBookingPoints,
      },
      {
        key: "refund",
        title: lang === "VN" ? "Đã hoàn tiền" : "Refunded",
        value: formatCurrency(revenueCurrent?.refundAmount),
        icon: "undo",
        iconBg: "bg-rose-500 text-white",
        sparkColor: "#f43f5e",
        footer: lang === "VN" ? "Xu hướng 7 ngày" : "7-day trend",
        sparkPoints: dailyRefundPoints,
      },
    ];
  }, [
    revenueCurrent, revenueToday, lang, isDarkMode,
    dailyRevenuePoints, dailyBookingPoints, dailyRefundPoints,
    totalBookings, recentRevenuePoints, recentBookingPoints, recentRefundPoints,
    revenueTodayLoading, todayDateLabel, todayRevenue, todayBookings, todayHourly,
  ]);

  // ===== RENDER =====

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
    <div className="space-y-2.5 font-body pb-3 px-2 md:px-5 lg:px-6 pt-0 animate-fade-in">

      {/* ===== A. HEADER ===== */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-3xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {lang === "VN" ? "Dashboard" : "Dashboard"}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {lang === "VN"
              ? "Tổng quan doanh thu, booking và hoạt động theo kỳ."
              : "Revenue overview, bookings and activity by period."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {revenueCurrent?.from && revenueCurrent?.to && (
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-slate-600 dark:border-opacity-50">
              <span className="material-symbols-outlined text-[12px]">calendar_month</span>
              {new Date(revenueCurrent.from).toLocaleDateString("vi-VN")} — {new Date(revenueCurrent.to).toLocaleDateString("vi-VN")}
            </span>
          )}
          <Link
            to="/admin/booking-summary"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFD100] dark:bg-yellow-400 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-slate-900 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[14px]">list_alt</span>
            {lang === "VN" ? "Chi tiết Booking" : "Booking Details"}
          </Link>
        </div>
      </div>

      {/* ===== B. FILTER ROW ===== */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-3xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Từ ngày" : "From"}</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => updateFilter("fromDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Đến ngày" : "To"}</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => updateFilter("toDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Dịch vụ" : "Service"}</span>
            <FormSelect
              value={filters.serviceType}
              onChange={(v) => updateFilter("serviceType", v)}
              options={serviceTypeOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Phương thức TT" : "Payment"}</span>
            <FormSelect
              value={filters.paymentMethod}
              onChange={(v) => updateFilter("paymentMethod", v)}
              options={paymentMethodOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Bến đi" : "From"}</span>
            <FormSelect
              value={filters.fromStationId}
              onChange={(v) => updateFilter("fromStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm..." : "Search..."}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Bến đến" : "To"}</span>
            <FormSelect
              value={filters.toStationId}
              onChange={(v) => updateFilter("toStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm..." : "Search..."}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ===== C. KPI CARDS ===== */}
      {revenueError && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-2xl text-[11px] font-bold border border-red-100 dark:border-red-500/20">
          {revenueError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.key}
            className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col"
            style={{ minHeight: "116px" }}
          >
            <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.08]" style={{ backgroundColor: card.sparkColor }} />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{card.title}</p>
                <h4 className="mt-0.5 text-base font-black font-headline text-[#124757] dark:text-white truncate">
                  {card.loading ? "--" : card.value}
                </h4>
              </div>
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
              </div>
            </div>
            <div className="relative mt-auto pt-3">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.sparkColor }} />
                {card.footer}
              </div>
              <div className="mt-1 h-8">
                <Sparkline
                  points={card.sparkPoints}
                  color={card.sparkColor}
                  variant="soft"
                  interactive={false}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== D. TREND CHART + TOP CUSTOMERS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* D1: Revenue trend (2/3) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm flex flex-col min-h-[270px]">
          <div className="flex items-center justify-between mb-2 gap-3 flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
                {lang === "VN" ? "Xu hướng doanh thu" : "Revenue Trend"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {lang === "VN" ? "Doanh thu ròng theo ngày." : "Net revenue by day."}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-[100px] mt-auto">
            <RevenueVsPrevChart
              current={revenueCurrent?.daily || []}
              lang={lang}
              isDarkMode={isDarkMode}
              isLoading={revenueLoading}
            />
          </div>
        </div>

        {/* D2: Top customers (1/3) */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm flex flex-col h-full">
          <div className="mb-3">
            <h3 className="text-[11px] font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
              {lang === "VN" ? "Top 5 khách hàng" : "Top 5 customers"}
            </h3>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {lang === "VN" ? "Khách có doanh thu cao nhất trong kỳ." : "Customers with the highest revenue in the period."}
            </p>
          </div>

          {topCustomersLoading ? (
            <div className="flex-1 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between"><div className="h-2.5 w-28 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /><div className="h-2.5 w-14 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
                </div>
              ))}
            </div>
          ) : topCustomers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-4">
              <span className="material-symbols-outlined text-2xl">person_off</span>
              <p className="mt-1 text-[11px] font-bold">
                {lang === "VN" ? "Chưa có dữ liệu." : "No customer data."}
              </p>
            </div>
          ) : (
            (() => {
              const sorted = [...topCustomers]
                .sort((a, b) => (b.netRevenue || 0) - (a.netRevenue || 0) || (b.bookingCount || 0) - (a.bookingCount || 0))
                .slice(0, 5);
              const maxRevenue = Math.max(...sorted.map((c) => c.netRevenue || 0), 1);
              return (
                <div className="flex-1 space-y-3 overflow-auto pr-0.5">
                  {sorted.map((c, idx) => {
                    const pct = ((c.netRevenue || 0) / maxRevenue) * 100;
                    const medals = ["🥇", "🥈", "🥉"];
                    // Bảng màu huy chương + brand cho từng hạng — đồng bộ với 🥇🥈🥉.
                    const rankPalette = [
                      { bar: "from-amber-300 via-yellow-400 to-amber-500", text: "text-amber-700 dark:text-amber-300", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
                      { bar: "from-slate-300 via-slate-400 to-slate-500", text: "text-slate-700 dark:text-slate-200", chip: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200" },
                      { bar: "from-orange-300 via-orange-400 to-orange-600", text: "text-orange-700 dark:text-orange-300", chip: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
                      { bar: "from-[#124757] via-[#1f7a8a] to-[#3aa4b8]", text: "text-[#124757] dark:text-cyan-300", chip: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
                      { bar: "from-[#124757] via-[#2a8c9e] to-[#5cc6d4]", text: "text-[#124757] dark:text-teal-300", chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
                    ];
                    const palette = rankPalette[idx] || rankPalette[rankPalette.length - 1];
                    return (
                      <div
                        key={c.key}
                        className="relative px-4 py-3 rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between text-sm gap-3">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0 flex items-center gap-2">
                            {idx < 3 ? (
                              <span className="text-base leading-none">{medals[idx]}</span>
                            ) : (
                              <span className={`text-[10px] inline-flex items-center justify-center w-5 h-5 rounded-full font-black ${palette.chip}`}>
                                {idx + 1}
                              </span>
                            )}
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className={`font-black shrink-0 tabular-nums text-xs ${palette.text}`}>
                            {formatCurrency(c.netRevenue)}
                          </span>
                        </div>
                        <div className="mt-2 h-2.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden shadow-inner">
                          <div
                            className={`h-full bg-gradient-to-r ${palette.bar} rounded-full transition-all duration-700 shadow-sm`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-3">
                          <span className="truncate font-medium">
                            {c.phone || c.email || "--"}
                          </span>
                          <span className="shrink-0 tabular-nums font-semibold">
                            <span className="text-slate-700 dark:text-slate-300">{c.bookingCount}</span>
                            <span className="mx-0.5 text-slate-400">·</span>
                            <span className={`${palette.text}`}>{c.ticketCount}</span>
                            <span className="ml-1 text-slate-400">{lang === "VN" ? "đơn/vé" : "bk/tix"}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* ===== E. DONUT + TOP STATIONS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <h4 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Theo dịch vụ" : "By service"}
          </h4>
          <div className="h-[calc(100%-22px)] min-h-[150px]">
            <RevenueDonutChart
              data={serviceTypeSegments}
              lang={lang}
              isDarkMode={isDarkMode}
              isLoading={revenueLoading}
            />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <h4 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Theo thanh toán" : "By payment"}
          </h4>
          <div className="h-[calc(100%-22px)] min-h-[150px]">
            <RevenueDonutChart
              data={paymentMethodSegments}
              lang={lang}
              isDarkMode={isDarkMode}
              isLoading={revenueLoading}
            />
          </div>
        </div>

        {/* E3: Top stations (bar chart, compact) */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm flex flex-col">
          <h3 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-2">
            {lang === "VN" ? "Top bến" : "Top stations"}
          </h3>
          {waterbusLoading ? (
            <div className="flex-1 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between"><div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /><div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" /></div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-900 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (() => {
            const validStations = topStations.filter((s) => (s.totalNet || 0) > 0);
            if (validStations.length === 0) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-4">
                  <span className="material-symbols-outlined text-2xl">location_off</span>
                  <p className="mt-1 text-[11px] font-bold">
                    {lang === "VN" ? "Chưa có dữ liệu." : "No station data."}
                  </p>
                </div>
              );
            }
            const maxRev = Math.max(...validStations.map((s) => s.totalNet || 0), 1);
            return (
              <div className="flex-1 space-y-2 overflow-auto pr-0.5">
                {validStations.map((station, index) => {
                  const pct = ((station.totalNet || 0) / maxRev) * 100;
                  return (
                    <div key={`${station.stationId || station.stationName || index}`} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] gap-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate flex-1 min-w-0">
                          <span className="text-slate-400 mr-1">#{index + 1}</span>
                          {station.stationName || station.key || station.stationId || "--"}
                        </span>
                        <span className="font-black text-sky-600 dark:text-cyan-300 shrink-0 tabular-nums">
                          {formatCurrency(station.totalNet)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: isDarkMode
                              ? "linear-gradient(90deg, rgba(34,211,238,0.85) 0%, rgba(14,165,233,0.95) 100%)"
                              : "linear-gradient(90deg, #CFFAFE 0%, #67E8F9 100%)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ===== H. DETAIL PANEL (tabs: Waterbus + Recent bookings) ===== */}
      {false && <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-1 border border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setDetailTab("recent")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider transition-colors ${
                detailTab === "recent"
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">inbox</span>
              {lang === "VN" ? "Booking gần đây" : "Recent bookings"}
            </button>
          </div>

          {detailTab === "waterbus" ? (
            <div className="flex gap-2 shrink-0">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-xl">
                {lang === "VN" ? "DT gộp" : "Gross"}: {formatCurrency(wbTotalGross)}
              </span>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-xl">
                {lang === "VN" ? "Hoàn tiền" : "Refund"}: {formatCurrency(wbTotalRefund)}
              </span>
            </div>
          ) : (
            <Link
              to="/admin/booking-summary"
              className="inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:opacity-80"
            >
              {lang === "VN" ? "Xem tất cả" : "View all"}
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </Link>
          )}
        </div>

        {/* Waterbus table */}
        {detailTab === "waterbus" && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-bold">
              <thead>
                <tr className="text-left text-slate-400 uppercase tracking-wide bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Bến" : "Station"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Booking đi" : "Departures"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Booking đến" : "Arrivals"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Vé đi" : "Dep. Tickets"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Vé đến" : "Arr. Tickets"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "DT gộp" : "Gross"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Hoàn tiền" : "Refund"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "DT ròng" : "Net"}</th>
                </tr>
              </thead>
              <tbody>
                {waterbusLoading && wbStations.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      {lang === "VN" ? "Đang tải..." : "Loading..."}
                    </td>
                  </tr>
                )}
                {!waterbusLoading && wbStations.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      {lang === "VN" ? "Chưa có dữ liệu." : "No data."}
                    </td>
                  </tr>
                )}
                {wbStations.map((row, idx) => (
                  <tr
                    key={row.stationId ?? idx}
                    className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-700 dark:text-white font-bold">{row.stationName}</span>
                        {row.stationCode && <span className="text-[9px] text-slate-400 font-mono">{row.stationCode}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.departureCount)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.arrivalCount)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.departureTicketCount)}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.arrivalTicketCount)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(row.totalGross || row.departureGross)}</td>
                    <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">{formatCurrency(row.totalRefund || row.departureRefund)}</td>
                    <td className="px-4 py-3 text-right font-black text-[#124757] dark:text-yellow-400">{formatCurrency(row.totalNet)}</td>
                  </tr>
                ))}
              </tbody>
              {!waterbusLoading && wbStations.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/60">
                    <td className="px-4 py-2.5 font-black text-slate-600 dark:text-slate-300" colSpan={2}>
                      {lang === "VN" ? "Tổng" : "Total"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-600 dark:text-slate-300">{formatNumber(totalDepBookings)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-600 dark:text-slate-300">{formatNumber(totalArrBookings)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-slate-600 dark:text-slate-300" colSpan={2} />
                    <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(wbTotalGross)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-rose-600 dark:text-rose-400">{formatCurrency(wbTotalRefund)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-[#124757] dark:text-yellow-400">{formatCurrency(wbTotalNet)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Recent bookings */}
        {detailTab === "recent" && (
          <div className="p-4">
            {recentBookingsError === "no_endpoint" ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-2xl">api</span>
                <p className="mt-1.5 text-[11px] font-bold">
                  {lang === "VN" ? "Backend chưa hỗ trợ." : "Backend endpoint unavailable."}
                </p>
              </div>
            ) : (
              <>
            <p className="text-[10px] text-slate-400 mb-2">5 {lang === "VN" ? "mới nhất" : "most recent"}</p>
            {bookingsLoading ? (
              <div className="space-y-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse" />
                ))}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <span className="material-symbols-outlined text-2xl">inbox</span>
                <p className="mt-1.5 text-[11px] font-bold">{lang === "VN" ? "Chưa có booking nào." : "No bookings yet."}</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="text-left py-1.5 px-2 font-bold">{lang === "VN" ? "Mã" : "Code"}</th>
                      <th className="text-left py-1.5 px-2 font-bold">{lang === "VN" ? "Khách" : "Customer"}</th>
                      <th className="text-left py-1.5 px-2 font-bold hidden md:table-cell">{lang === "VN" ? "DV" : "Svc"}</th>
                      <th className="text-right py-1.5 px-2 font-bold">{lang === "VN" ? "Tổng" : "Total"}</th>
                      <th className="text-center py-1.5 px-2 font-bold">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {recentBookings.map((booking) => (
                      <tr
                        key={booking.bookingId || booking.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/admin/bookings/${booking.bookingId || booking.id}`}
                      >
                        <td className="py-2 px-2 font-bold text-[#124757] dark:text-yellow-400 whitespace-nowrap">
                          {booking.bookingCode || "--"}
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                            {booking.contactName || "--"}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[180px]">
                            {formatDateTime(booking.bookedAt)}
                          </div>
                        </td>
                        <td className="py-2 px-2 hidden md:table-cell">
                          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                            {getServiceTypeLabel(booking.serviceType, lang)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-black text-slate-800 dark:text-white whitespace-nowrap">
                          {formatCurrency(booking.totalAmount)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-[10px] font-headline font-black uppercase tracking-wide ${getBookingStatusClass(booking.bookingStatus)}`}>
                              {getBookingStatusLabel(booking.bookingStatus, lang)}
                            </span>
                            <span className={`text-[9px] font-bold ${getPaymentStatusClass(booking.paymentStatus)}`}>
                              {getPaymentStatusLabel(booking.paymentStatus, lang)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>}

    </div>
  );
};
