/** Alias field giờ bến — BE mới (*At) + FE cũ. */

export const pickStopScheduledArrival = (stop) => (
  stop?.scheduledArrivalAt
  ?? stop?.ScheduledArrivalAt
  ?? stop?.scheduledArrival
  ?? stop?.ScheduledArrival
  ?? null
);

export const pickStopScheduledDeparture = (stop) => (
  stop?.scheduledDepartureAt
  ?? stop?.ScheduledDepartureAt
  ?? stop?.scheduledDeparture
  ?? stop?.ScheduledDeparture
  ?? stop?.plannedDepartureTime
  ?? null
);

export const pickStopAdjustedArrival = (stop) => (
  stop?.adjustedArrivalAt
  ?? stop?.AdjustedArrivalAt
  ?? stop?.adjustedArrival
  ?? stop?.adjustedArrivalTime
  ?? null
);

export const pickStopAdjustedDeparture = (stop) => (
  stop?.adjustedDepartureAt
  ?? stop?.AdjustedDepartureAt
  ?? stop?.adjustedDeparture
  ?? stop?.adjustedDepartureTime
  ?? null
);

export const pickStopActualArrival = (stop) => (
  stop?.actualArrivalAt
  ?? stop?.ActualArrivalAt
  ?? stop?.actualArrival
  ?? stop?.ActualArrival
  ?? null
);

export const pickStopActualDeparture = (stop) => (
  stop?.actualDepartureAt
  ?? stop?.ActualDepartureAt
  ?? stop?.actualDeparture
  ?? stop?.ActualDeparture
  ?? null
);

/**
 * Rule FE theo BE:
 * arrival = actualArrivalAt ?? adjustedArrivalAt ?? scheduledArrivalAt
 * departure = actualDepartureAt ?? adjustedDepartureAt ?? scheduledDepartureAt
 */
export const pickStopDisplayArrival = (stop) => (
  pickStopActualArrival(stop)
  ?? pickStopAdjustedArrival(stop)
  ?? pickStopScheduledArrival(stop)
);

export const pickStopDisplayDeparture = (stop) => (
  pickStopActualDeparture(stop)
  ?? pickStopAdjustedDeparture(stop)
  ?? pickStopScheduledDeparture(stop)
);

/** Chuẩn hóa 1 stop về field FE quen thuộc + giữ *At gốc. */
const toStopPassengerCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
};

export const normalizeTripStop = (stop) => {
  if (!stop || typeof stop !== "object") return stop;
  const scheduledArrival = pickStopScheduledArrival(stop);
  const scheduledDeparture = pickStopScheduledDeparture(stop);
  const adjustedArrival = pickStopAdjustedArrival(stop);
  const adjustedDeparture = pickStopAdjustedDeparture(stop);
  const actualArrival = pickStopActualArrival(stop);
  const actualDeparture = pickStopActualDeparture(stop);
  const stay = stop.stayDurationMinutes ?? stop.StayDurationMinutes;
  const stayN = stay === null || stay === undefined || stay === "" ? null : Number(stay);

  return {
    ...stop,
    stopOrder: stop.stopOrder ?? stop.StopOrder ?? null,
    stationId: stop.stationId ?? stop.StationId ?? stop.station?.stationId ?? null,
    stationCode: stop.stationCode
      ?? stop.StationCode
      ?? stop.station?.stationCode
      ?? stop.station?.code
      ?? null,
    stationName: stop.stationName
      ?? stop.StationName
      ?? stop.station?.stationName
      ?? stop.station?.name
      ?? null,
    scheduledArrival,
    scheduledDeparture,
    adjustedArrival,
    adjustedDeparture,
    actualArrival,
    actualDeparture,
    scheduledArrivalAt: scheduledArrival,
    scheduledDepartureAt: scheduledDeparture,
    adjustedArrivalAt: adjustedArrival,
    adjustedDepartureAt: adjustedDeparture,
    actualArrivalAt: actualArrival,
    actualDepartureAt: actualDeparture,
    stayDurationMinutes: Number.isFinite(stayN) ? stayN : (stop.stayDurationMinutes ?? null),
    stopStatus: stop.stopStatus ?? stop.StopStatus ?? null,
    // Contract BE trip detail stops[] — số khách theo bến/đoạn.
    boardingPassengerCount: toStopPassengerCount(stop.boardingPassengerCount ?? stop.BoardingPassengerCount),
    alightingPassengerCount: toStopPassengerCount(stop.alightingPassengerCount ?? stop.AlightingPassengerCount),
    onboardPassengerCount: toStopPassengerCount(stop.onboardPassengerCount ?? stop.OnboardPassengerCount),
    segmentPassengerCount: toStopPassengerCount(stop.segmentPassengerCount ?? stop.SegmentPassengerCount),
  };
};

