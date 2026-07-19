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
 * Bám GPS. Chỉ chặn "teleport đứng yên" cực lớn (BE nhảy vài km khi speed 0)
 * và cần 2 packet xác nhận chỗ mới. Mọi dịch chuyển bình thường → theo GPS.
 */
const IDLE_TELEPORT_M = 600; // idle mà nhảy >= mức này mới nghi teleport
const TELEPORT_CONFIRM_M = 120; // 2 packet trong bán kính này = chỗ mới thật
let lastTeleportWarnAt = 0;

const stabilizeIdleTeleport = (prev, next) => {
  if (!prev || !isValidLatLng(prev.latitude, prev.longitude)) {
    return { ...next, gpsCandidateLatitude: null, gpsCandidateLongitude: null };
  }

  const meters = haversineMeters(
    Number(prev.latitude),
    Number(prev.longitude),
    Number(next.latitude),
    Number(next.longitude),
  );
  if (!Number.isFinite(meters)) {
    return { ...next, gpsCandidateLatitude: null, gpsCandidateLongitude: null };
  }

  const speedKmh = Number.isFinite(Number(next.speed)) ? Math.max(0, Number(next.speed)) : 0;
  const status = String(next.status || "").toLowerCase().replace(/[_\s-]/g, "");
  const idleLike = speedKmh < 1.2 && (status === "idle" || status === "stopped" || status === "docked" || status === "stationary" || status === "");

  // Tàu đang chạy (có tốc độ) hoặc dịch chuyển vừa phải → theo GPS luôn.
  if (!idleLike || meters < IDLE_TELEPORT_M) {
    return { ...next, gpsCandidateLatitude: null, gpsCandidateLongitude: null };
  }

  // Idle + nhảy rất xa: cần 2 packet cùng chỗ mới mới nhận.
  const candLat = Number(prev.gpsCandidateLatitude);
  const candLng = Number(prev.gpsCandidateLongitude);
  if (isValidLatLng(candLat, candLng)) {
    const toCand = haversineMeters(candLat, candLng, Number(next.latitude), Number(next.longitude));
    if (Number.isFinite(toCand) && toCand < TELEPORT_CONFIRM_M) {
      return { ...next, gpsCandidateLatitude: null, gpsCandidateLongitude: null };
    }
  }

  if (typeof console !== "undefined" && Date.now() - lastTeleportWarnAt > 8000) {
    lastTeleportWarnAt = Date.now();
    console.warn(
      `[GPS] Giữ vị trí cũ — chờ xác nhận teleport ${Math.round(meters)}m`,
      next.boatCode || next.boatId,
    );
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

/** Persist GPS đã chấp nhận — tránh mỗi lần F5 lấy packet teleport khác từ BE. */
const STICKY_GPS_KEY = "wb.liveGps.lastPositions.v1";
const STICKY_GPS_TTL_MS = 12 * 60 * 60 * 1000;

/** Bộ nhớ process — sống qua remount React; bổ sung cho localStorage. */
const lastAcceptedGpsByKey = new Map();

const stickyKeyFor = (boat) => {
  const code = String(boat?.boatCode || "").trim().toUpperCase();
  if (code) return `code:${code}`;
  const id = String(boat?.boatId || "").trim();
  return id ? `id:${id}` : "";
};

const readStickyStore = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STICKY_GPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStickyStore = (store) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STICKY_GPS_KEY, JSON.stringify(store));
  } catch {
    // quota / private mode
  }
};

export const getStickyBoatPosition = (boatLike) => {
  const key = stickyKeyFor(boatLike);
  if (!key) return null;
  const row = readStickyStore()[key];
  if (!row) return null;
  if (Date.now() - Number(row.savedAt || 0) > STICKY_GPS_TTL_MS) return null;
  if (!isValidLatLng(row.latitude, row.longitude)) return null;
  return {
    boatId: row.boatId || boatLike.boatId,
    boatCode: row.boatCode || boatLike.boatCode,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    heading: Number.isFinite(Number(row.heading)) ? Number(row.heading) : null,
    recordedAt: row.recordedAt || null,
    savedAt: row.savedAt,
  };
};

export const saveStickyBoatPosition = (boat) => {
  if (!boat || !isValidLatLng(boat.latitude, boat.longitude)) return;
  const key = stickyKeyFor(boat);
  if (!key) return;
  const store = readStickyStore();
  store[key] = {
    boatId: boat.boatId || "",
    boatCode: boat.boatCode || "",
    latitude: Number(boat.latitude),
    longitude: Number(boat.longitude),
    heading: Number.isFinite(Number(boat.heading)) ? Number(boat.heading) : null,
    recordedAt: boat.recordedAt || null,
    savedAt: Date.now(),
  };
  writeStickyStore(store);
};

