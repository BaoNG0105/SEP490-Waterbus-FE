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
  // Chỉ coi idle khi BE/GPS nói rõ đứng yên — status rỗng không chặn cập nhật.
  const idleLike = speedKmh < 1.2 && (
    status === "idle" || status === "stopped" || status === "docked" || status === "stationary"
  );

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
 * BE dwellCountdown: tàu đã Arrived chưa Departed — đếm ngược thời gian dừng tại bến.
 * Có trong tracking/latest, BoatLocationUpdated, TripStopUpdated, operations/schedule.
 */
export const MOVING_SPEED_KMH = 1.2;

/** GPS/telemetry cho thấy tàu đang chạy — không còn “đang dừng tại bến”. */
export const isGpsActivelyMoving = (src) => {
  if (!src || typeof src !== "object") return false;
  const speed = Number(
    src.speed ?? src.Speed ?? src.speedKmh ?? src.SpeedKmh ?? src.latestSpeedKmh,
  );
  if (Number.isFinite(speed) && speed >= MOVING_SPEED_KMH) return true;
  const move = String(src.movementStatus || src.MovementStatus || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (move === "moving" || move === "enroute" || move === "inprogress" || move === "underway") {
    return true;
  }
  return false;
};

/** Bỏ dwellCountdown sticky khi tàu đã rời / đang chạy (tránh FE báo dừng trong khi simulator Running). */
export const shouldSuppressDwellCountdown = (src) => {
  if (!src || typeof src !== "object") return false;
  const stopKey = String(src.lastStopEvent || src.LastStopEvent || "").toLowerCase();
  if (stopKey === "departed") return true;
  // Tốc độ / movement Moving → không còn “đang dừng tại bến”, kể cả khi schedule còn dwell.
  return isGpsActivelyMoving(src);
};

export const normalizeDwellCountdown = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const src = raw.dwellCountdown ?? raw.DwellCountdown
    ?? ((raw.endsAt || raw.EndsAt || raw.remainingSeconds != null || raw.RemainingSeconds != null)
      ? raw
      : null);
  if (!src || typeof src !== "object") return null;

  const endsAt = src.endsAt ?? src.EndsAt ?? null;
  const startedAt = src.startedAt ?? src.StartedAt ?? null;
  const remainingSecondsRaw = Number(src.remainingSeconds ?? src.RemainingSeconds);
  const remainingMinutesRaw = Number(src.remainingMinutes ?? src.RemainingMinutes);
  const stayDurationMinutes = Number(src.stayDurationMinutes ?? src.StayDurationMinutes);
  const stopOrder = Number(src.stopOrder ?? src.StopOrder);
  const isOverdueRaw = src.isOverdue ?? src.IsOverdue;

  // Cần ít nhất endsAt hoặc remainingSeconds để FE đếm ngược.
  if (!endsAt && !Number.isFinite(remainingSecondsRaw) && !Number.isFinite(remainingMinutesRaw)) {
    return null;
  }

  return {
    tripStopId: src.tripStopId ?? src.TripStopId ?? null,
    stationId: src.stationId ?? src.StationId ?? null,
    stationCode: String(src.stationCode ?? src.StationCode ?? "").trim() || null,
    stationName: String(src.stationName ?? src.StationName ?? "").trim() || null,
    stopOrder: Number.isFinite(stopOrder) ? stopOrder : null,
    stayDurationMinutes: Number.isFinite(stayDurationMinutes) ? stayDurationMinutes : null,
    startedAt: startedAt ? String(startedAt) : null,
    endsAt: endsAt ? String(endsAt) : null,
    remainingSeconds: Number.isFinite(remainingSecondsRaw) ? remainingSecondsRaw : null,
    remainingMinutes: Number.isFinite(remainingMinutesRaw) ? remainingMinutesRaw : null,
    isOverdue: isOverdueRaw === true || String(isOverdueRaw || "").toLowerCase() === "true",
  };
};

