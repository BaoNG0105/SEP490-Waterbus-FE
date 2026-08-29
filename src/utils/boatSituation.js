import { isBoatUnderMaintenance, resolveBoatLiveStatus, formatDwellCountdownNotice } from "./boatTracking";
import { getMovementStatusLabel } from "../services/operationsService";

const APPROACH_METERS = 400;
const MOVING_KMH = 1.2;
const DOCK_METERS = 150;
/** ≤1 phút mới coi “chuẩn bị cập / sắp cập” — ~2p với ~1km vẫn là đang chạy (khớp panel GPS). */
const DOCKING_SOON_MIN = 1;
const APPROACHING_SOON_MIN = 5; // <=5: sắp đến trong n phút
/** Sát bến mới gọi “sắp cập” khi tàu vẫn còn tốc độ. */
const DOCKING_NEAR_METERS = 250;
/** Thông báo cập/rời bến hiện ngắn rồi ẩn; có event mới thì hiện lại. */
const ARRIVED_HIDE_MS = 12_000;
const NOTICE_FLASH_MS = 12_000;
const STARTING_SOON_MIN = 10;
const BOARDING_SOON_MIN = 2;

const toRad = (deg) => (deg * Math.PI) / 180;

export const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const shortStationCode = (code) => {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return "";
  return raw.replace(/^ST[-_\s]*/i, "") || raw;
};

const normalizeMovementKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[_\s-]/g, "");

export const findNearestStation = (boat, stations = []) => {
  const lat = Number(boat?.latitude);
  const lng = Number(boat?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let best = null;
  stations.forEach((station) => {
    const sLat = Number(station?.latitude);
    const sLng = Number(station?.longitude);
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) return;
    const meters = haversineMeters(lat, lng, sLat, sLng);
    if (!best || meters < best.meters) {
      best = { station, meters };
    }
  });
  return best;
};

/** Cùng code bến (ST-BD / ST-TD / ST-BD/...) giữa BE báo và station list — chuẩn hoá. */
const normalizeStationCodeKey = (code) => {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return "";
  return raw.replace(/^ST[-_\s]*/i, "");
};

const STATION_MATCH_METERS = 80;

/**
 * BE đã drop currentStationCode khi packet lệch GPS >80m, nhưng cache/sticky code cũ vẫn có thể
 * trả cho client (response 10(s) vẫn dùng bản ghi cũ). FE tự validate theo GPS:
 *   1. Nếu `reportedCode` resolve tới 1 station ∈ stations và cách GPS ≤80m → giữ nguyên.
 *   2. Nếu >80m đối với station resolve từ reportedCode → drop stale code.
 *   3. Nếu GPS ≤80m của bất cứ station nào → fill nearest (kể cả khi BE không gửi).
 *   4. Không có → trả null hết (không fill bừa).
 */
export const resolveStationAgainstGps = ({
  stations = [],
  lat,
  lng,
  reportedCode = null,
  reportedName = null,
  reportedId = null,
  matchMeters = STATION_MATCH_METERS,
} = {}) => {
  const gpsLat = Number(lat);
  const gpsLng = Number(lng);
  const hasGps = Number.isFinite(gpsLat) && Number.isFinite(gpsLng);
  const list = Array.isArray(stations) ? stations : [];
  const codeKey = normalizeStationCodeKey(reportedCode);

  const closest = hasGps
    ? findNearestStation({ latitude: gpsLat, longitude: gpsLng }, list)
    : null;

  const reportedStation = codeKey
    ? list.find((station) => normalizeStationCodeKey(station?.stationCode || station?.code) === codeKey)
    : null;

  const reportedDistance = (reportedStation && hasGps)
    ? haversineMeters(gpsLat, gpsLng, Number(reportedStation.latitude), Number(reportedStation.longitude))
    : null;

  if (reportedStation && Number.isFinite(reportedDistance) && reportedDistance <= matchMeters) {
    return {
      id: String(reportedStation.stationId || reportedStation.id || reportedId || "").trim() || null,
      code: String(reportedStation.stationCode || reportedStation.code || reportedCode || "").trim() || null,
      name: String(reportedStation.stationName || reportedStation.name || reportedName || "").trim() || null,
      distance: Math.round(reportedDistance),
      source: "reported",
    };
  }

  if (closest && Number.isFinite(closest.meters) && closest.meters <= matchMeters) {
    const station = closest.station;
    return {
      id: String(station?.stationId || station?.id || "").trim() || null,
      code: String(station?.stationCode || station?.code || "").trim() || null,
      name: String(station?.stationName || station?.name || "").trim() || null,
      distance: Math.round(closest.meters),
      source: "nearest",
    };
  }

  return {
    id: null,
    code: null,
    name: null,
    distance: null,
    source: "none",
  };
};

