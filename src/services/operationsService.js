import { getOperationsSchedule as apiGetOperationsSchedule } from "../api/operationsApi";
import { normalizeDwellCountdown } from "../utils/boatTracking";
import { normalizeTripStops } from "../utils/tripStopTimes";

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
    case "arrived":
      return isVn ? "Đã cập bến" : "Arrived";
    case "departed":
    case "departing":
      return isVn ? "Đã rời bến" : "Departed";
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
  const tripIdEarly = pick(raw, ["tripId", "TripId"], null) || null;
  const tripCodeEarly = String(pick(raw, ["tripCode", "TripCode"], "")).trim();
  // Customer schedule có thể trả trip chưa gán tàu — vẫn giữ entry.
  if (!boatCode && !boatId && !tripIdEarly && !tripCodeEarly) return null;

  const lat = toFiniteNumber(pick(raw, [
    "latestLatitude", "LatestLatitude", "latitude", "lat", "Latitude",
  ], null));
  const lng = toFiniteNumber(pick(raw, [
    "latestLongitude", "LatestLongitude", "longitude", "lng", "Longitude",
  ], null));
  const remainingKm = (() => {
    const km = toFiniteNumber(pick(raw, [
      "remainingDistanceKmToNextStation",
      "RemainingDistanceKmToNextStation",
      "remainingDistanceKm",
      "distanceKmToNextStation",
    ], null));
    if (km != null && km >= 0) return km;
    const meters = toFiniteNumber(pick(raw, [
      "remainingDistanceMetersToNextStation",
      "RemainingDistanceMetersToNextStation",
      "remainingDistanceM",
      "distanceMetersToNextStation",
      "DistanceToNextStationMeters",
    ], null));
    if (meters != null && meters >= 0) return meters / 1000;
    return null;
  })();
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

  const delayMinutes = toFiniteNumber(pick(raw, [
    "delayMinutes", "DelayMinutes", "replacementDelayMinutes",
  ], null));
  const delayReason = String(pick(raw, [
    "delayReason", "DelayReason",
  ], "")).trim() || null;
  const adjustedStartAt = pick(raw, [
    "adjustedStartAt", "AdjustedStartAt", "adjustedDepartureAt",
  ], null) || null;
  const adjustedEndAt = pick(raw, [
    "adjustedEndAt", "AdjustedEndAt", "adjustedArrivalAt",
  ], null) || null;
  const operationStatus = String(pick(raw, [
    "operationStatus", "OperationStatus", "operationalStatus", "status",
  ], "")).trim() || null;

  const dwellCountdown = normalizeDwellCountdown(raw);
  // Ưu tiên tổng khách chuyến (totalPassengerCount), không dùng ghế còn.
  const passengerSource = pick(raw, [
    "totalPassengerCount", "TotalPassengerCount",
    "onboardPassengerCount", "OnboardPassengerCount",
    "passengerCount", "PassengerCount",
  ], null);
  const passengerCount = toFiniteNumber(passengerSource);
  const capacitySnapshot = toFiniteNumber(pick(raw, [
    "capacitySnapshot", "CapacitySnapshot", "capacity", "seatCount",
  ], null));

  const startAt = pick(raw, [
    "startAt", "StartAt", "scheduledDepartureAt", "ScheduledDepartureAt",
    "departureTime", "DepartureTime",
  ], null) || scheduledDepartureAt;
  const endAt = pick(raw, [
    "endAt", "EndAt", "scheduledArrivalAt", "ScheduledArrivalAt",
    "arrivalTime", "ArrivalTime",
  ], null) || null;
  const displayStartAt = adjustedStartAt || startAt || null;
  const displayEndAt = adjustedEndAt || endAt || null;

  const serviceType = String(pick(raw, [
    "serviceType", "ServiceType",
  ], "")).trim() || null;
  const routeType = String(pick(raw, [
    "routeType", "RouteType",
  ], "")).trim() || null;
  const tripType = String(pick(raw, [
    "tripType", "TripType",
  ], "")).trim() || null;
  const sellsBySegmentRaw = pick(raw, ["sellsBySegment", "SellsBySegment"], null);
  const sellsBySegment = sellsBySegmentRaw === true || sellsBySegmentRaw === false
    ? Boolean(sellsBySegmentRaw)
    : sellsBySegmentRaw == null
      ? null
      : String(sellsBySegmentRaw).toLowerCase() === "true";

  const stops = normalizeTripStops(raw.stops || raw.Stops || []);
  const fromLocation = String(pick(raw, [
    "fromLocation", "FromLocation", "fromStationName", "fromStation.stationName",
  ], "")).trim() || (stops[0]?.stationName || null);
  const toLocation = String(pick(raw, [
    "toLocation", "ToLocation", "toStationName", "toStation.stationName",
  ], "")).trim() || (stops.length ? (stops[stops.length - 1]?.stationName || null) : null);

  return {
    boatId: boatId || boatCode || String(tripIdEarly || ""),
    boatCode: boatCode || boatId || "",
    boatName: pick(raw, ["boatName", "BoatName", "boat.boatName"], "") || null,
    tripId: tripIdEarly,
    tripCode: tripCodeEarly || pick(raw, ["tripCode", "TripCode"], "") || null,
    routeName: pick(raw, ["routeName", "RouteName"], "") || null,
    routeCode: pick(raw, ["routeCode", "RouteCode"], "") || null,
    routeType,
    tripType,
    serviceType,
    sellsBySegment,
    capacitySnapshot,
    fromLocation,
    toLocation,
    stops,
    movementStatus,
    currentStationName,
    currentStationCode,
    nextStationId,
    nextStationName,
    nextStationCode,
    remainingDistanceKmToNextStation: remainingKm,
    remainingMinutesToNextStation: remainingMin,
    scheduledDepartureAt,
    startAt,
    endAt,
    minutesUntilDeparture,
    latestLatitude: lat,
    latestLongitude: lng,
    latestSpeedKmh: speed,
    isGpsOnline,
    delayMinutes,
    delayReason,
    adjustedStartAt,
    adjustedEndAt,
    displayStartAt,
    displayEndAt,
    operationStatus,
    dwellCountdown,
    passengerCount,
    totalPassengerCount: toFiniteNumber(pick(raw, [
      "totalPassengerCount", "TotalPassengerCount",
    ], null)),
    lastStopEvent: String(pick(raw, [
      "lastStopEvent", "LastStopEvent", "stopEvent", "StopEvent",
      "tripStopEvent", "TripStopEvent", "latestStopEvent",
    ], "")).trim() || null,
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
  /** booking | bus | sightseeing | charter | all — theo contract BE. */
  serviceType,
  stationId,
} = {}) => {
  const params = {
    fromDate,
    toDate,
    includeCancelled,
  };
  const st = String(serviceType || "").trim().toLowerCase();
  if (st && st !== "all") {
    params.serviceType = st;
  }
  const sid = String(stationId || "").trim();
  if (sid) params.stationId = sid;

  const data = await apiGetOperationsSchedule(params);
  return normalizeOperationsScheduleList(data);
};

export const toOperationsScheduleDate = toIsoDate;
