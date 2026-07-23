const normalizeStatusKey = (status) => {
  const key = String(status || "").toLowerCase().replace(/[_\s-]/g, "");
  if (key === "completed" || key === "arrived") return "Completed";
  if (key === "cancelled" || key === "canceled") return "Cancelled";
  return key;
};

/** Lấy delayInfo từ trip / payload SignalR. */
export const pickDelayInfo = (source) => {
  if (!source || typeof source !== "object") return null;
  const info = source.delayInfo ?? source.DelayInfo ?? null;
  if (info && typeof info === "object") return info;
  // Một số payload flatten field ra root.
  if (
    source.isDelayActive != null
    || source.delayStartedAt
    || source.DelayStartedAt
    || source.delayMinutes != null
  ) {
    return {
      isDelayActive: source.isDelayActive ?? source.IsDelayActive ?? false,
      delayStartedAt: source.delayStartedAt ?? source.DelayStartedAt ?? null,
      delayMinutes: source.delayMinutes ?? source.DelayMinutes ?? source.totalDelayMinutes ?? null,
      reason: source.reason ?? source.delayReason ?? source.DelayReason ?? null,
      stationName: source.stationName ?? source.StationName ?? null,
      startStopOrder: source.startStopOrder ?? source.StartStopOrder ?? null,
    };
  }
  return null;
};

export const isDelayActive = (tripOrInfo) => {
  const info = tripOrInfo?.isDelayActive != null || tripOrInfo?.delayStartedAt
    ? tripOrInfo
    : pickDelayInfo(tripOrInfo);
  if (!info) return false;
  return Boolean(info.isDelayActive ?? info.IsDelayActive);
};

