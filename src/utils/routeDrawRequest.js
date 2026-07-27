/** Trạng thái yêu cầu GPS vẽ tuyến (BE). */
export const ROUTE_DRAW_STATUS = {
  PENDING: "Pending",
  IN_PROGRESS: "InProgress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const ROUTE_DRAW_STATUS_OPTIONS = [
  ROUTE_DRAW_STATUS.PENDING,
  ROUTE_DRAW_STATUS.IN_PROGRESS,
  ROUTE_DRAW_STATUS.DONE,
  ROUTE_DRAW_STATUS.CANCELLED,
];

const pick = (source, keys, fallback = "") => {
  if (!source || typeof source !== "object") return fallback;
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

export const labelRouteDrawStatus = (status, lang = "VN") => {
  const key = String(status || "").trim();
  const mapVn = {
    Pending: "Chờ xử lý",
    InProgress: "Đang vẽ",
    Done: "Hoàn tất",
    Cancelled: "Đã hủy",
  };
  const mapEn = {
    Pending: "Pending",
    InProgress: "In progress",
    Done: "Done",
    Cancelled: "Cancelled",
  };
  return (lang === "VN" ? mapVn : mapEn)[key] || key || "--";
};

export const routeDrawStatusBadgeClass = (status) => {
  switch (String(status || "").trim()) {
    case ROUTE_DRAW_STATUS.PENDING:
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";
    case ROUTE_DRAW_STATUS.IN_PROGRESS:
      return "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20";
    case ROUTE_DRAW_STATUS.DONE:
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20";
    case ROUTE_DRAW_STATUS.CANCELLED:
      return "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600";
    default:
      return "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-600";
  }
};

export const extractRouteDrawRequestList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.requests)) return payload.requests;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

export const normalizeRouteDrawStop = (stop, index = 0) => ({
  stationId: String(pick(stop, ["stationId", "station.id", "id"], "") || ""),
  stationCode: String(pick(stop, ["stationCode", "station.stationCode", "code"], "") || ""),
  stationName: String(pick(stop, ["stationName", "station.stationName", "name"], "") || ""),
  stopOrder: Number(pick(stop, ["stopOrder", "order"], index + 1)) || index + 1,
  latitude: Number(pick(stop, ["latitude", "lat", "station.latitude"], NaN)),
  longitude: Number(pick(stop, ["longitude", "lng", "lon", "station.longitude"], NaN)),
  stayDurationMinutes: Number(pick(stop, ["stayDurationMinutes", "stayMinutes"], 0)) || 0,
  note: String(pick(stop, ["note"], "") || ""),
});

export const normalizeRouteDrawRequest = (item) => {
  if (!item || typeof item !== "object") return null;

  const nested = pick(item, ["routeDrawRequest", "latestRouteDrawRequest"], null);
  const source = nested && typeof nested === "object" ? { ...item, ...nested } : item;

  const stopsRaw = pick(source, ["stops", "requestStops", "itineraryStops"], []);
  const stops = (Array.isArray(stopsRaw) ? stopsRaw : [])
    .map((stop, index) => normalizeRouteDrawStop(stop, index))
    .sort((a, b) => a.stopOrder - b.stopOrder);

  const candidateRoute = pick(source, ["candidateRoute"], null);
  const resultRoute = pick(source, ["resultRoute"], null);
  const candidateLegs = pick(source, ["candidateLegs"], []);

  return {
    raw: item,
    requestId: String(pick(source, ["requestId", "id", "routeDrawRequestId"], "") || ""),
    bookingId: String(pick(source, ["bookingId", "charterBookingId", "charterBooking.id"], "") || ""),
    bookingCode: String(pick(source, ["bookingCode", "charterBooking.bookingCode", "code"], "") || ""),
    status: String(pick(source, ["status", "requestStatus"], "") || ""),
    notes: String(pick(source, ["notes", "note"], "") || ""),
    stops,
    candidateRoute: candidateRoute && typeof candidateRoute === "object" ? candidateRoute : null,
    candidateLegs: Array.isArray(candidateLegs) ? candidateLegs : [],
    resultRoute: resultRoute && typeof resultRoute === "object" ? resultRoute : null,
    resultRouteId: String(
      pick(source, ["resultRouteId", "routeId", "resultRoute.routeId", "resultRoute.id"], "")
      || pick(resultRoute || {}, ["routeId", "id"], "")
      || "",
    ),
    createdAt: pick(source, ["createdAt", "requestedAt"], ""),
    updatedAt: pick(source, ["updatedAt", "completedAt"], ""),
  };
};

/** Booking chưa có tuyến chốt → cần (hoặc đã) gửi GPS vẽ. */
export const bookingNeedsGpsRouteDraw = (booking) => {
  if (!booking) return false;
  const selectedId = String(
    booking?.selectedRoute?.routeId
    || booking?.selectedRouteId
    || booking?.charterRouteId
    || "",
  ).trim();
  return !selectedId;
};

export const isActiveRouteDrawStatus = (status) => {
  const key = String(status || "").trim();
  return key === ROUTE_DRAW_STATUS.PENDING || key === ROUTE_DRAW_STATUS.IN_PROGRESS;
};
