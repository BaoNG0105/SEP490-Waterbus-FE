import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { getBookingsReport, getRevenueReport, getRevenueToday, getRevenueTodayHourly, getBookingsByStatus, getTopRoutes } from "../../../api/reportApi";
import { fetchAllStations } from "../../../services/stationService";
import { isAdminUser } from "../../../utils/roleHelpers";
import { FormSelect } from "../../../components/FormSelect";
import { Sparkline } from "../../../components/charts/Sparkline";
import { RevenueDonutChart } from "../../../components/charts/RevenueDonutChart";
import { RevenueBarChart } from "../../../components/charts/RevenueBarChart";
import { getServiceTypeColor, getPaymentMethodColor, formatCompactCurrency } from "../../../utils/revenueReport";
import {
  serviceTypeOptions,
  paymentMethodOptions,
  getBookingStatusLabel,
  getServiceTypeLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getBookingStatusClass,
  getPaymentStatusClass,
  formatCurrency,
  formatDateTime,
} from "../../../utils/bookingReport";

/** Trả về kỳ hiện tại (7 ngày gần nhất) + kỳ trước cùng độ dài để tính delta. */
const buildPeriods = () => {
  const now = new Date();
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayStr = vnNow.toISOString().slice(0, 10);

  const end = new Date(vnNow);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 29); // 30 ngày gần nhất (gồm hôm nay)
  const startStr = start.toISOString().slice(0, 10);

  const prevEnd = new Date(start);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevEnd.getUTCDate() - 6);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const prevStartStr = prevStart.toISOString().slice(0, 10);

  return {
    current: { fromDate: startStr, toDate: todayStr },
    previous: { fromDate: prevStartStr, toDate: prevEndStr },
  };
};

const computeDeltaTone = (pct, invert) => {
  if (pct === 0) return "neutral";
  const rising = pct > 0;
  if (!invert) return rising ? "up" : "down";
  return rising ? "down" : "up";
};

const invertTone = (tone) => {
  if (tone === "up") return "down";
  if (tone === "down") return "up";
  return "neutral";
};

const computeNewTone = (curRising, invert) => {
  if (!invert) return curRising ? "up" : "down";
  return curRising ? "down" : "up";
};

const formatDelta = (current, previous, opts = {}) => {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  const invert = opts.invert === true;
  const fmtValue = opts.formatValue || ((v) => v.toString());

  let pctText;
  let rawTone;

  if (prev === 0 && cur === 0) {
    pctText = "0%";
    rawTone = "neutral";
  } else if (prev === 0) {
    pctText = "—";
    rawTone = computeNewTone(cur > 0, invert);
  } else {
    const pct = ((cur - prev) / prev) * 100;
    const rounded = Math.round(pct * 10) / 10;
    const sign = rounded > 0 ? "+" : "";
    pctText = `${sign}${rounded}%`;
    rawTone = computeDeltaTone(rounded, false);
  }

  const tone = invert ? invertTone(rawTone) : rawTone;

  let absoluteText = "";
  if (prev > 0 || cur > 0) {
    const abs = cur - prev;
    if (abs === 0) {
      absoluteText = fmtValue(0);
    } else {
      const sign = abs > 0 ? "+" : "−";
      absoluteText = `${sign}${fmtValue(Math.abs(abs))}`;
    }
  }

  return { text: pctText, abs: absoluteText, tone };
};

const DELTA_BADGE = {
  up: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  down: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  neutral: "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-300",
};

const DELTA_ICON = { up: "trending_up", down: "trending_down", neutral: "trending_flat" };

// "All" là sentinel phía FE — BE nhận enum/int, gửi "All" sẽ gây 400. Bỏ qua key có value === "All" / rỗng.
const stripAllSentinels = (params) => {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "string" && v.trim().toLowerCase() === "all") return;
    out[k] = v;
  });
  return out;
};

// Trích message thân thiện từ axios error theo status code.
const extractApiMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    return data.message || data.title || data.error || fallback;
  }
  return fallback;
};

const withDetail = (label, msg) => (msg ? `${label}: ${msg}` : `${label}.`);

const revenueErrorMessages = {
  401: { VN: "Phiên đăng nhập đã hết hạn.", EN: "Session expired." },
  403: {
    VN: "Bạn không có quyền xem báo cáo doanh thu.",
    EN: "You don't have permission to view the revenue report.",
  },
  404: {
    VN: "Chưa có dữ liệu doanh thu trong khoảng đã chọn.",
    EN: "No revenue data for the selected range.",
  },
  500: {
    VN: "Máy chủ đang bận, vui lòng thử lại sau ít phút.",
    EN: "Server is busy. Please try again in a few minutes.",
  },
};

const formatRevenueError = (error, lang) => {
  const status = error?.response?.status;
  const vn = lang === "VN";

  if (status === 400) {
    const msg = extractApiMessage(error, "");
    return vn
      ? withDetail("Bộ lọc không hợp lệ", msg)
      : withDetail("Invalid filter", msg);
  }

  const bucket = revenueErrorMessages[status] || (status >= 500 ? revenueErrorMessages[500] : null);
  if (bucket) return vn ? bucket.VN : bucket.EN;

  return vn
    ? "Không thể tải dữ liệu tổng quan doanh thu."
    : "Failed to load the revenue overview.";
};