/** Tìm bến theo id/code/name — chỉ khớp chặt (có lat/lng để đối chiếu). */
export const findStationByRef = (stations = [], ref = {}) => {
  const id = String(ref?.id || "").trim().toLowerCase();
  const codeRaw = String(ref?.code || "").trim().toUpperCase();
  const code = shortStationCode(codeRaw).toUpperCase();
  const name = String(ref?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!id && !code && !name) return null;

  const list = Array.isArray(stations) ? stations : [];
  let best = null;

  list.forEach((station) => {
    const sLat = Number(station?.latitude ?? station?.lat);
    const sLng = Number(station?.longitude ?? station?.lng ?? station?.lon);
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) return;

    const sid = String(station?.stationId || station?.id || "").trim().toLowerCase();
    const scodeRaw = String(station?.stationCode || station?.code || "").trim().toUpperCase();
    const scode = shortStationCode(scodeRaw).toUpperCase();
    const sname = String(station?.stationName || station?.name || "").trim().toLowerCase().replace(/\s+/g, " ");

    let score = 0;
    let matchBy = "";
    if (id && sid && id === sid) {
      score = 100;
      matchBy = "stationId";
    } else if (code && scode && (code === scode || codeRaw === scodeRaw)) {
      score = 80;
      matchBy = "stationCode";
    } else if (name && sname && name === sname) {
      score = 60;
      matchBy = "stationName";
    } else if (name && sname && (sname.endsWith(name) || name.endsWith(sname)) && Math.min(name.length, sname.length) >= 6) {
      // "Bạch Đằng" ↔ "Bến Bạch Đằng" — không dùng includes lỏng.
      score = 40;
      matchBy = "stationNameSuffix";
    }
    if (!score) return;
    if (!best || score > best.score) {
      best = {
        station,
        stationId: sid,
        stationCode: scodeRaw || scode,
        stationName: station?.stationName || station?.name || "",
        latitude: sLat,
        longitude: sLng,
        score,
        matchBy,
      };
    }
  });

  return best;
};

export const DOCK_METERS_EXPORT = DOCK_METERS;

const resolveMinutesUntilDeparture = (boat) => {
  const direct = Number(boat?.minutesUntilDeparture);
  if (Number.isFinite(direct)) return direct;
  const ts = Date.parse(String(boat?.scheduledDepartureAt || ""));
  if (!Number.isNaN(ts)) return Math.round((ts - Date.now()) / 60000);
  return null;
};

const isMovingBoat = (boat, movementKey = "") => {
  const speed = Number(boat?.speed);
  // Tốc độ GPS thực tế được ưu tiên hơn trạng thái lịch có thể cập nhật chậm.
  if (Number.isFinite(speed) && speed >= MOVING_KMH) return true;
  if (String(boat?.status || "").toLowerCase() === "moving") return true;
  if (["boarding", "scheduled", "atstation"].includes(movementKey)) return false;
  if (["moving", "arriving", "delayed"].includes(movementKey)) {
    if (Number.isFinite(speed) && speed < MOVING_KMH) return false;
    return true;
  }
  return false;
};

/**
 * Một số packet lịch vẫn còn `Scheduled`/`Boarding` ngay sau khi tàu rời bến.
 * Khi chuyến đang hoạt động và tracking đã có tiến độ tới bến kế tiếp, ưu tiên
 * dữ liệu vận hành thực tế thay vì nhãn lịch cũ.
 */
const hasActiveTripEnRouteProgress = (boat) => {
  const hasActiveTrip = Boolean(boat?.tripId || boat?.tripCode) && boat?.tripFinished !== true;
  if (!hasActiveTrip) return false;

  const remainingKm = Number(boat?.remainingDistanceKmToNextStation);
  const remainingMinutes = Number(boat?.remainingMinutesToNextStation);
  return (Number.isFinite(remainingKm) && remainingKm > 0.15)
    || (Number.isFinite(remainingMinutes) && remainingMinutes > 1);
};

/** Chờ xuất bến / boarding — khác cập bến và khác đang chạy. */
export const isBoatWaitingDeparture = (boat) => {
  const key = normalizeMovementKey(boat?.movementStatus);
  if (key === "boarding" || key === "scheduled") return true;
  const status = String(boat?.status || "").toLowerCase();
  if (status === "boarding") return true;
  const speed = Number(boat?.speed);
  const stopped = !Number.isFinite(speed) || speed < MOVING_KMH;
  if (!stopped) return false;
  if (key === "moving" || key === "arriving" || key === "delayed") return false;
  if (status === "moving") return false;
  const untilDep = resolveMinutesUntilDeparture(boat);
  if (Number.isFinite(untilDep) && untilDep >= 0) return true;
  const hasTrip = Boolean(boat?.tripId || boat?.tripCode);
  if (hasTrip && stopped && (status === "idle" || status === "stopped" || !status)) {
    return true;
  }
  const remain = Number(boat?.remainingMinutesToNextStation);
  if (
    stopped
    && Number.isFinite(remain)
    && remain > APPROACHING_SOON_MIN
    && (status === "idle" || !status)
    && (hasTrip || Number.isFinite(untilDep))
  ) {
    return true;
  }
  return false;
};

const resolveWaitMinutes = (boat) => {
  const untilDep = resolveMinutesUntilDeparture(boat);
  if (Number.isFinite(untilDep) && untilDep >= 0) return Math.round(untilDep);
  const remain = Number(boat?.remainingMinutesToNextStation);
  if (Number.isFinite(remain) && remain >= 0) return Math.round(remain);
  return null;
};