export const normalizeTripStops = (stops) => (
  Array.isArray(stops) ? stops.map(normalizeTripStop).filter(Boolean) : []
);

/** Cửa sổ lên tàu trước giờ khởi hành/đi bến (đồng bộ rule khóa đặt vé 10 phút). */
export const STOP_BOARDING_LEAD_MS = 10 * 60 * 1000;

const toMs = (value) => {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
};

const normalizeRawStopStatus = (raw) => {
  const key = String(raw || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!key) return "";
  if (key.includes("skip")) return "skipped";
  if (key.includes("cancel")) return "cancelled";
  if (key.includes("delay") || key.includes("late")) return "delayed";
  if (key.includes("depart") || key === "left" || key === "completed") return "departed";
  if (key.includes("arriv") || key === "atstation" || key === "atberth" || key === "docked") return "arrived";
  if (key.includes("board")) return "boarding";
  if (key.includes("schedule") || key === "pending" || key === "upcoming" || key === "waiting") return "scheduled";
  return key;
};

/**
 * Trạng thái từng bến theo giờ lịch + actual (nếu có).
 * - Giờ chưa tới (>10p) → Chờ — không tin stopStatus/actual sớm từ BE
 * - Bến đầu: trong 10 phút trước giờ đi → Đang lên tàu; đã rời → Đã rời
 * - Chỉ bến SẮP TỚI (isNextApproach) → Đang chạy / Đang tới đích
 * - Các bến phía sau chưa tới → vẫn Chờ
 * - Bến giữa: tới giờ đến → Đã cập; sau giờ đi → Đã rời
 * - Bến cuối: tới giờ đến → Đã tới đích
 */
