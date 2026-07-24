import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
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
import {
  getIncidentTypeLabel,
  getSeverityLabel,
} from "../../../services/incidentService";
import { DEFAULT_BOAT_IMAGE, getBoatImageUrl } from "../../../utils/charterBookingAdmin";
import { formatCustomerRouteTitle } from "../../../utils/routeTypes";
import { getApiErrorMessage } from "../../../utils/apiError";
import { formatDwellCountdownNotice, shouldSuppressDwellCountdown } from "../../../utils/boatTracking";
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
  getTripDelayTooEarlyMessage,
  isDelayActive,
  pickAffectedTrips,
  pickDelayInfo,
  pickDelayMinutes,
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

const resolveHeroImage = (_trip, boatCatalog) => {
  // Ảnh chỉ lấy từ GET /boats/{id} — không đọc trip.boat.imageUrl / boatImageUrl.
  const candidates = [
    boatCatalog?.imageUrl,
    Array.isArray(boatCatalog?.imageUrls) ? boatCatalog.imageUrls[0] : "",
  ].filter(Boolean);
  const first = candidates.find((url) => {
    const s = String(url).trim();
    return s && !/image\s*not\s*available/i.test(s);
  });
  if (first) return first;
  return getBoatImageUrl(boatCatalog, DEFAULT_BOAT_IMAGE);
};

/** Trip chỉ còn reference: boatId / boatName hoặc boat.vesselId / vesselName. */
const pickTripBoatId = (trip) => String(
  trip?.boatId
  || trip?.boat?.vesselId
  || trip?.boat?.boatId
  || trip?.BoatId
  || "",
).trim();

const pickTripBoatName = (trip) => String(
  trip?.boatName
  || trip?.boat?.vesselName
  || trip?.boat?.boatName
  || trip?.BoatName
  || "",
).trim();

const resolveBoat = (trip, boatCatalog) => {
  const catalog = boatCatalog && typeof boatCatalog === "object" ? boatCatalog : {};
  const id = pickTripBoatId(trip)
    || String(catalog.boatId || catalog.vesselId || catalog.id || "").trim();
  return {
    id,
    // Mã / biển / tầng / tốc độ / ảnh chỉ từ boat detail API.
    code: catalog.boatCode || catalog.code || catalog.vesselCode || "",
    name: pickTripBoatName(trip)
      || catalog.boatName
      || catalog.vesselName
      || catalog.name
      || "",
    registrationNumber: catalog.registrationNumber || catalog.registrationNo || catalog.plateNumber || "",
    serviceType: catalog.serviceType || catalog.ServiceType || "",
    numberOfDecks: toCount(catalog.numberOfDecks ?? catalog.NumberOfDecks),
    maxSpeedKmh: toCount(catalog.maxSpeedKmh ?? catalog.maxSpeed ?? catalog.MaxSpeedKmh),
    capacity: toCount(catalog.capacity ?? catalog.seatCount ?? trip?.capacitySnapshot),
    status: catalog.status || "",
    imageUrl: resolveHeroImage(trip, catalog),
  };
};

/** Grid: nhãn | Đến | Đi — 3 dòng: kế hoạch / dự kiến mới (nếu có) / thực tế GPS.
 * Không tính delay thủ công từ scheduled vs actual. */
