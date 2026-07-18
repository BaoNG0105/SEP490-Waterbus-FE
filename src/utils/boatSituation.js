import { isBoatUnderMaintenance, resolveBoatLiveStatus } from "./boatTracking";
import { getMovementStatusLabel } from "../services/operationsService";

const DOCK_METERS = 150;
const APPROACH_METERS = 400;
const MOVING_KMH = 1.2;
const ARRIVED_HIDE_MS = 60_000;
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

/** Ưu tiên ops/BE; không có trip → fallback bến gần nhất từ GPS (test cập bến không trip). */
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

  const nearest = findNearestStation(boat, stations);
  const useNearest = !hasBeDistance
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
    : (nearest?.meters ?? null);

  return {
    movementKey,
    stationCode: stationCode || stationName,
    stationName,
    meters,
    nearest,
    fromBe: hasBeDistance || Boolean(boat?.movementStatus) || Boolean(nextName || currentName),
  };
};

const isMovingBoat = (boat, movementKey = "") => {
  if (["moving", "arriving", "delayed"].includes(movementKey)) return true;
  const speed = Number(boat?.speed);
  return (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";
};

const resolveMinutesUntilDeparture = (boat) => {
  const direct = Number(boat?.minutesUntilDeparture);
  if (Number.isFinite(direct)) return direct;
  const ts = Date.parse(String(boat?.scheduledDepartureAt || ""));
  if (!Number.isNaN(ts)) return Math.round((ts - Date.now()) / 60000);
  return null;
};

/** Thông báo FE theo contract operations/schedule. */
export const buildMovementNotice = (boat, lang = "VN") => {
  const isVn = lang === "VN";
  const key = normalizeMovementKey(boat?.movementStatus);
  const nextName = String(boat?.nextStationName || "").trim();
  const currentName = boat?.currentStationName != null
    ? String(boat.currentStationName).trim()
    : "";
  const remainMin = Number(boat?.remainingMinutesToNextStation);
  const untilDep = resolveMinutesUntilDeparture(boat);

  if (key === "scheduled" || key === "boarding") {
    if (Number.isFinite(untilDep) && untilDep <= BOARDING_SOON_MIN && untilDep >= 0) {
      return isVn ? "Tàu chuẩn bị bắt đầu" : "Boat preparing to start";
    }
    if (Number.isFinite(untilDep) && untilDep <= STARTING_SOON_MIN && untilDep >= 0) {
      return isVn
        ? `Tàu sắp bắt đầu trong ${untilDep} phút`
        : `Boat starts in ${untilDep} min`;
    }
    if (key === "boarding") {
      return isVn ? "Tàu chuẩn bị bắt đầu" : "Boat preparing to start";
    }
    return isVn ? "Chưa chạy" : "Not started";
  }

  if (key === "moving" || key === "delayed") {
    if (nextName && Number.isFinite(remainMin)) {
      return isVn
        ? `Tàu đang di chuyển tới ${nextName}, còn ${Math.round(remainMin)} phút`
        : `Moving to ${nextName}, ${Math.round(remainMin)} min left`;
    }
    if (nextName) {
      return isVn ? `Tàu đang di chuyển tới ${nextName}` : `Moving to ${nextName}`;
    }
    return isVn ? "Tàu đang di chuyển" : "Boat moving";
  }

  if (key === "arriving") {
    return nextName
      ? (isVn ? `Tàu sắp cập bến ${nextName}` : `Arriving at ${nextName}`)
      : (isVn ? "Tàu sắp cập bến" : "Arriving");
  }

  if (key === "atstation") {
    return currentName
      ? (isVn ? `Tàu đang ở bến ${currentName}` : `At station ${currentName}`)
      : (isVn ? "Tàu đang ở bến" : "At station");
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
  return isVn ? `Tàu đang ở bến ${name}` : `At station ${name}`;
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

  if (nav.movementKey) {
    const mapped = getMovementStatusLabel(boat.movementStatus, lang);
    if (nav.movementKey === "delayed") {
      return { key: "delayed", tone: "delayed", label: mapped.toUpperCase(), detail: notice };
    }
    if (nav.movementKey === "arriving") {
      return { key: "arriving", tone: "boarding", label: mapped.toUpperCase(), detail: notice };
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
      return { key: "moving", tone: "active", label: mapped.toUpperCase(), detail: notice };
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
  const remainingMinutes = Number(boat?.remainingMinutesToNextStation);
  const untilDep = resolveMinutesUntilDeparture(boat);
  const noticeVn = buildMovementNotice(boat, "VN") || buildDockFallbackNotice(boat, stations, "VN");
  const noticeEn = buildMovementNotice(boat, "EN") || buildDockFallbackNotice(boat, stations, "EN");

  if (live.key === "incident") {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "incident",
      labelVn: "Sự cố",
      labelEn: "Incident",
      detailVn: noticeVn,
      detailEn: noticeEn,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
      tone: "incident",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  // Scheduled sắp tới giờ — hiện trong panel Tình hình.
  if (
    (nav.movementKey === "scheduled" || nav.movementKey === "boarding")
    && Number.isFinite(untilDep)
    && untilDep >= 0
    && untilDep <= STARTING_SOON_MIN
  ) {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "starting",
      labelVn: untilDep <= BOARDING_SOON_MIN ? "Chuẩn bị" : "Sắp bắt đầu",
      labelEn: untilDep <= BOARDING_SOON_MIN ? "Preparing" : "Starting soon",
      detailVn: noticeVn,
      detailEn: noticeEn,
      stationCode,
      stationName,
      meters: null,
      remainingMinutes: untilDep,
      tone: "boarding",
      hideAfterMs: null,
      fromBe: true,
    };
  }

  const atStation = nav.movementKey === "atstation"
    || (!nav.movementKey && Number.isFinite(meters) && meters <= DOCK_METERS && !moving);

  if (atStation) {
    const firstAt = arrivedAtByBoatId.get(boatId) || Date.now();
    if (!arrivedAtByBoatId.has(boatId)) arrivedAtByBoatId.set(boatId, firstAt);
    const age = Date.now() - firstAt;
    // Ops AtStation có thể ẩn sau 1 phút; GPS không trip giữ hiện (test cập bến).
    if (nav.fromBe && age >= ARRIVED_HIDE_MS) {
      return {
        boatId,
        boatCode: boat.boatCode || boatId,
        phase: "docked_hidden",
        labelVn: "Đang ở bến",
        labelEn: "At station",
        detailVn: noticeVn,
        detailEn: noticeEn,
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
      labelVn: "Đang ở bến",
      labelEn: "At station",
      detailVn: noticeVn || (stationName ? `Tàu đang ở bến ${stationName}` : "Tàu đang ở bến"),
      detailEn: noticeEn || (stationName ? `At station ${stationName}` : "At station"),
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

  if (arrivedAtByBoatId.has(boatId) && (moving || (Number.isFinite(meters) && meters > DOCK_METERS * 1.4))) {
    arrivedAtByBoatId.delete(boatId);
  }

  const arriving = nav.movementKey === "arriving"
    || (!nav.movementKey && moving && Number.isFinite(meters) && meters <= APPROACH_METERS);

  if (arriving) {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "arriving",
      labelVn: "Sắp cập bến",
      labelEn: "Arriving",
      detailVn: noticeVn || (stationName ? `Tàu sắp cập bến ${stationName}` : "Tàu sắp cập bến"),
      detailEn: noticeEn || (stationName ? `Arriving at ${stationName}` : "Arriving"),
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
      tone: "arriving",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  if (moving || nav.movementKey === "moving" || nav.movementKey === "delayed") {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "moving",
      labelVn: nav.movementKey === "delayed" ? "Trễ" : "Đang di chuyển",
      labelEn: nav.movementKey === "delayed" ? "Delayed" : "Moving",
      detailVn: noticeVn,
      detailEn: noticeEn,
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
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