/** Số phút delay do BE/GPS chốt — FE không tự tính now - delayStartedAt. */
export const pickDelayMinutes = (tripOrInfo) => {
  const info = pickDelayInfo(tripOrInfo) || tripOrInfo;
  const n = Number(
    info?.delayMinutes
    ?? info?.DelayMinutes
    ?? info?.elapsedMinutes
    ?? tripOrInfo?.totalDelayMinutes
    ?? tripOrInfo?.delayMinutes
    ?? tripOrInfo?.elapsedMinutes,
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const pickDisplayDeparture = (trip) => (
  trip?.adjustedDepartureTime
  ?? trip?.adjustedDeparture
  ?? trip?.adjustedStartAt
  ?? trip?.departureTime
  ?? trip?.plannedDeparture
  ?? trip?.scheduledDepartureAt
  ?? null
);

export const pickDisplayArrival = (trip) => (
  trip?.adjustedArrivalTime
  ?? trip?.adjustedArrival
  ?? trip?.adjustedEndAt
  ?? trip?.arrivalTime
  ?? trip?.plannedArrival
  ?? trip?.scheduledArrivalAt
  ?? null
);

/** Parse datetime trip — thiếu timezone thì mặc định +07 (VN). */
const parseTripDateTime = (raw) => {
  if (raw == null || raw === "") return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T00:00:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  const d = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Giờ xuất phát theo lịch gốc (KHÔNG dùng adjusted — adjusted đã cộng delay).
 */
export const resolveTripPlannedDepartureDate = (trip) => {
  if (!trip) return null;
  return parseTripDateTime(
    trip.plannedDepartureTime
    ?? trip.plannedDeparture
    ?? trip.scheduledDepartureAt
    ?? trip.departureTime
    ?? trip.DepartureTime
    ?? null,
  );
};

/** Giờ xuất phát đang hiển thị (có thể đã adjusted). */
export const resolveTripDepartureDate = (trip) => {
  if (!trip) return null;
  return parseTripDateTime(pickDisplayDeparture(trip));
};

/** Tàu đã rời ít nhất 1 bến (bắt đầu chạy thật). Chỉ actualArrival ở bến đầu ≠ đã xuất phát. */
export const hasTripLeftAStop = (trip) => {
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];
  return stops.some((stop) => Boolean(stop?.actualDeparture));
};

/** @deprecated dùng hasTripLeftAStop */
export const hasTripActuallyStarted = (trip) => hasTripLeftAStop(trip);

/**
 * Chặn Delay khi chưa tới giờ xuất phát theo lịch.
 * Chỉ mở khi: đã tới giờ planned OR tàu đã rời bến.
 */
export const getTripDelayTooEarlyMessage = (trip, lang = "VN") => {
  if (!trip) {
    return lang === "VN" ? "Không có thông tin chuyến." : "Trip information is missing.";
  }
  // Đã rời bến → cho delay (dù đồng hồ lệch).
  if (hasTripLeftAStop(trip)) return "";

  const departure = resolveTripPlannedDepartureDate(trip);
  if (!departure) {
    return lang === "VN"
      ? "Không xác định được giờ xuất phát — chưa thể bắt đầu delay."
      : "Departure time is unknown — cannot start delay yet.";
  }

  if (Date.now() >= departure.getTime()) return "";

  const timeLabel = departure.toLocaleString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return lang === "VN"
    ? `Chuyến chưa tới giờ xuất phát (${timeLabel}). Không thể Delay trước giờ chạy.`
    : `Trip has not reached departure time (${timeLabel}). Cannot delay before departure.`;
};

/** Có thể bấm Delay: chưa xong/hủy, không đang delay, và đã tới giờ xuất phát. */
export const canStartTripDelay = (trip) => {
  if (!trip) return false;
  const status = normalizeStatusKey(trip.tripStatus || trip.status);
  if (status === "Completed" || status === "Cancelled") return false;
  if (isDelayActive(trip)) return false;
  // Ẩn nút Delay khi chưa tới giờ — không chỉ cảnh báo lúc bấm.
  if (getTripDelayTooEarlyMessage(trip, "EN")) return false;
  return true;
};

/** Đang delay → hiện nút Tiếp tục. */
export const canResumeTripDelay = (trip) => Boolean(trip) && isDelayActive(trip);

/**
 * startStopOrder: ưu tiên bến đang dừng (đã đến, chưa rời),
 * không thì bến kế tiếp / bến đầu.
 */
export const resolveDelayStartStopOrder = (stops = []) => {
  const list = Array.isArray(stops) ? [...stops] : [];
  list.sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0));
  if (!list.length) return 1;

  for (let i = 0; i < list.length; i += 1) {
    const stop = list[i];
    const isLast = i === list.length - 1;
    if (stop?.actualArrival && !stop?.actualDeparture) {
      return Number(stop.stopOrder) || i + 1;
    }
    if (isLast && stop?.actualArrival) {
      return Number(stop.stopOrder) || i + 1;
    }
  }

  for (let i = 0; i < list.length; i += 1) {
    const stop = list[i];
    const isLast = i === list.length - 1;
    if (isLast) {
      if (!stop.actualArrival) return Number(stop.stopOrder) || i + 1;
    } else if (!stop.actualDeparture) {
      return Number(stop.stopOrder) || i + 1;
    }
  }

  return Number(list[0]?.stopOrder) || 1;
};

export const pickStationNameForStopOrder = (stops = [], stopOrder) => {
  const order = Number(stopOrder);
  const hit = (stops || []).find((s) => Number(s?.stopOrder) === order);
  if (!hit) return "";
  return hit.stationName
    || hit.station?.stationName
    || hit.station?.name
    || hit.name
    || hit.stationCode
    || "";
};

/**
 * Text UI khi đang delay — phút lấy từ BE (GPS → BE → SignalR/API).
 * FE không tự đếm now - delayStartedAt.
 */
export const formatActiveDelayLine = (delayInfo, { lang = "VN" } = {}) => {
  if (!isDelayActive(delayInfo)) return "";
  const info = pickDelayInfo(delayInfo) || delayInfo;
  const station = String(info?.stationName || info?.StationName || "").trim();
  const reason = String(info?.reason || info?.delayReason || "").trim();
  const mins = pickDelayMinutes(delayInfo);
  if (lang === "VN") {
    const where = station
      ? `Tàu đang dừng tại bến ${station}`
      : (reason || "Tàu đang dừng");
    return mins > 0
      ? `Đang delay: ${where} - ${mins} phút`
      : `Đang delay: ${where}`;
  }
  const where = station
    ? `Boat stopped at ${station}`
    : (reason || "Boat is delayed");
  return mins > 0
    ? `Delaying: ${where} - ${mins} min`
    : `Delaying: ${where}`;
};

