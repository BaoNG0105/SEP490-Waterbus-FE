import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { WaterwayMap } from "../../../components/WaterwayMap";
import {
  fetchTripDetail,
  getTripStatusLabel,
  normalizeTripStatusKey,
  resumeTripDelay,
  startTripDelay,
} from "../../../services/tripService";
import { trackingHub } from "../../../services/trackingHubClient";
import { fetchLatestTripTracking } from "../../../services/trackingService";
import { fetchBoatDetail } from "../../../services/boatService";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import { fetchAllStations } from "../../../services/stationService";
import { fetchWaterwayDetail } from "../../../services/waterwayService";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TYPE,
  fetchStaffAssignments,
  isAssignmentInactive,
} from "../../../services/staffAssignmentService";
import { DEFAULT_BOAT_IMAGE, getBoatImageUrl } from "../../../utils/charterBookingAdmin";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDwellCountdownNotice, isDwellAtTerminalStop } from "../../../utils/boatTracking";
import { geometryToCoordinates as parseRouteGeometry } from "../../../utils/charterRouteMap";
import { assignmentCoversDay, toDateKey } from "../../../utils/staffAssignmentCalendarUtils";
import { notify, showToast } from "../../../utils/swalToast";
import {
  applyDelayPayloadToTrip,
  canResumeTripDelay,
  canStartTripDelay,
  formatActiveDelayLine,
  formatAffectedTripLine,
  formatPostResumeDelayLine,
  isDelayActive,
  pickAffectedTrips,
  pickDelayInfo,
  pickDelayMinutes,
  pickDisplayArrival,
  pickDisplayDeparture,
  pickStationNameForStopOrder,
  resolveDelayStartStopOrder,
} from "../../../utils/tripDelay";

const formatTime = (value) => {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const formatOperatingDate = (value, lang) => {
  if (value == null || value === "") return "";
  // dd/MM/yyyy or dd-MM-yyyy
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(String(value).trim())) {
    return String(value).trim().replaceAll("-", "/");
  }
  // yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) {
    const [y, m, d] = String(value).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB");
};

const pickStaffName = (staff) => {
  if (!staff || typeof staff !== "object") return "—";
  return staff.fullName
    || staff.name
    || staff.staffName
    || staff.staffFullName
    || staff.displayName
    || staff.user?.fullName
    || staff.user?.name
    || staff.userName
    || staff.email
    || "—";
};

const normalizeStaffList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return [value];
  return [];
};

/** operatingDate trip → yyyy-MM-dd để lọc ca OnBoard theo tàu. */
const toOperatingDayKey = (trip) => {
  const raw = trip?.operatingDate || trip?.OperatingDate || trip?.operationDate || "";
  if (!raw) {
    if (trip?.departureTime) return toDateKey(new Date(trip.departureTime));
    return "";
  }
  const text = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  }
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return toDateKey(d);
  return "";
};

const stationLabel = (station) => {
  if (!station) return "";
  if (typeof station === "string") {
    // Không hiện UUID thuần
    if (/^[0-9a-f-]{36}$/i.test(station.trim())) return "";
    return station.trim();
  }
  const name = station.stationName || station.name || station.StationName || "";
  const code = station.stationCode || station.code || station.StationCode || "";
  if (name && !/^[0-9a-f-]{36}$/i.test(String(name).trim())) return name;
  return code || "";
};

const toCount = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatCount = (value) => {
  const n = toCount(value);
  return n == null ? "—" : String(n);
};

/** Chênh lệch phút theo đúng giờ đang hiển thị (HH:mm local).
 * Tránh lệch giây / timezone khiến cùng "21:25" mà báo trễ 1p. */
const diffMinutes = (scheduled, actual) => {
  if (!scheduled || !actual) return null;
  const parts = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return { h: date.getHours(), m: date.getMinutes(), day: date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate() };
  };
  const a = parts(actual);
  const b = parts(scheduled);
  if (!a || !b) return null;
  return (a.day * 24 * 60 + a.h * 60 + a.m) - (b.day * 24 * 60 + b.h * 60 + b.m);
};

const formatDelayLabel = (minutes, lang) => {
  if (!Number.isFinite(minutes) || minutes === 0) return null;
  const abs = Math.abs(minutes);
  if (lang === "VN") return minutes > 0 ? `Trễ ${abs}p` : `Sớm ${abs}p`;
  return minutes > 0 ? `Late ${abs}m` : `Early ${abs}m`;
};