const ScheduleCompare = ({
  scheduledArr,
  scheduledDep,
  adjustedArr,
  adjustedDep,
  actualArr,
  actualDep,
  lang,
  isFirst = false,
  isLast = false,
}) => {
  const timeText = (time) => formatTime(time);
  const gridClass = "grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-2";
  const hasAdjusted = Boolean(adjustedArr || adjustedDep);

  const plannedArrive = isFirst ? null : scheduledArr;
  const plannedDepart = isLast ? null : scheduledDep;
  const estimateArrive = isFirst ? null : adjustedArr;
  const estimateDepart = isLast ? null : adjustedDep;
  const gpsArrive = isFirst ? null : actualArr;
  const gpsDepart = isLast ? null : actualDep;

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
          {timeText(plannedArrive)}
        </span>
        <span className="text-center text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
          {timeText(plannedDepart)}
        </span>
      </div>

      {hasAdjusted ? (
        <div className={`${gridClass} border-t border-amber-100 bg-amber-50/40 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/5`}>
          <span className="pt-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
            {lang === "VN" ? "Dự kiến mới" : "Adjusted"}
          </span>
          <span className="text-center text-sm font-black tabular-nums text-amber-800 dark:text-amber-200">
            {timeText(estimateArrive)}
          </span>
          <span className="text-center text-sm font-black tabular-nums text-amber-800 dark:text-amber-200">
            {timeText(estimateDepart)}
          </span>
        </div>
      ) : null}

      <div className={`${gridClass} border-t border-slate-100 px-3 py-2.5 dark:border-slate-700/60`}>
        <span className="pt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          {lang === "VN" ? "Thực tế GPS" : "Actual GPS"}
        </span>
        <span className="text-center text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
          {timeText(gpsArrive)}
        </span>
        <span className="text-center text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
          {timeText(gpsDepart)}
        </span>
      </div>
    </div>
  );
};

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
 * Chuyến Completed/Cancelled: không marker tàu, chỉ đường route.
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
  showBoat = true,
  hasOpenIncident = false,
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
    if (!showBoat) return null;
    if (liveLocation && isValidCoord(liveLocation.latitude, liveLocation.longitude) && pathPoints.length >= 2) {
      const p = progressNearGps(pathPoints, liveLocation.latitude, liveLocation.longitude);
      return pointAtProgress(pathPoints, p ?? progress);
    }
    return pointAtProgress(pathPoints, progress);
  }, [showBoat, liveLocation, pathPoints, progress]);

  const boatLatLng = useMemo(() => {
    if (!showBoat) return null;
    if (liveLocation && isValidCoord(liveLocation.latitude, liveLocation.longitude)) {
      return { latitude: Number(liveLocation.latitude), longitude: Number(liveLocation.longitude) };
    }
    if (snappedBoat && isValidCoord(snappedBoat.latitude, snappedBoat.longitude)) {
      return { latitude: snappedBoat.latitude, longitude: snappedBoat.longitude };
    }
    return null;
  }, [showBoat, liveLocation, snappedBoat]);

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
    if (!showBoat || !boatLatLng) return [];
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
      hasOpenIncident: Boolean(hasOpenIncident),
      activeIncident: Boolean(hasOpenIncident),
    }];
  }, [showBoat, boat, boatId, boatLatLng, liveLocation, isMoving, hasOpenIncident]);

  const endStation = stations[stations.length - 1];
  const displayRoute = formatCustomerRouteTitle(routeLabel, routeCode, lang)
    || [shortStationName(stations[0]?.stationName), shortStationName(endStation?.stationName)]
      .filter(Boolean)
      .join(" · ")
    || (lang === "VN" ? "Hành trình" : "Trip route");

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
        selectedBoatId={showBoat ? boatId : null}
        focusView={showBoat ? boatLatLng : null}
        preferFocus={showBoat}
        fitBoatMarkers={showBoat}
        stationAsFlag
        hideStationLink
        boatMarkerStyle="hull"
        waterwayName={displayRoute}
        overlayEyebrow={
          hasOpenIncident
            ? (lang === "VN" ? "Tàu đang sự cố" : "Boat incident")
            : showBoat
              ? (lang === "VN" ? "Theo dõi chuyến" : "Tracking your trip")
              : (lang === "VN" ? "Chuyến đã hoàn tất" : "Trip completed")
        }
        className="h-full min-h-0"
      />
    </div>
  );
};

