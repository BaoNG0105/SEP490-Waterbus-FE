/** Phân loại ghế / khách theo bến dừng trên chuyến — hỗ trợ staff tránh khách đi lố bến. */

import {
  pickStopActualArrival,
  pickStopActualDeparture,
  pickStopDisplayArrival,
  pickStopDisplayDeparture,
  pickStopScheduledArrival,
  pickStopScheduledDeparture,
} from "./tripStopTimes";

const norm = (value) => String(value || "").trim().toLowerCase();

/** Chuẩn hoá mã ghế để khớp "1-A1" / "A1" / "1A1".
 * Ghế có prefix tầng ≥2 giữ nguyên tầng — không alias về "A1" kẻo đụng tầng 1.
 * Chỉ tầng 1 mới thêm alias không tầng (dữ liệu cũ / tàu 1 tầng).
 */
export const normalizeSeatKeys = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "—" || raw === "-") return [];
  const keys = new Set([raw, raw.replace(/\s+/g, "")]);
  const compact = raw.replace(/[\s_-]+/g, "");
  keys.add(compact);

  const withDeck = raw.match(/^(\d+)[-_]([A-Z]+)(\d+)$/);
  if (withDeck) {
    const deck = Number(withDeck[1]);
    const row = withDeck[2];
    const num = withDeck[3];
    keys.add(`${deck}-${row}${num}`);
    keys.add(`${deck}${row}${num}`);
    // Alias bỏ tầng chỉ cho tầng 1 — tránh 1-E3 và 2-E3 cùng map vào "E3".
    if (deck === 1) {
      keys.add(`${row}${num}`);
      keys.add(`${row}-${num}`);
    }
    return [...keys].filter(Boolean);
  }

  const plain = raw.match(/^([A-Z]+)(\d+)$/);
  if (plain) {
    keys.add(`${plain[1]}${plain[2]}`);
    keys.add(`${plain[1]}-${plain[2]}`);
  }

  return [...keys].filter(Boolean);
};

/** So khớp ghế có phân tầng: 1-E3 ≠ 2-E3. */
export const seatsReferSame = (a, b) => {
  const left = String(a || "").trim().toUpperCase();
  const right = String(b || "").trim().toUpperCase();
  if (!left || !right || left === "—" || right === "—") return false;

  const parseDeck = (value) => {
    const m = value.match(/^(\d+)[-_]([A-Z]+)(\d+)$/);
    if (!m) return null;
    return { deck: Number(m[1]), row: m[2], num: m[3] };
  };

  const pa = parseDeck(left);
  const pb = parseDeck(right);
  if (pa && pb) {
    return pa.deck === pb.deck && pa.row === pb.row && pa.num === pb.num;
  }

  const ka = normalizeSeatKeys(left);
  const kb = normalizeSeatKeys(right);
  return ka.some((key) => kb.includes(key));
};

export const seatKey = (value) => normalizeSeatKeys(value)[0] || "";

export const rowLetterToIndex = (row) => {
  const letter = String(row || "A").toUpperCase();
  const code = letter.charCodeAt(letter.length - 1) - 64;
  return code > 0 ? code : 1;
};

export const buildDeckLayout = (seats) => {
  const deckMap = new Map();
  (Array.isArray(seats) ? seats : []).forEach((seat) => {
    const deckNumber = Number(seat.deck) || 1;
    if (!deckMap.has(deckNumber)) deckMap.set(deckNumber, []);
    deckMap.get(deckNumber).push(seat);
  });

  return [...deckMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([deckNumber, deckSeats]) => ({
      deckNumber,
      seats: deckSeats,
      rowCount: deckSeats.reduce((max, s) => Math.max(max, rowLetterToIndex(s.row)), 0),
      columnCount: deckSeats.reduce((max, s) => Math.max(max, Number(s.column) || 0), 0),
    }));
};

export const sortTripStops = (stops) => (
  [...(Array.isArray(stops) ? stops : [])].sort(
    (a, b) => Number(a?.stopOrder ?? a?.order ?? 0) - Number(b?.stopOrder ?? b?.order ?? 0),
  )
);