const delayToneClass = (minutes) => {
  if (!Number.isFinite(minutes) || minutes === 0) return "";
  if (minutes > 0) {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
};

/** Trạng thái vận hành tại bến: đang lên tàu / đang dừng / đã rời. */
const resolveStopOpsBadge = (stop, { isFirst, isLast, tripStatusKey, lang }) => {
  const hasArr = Boolean(stop?.actualArrival);
  const hasDep = Boolean(stop?.actualDeparture);

  if (isLast) {
    if (hasArr || tripStatusKey === "Completed") {
      return {
        text: lang === "VN" ? "Đã tới đích" : "At destination",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
      };
    }
    return null;
  }

  if (isFirst) {
    if (hasDep) {
      return {
        text: lang === "VN" ? "Đã rời bến" : "Departed",
        className: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400",
      };
    }
    if (tripStatusKey === "Boarding" || tripStatusKey === "InProgress" || tripStatusKey === "Delayed") {
      return {
        text: lang === "VN" ? "Đang lên tàu" : "Boarding",
        className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
      };
    }
    return null;
  }

  if (hasDep) {
    return {
      text: lang === "VN" ? "Đã rời bến" : "Departed",
      className: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400",
    };
  }
  if (hasArr) {
    return {
      text: lang === "VN" ? "Đang lên tàu" : "Boarding at stop",
      className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    };
  }
  return null;
};

const statusBadgeClass = (status) => {
  switch (normalizeTripStatusKey(status)) {
    case "Scheduled":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300";
    case "Boarding":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300";
    case "InProgress":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300";
    case "Delayed":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300";
    case "Completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300";
  }
};

const sortStops = (stops) =>
  [...(Array.isArray(stops) ? stops : [])].sort(
    (a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0),
  );

const resolvePassengerCount = (trip, stops) => {
  const direct = toCount(trip?.uniquePassengerCount)
    ?? toCount(trip?.totalPassengerCount)
    ?? toCount(trip?.onboardPassengerCount)
    ?? toCount(trip?.passengerCount)
    ?? toCount(trip?.boardingPassengerCount);
  if (direct != null) return direct;

  // Lấy onboardPassengerCount mới nhất có số từ stops (đi từ cuối lên).
  for (let i = stops.length - 1; i >= 0; i -= 1) {
    const n = toCount(stops[i]?.onboardPassengerCount);
    if (n != null) return n;
  }

  // Fallback: tổng hành khách lên tàu (boarding) nếu BE chỉ gửi boarding.
  const boarded = stops.reduce((sum, s) => sum + (toCount(s?.boardingPassengerCount) || 0), 0);
  return boarded > 0 ? boarded : 0;
};

const resolveOperatingDate = (trip, lang) => {
  const raw = trip?.operatingDate || trip?.OperatingDate || trip?.operationDate || "";
  if (raw) return formatOperatingDate(raw, lang);
  if (trip?.departureTime) return formatOperatingDate(trip.departureTime, lang);
  // TR-20260722-... → 22/07/2026
  const m = String(trip?.tripCode || "").match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return "—";
};

const resolveHeroImage = (trip, boatCatalog) => {
  const candidates = [
    trip?.boatImageUrl,
    trip?.boat?.imageUrl,
    Array.isArray(trip?.boat?.imageUrls) ? trip.boat.imageUrls[0] : "",
    boatCatalog?.imageUrl,
    Array.isArray(boatCatalog?.imageUrls) ? boatCatalog.imageUrls[0] : "",
    trip?.fromStation?.imageUrl,
    trip?.fromStation?.stationImageUrl,
    sortStops(trip?.stops)[0]?.stationImageUrl,
  ].filter(Boolean);
  const first = candidates.find((url) => {
    const s = String(url).trim();
    return s && !/image\s*not\s*available/i.test(s);
  });
  if (first) return first;
  return getBoatImageUrl(boatCatalog || trip?.boat, DEFAULT_BOAT_IMAGE);
};

const resolveBoat = (trip, boatCatalog) => {
  const boat = { ...(trip?.boat || {}), ...(boatCatalog || {}) };
  return {
    id: boat.boatId || boat.vesselId || boat.id || trip?.boatId || "",
    code: boat.boatCode || boat.vesselCode || boat.code || trip?.boatCode || "",
    name: boat.boatName || boat.vesselName || boat.name || trip?.boatName || "",
    registrationNumber: boat.registrationNumber || boat.registrationNo || boat.plateNumber || "",
    serviceType: boat.serviceType || boat.ServiceType || "",
    numberOfDecks: toCount(boat.numberOfDecks ?? boat.NumberOfDecks),
    maxSpeedKmh: toCount(boat.maxSpeedKmh ?? boat.maxSpeed ?? boat.MaxSpeedKmh),
    capacity: toCount(boat.capacity ?? boat.seatCount ?? trip?.capacitySnapshot),
    status: boat.status || "",
    imageUrl: resolveHeroImage(trip, boatCatalog),
  };
};

const ScheduleDelayBadge = ({ delayMin, delayLabel }) => (
  delayLabel ? (
    <span className={`mt-1 inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${delayToneClass(delayMin)}`}>
      {delayLabel}
    </span>
  ) : null
);

/** Grid cố định: nhãn | Đến | Đi — mọi bến cùng khung để thẳng hàng.
 * Bến đầu: cột Đến = — · Bến cuối: cột Đi = — (không ẩn cột). */
const ScheduleCompare = ({
  scheduledArr,
  scheduledDep,
  actualArr,
  actualDep,
  lang,
  isFirst = false,
  isLast = false,
}) => {
  const arriveDelayMin = !isFirst ? diffMinutes(scheduledArr, actualArr) : null;
  const departDelayMin = !isLast ? diffMinutes(scheduledDep, actualDep) : null;
  const arriveDelayLabel = formatDelayLabel(arriveDelayMin, lang);
  const departDelayLabel = formatDelayLabel(departDelayMin, lang);

  const actualClass = (delayMin) => {
    if (delayMin > 0) return "text-orange-700 dark:text-orange-300";
    if (delayMin < 0) return "text-emerald-700 dark:text-emerald-300";
    return "text-slate-800 dark:text-slate-100";
  };

  const timeText = (time) => formatTime(time);

  const gridClass = "grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2";

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className={`${gridClass} bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-900/70`}>
        <span />
        <span className="text-center">{lang === "VN" ? "Đến" : "Arrive"}</span>
        <span className="text-center">{lang === "VN" ? "Đi" : "Depart"}</span>
      </div>

      <div className={`${gridClass} border-t border-slate-100 px-3 py-2.5 dark:border-slate-700/60`}>
        <span className="pt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Kế hoạch" : "Planned"}
        </span>
        <span className="text-center text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
          {timeText(isFirst ? null : scheduledArr)}
        </span>
        <span className="text-center text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
          {timeText(isLast ? null : scheduledDep)}
        </span>
      </div>

      <div className={`${gridClass} border-t border-slate-100 px-3 py-2.5 dark:border-slate-700/60`}>
        <span className="pt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Thực tế" : "Actual"}
        </span>
        <div className="flex min-h-[2.5rem] flex-col items-center text-center">
          <span className={`text-sm font-black tabular-nums ${actualClass(arriveDelayMin)}`}>
            {timeText(isFirst ? null : actualArr)}
          </span>
          <ScheduleDelayBadge delayMin={arriveDelayMin} delayLabel={arriveDelayLabel} />
        </div>
        <div className="flex min-h-[2.5rem] flex-col items-center text-center">
          <span className={`text-sm font-black tabular-nums ${actualClass(departDelayMin)}`}>
            {timeText(isLast ? null : actualDep)}
          </span>
          <ScheduleDelayBadge delayMin={departDelayMin} delayLabel={departDelayLabel} />
        </div>
      </div>
    </div>
  );
};

const MetaCell = ({ label, children }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
    <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">{children}</div>
  </div>
);

const isValidCoord = (lat, lng) => (
  Number.isFinite(Number(lat))
  && Number.isFinite(Number(lng))
  && Math.abs(Number(lat)) <= 90
  && Math.abs(Number(lng)) <= 180
);

/** GeoJSON / LineString / [[lng,lat],…] → { latitude, longitude }[] */
const geometryToCoordinates = (geometry) => parseRouteGeometry(geometry);

const readStationCoords = (source) => {
  if (!source || typeof source !== "object") return null;
  const lat = source.latitude ?? source.lat ?? source.Latitude
    ?? source.station?.latitude ?? source.station?.lat;
  const lng = source.longitude ?? source.lng ?? source.Longitude
    ?? source.station?.longitude ?? source.station?.lng;
  if (!isValidCoord(lat, lng)) return null;
  return { latitude: Number(lat), longitude: Number(lng) };
};

const TRACKING_POLL_MS = 15000;
const ACTIVE_TRACK_STATUSES = new Set(["Boarding", "InProgress", "Delayed"]);

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
};

const polylineLengthKm = (points = []) => {
  let sum = 0;
  for (let i = 1; i < points.length; i += 1) {
    sum += haversineKm(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude,
    );
  }
  return sum;
};

