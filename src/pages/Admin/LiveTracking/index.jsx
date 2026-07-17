import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Ship } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import { WaterwayMap } from "../../../components/WaterwayMap";
import { useLiveBoatTracking } from "../../../hooks/useLiveBoatTracking";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
import { fetchAllStations } from "../../../services/stationService";
import { fetchAllBoats } from "../../../services/boatService";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  reportIncident,
} from "../../../services/incidentService";
import { getBoatImageUrl } from "../../../utils/charterBookingAdmin";
import { isBoatEligibleForLiveMap, isBoatUnderMaintenance } from "../../../utils/boatTracking";
import { geometryToCoordinates } from "../../../utils/charterRouteMap";
import { buildBoatSituations, getBoatStatusTag } from "../../../utils/boatSituation";
import { isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { notify, showToast } from "../../../utils/swalToast";

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

export function LiveTracking() {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  // TEMP: cho Manager/Admin báo sự cố để test (sau có thể siết lại chỉ Staff).
  const canReportIncident = isAdminUser(user) || isManagerUser(user);
  const { boats, connectionMode, errorMsg, isInitialLoading, refresh } = useLiveBoatTracking({ enabled: true });
  const { openBoatIds, incidents: openIncidents, refresh: refreshIncidents } = useLiveIncidents({
    enabled: true,
    toast: true,
  });
  const [selectedBoatId, setSelectedBoatId] = useState("");
  const [query, setQuery] = useState("");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [situationCollapsed, setSituationCollapsed] = useState(false);
  const [stations, setStations] = useState([]);
  const [boatCatalogByKey, setBoatCatalogByKey] = useState(() => new Map());
  const [routeOverlays, setRouteOverlays] = useState([]);
  const [tick, setTick] = useState(() => Date.now());
  const [showReport, setShowReport] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportForm, setReportForm] = useState({
    boatId: "",
    incidentType: "MechanicalFailure",
    severity: "High",
    description: "",
  });
  const arrivedAtRef = useRef(new Map());
  const chip = modeChip(connectionMode, lang);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 5000);
    return () => window.clearInterval(timer);
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
          const seatCount = Number(item.seatCount);
          const meta = {
            imageUrl: getBoatImageUrl(item),
            seatCount: Number.isFinite(seatCount) && seatCount >= 0 ? seatCount : null,
            boatName: item.boatName || item.name || "",
            operationalStatus: item.status || "",
          };
          const id = String(item.boatId || item.id || "").trim();
          const code = String(item.boatCode || item.code || "").trim();
          if (id) next.set(id, meta);
          if (code) next.set(code, meta);
        });
        setBoatCatalogByKey(next);
      })
      .catch((error) => {
        console.error("Failed to load boat catalog for live tracking:", error);
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
            const coords = geometryToCoordinates(detail.routeGeometry);
            const positions = coords
              .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
              .map((point) => [point.latitude, point.longitude]);
            if (positions.length < 2) return null;
            return {
              id: detail.routeId || detail.routeCode,
              label: detail.routeCode || detail.routeName || "",
              positions,
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

  const enrichedBoats = useMemo(
    () => boats
      .map((boat) => {
        const meta = boatCatalogByKey.get(String(boat.boatId))
          || boatCatalogByKey.get(String(boat.boatCode))
          || null;
        const hasOpenIncident = boat.activeIncident === true
          || openBoatIds.has(String(boat.boatId))
          || openBoatIds.has(String(boat.boatCode));
        const opsFromTracking = boat.boatStatus || boat.operationalStatus || "";
        const base = meta
          ? {
            ...boat,
            imageUrl: boat.imageUrl || meta.imageUrl,
            seatCount: boat.seatCount ?? meta.seatCount,
            boatName: boat.boatName || meta.boatName,
            // Ưu tiên boatStatus từ tracking (sau báo sự cố BE set UnderMaintenance).
            operationalStatus: opsFromTracking || meta.operationalStatus || "",
          }
          : {
            ...boat,
            operationalStatus: opsFromTracking || boat.operationalStatus || "",
          };
        return { ...base, hasOpenIncident, activeIncident: hasOpenIncident || boat.activeIncident === true };
      })
      .filter(isBoatEligibleForLiveMap),
    [boats, boatCatalogByKey, openBoatIds],
  );

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

  useEffect(() => {
    if (!selectedBoatId) return;
    const stillVisible = enrichedBoats.some((boat) => boat.boatId === selectedBoatId);
    if (!stillVisible) setSelectedBoatId("");
  }, [enrichedBoats, selectedBoatId]);

  const selectedBoat = useMemo(
    () => enrichedBoats.find((boat) => boat.boatId === selectedBoatId) || null,
    [enrichedBoats, selectedBoatId],
  );

  const focusView = selectedBoat
    ? { latitude: selectedBoat.latitude, longitude: selectedBoat.longitude }
    : null;

  const openReportForBoat = (boat) => {
    setReportForm({
      boatId: boat?.boatId || "",
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

      await reportIncident({
        boatId: reportForm.boatId,
        tripId: null,
        incidentType: reportForm.incidentType,
        severity: reportForm.severity,
        description,
        occurredAt: new Date().toISOString(),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã báo sự cố" : "Incident reported",
      });
      setShowReport(false);
      await Promise.all([
        refreshIncidents().catch(() => {}),
        refresh().catch(() => {}),
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
        boatMarkers={enrichedBoats}
        stationsList={stations}
        routeOverlays={routeOverlays}
        selectedBoatId={selectedBoatId}
        focusView={focusView}
        fitBoatMarkers
        stationAsFlag
        hideStationLink
        className="h-full min-h-0"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-gradient-to-b from-[#0E4050]/45 to-transparent" />

      <div className="absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-3 md:left-4 md:right-4 md:top-4">
        <h1 className="font-headline text-xl font-black tracking-tight text-white drop-shadow-md md:text-2xl">
          {lang === "VN" ? "Theo dõi tàu" : "Live tracking"}
        </h1>
        <div className="flex items-center gap-2">
          {canReportIncident ? (
            <button
              type="button"
              onClick={() => openReportForBoat(selectedBoat || enrichedBoats[0] || null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rose-600 px-3 text-[11px] font-headline font-black uppercase tracking-wider text-white shadow-md transition hover:brightness-110"
              title={lang === "VN" ? "Báo sự cố (test Manager)" : "Report incident (Manager test)"}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>report</span>
              {lang === "VN" ? "Báo sự cố" : "Report"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => refresh().catch(() => {})}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#124757] shadow-md transition hover:bg-slate-50"
            title={lang === "VN" ? "Tải lại" : "Refresh"}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>refresh</span>
          </button>
        </div>
      </div>

      {/* ===== Panel đội tàu (trái) ===== */}
      {panelCollapsed ? (
        <button
          type="button"
          onClick={() => setPanelCollapsed(false)}
          className="absolute bottom-3 left-3 z-30 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/80 backdrop-blur-xl transition hover:bg-white dark:bg-slate-900/95 dark:ring-slate-700 md:bottom-4 md:left-4"
          title={lang === "VN" ? "Mở danh sách tàu" : "Open fleet list"}
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
        <aside className="absolute bottom-3 left-3 z-30 flex max-h-[min(48vh,22rem)] w-[min(calc(100%-1.5rem),17rem)] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/80 backdrop-blur-xl dark:bg-slate-900/95 dark:ring-slate-700 md:bottom-4 md:left-4">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="min-w-0 pl-0.5">
              <p className="font-headline text-[11px] font-black uppercase tracking-[0.14em] text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Đội tàu" : "Fleet"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {enrichedBoats.length} {lang === "VN" ? "tàu" : "boats"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ring-1 ${chip.className}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                {chip.label}
              </span>
              <button
                type="button"
                onClick={() => setPanelCollapsed(true)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#124757] dark:hover:bg-slate-800 dark:hover:text-yellow-400"
                title={lang === "VN" ? "Thu gọn" : "Collapse"}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden>keyboard_arrow_down</span>
              </button>
            </div>
          </div>

          <div className="shrink-0 px-2.5 pt-2.5">
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200/80 focus-within:ring-[#124757]/35 dark:bg-slate-800 dark:ring-slate-700">
              <span className="material-symbols-outlined text-[15px] text-slate-400" aria-hidden>search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === "VN" ? "Tìm mã tàu" : "Search code"}
                className="w-full bg-transparent text-xs font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
            </label>
            {errorMsg ? (
              <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                {errorMsg}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-2.5">
            {isInitialLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
              </div>
            ) : filteredBoats.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs font-medium text-slate-400">
                {lang === "VN" ? "Chưa có tín hiệu GPS." : "No GPS signal yet."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBoats.map((boat, index) => {
                  const active = selectedBoatId === boat.boatId;
                  const isIncident = boat.hasOpenIncident === true;
                  const underMaintenance = isBoatUnderMaintenance(boat) && !isIncident;
                  const tag = getBoatStatusTag(boat, stations, lang);

                  return (
                    <li key={boat.boatId}>
                      <button
                        type="button"
                        onClick={() => setSelectedBoatId((prev) => (prev === boat.boatId ? "" : boat.boatId))}
                        className={`flex w-full items-center gap-2 px-2 py-2 text-left transition ${
                          underMaintenance ? "opacity-80" : ""
                        } ${
                          isIncident
                            ? "bg-rose-50/70 dark:bg-rose-500/10"
                            : active
                              ? "bg-[#124757]/10 dark:bg-yellow-400/10"
                              : index % 2 === 1
                                ? "bg-slate-50/70 dark:bg-slate-800/40"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${
                          isIncident
                            ? "text-rose-500"
                            : underMaintenance
                              ? "text-slate-400 dark:text-slate-500"
                              : active
                                ? "text-[#0E4050] dark:text-yellow-400"
                                : "text-[#124757] dark:text-slate-300"
                        }`}>
                          <Ship size={18} strokeWidth={2.25} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate font-headline text-[12px] font-black tracking-wide ${
                            isIncident
                              ? "text-rose-700 dark:text-rose-300"
                              : underMaintenance
                                ? "text-slate-500 dark:text-slate-400"
                                : "text-slate-800 dark:text-slate-100"
                          }`}>
                            {boat.boatCode}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-400">
                            {formatRelative(boat.recordedAt, lang)}
                          </span>
                        </span>
                        <span
                          className={`wb-board-tag shrink-0 text-right ${boardTagClass(tag.tone)}`}
                          title={tag.detail || tag.label}
                        >
                          {tag.label}
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

      {/* ===== Bảng tình hình (phải) — ẩn/hiện bằng mũi tên ===== */}
      {situationCollapsed ? (
        <button
          type="button"
          onClick={() => setSituationCollapsed(false)}
          className={`absolute bottom-3 right-3 z-30 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ring-1 backdrop-blur-xl transition hover:bg-white dark:bg-slate-900/95 md:bottom-4 md:right-4 ${
            incidentCount > 0
              ? "ring-rose-300 dark:ring-rose-500/40"
              : "ring-slate-200/80 dark:ring-slate-700"
          }`}
          title={lang === "VN" ? "Mở tình hình tàu" : "Open boat status"}
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
        <aside className={`absolute bottom-3 right-3 z-30 flex max-h-[min(48vh,22rem)] w-[min(calc(100%-1.5rem),17.5rem)] flex-col overflow-hidden rounded-2xl bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.18)] ring-1 backdrop-blur-xl dark:bg-slate-900/95 md:bottom-4 md:right-4 ${
          incidentCount > 0
            ? "ring-rose-300 dark:ring-rose-500/40"
            : "ring-slate-200/80 dark:ring-slate-700"
        }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <div className="min-w-0">
              <p className="font-headline text-[11px] font-black uppercase tracking-[0.14em] text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Tình hình" : "Situation"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {lang === "VN"
                  ? "Sắp tới bến · sự cố"
                  : "Arrivals · incidents"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSituationCollapsed(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#124757] dark:hover:bg-slate-800 dark:hover:text-yellow-400"
              title={lang === "VN" ? "Thu gọn" : "Collapse"}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden>keyboard_arrow_down</span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 pb-2.5">
            {situations.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] font-medium leading-relaxed text-slate-400">
                {lang === "VN"
                  ? "Chưa có tàu đang chạy / sắp tới / sự cố."
                  : "No moving / arriving / incident boats."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {situations.map((row, index) => {
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

                  return (
                    <li key={`${row.boatId}-${row.phase}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedBoatId(row.boatId)}
                        className={`flex w-full items-center gap-2 px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/80 ${
                          row.phase === "incident" ? "bg-rose-50/60 dark:bg-rose-500/10" : ""
                        } ${index % 2 === 1 && row.phase !== "incident" ? "bg-slate-50/70 dark:bg-slate-800/40" : ""}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-headline text-[12px] font-black tracking-wide text-slate-800 dark:text-slate-100">
                              {row.boatCode}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            {row.stationCode
                              ? (lang === "VN"
                                ? `${row.phase === "docked" ? "Tại" : row.phase === "arriving" ? "Tới" : "Gần"} ${row.stationCode}`
                                : `${row.phase === "docked" ? "At" : row.phase === "arriving" ? "To" : "Near"} ${row.stationCode}`)
                              : (lang === "VN" ? "Chưa gần bến" : "No nearby station")}
                            {Number.isFinite(row.meters) && row.phase !== "docked"
                              ? ` · ${formatDistance(row.meters, lang)}`
                              : ""}
                            {row.phase === "docked" && Number.isFinite(row.remainingMs)
                              ? (lang === "VN"
                                ? ` · ẩn ${Math.ceil(row.remainingMs / 1000)}s`
                                : ` · hide ${Math.ceil(row.remainingMs / 1000)}s`)
                              : ""}
                          </span>
                        </span>
                        <span className={`wb-board-tag shrink-0 text-right ${boardTagClass(tagTone)}`}>
                          {tagLabel}
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
                onChange={(e) => setReportForm((prev) => ({ ...prev, boatId: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">{lang === "VN" ? "Chọn tàu" : "Select boat"}</option>
                {enrichedBoats.map((boat) => (
                  <option key={boat.boatId} value={boat.boatId}>
                    {boat.boatCode}
                    {boat.hasOpenIncident || boat.activeIncident ? " · INCIDENT" : ""}
                  </option>
                ))}
              </select>
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