/** Parse giờ bến → ms (ISO hoặc HH:mm theo ngày local). */
const stopMomentMs = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (!Number.isNaN(ms)) return ms;
  const wall = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/) || text.match(/^(\d{1,2}):(\d{2})$/);
  if (!wall) return null;
  const d = new Date();
  d.setHours(Number(wall[1]), Number(wall[2]), 0, 0);
  return d.getTime();
};

const stopMatchesStationHint = (stop, hint) => {
  const raw = norm(hint);
  if (!raw || !stop) return false;
  const token = raw.replace(/^bến\s+/, "").replace(/^ben\s+/, "").trim();
  if (!token) return false;
  return [stop.stationId, stop.stationCode, stop.stationName].some((v) => {
    const s = norm(v);
    if (!s) return false;
    const s2 = s.replace(/^bến\s+/, "").replace(/^ben\s+/, "").trim();
    return s === raw || s === token || s2 === token || s.includes(token) || token.includes(s2);
  });
};

/**
 * Bến “đang ở” cho ops board:
 * 1) actualArrival mà chưa actualDeparture
 * 2) currentStation* từ trip/ops
 * 3) bến cuối có giờ đến/đi đã qua (theo lịch hiển thị)
 */
export const resolveLiveTripStop = (stops = [], trip = null, nowMs = Date.now()) => {
  const list = sortTripStops(stops);
  if (!list.length) return null;

  const atBerth = list.find((stop) => {
    const arrived = pickStopActualArrival(stop);
    const departed = pickStopActualDeparture(stop);
    return Boolean(arrived) && !departed;
  });
  if (atBerth) return atBerth;

  const hints = [
    trip?.currentStationId,
    trip?.currentStationCode,
    trip?.currentStationName,
  ].filter(Boolean);
  for (const hint of hints) {
    const hit = list.find((stop) => stopMatchesStationHint(stop, hint));
    if (hit) return hit;
  }

  let live = list[0];
  for (const stop of list) {
    const t = stopMomentMs(pickStopDisplayArrival(stop) || pickStopDisplayDeparture(stop));
    if (t != null && t <= nowMs) live = stop;
    else break;
  }
  return live;
};

const stationTokens = (stopOrPassenger, role = "both") => {
  const ids = [];
  const codes = [];
  const names = [];

  const push = (id, code, name) => {
    if (id) ids.push(norm(id));
    if (code) codes.push(norm(code));
    if (name && name !== "—") names.push(norm(name));
  };

  if (role === "from" || role === "both") {
    push(
      stopOrPassenger?.fromStationId || stopOrPassenger?.stationId,
      stopOrPassenger?.fromStationCode || stopOrPassenger?.stationCode,
      stopOrPassenger?.fromStationName || stopOrPassenger?.stationName,
    );
  }
  if (role === "to" || role === "both") {
    push(
      stopOrPassenger?.toStationId || (role === "to" ? stopOrPassenger?.stationId : null),
      stopOrPassenger?.toStationCode || (role === "to" ? stopOrPassenger?.stationCode : null),
      stopOrPassenger?.toStationName || (role === "to" ? stopOrPassenger?.stationName : null),
    );
  }
  if (role === "stop") {
    push(stopOrPassenger?.stationId, stopOrPassenger?.stationCode, stopOrPassenger?.stationName);
  }

  return { ids: ids.filter(Boolean), codes: codes.filter(Boolean), names: names.filter(Boolean) };
};

export const stationMatches = (left, right) => {
  if (!left || !right) return false;
  const a = typeof left.ids === "undefined" ? stationTokens(left, "stop") : left;
  const b = typeof right.ids === "undefined" ? stationTokens(right, "stop") : right;
  if (a.ids.some((id) => b.ids.includes(id))) return true;
  if (a.codes.some((code) => b.codes.includes(code))) return true;
  if (a.names.some((name) => b.names.includes(name))) return true;
  return false;
};