export const resolveStopStatusKey = (
  stop,
  {
    isFirst = false,
    isLast = false,
    /** true = đây là bến tiếp theo tàu đang hướng tới (duy nhất được "Đang chạy"). */
    isNextApproach = false,
    tripStatusKey = "",
    now = Date.now(),
    boardingLeadMs = STOP_BOARDING_LEAD_MS,
    /** Fallback giờ khởi hành chuyến khi stop thiếu timestamp parse được. */
    tripStartAt = null,
  } = {},
) => {
  const tripKey = String(tripStatusKey || "").trim();
  if (tripKey === "Cancelled") return "cancelled";

  // Chỉ dùng giờ lịch/điều chỉnh — không dùng actual làm mốc (tránh actual sớm làm lệch cửa sổ).
  const scheduledArrMs = toMs(pickStopAdjustedArrival(stop))
    ?? toMs(pickStopScheduledArrival(stop));
  const scheduledDepMs = toMs(pickStopAdjustedDeparture(stop))
    ?? toMs(pickStopScheduledDeparture(stop))
    ?? (isFirst ? toMs(tripStartAt) : null);
  const startMs = toMs(tripStartAt) ?? (isFirst ? scheduledDepMs : null);
  const eventMs = isFirst
    ? (scheduledDepMs ?? scheduledArrMs ?? startMs)
    : (scheduledArrMs ?? scheduledDepMs);
  // Đã qua giờ khởi hành / BE báo đang chạy.
  const tripLeftOrigin = tripKey === "InProgress"
    || tripKey === "Delayed"
    || (startMs != null && now >= startMs);

  // Bến đầu: còn >10p trước giờ đi → luôn Chờ (bỏ qua BE Arrived/Boarding + actual sớm).
  if (isFirst && eventMs != null && now < eventMs - boardingLeadMs) {
    return "scheduled";
  }
  // Bến khác chưa tới giờ đến: chỉ bến sắp tới → Đang chạy; còn lại → Chờ.
  if (!isFirst && eventMs != null && now < eventMs) {
    const rawEarly = normalizeRawStopStatus(stop?.stopStatus || stop?.StopStatus);
    if (rawEarly === "skipped" || rawEarly === "cancelled" || rawEarly === "delayed") return rawEarly;
    if (tripLeftOrigin && isNextApproach) return "enroute";
    return "scheduled";
  }

  const actualArrMs = toMs(pickStopActualArrival(stop));
  const actualDepMs = toMs(pickStopActualDeparture(stop));
  const credibleActual = (actualMs, scheduledMs) => {
    if (actualMs == null || actualMs > now + 60_000) return false;
    if (scheduledMs != null && actualMs < scheduledMs - boardingLeadMs) return false;
    return true;
  };
  const hasDep = credibleActual(actualDepMs, scheduledDepMs ?? eventMs);
  const hasArr = credibleActual(actualArrMs, scheduledArrMs ?? eventMs);
  if (hasDep) return "departed";
  if (hasArr) {
    if (isFirst) return "boarding";
    return "arrived";
  }

  const rawKey = normalizeRawStopStatus(stop?.stopStatus || stop?.StopStatus);
  if (rawKey === "skipped" || rawKey === "cancelled" || rawKey === "delayed") return rawKey;
  if (
    (rawKey === "boarding" || rawKey === "arrived" || rawKey === "departed")
    && eventMs != null
    && now >= eventMs - boardingLeadMs
  ) {
    if (rawKey === "arrived" && isFirst) return "boarding";
    return rawKey;
  }

  if (tripKey === "Completed") {
    if (isLast) return "arrived";
    if (eventMs != null && now >= eventMs) return "departed";
  }

  if (isFirst) {
    if (eventMs == null) return "scheduled";
    if (now < eventMs) return "boarding";
    return "departed";
  }

  if (isLast) {
    if (scheduledArrMs != null && now >= scheduledArrMs) return "arrived";
    if (tripLeftOrigin && isNextApproach) return "enroute";
    return "scheduled";
  }

  if (scheduledArrMs != null && now < scheduledArrMs) {
    return (tripLeftOrigin && isNextApproach) ? "enroute" : "scheduled";
  }
  if (scheduledArrMs != null && (scheduledDepMs == null || now < scheduledDepMs)) return "arrived";
  if (scheduledDepMs != null && now >= scheduledDepMs) return "departed";
  if (scheduledArrMs != null && now >= scheduledArrMs) return "arrived";
  return "scheduled";
};

/**
 * Index bến tiếp theo tàu đang hướng tới (chưa cập, chưa đang dừng tại bến).
 * -1 nếu chưa rời gốc / đang dừng tại bến / đã tới đích.
 */
