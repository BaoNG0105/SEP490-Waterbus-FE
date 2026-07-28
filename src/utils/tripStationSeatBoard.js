/** Phân loại ghế / khách theo bến dừng trên chuyến — hỗ trợ staff tránh khách đi lố bến. */

const norm = (value) => String(value || "").trim().toLowerCase();

/** Chuẩn hoá mã ghế để khớp "1-A1" / "A1" / "1A1". */
export const normalizeSeatKeys = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw || raw === "—" || raw === "-") return [];
  const keys = new Set([raw, raw.replace(/\s+/g, "")]);
  const compact = raw.replace(/[\s_-]+/g, "");
  keys.add(compact);

  const withDeck = raw.match(/^(\d+)[-_]([A-Z]+)(\d+)$/);
  if (withDeck) {
    keys.add(`${withDeck[1]}-${withDeck[2]}${withDeck[3]}`);
    keys.add(`${withDeck[2]}${withDeck[3]}`);
    keys.add(`${withDeck[2]}-${withDeck[3]}`);
  }

  const plain = raw.match(/^([A-Z]+)(\d+)$/);
  if (plain) {
    keys.add(`${plain[1]}${plain[2]}`);
    keys.add(`${plain[1]}-${plain[2]}`);
  }

  return [...keys].filter(Boolean);
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
  // Có ghế trên chuyến → vẫn hiện (không bỏ / ẩn thành trống).
  return "occupied";
};

const emptyGroups = () => ({ alighting: [], boarding: [], through: [], occupied: [] });

/** Gắn khách vào từng ghế theo bến đang chọn — ghế đã đặt luôn trả về, không ẩn. */
export const buildSeatOccupancyAtStop = (seats, passengers, stop, stops = []) => {
  const bySeat = new Map();

  const ensureSeat = (keys) => {
    for (const key of keys) {
      if (bySeat.has(key)) return bySeat.get(key);
    }
    const groups = emptyGroups();
    keys.forEach((key) => bySeat.set(key, groups));
    return groups;
  };

  (Array.isArray(passengers) ? passengers : []).forEach((passenger) => {
    const keys = normalizeSeatKeys(passenger?.seatNumber);
    if (!keys.length) return;
    const role = classifyPassengerAtStop(passenger, stop, stops);
    if (role === "other") return;
    const groups = ensureSeat(keys);
    const bucket = groups[role] ? role : "occupied";
    groups[bucket].push(passenger);
  });

  return (Array.isArray(seats) ? seats : []).map((seat) => {
    const keys = normalizeSeatKeys(seat?.seatNumber || seat?.seatCode || seat?.code);
    const groups = keys.map((k) => bySeat.get(k)).find(Boolean) || emptyGroups();
    const status = String(seat?.status || "").toLowerCase();

    let role = "empty";
    if (groups.alighting.length) role = "alighting";
    else if (groups.boarding.length) role = "boarding";
    else if (groups.through.length) role = "through";
    else if (groups.occupied.length) role = "occupied";
    else if (status === "booked") role = "occupied";
    else if (["blocked", "held", "heldbyme"].includes(status)) role = "blocked";

    return {
      ...seat,
      seatNumber: seat?.seatNumber || seat?.seatCode || keys[0] || "",
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