const resolvePassengerStopOrders = (passenger, stops) => {
  const sorted = sortTripStops(stops);
  let fromOrder = Number(passenger?.fromStopOrder);
  let toOrder = Number(passenger?.toStopOrder);

  if (!Number.isFinite(fromOrder) || fromOrder <= 0) {
    const fromTokens = {
      ids: [norm(passenger?.fromStationId)].filter(Boolean),
      codes: [norm(passenger?.fromStationCode)].filter(Boolean),
      names: [norm(passenger?.fromStationName)].filter((n) => n && n !== "—"),
    };
    const match = sorted.find((stop) => stationMatches(fromTokens, stop));
    fromOrder = Number(match?.stopOrder) || 0;
  }

  if (!Number.isFinite(toOrder) || toOrder <= 0) {
    const toTokens = {
      ids: [norm(passenger?.toStationId)].filter(Boolean),
      codes: [norm(passenger?.toStationCode)].filter(Boolean),
      names: [norm(passenger?.toStationName)].filter((n) => n && n !== "—"),
    };
    const match = sorted.find((stop) => {
      const order = Number(stop?.stopOrder) || 0;
      if (fromOrder > 0 && order <= fromOrder) return false;
      return stationMatches(toTokens, stop);
    }) || sorted.find((stop) => stationMatches(toTokens, stop));
    toOrder = Number(match?.stopOrder) || 0;
  }

  return { fromOrder, toOrder };
};

export { resolvePassengerStopOrders };

/**
 * Bổ sung giờ dự kiến lên/xuống từ trip.stops khi API passengers không trả scheduled*.
 * Lên = giờ rời bến đi; xuống = giờ tới bến đến.
 */
export const enrichPassengersWithStopTimes = (passengers, stops = []) => {
  const sorted = sortTripStops(stops);
  if (!sorted.length) return Array.isArray(passengers) ? passengers : [];

  return (Array.isArray(passengers) ? passengers : []).map((passenger) => {
    if (!passenger) return passenger;
    const hasDep = Boolean(passenger.scheduledDeparture);
    const hasArr = Boolean(passenger.scheduledArrival);
    if (hasDep && hasArr) return passenger;

    const { fromOrder, toOrder } = resolvePassengerStopOrders(passenger, sorted);
    const fromStop = sorted.find((stop) => Number(stop?.stopOrder) === fromOrder) || null;
    const toStop = sorted.find((stop) => Number(stop?.stopOrder) === toOrder) || null;

    return {
      ...passenger,
      scheduledDeparture: passenger.scheduledDeparture
        || pickStopDisplayDeparture(fromStop)
        || pickStopScheduledDeparture(fromStop)
        || "",
      scheduledArrival: passenger.scheduledArrival
        || pickStopDisplayArrival(toStop)
        || pickStopScheduledArrival(toStop)
        || "",
      fromStopOrder: passenger.fromStopOrder || (fromOrder > 0 ? fromOrder : null),
      toStopOrder: passenger.toStopOrder || (toOrder > 0 ? toOrder : null),
    };
  });
};

/**
 * Phân loại 1 khách tại bến đang chọn:
 * - alighting / boarding / through theo bến
 * - occupied: có ghế trên chuyến nhưng không khớp bến (vẫn phải hiện, không ẩn)
 */
