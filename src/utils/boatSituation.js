import { isBoatUnderMaintenance, resolveBoatLiveStatus } from "./boatTracking";
import { getMovementStatusLabel } from "../services/operationsService";

const DOCK_METERS = 90;
const APPROACH_METERS = 320;
const MOVING_KMH = 1.2;
const ARRIVED_HIDE_MS = 60_000;

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

const normalizeMovementKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[_\s-]/g, "");

/** Ưu tiên khoảng cách / bến từ BE (operations schedule / GPS payload). */
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

  const nearest = (!hasBeDistance && !nextName && !nextCode && !currentName)
    ? findNearestStation(boat, stations)
    : null;

  const stationCode = movementKey === "atstation" || movementKey === "boarding"
    ? (currentCode || nextCode || shortStationCode(nearest?.station?.stationCode) || "")
    : (nextCode || currentCode || shortStationCode(nearest?.station?.stationCode) || "");

  const stationName = movementKey === "atstation" || movementKey === "boarding"
    ? (currentName || nextName || nearest?.station?.stationName || "")
    : (nextName || currentName || nearest?.station?.stationName || "");

  const meters = metersFromBe != null
    ? metersFromBe
    : (nearest?.meters ?? null);

  return {
    movementKey,
    stationCode: stationCode || stationName,
    stationName,
    meters,
    fromBe: hasBeDistance || Boolean(boat?.movementStatus) || Boolean(nextName || currentName),
  };
};

const isMovingBoat = (boat, movementKey = "") => {
  if (["moving", "arriving", "delayed"].includes(movementKey)) return true;
  const speed = Number(boat?.speed);
  return (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";
};

/** Tàu đang dừng tại bến (ưu tiên movementStatus AtStation; fallback khoảng cách). */
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
 * Tag trạng thái kiểu bảng chuyến bay (Remarks).
 * Ưu tiên movementStatus từ operations/schedule.
 */
export const getBoatStatusTag = (boat, stations = [], lang = "VN") => {
  const isVn = lang === "VN";
  const live = resolveBoatLiveStatus(boat);
  const underMaintenance = isBoatUnderMaintenance(boat);
  const nav = resolveOpsNav(boat, stations);
  const docked = underMaintenance ? null : getDockedStationInfo(boat, stations);
  const moving = isMovingBoat(boat, nav.movementKey);

  if (live.key === "incident") {
    return {
      key: "incident",
      tone: "incident",
      label: isVn ? "SỰ CỐ" : "INCIDENT",
      detail: "",
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
      return { key: "delayed", tone: "delayed", label: mapped.toUpperCase(), detail: nav.stationName || "" };
    }
    if (nav.movementKey === "arriving") {
      return { key: "arriving", tone: "boarding", label: mapped.toUpperCase(), detail: nav.stationName || "" };
    }
    if (nav.movementKey === "atstation" || nav.movementKey === "boarding") {
      return {
        key: "docked",
        tone: "boarding",
        label: docked?.label
          ? (isVn ? `DỪNG ${docked.label}` : `AT ${docked.label}`)
          : mapped.toUpperCase(),
        detail: docked?.name || nav.stationName || "",
      };
    }
    if (nav.movementKey === "moving") {
      return { key: "moving", tone: "active", label: isVn ? "ĐANG CHẠY" : "MOVING", detail: "" };
    }
    if (nav.movementKey === "scheduled" || nav.movementKey === "completed" || nav.movementKey === "cancelled" || nav.movementKey === "canceled") {
      return { key: nav.movementKey, tone: "offline", label: mapped.toUpperCase(), detail: "" };
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
      label: isVn ? "ĐANG CHẠY" : "MOVING",
      detail: "",
    };
  }
  if (boat?.isOnline === true) {
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
 * Tình hình tàu: ưu tiên BE movementStatus + remainingDistanceKmToNextStation.
 * Chỉ fallback haversine bến gần nhất khi BE chưa có dữ liệu ops.
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

  if (live.key === "incident") {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "incident",
      labelVn: "Sự cố",
      labelEn: "Incident",
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
      tone: "incident",
      hideAfterMs: null,
      fromBe: nav.fromBe,
    };
  }

  const atStation = nav.movementKey === "atstation"
    || nav.movementKey === "boarding"
    || (!nav.movementKey && Number.isFinite(meters) && meters <= DOCK_METERS && !moving);

  if (atStation) {
    const firstAt = arrivedAtByBoatId.get(boatId) || Date.now();
    if (!arrivedAtByBoatId.has(boatId)) arrivedAtByBoatId.set(boatId, firstAt);
    const age = Date.now() - firstAt;
    if (age >= ARRIVED_HIDE_MS) {
      return {
        boatId,
        boatCode: boat.boatCode || boatId,
        phase: "docked_hidden",
        labelVn: "Đã cập bến",
        labelEn: "Docked",
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
      labelVn: getMovementStatusLabel(boat.movementStatus || "AtStation", "VN") || "Đã cập bến",
      labelEn: getMovementStatusLabel(boat.movementStatus || "AtStation", "EN") || "Docked",
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      remainingMinutes: null,
      tone: "docked",
      hideAfterMs: ARRIVED_HIDE_MS,
      remainingMs: Math.max(0, ARRIVED_HIDE_MS - age),
      fromBe: nav.fromBe,
    };
  }

  if (arrivedAtByBoatId.has(boatId) && (moving || (Number.isFinite(meters) && meters > DOCK_METERS * 1.4))) {
    arrivedAtByBoatId.delete(boatId);
  }

  const arriving = nav.movementKey === "arriving"
    || (moving && Number.isFinite(meters) && meters <= APPROACH_METERS);

  if (arriving) {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "arriving",
      labelVn: "Sắp tới",
      labelEn: "Arriving",
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
      labelVn: nav.movementKey === "delayed" ? "Trễ" : "Đang chạy",
      labelEn: nav.movementKey === "delayed" ? "Delayed" : "Moving",
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
    if (!["moving", "arriving", "docked", "incident"].includes(row.phase)) return;
    rows.push(row);
  });

  const order = { incident: 0, arriving: 1, moving: 2, docked: 3 };
  return rows.sort((a, b) => {
    const d = (order[a.phase] ?? 9) - (order[b.phase] ?? 9);
    if (d !== 0) return d;
    return String(a.boatCode).localeCompare(String(b.boatCode));
  });
};

export const ARRIVED_HIDE_MS_EXPORT = ARRIVED_HIDE_MS;