/** Đã cập / đang đậu — khác sắp cập và chờ xuất bến. */
export const isBoatAtStationNow = (boat, nav = null) => {
  if (nav?.effectivelyMoving) return false;
  const key = nav?.movementKey || normalizeMovementKey(boat?.movementStatus);
  const stop = normalizeMovementKey(
    boat?.lastStopEvent || boat?.stopEvent || boat?.tripStopEvent,
  );
  if (key === "atstation" || key === "arrived" || stop === "arrived") return true;
  if (key === "boarding" || key === "scheduled") return false;

  const speed = Number(boat?.speed);
  const stopped = !Number.isFinite(speed) || speed < MOVING_KMH;
  const km = Number(boat?.remainingDistanceKmToNextStation);
  const min = Number(boat?.remainingMinutesToNextStation);
  const meters = nav?.meters;
  const zeroDist = Number.isFinite(km) && km <= 0.08;
  const nearDock = Number.isFinite(meters) && meters <= DOCK_METERS;
  const etaDone = Number.isFinite(min) && min <= 0;

  // Arriving/Moving sticky nhưng đã dừng sát bến / km≈0 → Đã cập (không Sắp cập)
  if (stopped && (zeroDist || (nearDock && (etaDone || key === "arriving" || stop === "arriving")))) {
    return true;
  }
  if (stopped && nearDock && !nav?.enRoute && (key === "arriving" || stop === "arriving" || !key)) {
    return true;
  }
  return false;
};

/** Ưu tiên ops/BE; không tự lấy “bến gần nhất” làm ETA khi tàu đang chạy. */
const resolveOpsNav = (boat, stations = []) => {
  const remainingKm = Number(boat?.remainingDistanceKmToNextStation);
  const hasBeDistance = Number.isFinite(remainingKm) && remainingKm >= 0;
  const metersFromBe = hasBeDistance ? remainingKm * 1000 : null;

  const nextName = String(boat?.nextStationName || "").trim();
  const nextCode = shortStationCode(boat?.nextStationCode) || "";
  const currentName = boat?.currentStationName != null
    ? String(boat.currentStationName).trim()
    : "";
  const currentCode = shortStationCode(boat?.currentStationCode) || "";
  const movementKey = normalizeMovementKey(boat?.movementStatus);
  const speedNum = Number(boat?.speed);
  const speedMoving = Number.isFinite(speedNum) && speedNum >= MOVING_KMH;
  const hasEnRouteProgress = hasActiveTripEnRouteProgress(boat);
  const waitingDepart = isBoatWaitingDeparture(boat)
    || movementKey === "boarding"
    || movementKey === "scheduled";
  const effectivelyMoving = hasEnRouteProgress || isMovingBoat(boat, movementKey);
  const dockedHint = !effectivelyMoving && (movementKey === "atstation"
    || movementKey === "arrived"
    || (!speedMoving && Number.isFinite(remainingKm) && remainingKm <= 0.08));
  const trackingMoving = !waitingDepart
    && !dockedHint
    && (speedMoving || hasEnRouteProgress || String(boat?.status || "").toLowerCase() === "moving");
  const enRoute = (hasEnRouteProgress || !waitingDepart)
    && !dockedHint
    && (["moving", "arriving", "delayed"].includes(movementKey) || trackingMoving || hasEnRouteProgress);

  const nearest = findNearestStation(boat, stations);
  const useNearest = !hasBeDistance
    && !enRoute
    && !currentName
    && !currentCode
    && (movementKey === "atstation" || movementKey === "boarding" || !movementKey);

  const showCurrentStation = !enRoute && (movementKey === "atstation" || movementKey === "boarding");
  const stationCode = showCurrentStation || useNearest
    ? (currentCode
      || nextCode
      || (useNearest ? shortStationCode(nearest?.station?.stationCode) : "")
      || "")
    : (nextCode || currentCode || "");

  const stationName = showCurrentStation || useNearest
    ? (currentName
      || nextName
      || (useNearest ? String(nearest?.station?.stationName || "").trim() : "")
      || "")
    : (nextName || currentName || "");

  const meters = metersFromBe != null
    ? metersFromBe
    : (enRoute ? null : (nearest?.meters ?? null));

  return {
    movementKey,
    stationCode: stationCode || stationName,
    stationName,
    meters,
    nearest,
    fromBe: hasBeDistance || Boolean(boat?.movementStatus) || Boolean(nextName || currentName),
    enRoute,
    waitingDepart: !effectivelyMoving && waitingDepart,
    effectivelyMoving,
  };
};

/**
 * ETA từ API tracking/schedule.
 * - Ưu tiên khớp panel GPS: có km + tốc độ → ước phút từ km/speed.
 * - Phút API chỉ dùng khi hợp lý; 0p / <1p trong khi còn xa hoặc đang chạy → ước từ tốc độ.
 * - F5/reload: cùng công thức — không phụ thuộc sticky state trước đó.
 */