export const classifyPassengerAtStop = (passenger, stop, stops = []) => {
  if (!passenger) return "other";
  if (!stop) return "occupied";

  const currentOrder = Number(stop.stopOrder) || 0;
  const { fromOrder, toOrder } = resolvePassengerStopOrders(passenger, stops);

  const boardsHere = stationMatches(
    {
      ids: [norm(passenger.fromStationId)].filter(Boolean),
      codes: [norm(passenger.fromStationCode)].filter(Boolean),
      names: [norm(passenger.fromStationName)].filter((n) => n && n !== "—"),
    },
    stop,
  ) || (fromOrder > 0 && fromOrder === currentOrder);

  const alightsHere = stationMatches(
    {
      ids: [norm(passenger.toStationId)].filter(Boolean),
      codes: [norm(passenger.toStationCode)].filter(Boolean),
      names: [norm(passenger.toStationName)].filter((n) => n && n !== "—"),
    },
    stop,
  ) || (toOrder > 0 && toOrder === currentOrder);

  if (alightsHere) return "alighting";
  if (boardsHere) return "boarding";
  if (fromOrder > 0 && toOrder > 0 && fromOrder < currentOrder && currentOrder < toOrder) {
    return "through";
  }
  // Chưa tới ga lên / đã qua ga xuống → không gắn vào ghế tại bến này.
  if (fromOrder > 0 && currentOrder < fromOrder) return "other";
  if (toOrder > 0 && currentOrder > toOrder) return "other";
  // Có ghế trên chuyến nhưng không khớp bến → vẫn hiện.
  return "occupied";
};

const emptyGroups = () => ({ alighting: [], boarding: [], through: [], occupied: [] });

/** Key gắn khách↔ghế: tàu nhiều tầng không dùng alias bỏ tầng (tránh 1-E3 đụng 2-E3). */
const occupancyKeysForCode = (value, { multiDeck = false, deckHint = null } = {}) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "—" || raw === "-") return [];

  const withDeck = raw.match(/^(\d+)[-_]([A-Z]+)(\d+)$/);
  if (withDeck) {
    const deck = Number(withDeck[1]);
    const row = withDeck[2];
    const num = withDeck[3];
    const keys = [`${deck}-${row}${num}`, `${deck}${row}${num}`];
    // Tàu 1 tầng / legacy: cho phép "A1" khớp "1-A1".
    if (!multiDeck && deck === 1) {
      keys.push(`${row}${num}`, `${row}-${num}`);
    }
    return keys;
  }

  const plain = raw.match(/^([A-Z]+)(\d+)$/);
  if (plain) {
    const row = plain[1];
    const num = plain[2];
    if (multiDeck) {
      const deck = Number(deckHint);
      if (Number.isFinite(deck) && deck > 0) {
        return [`${deck}-${row}${num}`, `${deck}${row}${num}`];
      }
      // Không biết tầng — không phát tán sang mọi tầng.
      return [];
    }
    return [`${row}${num}`, `${row}-${num}`];
  }

  return normalizeSeatKeys(raw);
};

/** Gắn khách vào từng ghế theo bến đang chọn — ghế đã đặt luôn trả về, không ẩn. */
export const buildSeatOccupancyAtStop = (seats, passengers, stop, stops = []) => {
  const bySeat = new Map();
  const seatList = Array.isArray(seats) ? seats : [];
  const multiDeck = new Set(
    seatList.map((seat) => Number(seat?.deck) || 1),
  ).size > 1;

  const ensureSeat = (keys) => {
    if (!keys.length) return emptyGroups();
    for (const key of keys) {
      if (bySeat.has(key)) return bySeat.get(key);
    }
    const groups = emptyGroups();
    keys.forEach((key) => bySeat.set(key, groups));
    return groups;
  };

  const displaySeatNumber = (seat) => {
    const deck = Number(seat?.deck) || 1;
    const raw = String(seat?.seatNumber || seat?.seatCode || seat?.code || "").trim();
    const withDeck = raw.toUpperCase().match(/^(\d+)[-_]([A-Z]+)(\d+)$/);
    if (withDeck) return `${Number(withDeck[1])}-${withDeck[2]}${withDeck[3]}`;
    const plain = raw.toUpperCase().match(/^([A-Z]+)(\d+)$/);
    if (plain && multiDeck) return `${deck}-${plain[1]}${plain[2]}`;
    return raw || "";
  };

  const seatLookupKeys = (seat) => occupancyKeysForCode(
    seat?.seatNumber || seat?.seatCode || seat?.code || "",
    { multiDeck, deckHint: Number(seat?.deck) || 1 },
  );

  (Array.isArray(passengers) ? passengers : []).forEach((passenger) => {
    if (passenger?.isLapInfant) return; // Em bé đi kèm không chiếm ghế
    const keys = occupancyKeysForCode(passenger?.seatNumber, { multiDeck });
    if (!keys.length) return;
    const role = classifyPassengerAtStop(passenger, stop, stops);
    if (role === "other") return;
    const groups = ensureSeat(keys);
    const bucket = groups[role] ? role : "occupied";
    groups[bucket].push(passenger);
  });

  return seatList.map((seat) => {
    const keys = seatLookupKeys(seat);
    const groups = keys.map((k) => bySeat.get(k)).find(Boolean) || emptyGroups();
    const status = String(seat?.status || "").toLowerCase();
    const seatNumber = displaySeatNumber(seat);

    let role = "empty";
    if (groups.boarding.length) {
      // Có khách lên ghế này cho đoạn sau → ưu tiên màu lên
      role = "boarding";
    } else if (groups.through.length) {
      role = "through";
    } else if (groups.alighting.length) {
      // Khách phải xuống tại bến này → màu amber để staff dễ thấy
      role = "alighting";
    } else if (groups.occupied.length) {
      role = "occupied";
    } else if (status === "booked") {
      role = "occupied";
    } else if (["blocked", "held", "heldbyme"].includes(status)) {
      role = "blocked";
    }

    return {
      ...seat,
      seatNumber,
      occupancyRole: role,
      alighting: groups.alighting,
      boarding: groups.boarding,
      through: groups.through,
      occupiedPassengers: groups.occupied,
    };
  });
};

