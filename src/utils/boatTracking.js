const isValidLatLng = (lat, lng) => (
  Number.isFinite(Number(lat))
  && Number.isFinite(Number(lng))
  && Math.abs(Number(lat)) <= 90
  && Math.abs(Number(lng)) <= 180
);

/** VN: lat ~8–24, lng ~102–110. Phát hiện cặp bị đảo. */
const looksLikeVietnamLat = (n) => Number.isFinite(n) && n >= 8 && n <= 24;
const looksLikeVietnamLng = (n) => Number.isFinite(n) && n >= 102 && n <= 110;

const normalizeVietnamPair = (a, b) => {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // Đúng chuẩn: lat, lng
  if (looksLikeVietnamLat(x) && looksLikeVietnamLng(y) && isValidLatLng(x, y)) {
    return { latitude: x, longitude: y };
  }
  // Bị đảo: lng, lat
  if (looksLikeVietnamLng(x) && looksLikeVietnamLat(y) && isValidLatLng(y, x)) {
    return { latitude: y, longitude: x };
  }
  if (isValidLatLng(x, y)) return { latitude: x, longitude: y };
  if (isValidLatLng(y, x)) return { latitude: y, longitude: x };
  return null;
};

const readCoords = (raw) => {
  const nested = raw.coordinates
    ?? raw.location?.coordinates
    ?? raw.geometry?.coordinates
    ?? raw.point?.coordinates;

  // Ưu tiên cặp tên field trước (kèm auto-swap VN).
  const named = normalizeVietnamPair(
    raw.latitude ?? raw.lat ?? raw.Latitude ?? raw.Lat,
    raw.longitude ?? raw.lng ?? raw.lon ?? raw.Longitude ?? raw.Lng,
  );
  if (named) return named;

  // GeoJSON thường [lng, lat]; cũng thử [lat, lng] nếu khớp VN.
  if (Array.isArray(nested) && nested.length >= 2) {
    const asLngLat = normalizeVietnamPair(nested[1], nested[0]); // treat as [lng,lat] → pass lat,lng
    if (asLngLat) return asLngLat;
    const asLatLng = normalizeVietnamPair(nested[0], nested[1]);
    if (asLatLng) return asLatLng;
  }

  return {
    latitude: Number(raw.latitude ?? raw.lat ?? NaN),
    longitude: Number(raw.longitude ?? raw.lng ?? NaN),
  };
};

const toTime = (value) => {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? 0 : ms;
};

const toRad = (deg) => (deg * Math.PI) / 180;

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Lọc nhiễu / nhảy GPS trước khi vẽ map (phòng thủ phía FE).
 * Gốc vẫn nên sửa ở GPS device + BE; FE chỉ giảm teleport hiển thị.
 */
const stabilizeGpsAgainstPrev = (prev, next) => {
  if (!prev || !isValidLatLng(prev.latitude, prev.longitude)) return next;

  const meters = haversineMeters(
    Number(prev.latitude),
    Number(prev.longitude),
    Number(next.latitude),
    Number(next.longitude),
  );
  if (!Number.isFinite(meters)) return next;

  const speedKmh = Number.isFinite(Number(next.speed)) ? Math.max(0, Number(next.speed)) : 0;
  const accM = Number.isFinite(Number(next.accuracyMeters)) && Number(next.accuracyMeters) > 0
    ? Number(next.accuracyMeters)
    : 12;
  const prevTs = toTime(prev.recordedAt);
  const nextTs = toTime(next.recordedAt);
  const dtSec = prevTs > 0 && nextTs > prevTs
    ? Math.min(120, (nextTs - prevTs) / 1000)
    : 3;

  const holdAsJumpCandidate = () => {
    const candidateLat = Number(prev.gpsCandidateLatitude);
    const candidateLng = Number(prev.gpsCandidateLongitude);
    const hasCandidate = isValidLatLng(candidateLat, candidateLng);
    const candidateDistance = hasCandidate
      ? haversineMeters(
        candidateLat,
        candidateLng,
        Number(next.latitude),
        Number(next.longitude),
      )
      : Number.POSITIVE_INFINITY;

    // Một GPS jump lẻ vẫn bị chặn. Live simulator/thiết bị gửi lại cùng vị trí
    // ở packet kế tiếp thì chấp nhận, tránh giữ marker vĩnh viễn ở tọa độ cũ.
    if (candidateDistance <= Math.max(20, accM * 2)) {
      return {
        ...next,
        gpsCandidateLatitude: null,
        gpsCandidateLongitude: null,
      };
    }

    return {
      ...next,
      latitude: prev.latitude,
      longitude: prev.longitude,
      heading: Number.isFinite(Number(prev.heading)) ? prev.heading : next.heading,
      gpsCandidateLatitude: next.latitude,
      gpsCandidateLongitude: next.longitude,
    };
  };

  if (meters < 0.3) {
    if (speedKmh < 1.2 && Number.isFinite(Number(prev.heading))) {
      return { ...next, heading: prev.heading, latitude: prev.latitude, longitude: prev.longitude };
    }
    return next;
  }

  // Đứng yên: bỏ nhiễu nhỏ + chặn teleport (vd. 350m khi speed=0).
  if (speedKmh < 1.2) {
    const noiseFloor = Math.max(10, accM * 0.8);
    if (meters < noiseFloor) {
      return {
        ...next,
        latitude: prev.latitude,
        longitude: prev.longitude,
        heading: Number.isFinite(Number(prev.heading)) ? prev.heading : next.heading,
      };
    }
    const teleportLimit = Math.max(40, accM * 3);
    if (meters > teleportLimit) {
      return holdAsJumpCandidate();
    }
  } else {
    const maxMeters = (Math.max(speedKmh, 3) / 3.6) * dtSec * 2.8 + Math.max(50, accM * 2);
    if (meters > maxMeters && meters > 100) {
      return holdAsJumpCandidate();
    }
  }

  if (speedKmh >= 1.2 && meters < 80) {
    return {
      ...next,
      latitude: Number(prev.latitude) * 0.35 + Number(next.latitude) * 0.65,
      longitude: Number(prev.longitude) * 0.35 + Number(next.longitude) * 0.65,
    };
  }

  return next;
};

