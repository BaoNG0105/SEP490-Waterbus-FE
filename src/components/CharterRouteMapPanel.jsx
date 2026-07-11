import { useEffect, useState } from "react";
import { WaterwayMap } from "./WaterwayMap";
import { loadCharterRouteMapModel } from "../utils/charterRouteMap";

const QUOTED_STATUSES = new Set([
  "Quoted",
  "PendingPayment",
  "Confirmed",
  "Completed",
  "DepositPaid",
]);

export function CharterRouteMapPanel({
  lang = "VN",
  booking,
  className = "",
  heightClassName = "h-72 md:h-80",
  title,
  subtitle,
  preferOfficial = false,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [mapModel, setMapModel] = useState({
    routeName: "",
    coordinates: [],
    stations: [],
    source: "",
  });

  const bookingStatus = String(booking?.status || booking?.bookingStatus || "");
  const isQuotedLike = preferOfficial || QUOTED_STATUSES.has(bookingStatus);
  const isOfficial = mapModel.source === "route-master";

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      if (!booking) {
        setMapModel({ routeName: "", coordinates: [], stations: [], source: "" });
        setErrorMsg("");
        return;
      }

      try {
        setIsLoading(true);
        setErrorMsg("");
        const model = await loadCharterRouteMapModel(booking);
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
    booking?.id,
    booking?.matchedRouteId,
    booking?.matchedRouteCode,
    booking?.fromStationId,
    booking?.toStationId,
    booking?.routeEstimate,
    booking?.routeLegs,
    booking?.status,
    lang,
  ]);

  const panelTitle = title || (
    isOfficial
      ? (lang === "VN" ? "Tuyến hệ thống" : "System route")
      : (lang === "VN" ? "Bản đồ lộ trình" : "Route map")
  );

  const panelSubtitle = subtitle || (
    isOfficial
      ? (isQuotedLike
        ? (lang === "VN"
          ? "Đường đi theo Route Master đã khớp — dùng khi chốt giá."
          : "Path follows the matched Route Master used for quoting.")
        : (lang === "VN"
          ? "Đã khớp Route Master — đường sông thực tế trên bản đồ."
          : "Matched Route Master — real waterway path on the map."))
      : (lang === "VN"
        ? "Chưa khớp Route Master — đang nối tạm các bến đã chọn."
        : "No Route Master match yet — temporary station-to-station path.")
  );

  const overlayEyebrow = isOfficial
    ? (lang === "VN" ? "Tuyến đã khớp" : "Matched route")
    : (lang === "VN" ? "Lộ trình tạm" : "Draft path");

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
              {panelTitle}
            </p>
            {mapModel.source ? (
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wider ring-1 ${
                isOfficial
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20"
                  : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20"
              }`}
              >
                {isOfficial
                  ? (lang === "VN" ? "Route Master" : "Route Master")
                  : (lang === "VN" ? "Tạm thời" : "Temporary")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-300">
            {panelSubtitle}
          </p>
        </div>
        {isLoading ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {lang === "VN" ? "Đang tải..." : "Loading..."}
          </span>
        ) : null}
      </div>

      <div className={`relative w-full ${heightClassName}`}>
        {errorMsg && !mapModel.stations.length && !mapModel.coordinates.length ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{errorMsg}</p>
          </div>
        ) : (
          <WaterwayMap
            key={`${mapModel.source}-${mapModel.coordinates.length}-${mapModel.stations.length}-${mapModel.routeName}`}
            coordinates={mapModel.coordinates}
            waterwayName={mapModel.routeName}
            overlayEyebrow={overlayEyebrow}
            stationsList={mapModel.stations}
            hideStationLink
            lineWeight={isOfficial ? 6 : 4}
            lineOpacity={isOfficial ? 0.9 : 0.7}
          />
        )}
      </div>
    </div>
  );
}