/** Seed map từ GPS đã lưu (F5 vẫn giữ chỗ cũ nếu BE đang teleport). */
export const loadStickyBoatLocationMap = () => {
  const store = readStickyStore();
  const map = new Map();
  const now = Date.now();
  Object.values(store).forEach((row) => {
    if (!row || now - Number(row.savedAt || 0) > STICKY_GPS_TTL_MS) return;
    if (!isValidLatLng(row.latitude, row.longitude)) return;
    const boatCode = String(row.boatCode || "").trim();
    const boatId = String(row.boatId || boatCode || "").trim();
    if (!boatId && !boatCode) return;
    const mapKey = boatCode ? boatCode.toUpperCase() : boatId;
    const seeded = {
      boatId: boatId || boatCode,
      boatCode: boatCode || boatId,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      heading: Number.isFinite(Number(row.heading)) ? Number(row.heading) : null,
      recordedAt: row.recordedAt || null,
      isOnline: false,
      status: "sticky",
      fromSticky: true,
    };
    map.set(mapKey, seeded);
    const memKey = stickyKeyFor(seeded);
    if (memKey) {
      lastAcceptedGpsByKey.set(memKey, {
        boatId: seeded.boatId,
        boatCode: seeded.boatCode,
        latitude: seeded.latitude,
        longitude: seeded.longitude,
        heading: seeded.heading,
        recordedAt: seeded.recordedAt,
      });
    }
  });
  return map;
};

/**
 * Chuẩn hóa payload BE/GPS/SignalR → marker.
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

  const remainingKmRaw = Number(
    raw.remainingDistanceKmToNextStation
    ?? raw.RemainingDistanceKmToNextStation
    ?? raw.remainingDistanceKm
    ?? NaN,
  );
  const remainingMinRaw = Number(
    raw.remainingMinutesToNextStation
    ?? raw.RemainingMinutesToNextStation
    ?? NaN,
  );
  const movementStatus = raw.movementStatus ?? raw.MovementStatus ?? null;
  const nextStationId = raw.nextStationId ?? raw.NextStationId ?? null;
  const nextStationName = raw.nextStationName ?? raw.NextStationName ?? null;
  const nextStationCode = raw.nextStationCode ?? raw.NextStationCode ?? null;
  const currentStationName = raw.currentStationName ?? raw.CurrentStationName ?? null;

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
    // GPS/BE có thể gửi kèm (tracking hoặc operations schedule merge).
    movementStatus: movementStatus ? String(movementStatus) : null,
    nextStationId: nextStationId ? String(nextStationId) : null,
    nextStationName: nextStationName ? String(nextStationName) : null,
    nextStationCode: nextStationCode ? String(nextStationCode) : null,
    currentStationName: currentStationName != null && currentStationName !== ""
      ? String(currentStationName)
      : null,
    remainingDistanceKmToNextStation: Number.isFinite(remainingKmRaw) ? remainingKmRaw : null,
    remainingMinutesToNextStation: Number.isFinite(remainingMinRaw) ? remainingMinRaw : null,
    lastStopEvent: (() => {
      const v = raw.lastStopEvent ?? raw.LastStopEvent ?? raw.stopEvent ?? raw.StopEvent
        ?? raw.tripStopEvent ?? raw.TripStopEvent ?? null;
      return v != null && String(v).trim() ? String(v).trim() : null;
    })(),
  };
};

/**
 * Số tầng từ boat catalog / detail.
 * - Đọc numberOfDecks / NumberOfDecks / deckCount
 * - Nếu thiếu: StandardAndVip (Water Sightseeing) → 2 tầng
 */
export const resolveBoatNumberOfDecks = (source, fallback = 1) => {
  if (!source || typeof source !== "object") return fallback;

  const raw = source.numberOfDecks
    ?? source.NumberOfDecks
    ?? source.deckCount
    ?? source.DeckCount
    ?? source.decks
    ?? source.Decks
    ?? source.boat?.numberOfDecks
    ?? source.boat?.NumberOfDecks;

  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1) return Math.trunc(n);

  const setup = String(source.seatSetupType || source.SeatSetupType || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  // FE: StandardAndVip = Water Sightseeing — thường 2 tầng.
  if (setup === "standardandvip") return 2;

  return fallback;
};

