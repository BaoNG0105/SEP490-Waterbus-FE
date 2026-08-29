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
      startStopOrder: source.startStopOrder
        ?? source.StartStopOrder
        ?? source.delayStartStopOrder
        ?? source.DelayStartStopOrder
        ?? null,
      delayStartStopOrder: source.delayStartStopOrder
        ?? source.DelayStartStopOrder
        ?? source.startStopOrder
        ?? source.StartStopOrder
        ?? null,
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

/** Số phút delay do BE tính và trả về; FE không tự cộng/cascade delay. */
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
  if (Number.isFinite(n) && n > 0) return n;
  return 0;
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
  return stops.some((stop) => Boolean(
    stop?.actualDeparture
    || stop?.actualDepartureAt
    || stop?.ActualDepartureAt
    || stop?.actualDepartureTime
    || stop?.ActualDepartureTime
  ));
};

/** Tàu đang dừng tại một bến: đã đến nhưng chưa có giờ rời bến. */
export const isTripStoppedAtStation = (trip) => {
  const stops = Array.isArray(trip?.stops) ? trip.stops : [];
  return stops.some((stop) => {
    const arrived = Boolean(stop?.actualArrival || stop?.actualArrivalAt || stop?.ActualArrivalAt || stop?.actualArrivalTime || stop?.ActualArrivalTime);
    const departed = Boolean(stop?.actualDeparture || stop?.actualDepartureAt || stop?.ActualDepartureAt || stop?.actualDepartureTime || stop?.ActualDepartureTime);
    return arrived && !departed;
  });
};

/** @deprecated dùng hasTripLeftAStop */
export const hasTripActuallyStarted = (trip) => hasTripLeftAStop(trip);

/**
 * Delay chỉ bắt đầu khi tàu chưa rời bến hoặc đang dừng tại bến.
 * Không cho bắt đầu khi tàu đang di chuyển giữa hai bến.
 */
export const getTripDelayTooEarlyMessage = (trip, lang = "VN") => {
  if (!trip) {
    return lang === "VN" ? "Không có thông tin chuyến." : "Trip information is missing.";
  }
  // Sau khi đã rời bến, chỉ mở Delay khi đã vào một bến và chưa rời bến đó.
  if (hasTripLeftAStop(trip)) {
    if (isTripStoppedAtStation(trip)) return "";
    return lang === "VN"
      ? "Tàu đang di chuyển giữa các bến. Chỉ có thể Delay khi tàu đang dừng tại bến."
      : "The boat is moving between stations. Delay is available only while stopped at a station.";
  }

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
    ? `Chuyến chưa tới giờ xuất phát . Không thể Delay trước giờ chạy.`
    : `Trip has not reached departure time. Cannot delay before departure.`;
};

/** Có thể bấm Delay: chưa rời bến hoặc đang dừng tại bến, không đang delay. */
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
    const arrived = Boolean(stop?.actualArrival || stop?.actualArrivalAt);
    const departed = Boolean(stop?.actualDeparture || stop?.actualDepartureAt);
    if (arrived && !departed) {
      return Number(stop.stopOrder) || i + 1;
    }
    if (isLast && arrived) {
      return Number(stop.stopOrder) || i + 1;
    }
  }

  for (let i = 0; i < list.length; i += 1) {
    const stop = list[i];
    const isLast = i === list.length - 1;
    const arrived = Boolean(stop?.actualArrival || stop?.actualArrivalAt);
    const departed = Boolean(stop?.actualDeparture || stop?.actualDepartureAt);
    if (isLast) {
      if (!arrived) return Number(stop.stopOrder) || i + 1;
    } else if (!departed) {
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
 * Text UI khi đang delay.
 * Bến: stationName → resolve từ delayStartStopOrder / startStopOrder.
 * Phút: BE delayMinutes, fallback đếm từ delayStartedAt.
 */
export const formatActiveDelayLine = (delayInfo, { lang = "VN", stops = [], compact = false } = {}) => {
  if (!isDelayActive(delayInfo)) return "";
  const info = pickDelayInfo(delayInfo) || delayInfo;
  const stopOrder = info?.delayStartStopOrder
    ?? info?.DelayStartStopOrder
    ?? info?.startStopOrder
    ?? info?.StartStopOrder;
  const station = String(
    info?.stationName
    || info?.StationName
    || pickStationNameForStopOrder(stops, stopOrder)
    || "",
  ).trim();
  const reason = String(info?.reason || info?.delayReason || "").trim();
  const mins = pickDelayMinutes(delayInfo);

  // Bản gọn cho list/bảng: "Delay • Bến X (12p)" thay vì câu đầy đủ.
  if (compact) {
    if (lang === "VN") {
      const where = station || reason || "Đang dừng";
      return mins > 0 ? `Delay • ${where} (${mins}p)` : `Delay • ${where}`;
    }
    const where = station || reason || "Stopped";
    return mins > 0 ? `Delay • ${where} (${mins}m)` : `Delay • ${where}`;
  }

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