export function TripDetail() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { incidents: openIncidents } = useLiveIncidents({ enabled: true, toast: true });
  const [trip, setTrip] = useState(null);
  const [boatCatalog, setBoatCatalog] = useState(null);
  const [stationCatalogById, setStationCatalogById] = useState(() => new Map());
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
        setStationCatalogById(new Map());
        setRouteLine([]);
        setRouteStations([]);
        setRouteMeta({ routeId: "", routeCode: "", routeName: "" });
        setBoatCrewNames([]);
        const detail = await fetchTripDetail(id);
        if (!active) return;
        setTrip(detail || null);

        const boatId = pickTripBoatId(detail);
        const detailStatus = normalizeTripStatusKey(detail?.tripStatus || detail?.status);
        const gpsLive = ACTIVE_TRACK_STATUSES.has(detailStatus);
        // Chuyến xong / hủy: ngắt GPS — không gọi tracking, không giữ marker tàu.
        if (gpsLive) {
          await refreshTracking(id, "", { silent: true });
        } else if (active) {
          setTracking(null);
          setTrackingAt(null);
        }

        if (boatId) {
          fetchBoatDetail(boatId)
            .then((boat) => {
              if (!active) return;
              const unwrapped = boat?.data && typeof boat.data === "object" ? boat.data : boat;
              setBoatCatalog(unwrapped || null);
              const code = unwrapped?.boatCode || unwrapped?.code || "";
              if (gpsLive && code) refreshTracking(id, code, { silent: true });
            })
            .catch(() => {
              if (active) setBoatCatalog(null);
            });
        } else if (active) {
          setBoatCatalog(null);
        }

        // Crew OnBoard theo đúng ngày chuyến — khớp theo boatId (không phụ thuộc boatCode trên trip).
        const dayKey = toOperatingDayKey(detail);
        if (boatId && dayKey) {
          fetchStaffAssignments({
            assignmentType: ASSIGNMENT_TYPE.BOAT,
            boatId,
            fromDate: dayKey,
            toDate: dayKey,
            status: ASSIGNMENT_STATUS.SCHEDULED,
          })
            .then((rows) => {
              if (!active) return;
              const names = [];
              const seen = new Set();
              (rows || []).forEach((row) => {
                if (!row || isAssignmentInactive(row.status)) return;
                if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return;
                if (!assignmentCoversDay(row, dayKey)) return;
                const rowBoatId = String(row.boat?.boatId || row.boatId || "").trim();
                if (!rowBoatId || rowBoatId !== boatId) return;
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
        } else if (active) {
          setBoatCrewNames([]);
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
            stationList
              .map((s) => [String(s.stationId ?? s.id ?? "").trim(), s])
              .filter(([sid]) => sid),
          );
          if (active) setStationCatalogById(stationById);

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
            // Stop trên trip chỉ còn stationId + stationName — tọa độ/mã lấy từ catalog stations.
            const sid = String(stop?.stationId ?? stop?.station?.stationId ?? "").trim();
            const catalog = sid ? stationById.get(sid) : null;
            const coords = readStationCoords(catalog);
            if (!coords) return null;
            return {
              stationId: sid || `stop-${index}`,
              stationName: stop?.stationName
                || stop?.station?.stationName
                || catalog?.stationName
                || `Stop ${index + 1}`,
              stationCode: catalog?.stationCode || catalog?.code || "",
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
    // Chỉ hiện ca OnBoard đúng ngày chuyến (boatCrewNames đã lọc).
    // Không dùng trip.onBoardStaff — BE có thể trả crew lịch sử của tàu.
    return boatCrewNames;
  }, [boatCrewNames]);

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
  const tripGpsFinished = statusKey === "Completed" || statusKey === "Cancelled";

  useEffect(() => {
    if (!tripGpsFinished) return;
    setTracking(null);
    setTrackingAt(null);
  }, [tripGpsFinished]);

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

  /** Giờ chạy top card: adjusted ưu tiên; gốc lấy planned* nếu có. */
  const scheduleDisplay = useMemo(() => {
    if (!trip) {
      return {
        displayDep: null,
        displayArr: null,
        plannedDep: null,
        plannedArr: null,
        depChanged: false,
        arrChanged: false,
        showDelayNote: false,
      };
    }
    const plannedDep = trip.plannedDepartureTime
      ?? trip.plannedDeparture
      ?? trip.departureTime
      ?? null;
    const plannedArr = trip.plannedArrivalTime
      ?? trip.plannedArrival
      ?? trip.arrivalTime
      ?? null;
    const adjustedDep = trip.adjustedDepartureTime ?? trip.adjustedDeparture ?? null;
    const adjustedArr = trip.adjustedArrivalTime ?? trip.adjustedArrival ?? null;
    const displayDep = adjustedDep ?? plannedDep;
    const displayArr = adjustedArr ?? plannedArr;
    const depLabel = formatTime(displayDep);
    const arrLabel = formatTime(displayArr);
    const plannedDepLabel = formatTime(plannedDep);
    const plannedArrLabel = formatTime(plannedArr);
    const depChanged = Boolean(adjustedDep && depLabel !== plannedDepLabel && plannedDepLabel !== "—");
    const arrChanged = Boolean(adjustedArr && arrLabel !== plannedArrLabel && plannedArrLabel !== "—");
    const hasAdjustedField = Boolean(adjustedDep || adjustedArr);
    const mins = pickDelayMinutes(trip);
    const active = isDelayActive(trip);
    return {
      displayDep,
      displayArr,
      plannedDep,
      plannedArr,
      depChanged,
      arrChanged,
      depLabel,
      arrLabel,
      plannedDepLabel,
      plannedArrLabel,
      hasAdjustedField,
      showDelayNote: hasAdjustedField || mins > 0 || active,
      delayMinutes: mins,
      delayActive: active,
    };
  }, [trip]);

  // JoinBoat + lắng nghe tripDelayUpdated khi mở chi tiết (bỏ qua chuyến đã hoàn thành).
  useEffect(() => {
    const boatId = String(
      boat.id || trip?.boatId || trip?.boat?.boatId || "",
    ).trim();
    if (!boatId) return undefined;
    if (statusKey === "Completed" || statusKey === "Cancelled") return undefined;

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
  }, [boat.id, trip?.boatId, trip?.boat?.boatId, statusKey]);

  const handleStartDelay = async () => {
    if (!trip?.tripId && !id) return;
    if (!showDelayStart || isDelayBusy) return;

    const tooEarly = getTripDelayTooEarlyMessage(trip, lang);
    if (tooEarly) {
      await notify({
        dialog: true,
        icon: "warning",
        title: lang === "VN" ? "Chưa đến giờ xuất phát" : "Before departure time",
        text: tooEarly,
        confirmButtonText: lang === "VN" ? "Đã hiểu" : "OK",
        confirmButtonColor: "#124757",
      });
      return;
    }

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
    if (tripGpsFinished) return null;
    const tripLoc = tracking?.latestLocation;
    if (tripLoc && isValidCoord(tripLoc.latitude, tripLoc.longitude)) {
      return { ...tripLoc, source: "trip", matched: Boolean(tracking?.hasLiveLocationForTrip) };
    }
    return null;
  }, [tracking, tripGpsFinished]);

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
      // Chỉ ép “điểm cuối” khi chuyến Completed — không đoán sớm theo trùng tên bến vòng.
      isTerminalStop: statusKey === "Completed",
      boat: liveLocation,
      suppress: shouldSuppressDwellCountdown(liveLocation),
    }),
    [liveLocation, lang, dwellTick, stops, statusKey],
  );

  // Open incident của tàu/chuyến này (REST + SignalR) — cùng nguồn với Live Tracking.
  const openIncident = useMemo(() => {
    if (!Array.isArray(openIncidents) || openIncidents.length === 0) return null;
    const tripId = String(trip?.tripId || id || "").trim();
    const boatId = String(boat?.id || trip?.boatId || "").trim();
    const boatCode = String(boat?.code || trip?.boatCode || "").trim().toUpperCase();

    const byTrip = tripId
      ? openIncidents.find((inc) => String(inc.tripId || "").trim() === tripId)
      : null;
    if (byTrip) return byTrip;

    return openIncidents.find((inc) => {
      if (boatId && String(inc.boatId || "").trim() === boatId) return true;
      if (boatCode && String(inc.boatCode || "").trim().toUpperCase() === boatCode) return true;
      return false;
    }) || null;
  }, [openIncidents, trip, boat, id]);

  const trackingIncidentFlag = Boolean(
    liveLocation?.activeIncident === true
    || tracking?.latestLocation?.activeIncident === true
    || tracking?.boat?.activeIncident === true
    || tracking?.raw?.activeIncident === true
    || tracking?.raw?.ActiveIncident === true,
  );
  const hasOpenIncident = Boolean(openIncident) || trackingIncidentFlag;

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
                {lang === "VN" ? "Đang dừng" : "Stopped"}
              </span>
            ) : null}
            {!delayActive && delayMinutes > 0 ? (
              <span className="inline-flex rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300">
                {lang === "VN" ? `Trễ ${delayMinutes} phút` : `Late ${delayMinutes} min`}
              </span>
            ) : null}
            {hasOpenIncident ? (
              <span className="inline-flex rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300">
                {lang === "VN" ? "Sự cố" : "Incident"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">
            {[
              trip?.routeCode,
              formatCustomerRouteTitle(trip?.routeName || trip?.route?.routeName, "", lang),
            ].filter(Boolean).join(" · ") || (lang === "VN" ? "Chi tiết chuyến" : "Trip detail")}
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
          {!showDelayStart && !showDelayResume && !delayActive && trip ? (
            (() => {
              const early = getTripDelayTooEarlyMessage(trip, lang);
              if (!early) return null;
              return (
                <p className="max-w-[16rem] text-right text-[10px] font-semibold leading-snug text-slate-400">
                  {early}
                </p>
              );
            })()
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

      {hasOpenIncident ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs dark:border-rose-500/30 dark:bg-rose-500/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="font-headline font-black uppercase tracking-wider text-rose-800 dark:text-rose-200">
                {lang === "VN" ? "Tàu đang có sự cố" : "Boat has an open incident"}
              </p>
              <p className="font-bold text-rose-900 dark:text-rose-100">
                {[
                  openIncident
                    ? getIncidentTypeLabel(openIncident.incidentType, lang)
                    : (lang === "VN" ? "Sự cố đang mở" : "Open incident"),
                  openIncident ? getSeverityLabel(openIncident.severity, lang) : null,
                  openIncident?.boatCode || boat?.code || trip?.boatCode || null,
                ].filter(Boolean).join(" · ")}
              </p>
              {openIncident?.description ? (
                <p className="text-[11px] font-medium text-rose-800/80 dark:text-rose-200/80 line-clamp-2">
                  {openIncident.description}
                </p>
              ) : null}
              {openIncident?.rescueBoatCode ? (
                <p className="text-[11px] font-bold text-rose-800 dark:text-rose-200">
                  {lang === "VN" ? "Tàu cứu hộ: " : "Rescue boat: "}
                  {openIncident.rescueBoatCode}
                </p>
              ) : null}
            </div>
            <Link
              to="/admin/incidents"
              className="shrink-0 text-[10px] font-headline font-black uppercase tracking-wider text-rose-700 underline dark:text-rose-300"
            >
              {lang === "VN" ? "Xem sự cố" : "View incidents"}
            </Link>
          </div>
        </div>
      ) : null}

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
                      <span className={scheduleDisplay.depChanged ? "text-amber-700 dark:text-amber-300" : undefined}>
                        {scheduleDisplay.depLabel}
                      </span>
                      <span className="mx-1.5 font-bold text-slate-300">→</span>
                      <span className={scheduleDisplay.arrChanged ? "text-amber-700 dark:text-amber-300" : undefined}>
                        {scheduleDisplay.arrLabel}
                      </span>
                    </p>
                    {scheduleDisplay.showDelayNote ? (
                      <div className="mt-1.5 space-y-0.5 border-t border-slate-200/80 pt-1.5 dark:border-slate-700/60">
                        {scheduleDisplay.hasAdjustedField ? (
                          <p className="text-[10px] font-semibold tabular-nums text-slate-400">
                            {lang === "VN" ? "Gốc" : "Original"}{" "}
                            {scheduleDisplay.plannedDepLabel}
                            <span className="mx-1 text-slate-300">→</span>
                            {scheduleDisplay.plannedArrLabel}
                          </p>
                        ) : null}
                        <p className="text-[10px] font-bold leading-snug text-amber-700 dark:text-amber-300">
                          {scheduleDisplay.depChanged || scheduleDisplay.arrChanged ? (
                            <>
                              {lang === "VN" ? "Đã đổi: " : "Changed: "}
                              {[
                                scheduleDisplay.depChanged
                                  ? (lang === "VN"
                                    ? `giờ đi ${scheduleDisplay.plannedDepLabel} → ${scheduleDisplay.depLabel}`
                                    : `depart ${scheduleDisplay.plannedDepLabel} → ${scheduleDisplay.depLabel}`)
                                  : null,
                                scheduleDisplay.arrChanged
                                  ? (lang === "VN"
                                    ? `giờ đến ${scheduleDisplay.plannedArrLabel} → ${scheduleDisplay.arrLabel}`
                                    : `arrive ${scheduleDisplay.plannedArrLabel} → ${scheduleDisplay.arrLabel}`)
                                  : null,
                              ].filter(Boolean).join(" · ")}
                            </>
                          ) : scheduleDisplay.delayActive ? (
                            lang === "VN" ? "Đang delay — giờ sẽ cập nhật khi tiếp tục" : "Delaying — times update on resume"
                          ) : (
                            lang === "VN" ? "Giờ đã điều chỉnh do delay" : "Times adjusted by delay"
                          )}
                          {scheduleDisplay.delayMinutes > 0
                            ? ` · ${lang === "VN" ? `trễ ${scheduleDisplay.delayMinutes}p` : `late ${scheduleDisplay.delayMinutes}m`}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3.5 py-3 dark:bg-slate-900/60">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {lang === "VN" ? "Hành khách" : "Passengers"}
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
                {statusKey !== "Completed" && statusKey !== "Cancelled" ? (
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
                ) : null}
              </div>
            </div>

            <TripRealRouteMap
              routeLine={routeLine}
              stations={routeStations}
              progress={routeProgress}
              liveLocation={liveLocation}
              showBoat={!tripGpsFinished}
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
              routeLabel={formatCustomerRouteTitle(
                routeMeta.routeName || trip?.routeName || trip?.route?.routeName || "",
                routeMeta.routeCode || trip?.routeCode || trip?.route?.routeCode || "",
                lang,
              ) || `${fromName} → ${toName}`}
              isMoving={isBoatMoving || (Boolean(liveLocation) && (statusKey === "InProgress" || statusKey === "Delayed"))}
              hasOpenIncident={hasOpenIncident}
              lang={lang}
            />

            {hasOpenIncident ? (
              <p className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 text-[11px] font-bold text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200 sm:px-5">
                {lang === "VN"
                  ? "Marker đỏ — tàu của chuyến đang có sự cố mở."
                  : "Red marker — this trip’s boat has an open incident."}
              </p>
            ) : null}

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

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Mã tàu" : "Boat code"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.code || "—"}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Tên tàu" : "Boat name"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.name || "—"}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Biển kiểm soát" : "Registration"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.registrationNumber || "—"}
                </div>
              </div>

              <div className="min-w-0 col-span-2 row-span-1 sm:col-span-1 sm:row-span-2 sm:col-start-4 sm:row-start-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Nhân viên" : "Staff"}
                </p>
                <div className="mt-1 space-y-0.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {onBoardCrewDisplay.length > 0 ? (
                    onBoardCrewDisplay.map((name) => (
                      <p key={name} className="break-words leading-snug">
                        {name}
                      </p>
                    ))
                  ) : (
                    <p>—</p>
                  )}
                </div>
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Loại dịch vụ" : "Service"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.serviceType || "—"}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Số tầng" : "Decks"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.numberOfDecks ?? "—"}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Tốc độ tối đa" : "Max speed"}
                </p>
                <div className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                  {boat.maxSpeedKmh != null ? `${boat.maxSpeedKmh} km/h` : "—"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
              <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? `Lịch trình (${stops.length} bến)` : `Itinerary (${stops.length} stations)`}
              </h3>
            </div>

            {stops.length === 0 ? (
              <p className="p-8 text-center text-xs font-medium text-slate-400">
                {lang === "VN" ? "Chuyến chưa có lịch trình bến." : "This trip has no station itinerary yet."}
              </p>
            ) : (
              <ol className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {stops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === lastStopIndex;
                  const sid = String(stop.stationId || stop.station?.stationId || "").trim();
                  const catalog = sid ? stationCatalogById.get(sid) : null;
                  // Stop chỉ còn stationId + stationName; mã/địa chỉ lấy từ GET stations.
                  const name = stop.stationName
                    || stop.station?.stationName
                    || catalog?.stationName
                    || catalog?.name
                    || "—";
                  const stopOpsBadge = resolveStopOpsBadge(stop, {
                    isFirst,
                    isLast,
                    tripStatusKey: statusKey,
                    lang,
                  });
                  const scheduledArr = isFirst ? null : (stop.scheduledArrival ?? null);
                  const scheduledDep = isLast ? null : (stop.scheduledDeparture ?? null);
                  const adjustedArr = isFirst
                    ? null
                    : (stop.adjustedArrival ?? stop.adjustedArrivalTime ?? null);
                  const adjustedDep = isLast
                    ? null
                    : (stop.adjustedDeparture ?? stop.adjustedDepartureTime ?? null);
                  // Bến đầu không dùng giờ đến (kể cả actualArrival BE gửi nhầm).
                  // Bến cuối không dùng giờ đi.
                  const actualArr = isFirst ? null : (stop.actualArrival ?? null);
                  const actualDep = isLast ? null : (stop.actualDeparture ?? null);
                  const onboard = toCount(stop.onboardPassengerCount);
                  const boarding = toCount(stop.boardingPassengerCount) ?? 0;
                  const alighting = toCount(stop.alightingPassengerCount);

                  return (
                    <li key={stop.tripStopId || `${stop.stopOrder}-${stop.stationId || index}`} className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
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
                            </p>
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
                          adjustedArr={adjustedArr}
                          adjustedDep={adjustedDep}
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