export const formatPostResumeDelayLine = (tripOrInfo, lang = "VN") => {
  const mins = pickDelayMinutes(tripOrInfo);
  if (mins <= 0) return "";
  return lang === "VN"
    ? `Chuyến trễ ${mins} phút`
    : `Trip delayed ${mins} minutes`;
};

export const formatAffectedTripLine = (trip, lang = "VN") => {
  const added = Number(trip?.addedDelayMinutes);
  if (!Number.isFinite(added) || added <= 0) return "";
  return lang === "VN"
    ? `Dời giờ +${added} phút do tàu về muộn`
    : `Shifted +${added} min due to late boat`;
};

const patchTripFieldsFromDelay = (trip, patch) => {
  if (!trip || !patch || typeof patch !== "object") return trip;
  const delayInfo = pickDelayInfo(patch) ?? trip.delayInfo;
  return {
    ...trip,
    delayInfo: delayInfo || trip.delayInfo,
    delayMinutes: patch.delayMinutes ?? patch.totalDelayMinutes ?? trip.delayMinutes,
    totalDelayMinutes: patch.totalDelayMinutes ?? patch.delayMinutes ?? trip.totalDelayMinutes,
    addedDelayMinutes: patch.addedDelayMinutes ?? trip.addedDelayMinutes,
    adjustedDepartureTime: patch.adjustedDepartureTime
      ?? patch.adjustedDeparture
      ?? trip.adjustedDepartureTime,
    adjustedArrivalTime: patch.adjustedArrivalTime
      ?? patch.adjustedArrival
      ?? trip.adjustedArrivalTime,
    tripStatus: patch.tripStatus ?? patch.status ?? trip.tripStatus,
    status: patch.status ?? patch.tripStatus ?? trip.status,
  };
};

/** Cập nhật trip hiện tại từ response start/resume hoặc SignalR. */
export const applyDelayPayloadToTrip = (trip, payload) => {
  if (!trip || !payload) return trip;
  const tripId = String(trip.tripId || trip.id || "").trim();
  const payloadTripId = String(
    payload.tripId || payload.TripId || payload.id || payload.trip?.tripId || "",
  ).trim();
  const source = payload.trip && typeof payload.trip === "object" ? payload.trip : payload;
  if (tripId && payloadTripId && tripId !== payloadTripId) {
    // Có thể là affected trip trong cùng payload root — không merge vào trip hiện tại.
    return trip;
  }
  return patchTripFieldsFromDelay(trip, source);
};

/** Merge affectedTrips vào list (chỉ cập nhật các field delay BE trả). */
export const mergeAffectedTripsIntoList = (trips = [], affectedTrips = []) => {
  if (!Array.isArray(trips) || !trips.length) return trips;
  const list = Array.isArray(affectedTrips) ? affectedTrips : [];
  if (!list.length) return trips;

  const byId = new Map();
  list.forEach((row) => {
    const id = String(row?.tripId || row?.TripId || row?.id || "").trim();
    if (id) byId.set(id, row);
  });
  if (!byId.size) return trips;

  return trips.map((trip) => {
    const id = String(trip?.tripId || trip?.id || "").trim();
    const hit = byId.get(id);
    if (!hit) return trip;
    return patchTripFieldsFromDelay(trip, hit);
  });
};

export const pickAffectedTrips = (payload) => {
  if (!payload || typeof payload !== "object") return [];
  const raw = payload.affectedTrips
    ?? payload.AffectedTrips
    ?? payload.data?.affectedTrips
    ?? payload.data?.AffectedTrips
    ?? [];
  return Array.isArray(raw) ? raw : [];
};