/**
 * Chuẩn hóa payload BE/GPS/SignalR → marker ổn định.
 */
export const normalizeBoatLocation = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const { latitude, longitude } = readCoords(raw);
  if (!isValidLatLng(latitude, longitude)) return null;

  const boatId = String(
    raw.boatId ?? raw.BoatId ?? raw.boat?.id ?? raw.boat?.boatId ?? "",
  ).trim();
  const boatCode = String(
    raw.boatCode ?? raw.BoatCode ?? raw.boat?.boatCode ?? raw.code ?? "",
  ).trim();

  const key = boatId || boatCode;
  if (!key) return null;

  const headingRaw = Number(raw.heading ?? raw.Heading ?? raw.course ?? raw.Course);
  const heading = Number.isFinite(headingRaw) ? ((headingRaw % 360) + 360) % 360 : null;

  const seatRaw = Number(
    raw.seatCount ?? raw.SeatCount ?? raw.totalSeats ?? raw.TotalSeats ?? raw.capacity ?? raw.Capacity,
  );
  const passengerRaw = Number(
    raw.passengerCount
    ?? raw.PassengerCount
    ?? raw.occupiedSeats
    ?? raw.OccupiedSeats
    ?? raw.bookedSeats
    ?? raw.BookedSeats
    ?? raw.currentPassengers
    ?? raw.CurrentPassengers,
  );

  const accuracyRaw = Number(raw.accuracyMeters ?? raw.AccuracyMeters ?? raw.accuracy ?? raw.Accuracy);

  // BE tracking: boatStatus (ops) + activeIncident (bool/object) khi tàu đang Open incident.
  const boatStatus = raw.boatStatus
    ?? raw.BoatStatus
    ?? raw.operationalStatus
    ?? raw.OperationalStatus
    ?? raw.boat?.status
    ?? null;
  const activeIncidentRaw = raw.activeIncident ?? raw.ActiveIncident ?? null;
  const activeIncident = activeIncidentRaw === true
    || (activeIncidentRaw && typeof activeIncidentRaw === "object")
    || String(activeIncidentRaw || "").toLowerCase() === "true";
  const activeIncidentId = activeIncidentRaw && typeof activeIncidentRaw === "object"
    ? String(activeIncidentRaw.incidentId || activeIncidentRaw.id || "").trim() || null
    : null;

  return {
    boatId: boatId || boatCode,
    boatCode: boatCode || boatId,
    boatName: raw.boatName ?? raw.BoatName ?? raw.boat?.boatName ?? null,
    latitude,
    longitude,
    recordedAt: raw.recordedAt ?? raw.RecordedAt ?? raw.updatedAt ?? raw.timestamp ?? null,
    sequence: raw.sequence ?? raw.Sequence ?? null,
    speed: raw.speedKmh ?? raw.speed ?? raw.Speed ?? null,
    heading,
    accuracyMeters: Number.isFinite(accuracyRaw) && accuracyRaw > 0 ? accuracyRaw : null,
    isOnline: raw.isOnline === true || raw.IsOnline === true,
    status: raw.status ?? raw.Status ?? null,
    boatStatus: boatStatus ? String(boatStatus) : null,
    operationalStatus: boatStatus ? String(boatStatus) : null,
    activeIncident,
    activeIncidentId,
    seatCount: Number.isFinite(seatRaw) && seatRaw >= 0 ? seatRaw : null,
    passengerCount: Number.isFinite(passengerRaw) && passengerRaw >= 0 ? passengerRaw : null,
    imageUrl: raw.imageUrl ?? raw.ImageUrl ?? raw.boat?.imageUrl ?? null,
  };
};