/** Điểm trên polyline theo tỉ lệ 0→1 (theo khoảng cách). */
const pointAtProgress = (points = [], progress = 0) => {
  if (!points.length) return null;
  if (points.length === 1) return { ...points[0], progress: 0 };
  const t = Math.min(1, Math.max(0, progress));
  const total = polylineLengthKm(points) || 1;
  let remain = total * t;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) || 0.0001;
    if (remain <= seg) {
      const r = remain / seg;
      return {
        latitude: a.latitude + (b.latitude - a.latitude) * r,
        longitude: a.longitude + (b.longitude - a.longitude) * r,
        progress: t,
      };
    }
    remain -= seg;
  }
  return { ...points[points.length - 1], progress: 1 };
};

/** Tỉ lệ dọc polyline gần nhất với GPS. */
const progressNearGps = (points = [], lat, lng) => {
  if (!points.length || !isValidCoord(lat, lng)) return null;
  const total = polylineLengthKm(points);
  if (!(total > 0)) return 0;
  let best = { dist: Infinity, along: 0 };
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) || 0.0001;
    // sample 8 điểm trên đoạn
    for (let s = 0; s <= 8; s += 1) {
      const r = s / 8;
      const plat = a.latitude + (b.latitude - a.latitude) * r;
      const plng = a.longitude + (b.longitude - a.longitude) * r;
      const d = haversineKm(lat, lng, plat, plng);
      if (d < best.dist) best = { dist: d, along: walked + seg * r };
    }
    walked += seg;
  }
  return Math.min(1, Math.max(0, best.along / total));
};

