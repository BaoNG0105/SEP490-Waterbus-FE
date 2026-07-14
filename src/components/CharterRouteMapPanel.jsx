import { useEffect, useMemo, useState } from "react";
import { WaterwayMap } from "./WaterwayMap";
import { loadCharterRouteMapModel } from "../utils/charterRouteMap";

export function CharterRouteMapPanel({
  lang = "VN",
  booking,
  draftRoutePlan = null,
  className = "",
  heightClassName = "h-72 md:h-80",
  title,
  subtitle,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mapModel, setMapModel] = useState({
    routeName: "",
    coordinates: [],
    stations: [],
    source: "",
  });

  const draftPlanKey = useMemo(() => {
    if (!Array.isArray(draftRoutePlan) || draftRoutePlan.length === 0) return "";
    return draftRoutePlan
      .map((row) => `${row?.fromStationId || ""}>${row?.toStationId || ""}:${row?.routeId || ""}`)
      .join("|");
  }, [draftRoutePlan]);

  const mapBooking = useMemo(() => {
    if (!booking) return null;
    const hasFinalized = Boolean(booking?.selectedRoute?.routeId || booking?.selectedRouteId);
    if (hasFinalized) return booking;

    const plan = (Array.isArray(draftRoutePlan) ? draftRoutePlan : [])
      .filter((row) => String(row?.routeId || "").trim());
    if (plan.length === 0) return booking;

    return {
      ...booking,
      routePlan: plan,
    };
  }, [booking, draftPlanKey, draftRoutePlan]);

  const isFinalized = mapModel.source === "selected-route" || mapModel.source === "route-master";
  const isDraftSelected = mapModel.source === "draft-route";
  const hasDrawnRoute = isFinalized || isDraftSelected;
  const isStationsOnly = mapModel.source === "stations-only";

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!mapBooking) {
        setMapModel({ routeName: "", coordinates: [], stations: [], source: "" });
        setErrorMsg("");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMsg("");
        const model = await loadCharterRouteMapModel(mapBooking);
        if (!isActive) return;
        setMapModel(model);
        if (!model.coordinates.length && !model.stations.length) {
          setErrorMsg(lang === "VN"
            ? "Chưa có dữ liệu bản đồ cho lộ trình này."
            : "No map data is available for this route yet.");
        }
      } catch (error) {
        console.error("Lỗi tải bản đồ lộ trình charter:", error);
        if (!isActive) return;
        setMapModel({ routeName: "", coordinates: [], stations: [], source: "" });
        setErrorMsg(lang === "VN"
          ? "Không thể tải bản đồ lộ trình."
          : "Unable to load the route map.");
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    run();
    return () => {
      isActive = false;
    };
  }, [
    mapBooking?.id,
    mapBooking?.selectedRouteId,
    mapBooking?.selectedRoute?.routeId,
    draftPlanKey,
    mapBooking?.fromStationId,
    mapBooking?.toStationId,
    mapBooking?.itineraryStops,
    mapBooking?.status,
    lang,
  ]);

  const panelTitle = title || (
    isFinalized
      ? (lang === "VN" ? "Tuyến đã chốt" : "Finalized route")
      : isDraftSelected
        ? (lang === "VN" ? "Tuyến đã chọn" : "Selected route")
        : (lang === "VN" ? "Bản đồ lộ trình" : "Route map")
  );

  const panelSubtitle = subtitle || (
    isFinalized
      ? ""
      : isDraftSelected
        ? (lang === "VN"
          ? "Đang vẽ tuyến GPS đã chọn theo chặng."
          : "Drawing the GPS routes selected per leg.")
        : isStationsOnly
          ? (lang === "VN"
            ? "Chưa chọn tuyến — chỉ hiện bến. Chọn tuyến theo chặng để vẽ đường."
            : "No route selected — stations only. Pick a route per leg to draw the path.")
          : (lang === "VN"
            ? "Chưa có tuyến — đang hiện tạm các bến."
            : "No route yet — temporary station markers.")
  );

  const overlayEyebrow = isFinalized
    ? (lang === "VN" ? "Tuyến đã chốt" : "Finalized route")
    : isDraftSelected
      ? (lang === "VN" ? "Tuyến đã chọn" : "Selected route")
      : isStationsOnly
        ? (lang === "VN" ? "Chưa chọn tuyến" : "No route yet")
        : (lang === "VN" ? "Lộ trình tạm" : "Draft path");

  const badgeClass = isFinalized
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
    : isDraftSelected
      ? "bg-[#EAF3F5] text-[#124757] ring-[#124757]/20 dark:bg-yellow-400/10 dark:text-yellow-400 dark:ring-yellow-400/20"
      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20";

  const badgeLabel = isFinalized
    ? (lang === "VN" ? "Đã chốt" : "Finalized")
    : isDraftSelected
      ? (lang === "VN" ? "Đã chọn" : "Selected")
      : isStationsOnly
        ? (lang === "VN" ? "Chưa chọn" : "Pending")
        : (lang === "VN" ? "Tạm thời" : "Temporary");

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {panelTitle}
            </p>
            {mapModel.source ? (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider ring-1 ${badgeClass}`}>
                {badgeLabel}
              </span>
            ) : null}
          </div>
          {panelSubtitle ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-300">
              {panelSubtitle}
            </p>
          ) : null}
        </div>
        {isLoading ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Đang tải..." : "Loading..."}
          </span>
        ) : null}
      </div>

      <div className={`relative w-full min-h-0 ${heightClassName}`}>
        {errorMsg && !mapModel.stations.length && !mapModel.coordinates.length ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{errorMsg}</p>
          </div>
        ) : (
          <div className="absolute inset-0">
            <WaterwayMap
              key={`${String(booking?.id || "charter-route-map")}-${draftPlanKey || "none"}`}
              coordinates={mapModel.coordinates}
              waterwayName={mapModel.routeName}
              overlayEyebrow={overlayEyebrow}
              stationsList={mapModel.stations}
              hideStationLink
              lineWeight={isFinalized ? 6 : hasDrawnRoute ? 5 : 4}
              lineOpacity={isFinalized ? 0.9 : hasDrawnRoute ? 0.85 : 0.7}
            />
          </div>
        )}
      </div>
    </div>
  );
}