export const summarizeOccupancy = (occupiedSeats) => {
  const list = Array.isArray(occupiedSeats) ? occupiedSeats : [];
  return {
    alighting: list.filter((s) => s.occupancyRole === "alighting").length,
    boarding: list.filter((s) => s.occupancyRole === "boarding").length,
    through: list.filter((s) => s.occupancyRole === "through").length,
    occupied: list.filter((s) => s.occupancyRole === "occupied").length,
    empty: list.filter((s) => s.occupancyRole === "empty").length,
  };
};

/**
 * Bến dùng để lấy số khách trên Live Tracking (contract BE):
 * Đang chạy → stops[bến vừa rời].segmentPassengerCount
 * Không lấy bến đang tới (vd. Linh Đông) — segment đó thường = 0.
 */
export const resolveStopForOnVesselCount = (stops = [], trip = null, nowMs = Date.now()) => {
  const list = sortTripStops(stops);
  if (!list.length) return { stop: null, underway: false };

  const atBerth = list.find((stop) => {
    const arrived = pickStopActualArrival(stop);
    const departed = pickStopActualDeparture(stop);
    return Boolean(arrived) && !departed;
  });

  let lastDeparted = null;
  let lastDepartedMs = -1;
  list.forEach((stop) => {
    const departed = pickStopActualDeparture(stop);
    const ms = stopMomentMs(departed);
    if (ms == null) return;
    if (ms >= lastDepartedMs) {
      lastDepartedMs = ms;
      lastDeparted = stop;
    }
  });

  const hintCurrent = list.find((stop) => (
    stopMatchesStationHint(stop, trip?.currentStationId)
    || stopMatchesStationHint(stop, trip?.currentStationCode)
    || stopMatchesStationHint(stop, trip?.currentStationName)
  ));
  const hintNext = list.find((stop) => (
    stopMatchesStationHint(stop, trip?.nextStationId)
    || stopMatchesStationHint(stop, trip?.nextStationCode)
    || stopMatchesStationHint(stop, trip?.nextStationName)
  ));

  // Đang cập bến → bến hiện tại.
  if (atBerth) return { stop: atBerth, underway: false };

  // Đang chạy tới bến kế (ops nextStation): lấy bến liền trước = đoạn đang đi.
  if (hintNext) {
    const prevByOrder = list.find(
      (s) => Number(s?.stopOrder) === Number(hintNext.stopOrder) - 1,
    );
    if (prevByOrder) return { stop: prevByOrder, underway: true };
  }

  // Có actualDeparture → bến vừa rời.
  if (lastDeparted) return { stop: lastDeparted, underway: true };

  if (hintCurrent && pickStopActualDeparture(hintCurrent)) {
    return { stop: hintCurrent, underway: true };
  }

  // currentStation đã departed / trùng next → coi như đang chạy, lùi 1 bến.
  if (hintCurrent && hintNext && hintCurrent === hintNext) {
    const prev = list.find((s) => Number(s?.stopOrder) === Number(hintCurrent.stopOrder) - 1);
    if (prev) return { stop: prev, underway: true };
  }

  if (hintCurrent && !pickStopActualDeparture(hintCurrent)) {
    return { stop: hintCurrent, underway: false };
  }

  const live = resolveLiveTripStop(list, trip, nowMs);
  if (live && hintNext && live === hintNext) {
    const prev = list.find((s) => Number(s?.stopOrder) === Number(live.stopOrder) - 1);
    if (prev) return { stop: prev, underway: true };
  }
  return { stop: live, underway: Boolean(lastDeparted || hintNext) };
};