/** Tiến độ 0→1 dọc các bến (ưu tiên sự kiện stop, rồi GPS gần bến). */
const resolveRouteProgress = (stops = [], liveLocation = null, statusKey = "", routeLine = []) => {
  if (liveLocation && routeLine.length >= 2) {
    const gpsP = progressNearGps(routeLine, liveLocation.latitude, liveLocation.longitude);
    if (gpsP != null) return gpsP;
  }

  const n = stops.length;
  if (n <= 1) {
    if (statusKey === "Completed") return 1;
    if (statusKey === "InProgress" || statusKey === "Delayed" || statusKey === "Boarding") return 0.15;
    return 0;
  }

  let reached = 0;
  for (let i = 0; i < n; i += 1) {
    const stop = stops[i];
    const isLast = i === n - 1;
    const done = isLast
      ? Boolean(stop.actualArrival)
      : Boolean(stop.actualDeparture || (i > 0 && stop.actualArrival));
    if (done) reached = i + (isLast ? 1 : 0);
    else break;
  }

  let base = Math.min(1, Math.max(0, reached / (n - 1)));

  if (liveLocation && isValidCoord(liveLocation.latitude, liveLocation.longitude)) {
    const coords = stops.map((s) => readStationCoords(s) || readStationCoords(s.station)).filter(Boolean);
    if (coords.length >= 2) {
      let bestIdx = 0;
      let bestDist = Infinity;
      coords.forEach((c, i) => {
        const d = haversineKm(liveLocation.latitude, liveLocation.longitude, c.latitude, c.longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      let gpsProgress = bestIdx / (coords.length - 1);
      const remKm = Number(liveLocation.remainingDistanceKmToNextStation);
      if (Number.isFinite(remKm) && remKm >= 0 && bestIdx < coords.length - 1) {
        const a = coords[bestIdx];
        const b = coords[bestIdx + 1];
        const seg = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) || 1;
        const along = Math.min(1, Math.max(0, 1 - remKm / seg));
        gpsProgress = (bestIdx + along) / (coords.length - 1);
      }
      base = Math.max(base, Math.min(1, gpsProgress));
    } else if (statusKey === "InProgress" || statusKey === "Delayed") {
      base = Math.max(base, 0.35);
    }
  } else if (statusKey === "Completed") {
    base = 1;
  } else if (statusKey === "Boarding") {
    base = Math.max(base, 0.02);
  } else if (statusKey === "InProgress" || statusKey === "Delayed") {
    base = Math.max(base, 0.2);
  }

  return Math.min(1, Math.max(0, base));
};

/** Giảm mật độ điểm để đường vẽ mượt. */
const simplifyLine = (points = [], maxPoints = 160) => {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  if (!prev || prev.latitude !== last.latitude || prev.longitude !== last.longitude) {
    out.push(last);
  }
  return out;
};

const shortStationName = (name) => String(name || "").replace(/^Bến\s+/i, "").trim();

/**
 * GPS chuyến = cùng WaterwayMap như Live (icon tàu hull, cờ bến, tuyến teal),
 * thêm đoạn đã đi vàng + nhãn tuyến + bám tàu.
 */
const TripRealRouteMap = ({
  routeLine = [],
  stations = [],
  progress = 0,
  liveLocation = null,
  boat = null,
  routeLabel = "",
  routeCode = "",
  isMoving = false,
  lang = "VN",
}) => {
  const pathPoints = useMemo(() => {
    // Luôn ưu tiên routeLine (GPS đã vẽ). Chỉ nối bến khi chưa có geometry.
    const raw = routeLine.length >= 2
      ? routeLine
      : stations
        .filter((s) => isValidCoord(s.latitude, s.longitude))
        .map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
    // Giữ mật độ cao để không “làm thẳng” đường GPS đã vẽ.
    return simplifyLine(raw, 1200);
  }, [routeLine, stations]);

  const snappedBoat = useMemo(() => {
    if (liveLocation && isValidCoord(liveLocation.latitude, liveLocation.longitude) && pathPoints.length >= 2) {
      const p = progressNearGps(pathPoints, liveLocation.latitude, liveLocation.longitude);
      return pointAtProgress(pathPoints, p ?? progress);
    }
    return pointAtProgress(pathPoints, progress);
  }, [liveLocation, pathPoints, progress]);

  const boatLatLng = useMemo(() => {
    if (liveLocation && isValidCoord(liveLocation.latitude, liveLocation.longitude)) {
      return { latitude: Number(liveLocation.latitude), longitude: Number(liveLocation.longitude) };
    }
    if (snappedBoat && isValidCoord(snappedBoat.latitude, snappedBoat.longitude)) {
      return { latitude: snappedBoat.latitude, longitude: snappedBoat.longitude };
    }
    return null;
  }, [liveLocation, snappedBoat]);

  const traveledPoints = useMemo(() => {
    if (!pathPoints.length) return [];
    const t = Math.min(1, Math.max(0, progress));
    if (t <= 0) return pathPoints.slice(0, 1);
    const total = polylineLengthKm(pathPoints) || 1;
    const target = total * t;
    const out = [pathPoints[0]];
    let walked = 0;
    for (let i = 1; i < pathPoints.length; i += 1) {
      const a = pathPoints[i - 1];
      const b = pathPoints[i];
      const seg = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) || 0.0001;
      if (walked + seg >= target) {
        const r = (target - walked) / seg;
        out.push({
          latitude: a.latitude + (b.latitude - a.latitude) * r,
          longitude: a.longitude + (b.longitude - a.longitude) * r,
        });
        break;
      }
      out.push(b);
      walked += seg;
    }
    return out;
  }, [pathPoints, progress]);

  const mapStations = useMemo(
    () => stations
      .filter((s) => isValidCoord(s.latitude, s.longitude))
      .map((s, index) => ({
        stationId: s.stationId || `st-${index}`,
        stationCode: s.stationCode || s.code || "",
        stationName: s.stationName || s.name || "",
        latitude: s.latitude,
        longitude: s.longitude,
        status: "Active",
      })),
    [stations],
  );

  const boatId = String(boat?.boatId || boat?.id || boat?.code || "trip-boat");
  const mapBoats = useMemo(() => {
    if (!boatLatLng) return [];
    return [{
      boatId,
      boatCode: boat?.code || boat?.boatCode || "",
      boatName: boat?.name || boat?.boatName || "",
      latitude: boatLatLng.latitude,
      longitude: boatLatLng.longitude,
      heading: liveLocation?.heading ?? liveLocation?.course ?? null,
      numberOfDecks: boat?.numberOfDecks,
      serviceType: boat?.serviceType,
      seatSetupType: boat?.seatSetupType,
      imageUrl: boat?.imageUrl,
      seatCount: boat?.seatCount,
      passengerCount: boat?.passengerCount,
      isOnline: Boolean(liveLocation) || isMoving,
      speed: liveLocation?.speed,
    }];
  }, [boat, boatId, boatLatLng, liveLocation, isMoving]);

  const endStation = stations[stations.length - 1];
  const displayRoute = routeLabel
    || [routeCode, shortStationName(stations[0]?.stationName), shortStationName(endStation?.stationName)]
      .filter(Boolean)
      .join(" · ")
    || (lang === "VN" ? "Tuyến chuyến" : "Trip route");

  if (pathPoints.length < 2 && !boatLatLng) {
    return (
      <div className="flex h-[300px] items-center justify-center bg-slate-100 dark:bg-slate-900/40">
        <div className="text-center">
          <span className="material-symbols-outlined text-3xl text-slate-300">map</span>
          <p className="mt-2 text-xs font-bold text-slate-500">
            {lang === "VN" ? "Chưa có đường route để hiển thị." : "No route path to show."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[320px] overflow-hidden bg-slate-200 sm:h-[380px]">
      <WaterwayMap
        coordinates={pathPoints}
        highlightCoordinates={traveledPoints}
        stationsList={mapStations}
        boatMarkers={mapBoats}
        selectedBoatId={boatId}
        focusView={boatLatLng}
        preferFocus
        fitBoatMarkers
        stationAsFlag
        hideStationLink
        boatMarkerStyle="hull"
        waterwayName={displayRoute}
        overlayEyebrow={lang === "VN" ? "Đang bám theo tàu" : "Following boat"}
        className="h-full min-h-0"
      />
    </div>
  );
};

export function TripDetail() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [boatCatalog, setBoatCatalog] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [trackingAt, setTrackingAt] = useState(null);
  const [isTrackingBusy, setIsTrackingBusy] = useState(false);
  const [routeLine, setRouteLine] = useState([]);
  const [routeStations, setRouteStations] = useState([]);
  const [routeMeta, setRouteMeta] = useState({ routeId: "", routeCode: "", routeName: "" });
  const [boatCrewNames, setBoatCrewNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [dwellTick, setDwellTick] = useState(() => Date.now());
  const [isDelayBusy, setIsDelayBusy] = useState(false);
  const [affectedNotice, setAffectedNotice] = useState([]);

  const refreshTracking = async (tripId, _boatCode, { silent = false } = {}) => {
    if (!tripId) return;
    if (!silent) setIsTrackingBusy(true);
    try {
      const live = await fetchLatestTripTracking(tripId).catch(() => null);
      setTracking(live);
      setTrackingAt(new Date());
    } finally {
      if (!silent) setIsTrackingBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");
        setBoatCatalog(null);
        setRouteLine([]);
        setRouteStations([]);
        setRouteMeta({ routeId: "", routeCode: "", routeName: "" });
        setBoatCrewNames([]);
        const detail = await fetchTripDetail(id);
        if (!active) return;
        setTrip(detail || null);

        const boatId = detail?.boatId
          || detail?.boat?.boatId
          || detail?.boat?.vesselId
          || detail?.boat?.id
          || "";
        const boatCode = detail?.boatCode
          || detail?.boat?.boatCode
          || detail?.boat?.vesselCode
          || detail?.boat?.code
          || "";

        await refreshTracking(id, boatCode, { silent: true });

        if (boatId) {
          fetchBoatDetail(boatId)
            .then((boat) => {
              if (!active) return;
              const unwrapped = boat?.data && typeof boat.data === "object" ? boat.data : boat;
              setBoatCatalog(unwrapped || null);
            })
            .catch(() => {});
        }

        // Crew OnBoard theo tàu + ngày chuyến (check vé trên tàu).
        const dayKey = toOperatingDayKey(detail);
        if (boatId || boatCode) {
          fetchStaffAssignments({
            assignmentType: ASSIGNMENT_TYPE.BOAT,
            boatId: boatId || undefined,
            fromDate: dayKey || undefined,
            toDate: dayKey || undefined,
            status: ASSIGNMENT_STATUS.SCHEDULED,
          })
            .then((rows) => {
              if (!active) return;
              const names = [];
              const seen = new Set();
              (rows || []).forEach((row) => {
                if (!row || isAssignmentInactive(row.status)) return;
                if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return;
                if (dayKey && !assignmentCoversDay(row, dayKey)) return;
                const rowBoatId = String(row.boat?.boatId || "").trim();
                const rowBoatCode = String(row.boat?.boatCode || "").trim().toUpperCase();
                const match = (boatId && rowBoatId && boatId === rowBoatId)
                  || (boatCode && rowBoatCode && String(boatCode).toUpperCase() === rowBoatCode);
                if (!match) return;
                const name = String(row.staffName || "").trim();
                const key = String(row.staffUserId || name).trim();
                if (!name || !key || seen.has(key)) return;
                seen.add(key);
                names.push(name);
              });
              setBoatCrewNames(names);
            })
            .catch(() => {
              if (active) setBoatCrewNames([]);
            });
        }

        // Geometry đúng của route gắn trip (+ waterway fallback)
        try {
          const [routes, allStations] = await Promise.all([
            fetchAllRoutes().catch(() => []),
            fetchAllStations().catch(() => []),
          ]);
          if (!active) return;

          const routeList = Array.isArray(routes) ? routes : (Array.isArray(routes?.data) ? routes.data : []);
          const stationList = Array.isArray(allStations)
            ? allStations
            : (Array.isArray(allStations?.data) ? allStations.data : []);
          const stationById = new Map(
            stationList.map((s) => [String(s.stationId ?? s.id ?? ""), s]),
          );

          let routeId = detail?.routeId
            || detail?.RouteId
            || detail?.route?.routeId
            || detail?.route?.id
            || "";
          const tripRouteCode = String(
            detail?.routeCode || detail?.route?.routeCode || "",
          ).trim().toUpperCase();
          if (!routeId && tripRouteCode) {
            const matched = routeList.find(
              (r) => String(r.routeCode || "").trim().toUpperCase() === tripRouteCode,
            );
            routeId = matched?.routeId || matched?.id || "";
          }

          let routeDetail = null;
          if (routeId) {
            const raw = await fetchRouteDetail(routeId).catch(() => null);
            routeDetail = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data)
              ? raw.data
              : raw;
          }

          const tripStops = sortStops(detail?.stops);
          const buildStation = (stop, index) => {
            const sid = String(stop?.stationId ?? stop?.station?.stationId ?? "");
            const catalog = sid ? stationById.get(sid) : null;
            const coords = readStationCoords(stop)
              || readStationCoords(stop?.station)
              || readStationCoords(catalog);
            if (!coords) return null;
            return {
              stationId: sid || `stop-${index}`,
              stationName: stop?.stationName
                || stop?.station?.stationName
                || catalog?.stationName
                || `Stop ${index + 1}`,
              stationCode: stop?.stationCode || stop?.station?.stationCode || catalog?.stationCode || "",
              latitude: coords.latitude,
              longitude: coords.longitude,
              stopOrder: Number(stop?.stopOrder ?? index + 1),
            };
          };

          let markers = tripStops.map(buildStation).filter(Boolean);
          if (!markers.length && Array.isArray(routeDetail?.stops)) {
            markers = sortStops(routeDetail.stops).map(buildStation).filter(Boolean);
          }

          // Ưu tiên NGUYÊN routeGeometry đã vẽ (GPS) — không nối thẳng bến.
          const geometryCandidates = [
            routeDetail?.routeGeometry,
            routeDetail?.geometry,
            routeDetail?.path,
            routeDetail?.coordinates,
            detail?.routeGeometry,
            detail?.route?.routeGeometry,
            detail?.route?.geometry,
          ];
          let line = [];
          for (const candidate of geometryCandidates) {
            line = geometryToCoordinates(candidate);
            if (line.length >= 2) break;
          }

          // Fallback waterway của route (cũng là polyline đã vẽ, không phải chord bến)
          if (line.length < 2) {
            const waterwayId = routeDetail?.waterwayId
              || routeDetail?.WaterwayId
              || detail?.waterwayId
              || detail?.route?.waterwayId;
            if (waterwayId) {
              const waterway = await fetchWaterwayDetail(waterwayId).catch(() => null);
              const ww = waterway?.data && typeof waterway.data === "object" ? waterway.data : waterway;
              line = geometryToCoordinates(ww?.coordinates || ww?.geometry || ww?.routeGeometry);
            }
          }

          // Chỉ nối bến khi THỰC SỰ không có geometry — tránh thay thế đường GPS đã vẽ.
          if (line.length < 2 && markers.length >= 2) {
            console.warn(
              "[TripDetail] Thiếu routeGeometry — tạm nối bến. Kiểm tra BE trả routeGeometry cho",
              tripRouteCode || routeId,
            );
            line = markers.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
          }

          if (active) {
            setRouteStations(markers);
            setRouteLine(line);
            setRouteMeta({
              routeId: String(routeDetail?.routeId || routeDetail?.id || routeId || ""),
              routeCode: routeDetail?.routeCode || detail?.routeCode || tripRouteCode || "",
              routeName: routeDetail?.routeName || detail?.routeName || detail?.route?.routeName || "",
            });
          }
        } catch (routeErr) {
          console.warn("Không tải geometry tuyến:", routeErr);
        }
      } catch (error) {
        console.error("Lỗi tải chi tiết chuyến:", error);
        if (active) {
          setErrorMsg(getApiErrorMessage(
            error,
            lang === "VN" ? "Không tải được chi tiết chuyến." : "Unable to load trip detail.",
          ));
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, lang]);

  const stops = useMemo(() => sortStops(trip?.stops), [trip]);
  const boat = useMemo(() => resolveBoat(trip, boatCatalog), [trip, boatCatalog]);
  const onBoardCrewDisplay = useMemo(() => {
    const fromTrip = normalizeStaffList(
      trip?.onBoardStaff ?? trip?.onboardStaff ?? trip?.OnBoardStaff,
    ).map(pickStaffName).filter((n) => n && n !== "—");
    if (fromTrip.length > 0) return fromTrip;
    return boatCrewNames;
  }, [trip, boatCrewNames]);

  const fromName = stationLabel(trip?.fromStation)
    || trip?.fromStationName
    || stationLabel(stops[0])
    || stops[0]?.stationName
    || "—";
  const toName = stationLabel(trip?.toStation)
    || trip?.toStationName
    || stationLabel(stops[stops.length - 1])
    || stops[stops.length - 1]?.stationName
    || "—";

  const passengerCount = resolvePassengerCount(trip, stops);
  const capacity = toCount(trip?.capacitySnapshot) ?? boat.capacity;
  const remainingSeats = toCount(trip?.remainingSeats ?? trip?.availableSeats);
  const fareAdjustment = (() => {
    const adj = trip?.fareAdjustment || trip?.FareAdjustment || trip?.effectiveFareAdjustment;
    if (!adj) return null;
    if (typeof adj === "string") return adj;
    const label = adj.name || adj.label || adj.type || adj.adjustmentType || adj.code;
    const pct = adj.percent ?? adj.percentage ?? adj.surchargePercent;
    const amount = adj.amount ?? adj.surchargeAmount ?? adj.extraAmount;
    const parts = [];
    if (label) parts.push(String(label));
    if (pct != null && Number.isFinite(Number(pct))) parts.push(`+${Number(pct)}%`);
    else if (amount != null && Number.isFinite(Number(amount))) {
      parts.push(`+${Number(amount).toLocaleString("vi-VN")}đ`);
    }
    return parts.length ? parts.join(" · ") : (lang === "VN" ? "Có phụ thu" : "Surcharge");
  })();
  const operatingDateLabel = resolveOperatingDate(trip, lang);
  const lastStopIndex = stops.length - 1;
  const statusKey = normalizeTripStatusKey(trip?.tripStatus || trip?.status);
  const shouldPollTracking = ACTIVE_TRACK_STATUSES.has(statusKey);

  useEffect(() => {
    if (!id || !shouldPollTracking) return undefined;
    const boatCode = boat.code || trip?.boatCode || "";
    const timer = window.setInterval(() => {
      refreshTracking(id, boatCode, { silent: true });
    }, TRACKING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [id, shouldPollTracking, boat.code, trip?.boatCode]);

  // Đếm ngược dừng bến theo giây (m:ss) khi có dwellCountdown.
  useEffect(() => {
    const hasDwell = Boolean(tracking?.latestLocation?.dwellCountdown);
    if (!hasDwell) return undefined;
    const timer = window.setInterval(() => setDwellTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [tracking?.latestLocation?.dwellCountdown]);

  const delayInfo = useMemo(() => pickDelayInfo(trip), [trip]);
  const delayActive = isDelayActive(delayInfo);
  const delayMinutes = pickDelayMinutes(trip);
  const showDelayStart = canStartTripDelay(trip);
  const showDelayResume = canResumeTripDelay(trip);

  // JoinBoat + lắng nghe tripDelayUpdated khi mở chi tiết.
  useEffect(() => {
    const boatId = String(
      boat.id || trip?.boatId || trip?.boat?.boatId || "",
    ).trim();
    if (!boatId) return undefined;

    let cancelled = false;
    trackingHub.joinBoat(boatId).catch(() => {});

    const unsub = trackingHub.subscribeTripDelayUpdated((payload) => {
      if (cancelled || !payload) return;
      setTrip((prev) => {
        if (!prev) return prev;
        const next = applyDelayPayloadToTrip(prev, payload);
        return next === prev ? prev : next;
      });
      const affected = pickAffectedTrips(payload);
      if (affected.length) {
        setAffectedNotice(affected);
      }
    });

    return () => {
      cancelled = true;
      unsub();
      trackingHub.leaveBoat(boatId).catch(() => {});
    };
  }, [boat.id, trip?.boatId, trip?.boat?.boatId]);

  const handleStartDelay = async () => {
    if (!trip?.tripId && !id) return;
    if (!showDelayStart || isDelayBusy) return;

    const stopOrder = resolveDelayStartStopOrder(stops);
    const stationName = pickStationNameForStopOrder(stops, stopOrder);
    const defaultReason = stationName
      ? (lang === "VN"
        ? `Tàu đang dừng tại bến ${stationName}`
        : `Boat stopped at ${stationName}`)
      : (lang === "VN" ? "Tàu đang dừng" : "Boat is delayed");

    const result = await notify({
      dialog: true,
      icon: "question",
      title: lang === "VN" ? "Bắt đầu Delay" : "Start Delay",
      input: "text",
      inputValue: defaultReason,
      inputPlaceholder: lang === "VN" ? "Lý do dừng…" : "Delay reason…",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Delay" : "Delay",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
      inputValidator: (value) => {
        if (!String(value || "").trim()) {
          return lang === "VN" ? "Nhập lý do delay." : "Enter a delay reason.";
        }
        return null;
      },
    });
    if (!result?.isConfirmed) return;

    setIsDelayBusy(true);
    try {
      const tripId = trip?.tripId || id;
      const response = await startTripDelay(tripId, {
        reason: String(result.value || defaultReason).trim(),
        startStopOrder: stopOrder,
      });
      setTrip((prev) => applyDelayPayloadToTrip(prev || trip, {
        ...response,
        tripId,
        delayInfo: pickDelayInfo(response) || {
          isDelayActive: true,
          delayStartedAt: response?.delayStartedAt || new Date().toISOString(),
          reason: String(result.value || defaultReason).trim(),
          stationName,
          startStopOrder: stopOrder,
        },
      }));
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã bắt đầu delay" : "Delay started",
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không start được delay" : "Unable to start delay",
        text: getApiErrorMessage(error),
      });
    } finally {
      setIsDelayBusy(false);
    }
  };

  const handleResumeDelay = async () => {
    if (!trip?.tripId && !id) return;
    if (!showDelayResume || isDelayBusy) return;

    const result = await notify({
      dialog: true,
      icon: "question",
      title: lang === "VN" ? "Tiếp tục hành trình" : "Resume trip",
      input: "text",
      inputValue: lang === "VN" ? "Tàu tiếp tục hành trình" : "Boat continues journey",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Tiếp tục" : "Resume",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!result?.isConfirmed) return;

    setIsDelayBusy(true);
    try {
      const tripId = trip?.tripId || id;
      const response = await resumeTripDelay(tripId, {
        note: String(result.value || "Tàu tiếp tục hành trình").trim(),
      });
      setTrip((prev) => applyDelayPayloadToTrip(prev || trip, {
        ...response,
        tripId,
        delayInfo: pickDelayInfo(response) || {
          ...(pickDelayInfo(prev) || {}),
          isDelayActive: false,
          delayMinutes: pickDelayMinutes(response) || pickDelayMinutes(prev),
        },
      }));
      const affected = pickAffectedTrips(response);
      setAffectedNotice(affected);
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã tiếp tục chuyến" : "Trip resumed",
        text: affected.length
          ? (lang === "VN"
            ? `${affected.length} chuyến sau bị ảnh hưởng (BE tính lan delay).`
            : `${affected.length} later trip(s) affected (BE cascade).`)
          : undefined,
      });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không resume được" : "Unable to resume",
        text: getApiErrorMessage(error),
      });
    } finally {
      setIsDelayBusy(false);
    }
  };

  const liveLocation = useMemo(() => {
    const tripLoc = tracking?.latestLocation;
    if (tripLoc && isValidCoord(tripLoc.latitude, tripLoc.longitude)) {
      return { ...tripLoc, source: "trip", matched: Boolean(tracking?.hasLiveLocationForTrip) };
    }
    return null;
  }, [tracking]);

  const routeProgress = useMemo(
    () => resolveRouteProgress(stops, liveLocation, statusKey, routeLine),
    [stops, liveLocation, statusKey, routeLine],
  );

  const isBoatMoving = Boolean(
    liveLocation
    && Number(liveLocation.speed) > 1.2
    && (statusKey === "InProgress" || statusKey === "Delayed"),
  );

  const dwellNotice = useMemo(
    () => formatDwellCountdownNotice(liveLocation?.dwellCountdown, lang, dwellTick, {
      stops,
      isTerminalStop: statusKey === "Completed"
        || isDwellAtTerminalStop(liveLocation?.dwellCountdown, stops),
    }),
    [liveLocation?.dwellCountdown, lang, dwellTick, stops, statusKey],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 pb-10 font-body animate-fade-in sm:px-4">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-5">
        <button
          type="button"
          onClick={() => navigate("/admin/trips-management")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-[#124757] hover:text-white dark:border-slate-700 dark:bg-slate-900"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 sm:text-2xl">
              {trip?.tripCode || id}
            </h2>
            {trip ? (
              <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ${statusBadgeClass(trip.tripStatus)}`}>
                {getTripStatusLabel(trip.tripStatus || trip.status, lang)}
              </span>
            ) : null}
            {delayActive ? (
              <span className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                {lang === "VN" ? "Đang dừng / Delay" : "Stopped / Delay"}
              </span>
            ) : null}
            {!delayActive && delayMinutes > 0 ? (
              <span className="inline-flex rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
                {lang === "VN" ? `Trễ ${delayMinutes} phút` : `Late ${delayMinutes} min`}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {[trip?.routeCode, trip?.routeName].filter(Boolean).join(" · ") || (lang === "VN" ? "Chi tiết chuyến" : "Trip detail")}
          </p>
          {delayActive ? (
            <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {formatActiveDelayLine(delayInfo, { lang })}
            </p>
          ) : delayMinutes > 0 ? (
            <p className="mt-1 text-[11px] font-bold text-orange-700 dark:text-orange-300">
              {formatPostResumeDelayLine(trip, lang)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showDelayStart ? (
            <button
              type="button"
              onClick={handleStartDelay}
              disabled={isDelayBusy || isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
            >
              <span className="material-symbols-outlined text-[16px]">pause_circle</span>
              Delay
            </button>
          ) : null}
          {showDelayResume ? (
            <button
              type="button"
              onClick={handleResumeDelay}
              disabled={isDelayBusy || isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
            >
              <span className="material-symbols-outlined text-[16px]">play_circle</span>
              {lang === "VN" ? "Tiếp tục" : "Resume"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              const boatId = boat.id || trip?.boatId || "";
              const boatCode = boat.code || trip?.boatCode || "";
              const routeId = routeMeta.routeId || trip?.routeId || trip?.route?.routeId || "";
              const routeCode = routeMeta.routeCode || trip?.routeCode || trip?.route?.routeCode || "";
              if (boatId) params.set("boatId", String(boatId));
              if (boatCode) params.set("boatCode", String(boatCode));
              if (routeId) params.set("routeId", String(routeId));
              if (routeCode) params.set("routeCode", String(routeCode));
              if (trip?.tripId || id) params.set("tripId", String(trip?.tripId || id));
              if (trip?.tripCode) params.set("tripCode", String(trip.tripCode));
              params.set("focus", "1");
              navigate(`/admin/live-tracking?${params.toString()}`);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#124757]/15 bg-[#124757]/5 px-3 py-2 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] transition hover:bg-[#124757]/10 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400"
          >
            <span className="material-symbols-outlined text-[16px]">my_location</span>
            Live map
          </button>
        </div>
      </div>

      {affectedNotice.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-headline font-black uppercase tracking-wider text-amber-800 dark:text-amber-200">
            {lang === "VN" ? "Chuyến sau bị ảnh hưởng" : "Affected later trips"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {affectedNotice.map((row) => {
              const code = row.tripCode || row.TripCode || row.tripId || row.TripId || "—";
              const line = formatAffectedTripLine(row, lang);
              return (
                <li key={String(row.tripId || row.TripId || code)} className="font-bold text-amber-900 dark:text-amber-100">
                  {code}{line ? ` — ${line}` : ""}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-16 text-center dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757]" />
          <p className="text-xs text-slate-400">{lang === "VN" ? "Đang tải…" : "Loading…"}</p>
        </div>
      ) : errorMsg ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : !trip ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          {lang === "VN" ? "Không có dữ liệu chuyến." : "No trip data."}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-5">
              <div className="relative md:col-span-2 aspect-[16/10] md:aspect-auto md:min-h-[220px] bg-slate-100 dark:bg-slate-900">
                <img
                  src={boat.imageUrl || DEFAULT_BOAT_IMAGE}
                  alt={boat.code || trip.tripCode}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.src = DEFAULT_BOAT_IMAGE; }}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4">
                  <p className="font-headline text-sm font-black text-white">
                    {[boat.code, boat.name].filter(Boolean).join(" · ") || (lang === "VN" ? "Chưa gán tàu" : "No boat")}
                  </p>
                </div>
              </div>

              <div className="md:col-span-3 flex flex-col justify-center gap-5 p-5">
                {/* Hành trình */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {lang === "VN" ? "Hành trình" : "Route"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-headline text-lg font-black leading-snug text-[#124757] dark:text-white">
                      {fromName}
                    </span>
                    <span className="material-symbols-outlined shrink-0 text-xl text-[#FFD100]">arrow_forward</span>
                    <span className="font-headline text-lg font-black leading-snug text-[#124757] dark:text-white">
                      {toName}
                    </span>
                  </div>
                </div>

                {/* Chỉ số — lưới 2×2, không bị cắt */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Giờ chạy" : "Schedule"}
                    </p>
                    <p className="mt-1.5 text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                      {formatTime(pickDisplayDeparture(trip))}
                      <span className="mx-1.5 text-slate-300">→</span>
                      {formatTime(pickDisplayArrival(trip))}
                    </p>
                    {(trip.adjustedDepartureTime || trip.adjustedArrivalTime) ? (
                      <p className="mt-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {lang === "VN" ? "Đã điều chỉnh giờ" : "Adjusted times"}
                        {delayMinutes > 0 ? ` · ${lang === "VN" ? `trễ ${delayMinutes}p` : `late ${delayMinutes}m`}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Hành khách (unique)" : "Passengers (unique)"}
                    </p>
                    <p className="mt-1.5 text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                      {formatCount(passengerCount)}
                      <span className="font-medium text-slate-400"> / {formatCount(capacity)}</span>
                    </p>
                    {remainingSeats != null ? (
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                        {lang === "VN" ? `Còn ${remainingSeats} ghế` : `${remainingSeats} seats left`}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Số bến" : "Stops"}
                    </p>
                    <p className="mt-1.5 text-sm font-black text-slate-800 dark:text-slate-100">
                      {trip.stopCount ?? stops.length ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Ngày vận hành" : "Operating date"}
                    </p>
                    <p className="mt-1.5 text-sm font-black text-slate-800 dark:text-slate-100">
                      {operatingDateLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                      {trip.routeType || trip.tripType || "—"}
                    </p>
                    {fareAdjustment ? (
                      <p className="mt-1 text-[11px] font-black text-amber-700 dark:text-amber-300">
                        {lang === "VN" ? "Phụ thu: " : "Surcharge: "}{fareAdjustment}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60 sm:px-5">
              <h3 className="font-headline text-xs font-black uppercase tracking-[0.14em] text-[#124757] dark:text-yellow-400">
                GPS
              </h3>
              <div className="ml-auto flex items-center gap-2">
                {trackingAt ? (
                  <span className="text-[10px] font-medium tabular-nums text-slate-400">
                    {formatTime(trackingAt instanceof Date ? trackingAt.toISOString() : trackingAt)}
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={isTrackingBusy}
                  onClick={() => refreshTracking(id, boat.code || trip?.boatCode || "")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-[#124757]/30 hover:text-[#124757] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  title={lang === "VN" ? "Làm mới" : "Refresh"}
                >
                  <span className={`material-symbols-outlined text-[16px] ${isTrackingBusy ? "animate-spin" : ""}`}>
                    refresh
                  </span>
                </button>
              </div>
            </div>

            <TripRealRouteMap
              routeLine={routeLine}
              stations={routeStations}
              progress={routeProgress}
              liveLocation={liveLocation}
              boat={{
                boatId: boat.id || trip?.boatId || boat.code || trip?.boatCode,
                code: boat.code || trip?.boatCode,
                name: boat.name || trip?.boatName,
                numberOfDecks: boat.numberOfDecks,
                serviceType: boat.serviceType,
                seatSetupType: boat.seatSetupType,
                imageUrl: boat.imageUrl,
                seatCount: capacity,
                passengerCount,
              }}
              routeCode={routeMeta.routeCode || trip?.routeCode || trip?.route?.routeCode || ""}
              routeLabel={
                [
                  routeMeta.routeCode || trip?.routeCode || trip?.route?.routeCode,
                  routeMeta.routeName || trip?.routeName || trip?.route?.routeName,
                ].filter(Boolean).join(" · ")
                || `${fromName} → ${toName}`
              }
              isMoving={isBoatMoving || (Boolean(liveLocation) && (statusKey === "InProgress" || statusKey === "Delayed"))}
              lang={lang}
            />

            {dwellNotice ? (
              <p className="border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-[11px] font-bold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 sm:px-5">
                {dwellNotice}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Thông tin tàu" : "Boat details"}
              </h3>
              <Link
                to="/admin/staff-assignments"
                className="text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] underline dark:text-yellow-400"
              >
                {lang === "VN" ? "Phân công OnBoard" : "Assign OnBoard"}
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetaCell label={lang === "VN" ? "Mã tàu" : "Boat code"}>{boat.code || "—"}</MetaCell>
              <MetaCell label={lang === "VN" ? "Tên tàu" : "Boat name"}>{boat.name || "—"}</MetaCell>
              <MetaCell label={lang === "VN" ? "Biển kiểm soát" : "Registration"}>
                {boat.registrationNumber || "—"}
              </MetaCell>
              <MetaCell label={lang === "VN" ? "Loại dịch vụ" : "Service"}>
                {boat.serviceType || "—"}
              </MetaCell>
              <MetaCell label={lang === "VN" ? "Số tầng" : "Decks"}>
                {boat.numberOfDecks ?? "—"}
              </MetaCell>
              <MetaCell label={lang === "VN" ? "Tốc độ tối đa" : "Max speed"}>
                {boat.maxSpeedKmh != null ? `${boat.maxSpeedKmh} km/h` : "—"}
              </MetaCell>
            </div>

            <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 dark:border-teal-500/20 dark:bg-teal-500/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-300">
                {lang === "VN" ? "Nhân viên OnBoard (check vé trên tàu)" : "OnBoard crew (ticket check on boat)"}
              </p>
              {onBoardCrewDisplay.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {onBoardCrewDisplay.map((name) => (
                    <li
                      key={name}
                      className="rounded-lg border border-teal-200 bg-white px-2.5 py-1 text-[12px] font-bold text-[#124757] dark:border-teal-500/30 dark:bg-slate-900 dark:text-yellow-400"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[12px] font-medium text-teal-800/70 dark:text-teal-200/80">
                  {lang === "VN"
                    ? "Chưa có ca OnBoard cho tàu ngày này. Gán ≥ 2 nhân viên trên tàu trước khi vận hành."
                    : "No OnBoard shift for this boat today. Assign ≥ 2 boat crew before operating."}
                </p>
              )}
              <p className="mt-2 text-[10px] font-medium text-teal-700/80 dark:text-teal-200/70">
                {lang === "VN"
                  ? "Check vé theo tàu — không phân nhân viên quét theo từng bến trên trip."
                  : "Ticket check is by boat — not assigned per station stop on the trip."}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
              <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? `Bến dừng (${stops.length})` : `Stops (${stops.length})`}
              </h3>
            </div>

            {stops.length === 0 ? (
              <p className="p-8 text-center text-xs font-medium text-slate-400">
                {lang === "VN" ? "Không có stops[]." : "No stops[]."}
              </p>
            ) : (
              <ol className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {stops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === lastStopIndex;
                  const name = stop.stationName || stop.station?.stationName || "—";
                  const code = stop.stationCode || stop.station?.stationCode || "";
                  const address = stop.stationAddress || stop.station?.address || "";
                  const stopOpsBadge = resolveStopOpsBadge(stop, {
                    isFirst,
                    isLast,
                    tripStatusKey: statusKey,
                    lang,
                  });
                  const scheduledArr = isFirst ? null : (stop.scheduledArrival ?? null);
                  const scheduledDep = isLast ? null : (stop.scheduledDeparture ?? null);
                  // Bến đầu không dùng giờ đến (kể cả actualArrival BE gửi nhầm).
                  // Bến cuối không dùng giờ đi.
                  const actualArr = isFirst ? null : (stop.actualArrival ?? null);
                  const actualDep = isLast ? null : (stop.actualDeparture ?? null);
                  const onboard = toCount(stop.onboardPassengerCount);
                  const boarding = toCount(stop.boardingPassengerCount) ?? 0;
                  const alighting = toCount(stop.alightingPassengerCount);
                  const segment = toCount(stop.segmentPassengerCount);

                  return (
                    <li key={stop.tripStopId || `${stop.stopOrder}-${code}-${index}`} className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
                      <div className="flex items-start gap-3 sm:block">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#124757] text-[12px] font-headline font-black text-white dark:bg-yellow-400 dark:text-[#124757]">
                          {stop.stopOrder ?? index + 1}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-headline text-sm font-black text-slate-800 dark:text-white">
                              {name}
                              {code ? <span className="ml-2 text-[11px] font-bold text-slate-400">{code}</span> : null}
                            </p>
                            {address ? (
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{address}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {stopOpsBadge ? (
                              <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${stopOpsBadge.className}`}>
                                {stopOpsBadge.text}
                              </span>
                            ) : null}
                            {stop.stayDurationMinutes != null ? (
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900">
                                {lang === "VN" ? `Dừng ${stop.stayDurationMinutes} phút` : `${stop.stayDurationMinutes} min stay`}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ScheduleCompare
                          scheduledArr={scheduledArr}
                          scheduledDep={scheduledDep}
                          actualArr={actualArr}
                          actualDep={actualDep}
                          lang={lang}
                          isFirst={isFirst}
                          isLast={isLast}
                        />

                        <div className="flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 font-bold text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300">
                            {lang === "VN" ? "Lên" : "Board"} {boarding}
                          </span>
                          <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 font-bold text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                            {lang === "VN" ? "Xuống" : "Alight"} {alighting == null ? "—" : alighting}
                          </span>
                          <span className="rounded-lg border border-[#124757]/20 bg-[#124757]/5 px-2.5 py-1 font-bold text-[#124757] dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-400">
                            {lang === "VN" ? "Trên tàu" : "Onboard"}{" "}
                            {onboard != null && capacity != null
                              ? `${onboard}/${capacity}`
                              : (onboard == null ? "—" : onboard)}
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            {lang === "VN" ? "Chặng" : "Segment"} {segment == null ? "—" : segment}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