export const resolveBoatServiceType = (source, fallback = "Passenger") => {
  if (!source || typeof source !== "object") return fallback;
  const raw = source.serviceType
    ?? source.ServiceType
    ?? source.boat?.serviceType
    ?? source.boat?.ServiceType;
  if (raw) return String(raw);
  const code = String(source.boatCode || source.code || source.BoatCode || "").toUpperCase();
  if (code.startsWith("SOS") || code.startsWith("RS_")) return "Rescue";
  return fallback;
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

/**
 * Ghi nhận vị trí GPS. Chặn teleport khi idle (BE hay nhảy 100m–2km).
 * Bỏ packet cũ hơn (recordedAt ưu tiên; sequence khi thiếu/timestamp bằng nhau).
 */
export const upsertBoatLocationMap = (prevMap, location) => {
  const normalized = normalizeBoatLocation(location);
  if (!normalized) return prevMap;

  const codeKey = stickyKeyFor(normalized);
  // Ưu tiên key theo boatCode để luôn gộp đúng 1 marker / tàu.
  const preferredKey = normalized.boatCode
    ? String(normalized.boatCode).trim().toUpperCase()
    : normalized.boatId;

  // Gộp theo boatId hoặc boatCode nếu đã có bản ghi cùng tàu.
  let prev = prevMap.get(preferredKey) || prevMap.get(normalized.boatId);
  let mapKey = preferredKey;
  if (!prev && normalized.boatCode) {
    for (const [key, row] of prevMap.entries()) {
      if (
        String(row.boatCode || "").toUpperCase() === String(normalized.boatCode).toUpperCase()
        || String(row.boatId || "") === String(normalized.boatCode)
        || String(key).toUpperCase() === String(normalized.boatCode).toUpperCase()
      ) {
        prev = row;
        mapKey = preferredKey;
        break;
      }
    }
  }

  // F5 / remount: lấy GPS lần cuối (memory → localStorage).
  if (!prev) {
    const mem = codeKey ? lastAcceptedGpsByKey.get(codeKey) : null;
    if (mem && isValidLatLng(mem.latitude, mem.longitude)) {
      prev = { ...mem, fromSticky: true };
    } else {
      const sticky = getStickyBoatPosition(normalized);
      if (sticky) prev = sticky;
    }
  }

  if (prev && !prev.fromSticky) {
    const prevTs = toTime(prev.recordedAt);
    const nextTs = toTime(normalized.recordedAt);
    if (prevTs > 0 && nextTs > 0 && nextTs < prevTs) {
      return prevMap;
    }

    const sameTime = !(prevTs > 0 && nextTs > 0) || prevTs === nextTs;
    if (sameTime) {
      const prevSeq = Number(prev.sequence);
      const nextSeq = Number(normalized.sequence);
      if (Number.isFinite(prevSeq) && Number.isFinite(nextSeq) && nextSeq < prevSeq) {
        return prevMap;
      }
    }

    const samePos =
      Math.abs(Number(prev.latitude) - Number(normalized.latitude)) < 1e-7
      && Math.abs(Number(prev.longitude) - Number(normalized.longitude)) < 1e-7
      && String(prev.sequence ?? "") === String(normalized.sequence ?? "")
      && String(prev.recordedAt ?? "") === String(normalized.recordedAt ?? "")
      && Boolean(prev.isOnline) === Boolean(normalized.isOnline)
      && Number(prev.heading ?? NaN) === Number(normalized.heading ?? NaN);

    if (samePos) return prevMap;
  }

  const stabilized = stabilizeIdleTeleport(prev, normalized);
  const merged = {
    ...(prev?.fromSticky ? {} : (prev || {})),
    ...stabilized,
    boatId: (prev && !prev.fromSticky ? prev.boatId : null) || stabilized.boatId,
    boatCode: stabilized.boatCode || prev?.boatCode,
    latitude: stabilized.latitude,
    longitude: stabilized.longitude,
    gpsCandidateLatitude: stabilized.gpsCandidateLatitude ?? null,
    gpsCandidateLongitude: stabilized.gpsCandidateLongitude ?? null,
    fromSticky: false,
  };
  saveStickyBoatPosition(merged);
  if (codeKey && isValidLatLng(merged.latitude, merged.longitude)) {
    lastAcceptedGpsByKey.set(codeKey, {
      boatId: merged.boatId,
      boatCode: merged.boatCode,
      latitude: merged.latitude,
      longitude: merged.longitude,
      heading: merged.heading,
      recordedAt: merged.recordedAt,
      gpsCandidateLatitude: merged.gpsCandidateLatitude ?? null,
      gpsCandidateLongitude: merged.gpsCandidateLongitude ?? null,
    });
  }

  const next = new Map(prevMap);
  // Dọn key cũ (UUID / code khác) cùng tàu — chỉ giữ preferredKey.
  if (normalized.boatCode) {
    const codeUp = String(normalized.boatCode).toUpperCase();
    for (const [key, row] of next.entries()) {
      if (key === mapKey) continue;
      const sameBoat =
        String(row.boatCode || "").toUpperCase() === codeUp
        || String(row.boatId || "").toUpperCase() === codeUp
        || String(key).toUpperCase() === codeUp
        || (normalized.boatId && String(key) === String(normalized.boatId));
      if (sameBoat) next.delete(key);
    }
  } else if (mapKey !== normalized.boatId && prevMap.has(normalized.boatId)) {
    next.delete(normalized.boatId);
  }
  next.set(mapKey, merged);
  return next;
};