export const resolveEtaMinutesToNext = (boat, metersHint = null, now = Date.now()) => {
  const speed = Number(boat?.speed);
  const kmField = Number(boat?.remainingDistanceKmToNextStation);
  // metersHint chỉ dùng khi đã là khoảng cách BE (km*1000), không phải nearest haversine.
  const kmFromHint = Number.isFinite(metersHint) && metersHint >= 0
    && Number.isFinite(kmField) && kmField >= 0
    ? metersHint / 1000
    : null;
  const km = Number.isFinite(kmField) && kmField >= 0
    ? kmField
    : null;

  let fromSpeed = null;
  const kmForEta = km ?? kmFromHint;
  if (Number.isFinite(kmForEta) && kmForEta > 0 && Number.isFinite(speed) && speed >= MOVING_KMH) {
    // 1.1km / 31kmh ≈ 2.13 → 2 (khớp ~2p trên panel GPS)
    fromSpeed = Math.max(0, Math.round((kmForEta / speed) * 60));
    // Còn ≥150m mà round ra 0 → tối thiểu 1p (tránh <1p khi đang chạy)
    if (fromSpeed <= 0 && kmForEta * 1000 > DOCK_METERS) fromSpeed = 1;
  }

  // Đếm ngược giữa các packet GPS: cùng một ETA phải được dùng cho tag và mô tả.
  // Chỉ trừ khi tàu có dữ liệu đang chạy, không dùng cho thời gian chờ xuất bến.
  const measuredAt = Date.parse(String(
    boat?.etaMeasuredAt || boat?.receivedAt || boat?.recordedAt || boat?.updatedAt || "",
  ));
  const isEnRoute = (Number.isFinite(speed) && speed >= MOVING_KMH)
    || ["moving", "arriving", "delayed"].includes(normalizeMovementKey(boat?.movementStatus))
    || String(boat?.status || "").toLowerCase() === "moving";
  const elapsedMinutes = isEnRoute && Number.isFinite(measuredAt) && now > measuredAt
    ? Math.floor((now - measuredAt) / 60000)
    : 0;
  const countdown = (minutes) => Number.isFinite(minutes)
    ? Math.max(0, Math.round(minutes) - elapsedMinutes)
    : null;

  const direct = Number(boat?.remainingMinutesToNextStation);
  if (Number.isFinite(direct) && direct > 0) {
    const rounded = Math.max(0, Math.round(direct));
    // BE đã tính thời gian tới bến; FE chỉ đếm lùi, không tự thay bằng km/tốc độ.
    return countdown(rounded);
  }
  // API trả 0p khi còn xa là dữ liệu chưa hợp lệ; chỉ lúc đó mới fallback GPS.
  if (Number.isFinite(direct) && direct === 0 && fromSpeed == null) return 0;
  return countdown(fromSpeed);
};

const formatEtaTag = (eta, isVn) => {
  if (!Number.isFinite(eta)) return null;
  // Giống panel GPS: dưới 1 phút → <1p, không hiện ~0p
  if (eta <= 0) return isVn ? "<1p" : "<1m";
  return isVn ? `~${eta}p` : `~${eta}m`;
};

const formatEtaInNotice = (eta, isVn) => {
  if (!Number.isFinite(eta)) return "";
  if (eta <= 0) return isVn ? " (<1p)" : " (<1m)";
  return isVn ? ` (~${eta}p)` : ` (~${eta}m)`;
};

/**
 * Chỉ “sắp cập / chuẩn bị cập” khi thật sự gần bến.
 * BE hay sticky Arriving trong lúc tàu còn chạy xa → không tin status suông.
 */
export const isDockingSoonNow = (boat, { eta = null, meters = null } = {}) => {
  const speed = Number(boat?.speed);
  const km = Number(boat?.remainingDistanceKmToNextStation);
  const m = Number.isFinite(Number(meters))
    ? Number(meters)
    : (Number.isFinite(km) && km >= 0 ? km * 1000 : NaN);
  const etaN = Number.isFinite(Number(eta))
    ? Number(eta)
    : resolveEtaMinutesToNext(boat, Number.isFinite(m) ? m : null);
  const moving = Number.isFinite(speed) && speed >= MOVING_KMH;

  // Còn xa theo km/ETA → đang di chuyển, không “sắp cập”
  if (Number.isFinite(m) && m > APPROACH_METERS) return false;
  if (Number.isFinite(etaN) && etaN > DOCKING_SOON_MIN) return false;

  // Đang chạy: chỉ sắp cập khi sát bến (≤250m)
  if (moving) {
    return Number.isFinite(m) && m <= DOCKING_NEAR_METERS
      && (etaN == null || etaN <= DOCKING_SOON_MIN);
  }

  // Chậm/đứng: ETA ≤1 + không còn xa
  if (etaN != null && etaN <= DOCKING_SOON_MIN) {
    return !Number.isFinite(m) || m <= APPROACH_METERS;
  }
  return Number.isFinite(m) && m <= APPROACH_METERS;
};

/**
 * Copy theo contract BE (priority):
 * 1. Arrived / AtStation → Đã cập bến {currentStationName}
 * 2. Departed (flash) → Đã rời bến
 * 3. minutesUntilDeparture + Boarding → Chờ xuất bến, còn n phút
 * 4. remainingMinutes <= 1 + sát bến → Tàu chuẩn bị cập {nextStationName}
 * 5. remainingMinutes <= 5 → Tàu sắp đến … trong n phút
 * 6. Arriving (sát bến) → Tàu chuẩn bị cập {nextStationName}
 * 7. Moving + ETA → đang di chuyển tới …, còn n phút
 */
