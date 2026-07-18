import { getOperationsSchedule as apiGetOperationsSchedule } from "../api/operationsApi";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.schedules)) return data.schedules;
  if (Array.isArray(data?.trips)) return data.trips;
  if (Array.isArray(data?.boats)) return data.boats;
  return [];
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toIsoDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Map movementStatus BE → nhãn VN/EN (contract FE). */
export const getMovementStatusLabel = (status, lang = "VN") => {
  const key = String(status || "").trim().toLowerCase().replace(/[_\s-]/g, "");
  const isVn = lang === "VN";
  switch (key) {
    case "scheduled":
      return isVn ? "Chưa chạy" : "Scheduled";
    case "boarding":
      return isVn ? "Đang chuẩn bị / chờ xuất bến" : "Boarding";
    case "moving":
      return isVn ? "Đang di chuyển" : "Moving";
    case "arriving":
      return isVn ? "Sắp cập bến" : "Arriving";
    case "atstation":
      return isVn ? "Đang ở bến" : "At station";
    case "delayed":
      return isVn ? "Trễ" : "Delayed";
    case "completed":
      return isVn ? "Hoàn tất" : "Completed";
    case "cancelled":
    case "canceled":
      return isVn ? "Hủy" : "Cancelled";
    default:
      return status ? String(status) : "";
  }
};

export const normalizeOperationsScheduleEntry = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const boatCode = String(pick(raw, ["boatCode", "BoatCode", "boat.boatCode", "boat.code"], "")).trim();
  const boatId = String(pick(raw, ["boatId", "BoatId", "boat.boatId", "boat.id"], "")).trim();
  if (!boatCode && !boatId) return null;

  const lat = toFiniteNumber(pick(raw, [
    "latestLatitude", "LatestLatitude", "latitude", "lat", "Latitude",
  ], null));
  const lng = toFiniteNumber(pick(raw, [
    "latestLongitude", "LatestLongitude", "longitude", "lng", "Longitude",
  ], null));
  const remainingKm = toFiniteNumber(pick(raw, [
    "remainingDistanceKmToNextStation",
    "RemainingDistanceKmToNextStation",
    "remainingDistanceKm",
    "distanceKmToNextStation",
  ], null));
  const remainingMin = toFiniteNumber(pick(raw, [
    "remainingMinutesToNextStation",
    "RemainingMinutesToNextStation",
    "etaMinutesToNextStation",
    "remainingMinutes",
  ], null));
  const speed = toFiniteNumber(pick(raw, [
    "latestSpeedKmh", "LatestSpeedKmh", "speedKmh", "speed",
  ], null));

  const movementStatus = String(pick(raw, [
    "movementStatus", "MovementStatus", "status",
  ], "")).trim() || null;

  const nextStationName = String(pick(raw, [
    "nextStationName", "NextStationName", "nextStation.stationName", "nextStation.name",
  ], "")).trim() || null;
  const nextStationCode = String(pick(raw, [
    "nextStationCode", "NextStationCode", "nextStation.stationCode", "nextStation.code",
  ], "")).trim() || null;
  const nextStationId = String(pick(raw, [
    "nextStationId", "NextStationId", "nextStation.stationId", "nextStation.id",
  ], "")).trim() || null;

  const currentStationName = (() => {
    const v = pick(raw, [
      "currentStationName", "CurrentStationName", "currentStation.stationName", "currentStation.name",
    ], null);
    if (v === null || v === undefined || v === "") return null;
    return String(v).trim() || null;
  })();
  const currentStationCode = String(pick(raw, [
    "currentStationCode", "CurrentStationCode", "currentStation.stationCode",
  ], "")).trim() || null;

  const scheduledDepartureAt = pick(raw, [
    "scheduledDepartureAt",
    "ScheduledDepartureAt",
    "departureTime",
    "DepartureTime",
    "scheduledDeparture",
    "ScheduledDeparture",
  ], null) || null;
  const minutesUntilDepartureRaw = toFiniteNumber(pick(raw, [
    "minutesUntilDeparture",
    "MinutesUntilDeparture",
    "minutesToDeparture",
    "remainingMinutesToDeparture",
  ], null));
  let minutesUntilDeparture = minutesUntilDepartureRaw;
  if (minutesUntilDeparture == null && scheduledDepartureAt) {
    const ts = Date.parse(String(scheduledDepartureAt));
    if (!Number.isNaN(ts)) {
      minutesUntilDeparture = Math.round((ts - Date.now()) / 60000);
    }
  }

  const gpsOnlineRaw = pick(raw, ["isGpsOnline", "IsGpsOnline", "isOnline"], null);
  const isGpsOnline = gpsOnlineRaw === true
    || gpsOnlineRaw === false
    ? Boolean(gpsOnlineRaw)
    : String(gpsOnlineRaw || "").toLowerCase() === "true"
      ? true
      : String(gpsOnlineRaw || "").toLowerCase() === "false"
        ? false
        : null;

  return {
    boatId: boatId || boatCode,
    boatCode: boatCode || boatId,
    boatName: pick(raw, ["boatName", "BoatName", "boat.boatName"], "") || null,
    tripId: pick(raw, ["tripId", "TripId"], null) || null,
    tripCode: pick(raw, ["tripCode", "TripCode"], "") || null,
    routeName: pick(raw, ["routeName", "RouteName"], "") || null,
    movementStatus,
    currentStationName,
    currentStationCode,
    nextStationId,
    nextStationName,
    nextStationCode,
    remainingDistanceKmToNextStation: remainingKm,
    remainingMinutesToNextStation: remainingMin,
    scheduledDepartureAt,
    minutesUntilDeparture,
    latestLatitude: lat,
    latestLongitude: lng,
    latestSpeedKmh: speed,
    isGpsOnline,
    recordedAt: pick(raw, ["recordedAt", "RecordedAt", "updatedAt", "gpsRecordedAt"], null) || null,
    raw,
  };
};

export const normalizeOperationsScheduleList = (payload) =>
  unwrapList(payload).map(normalizeOperationsScheduleEntry).filter(Boolean);

/** Index theo boatId + boatCode (upper) — 1 tàu lấy entry “đang chạy” ưu tiên. */
export const indexOperationsScheduleByBoat = (entries = []) => {
  const rank = (entry) => {
    const key = String(entry?.movementStatus || "").toLowerCase().replace(/[_\s-]/g, "");
    if (key === "moving" || key === "arriving") return 0;
    if (key === "boarding" || key === "atstation" || key === "delayed") return 1;
    if (key === "scheduled") return 2;
    if (key === "completed" || key === "cancelled" || key === "canceled") return 4;
    return 3;
  };

  const map = new Map();
  const put = (key, entry) => {
    if (!key) return;
    const prev = map.get(key);
    if (!prev || rank(entry) < rank(prev)) map.set(key, entry);
  };

  entries.forEach((entry) => {
    put(String(entry.boatId || "").trim(), entry);
    put(String(entry.boatCode || "").trim(), entry);
    put(String(entry.boatCode || "").trim().toUpperCase(), entry);
  });
  return map;
};

export const fetchOperationsSchedule = async ({
  fromDate = toIsoDate(),
  toDate = fromDate,
  includeCancelled = false,
} = {}) => {
  const data = await apiGetOperationsSchedule({
    fromDate,
    toDate,
    includeCancelled,
  });
  return normalizeOperationsScheduleList(data);
};

export const toOperationsScheduleDate = toIsoDate;
