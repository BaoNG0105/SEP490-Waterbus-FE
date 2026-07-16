import { isBoatUnderMaintenance, resolveBoatLiveStatus } from "./boatTracking";

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

/** Tàu đang dừng tại bến (gần bến + tốc độ thấp). */
export const getDockedStationInfo = (boat, stations = []) => {
  const nearest = findNearestStation(boat, stations);
  if (!nearest || nearest.meters > DOCK_METERS) return null;

  const speed = Number(boat?.speed);
  const moving = (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";
  if (moving) return null;

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
 * Tag trạng thái kiểu bảng chuyến bay (Remarks): chữ màu, dễ đọc / sau này dùng cho khách.
 * tone: incident | delayed | boarding | active | offline
 */
export const getBoatStatusTag = (boat, stations = [], lang = "VN") => {
  const isVn = lang === "VN";
  const live = resolveBoatLiveStatus(boat);
  const underMaintenance = isBoatUnderMaintenance(boat);
  const docked = underMaintenance ? null : getDockedStationInfo(boat, stations);
  const speed = Number(boat?.speed);
  const moving = (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";

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
 * Suy luận tình hình tàu từ GPS + bến gần nhất.
 * BE chưa có nextStation/ETA — dùng khoảng cách & tốc độ.
 */
export const deriveBoatSituation = (boat, stations = [], arrivedAtByBoatId = new Map()) => {
  const live = resolveBoatLiveStatus(boat);
  const nearest = findNearestStation(boat, stations);
  const speed = Number(boat?.speed);
  const moving = (Number.isFinite(speed) && speed >= MOVING_KMH)
    || String(boat?.status || "").toLowerCase() === "moving";
  const meters = nearest?.meters ?? Infinity;
  const stationCode = shortStationCode(nearest?.station?.stationCode)
    || nearest?.station?.stationName
    || "";
  const stationName = nearest?.station?.stationName || "";
  const boatId = String(boat?.boatId || boat?.boatCode || "");

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
      tone: "incident",
      hideAfterMs: null,
    };
  }

  if (meters <= DOCK_METERS && !moving) {
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
        meters,
        tone: "docked",
        hideAfterMs: ARRIVED_HIDE_MS,
        hidden: true,
      };
    }
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "docked",
      labelVn: "Đã cập bến",
      labelEn: "Docked",
      stationCode,
      stationName,
      meters,
      tone: "docked",
      hideAfterMs: ARRIVED_HIDE_MS,
      remainingMs: Math.max(0, ARRIVED_HIDE_MS - age),
    };
  }

  // Rời bến / không còn docked → reset timer cập bến.
  if (arrivedAtByBoatId.has(boatId) && (moving || meters > DOCK_METERS * 1.4)) {
    arrivedAtByBoatId.delete(boatId);
  }

  if (meters <= APPROACH_METERS && moving) {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "arriving",
      labelVn: "Sắp tới",
      labelEn: "Arriving",
      stationCode,
      stationName,
      meters,
      tone: "arriving",
      hideAfterMs: null,
    };
  }

  if (moving) {
    return {
      boatId,
      boatCode: boat.boatCode || boatId,
      phase: "moving",
      labelVn: "Đang chạy",
      labelEn: "Moving",
      stationCode,
      stationName,
      meters: Number.isFinite(meters) ? meters : null,
      tone: "moving",
      hideAfterMs: null,
    };
  }

  // Đứng yên trên sông (kể cả gần bến) → không gọi "Sắp bắt đầu".
  // Tag "TRÊN SÔNG" nằm ở panel Đội tàu; bảng Tình hình chỉ sự kiện thật.
  return null;
};

export const buildBoatSituations = (boats, stations, arrivedAtByBoatId) => {
  const rows = [];
  (boats || []).forEach((boat) => {
    const row = deriveBoatSituation(boat, stations, arrivedAtByBoatId);
    if (!row || row.hidden) return;
    // Chỉ hiện sự kiện đang diễn ra / sự cố — không hiện "sắp bắt đầu" suy đoán.
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