const bookingsErrorMessages = {
  401: { VN: "Phiên đăng nhập đã hết hạn.", EN: "Session expired." },
  403: {
    VN: "Bạn không có quyền xem báo cáo booking.",
    EN: "You don't have permission to view the booking report.",
  },
  500: {
    VN: "Máy chủ đang bận, vui lòng thử lại sau ít phút.",
    EN: "Server is busy. Please try again in a few minutes.",
  },
};

const formatBookingsError = (error, lang) => {
  const status = error?.response?.status;
  const vn = lang === "VN";
  const bucket = bookingsErrorMessages[status] || (status >= 500 ? bookingsErrorMessages[500] : null);
  if (bucket) return vn ? bucket.VN : bucket.EN;
  return vn
    ? "Không thể tải dữ liệu báo cáo booking."
    : "Failed to load the booking report.";
};

// Map màu thanh ngang cho từng bookingStatus — dùng trong breakdown section.
const bookingStatusBarColors = {
  Pending: "bg-amber-400 dark:bg-amber-500",
  AwaitingPayment: "bg-orange-400 dark:bg-orange-500",
  Confirmed: "bg-sky-500 dark:bg-sky-400",
  CheckedIn: "bg-indigo-500 dark:bg-indigo-400",
  Completed: "bg-emerald-500 dark:bg-emerald-400",
  Cancelled: "bg-rose-400 dark:bg-rose-500",
  Refunded: "bg-violet-400 dark:bg-violet-500",
  Expired: "bg-slate-400 dark:bg-slate-500",
  Rejected: "bg-red-500 dark:bg-red-400",
  Draft: "bg-slate-300 dark:bg-slate-600",
};

const barColorForStatus = (status) =>
  bookingStatusBarColors[status] || "bg-[#124757] dark:bg-yellow-400";

