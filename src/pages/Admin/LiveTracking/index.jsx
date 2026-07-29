import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Ship } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { useLiveBoatTracking } from "../../../hooks/useLiveBoatTracking";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
import { useOperationsSchedule } from "../../../hooks/useOperationsSchedule";
import { fetchAllStations } from "../../../services/stationService";
import { fetchAllBoats } from "../../../services/boatService";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  reportIncident,
} from "../../../services/incidentService";
import { fetchAllTrips, normalizeTripStatusKey, pickActiveTripForBoat, toOperatingDateQuery } from "../../../services/tripService";
import { trackingHub } from "../../../services/trackingHubClient";
import { getBoatImageUrl } from "../../../utils/charterBookingAdmin";
import { isBoatEligibleForLiveMap, isBoatUnderMaintenance, resolveBoatNumberOfDecks, resolveBoatServiceType, formatDwellCountdownNotice, shouldSuppressDwellCountdown, MOVING_SPEED_KMH } from "../../../utils/boatTracking";
import { geometryToCoordinates } from "../../../utils/charterRouteMap";
import { buildBoatSituations, getBoatStatusTag, NOTICE_FLASH_MS_EXPORT, resolveEtaMinutesToNext } from "../../../utils/boatSituation";
import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { notify, showToast } from "../../../utils/swalToast";
import {
  formatActiveDelayLine,
  isDelayActive,
} from "../../../utils/tripDelay";

const formatRelative = (value, lang) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 20) return lang === "VN" ? "Vừa xong" : "Just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === "VN" ? `${minutes} phút` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return lang === "VN" ? `${hours} giờ` : `${hours}h`;
};

const modeChip = (mode, lang) => {
  if (mode === "live") {
    return {
      label: "Live",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25",
      dot: "bg-emerald-500 animate-pulse",
    };
  }
  if (mode === "polling") {
    return {
      label: lang === "VN" ? "Đồng bộ" : "Sync",
      className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25",
      dot: "bg-amber-500",
    };
  }
  if (mode === "loading") {
    return {
      label: lang === "VN" ? "Tải…" : "Load…",
      className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600",
      dot: "bg-slate-400 animate-pulse",
    };
  }
  return {
    label: "Offline",
    className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25",
    dot: "bg-rose-500",
  };
};

/** Tag chữ màu kiểu bảng chuyến bay (Remarks). */
const boardTagClass = (tone) => {
  switch (tone) {
    case "incident":
      return "text-rose-500";
    case "rescue":
      return "text-amber-600 dark:text-amber-400";
    case "delayed":
      return "text-amber-500";
    case "boarding":
      return "text-sky-500";
    case "active":
      return "text-emerald-500";
    case "offline":
    default:
      return "text-slate-400";
  }
};

const formatDistance = (meters, lang) => {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return lang === "VN"
    ? `${(meters / 1000).toFixed(1)} km`
    : `${(meters / 1000).toFixed(1)} km`;
};