export const findNextApproachStopIndex = (
  stops,
  {
    tripStatusKey = "",
    now = Date.now(),
    boardingLeadMs = STOP_BOARDING_LEAD_MS,
    tripStartAt = null,
  } = {},
) => {
  const list = Array.isArray(stops) ? stops : [];
  if (!list.length) return -1;

  const credibleActual = (actualMs, scheduledMs) => {
    if (actualMs == null || actualMs > now + 60_000) return false;
    if (scheduledMs != null && actualMs < scheduledMs - boardingLeadMs) return false;
    return true;
  };

  for (let i = 0; i < list.length; i += 1) {
    const stop = list[i];
    const isFirst = i === 0;
    const isLast = i === list.length - 1;
    const scheduledArrMs = toMs(pickStopAdjustedArrival(stop))
      ?? toMs(pickStopScheduledArrival(stop));
    const scheduledDepMs = toMs(pickStopAdjustedDeparture(stop))
      ?? toMs(pickStopScheduledDeparture(stop))
      ?? (isFirst ? toMs(tripStartAt) : null);
    const actualArrMs = toMs(pickStopActualArrival(stop));
    const actualDepMs = toMs(pickStopActualDeparture(stop));
    const hasDep = credibleActual(actualDepMs, scheduledDepMs);
    const hasArr = credibleActual(actualArrMs, scheduledArrMs);

    if (isFirst) {
      const depMs = scheduledDepMs ?? toMs(tripStartAt);
      if (hasDep || (depMs != null && now >= depMs)) continue;
      return -1; // còn ở bến đầu
    }

    // Đã rời bến này → xét bến sau.
    if (hasDep || (!isLast && scheduledDepMs != null && now >= scheduledDepMs)) continue;

    // Đang dừng / đã cập bến này → chưa hướng tới bến sau.
    if (hasArr || (scheduledArrMs != null && now >= scheduledArrMs)) {
      return -1;
    }

    // Chưa tới giờ đến → đây là bến đang chạy tới.
    return i;
  }
  return -1;
};

/** Resolve status key cho cả lộ trình — chỉ 1 bến được đánh dấu isNextApproach. */
export const resolveTripStopStatusKeys = (stops, opts = {}) => {
  const list = Array.isArray(stops) ? stops : [];
  const nextIdx = findNextApproachStopIndex(list, opts);
  return list.map((stop, index) => resolveStopStatusKey(stop, {
    ...opts,
    isFirst: index === 0,
    isLast: index === list.length - 1,
    isNextApproach: index === nextIdx,
  }));
};

export const getStopStatusLabel = (stopOrKey, lang = "VN", opts = {}) => {
  const key = typeof stopOrKey === "string"
    ? String(stopOrKey).toLowerCase().replace(/[\s_-]/g, "")
    : resolveStopStatusKey(stopOrKey, opts);
  const isVn = lang === "VN";
  switch (key) {
    case "departed":
      return isVn ? "Đã rời" : "Departed";
    case "arrived":
      return isVn ? (opts.isLast ? "Đã tới đích" : "Đã cập") : (opts.isLast ? "Arrived" : "At berth");
    case "boarding":
      return isVn ? "Đang lên tàu" : "Boarding";
    case "enroute":
      // Bến cuối không "rời" — đang trên đường tới đích, không dùng chữ "Đang chạy".
      return isVn
        ? (opts.isLast ? "Đang tới đích" : "Đang chạy")
        : (opts.isLast ? "Approaching" : "En route");
    case "delayed":
      return isVn ? "Trễ" : "Delayed";
    case "skipped":
      return isVn ? "Bỏ qua" : "Skipped";
    case "cancelled":
    case "canceled":
      return isVn ? "Hủy" : "Cancelled";
    case "scheduled":
    default:
      return isVn ? "Chờ" : "Scheduled";
  }
};

export const getStopStatusBadgeClass = (stopOrKey, opts = {}) => {
  const key = typeof stopOrKey === "string"
    ? String(stopOrKey).toLowerCase().replace(/[\s_-]/g, "")
    : resolveStopStatusKey(stopOrKey, opts);
  switch (key) {
    case "departed":
      return "text-slate-600 dark:text-slate-300";
    case "arrived":
      return "text-sky-700 dark:text-sky-300";
    case "boarding":
      return "text-amber-700 dark:text-amber-300";
    case "enroute":
      return "text-teal-700 dark:text-teal-300";
    case "delayed":
      return "text-orange-700 dark:text-orange-300";
    case "skipped":
    case "cancelled":
    case "canceled":
      return "text-rose-700 dark:text-rose-300";
    case "scheduled":
    default:
      return "text-slate-500 dark:text-slate-400";
  }
};