export const Dashboard = () => {
  const { lang, isDarkMode } = useApp();
  const { user } = useSelector((state) => state.auth);
  const canAccess = isAdminUser(user);

  // ===== Data =====
  const [recentBookings, setRecentBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsErrorMsg, setBookingsErrorMsg] = useState("");

  const [revenueCurrent, setRevenueCurrent] = useState(null);
  const [revenuePrevious, setRevenuePrevious] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueErrorMsg, setRevenueErrorMsg] = useState("");

  const [stations, setStations] = useState([]);
  const [revenueFilters, setRevenueFilters] = useState({
    fromDate: "",
    toDate: "",
    serviceType: "All",
    paymentMethod: "All",
    fromStationId: "All",
    toStationId: "All",
  });

  // ===== Data: today snapshot + booking-status breakdown + top routes =====
  const [revenueToday, setRevenueToday] = useState(null);
  const [revenueTodayHourly, setRevenueTodayHourly] = useState([]);
  const [revenueTodayLoading, setRevenueTodayLoading] = useState(true);
  const [revenueTodayError, setRevenueTodayError] = useState("");

  const [bookingsByStatus, setBookingsByStatus] = useState(null);
  const [bookingsByStatusLoading, setBookingsByStatusLoading] = useState(true);
  const [bookingsByStatusError, setBookingsByStatusError] = useState("");

  const [topRoutes, setTopRoutes] = useState([]);
  const [topRoutesLoading, setTopRoutesLoading] = useState(true);
  const [topRoutesError, setTopRoutesError] = useState("");

  useEffect(() => {
    if (!canAccess) return;
    fetchAllStations().then(setStations).catch(() => {});
  }, [canAccess]);

  // ===== Load: bookings summary + recent =====
  const loadBookings = useCallback(async () => {
    if (!canAccess) return;
    try {
      setBookingsLoading(true);
      setBookingsErrorMsg("");
      const recentRes = await getBookingsReport({ page: 1, pageSize: 5 });
      setRecentBookings(recentRes?.items || []);
    } catch (error) {
      console.error("Lỗi tải báo cáo booking:", error);
      setBookingsErrorMsg(formatBookingsError(error, lang));
      setRecentBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [canAccess]); // lang removed to avoid unnecessary re-fetch

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // ===== Load: revenue current + previous (cùng filter) =====
  const loadRevenue = useCallback(async () => {
    if (!canAccess) return;
    try {
      setRevenueLoading(true);
      setRevenueErrorMsg("");
      const periods = buildPeriods();
      // Strip "All" sentinels — BE expects enum/int, chuỗi "All" sẽ gây 400.
      const baseParams = stripAllSentinels({
        serviceType: revenueFilters.serviceType,
        paymentMethod: revenueFilters.paymentMethod,
        fromStationId: revenueFilters.fromStationId,
        toStationId: revenueFilters.toStationId,
      });

      const effectiveCurrent = {
        fromDate: revenueFilters.fromDate || periods.current.fromDate,
        toDate: revenueFilters.toDate || periods.current.toDate,
      };

      const currentRes = await getRevenueReport({ ...baseParams, ...effectiveCurrent });

      // FALLBACK: nếu filter mặc định (All) không trả daily, gọi không filter
      // để lấy full daily series cho chart + sparkline.
      let dailyFallbackRes = null;
      const allFiltersDefault =
        revenueFilters.serviceType === "All" &&
        revenueFilters.paymentMethod === "All" &&
        revenueFilters.fromStationId === "All" &&
        revenueFilters.toStationId === "All";

      if (
        (!currentRes?.daily || currentRes.daily.length === 0) &&
        allFiltersDefault
      ) {
        try {
          dailyFallbackRes = await getRevenueReport({});
        } catch (e) {
          console.warn("[Dashboard] Daily fallback failed:", e);
        }
      }

      // Kỳ trước cùng độ dài — dùng làm baseline cho delta%.
      const curStart = new Date(effectiveCurrent.fromDate);
      const curEnd = new Date(effectiveCurrent.toDate);
      const lengthMs = Math.max(curEnd.getTime() - curStart.getTime(), 24 * 60 * 60 * 1000);
      const prevEnd = new Date(curStart.getTime() - 24 * 60 * 60 * 1000);
      const prevStart = new Date(prevEnd.getTime() - lengthMs);
      const previousRes = await getRevenueReport({
        ...baseParams,
        fromDate: prevStart.toISOString().slice(0, 10),
        toDate: prevEnd.toISOString().slice(0, 10),
      });

      const finalCurrent = (currentRes?.daily && currentRes.daily.length > 0)
        ? currentRes
        : (dailyFallbackRes || currentRes);

      setRevenueCurrent(finalCurrent);
      setRevenuePrevious(previousRes);
    } catch (error) {
      console.error("Lỗi tải tổng quan doanh thu:", error);
      setRevenueErrorMsg(formatRevenueError(error, lang));
      setRevenueCurrent(null);
      setRevenuePrevious(null);
    } finally {
      setRevenueLoading(false);
    }
  }, [canAccess, revenueFilters, lang]);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  // ===== Load: revenue today snapshot =====
  const loadRevenueToday = useCallback(async () => {
    if (!canAccess) return;
    try {
      setRevenueTodayLoading(true);
      setRevenueTodayError("");
      const [res, hourlyResult] = await Promise.all([
        getRevenueToday(),
        // BE trả { hours: [{ hour, netRevenue, bookingCount }] }; vẫn giữ dashboard hoạt động nếu endpoint chưa sẵn sàng.
        getRevenueTodayHourly().catch(() => null),
      ]);
      setRevenueToday(res);
      const hourlyRows = Array.isArray(hourlyResult)
        ? hourlyResult
        : (hourlyResult?.hours || hourlyResult?.items || []);
      const hourly = Array.from({ length: 24 }, () => ({ netRevenue: 0, bookingCount: 0 }));
      hourlyRows.forEach((row) => {
        const hour = Number(row?.hour ?? row?.hourOfDay);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
        hourly[hour] = {
          netRevenue: Math.max(0, Number(row?.netRevenue ?? row?.revenue ?? row?.amount) || 0),
          bookingCount: Math.max(0, Number(row?.bookingCount ?? row?.bookings ?? row?.count) || 0),
        };
      });
      setRevenueTodayHourly(hourlyRows.length > 0 ? hourly : []);
    } catch (error) {
      console.error("Lỗi tải doanh thu hôm nay:", error);
      const status = error?.response?.status;
      setRevenueTodayError(
        status === 401 || status === 403
          ? (lang === "VN" ? "Không có quyền truy cập." : "Access denied.")
          : (lang === "VN" ? "Không thể tải doanh thu hôm nay." : "Failed to load today's revenue.")
      );
      setRevenueToday(null);
      setRevenueTodayHourly([]);
    } finally {
      setRevenueTodayLoading(false);
    }
  }, [canAccess]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadRevenueToday();
  }, [loadRevenueToday]);

  // ===== Load: bookings by status =====
  const loadBookingsByStatus = useCallback(async () => {
    if (!canAccess) return;
    try {
      setBookingsByStatusLoading(true);
      setBookingsByStatusError("");
      const params = stripAllSentinels({
        serviceType: revenueFilters.serviceType,
        paymentMethod: revenueFilters.paymentMethod,
      });
      const res = await getBookingsByStatus(params);
      setBookingsByStatus(res);
    } catch (error) {
      console.error("Lỗi tải booking theo trạng thái:", error);
      const status = error?.response?.status;
      setBookingsByStatusError(
        status === 401 || status === 403
          ? (lang === "VN" ? "Không có quyền truy cập." : "Access denied.")
          : (lang === "VN" ? "Không thể tải phân bổ trạng thái." : "Failed to load status breakdown.")
      );
      setBookingsByStatus(null);
    } finally {
      setBookingsByStatusLoading(false);
    }
  }, [canAccess, revenueFilters.serviceType, revenueFilters.paymentMethod]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadBookingsByStatus();
  }, [loadBookingsByStatus]);

  // ===== Load: top routes =====
  const loadTopRoutes = useCallback(async () => {
    if (!canAccess) return;
    try {
      setTopRoutesLoading(true);
      setTopRoutesError("");
      const params = stripAllSentinels({
        serviceType: revenueFilters.serviceType,
        fromStationId: revenueFilters.fromStationId,
        toStationId: revenueFilters.toStationId,
        limit: 10,
      });
      const res = await getTopRoutes(params);
      setTopRoutes(res?.items || []);
    } catch (error) {
      console.error("Lỗi tải top tuyến:", error);
      const status = error?.response?.status;
      setTopRoutesError(
        status === 401 || status === 403
          ? (lang === "VN" ? "Không có quyền truy cập." : "Access denied.")
          : (lang === "VN" ? "Không thể tải top tuyến." : "Failed to load top routes.")
      );
      setTopRoutes([]);
    } finally {
      setTopRoutesLoading(false);
    }
  }, [canAccess, revenueFilters.serviceType, revenueFilters.fromStationId, revenueFilters.toStationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTopRoutes();
  }, [loadTopRoutes]);

  // ===== Derived =====
  const updateRevenueFilter = (key, value) => {
    setRevenueFilters((prev) => ({ ...prev, [key]: value }));
  };

  const stationOptions = useMemo(() => ([
    { value: "All", label: lang === "VN" ? "Tất cả bến" : "All Stations" },
    ...stations.map((s) => ({ value: s.stationId, label: s.stationName })),
  ]), [stations, lang]);

  const serviceTypeRevenueSegments = useMemo(() => (
    (revenueCurrent?.byServiceType || []).map((item) => ({
      key: item.key,
      label: getServiceTypeLabel(item.key, lang),
      value: item.netRevenue || 0,
      color: getServiceTypeColor(item.key, isDarkMode),
    }))
  ), [revenueCurrent, lang, isDarkMode]);

  const paymentMethodRevenueSegments = useMemo(() => (
    (revenueCurrent?.byPaymentMethod || []).map((item) => ({
      key: item.key,
      label: getPaymentMethodLabel(item.key, lang),
      value: item.netRevenue || 0,
      color: getPaymentMethodColor(item.key, isDarkMode),
    }))
  ), [revenueCurrent, lang, isDarkMode]);

  // Payment lines for bar chart (daily breakdown by payment method)
  // Nếu API không trả daily payment breakdown thì phân bổ theo tỷ lệ byPaymentMethod.
  const paymentLines = useMemo(() => {
    const byPayment = revenueCurrent?.byPaymentMethod || [];
    if (byPayment.length === 0) return [];
    const daily = revenueCurrent?.daily || [];
    if (daily.length === 0) return [];
    const totalRevenue = byPayment.reduce((s, p) => s + (p.netRevenue || 0), 0) || 0;

    // Ưu tiên field breakdown trực tiếp từ API
    const hasBreakdown = daily.some((d) =>
      byPayment.some((pm) => d[`netRevenue_${pm.key}`] !== undefined || d[`payment_${pm.key}`] !== undefined)
    );

    return byPayment.slice(0, 4).map((pm) => {
      const values = hasBreakdown
        ? daily.map((d) => d[`netRevenue_${pm.key}`] ?? d[`payment_${pm.key}`] ?? d[pm.key?.toLowerCase()] ?? 0)
        : (() => {
            // Phân bổ daily netRevenue theo tỷ lệ % của payment method
            const ratio = totalRevenue > 0 ? (pm.netRevenue || 0) / totalRevenue : 0;
            return daily.map((d) => Math.round((d.netRevenue || 0) * ratio));
          })();
      return {
        method: pm.key,
        label: getPaymentMethodLabel(pm.key, lang),
        values,
      };
    });
  }, [revenueCurrent, lang]);

  // Sparkline data - revenue is always available from daily[]
  const dailyRevenuePoints = useMemo(
    () => (revenueCurrent?.daily || []).map((p) => p.netRevenue || 0),
    [revenueCurrent]
  );

  // Sparkline chính xác từ /reports/revenue/today (7 ngày gần nhất).
  // Ưu tiên dùng series của revenueToday; fallback về daily của revenueCurrent.
  const weeklyPoints = useMemo(() => {
    const series = revenueToday?.series?.netRevenue;
    if (Array.isArray(series) && series.length > 0) return series;
    return dailyRevenuePoints.slice(-7);
  }, [revenueToday, dailyRevenuePoints]);

  const weeklyBookingPoints = useMemo(() => {
    const series = revenueToday?.series?.bookingCount;
    if (Array.isArray(series) && series.length > 0) return series;
    const daily = revenueCurrent?.daily || [];
    const fromDaily = daily.length > 0 && daily[0]?.bookingCount !== undefined
      ? daily.map((p) => p.bookingCount || 0)
      : dailyRevenuePoints;
    return fromDaily.slice(-7);
  }, [revenueToday, revenueCurrent, dailyRevenuePoints]);

  const weeklyTicketPoints = useMemo(() => {
    const series = revenueToday?.series?.ticketCount;
    if (Array.isArray(series) && series.length > 0) return series;
    const daily = revenueCurrent?.daily || [];
    const fromDaily = daily.length > 0 && daily[0]?.ticketCount !== undefined
      ? daily.map((p) => p.ticketCount || 0)
      : dailyRevenuePoints;
    return fromDaily.slice(-7);
  }, [revenueToday, revenueCurrent, dailyRevenuePoints]);

  // Thẻ "hôm nay" phải dùng endpoint theo giờ. Chỉ fallback về 7 ngày khi BE chưa trả dữ liệu giờ.
  const hourlyRevenuePoints = useMemo(() => {
    if (revenueTodayHourly.some((item) => item.netRevenue > 0)) {
      return revenueTodayHourly.map((item) => item.netRevenue);
    }
    return weeklyPoints;
  }, [revenueTodayHourly, weeklyPoints]);

  const hourlyBookingPoints = useMemo(() => {
    if (revenueTodayHourly.some((item) => item.bookingCount > 0)) {
      return revenueTodayHourly.map((item) => item.bookingCount);
    }
    return weeklyBookingPoints;
  }, [revenueTodayHourly, weeklyBookingPoints]);

  // Booking/ticket trends - fallback to revenue if daily doesn't have these fields
  const dailyBookingPoints = useMemo(() => {
    const daily = revenueCurrent?.daily || [];
    if (daily.length > 0 && daily[0]?.bookingCount !== undefined) {
      return daily.map((p) => p.bookingCount || 0);
    }
    return dailyRevenuePoints; // fallback to revenue trend
  }, [revenueCurrent, dailyRevenuePoints]);

  const dailyTicketPoints = useMemo(() => {
    const daily = revenueCurrent?.daily || [];
    if (daily.length > 0 && daily[0]?.ticketCount !== undefined) {
      return daily.map((p) => p.ticketCount || 0);
    }
    return dailyRevenuePoints; // fallback to revenue trend
  }, [revenueCurrent, dailyRevenuePoints]);

  const dailyRefundPoints = useMemo(() => {
    const daily = revenueCurrent?.daily || [];
    if (daily.length > 0 && daily[0]?.refundAmount !== undefined) {
      return daily.map((p) => p.refundAmount || 0);
    }
    return dailyRevenuePoints; // fallback to revenue trend
  }, [revenueCurrent, dailyRevenuePoints]);

  // Suy ra tổng số booking/ vé — ưu tiên field root (bookingCount/ticketCount), fallback cộng dồn từ byServiceType
  // (một số BE không trả field top-level mà chỉ có trong segment) — nếu cả 2 đều không có thì trả 0.
  const deriveCount = (rootVal, segments, key) => {
    const fromRoot = Number(rootVal);
    if (Number.isFinite(fromRoot) && fromRoot >= 0) return fromRoot;
    const arr = Array.isArray(segments) ? segments : [];
    const sum = arr.reduce((acc, s) => Math.max(acc, 0) + Math.max(Number(s?.[key]) || 0, 0), 0);
    return Math.max(sum, 0);
  };
  const totalBookings = useMemo(
    () => deriveCount(revenueCurrent?.bookingCount, revenueCurrent?.byServiceType, "bookingCount"),
    [revenueCurrent]
  );
  const totalTickets = useMemo(
    () => deriveCount(revenueCurrent?.ticketCount, revenueCurrent?.byServiceType, "ticketCount"),
    [revenueCurrent]
  );

  const totalBookingsPrev = useMemo(
    () => deriveCount(revenuePrevious?.bookingCount, revenuePrevious?.byServiceType, "bookingCount"),
    [revenuePrevious]
  );
  const totalTicketsPrev = useMemo(
    () => deriveCount(revenuePrevious?.ticketCount, revenuePrevious?.byServiceType, "ticketCount"),
    [revenuePrevious]
  );

  // ==== KPI cards ====
  const kpiCards = useMemo(() => {
    const netRevDelta = formatDelta(revenueCurrent?.netRevenue, revenuePrevious?.netRevenue, {
      formatValue: (v) => formatCompactCurrency(v, lang),
    });
    const refundDelta = formatDelta(revenueCurrent?.refundAmount, revenuePrevious?.refundAmount, {
      invert: true,
      formatValue: (v) => formatCompactCurrency(v, lang),
    });
    const bookingsDelta = formatDelta(totalBookings, totalBookingsPrev, {
      formatValue: (v) => v.toLocaleString(lang === "VN" ? "vi-VN" : "en-US"),
    });
    const ticketsDelta = formatDelta(totalTickets, totalTicketsPrev, {
      formatValue: (v) => v.toLocaleString(lang === "VN" ? "vi-VN" : "en-US"),
    });

    // === Today KPI (snapshot từ /reports/revenue/today) ===
    const todayRevenue = Number(revenueToday?.todayNetRevenue) || 0;
    const yesterdayRevenue = Number(revenueToday?.yesterdayNetRevenue) || 0;
    const todayBookings = Number(revenueToday?.todayBookingCount) || 0;
    const yesterdayBookings = Number(
      revenueToday?.last7Days?.[revenueToday.last7Days.length - 2]?.bookingCount
    ) || 0;
    const todayDelta = formatDelta(todayRevenue, yesterdayRevenue, {
      formatValue: (v) => formatCompactCurrency(v, lang),
    });
    const todayBookingsDelta = formatDelta(todayBookings, yesterdayBookings, {
      formatValue: (v) => v.toLocaleString(lang === "VN" ? "vi-VN" : "en-US"),
    });
    const todayDateLabel = revenueToday?.date
      ? new Date(revenueToday.date).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-US", {
          weekday: "short", day: "2-digit", month: "2-digit",
        })
      : (lang === "VN" ? "Hôm nay" : "Today");

    return [
      {
        key: "today",
        title: lang === "VN" ? `Doanh thu ${todayDateLabel}` : `Revenue ${todayDateLabel}`,
        value: formatCurrency(todayRevenue),
        delta: todayDelta,
        icon: "today",
        iconBg: "bg-emerald-500 text-white",
        sparkColor: "#10b981",
        sparkPoints: hourlyRevenuePoints,
        loading: revenueTodayLoading,
      },
      {
        key: "net",
        title: lang === "VN" ? "Tổng doanh thu" : "Total Revenue",
        value: formatCurrency(revenueCurrent?.netRevenue),
        delta: netRevDelta,
        icon: "payments",
        iconBg: "bg-[#FFD100] text-slate-900",
        sparkColor: isDarkMode ? "#facc15" : "#124757",
        sparkPoints: dailyRevenuePoints,
      },
      {
        key: "refund",
        title: lang === "VN" ? "Đã hoàn tiền" : "Refunded",
        value: formatCurrency(revenueCurrent?.refundAmount),
        delta: refundDelta,
        icon: "undo",
        iconBg: "bg-rose-500 text-white",
        sparkColor: "#f43f5e",
        sparkPoints: dailyRefundPoints,
      },
      {
        key: "bookings",
        title: lang === "VN" ? "Số booking" : "Bookings",
        value: totalBookings,
        delta: bookingsDelta,
        icon: "confirmation_number",
        iconBg: "bg-sky-500 text-white",
        sparkColor: "#0ea5e9",
        sparkPoints: dailyBookingPoints,
      },
      {
        key: "today_bookings",
        title: lang === "VN" ? `Booking ${todayDateLabel}` : `Bookings ${todayDateLabel}`,
        value: todayBookings,
        delta: todayBookingsDelta,
        icon: "event_available",
        iconBg: "bg-violet-500 text-white",
        sparkColor: "#8b5cf6",
        sparkPoints: hourlyBookingPoints,
        loading: revenueTodayLoading,
      },
      {
        key: "tickets",
        title: lang === "VN" ? "Số vé" : "Tickets",
        value: totalTickets,
        delta: ticketsDelta,
        icon: "airplane_ticket",
        iconBg: "bg-indigo-500 text-white",
        sparkColor: "#6366f1",
        sparkPoints: dailyTicketPoints,
      },
    ];
  }, [
    revenueCurrent, revenuePrevious, revenueToday,
    lang, isDarkMode,
    dailyRevenuePoints, dailyBookingPoints, dailyTicketPoints, dailyRefundPoints,
    weeklyPoints, weeklyBookingPoints, weeklyTicketPoints, hourlyRevenuePoints, hourlyBookingPoints,
    totalBookings, totalTickets, totalBookingsPrev, totalTicketsPrev,
    revenueTodayLoading,
  ]);

  const topStations = useMemo(() => {
    const byStation = revenueCurrent?.byStation || [];
    return [...byStation]
      .sort((a, b) => (b.netRevenue || 0) - (a.netRevenue || 0))
      .slice(0, 4);
  }, [revenueCurrent]);

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
    <div className="space-y-3 font-body pb-4 px-1.5 md:px-3 pt-16 animate-fade-in">

      {/* ===================== HEADER ===================== */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-3xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {lang === "VN" ? "Bảng điều khiển" : "Sales Dashboard"}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {lang === "VN"
              ? "Theo dõi doanh thu, booking và hoạt động gần đây."
              : "Monitor revenue, bookings and recent activity."}
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
            {lang === "VN" ? "Chi tiết" : "Details"}
          </Link>
        </div>
      </div>

      {(bookingsErrorMsg || revenueErrorMsg || revenueTodayError || bookingsByStatusError || topRoutesError) && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-2.5 rounded-2xl text-[11px] font-bold border border-red-100 dark:border-red-500/20 space-y-1">
          <div>{bookingsErrorMsg || revenueErrorMsg}</div>
          {(revenueTodayError || bookingsByStatusError || topRoutesError) && (
            <div className="text-[10px] opacity-80">
              {[revenueTodayError, bookingsByStatusError, topRoutesError].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* ===================== FILTER ROW (compact) ===================== */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-3xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Từ ngày" : "From"}</span>
            <input
              type="date"
              value={revenueFilters.fromDate}
              onChange={(e) => updateRevenueFilter("fromDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Đến ngày" : "To"}</span>
            <input
              type="date"
              value={revenueFilters.toDate}
              onChange={(e) => updateRevenueFilter("toDate", e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Dịch vụ" : "Service"}</span>
            <FormSelect
              value={revenueFilters.serviceType}
              onChange={(v) => updateRevenueFilter("serviceType", v)}
              options={serviceTypeOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Phương thức TT" : "Payment"}</span>
            <FormSelect
              value={revenueFilters.paymentMethod}
              onChange={(v) => updateRevenueFilter("paymentMethod", v)}
              options={paymentMethodOptions.map((o) => ({ value: o.value, label: lang === "VN" ? o.labelVn : o.labelEn }))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Bến đi" : "From"}</span>
            <FormSelect
              value={revenueFilters.fromStationId}
              onChange={(v) => updateRevenueFilter("fromStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm..." : "Search..."}
              emptyLabel={lang === "VN" ? "Không có" : "None"}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block mb-0.5">{lang === "VN" ? "Bến đến" : "To"}</span>
            <FormSelect
              value={revenueFilters.toStationId}
              onChange={(v) => updateRevenueFilter("toStationId", v)}
              searchable
              searchPlaceholder={lang === "VN" ? "Tìm..." : "Search..."}
              emptyLabel={lang === "VN" ? "Không có" : "None"}
              options={stationOptions}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-[11px] font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ===================== KPI CARDS (6 ngang) ===================== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.key}
            className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col"
            style={{ minHeight: "120px" }}
          >
            {/* Subtle decorative blob */}
            <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.08]" style={{ backgroundColor: card.sparkColor }} />

            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {card.title}
                </p>
                <h4 className="mt-0.5 text-lg font-black font-headline text-[#124757] dark:text-white truncate">
                  {card.loading ? "--" : card.value}
                </h4>
              </div>
              <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
              </div>
            </div>

            <div className="relative mt-1.5 flex items-center gap-1.5 min-w-0">
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black shrink-0 ${DELTA_BADGE[card.delta.tone]}`}
              >
                <span className="material-symbols-outlined text-[10px]">
                  {DELTA_ICON[card.delta.tone]}
                </span>
                {card.delta.text}
              </span>
              <span className="text-[9px] text-slate-400 font-bold truncate">
                {lang === "VN" ? "vs kỳ trước" : "vs prior"}
              </span>
            </div>

            <div className="relative mt-1.5 h-8">
              {(revenueLoading || card.loading) ? (
                <div className="h-full rounded-md bg-slate-100 dark:bg-slate-900 animate-pulse" />
              ) : (
                <Sparkline points={card.sparkPoints} color={card.sparkColor} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ===================== MAIN CHART: BAR + DONUTS ROW ===================== */}
      {/* Donuts ngang hàng trên */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut: by service */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <h4 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Theo dịch vụ" : "By service"}
          </h4>
          <div className="h-[calc(100%-22px)] min-h-[140px]">
            <RevenueDonutChart
              data={serviceTypeRevenueSegments}
              lang={lang}
              isDarkMode={isDarkMode}
              isLoading={revenueLoading}
            />
          </div>
        </div>

        {/* Donut: by payment */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <h4 className="text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider mb-1">
            {lang === "VN" ? "Theo thanh toán" : "By payment"}
          </h4>
          <div className="h-[calc(100%-22px)] min-h-[140px]">
            <RevenueDonutChart
              data={paymentMethodRevenueSegments}
              lang={lang}
              isDarkMode={isDarkMode}
              isLoading={revenueLoading}
            />
          </div>
        </div>
      </div>

      {/* Bar chart doanh thu - full width */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
        <div className="flex items-center justify-between mb-1 gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider truncate">
              {lang === "VN" ? "Xu hướng doanh thu" : "Revenue Trend"}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {lang === "VN" ? "Doanh thu ròng theo ngày trong khoảng đã chọn." : "Net revenue by day for the selected range."}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <RevenueBarChart
            points={revenueCurrent?.daily || []}
            paymentLines={paymentLines}
            lang={lang}
            isDarkMode={isDarkMode}
            isLoading={revenueLoading}
          />
        </div>
      </div>

      {/* ===================== BOOKING STATUS BREAKDOWN + TOP ROUTES ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Booking status breakdown (1/3) */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
                {lang === "VN" ? "Booking theo trạng thái" : "Bookings by status"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {bookingsByStatus?.from && bookingsByStatus?.to
                  ? `${new Date(bookingsByStatus.from).toLocaleDateString("vi-VN")} — ${new Date(bookingsByStatus.to).toLocaleDateString("vi-VN")}`
                  : (lang === "VN" ? "Phân bổ trong kỳ" : "Breakdown for the period")}
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">
              {bookingsByStatus?.total != null && (
                <>{bookingsByStatus.total.toLocaleString(lang === "VN" ? "vi-VN" : "en-US")} {lang === "VN" ? "booking" : "bookings"}</>
              )}
            </span>
          </div>

          {bookingsByStatusLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse" />
              ))}
            </div>
          ) : !bookingsByStatus?.statuses?.length ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
              <span className="material-symbols-outlined text-2xl">donut_small</span>
              <p className="mt-1 text-[11px] font-bold">{lang === "VN" ? "Chưa có dữ liệu." : "No data yet."}</p>
            </div>
          ) : (() => {
            const maxCount = Math.max(...bookingsByStatus.statuses.map(s => s.bookingCount || 0), 1);
            return (
              <div className="space-y-2">
                {bookingsByStatus.statuses.map((s) => {
                  const pct = ((s.bookingCount || 0) / maxCount) * 100;
                  const totalCount = bookingsByStatus.total || 0;
                  const share = totalCount > 0 ? ((s.bookingCount || 0) / totalCount) * 100 : 0;
                  return (
                    <div key={s.status} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold uppercase tracking-wide ${getBookingStatusClass(s.status)}`}>
                          {getBookingStatusLabel(s.status, lang)}
                        </span>
                        <span className="font-black text-slate-700 dark:text-slate-200">
                          {(s.bookingCount || 0).toLocaleString(lang === "VN" ? "vi-VN" : "en-US")}
                          <span className="text-slate-400 ml-1">({share.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColorForStatus(s.status)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Top routes (2/3) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
                {lang === "VN" ? "Top tuyến phổ biến" : "Top popular routes"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {lang === "VN" ? "Xếp theo số booking trong kỳ đang chọn." : "Ranked by bookings in the selected period."}
              </p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">
              {topRoutes.length} {lang === "VN" ? "tuyến" : "routes"}
            </span>
          </div>

          {topRoutesLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-900 animate-pulse" />
              ))}
            </div>
          ) : topRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <span className="material-symbols-outlined text-2xl">route</span>
              <p className="mt-1.5 text-[11px] font-bold">{lang === "VN" ? "Chưa có tuyến nào." : "No routes yet."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="text-left py-1.5 px-2 font-bold w-10">#</th>
                    <th className="text-left py-1.5 px-2 font-bold">{lang === "VN" ? "Tuyến" : "Route"}</th>
                    <th className="text-right py-1.5 px-2 font-bold">{lang === "VN" ? "Booking" : "Bookings"}</th>
                    <th className="text-right py-1.5 px-2 font-bold hidden md:table-cell">{lang === "VN" ? "Vé" : "Tickets"}</th>
                    <th className="text-right py-1.5 px-2 font-bold">{lang === "VN" ? "Doanh thu" : "Revenue"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {topRoutes.map((r, idx) => {
                    const maxBook = Math.max(...topRoutes.map(x => x.bookingCount || 0), 1);
                    const pct = ((r.bookingCount || 0) / maxBook) * 100;
                    const routeName = r.routeName
                      || [r.fromStationName, r.toStationName].filter(Boolean).join(" → ")
                      || (lang === "VN" ? "Tuyến không tên" : "Unnamed route");
                    return (
                      <tr key={r.routeId || `${idx}-${routeName}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="py-2 px-2 text-slate-400 font-black">#{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[280px]">
                            {routeName}
                          </div>
                          <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#124757] to-[#FFD100] dark:from-yellow-400 dark:to-amber-500 rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-black text-[#124757] dark:text-yellow-400 whitespace-nowrap">
                          {(r.bookingCount || 0).toLocaleString(lang === "VN" ? "vi-VN" : "en-US")}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap hidden md:table-cell">
                          {(r.ticketCount || 0).toLocaleString(lang === "VN" ? "vi-VN" : "en-US")}
                        </td>
                        <td className="py-2 px-2 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {formatCurrency(r.netRevenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===================== LOWER ROW: RECENT BOOKINGS + STATUS + TOP STATIONS ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent bookings (chiếm 2/3) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider">
                {lang === "VN" ? "Booking gần đây" : "Recent bookings"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">5 {lang === "VN" ? "mới nhất" : "most recent"}</p>
            </div>
            <Link
              to="/admin/booking-summary"
              className="inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 hover:opacity-80"
            >
              {lang === "VN" ? "Xem tất cả" : "View all"}
              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </Link>
          </div>

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
        </div>

        {/* Top stations */}
        {(() => {
          const validStations = topStations.filter(s => (s.netRevenue || 0) > 0);
          if (validStations.length === 0) {
            return (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
                <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider mb-2">
                  {lang === "VN" ? "Top bến" : "Top stations"}
                </h3>
                <p className="text-xs text-slate-400 text-center py-4">
                  {lang === "VN" ? "Dữ liệu theo bến đang được cập nhật" : "Station breakdown data is being updated"}
                </p>
              </div>
            );
          }
          return (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 dark:border-opacity-50 shadow-sm">
              <h3 className="text-sm font-headline font-black uppercase text-[#124757] dark:text-yellow-400 tracking-wider mb-2">
                {lang === "VN" ? "Top bến" : "Top stations"}
              </h3>
              <div className="space-y-2">
                {validStations.map((station, index) => {
                  const maxRev = Math.max(...validStations.map((s) => s.netRevenue || 0), 1);
                  const pct = ((station.netRevenue || 0) / maxRev) * 100;
                  return (
                    <div key={`${station.stationId || station.stationName || index}`} className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[60%]">
                          <span className="text-slate-400 mr-1">#{index + 1}</span>
                          {station.stationName || station.fromStationName || station.key || station.stationId || "--"}
                        </span>
                        <span className="font-black text-[#124757] dark:text-yellow-400">
                          {formatCurrency(station.netRevenue)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#124757] to-[#FFD100] dark:from-yellow-400 dark:to-amber-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
