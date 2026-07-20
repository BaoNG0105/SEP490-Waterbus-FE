import { isBoatUnderMaintenance, resolveBoatLiveStatus } from "./boatTracking";
import { getMovementStatusLabel } from "../services/operationsService";

const DOCK_METERS = 150;
const APPROACH_METERS = 400;
const MOVING_KMH = 1.2;
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

export const DOCK_METERS_EXPORT = DOCK_METERS;

const resolveMinutesUntilDeparture = (boat) => {
  const direct = Number(boat?.minutesUntilDeparture);
  if (Number.isFinite(direct)) return direct;
  const ts = Date.parse(String(boat?.scheduledDepartureAt || ""));
  if (!Number.isNaN(ts)) return Math.round((ts - Date.now()) / 60000);
  return null;
};

const APPROACHING_SOON_MIN = 5; // <=5: sắp đến trong n phút
const DOCKING_SOON_MIN = 2; // <=2: chuẩn bị cập / sắp cập

const isMovingBoat = (boat, movementKey = "") => {
  if (["boarding", "scheduled", "atstation"].includes(movementKey)) return false;
  if (["moving", "arriving", "delayed"].includes(movementKey)) {
    const speed = Number(boat?.speed);
    if (Number.isFinite(speed) && speed < MOVING_KMH) return false;
    return true;
  }
  const speed = Number(boat?.speed);
  return (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";
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
  const waitingDepart = isBoatWaitingDeparture(boat)
    || movementKey === "boarding"
    || movementKey === "scheduled";
  const dockedHint = movementKey === "atstation"
    || movementKey === "arrived"
    || (!speedMoving && Number.isFinite(remainingKm) && remainingKm <= 0.08);
  const trackingMoving = !waitingDepart
    && !dockedHint
    && (speedMoving || String(boat?.status || "").toLowerCase() === "moving");
  const enRoute = !waitingDepart
    && !dockedHint
    && (["moving", "arriving", "delayed"].includes(movementKey) || trackingMoving);

  const nearest = findNearestStation(boat, stations);
  const useNearest = !hasBeDistance
    && !enRoute
    && !currentName
    && !currentCode
    && (movementKey === "atstation" || movementKey === "boarding" || !movementKey);

  const stationCode = movementKey === "atstation" || movementKey === "boarding" || useNearest
    ? (currentCode
      || nextCode
      || (useNearest ? shortStationCode(nearest?.station?.stationCode) : "")
      || "")
    : (nextCode || currentCode || "");

  const stationName = movementKey === "atstation" || movementKey === "boarding" || useNearest
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
    waitingDepart,
  };
};

/**
 * ETA từ API tracking/schedule.
 * - Có remainingMinutes → dùng (kể cả 0), trừ khi =0 mà còn xa (km lớn) → ước lại từ km/tốc độ.
 * - Không có phút → ước từ remainingDistanceKm + speed (cùng công thức panel GPS).
 * - Không ước từ “bến gần nhất” đường chim bay.
 */