/**
 * Contract BE: stop.segmentPassengerCount = số khách đi qua đoạn từ bến này tới bến kế.
 */
export const pickSegmentPassengerCount = (stop, stops = []) => {
  if (!stop || typeof stop !== "object") return null;
  const segment = Number(stop.segmentPassengerCount ?? stop.SegmentPassengerCount);
  if (Number.isFinite(segment) && segment >= 0) return Math.trunc(segment);

  const onboard = Number(stop.onboardPassengerCount ?? stop.OnboardPassengerCount);
  if (Number.isFinite(onboard) && onboard >= 0) return Math.trunc(onboard);

  const order = Number(stop.stopOrder) || 0;
  if (order > 1 && Array.isArray(stops) && stops.length) {
    const prev = sortTripStops(stops).find((s) => Number(s?.stopOrder) === order - 1);
    if (prev) {
      const prevSeg = Number(prev.segmentPassengerCount ?? prev.SegmentPassengerCount);
      if (Number.isFinite(prevSeg) && prevSeg >= 0) return Math.trunc(prevSeg);
      const prevOn = Number(prev.onboardPassengerCount ?? prev.OnboardPassengerCount);
      if (Number.isFinite(prevOn) && prevOn >= 0) return Math.trunc(prevOn);
    }
  }
  return null;
};

/** Số khách gắn card GPS: ưu tiên segment bến vừa rời; khi cập bến đích cộng khách xuống. */
export const resolveLiveMapPassengerCount = (stops = [], trip = null, options = {}) => {
  const list = sortTripStops(stops);
  const resolved = resolveStopForOnVesselCount(list, trip, options.nowMs || Date.now());
  const stop = resolved.stop;
  if (!stop) return { count: null, stop: null, underway: false, boarding: 0, through: 0, alighting: 0 };

  let count = pickSegmentPassengerCount(stop, list);
  const boarding = Math.max(0, Math.trunc(Number(stop.boardingPassengerCount) || 0));
  const alighting = Math.max(0, Math.trunc(Number(stop.alightingPassengerCount) || 0));
  const onboardAfter = Math.max(0, Math.trunc(Number(stop.onboardPassengerCount) || 0));

  // Đang cập / bến đích: segment sau khi rời = 0 nhưng còn khách xuống → vẫn hiện trên tàu.
  if (!resolved.underway && (count == null || count === 0) && alighting > 0) {
    count = onboardAfter + alighting;
  }

  const through = Math.max(0, onboardAfter - boarding);
  return {
    count: count != null ? count : null,
    stop,
    underway: resolved.underway,
    boarding,
    through,
    alighting,
  };
};

/**
 * Số khách còn trên tàu tại 1 bến — khớp KPI sơ đồ ghế:
 * chỉ Đi tiếp + Lên (không Xuống, không “occupied” mơ hồ).
 * - Đang ở bến: boarding + through
 * - Đã rời bến: fromOrder ≤ bến vừa rời < toOrder
 */