/** Tính remaining realtime từ endsAt (ưu tiên) hoặc remainingSeconds snapshot từ BE. */
export const resolveDwellRemaining = (dwell, now = Date.now()) => {
  if (!dwell || typeof dwell !== "object") return null;
  const endsMs = dwell.endsAt ? Date.parse(String(dwell.endsAt)) : NaN;
  let remainingSeconds;
  if (!Number.isNaN(endsMs)) {
    remainingSeconds = Math.floor((endsMs - now) / 1000);
  } else if (Number.isFinite(Number(dwell.remainingSeconds))) {
    remainingSeconds = Math.floor(Number(dwell.remainingSeconds));
  } else if (Number.isFinite(Number(dwell.remainingMinutes))) {
    remainingSeconds = Math.floor(Number(dwell.remainingMinutes) * 60);
  } else {
    return null;
  }
  const isOverdue = dwell.isOverdue === true || remainingSeconds < 0;
  const clamped = Math.max(0, remainingSeconds);
  return {
    remainingSeconds: clamped,
    remainingMinutes: Math.ceil(clamped / 60),
    isOverdue,
  };
};

/** Format còn lại dạng m:ss (vd. 5:00, 1:09). */
export const formatDwellClock = (remainingSeconds) => {
  const total = Math.max(0, Math.floor(Number(remainingSeconds) || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

/** Bỏ prefix “Bến ” trùng khi ghép câu “tại bến …”. */
const formatStationLabelForDwell = (nameOrCode) => {
  const raw = String(nameOrCode || "").trim();
  if (!raw) return "";
  return raw.replace(/^Bến\s+/i, "").trim() || raw;
};

/**
 * Dwell đang ở bến cuối (điểm đến) — không còn “giờ dừng để đi tiếp”.
 * stayDurationMinutes = 0 ở terminal là bình thường; không báo quá giờ dừng.
 *
 * Tuyến vòng (Sightseeing): bến đầu = bến cuối cùng stationId → KHÔNG kết luận
 * “điểm cuối” chỉ vì trùng stationId/tên (sẽ nhầm lúc lên tàu ở bến xuất phát).
 */
export const isDwellAtTerminalStop = (dwell, stops = []) => {
  if (!dwell || typeof dwell !== "object") return false;
  if (dwell.isLastStop === true || dwell.isTerminal === true || dwell.isDestination === true) {
    return true;
  }

  const list = Array.isArray(stops)
    ? [...stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
    : [];
  if (list.length === 0) return false;

  const first = list[0];
  const last = list[list.length - 1];
  const lastOrder = Number(last?.stopOrder);
  const lastStopId = String(last?.tripStopId || last?.TripStopId || "").trim();
  const lastStationId = String(last?.stationId || last?.station?.stationId || "").trim();
  const firstStationId = String(first?.stationId || first?.station?.stationId || "").trim();
  const lastCode = String(last?.stationCode || last?.station?.stationCode || "").trim().toUpperCase();
  const lastName = String(last?.stationName || last?.station?.stationName || "").trim().toLowerCase();
  const loopSameStation = Boolean(
    firstStationId
    && lastStationId
    && firstStationId === lastStationId,
  );

  // Ưu tiên định danh stop cụ thể (đúng lần dừng cuối trên timeline).
  if (dwell.tripStopId && lastStopId && String(dwell.tripStopId) === lastStopId) return true;
  if (
    Number.isFinite(Number(dwell.stopOrder))
    && Number.isFinite(lastOrder)
    && Number(dwell.stopOrder) === lastOrder
  ) {
    return true;
  }

  // Vòng khép kín: trùng bến đầu/cuối → không đoán terminal theo station.
  if (loopSameStation) return false;

  if (dwell.stationId && lastStationId && String(dwell.stationId) === lastStationId) return true;
  if (dwell.stationCode && lastCode && String(dwell.stationCode).trim().toUpperCase() === lastCode) {
    return true;
  }
  const dwellName = String(dwell.stationName || "").trim().toLowerCase();
  if (dwellName && lastName && dwellName === lastName) return true;
  return false;
};

/** Copy UI: dừng giữa tuyến → đếm ngược; bến cuối → đến điểm cuối (không “quá giờ dừng”). */
export const formatDwellCountdownNotice = (dwell, lang = "VN", now = Date.now(), options = {}) => {
  if (!dwell || typeof dwell !== "object") return "";
  // GPS đang chạy / đã departed → không hiện “Đang dừng tại bến …” (tránh sticky BE/schedule).
  if (options.suppress === true) return "";
  if (options.boat && shouldSuppressDwellCountdown(options.boat)) return "";

  const isVn = lang === "VN";
  const station = formatStationLabelForDwell(dwell?.stationName || dwell?.stationCode);
  const isTerminal = options.isTerminalStop === true
    || isDwellAtTerminalStop(dwell, options.stops);

  // Điểm cuối: không còn lịch dừng để đi tiếp → không báo quá giờ dừng.
  if (isTerminal) {
    return station
      ? (isVn ? `Đã đến điểm cuối ${station}` : `Arrived at destination ${station}`)
      : (isVn ? "Đã đến điểm cuối" : "Arrived at destination");
  }

  const resolved = resolveDwellRemaining(dwell, now);
  if (!resolved) return "";

  const at = station
    ? (isVn ? `Đang dừng tại bến ${station}` : `Stopping at ${station}`)
    : (isVn ? "Đang dừng tại bến" : "Stopping at station");
  if (resolved.isOverdue || resolved.remainingSeconds <= 0) {
    return isVn ? `${at} - quá giờ dừng` : `${at} - overdue`;
  }
  const clock = formatDwellClock(resolved.remainingSeconds);
  return isVn ? `${at} - còn ${clock}` : `${at} - ${clock} left`;
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

  const headingRaw = Number(
    raw.heading ?? raw.Heading ?? raw.direction ?? raw.Direction ?? raw.course ?? raw.Course,
  );
  const heading = Number.isFinite(headingRaw) ? ((headingRaw % 360) + 360) % 360 : null;

  const seatRaw = Number(
    raw.seatCount ?? raw.SeatCount ?? raw.totalSeats ?? raw.TotalSeats ?? raw.capacity ?? raw.Capacity,
  );
  // Đừng Number(null) → 0: thiếu field thì để null để map không hiện "0/ghế".
  // Chỉ đếm khách đang trên tàu — không dùng totalPassengerCount (gồm vé đã checkout).
  const passengerSource = raw.onboardPassengerCount
    ?? raw.OnboardPassengerCount
    ?? raw.checkedInPassengerCount
    ?? raw.CheckedInPassengerCount
    ?? raw.passengerCount
    ?? raw.PassengerCount
    ?? raw.currentPassengers
    ?? raw.CurrentPassengers
    ?? raw.occupiedSeats
    ?? raw.OccupiedSeats;
  const passengerRaw = passengerSource === null || passengerSource === undefined || passengerSource === ""
    ? NaN
    : Number(passengerSource);
  const dwellCountdown = normalizeDwellCountdown(raw);

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
    ?? raw.RemainingDistanceKm
    ?? raw.distanceKmToNextStation
    ?? raw.DistanceKmToNextStation
    ?? NaN,
  );
  const remainingMetersRaw = Number(
    raw.remainingDistanceMetersToNextStation
    ?? raw.RemainingDistanceMetersToNextStation
    ?? raw.remainingDistanceM
    ?? raw.RemainingDistanceM
    ?? raw.distanceMetersToNextStation
    ?? raw.DistanceToNextStationMeters
    ?? NaN,
  );
  const remainingMinRaw = Number(
    raw.remainingMinutesToNextStation
    ?? raw.RemainingMinutesToNextStation
    ?? raw.etaMinutesToNextStation
    ?? raw.EtaMinutesToNextStation
    ?? raw.remainingMinutes
    ?? raw.RemainingMinutes
    ?? raw.etaMinutes
    ?? raw.EtaMinutes
    ?? NaN,
  );
  const movementStatus = raw.movementStatus
    ?? raw.MovementStatus
    ?? raw.tripMovementStatus
    ?? raw.TripMovementStatus
    ?? null;
  // GPS Trip Boarding đôi khi chỉ nằm ở status
  const statusRaw = String(raw.status ?? raw.Status ?? "").trim();
  const statusKey = statusRaw.toLowerCase().replace(/[_\s-]/g, "");
  const resolvedMovement = movementStatus
    || (statusKey === "boarding" ? "Boarding" : null)
    || (statusKey === "scheduled" ? "Scheduled" : null);
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
    status: statusRaw || null,
    boatStatus: boatStatus ? String(boatStatus) : null,
    operationalStatus: boatStatus ? String(boatStatus) : null,
    activeIncident,
    activeIncidentId,
    seatCount: Number.isFinite(seatRaw) && seatRaw >= 0 ? seatRaw : null,
    passengerCount: Number.isFinite(passengerRaw) && passengerRaw >= 0 ? passengerRaw : null,
    imageUrl: raw.imageUrl ?? raw.ImageUrl ?? raw.boat?.imageUrl ?? null,
    // GPS/BE có thể gửi kèm (tracking hoặc operations schedule merge).
    movementStatus: resolvedMovement ? String(resolvedMovement) : null,
    nextStationId: nextStationId ? String(nextStationId) : null,
    nextStationName: nextStationName ? String(nextStationName) : null,
    nextStationCode: nextStationCode ? String(nextStationCode) : null,
    currentStationName: currentStationName != null && currentStationName !== ""
      ? String(currentStationName)
      : null,
    remainingDistanceKmToNextStation: (() => {
      if (Number.isFinite(remainingKmRaw) && remainingKmRaw >= 0) return remainingKmRaw;
      if (Number.isFinite(remainingMetersRaw) && remainingMetersRaw >= 0) {
        return remainingMetersRaw / 1000;
      }
      return null;
    })(),
    remainingMinutesToNextStation: Number.isFinite(remainingMinRaw) ? remainingMinRaw : null,
    lastStopEvent: (() => {
      const v = raw.lastStopEvent ?? raw.LastStopEvent ?? raw.stopEvent ?? raw.StopEvent
        ?? raw.tripStopEvent ?? raw.TripStopEvent ?? null;
      return v != null && String(v).trim() ? String(v).trim() : null;
    })(),
    dwellCountdown,
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
      && Number(prev.heading ?? NaN) === Number(normalized.heading ?? NaN)
      && Number(prev.speed ?? NaN) === Number(normalized.speed ?? NaN)
      && Number(prev.remainingMinutesToNextStation ?? NaN)
        === Number(normalized.remainingMinutesToNextStation ?? NaN)
      && Number(prev.remainingDistanceKmToNextStation ?? NaN)
        === Number(normalized.remainingDistanceKmToNextStation ?? NaN)
      && String(prev.movementStatus ?? "") === String(normalized.movementStatus ?? "")
      && String(prev.nextStationName ?? "") === String(normalized.nextStationName ?? "")
      && String(prev.nextStationCode ?? "") === String(normalized.nextStationCode ?? "")
      && String(prev.currentStationName ?? "") === String(normalized.currentStationName ?? "")
      && String(prev.lastStopEvent ?? "") === String(normalized.lastStopEvent ?? "")
      && String(prev.status ?? "") === String(normalized.status ?? "")
      && String(prev.dwellCountdown?.endsAt ?? "") === String(normalized.dwellCountdown?.endsAt ?? "")
      && Number(prev.dwellCountdown?.remainingSeconds ?? NaN)
        === Number(normalized.dwellCountdown?.remainingSeconds ?? NaN)
      && Number(prev.passengerCount ?? NaN) === Number(normalized.passengerCount ?? NaN);

    if (samePos) return prevMap;
  }

  const stabilized = stabilizeIdleTeleport(prev, normalized);
  const prevLive = prev && !prev.fromSticky ? prev : null;
  const statusLower = String(stabilized.status || prevLive?.status || "").toLowerCase();
  const tripCleared = ["idle", "stopped", "offline", "sticky"].includes(statusLower);
  const APPROACH_KM = 0.4;

  const keepStr = (nextVal, prevVal) => {
    const n = nextVal != null && String(nextVal).trim() ? String(nextVal).trim() : null;
    if (n) return n;
    if (tripCleared) return null;
    const p = prevVal != null && String(prevVal).trim() ? String(prevVal).trim() : null;
    return p;
  };

  // GPS/Azure: list hay gửi null hoặc 0p/0km sau packet đủ → đừng đè ETA đang đúng.
  const nextKmRaw = Number(stabilized.remainingDistanceKmToNextStation);
  const prevKmRaw = Number(prevLive?.remainingDistanceKmToNextStation);
  let remainingDistanceKmToNextStation = null;
  if (tripCleared) {
    remainingDistanceKmToNextStation = Number.isFinite(nextKmRaw) ? nextKmRaw : null;
  } else if (Number.isFinite(nextKmRaw)) {
    if (nextKmRaw <= 0 && Number.isFinite(prevKmRaw) && prevKmRaw > APPROACH_KM) {
      remainingDistanceKmToNextStation = prevKmRaw;
    } else {
      remainingDistanceKmToNextStation = nextKmRaw;
    }
  } else if (Number.isFinite(prevKmRaw)) {
    remainingDistanceKmToNextStation = prevKmRaw;
  }

  const nextMinRaw = Number(stabilized.remainingMinutesToNextStation);
  const prevMinRaw = Number(prevLive?.remainingMinutesToNextStation);
  let remainingMinutesToNextStation = null;
  if (tripCleared) {
    remainingMinutesToNextStation = Number.isFinite(nextMinRaw) ? nextMinRaw : null;
  } else if (Number.isFinite(nextMinRaw)) {
    // 0p / <1p nhưng còn xa (2.9km) → giữ phút cũ hoặc để ước từ km
    const stillFar = Number.isFinite(remainingDistanceKmToNextStation)
      && remainingDistanceKmToNextStation > APPROACH_KM;
    if (nextMinRaw <= 0 && stillFar) {
      remainingMinutesToNextStation = Number.isFinite(prevMinRaw) && prevMinRaw > 0
        ? prevMinRaw
        : null;
    } else {
      remainingMinutesToNextStation = nextMinRaw;
    }
  } else if (Number.isFinite(prevMinRaw)) {
    remainingMinutesToNextStation = prevMinRaw;
  }

  const speedNum = Number.isFinite(Number(stabilized.speed))
    ? Number(stabilized.speed)
    : Number(prevLive?.speed);
  if (
    Number.isFinite(remainingDistanceKmToNextStation)
    && remainingDistanceKmToNextStation > 0.05
    && Number.isFinite(speedNum)
    && speedNum >= 1.2
  ) {
    const fromSpeed = Math.max(
      0,
      Math.round((remainingDistanceKmToNextStation / speedNum) * 60),
    );
    // Thiếu phút / 0p / thấp hơn ước km+tốc độ (≥1p) → khớp panel GPS (~2p với 1.1km).
    if (
      remainingMinutesToNextStation == null
      || remainingMinutesToNextStation <= 0
      || (
        fromSpeed > remainingMinutesToNextStation
        && fromSpeed - remainingMinutesToNextStation >= 1
        && remainingDistanceKmToNextStation > APPROACH_KM * 0.3
      )
    ) {
      remainingMinutesToNextStation = fromSpeed;
    }
  }

  const merged = {
    ...(prevLive || {}),
    ...stabilized,
    boatId: (prevLive ? prevLive.boatId : null) || stabilized.boatId,
    boatCode: stabilized.boatCode || prevLive?.boatCode,
    latitude: stabilized.latitude,
    longitude: stabilized.longitude,
    gpsCandidateLatitude: stabilized.gpsCandidateLatitude ?? null,
    gpsCandidateLongitude: stabilized.gpsCandidateLongitude ?? null,
    nextStationId: keepStr(stabilized.nextStationId, prevLive?.nextStationId),
    nextStationName: keepStr(stabilized.nextStationName, prevLive?.nextStationName),
    nextStationCode: keepStr(stabilized.nextStationCode, prevLive?.nextStationCode),
    currentStationName: keepStr(stabilized.currentStationName, prevLive?.currentStationName),
    movementStatus: keepStr(stabilized.movementStatus, prevLive?.movementStatus),
    remainingDistanceKmToNextStation,
    remainingMinutesToNextStation,
    // dwellCountdown: packet mới có thì dùng; departed/đang chạy thì xóa; thiếu field thì giữ bản cũ khi còn AtStation.
    dwellCountdown: (() => {
      if (tripCleared) return null;
      if (shouldSuppressDwellCountdown(stabilized)) return null;
      if (Number.isFinite(speedNum) && speedNum >= MOVING_SPEED_KMH) return null;
      if (stabilized.dwellCountdown) return stabilized.dwellCountdown;
      const stopKey = String(stabilized.lastStopEvent || "").toLowerCase();
      const moveKey = String(stabilized.movementStatus || "").toLowerCase().replace(/[_\s-]/g, "");
      if (stopKey === "departed" || moveKey === "departed" || moveKey === "moving" || moveKey === "arriving") {
        return null;
      }
      return prevLive?.dwellCountdown ?? null;
    })(),
    passengerCount: Number.isFinite(Number(stabilized.passengerCount))
      ? Number(stabilized.passengerCount)
      : (tripCleared ? null : (prevLive?.passengerCount ?? null)),
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