export function LiveTracking({ viewTabs = null } = {}) {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  // BE: Admin / Manager / Staff được báo sự cố.
  const canReportIncident = isAdminUser(user) || isManagerUser(user) || isStaffUser(user);
  const { boats, connectionMode, errorMsg, isInitialLoading, refresh } = useLiveBoatTracking({ enabled: true });
  const { openBoatIds, incidents: openIncidents, refresh: refreshIncidents } = useLiveIncidents({
    enabled: true,
    toast: true,
  });
  const {
    byBoatKey: opsByBoatKey,
    refresh: refreshOpsSchedule,
    lastTripStop,
  } = useOperationsSchedule({ enabled: true });
  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [focusSolo, setFocusSolo] = useState(() => String(searchParams.get("focus") || "") === "1");
  const [focusRouteId, setFocusRouteId] = useState(() => String(searchParams.get("routeId") || "").trim());
  const [focusRouteCode, setFocusRouteCode] = useState(() => String(searchParams.get("routeCode") || "").trim());
  const [focusView, setFocusView] = useState(null);
  const [query, setQuery] = useState("");
  const [fleetCollapsed, setFleetCollapsed] = useState(true);
  const [situationCollapsed, setSituationCollapsed] = useState(true);
  const [stations, setStations] = useState([]);
  const [boatCatalogByKey, setBoatCatalogByKey] = useState(() => new Map());
  const [todayTrips, setTodayTrips] = useState([]);
  const [routeOverlays, setRouteOverlays] = useState([]);
  const [tick, setTick] = useState(() => Date.now());
  const [showReport, setShowReport] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportForm, setReportForm] = useState({
    boatId: "",
    tripId: "",
    tripCode: "",
    incidentType: "MechanicalFailure",
    severity: "High",
    description: "",
  });
  const arrivedAtRef = useRef(new Map());
  const lastTripStopToastKeyRef = useRef("");
  const flashTimersRef = useRef(new Map());
  const [flashByBoatKey, setFlashByBoatKey] = useState(() => new Map());
  const chip = modeChip(connectionMode, lang);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Flash ngắn trên tàu khi tripStopUpdated; hết hạn thì ẩn, event mới → hiện lại.
  useEffect(() => {
    if (!lastTripStop?.event) return;
    const boatKey = String(lastTripStop.boatCode || lastTripStop.boatId || "").trim();
    if (!boatKey) return;

    const eventKey = `${boatKey}|${lastTripStop.event}|${lastTripStop.occurredAt}`;
    const station = lastTripStop.stationName || lastTripStop.stationCode || "";
    const boat = lastTripStop.boatCode || "";
    const ev = String(lastTripStop.event).toLowerCase();

    const schedule = opsByBoatKey.get(String(lastTripStop.boatId || ""))
      || opsByBoatKey.get(boatKey)
      || opsByBoatKey.get(boatKey.toUpperCase())
      || null;
    const eta = resolveEtaMinutesToNext({
      remainingMinutesToNextStation: schedule?.remainingMinutesToNextStation,
      remainingDistanceKmToNextStation: schedule?.remainingDistanceKmToNextStation,
      speed: schedule?.latestSpeedKmh,
    });

    let noticeVn = "";
    let noticeEn = "";
    if (ev === "arriving") {
      // Chỉ nói "sắp cập" khi ETA ≤ 2 phút (hoặc không biết ETA).
      if (eta != null && eta > 2) {
        noticeVn = station
          ? `Tàu đang di chuyển tới ${station}, còn ${eta} phút`
          : `Tàu đang di chuyển, còn ${eta} phút`;
        noticeEn = station
          ? `Moving to ${station}, ${eta} min left`
          : `Moving, ${eta} min left`;
      } else {
        noticeVn = station ? `Tàu sắp cập ${station}` : "Tàu sắp cập bến";
        noticeEn = station ? `About to dock at ${station}` : "About to dock";
      }
    } else if (ev === "arrived") {
      noticeVn = station ? `Đã cập bến ${station}` : "Đã cập bến";
      noticeEn = station ? `Arrived at ${station}` : "Arrived";
    } else if (ev === "departed") {
      noticeVn = station ? `Đã rời bến ${station}` : "Đã rời bến";
      noticeEn = station ? `Departed ${station}` : "Departed";
    }
    if (!noticeVn) return;

    const flash = {
      eventKey,
      event: lastTripStop.event,
      noticeVn,
      noticeEn,
      stationName: station,
      shownAt: Date.now(),
    };

    setFlashByBoatKey((prev) => {
      const next = new Map(prev);
      next.set(boatKey.toUpperCase(), flash);
      if (lastTripStop.boatId) next.set(String(lastTripStop.boatId), flash);
      return next;
    });

    const clearKeys = [boatKey.toUpperCase(), String(lastTripStop.boatId || "")].filter(Boolean);
    clearKeys.forEach((k) => {
      const old = flashTimersRef.current.get(k);
      if (old) window.clearTimeout(old);
    });
    const timer = window.setTimeout(() => {
      setFlashByBoatKey((prev) => {
        const next = new Map(prev);
        clearKeys.forEach((k) => next.delete(k));
        return next;
      });
      clearKeys.forEach((k) => flashTimersRef.current.delete(k));
    }, NOTICE_FLASH_MS_EXPORT);
    clearKeys.forEach((k) => flashTimersRef.current.set(k, timer));

    if (eventKey !== lastTripStopToastKeyRef.current) {
      lastTripStopToastKeyRef.current = eventKey;
      showToast({
        icon: "info",
        title: lang === "VN" ? `${boat} · ${noticeVn}`.trim() : `${boat} · ${noticeEn}`.trim(),
      });
      setSituationCollapsed(false);
    }

    return () => {
      // không clear timer ở đây — để flash tự hết hạn
    };
  }, [lastTripStop, lang, opsByBoatKey]);

  useEffect(() => () => {
    flashTimersRef.current.forEach((t) => window.clearTimeout(t));
    flashTimersRef.current.clear();
  }, []);

  useEffect(() => {
    let active = true;
    fetchAllStations()
      .then((data) => {
        if (!active) return;
        setStations(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to load stations for live tracking:", error);
      });

    fetchAllBoats()
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        const next = new Map();
        list.forEach((item) => {
          if (!item) return;
          const seatCount = Number(item.seatCount ?? item.SeatCount);
          const meta = {
            imageUrl: getBoatImageUrl(item),
            seatCount: Number.isFinite(seatCount) && seatCount >= 0 ? seatCount : null,
            boatName: item.boatName || item.name || item.BoatName || "",
            boatCode: String(item.boatCode || item.code || item.BoatCode || "").trim(),
            boatId: String(item.boatId || item.id || item.BoatId || "").trim(),
            operationalStatus: item.status || item.Status || "",
            numberOfDecks: resolveBoatNumberOfDecks(item, 1),
            seatSetupType: item.seatSetupType || item.SeatSetupType || "",
            serviceType: resolveBoatServiceType(item, "Passenger"),
          };
          const id = meta.boatId;
          const code = meta.boatCode;
          if (id) next.set(id, meta);
          if (code) {
            next.set(code, meta);
            next.set(code.toUpperCase(), meta);
          }
        });
        setBoatCatalogByKey(next);
      })
      .catch((error) => {
        console.error("Failed to load boat catalog for live tracking:", error);
      });

    const todayYmd = (() => {
      const now = new Date();
      const pad2 = (n) => String(n).padStart(2, "0");
      return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    })();
    fetchAllTrips({ operatingDate: toOperatingDateQuery(todayYmd) })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : (data?.items || data?.data || []);
        setTodayTrips(list);
      })
      .catch((error) => {
        console.error("Failed to load trips for live tracking:", error);
      });

    (async () => {
      try {
        const list = await fetchAllRoutes();
        if (!active) return;
        const routes = (Array.isArray(list) ? list : [])
          .filter((route) => {
            const status = String(route?.status || "Active").toLowerCase();
            return status === "active" || status === "";
          });

        const details = await Promise.all(
          routes.map((route) =>
            fetchRouteDetail(route.routeId || route.id).catch((error) => {
              console.warn("Failed to load route geometry:", route.routeCode || route.routeId, error);
              return null;
            }),
          ),
        );
        if (!active) return;

        const overlays = details
          .filter(Boolean)
          .map((detail) => {
            const rawDetail = detail?.data && typeof detail.data === "object" && !Array.isArray(detail.data)
              ? detail.data
              : detail;
            const coords = geometryToCoordinates(
              rawDetail.routeGeometry
              ?? rawDetail.geometry
              ?? rawDetail.path
              ?? rawDetail.coordinates,
            );
            const positions = coords
              .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
              .map((point) => [point.latitude, point.longitude]);
            if (positions.length < 2) return null;

            const stops = Array.isArray(rawDetail.stops)
              ? rawDetail.stops
              : (Array.isArray(rawDetail.routeStops) ? rawDetail.routeStops : []);
            const stopStationIds = new Set(
              stops
                .map((s) => String(s?.stationId || s?.station?.stationId || "").trim())
                .filter(Boolean),
            );
            const stopStationCodes = new Set(
              stops
                .map((s) => String(s?.stationCode || s?.station?.stationCode || "").trim().toUpperCase())
                .filter(Boolean),
            );

            return {
              id: rawDetail.routeId || rawDetail.routeCode,
              routeId: rawDetail.routeId || rawDetail.id || "",
              routeCode: rawDetail.routeCode || "",
              label: rawDetail.routeCode || rawDetail.routeName || "",
              positions,
              stopStationIds,
              stopStationCodes,
              pointCount: positions.length,
            };
          })
          .filter(Boolean);

        setRouteOverlays(overlays);
      } catch (error) {
        console.error("Failed to load routes for live tracking:", error);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const rescueMissionByKey = useMemo(() => {
    const resolveCode = (id, code) => {
      const rawCode = String(code || "").trim();
      if (rawCode) return rawCode;
      const rawId = String(id || "").trim();
      if (!rawId) return "";
      const meta = boatCatalogByKey.get(rawId) || boatCatalogByKey.get(rawId.toUpperCase());
      if (meta?.boatCode) return String(meta.boatCode).trim();
      return rawId;
    };

    const map = new Map();
    openIncidents.forEach((incident) => {
      const targetId = String(incident.boatId || "").trim();
      const rescueId = String(incident.rescueBoatId || "").trim();
      const replacementId = String(incident.replacementBoatId || "").trim();
      const targetCode = resolveCode(targetId, incident.boatCode);
      const rescueCode = resolveCode(rescueId, incident.rescueBoatCode);
      const replacementCode = resolveCode(replacementId, incident.replacementBoatCode);
      if (!rescueId && !rescueCode) return;

      const put = (key, value) => {
        if (!key) return;
        map.set(key, value);
        map.set(String(key).toUpperCase(), value);
      };

      const rescueInfo = {
        role: "rescue",
        targetCode,
        targetId,
        rescueCode,
        incidentId: incident.incidentId,
      };
      put(rescueId, rescueInfo);
      put(rescueCode, rescueInfo);

      const targetInfo = {
        role: "incident",
        rescueCode,
        rescueId,
        targetCode,
        incidentId: incident.incidentId,
      };
      put(targetId, targetInfo);
      put(targetCode, targetInfo);

      if (replacementId || replacementCode) {
        const replacementInfo = {
          role: "replacement",
          targetCode,
          rescueCode,
          incidentId: incident.incidentId,
        };
        put(replacementId, replacementInfo);
        put(replacementCode, replacementInfo);
      }
    });
    return map;
  }, [openIncidents, boatCatalogByKey]);

  const enrichedBoats = useMemo(
    () => boats
      .map((boat) => {
        const codeKey = String(boat.boatCode || "").trim();
        const idKey = String(boat.boatId || "").trim();
        const meta = boatCatalogByKey.get(idKey)
          || boatCatalogByKey.get(codeKey)
          || boatCatalogByKey.get(codeKey.toUpperCase())
          || null;
        const schedule = opsByBoatKey.get(idKey)
          || opsByBoatKey.get(codeKey)
          || opsByBoatKey.get(codeKey.toUpperCase())
          || null;
        const hasOpenIncident = openBoatIds.has(idKey)
          || openBoatIds.has(codeKey)
          || openBoatIds.has(codeKey.toUpperCase())
          // GPS flag chỉ bổ sung khi tàu chưa bảo trì (tránh SỰ CỐ giả sau khi đã Resolved).
          || (boat.activeIncident === true && !isBoatUnderMaintenance({
            operationalStatus: boat.boatStatus || boat.operationalStatus || meta?.operationalStatus || "",
          }));
        const opsFromTracking = boat.boatStatus || boat.operationalStatus || "";
        const numberOfDecks = resolveBoatNumberOfDecks(meta || boat, 1);
        const serviceType = resolveBoatServiceType(meta || boat, "Passenger");
        let mission = rescueMissionByKey.get(idKey)
          || rescueMissionByKey.get(codeKey)
          || rescueMissionByKey.get(codeKey.toUpperCase())
          || null;
        // Nhiệm vụ cứu chỉ hiện khi tàu đích vẫn còn trong Open incidents.
        if (mission?.role === "rescue") {
          const targetOk = (mission.targetId && openBoatIds.has(String(mission.targetId)))
            || (mission.targetCode && (
              openBoatIds.has(String(mission.targetCode))
              || openBoatIds.has(String(mission.targetCode).toUpperCase())
            ));
          if (!targetOk) mission = null;
        }
        if (mission?.role === "incident" && !hasOpenIncident) {
          mission = null;
        }

        // Marker từ tracking GPS. Có lat/lng tracking → luôn vẽ (không để ops schedule ẩn).
        const trackingLat = Number(boat.latitude);
        const trackingLng = Number(boat.longitude);
        const hasTrackingPos = Number.isFinite(trackingLat) && Number.isFinite(trackingLng);

        const latitude = hasTrackingPos ? trackingLat : NaN;
        const longitude = hasTrackingPos ? trackingLng : NaN;
        const hasLiveCoords = hasTrackingPos;

        const resolvedTrip = (schedule?.tripId || boat.tripId)
          ? todayTrips.find((t) => String(t.tripId || t.id) === String(schedule?.tripId || boat.tripId))
          : pickActiveTripForBoat(todayTrips, boat);

        // Chuyến hoàn thành/hủy: chỉ hiện vị trí cuối — không coi là GPS live.
        const tripStatusKey = normalizeTripStatusKey(
          resolvedTrip?.tripStatus
          || resolvedTrip?.status
          || schedule?.tripStatus
          || boat.tripStatus
          || schedule?.operationStatus
          || boat.operationStatus,
        );
        const tripFinished = tripStatusKey === "Completed" || tripStatusKey === "Cancelled";

        let isGpsOnline = false;
        let showLiveGps = false;
        let acceptLiveGps = false;
        if (hasLiveCoords) {
          // Có toạ độ → vẫn vẽ marker (kể cả chuyến đã xong — chỉ hiển thị).
          showLiveGps = true;
          if (tripFinished) {
            isGpsOnline = false;
            acceptLiveGps = false;
          } else if (schedule?.isGpsOnline === true || boat.isOnline === true) {
            isGpsOnline = true;
            acceptLiveGps = true;
          } else if (schedule?.isGpsOnline === false && boat.isOnline === false) {
            isGpsOnline = false;
            acceptLiveGps = false;
          } else if (boat.isOnline === false) {
            isGpsOnline = false;
            acceptLiveGps = false;
          } else {
            isGpsOnline = true;
            acceptLiveGps = true;
          }
        }

        const base = meta
          ? {
            ...boat,
            imageUrl: boat.imageUrl || meta.imageUrl,
            seatCount: boat.seatCount ?? meta.seatCount,
            boatName: boat.boatName || meta.boatName || schedule?.boatName,
            numberOfDecks,
            seatSetupType: meta.seatSetupType || boat.seatSetupType,
            serviceType,
            operationalStatus: opsFromTracking || meta.operationalStatus || "",
          }
          : {
            ...boat,
            boatName: boat.boatName || schedule?.boatName,
            numberOfDecks,
            serviceType,
            operationalStatus: opsFromTracking || boat.operationalStatus || "",
          };

        const flash = flashByBoatKey.get(String(codeKey).toUpperCase())
          || flashByBoatKey.get(String(idKey))
          || null;

        const rawDwellCountdown = tripFinished
          ? null
          : (boat.dwellCountdown || schedule?.dwellCountdown || null);
        const speedForDwell = (() => {
          const fromTrack = Number(boat.speed);
          if (Number.isFinite(fromTrack)) return fromTrack;
          const fromSched = Number(schedule?.latestSpeedKmh);
          return Number.isFinite(fromSched) ? fromSched : null;
        })();
        const dwellSource = {
          ...boat,
          speed: speedForDwell,
          movementStatus: boat.movementStatus || schedule?.movementStatus,
          remainingDistanceKmToNextStation:
            boat.remainingDistanceKmToNextStation ?? schedule?.remainingDistanceKmToNextStation,
          lastStopEvent: boat.lastStopEvent || schedule?.lastStopEvent,
        };
        const dwellCountdown = rawDwellCountdown && !shouldSuppressDwellCountdown(dwellSource)
          ? rawDwellCountdown
          : null;

        const toPassengerCount = (value) => {
          if (value === null || value === undefined || value === "") return null;
          const n = Number(value);
          return Number.isFinite(n) && n >= 0 ? n : null;
        };
        // Chỉ đếm khách đang trên tàu (đã check-in, chưa check-out) — không dùng totalPassengerCount (vé đã bán gồm checkout).
        const lastStopOnboard = (() => {
          const stops = Array.isArray(resolvedTrip?.stops) ? resolvedTrip.stops : [];
          if (!stops.length) return null;
          const sorted = [...stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0));
          for (let i = sorted.length - 1; i >= 0; i -= 1) {
            const n = toPassengerCount(sorted[i]?.onboardPassengerCount);
            if (n != null) return n;
          }
          return null;
        })();
        const passengerCount = toPassengerCount(schedule?.onboardPassengerCount)
          ?? toPassengerCount(boat.onboardPassengerCount)
          ?? toPassengerCount(boat.passengerCount)
          ?? lastStopOnboard
          ?? toPassengerCount(resolvedTrip?.onboardPassengerCount)
          ?? toPassengerCount(schedule?.checkedInPassengerCount)
          ?? toPassengerCount(resolvedTrip?.checkedInPassengerCount)
          ?? toPassengerCount(schedule?.passengerCount);

        const dwellNotice = formatDwellCountdownNotice(dwellCountdown, lang, tick, {
          stops: resolvedTrip?.stops,
          boat: dwellSource,
        });

        return {
          ...base,
          latitude: hasLiveCoords ? latitude : boat.latitude,
          longitude: hasLiveCoords ? longitude : boat.longitude,
          seatCount: base.seatCount ?? resolvedTrip?.capacitySnapshot ?? null,
          passengerCount,
          dwellCountdown,
          dwellNotice,
          tripStops: Array.isArray(resolvedTrip?.stops) ? resolvedTrip.stops : [],
          speed: (() => {
            if (tripFinished) return 0;
            if (Number.isFinite(speedForDwell) && speedForDwell > 0) return speedForDwell;
            return Number.isFinite(speedForDwell) ? speedForDwell : null;
          })(),
          isOnline: isGpsOnline === true,
          isGpsOnline: isGpsOnline === true,
          showLiveGps,
          acceptLiveGps: acceptLiveGps === true,
          tripFinished,
          tripStatusKey: tripStatusKey || null,
          movementStatus: (() => {
            if (tripFinished) return "Completed";
            const sched = String(schedule?.movementStatus || "").trim();
            const track = String(boat.movementStatus || "").trim();
            const schedKey = sched.toLowerCase().replace(/[_\s-]/g, "");
            const trackKey = track.toLowerCase().replace(/[_\s-]/g, "");
            const speed = Number(boat.speed ?? speedForDwell);
            const stopped = !Number.isFinite(speed) || speed < MOVING_SPEED_KMH;
            const km = Number(boat.remainingDistanceKmToNextStation);
            const eta = Number(boat.remainingMinutesToNextStation);
            const stillFar = (Number.isFinite(km) && km > 0.15)
              || (Number.isFinite(eta) && eta > 1);

            // GPS đang chạy: không để schedule AtStation sticky đè “đang chạy”.
            if (!stopped && (schedKey === "atstation" || trackKey === "atstation" || trackKey === "arrived")) {
              if (stillFar || speed >= MOVING_SPEED_KMH) {
                return trackKey === "arriving" ? (track || "Arriving") : (track || "Moving");
              }
            }

            // Đã cập: AtStation / Arrived khi thật sự dừng gần bến
            if (stopped && (schedKey === "atstation" || trackKey === "atstation" || trackKey === "arrived")) {
              return sched || track || "AtStation";
            }
            if (stopped && Number.isFinite(km) && km <= 0.08) {
              return "AtStation";
            }
            if (schedKey === "boarding" || schedKey === "scheduled" || trackKey === "boarding") {
              return sched || track || "Boarding";
            }
            // GPS 0 km/h + có trip → chờ xuất (đừng gắn Moving)
            if (stopped && (boat.tripId || boat.tripCode || schedule?.tripId || resolvedTrip?.tripId) && !trackKey && schedKey !== "arriving") {
              return sched || "Boarding";
            }
            if (stillFar && (schedKey === "arriving" || schedKey === "atstation") && !stopped) {
              return track || "Moving";
            }
            return sched || track || null;
          })(),
          tripId: schedule?.tripId || boat.tripId || resolvedTrip?.tripId || null,
          tripCode: schedule?.tripCode || boat.tripCode || resolvedTrip?.tripCode || null,
          routeName: schedule?.routeName || boat.routeName || null,
          currentStationName: schedule?.currentStationName ?? boat.currentStationName ?? null,
          currentStationCode: schedule?.currentStationCode || boat.currentStationCode || null,
          // Tracking GPS = nguồn ETA/bến kế
          nextStationId: boat.nextStationId || schedule?.nextStationId || null,
          nextStationName: boat.nextStationName || schedule?.nextStationName || null,
          nextStationCode: boat.nextStationCode || schedule?.nextStationCode || null,
          lastStopEvent: (() => {
            const stop = schedule?.lastStopEvent || boat.lastStopEvent || flash?.event || null;
            const move = String(schedule?.movementStatus || boat.movementStatus || "")
              .trim()
              .toLowerCase()
              .replace(/[_\s-]/g, "");
            const stopKey = String(stop || "").trim().toLowerCase();
            const moveKey = move;
            const km = Number(boat.remainingDistanceKmToNextStation);
            const eta = Number(boat.remainingMinutesToNextStation);
            const speed = Number(boat.speed);
            const stopped = !Number.isFinite(speed) || speed < 1.2;
            const docked = moveKey === "atstation"
              || (stopped && Number.isFinite(km) && km <= 0.08);
            if (docked && (stopKey === "arriving" || stopKey === "departed") && !flash) {
              return "arrived";
            }
            // Đang chạy (speed/status) → luôn bỏ sticky Departed/Arrived
            const enRouteGps = !stopped
              || move === "moving"
              || move === "arriving"
              || move === "delayed"
              || String(boat.status || "").toLowerCase() === "moving";
            if (
              enRouteGps
              && (stopKey === "departed" || stopKey === "arrived")
              && !flash
            ) {
              return null;
            }
            const stillFar = (Number.isFinite(km) && km > 0.4)
              || (Number.isFinite(eta) && eta > 2);
            if (
              (move === "moving" || move === "arriving" || move === "delayed" || stillFar)
              && (stopKey === "departed" || stopKey === "arrived")
              && !flash
            ) {
              return null;
            }
            return stop;
          })(),
          flashNotice: dwellNotice
            || (flash
              ? (lang === "VN" ? flash.noticeVn : flash.noticeEn)
              : null),
          flashNoticeTone: dwellNotice
            ? "arrived"
            : flash
              ? (String(flash.event).toLowerCase() === "departed"
                ? "departed"
                : String(flash.event).toLowerCase() === "arrived"
                  ? "arrived"
                  : "arriving")
              : null,
          remainingDistanceKmToNextStation: (() => {
            const fromTrack = Number(boat.remainingDistanceKmToNextStation);
            const fromSched = Number(schedule?.remainingDistanceKmToNextStation);
            const speed = Number(boat.speed ?? schedule?.latestSpeedKmh);
            const moving = Number.isFinite(speed) && speed >= MOVING_SPEED_KMH;
            if (Number.isFinite(fromTrack) && fromTrack > 0) return fromTrack;
            // Track gửi 0km nhưng schedule còn xa / đang chạy → đừng tin 0 (tránh <1p sau F5)
            if (Number.isFinite(fromTrack) && fromTrack === 0) {
              if (Number.isFinite(fromSched) && fromSched > 0.15) return fromSched;
              if (moving && Number.isFinite(fromSched) && fromSched > 0) return fromSched;
              if (moving) return null;
              return 0;
            }
            if (Number.isFinite(fromSched) && fromSched > 0) return fromSched;
            if (Number.isFinite(fromSched) && fromSched === 0 && !moving) return 0;
            return null;
          })(),
          remainingMinutesToNextStation: (() => {
            const fromTrack = Number(boat.remainingMinutesToNextStation);
            const fromSched = Number(schedule?.remainingMinutesToNextStation);
            const fromTrackKm = Number(boat.remainingDistanceKmToNextStation);
            const fromSchedKm = Number(schedule?.remainingDistanceKmToNextStation);
            const speed = Number(boat.speed ?? schedule?.latestSpeedKmh);
            const moving = Number.isFinite(speed) && speed >= MOVING_SPEED_KMH;

            // Resolve km giống field remainingDistanceKmToNextStation (tránh dùng km thô = 0)
            let km = null;
            if (Number.isFinite(fromTrackKm) && fromTrackKm > 0) km = fromTrackKm;
            else if (Number.isFinite(fromTrackKm) && fromTrackKm === 0) {
              if (Number.isFinite(fromSchedKm) && fromSchedKm > 0.15) km = fromSchedKm;
              else if (moving && Number.isFinite(fromSchedKm) && fromSchedKm > 0) km = fromSchedKm;
              else if (!moving) km = 0;
            } else if (Number.isFinite(fromSchedKm) && fromSchedKm > 0) km = fromSchedKm;
            else if (Number.isFinite(fromSchedKm) && fromSchedKm === 0 && !moving) km = 0;

            let seedMin = null;
            if (Number.isFinite(fromTrack) && fromTrack > 0) seedMin = fromTrack;
            else if (Number.isFinite(fromTrack) && fromTrack === 0) {
              seedMin = (Number.isFinite(fromSched) && fromSched > 0) ? fromSched : 0;
            } else if (Number.isFinite(fromSched) && fromSched >= 0) seedMin = fromSched;

            return resolveEtaMinutesToNext({
              speed,
              remainingDistanceKmToNextStation: km,
              remainingMinutesToNextStation: seedMin,
            });
          })(),
          scheduledDepartureAt: schedule?.scheduledDepartureAt || boat.scheduledDepartureAt || null,
          minutesUntilDeparture: schedule?.minutesUntilDeparture ?? boat.minutesUntilDeparture ?? null,
          delayMinutes: (() => {
            const n = Number(schedule?.delayMinutes ?? boat.delayMinutes);
            return Number.isFinite(n) ? n : null;
          })(),
          delayReason: schedule?.delayReason || boat.delayReason || null,
          isDelayActive: Boolean(schedule?.isDelayActive ?? boat.isDelayActive),
          delayStartedAt: schedule?.delayStartedAt || boat.delayStartedAt || null,
          adjustedStartAt: schedule?.adjustedStartAt || boat.adjustedStartAt || null,
          adjustedEndAt: schedule?.adjustedEndAt || boat.adjustedEndAt || null,
          displayStartAt: schedule?.displayStartAt
            || schedule?.adjustedStartAt
            || schedule?.startAt
            || schedule?.scheduledDepartureAt
            || boat.adjustedStartAt
            || boat.scheduledDepartureAt
            || null,
          displayEndAt: schedule?.displayEndAt
            || schedule?.adjustedEndAt
            || schedule?.endAt
            || boat.adjustedEndAt
            || null,
          serviceType: schedule?.serviceType || boat.serviceType || null,
          sellsBySegment: schedule?.sellsBySegment ?? boat.sellsBySegment ?? null,
          capacitySnapshot: schedule?.capacitySnapshot
            ?? boat.capacitySnapshot
            ?? resolvedTrip?.capacitySnapshot
            ?? null,
          totalPassengerCount: schedule?.totalPassengerCount
            ?? resolvedTrip?.totalPassengerCount
            ?? null,
          operationStatus: schedule?.operationStatus || boat.operationStatus || null,
          hasOpenIncident,
          activeIncident: hasOpenIncident || boat.activeIncident === true,
          rescueMission: mission,
          rescuingBoatCode: mission?.role === "rescue" ? (mission.targetCode || "") : "",
          rescuedByBoatCode: mission?.role === "incident" ? (mission.rescueCode || "") : "",
        };
      })
      .filter(isBoatEligibleForLiveMap),
    [boats, boatCatalogByKey, openBoatIds, opsByBoatKey, rescueMissionByKey, flashByBoatKey, todayTrips, lang, tick],
  );

  // Chỉ vẽ theo GPS BE — không snap / không tự nhảy sang bến gần nhất.
  // Focus từ Trip Detail: chỉ hiện 1 tàu đang xem.
  const mapBoats = useMemo(() => {
    const live = enrichedBoats.filter((boat) => boat.showLiveGps === true);
    // Tàu đang chọn (bảo trì / offline) vẫn hiện marker nếu còn tọa độ.
    if (selectedBoatId) {
      const selected = enrichedBoats.find((b) => String(b.boatId) === String(selectedBoatId));
      if (
        selected
        && Number.isFinite(Number(selected.latitude))
        && Number.isFinite(Number(selected.longitude))
        && !live.some((b) => String(b.boatId) === String(selected.boatId))
      ) {
        live.push(selected);
      }
    }
    if (!focusSolo) return live;

    const boatIdParam = String(searchParams.get("boatId") || "").trim();
    const boatCodeParam = String(searchParams.get("boatCode") || "").trim().toUpperCase();
    const selected = selectedBoatId
      ? enrichedBoats.find((b) => String(b.boatId) === String(selectedBoatId))
      : null;
    const targetId = String(selected?.boatId || selectedBoatId || boatIdParam || "").trim();
    const targetCode = String(selected?.boatCode || boatCodeParam || "").trim().toUpperCase();

    return live.filter((boat) => {
      if (targetId && String(boat.boatId) === targetId) return true;
      if (targetCode && String(boat.boatCode || "").trim().toUpperCase() === targetCode) return true;
      return false;
    });
  }, [enrichedBoats, focusSolo, selectedBoatId, searchParams]);

  const mapRouteOverlays = useMemo(() => {
    if (!focusSolo) {
      return routeOverlays.map((route) => ({ ...route, emphasis: "muted" }));
    }
    const rid = String(focusRouteId || "").trim().toUpperCase();
    const rcode = String(focusRouteCode || "").trim().toUpperCase();
    const matched = routeOverlays.filter((route) => {
      const id = String(route.routeId || route.id || "").trim().toUpperCase();
      const code = String(route.routeCode || route.label || "").trim().toUpperCase();
      return (rid && (id === rid || code === rid))
        || (rcode && (code === rcode || id === rcode || code.endsWith(rcode) || rcode.endsWith(code)));
    });
    // Chỉ vẽ tuyến đang xem — xanh nổi; ẩn các tuyến khác (tránh chồng segment GPS ngắn).
    if (matched.length > 0) {
      return matched.map((route) => ({ ...route, emphasis: "active" }));
    }
    return routeOverlays.map((route) => ({ ...route, emphasis: "muted" }));
  }, [routeOverlays, focusSolo, focusRouteId, focusRouteCode]);

  /** Đường GPS đã vẽ của tuyến đang focus — truyền vào `coordinates` (không nối bến). */
  const focusedRouteCoordinates = useMemo(() => {
    if (!focusSolo) return [];
    const active = mapRouteOverlays.find((route) => route.emphasis === "active");
    if (!active?.positions?.length) return [];
    return active.positions
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lat, lng]) => ({ latitude: Number(lat), longitude: Number(lng) }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [focusSolo, mapRouteOverlays]);

  const mapStations = useMemo(() => {
    if (!focusSolo) return stations;
    const active = mapRouteOverlays.find((route) => route.emphasis === "active");
    if (!active) return stations;
    const ids = active.stopStationIds;
    const codes = active.stopStationCodes;
    if ((!ids || ids.size === 0) && (!codes || codes.size === 0)) return stations;
    return stations.filter((station) => {
      const id = String(station.stationId || station.id || "").trim();
      const code = String(station.stationCode || station.code || "").trim().toUpperCase();
      if (id && ids?.has(id)) return true;
      if (code && codes?.has(code)) return true;
      return false;
    });
  }, [focusSolo, mapRouteOverlays, stations]);

  const exitFocusSolo = () => {
    setFocusSolo(false);
    setFocusRouteId("");
    setFocusRouteCode("");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("focus");
      next.delete("boatId");
      next.delete("boatCode");
      next.delete("routeId");
      next.delete("routeCode");
      // giữ ?view= nếu có
      return next;
    }, { replace: true });
  };

  const filteredBoats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrichedBoats;
    return enrichedBoats.filter((boat) =>
      String(boat.boatCode || "").toLowerCase().includes(q)
      || String(boat.boatId || "").toLowerCase().includes(q),
    );
  }, [enrichedBoats, query]);

  const situations = useMemo(
    () => buildBoatSituations(enrichedBoats, stations, arrivedAtRef.current),
    // tick buộc recompute để ẩn "đã cập bến" sau ~1 phút
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedBoats, stations, tick],
  );

  const incidentCount = useMemo(
    () => Math.max(
      openIncidents.length,
      situations.filter((row) => row.phase === "incident").length,
    ),
    [openIncidents.length, situations],
  );

  // Deep-link từ Trip Detail: ?focus=1&boatId=&boatCode=&tripId=&routeId=
  useEffect(() => {
    const focus = String(searchParams.get("focus") || "") === "1";
    const boatIdParam = String(searchParams.get("boatId") || "").trim();
    const boatCodeParam = String(searchParams.get("boatCode") || "").trim();
    const tripIdParam = String(searchParams.get("tripId") || "").trim();
    const tripCodeParam = String(searchParams.get("tripCode") || "").trim().toUpperCase();
    const routeIdParam = String(searchParams.get("routeId") || "").trim();
    const routeCodeParam = String(searchParams.get("routeCode") || "").trim();

    if (!focus) return;

    setFocusSolo(true);
    if (routeIdParam) setFocusRouteId(routeIdParam);
    if (routeCodeParam) setFocusRouteCode(routeCodeParam);

    if (!enrichedBoats.length) return;

    const matched = enrichedBoats.find((boat) => {
      if (tripIdParam && String(boat.tripId || "") === tripIdParam) return true;
      if (tripCodeParam && String(boat.tripCode || "").trim().toUpperCase() === tripCodeParam) return true;
      if (boatIdParam && String(boat.boatId) === boatIdParam) return true;
      if (boatCodeParam && String(boat.boatCode || "").trim().toUpperCase() === boatCodeParam.toUpperCase()) {
        return true;
      }
      return false;
    });
    if (matched?.boatId) {
      setSelectedBoatId(String(matched.boatId));
      setFleetCollapsed(false);
    }
  }, [searchParams, enrichedBoats]);

  useEffect(() => {
    if (!selectedBoatId) return;
    const stillVisible = enrichedBoats.some((boat) => boat.boatId === selectedBoatId);
    if (!stillVisible) setSelectedBoatId("");
  }, [enrichedBoats, selectedBoatId]);

  // BE: mở live tracking / focus tàu → JoinBoat (không join khi chuyến đã xong).
  const selectedLiveKey = useMemo(() => {
    const selected = enrichedBoats.find((b) => String(b.boatId) === String(selectedBoatId || ""));
    if (!selectedBoatId || !selected) return "";
    if (selected.tripFinished || selected.acceptLiveGps === false) return "";
    return String(selected.boatId);
  }, [selectedBoatId, enrichedBoats]);

  useEffect(() => {
    const boatId = String(selectedLiveKey || "").trim();
    if (!boatId) return undefined;
    trackingHub.joinBoat(boatId).catch(() => {});
    return () => {
      trackingHub.leaveBoat(boatId).catch(() => {});
    };
  }, [selectedLiveKey]);

  const selectedBoat = useMemo(
    () => enrichedBoats.find((boat) => boat.boatId === selectedBoatId) || null,
    [enrichedBoats, selectedBoatId],
  );

  // Solo focus: bám tọa độ tàu đang chọn — kể cả bảo trì / offline (last known GPS).
  useEffect(() => {
    if (!selectedBoatId || !selectedBoat) {
      setFocusView(null);
      return;
    }
    const lat = Number(selectedBoat.latitude);
    const lng = Number(selectedBoat.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setFocusView({ latitude: lat, longitude: lng });
      return;
    }
    setFocusView(null);
  }, [
    selectedBoatId,
    selectedBoat?.latitude,
    selectedBoat?.longitude,
  ]);

  const selectBoatAndFocus = (boatId) => {
    const id = String(boatId || "");
    setSelectedBoatId((prev) => (prev === id ? "" : id));
    const boat = enrichedBoats.find((b) => String(b.boatId) === id);
    if (!boat) return;
    const lat = Number(boat.latitude);
    const lng = Number(boat.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setFocusView({ latitude: lat, longitude: lng });
    }
  };

  const openReportForBoat = (boat) => {
    const fromSchedule = pickActiveTripForBoat(todayTrips, boat);
    setReportForm({
      boatId: boat?.boatId || "",
      tripId: boat?.tripId || fromSchedule?.tripId || "",
      tripCode: boat?.tripCode || fromSchedule?.tripCode || "",
      incidentType: "MechanicalFailure",
      severity: "High",
      description: "",
    });
    setShowReport(true);
  };

  const handleQuickReport = async (event) => {
    event.preventDefault();
    if (!reportForm.boatId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu" : "Select boat",
      });
      return;
    }
    setReportBusy(true);
    try {
      const boat = enrichedBoats.find((item) => String(item.boatId) === String(reportForm.boatId));
      const description = reportForm.description.trim()
        || (lang === "VN" ? "Test báo sự cố (Manager)" : "Manager test incident");
      const fromTrips = pickActiveTripForBoat(todayTrips, boat || { boatId: reportForm.boatId });
      const tripId = reportForm.tripId || boat?.tripId || fromTrips?.tripId || null;
      const tripCode = reportForm.tripCode || boat?.tripCode || fromTrips?.tripCode || "";

      await reportIncident({
        boatId: reportForm.boatId,
        tripId: tripId || null,
        incidentType: reportForm.incidentType,
        severity: reportForm.severity,
        description,
        occurredAt: new Date().toISOString(),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã báo sự cố" : "Incident reported",
        text: tripId
          ? (lang === "VN"
            ? `Đã gắn chuyến ${tripCode || ""}`.trim()
            : `Linked trip ${tripCode || ""}`.trim())
          : (lang === "VN"
            ? "Tàu chưa có chuyến hôm nay — sự cố không gắn trip."
            : "Boat has no trip today — incident saved without trip."),
      });
      setShowReport(false);
      await Promise.all([
        refreshIncidents().catch(() => {}),
        refresh().catch(() => {}),
        refreshOpsSchedule().catch(() => {}),
      ]);
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Báo sự cố thất bại" : "Report failed",
        text: error?.response?.data?.message || error?.message || "",
      });
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="live-tracking-page fixed inset-x-0 bottom-0 top-16 z-20 overflow-hidden bg-slate-200 lg:left-64">
      <WaterwayMap
        boatMarkers={mapBoats}
        stationsList={mapStations}
        coordinates={focusedRouteCoordinates}
        routeOverlays={focusSolo && focusedRouteCoordinates.length >= 2 ? [] : mapRouteOverlays}
        selectedBoatId={selectedBoatId}
        focusView={focusView}
        preferFocus={Boolean(focusView && selectedBoatId)}
        fitBoatMarkers
        stationAsFlag
        hideStationLink
        className="h-full min-h-0"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-20 bg-gradient-to-b from-[#0E4050]/40 to-transparent" />

      <div className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-2 md:left-4 md:right-4 md:top-4">
        <div className="pointer-events-auto inline-flex max-w-[min(100%,18rem)] flex-wrap items-center gap-1.5 rounded-2xl bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/90">
            <span className="h-2 w-2 rounded-full bg-[#124757] ring-1 ring-white/40" />
            {lang === "VN" ? "1 tầng" : "1 deck"}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/90">
            <span className="h-2 w-2 rounded-full bg-[#1D4ED8] ring-1 ring-white/40" />
            {lang === "VN" ? "2 tầng" : "2 decks"}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/90">
            <span className="h-2 w-2 rounded-full bg-[#EA580C] ring-1 ring-white/40" />
            {lang === "VN" ? "Cứu hộ" : "Rescue"}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/90">
            <span className="h-2 w-2 rounded-full bg-[#DC2626] ring-1 ring-white/40" />
            {lang === "VN" ? "Sự cố" : "Incident"}
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-white/90" title={chip.label}>
            <span className={`h-2 w-2 rounded-full ${chip.dot} ring-1 ring-white/40`} />
            {chip.label}
          </span>
          {focusSolo ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-[#7DD3FC]">
              <span className="h-2 w-2 rounded-full bg-[#0EA5E9] ring-1 ring-white/40" />
              {lang === "VN" ? "Focus" : "Focus"}
            </span>
          ) : null}
        </div>
        <div className="pointer-events-auto flex min-w-0 flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {focusSolo ? (
              <button
                type="button"
                onClick={exitFocusSolo}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0EA5E9] px-3 text-[11px] font-headline font-black uppercase tracking-wider text-white shadow-md transition hover:brightness-110"
                title={lang === "VN" ? "Hiện toàn bộ đội tàu" : "Show full fleet"}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden>fullscreen</span>
                <span>{lang === "VN" ? "Full" : "Full"}</span>
              </button>
            ) : null}
            {viewTabs}
            {canReportIncident ? (
              <button
                type="button"
                onClick={() => openReportForBoat(selectedBoat || enrichedBoats[0] || null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-600 px-3 text-[11px] font-headline font-black uppercase tracking-wider text-white shadow-md transition hover:brightness-110"
                title={lang === "VN" ? "Báo sự cố" : "Report incident"}
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden>report</span>
                <span className="hidden sm:inline">{lang === "VN" ? "Báo sự cố" : "Report"}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                refresh().catch(() => {});
                refreshIncidents().catch(() => {});
                refreshOpsSchedule().catch(() => {});
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#124757] shadow-md transition hover:bg-slate-50"
              title={lang === "VN" ? "Tải lại" : "Refresh"}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>refresh</span>
            </button>
          </div>
          {focusSolo ? (
            <div className="max-w-[min(100%,20rem)] rounded-xl bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur dark:bg-slate-800/90">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Tuyến GPS đã vẽ" : "Recorded GPS route"}
              </p>
              <p className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                {mapRouteOverlays.find((route) => route.emphasis === "active")?.label
                  || focusRouteCode
                  || selectedBoat?.boatCode
                  || (lang === "VN" ? "Đang xem 1 tàu" : "Viewing one boat")}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ===== 2 bảng: trái Đội tàu · phải Tình hình (nền kính) ===== */}
      {fleetCollapsed ? (
        <button
          type="button"
          onClick={() => setFleetCollapsed(false)}
          className="absolute bottom-3 left-3 z-30 inline-flex items-center gap-2 rounded-2xl bg-white/55 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.14)] ring-1 ring-white/50 backdrop-blur-xl transition hover:bg-white/70 dark:bg-slate-900/55 dark:ring-slate-700/60 md:bottom-4 md:left-4"
          title={lang === "VN" ? "Mở đội tàu" : "Open fleet"}
        >
          <span className="material-symbols-outlined text-[18px] text-[#124757] dark:text-yellow-400" aria-hidden>
            keyboard_arrow_up
          </span>
          <span className="font-headline text-[11px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? `Đội tàu · ${enrichedBoats.length}` : `Fleet · ${enrichedBoats.length}`}
          </span>
          <span className={`inline-flex h-2 w-2 rounded-full ${chip.dot}`} />
        </button>
      ) : (
        <aside className="absolute bottom-3 left-3 z-30 flex max-h-[min(48vh,22rem)] w-[min(calc(100%-1.5rem),17.5rem)] flex-col overflow-hidden rounded-2xl bg-white/55 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-white/50 backdrop-blur-xl dark:bg-slate-900/55 dark:ring-slate-700/60 md:bottom-4 md:left-4">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/40 px-3 py-2 dark:border-slate-700/50">
            <div className="min-w-0">
              <p className="font-headline text-[11px] font-black uppercase tracking-[0.14em] text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Đội tàu" : "Fleet"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {enrichedBoats.length} {lang === "VN" ? "tàu" : "boats"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/40 px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 ring-1 ring-white/50 dark:bg-slate-800/40 dark:text-slate-200">
                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                {chip.label}
              </span>
              <button
                type="button"
                onClick={() => setFleetCollapsed(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/50 hover:text-[#124757] dark:hover:bg-slate-800 dark:hover:text-yellow-400"
                title={lang === "VN" ? "Thu gọn" : "Collapse"}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>keyboard_arrow_down</span>
              </button>
            </div>
          </div>

          <div className="shrink-0 px-2.5 pt-2">
            <label className="flex items-center gap-2 rounded-xl bg-white/45 px-2.5 py-1.5 ring-1 ring-white/55 focus-within:ring-[#124757]/35 dark:bg-slate-800/45 dark:ring-slate-700/55">
              <span className="material-symbols-outlined text-[15px] text-slate-400" aria-hidden>search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === "VN" ? "Tìm mã tàu" : "Search code"}
                className="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </label>
            {errorMsg ? (
              <p className="mt-1.5 rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-600 dark:text-rose-300">
                {errorMsg}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-2">
            {isInitialLoading ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
              </div>
            ) : filteredBoats.length === 0 ? (
              <p className="px-2 py-5 text-center text-[11px] font-medium text-slate-400">
                {lang === "VN" ? "Chưa có tín hiệu GPS." : "No GPS signal yet."}
              </p>
            ) : (
              <ul>
                {filteredBoats.map((boat) => {
                  const active = selectedBoatId === boat.boatId;
                  const isIncident = boat.hasOpenIncident === true;
                  const underMaintenance = isBoatUnderMaintenance(boat) && !isIncident;
                  const tag = getBoatStatusTag(boat, stations, lang);
                  const service = String(boat.serviceType || "").toLowerCase();
                  const decks = Number(boat.numberOfDecks) || 1;
                  const isRescue = service === "rescue" || String(boat.boatCode || "").toUpperCase().startsWith("SOS");
                  const kindLabel = isRescue
                    ? (lang === "VN" ? "Cứu hộ" : "Rescue")
                    : decks >= 2
                      ? (lang === "VN" ? "2 tầng" : "2 decks")
                      : (lang === "VN" ? "1 tầng" : "1 deck");
                  const kindColor = isIncident
                    ? "#DC2626"
                    : isRescue
                      ? "#EA580C"
                      : decks >= 2
                        ? "#1D4ED8"
                        : "#124757";
                  const missionLine = boat.rescuingBoatCode
                    ? (lang === "VN" ? `Đang cứu ${boat.rescuingBoatCode}` : `Rescuing ${boat.rescuingBoatCode}`)
                    : boat.rescuedByBoatCode
                      ? (lang === "VN" ? `${boat.rescuedByBoatCode} đang kéo` : `${boat.rescuedByBoatCode} towing`)
                      : null;
                  const delayMin = Number(boat.delayMinutes);
                  const activeDelayLine = isDelayActive(boat)
                    ? formatActiveDelayLine(boat, { lang })
                    : null;
                  const delayLine = activeDelayLine
                    || (Number.isFinite(delayMin) && delayMin > 0
                      ? (lang === "VN"
                        ? `Trễ ${delayMin}p${boat.delayReason ? ` · ${boat.delayReason}` : ""}`
                        : `Delay ${delayMin}m${boat.delayReason ? ` · ${boat.delayReason}` : ""}`)
                      : null);
                  const statusTag = boat.tripFinished
                    ? {
                      label: lang === "VN" ? "HOÀN THÀNH" : "COMPLETED",
                      tone: "offline",
                      detail: null,
                    }
                    : boat.rescuingBoatCode
                    ? {
                      label: lang === "VN" ? `CỨU ${boat.rescuingBoatCode}` : `TOW ${boat.rescuingBoatCode}`,
                      tone: "rescue",
                      detail: missionLine,
                    }
                    : ((isDelayActive(boat) || (Number.isFinite(delayMin) && delayMin > 0)) && !isIncident
                      ? {
                        ...tag,
                        tone: "delayed",
                        label: isDelayActive(boat)
                          ? (lang === "VN" ? "ĐANG DELAY" : "DELAYING")
                          : (lang === "VN" ? `TRỄ ${delayMin}P` : `DELAY ${delayMin}M`),
                        detail: delayLine || tag.detail,
                      }
                      : tag);

                  return (
                    <li key={boat.boatId}>
                      <button
                        type="button"
                        onClick={() => selectBoatAndFocus(boat.boatId)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${
                          underMaintenance ? "opacity-80" : ""
                        } ${
                          isIncident
                            ? "bg-rose-500/10"
                            : boat.rescuingBoatCode
                              ? "bg-amber-500/10"
                              : active
                                ? "bg-[#124757]/10 dark:bg-yellow-400/10"
                                : "hover:bg-white/40 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ color: kindColor, background: `${kindColor}18` }}
                        >
                          <Ship size={15} strokeWidth={2.25} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`truncate font-headline text-[12px] font-black tracking-wide ${
                              isIncident
                                ? "text-rose-700 dark:text-rose-300"
                                : boat.rescuingBoatCode
                                  ? "text-amber-800 dark:text-amber-300"
                                  : underMaintenance
                                    ? "text-slate-500 dark:text-slate-400"
                                    : "text-slate-800 dark:text-slate-100"
                            }`}>
                              {boat.boatCode}
                            </span>
                            <span
                              className={`wb-board-tag shrink-0 text-[10px] ${boardTagClass(statusTag.tone)}`}
                              title={statusTag.detail || statusTag.label}
                            >
                              {statusTag.label}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">
                            {boat.flashNotice
                              || missionLine
                              || delayLine
                              || statusTag.detail
                              || `${kindLabel} · ${formatRelative(boat.recordedAt, lang)}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      )}

      {situationCollapsed ? (
        <button
          type="button"
          onClick={() => setSituationCollapsed(false)}
          className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-2 rounded-2xl bg-white/55 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.14)] ring-1 ring-white/50 backdrop-blur-xl transition hover:bg-white/70 dark:bg-slate-900/55 dark:ring-slate-700/60 md:bottom-4 md:right-4"
          title={lang === "VN" ? "Mở tình hình" : "Open situation"}
        >
          <span className="material-symbols-outlined text-[18px] text-[#124757] dark:text-yellow-400" aria-hidden>
            keyboard_arrow_up
          </span>
          <span className="font-headline text-[11px] font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? `Tình hình · ${situations.length}` : `Status · ${situations.length}`}
          </span>
          {incidentCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">
              {incidentCount}
            </span>
          ) : null}
        </button>
      ) : (
        <aside className="absolute bottom-3 right-3 z-30 flex max-h-[min(48vh,22rem)] w-[min(calc(100%-1.5rem),17.5rem)] flex-col overflow-hidden rounded-2xl bg-white/55 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-white/50 backdrop-blur-xl dark:bg-slate-900/55 dark:ring-slate-700/60 md:bottom-4 md:right-4">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/40 px-3 py-2 dark:border-slate-700/50">
            <div className="min-w-0">
              <p className="font-headline text-[11px] font-black uppercase tracking-[0.14em] text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Tình hình" : "Situation"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                {lang === "VN" ? "Sắp tới · sự cố" : "Arrivals · incidents"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {incidentCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">
                  {incidentCount}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setSituationCollapsed(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/50 hover:text-[#124757] dark:hover:bg-slate-800 dark:hover:text-yellow-400"
                title={lang === "VN" ? "Thu gọn" : "Collapse"}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>keyboard_arrow_down</span>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-2">
            {situations.length === 0 ? (
              <p className="px-2 py-5 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                {lang === "VN"
                  ? "Chưa có tàu đang chạy / sắp tới / sự cố."
                  : "No moving / arriving / incident boats."}
              </p>
            ) : (
              <ul>
                {situations.map((row) => {
                  const tagTone = row.phase === "incident"
                    ? "incident"
                    : row.phase === "docked" || row.phase === "arriving" || row.phase === "starting"
                      ? "boarding"
                      : row.phase === "moving"
                        ? "active"
                        : "offline";
                  const tagLabel = lang === "VN"
                    ? String(row.labelVn || "").toUpperCase()
                    : String(row.labelEn || "").toUpperCase();
                  const detail = (lang === "VN" ? row.detailVn : row.detailEn)
                    || [
                      row.stationCode
                        ? (lang === "VN"
                          ? `${row.phase === "docked" ? "Tại" : "Tới"} ${row.stationCode}`
                          : `${row.phase === "docked" ? "At" : "To"} ${row.stationCode}`)
                        : null,
                      Number.isFinite(row.meters) && row.phase !== "docked" && row.phase !== "starting"
                        ? formatDistance(row.meters, lang)
                        : null,
                      Number.isFinite(row.remainingMinutes) && row.phase !== "docked"
                        ? (lang === "VN" ? `~${Math.round(row.remainingMinutes)} phút` : `~${Math.round(row.remainingMinutes)}m`)
                        : null,
                    ].filter(Boolean).join(" · ");

                  return (
                    <li key={`${row.boatId}-${row.phase}`}>
                      <button
                        type="button"
                        onClick={() => selectBoatAndFocus(row.boatId)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/40 dark:hover:bg-slate-800/50 ${
                          row.phase === "incident" ? "bg-rose-500/10" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-headline text-[12px] font-black tracking-wide text-slate-800 dark:text-slate-100">
                              {row.boatCode}
                            </span>
                            <span className={`wb-board-tag shrink-0 text-[10px] ${boardTagClass(tagTone)}`}>
                              {tagLabel}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500">
                            {detail}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      )}
      {showReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleQuickReport}
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Báo sự cố (test Manager)" : "Report incident (Manager test)"}
            </h2>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Boat</span>
              <select
                required
                value={reportForm.boatId}
                onChange={(e) => {
                  const boatId = e.target.value;
                  const boat = enrichedBoats.find((item) => String(item.boatId) === String(boatId));
                  const fromTrips = pickActiveTripForBoat(todayTrips, boat || { boatId });
                  setReportForm((prev) => ({
                    ...prev,
                    boatId,
                    tripId: boat?.tripId || fromTrips?.tripId || "",
                    tripCode: boat?.tripCode || fromTrips?.tripCode || "",
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">{lang === "VN" ? "Chọn tàu" : "Select boat"}</option>
                {enrichedBoats.map((boat) => (
                  <option key={boat.boatId} value={boat.boatId}>
                    {boat.boatCode}
                    {boat.tripCode ? ` · ${boat.tripCode}` : ""}
                    {boat.hasOpenIncident || boat.activeIncident ? " · INCIDENT" : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] font-medium text-slate-500">
                {reportForm.tripCode || reportForm.tripId
                  ? (lang === "VN"
                    ? `Gắn chuyến: ${reportForm.tripCode || reportForm.tripId}`
                    : `Link trip: ${reportForm.tripCode || reportForm.tripId}`)
                  : (lang === "VN"
                    ? "Tàu chưa có chuyến hôm nay (Scheduled/Boarding/InProgress) — sẽ báo không gắn trip."
                    : "No trip today (Scheduled/Boarding/InProgress) — will report without trip.")}
              </p>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Type</span>
                <select
                  value={reportForm.incidentType}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, incidentType: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  {INCIDENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {lang === "VN" ? item.labelVn : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Severity</span>
                <select
                  value={reportForm.severity}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, severity: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  {INCIDENT_SEVERITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {lang === "VN" ? item.labelVn : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Mô tả" : "Description"}
              </span>
              <textarea
                rows={2}
                value={reportForm.description}
                onChange={(e) => setReportForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={lang === "VN" ? "Test báo sự cố (Manager)" : "Manager test incident"}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="rounded-2xl px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={reportBusy}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50"
              >
                {lang === "VN" ? "Gửi" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