export const countOnVesselAtStop = (passengers = [], stop = null, stops = [], options = {}) => {
  const list = Array.isArray(passengers) ? passengers.filter(Boolean) : [];
  const holders = list.filter((row) => !row.isLapInfant);
  const infants = list.filter((row) => row.isLapInfant);
  const underway = options.underway === true;
  const order = Number(stop?.stopOrder) || 0;

  let boarding = 0;
  let through = 0;
  let alighting = 0;
  const kept = [];

  holders.forEach((person) => {
    if (underway && order > 0) {
      const { fromOrder, toOrder } = resolvePassengerStopOrders(person, stops);
      // Chỉ đếm khi đủ chặng — tránh cộng khách “occupied” / thiếu dữ liệu.
      if (fromOrder > 0 && toOrder > 0 && fromOrder <= order && toOrder > order) {
        through += 1;
        kept.push({ person, bucket: "through" });
      }
      return;
    }

    if (!stop) return;
    const role = classifyPassengerAtStop(person, stop, stops);
    if (role === "alighting") {
      alighting += 1;
      return;
    }
    if (role === "boarding") {
      boarding += 1;
      kept.push({ person, bucket: "boarding" });
      return;
    }
    // Không lấy "occupied" — KPI ghế cũng không tính nhóm này vào Đi tiếp/Lên.
    if (role === "through") {
      through += 1;
      kept.push({ person, bucket: "through" });
    }
  });

  const usedInfantKeys = new Set();
  const infantMatchesHolder = (infant, holder) => {
    const companionId = String(infant.companionPassengerId || "").trim().toLowerCase();
    const holderId = String(holder.passengerId || "").trim().toLowerCase();
    if (companionId && holderId) return companionId === holderId;

    const sameBooking = String(infant.bookingCode || "").trim().toUpperCase()
      && String(infant.bookingCode || "").trim().toUpperCase()
        === String(holder.bookingCode || "").trim().toUpperCase();
    if (!sameBooking) return false;

    const companionTicket = String(infant.companionTicketCode || "").trim().toUpperCase();
    const holderTicket = String(holder.ticketCode || "").trim().toUpperCase();
    if (companionTicket && holderTicket) return companionTicket === holderTicket;

    const companionName = String(infant.companionPassengerName || "").trim().toLowerCase();
    const holderName = String(holder.passengerName || "").trim().toLowerCase();
    if (companionName && holderName) return companionName === holderName;

    return false;
  };

  kept.forEach(({ person, bucket }) => {
    const match = infants.find((infant) => {
      const key = `${infant.passengerId || infant.passengerName}|${infant.bookingCode || ""}`;
      if (usedInfantKeys.has(key)) return false;
      return infantMatchesHolder(infant, person);
    });
    if (!match) return;
    usedInfantKeys.add(`${match.passengerId || match.passengerName}|${match.bookingCode || ""}`);
    if (bucket === "boarding") boarding += 1;
    else through += 1;
  });

  return {
    boarding,
    through,
    alighting,
    /** Live map theo tàu: Đi tiếp + Lên (+ em bé cùng ghế của họ) */
    onVessel: boarding + through,
  };
};

export const SEAT_ROLE_STYLES = {
  alighting: {
    cell: "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/25 dark:text-amber-100",
    labelVn: "Xuống bến",
    labelEn: "Alighting",
  },
  boarding: {
    cell: "border-emerald-400 bg-emerald-100 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/25 dark:text-emerald-100",
    labelVn: "Lên bến",
    labelEn: "Boarding",
  },
  through: {
    cell: "border-sky-400 bg-sky-100 text-sky-900 dark:border-sky-400/60 dark:bg-sky-500/25 dark:text-sky-100",
    labelVn: "Đi tiếp",
    labelEn: "Through",
  },
  occupied: {
    cell: "border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200",
    labelVn: "Đang ngồi",
    labelEn: "Occupied",
  },
  blocked: {
    cell: "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500",
    labelVn: "Khóa",
    labelEn: "Blocked",
  },
  empty: {
    cell: "border-slate-200 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400",
    labelVn: "Trống",
    labelEn: "Empty",
  },
};