export const resolveEtaMinutesToNext = (boat, metersHint = null) => {
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
  if (Number.isFinite(kmForEta) && kmForEta >= 0 && Number.isFinite(speed) && speed >= MOVING_KMH) {
    fromSpeed = Math.max(0, Math.round((kmForEta / speed) * 60));
  }

  const direct = Number(boat?.remainingMinutesToNextStation);
  if (Number.isFinite(direct) && direct >= 0) {
    const rounded = Math.max(0, Math.round(direct));
    // API/GPS gửi 0p nhưng còn xa (vd 1.2km) → tin km+tốc độ như panel GPS
    if (
      fromSpeed != null
      && fromSpeed > rounded
      && Number.isFinite(kmForEta)
      && kmForEta * 1000 > APPROACH_METERS
    ) {
      return fromSpeed;
    }
    return rounded;
  }
  return fromSpeed;
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
 * Copy theo contract BE (priority):
 * 1. Arrived / AtStation → Đã cập bến {currentStationName}
 * 2. Departed (flash) → Đã rời bến
 * 3. minutesUntilDeparture + Boarding → Chờ xuất bến, còn n phút
 * 4. remainingMinutes <= 2 → Tàu chuẩn bị cập {nextStationName}
 * 5. remainingMinutes <= 5 → Tàu sắp đến … trong n phút
 * 6. Arriving → Tàu chuẩn bị cập {nextStationName}
 * 7. Moving + ETA → đang di chuyển tới …, còn n phút
 */
export const buildMovementNotice = (boat, lang = "VN") => {
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
  const remainMin = resolveEtaMinutesToNext(boat, metersAway);
  const untilDep = resolveMinutesUntilDeparture(boat);
  const enRouteNow = key === "moving" || key === "delayed" || key === "arriving"
    || stopEvent === "arriving"
    || (Number.isFinite(Number(boat?.speed)) && Number(boat.speed) >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";

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

  // 4–5) Theo remainingMinutesToNextStation (ưu tiên hơn bare Arriving)
  if (
    Number.isFinite(remainMin)
    && (key === "moving" || key === "delayed" || key === "arriving" || stopEvent === "arriving" || !key)
  ) {
    if (remainMin <= DOCKING_SOON_MIN) {
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

  // 6) Arriving (không có phút)
  if (key === "arriving" || stopEvent === "arriving") {
    return nextName
      ? (isVn ? `Tàu chuẩn bị cập ${nextName}` : `Preparing to dock at ${nextName}`)
      : (isVn ? "Tàu chuẩn bị cập bến" : "Preparing to dock");
  }

  // 7) Moving
  if (key === "moving" || key === "delayed") {
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
  if (nav.movementKey === "atstation" || nav.movementKey === "boarding") {
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
  const moving = isMovingBoat(boat, nav.movementKey);
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
  if (isBoatAtStationNow(boat, nav) || nav.movementKey === "atstation") {
    return {
      key: "docked",
      tone: "boarding",
      label: isVn ? "ĐÃ CẬP BẾN" : "ARRIVED",
      detail: notice,
    };
  }

  if (nav.waitingDepart || isBoatWaitingDeparture(boat) || nav.movementKey === "boarding" || nav.movementKey === "scheduled") {
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
      const hasBeKm = Number.isFinite(Number(boat?.remainingDistanceKmToNextStation));
      // Không có km/phút từ API → ĐANG DI CHUYỂN, không bịa SẮP CẬP
      if (eta == null && !hasBeKm) {
        return {
          key: "moving",
          tone: "active",
          label: isVn ? "ĐANG DI CHUYỂN" : "MOVING",
          detail: notice,
        };
      }
      if (eta != null && eta > DOCKING_SOON_MIN) {
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
  const moving = isMovingBoat(boat, nav.movementKey);
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
    || nav.movementKey === "atstation"
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
    nav.waitingDepart
    || nav.movementKey === "scheduled"
    || nav.movementKey === "boarding"
    || isBoatWaitingDeparture(boat)
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
  // Chỉ "sắp cập" khi có ETA thật ≤2, hoặc BE Arriving + có khoảng cách BE ≤400m.
  // Không bịa từ nearest khi tracking chưa gửi remainingDistance.
  const hasBeDistance = Number.isFinite(Number(boat?.remainingDistanceKmToNextStation));
  const arrivingByEta = eta != null && eta <= DOCKING_SOON_MIN && (
    hasBeDistance || (Number.isFinite(meters) && meters <= APPROACH_METERS)
  );
  const arrivingByStatus = (nav.movementKey === "arriving" || normalizeMovementKey(boat?.lastStopEvent) === "arriving")
    && eta == null
    && hasBeDistance
    && Number.isFinite(meters)
    && meters <= APPROACH_METERS;

  // Đã cập rồi thì không còn phase sắp cập
  const arriving = !isBoatAtStationNow(boat, nav) && (arrivingByEta || arrivingByStatus);

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
    const moveDetailVn = noticeVn
      || (stationName
        ? (eta != null
          ? `Tàu đang di chuyển tới ${stationName}, còn ${eta} phút`
          : `Tàu đang di chuyển tới ${stationName}`)
        : "Tàu đang di chuyển");
    const moveDetailEn = noticeEn
      || (stationName
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