/**
 * Trạng thái hiển thị trên card map:
 * - online (xanh): đang nhận tín hiệu GPS (isOnline)
 * - paused (vàng): bảo trì / tạm dừng vận hành (không dùng GPS idle)
 * - incident (đỏ): sự cố
 * - offline (xám): mất tín hiệu
 */
export const resolveBoatLiveStatus = (boat) => {
  // Open incident từ API/hub hoặc tracking.activeIncident — không suy từ GPS idle/moving.
  if (boat?.hasOpenIncident === true || boat?.activeIncident === true) {
    return { key: "incident", labelVn: "Sự cố", labelEn: "Incident", tone: "incident" };
  }

  const live = String(boat?.status || "").toLowerCase().replace(/[_\s-]/g, "");
  const ops = String(boat?.operationalStatus || boat?.boatStatus || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  const combined = `${live} ${ops}`;

  if (/incident|emergency|breakdown|fault|alert|sos|error/.test(combined)) {
    return { key: "incident", labelVn: "Sự cố", labelEn: "Incident", tone: "incident" };
  }

  // Bảo trì / tạm dừng vận hành (không dùng GPS idle).
  if (/undermaintenance|maintenance|paused|tamdung|hold/.test(ops)) {
    const isMaintenance = /undermaintenance|maintenance/.test(ops);
    return {
      key: isMaintenance ? "maintenance" : "paused",
      labelVn: isMaintenance ? "Bảo trì" : "Tạm dừng",
      labelEn: isMaintenance ? "Maintenance" : "Paused",
      tone: "paused",
    };
  }

  if (boat?.isOnline === true) {
    return { key: "online", labelVn: "Online", labelEn: "Online", tone: "online" };
  }

  return { key: "offline", labelVn: "Offline", labelEn: "Offline", tone: "offline" };
};

/**
 * Tàu hiện trên Live Tracking:
 * - Active
 * - Tạm dừng / bảo trì / sự cố (đội tàu từng vận hành)
 * - Ẩn Inactive / Retired
 */
export const isBoatEligibleForLiveMap = (boat) => {
  const ops = String(boat?.operationalStatus || boat?.boatStatus || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (!ops) return true;

  if (ops === "active") return true;
  if (/undermaintenance|maintenance|paused|tamdung|hold|incident|emergency|breakdown|fault|sos/.test(ops)) {
    return true;
  }
  if (ops === "inactive" || ops === "retired") return false;
  return true;
};

export const isBoatUnderMaintenance = (boat) => {
  const ops = String(boat?.operationalStatus || boat?.boatStatus || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  return /undermaintenance|maintenance/.test(ops);
};

export const normalizeBoatLocationList = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.boats)
          ? payload.boats
          : [];

  const byId = new Map();
  list.forEach((item) => {
    const normalized = normalizeBoatLocation(item);
    if (!normalized) return;
    byId.set(normalized.boatId, normalized);
  });
  return [...byId.values()];
};

/** Chỉ ghi đè nếu packet mới hơn hoặc vị trí thật sự đổi. */
export const upsertBoatLocationMap = (prevMap, location) => {
  const normalized = normalizeBoatLocation(location);
  if (!normalized) return prevMap;

  const prev = prevMap.get(normalized.boatId);
  if (prev) {
    const prevSeq = Number(prev.sequence);
    const nextSeq = Number(normalized.sequence);
    if (Number.isFinite(prevSeq) && Number.isFinite(nextSeq) && nextSeq < prevSeq) {
      return prevMap;
    }
    if (
      (!Number.isFinite(nextSeq) || !Number.isFinite(prevSeq))
      && toTime(normalized.recordedAt) > 0
      && toTime(prev.recordedAt) > toTime(normalized.recordedAt)
    ) {
      return prevMap;
    }
  }

  const stabilized = stabilizeGpsAgainstPrev(prev, normalized);

  if (prev) {
    const samePos =
      Math.abs(Number(prev.latitude) - Number(stabilized.latitude)) < 1e-7
      && Math.abs(Number(prev.longitude) - Number(stabilized.longitude)) < 1e-7
      && String(prev.sequence ?? "") === String(stabilized.sequence ?? "")
      && String(prev.recordedAt ?? "") === String(stabilized.recordedAt ?? "")
      && Boolean(prev.isOnline) === Boolean(stabilized.isOnline)
      && Number(prev.heading ?? NaN) === Number(stabilized.heading ?? NaN);

    if (samePos) return prevMap;
  }

  const next = new Map(prevMap);
  next.set(stabilized.boatId, { ...prev, ...stabilized });
  return next;
};