export const buildMovementNotice = (boat, lang = "VN", now = Date.now()) => {
  const isVn = lang === "VN";
  const key = normalizeMovementKey(boat?.movementStatus);
  const stopEvent = normalizeMovementKey(
    boat?.lastStopEvent || boat?.stopEvent || boat?.tripStopEvent,
  );
  const nextName = String(boat?.nextStationName || "").trim();
  const currentName = boat?.currentStationName != null
    ? String(boat.currentStationName).trim()
    : "";
  const stationName = currentName || nextName;
  const remainKm = Number(boat?.remainingDistanceKmToNextStation);
  const metersAway = Number.isFinite(remainKm) && remainKm >= 0 ? remainKm * 1000 : null;
  const remainMin = resolveEtaMinutesToNext(boat, metersAway, now);
  const untilDep = resolveMinutesUntilDeparture(boat);
  const speedNum = Number(boat?.speed);
  const enRouteNow = key === "moving" || key === "delayed"
    || (Number.isFinite(speedNum) && speedNum >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving"
    || (
      (key === "arriving" || stopEvent === "arriving")
      && !isDockingSoonNow(boat, { eta: remainMin, meters: metersAway })
    );

  // 0) BE dwellCountdown khi đang dừng tại bến (Arrived chưa Departed)
  const dwellNotice = formatDwellCountdownNotice(boat?.dwellCountdown, lang, now, {
    stops: boat?.tripStops || boat?.stops,
    boat,
  });
  // Ưu tiên notice đã tính sẵn (Live Tracking đã biết stops của trip).
  const dwellText = String(boat?.dwellNotice || "").trim() || dwellNotice;
  if (
    dwellText
    && !enRouteNow
    && (
      stopEvent === "arrived"
      || key === "atstation"
      || key === "arrived"
      || key === "boarding"
      || isBoatAtStationNow(boat, { movementKey: key, meters: metersAway, enRoute: false })
    )
  ) {
    return dwellText;
  }

  // 1) Đã cập bến
  if (
    stopEvent === "arrived"
    || key === "atstation"
    || key === "arrived"
    || isBoatAtStationNow(boat, { movementKey: key, meters: metersAway, enRoute: enRouteNow && key !== "arriving" })
  ) {
    const at = currentName || stationName;
    return at
      ? (isVn ? `Đã cập bến ${at}` : `Arrived at ${at}`)
      : (isVn ? "Đã cập bến" : "Arrived");
  }

  // 2) Đã rời bến (chỉ khi chưa chạy tiếp)
  if (!enRouteNow && (stopEvent === "departed" || key === "departed" || key === "departing")) {
    const left = currentName || stationName;
    return left
      ? (isVn ? `Đã rời bến ${left}` : `Departed ${left}`)
      : (isVn ? "Đã rời bến" : "Departed");
  }

  // 3) Chờ xuất bến — minutesUntilDeparture (Boarding / Scheduled)
  if (key === "boarding" || key === "scheduled" || isBoatWaitingDeparture(boat)) {
    if (Number.isFinite(untilDep) && untilDep >= 0) {
      return isVn
        ? `Chờ xuất bến, còn ${Math.round(untilDep)} phút`
        : `Waiting to depart, ${Math.round(untilDep)} min`;
    }
    const wait = resolveWaitMinutes(boat);
    if (Number.isFinite(wait) && wait >= 0) {
      return isVn
        ? `Chờ xuất bến, còn ${wait} phút`
        : `Waiting to depart, ${wait} min`;
    }
    return isVn ? "Chờ xuất bến" : "Waiting to depart";
  }

  // 4–5) Theo remainingMinutesToNextStation
  if (
    Number.isFinite(remainMin)
    && (key === "moving" || key === "delayed" || key === "arriving" || stopEvent === "arriving" || !key || enRouteNow)
  ) {
    if (isDockingSoonNow(boat, { eta: remainMin, meters: metersAway })) {
      return nextName
        ? (isVn ? `Tàu chuẩn bị cập ${nextName}` : `Preparing to dock at ${nextName}`)
        : (isVn ? "Tàu chuẩn bị cập bến" : "Preparing to dock");
    }
    if (remainMin <= APPROACHING_SOON_MIN) {
      return nextName
        ? (isVn ? `Tàu sắp đến ${nextName} trong ${remainMin} phút` : `Arriving at ${nextName} in ${remainMin} min`)
        : (isVn ? `Tàu sắp đến trong ${remainMin} phút` : `Arriving in ${remainMin} min`);
    }
    return nextName
      ? (isVn ? `Tàu đang di chuyển tới ${nextName}, còn ${remainMin} phút` : `Moving to ${nextName}, ${remainMin} min left`)
      : (isVn ? `Tàu đang di chuyển, còn ${remainMin} phút` : `Moving, ${remainMin} min left`);
  }

  // 6) Arriving — chỉ khi sát bến; còn không → đang di chuyển
  if (key === "arriving" || stopEvent === "arriving") {
    if (isDockingSoonNow(boat, { eta: remainMin, meters: metersAway })) {
      return nextName
        ? (isVn ? `Tàu chuẩn bị cập ${nextName}` : `Preparing to dock at ${nextName}`)
        : (isVn ? "Tàu chuẩn bị cập bến" : "Preparing to dock");
    }
    return nextName
      ? (isVn ? `Tàu đang di chuyển tới ${nextName}` : `Moving to ${nextName}`)
      : (isVn ? "Tàu đang di chuyển" : "Boat moving");
  }

  // 7) Moving
  if (key === "moving" || key === "delayed" || enRouteNow) {
    return nextName
      ? (isVn ? `Tàu đang di chuyển tới ${nextName}` : `Moving to ${nextName}`)
      : (isVn ? "Tàu đang di chuyển" : "Boat moving");
  }

  if (key === "completed") return isVn ? "Hoàn tất" : "Completed";
  if (key === "cancelled" || key === "canceled") return isVn ? "Hủy" : "Cancelled";
  return "";
};

/** Notice khi không có trip — suy từ bến gần GPS. */
export const buildDockFallbackNotice = (boat, stations = [], lang = "VN") => {
  const isVn = lang === "VN";
  if (isMovingBoat(boat, normalizeMovementKey(boat?.movementStatus))) return "";
  const nearest = findNearestStation(boat, stations);
  if (!nearest || nearest.meters > DOCK_METERS) return "";
  const name = String(nearest.station?.stationName || "").trim()
    || shortStationCode(nearest.station?.stationCode)
    || "";
  if (!name) return "";
  return isVn ? `Đã cập bến ${name}` : `Arrived at ${name}`;
};

/** Tàu đang dừng tại bến (ưu tiên movementStatus AtStation). */
export const getDockedStationInfo = (boat, stations = []) => {
  const nav = resolveOpsNav(boat, stations);
  if (!nav.effectivelyMoving && (nav.movementKey === "atstation" || nav.movementKey === "boarding")) {
    if (!nav.stationCode && !nav.stationName) return null;
    return {
      code: nav.stationCode,
      name: nav.stationName,
      meters: Number.isFinite(nav.meters) ? nav.meters : 0,
      label: nav.stationCode || nav.stationName,
    };
  }

  if (nav.fromBe && nav.movementKey && !["atstation", "boarding", "completed"].includes(nav.movementKey)) {
    return null;
  }
  if (nav.enRoute) return null;

  const nearest = findNearestStation(boat, stations);
  if (!nearest || nearest.meters > DOCK_METERS) return null;
  if (isMovingBoat(boat, nav.movementKey)) return null;

  const code = shortStationCode(nearest.station?.stationCode) || "";
  const name = String(nearest.station?.stationName || "").trim();
  if (!code && !name) return null;

  return {
    code,
    name,
    meters: nearest.meters,
    label: code || name,
  };
};

/**
 * Tag trạng thái — chỉ map movementStatus BE, không tự đổi tripStatus.
 */
export const getBoatStatusTag = (boat, stations = [], lang = "VN") => {
  const isVn = lang === "VN";
  const live = resolveBoatLiveStatus(boat);
  const underMaintenance = isBoatUnderMaintenance(boat);
  const nav = resolveOpsNav(boat, stations);
  const docked = underMaintenance ? null : getDockedStationInfo(boat, stations);
  const moving = nav.effectivelyMoving || isMovingBoat(boat, nav.movementKey);
  const notice = buildMovementNotice(boat, lang) || buildDockFallbackNotice(boat, stations, lang);

  if (live.key === "incident") {
    return {
      key: "incident",
      tone: "incident",
      label: isVn ? "SỰ CỐ" : "INCIDENT",
      detail: notice,
    };
  }
  if (underMaintenance || live.key === "maintenance") {
    return {
      key: "maintenance",
      tone: "delayed",
      label: isVn ? "BẢO TRÌ" : "MAINTENANCE",
      detail: "",
    };
  }

  // Đã cập — trước chờ xuất / sắp cập
  if (!moving && (isBoatAtStationNow(boat, nav) || nav.movementKey === "atstation")) {
    return {
      key: "docked",
      tone: "boarding",
      label: isVn ? "ĐÃ CẬP BẾN" : "ARRIVED",
      detail: notice,
    };
  }

  if (!moving && (nav.waitingDepart || isBoatWaitingDeparture(boat) || nav.movementKey === "boarding" || nav.movementKey === "scheduled")) {
    const wait = resolveWaitMinutes(boat);
    const waitTag = formatEtaTag(wait, isVn);
    return {
      key: "boarding",
      tone: "boarding",
      label: waitTag
        ? waitTag.toUpperCase()
        : (isVn ? "CHỜ XUẤT BẾN" : "BOARDING"),
      detail: notice,
    };
  }

  // Packet lịch có thể cập nhật chậm hơn GPS sau khi tàu đã rời bến.
  if (moving || nav.enRoute) {
    const eta = resolveEtaMinutesToNext(boat, nav.meters);
    const etaTag = formatEtaTag(eta, isVn);
    return {
      key: "moving",
      tone: "active",
      label: etaTag ? etaTag.toUpperCase() : (isVn ? "ĐANG DI CHUYỂN" : "MOVING"),
      detail: notice,
    };
  }

  if (nav.movementKey) {
    const mapped = getMovementStatusLabel(boat.movementStatus, lang);
    if (nav.movementKey === "delayed") {
      return { key: "delayed", tone: "delayed", label: mapped.toUpperCase(), detail: notice };
    }
    if (nav.movementKey === "arriving") {
      const eta = resolveEtaMinutesToNext(boat, Number.isFinite(Number(boat?.remainingDistanceKmToNextStation))
        ? Number(boat.remainingDistanceKmToNextStation) * 1000
        : null);
      const etaTag = formatEtaTag(eta, isVn);
      const meters = Number.isFinite(Number(boat?.remainingDistanceKmToNextStation))
        ? Number(boat.remainingDistanceKmToNextStation) * 1000
        : nav.meters;
      // Arriving sticky / còn chạy xa → ĐANG DI CHUYỂN, không “SẮP CẬP”
      if (!isDockingSoonNow(boat, { eta, meters })) {
        return {
          key: "moving",
          tone: "active",
          label: etaTag
            ? etaTag.toUpperCase()
            : (isVn ? "ĐANG DI CHUYỂN" : "MOVING"),
          detail: notice,
        };
      }
      return {
        key: "arriving",
        tone: "boarding",
        label: eta != null && eta <= 0
          ? (isVn ? "SẮP CẬP" : "ARRIVING")
          : (etaTag ? etaTag.toUpperCase() : mapped.toUpperCase()),
        detail: notice,
      };
    }
    if (nav.movementKey === "atstation" || nav.movementKey === "boarding") {
      return {
        key: nav.movementKey === "boarding" ? "boarding" : "docked",
        tone: "boarding",
        label: mapped.toUpperCase(),
        detail: notice,
      };
    }
    if (nav.movementKey === "moving") {
      const eta = resolveEtaMinutesToNext(boat, nav.meters);
      const etaTag = formatEtaTag(eta, isVn);
      return {
        key: "moving",
        tone: "active",
        label: etaTag ? etaTag.toUpperCase() : mapped.toUpperCase(),
        detail: notice,
      };
    }
    if (nav.movementKey === "scheduled") {
      const untilDep = resolveMinutesUntilDeparture(boat);
      const soon = Number.isFinite(untilDep) && untilDep <= STARTING_SOON_MIN && untilDep >= 0;
      return {
        key: soon ? "starting" : "scheduled",
        tone: soon ? "boarding" : "offline",
        label: mapped.toUpperCase(),
        detail: notice,
      };
    }
    if (nav.movementKey === "completed" || nav.movementKey === "cancelled" || nav.movementKey === "canceled") {
      return { key: nav.movementKey, tone: "offline", label: mapped.toUpperCase(), detail: notice };
    }
  }

  if (docked) {
    return {
      key: "docked",
      tone: "boarding",
      label: isVn ? `DỪNG ${docked.label}` : `AT ${docked.label}`,
      detail: docked.name || docked.code || "",
    };
  }
  if (moving) {
    return {
      key: "moving",
      tone: "active",
      label: isVn ? "ĐANG DI CHUYỂN" : "MOVING",
      detail: notice,
    };
  }
  if (boat?.isOnline === true || boat?.isGpsOnline === true) {
    return {
      key: "on_river",
      tone: "boarding",
      label: isVn ? "TRÊN SÔNG" : "ON RIVER",
      detail: "",
    };
  }
  return {
    key: "offline",
    tone: "offline",
    label: "OFFLINE",
    detail: "",
  };
};

/**
 * Tình hình tàu theo movementStatus BE (không tự đổi status).
 */
export const deriveBoatSituation = (boat, stations = [], arrivedAtByBoatId = new Map()) => {
  const live = resolveBoatLiveStatus(boat);
  const nav = resolveOpsNav(boat, stations);
  const moving = nav.effectivelyMoving || isMovingBoat(boat, nav.movementKey);
  const meters = nav.meters ?? Infinity;
  const stationCode = nav.stationCode || "";
  const stationName = nav.stationName || "";
  const boatId = String(boat?.boatId || boat?.boatCode || "");
  const remainingMinutes = resolveEtaMinutesToNext(boat, nav.meters);
  const untilDep = resolveMinutesUntilDeparture(boat);
  const noticeVnRaw = buildMovementNotice(boat, "VN") || buildDockFallbackNotice(boat, stations, "VN");
  const noticeEnRaw = buildMovementNotice(boat, "EN") || buildDockFallbackNotice(boat, stations, "EN");

  if (live.key === "incident") {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "incident",
      labelVn: "Sự cố",
      labelEn: "Incident",
      detailVn: noticeVnRaw,
      detailEn: noticeEnRaw,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
      tone: "incident",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  // Đã cập bến — trước chờ xuất / sắp cập (tránh sticky Arriving)
  const atStation = isBoatAtStationNow(boat, nav)
    || (!moving && nav.movementKey === "atstation")
    || (
      !nav.enRoute
      && !nav.movementKey
      && Number.isFinite(meters)
      && meters <= DOCK_METERS
      && !moving
    );

  if (atStation) {
    const firstAt = arrivedAtByBoatId.get(boatId) || Date.now();
    if (!arrivedAtByBoatId.has(boatId)) arrivedAtByBoatId.set(boatId, firstAt);
    const age = Date.now() - firstAt;
    const dockVn = stationName ? `Đã cập bến ${stationName}` : "Đã cập bến";
    const dockEn = stationName ? `Arrived at ${stationName}` : "Arrived";
    if (nav.fromBe && age >= ARRIVED_HIDE_MS) {
      return {
        boatId,
        boatCode: boat.boatCode || boatId,
        phase: "docked_hidden",
        labelVn: "Đã cập bến",
        labelEn: "Arrived",
        detailVn: dockVn,
        detailEn: dockEn,
        stationCode,
        stationName,
        meters: Number.isFinite(meters) ? meters : null,
        remainingMinutes: null,
        tone: "docked",
        hideAfterMs: ARRIVED_HIDE_MS,
        hidden: true,
        fromBe: nav.fromBe,
      };
    }
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "docked",
      labelVn: "Đã cập bến",
      labelEn: "Arrived",
      detailVn: dockVn,
      detailEn: dockEn,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: null,
      tone: "docked",
      hideAfterMs: nav.fromBe ? ARRIVED_HIDE_MS : null,
      remainingMs: nav.fromBe ? Math.max(0, ARRIVED_HIDE_MS - age) : null,
      fromBe: nav.fromBe,
    };
  }

  // Chờ xuất bến (Boarding) — khác cập bến / đang chạy
  if (
    !moving
    && (
      nav.waitingDepart
      || nav.movementKey === "scheduled"
      || nav.movementKey === "boarding"
      || isBoatWaitingDeparture(boat)
    )
  ) {
    const wait = resolveWaitMinutes(boat);
    const noticeWaitVn = noticeVnRaw
      || (Number.isFinite(wait) && wait >= 0
        ? `Chờ xuất bến, còn ${wait} phút`
        : "Chờ xuất bến");
    const noticeWaitEn = noticeEnRaw
      || (Number.isFinite(wait) && wait >= 0
        ? `Waiting to depart, ${wait} min`
        : "Waiting to depart");
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "starting",
      labelVn: Number.isFinite(wait) && wait <= BOARDING_SOON_MIN
        ? "Chuẩn bị xuất bến"
        : "Chờ xuất bến",
      labelEn: Number.isFinite(wait) && wait <= BOARDING_SOON_MIN
        ? "Preparing"
        : "Waiting to depart",
      detailVn: noticeWaitVn,
      detailEn: noticeWaitEn,
      stationCode,
      stationName,
      meters: null,
      remainingMinutes: wait,
      tone: "boarding",
      hideAfterMs: null,
      fromBe: true,
    };
  }

  if (arrivedAtByBoatId.has(boatId) && (moving || nav.enRoute || (Number.isFinite(meters) && meters > DOCK_METERS * 1.4))) {
    arrivedAtByBoatId.delete(boatId);
  }

  const eta = remainingMinutes;
  const etaTagVn = formatEtaTag(eta, true);
  const etaTagEn = formatEtaTag(eta, false);
  // Chỉ "sắp cập" khi sát bến thật (không tin Arriving sticky khi còn chạy xa).
  const arriving = !isBoatAtStationNow(boat, nav)
    && isDockingSoonNow(boat, { eta, meters });

  const noticeVn = noticeVnRaw;
  const noticeEn = noticeEnRaw;

  if (arriving) {
    // eta=0 nhưng chưa đủ "đã cập" → vẫn sắp cập; đã cập đã return ở trên
    const detailFallbackVn = stationName
      ? `Tàu chuẩn bị cập ${stationName}${formatEtaInNotice(eta, true)}`
      : "Tàu sắp cập bến";
    const detailFallbackEn = stationName
      ? `Preparing to dock at ${stationName}${formatEtaInNotice(eta, false)}`
      : "About to dock";
    const labelVn = etaTagVn || "Sắp cập";
    const labelEn = etaTagEn || "Arriving";
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "arriving",
      labelVn,
      labelEn,
      detailVn: noticeVn || detailFallbackVn,
      detailEn: noticeEn || detailFallbackEn,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: eta,
      tone: "arriving",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  if (moving || nav.enRoute || nav.movementKey === "moving" || nav.movementKey === "delayed" || nav.movementKey === "arriving") {
    const moveDetailVn = (noticeVn && !/chuẩn bị cập|preparing to dock/i.test(noticeVn))
      ? noticeVn
      : (stationName
        ? (eta != null
          ? `Tàu đang di chuyển tới ${stationName}, còn ${eta} phút`
          : `Tàu đang di chuyển tới ${stationName}`)
        : "Tàu đang di chuyển");
    const moveDetailEn = (noticeEn && !/preparing to dock|chuẩn bị cập/i.test(noticeEn))
      ? noticeEn
      : (stationName
        ? (eta != null
          ? `Moving to ${stationName}, ${eta} min left`
          : `Moving to ${stationName}`)
        : "Boat moving");
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "moving",
      labelVn: nav.movementKey === "delayed"
        ? "Trễ"
        : (etaTagVn || "Đang di chuyển"),
      labelEn: nav.movementKey === "delayed"
        ? "Delayed"
        : (etaTagEn || "Moving"),
      detailVn: moveDetailVn,
      detailEn: moveDetailEn,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: eta,
      tone: nav.movementKey === "delayed" ? "delayed" : "moving",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  return null;
};

export const buildBoatSituations = (boats, stations, arrivedAtByBoatId) => {
  const rows = [];
  (boats || []).forEach((boat) => {
    const row = deriveBoatSituation(boat, stations, arrivedAtByBoatId);
    if (!row || row.hidden) return;
    if (!["moving", "arriving", "docked", "incident", "starting"].includes(row.phase)) return;
    rows.push(row);
  });

  const order = { incident: 0, arriving: 1, starting: 2, moving: 3, docked: 4 };
  return rows.sort((a, b) => {
    const d = (order[a.phase] ?? 9) - (order[b.phase] ?? 9);
    if (d !== 0) return d;
    return String(a.boatCode).localeCompare(String(b.boatCode));
  });
};

export const ARRIVED_HIDE_MS_EXPORT = ARRIVED_HIDE_MS;
export const NOTICE_FLASH_MS_EXPORT = NOTICE_FLASH_MS;
