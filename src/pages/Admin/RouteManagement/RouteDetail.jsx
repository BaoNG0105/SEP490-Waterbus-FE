import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

import {
    fetchRouteDetail,
    modifyRoute,
} from "../../../services/routeService";
import { fetchAllStations } from "../../../services/stationService";
import { fetchWaterwayDetail } from "../../../services/waterwayService";

import { WaterwayMap } from "../../../components/WaterwayMap";

import { geometryToCoordinates } from "../../../utils/charterRouteMap";
import { getRouteKindLabel, isGpsOrMergedRoute } from "../../../utils/routeTypes";
import { notify } from "../../../utils/swalToast";

export function RouteDetail() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [route, setRoute] = useState(null);
    const [mapStations, setMapStations] = useState([]);
    const [routeLine, setRouteLine] = useState([]);

    const [routeForm, setRouteForm] = useState(null);
    const [isSavingRouteInfo, setIsSavingRouteInfo] = useState(false);

    const loadRouteDetail = useCallback(async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");

            const [detail, allStations] = await Promise.all([
                fetchRouteDetail(id),
                fetchAllStations().catch(() => [])
            ]);

            setRoute(detail);

            // PUT chỉ: tên, mô tả, km/phút, status — routeType/isBookable do BE quản lý
            setRouteForm({
                routeName: detail.routeName || "",
                description: detail.description || "",
                baseDistanceKm: detail.baseDistanceKm ?? "",
                estimatedDurationMin: detail.estimatedDurationMin ?? "",
                status: detail.status || "Active",
            });

            const stationCoordsById = new Map(
                (allStations || []).map((s) => [String(s.stationId ?? s.id ?? ""), s])
            );
            const stops = (detail.stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);

            // Marker bến lấy từ stops[] theo stopOrder (không giới hạn 2 điểm)
            const stopsWithCoords = stops
                .map(stop => {
                    const stationInfo = stationCoordsById.get(String(stop.stationId ?? ""));
                    const latitude = stop.latitude ?? stop.station?.latitude ?? stationInfo?.latitude;
                    const longitude = stop.longitude ?? stop.station?.longitude ?? stationInfo?.longitude;
                    if (latitude == null || longitude == null) return null;
                    return {
                        stationId: String(stop.stationId ?? stationInfo?.stationId ?? ""),
                        stationName: stop.stationName || stop.station?.stationName || stationInfo?.stationName,
                        address: stationInfo?.address || stop.station?.address,
                        latitude: Number(latitude),
                        longitude: Number(longitude),
                        status: "Active"
                    };
                })
                .filter(Boolean);
            setMapStations(stopsWithCoords);

            // Ưu tiên vẽ đúng routeGeometry từ BE (không nối thẳng start-end)
            let line = geometryToCoordinates(detail.routeGeometry);
            if (line.length === 0 && detail.waterwayId) {
                try {
                    const waterway = await fetchWaterwayDetail(detail.waterwayId);
                    line = geometryToCoordinates(waterway?.coordinates || waterway?.geometry || []);
                } catch {
                    /* ignore */
                }
            }
            if (line.length === 0 && stopsWithCoords.length >= 2) {
                line = stopsWithCoords.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
            }
            setRouteLine(line);
        } catch (error) {
            console.error("Lỗi khi tải chi tiết tuyến đường:", error);
            if (error.response?.status === 404) {
                notify({
                    icon: "error",
                    title: lang === "VN" ? "Không tìm thấy tuyến đường!" : "Route Not Found!",
                    text: lang === "VN" ? "Mã định danh tuyến đường không tồn tại. Quay về danh sách." : "The requested route logs do not exist.",
                    confirmButtonColor: "#124757",
                    allowOutsideClick: false
                }).then(() => navigate("/admin/routes-management"));
            } else {
                setErrorMsg(lang === "VN" ? "Không thể lấy thông tin tuyến đường do lỗi kết nối mạng." : "Failed to retrieve route details.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [id, lang, navigate]);

    useEffect(() => {
        loadRouteDetail();
    }, [loadRouteDetail]);

    const handleRouteFormChange = (field, value) => {
        setRouteForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveRouteInfo = async (e) => {
        e.preventDefault();
        try {
            setIsSavingRouteInfo(true);
            setErrorMsg("");

            await modifyRoute(id, {
                routeName: routeForm.routeName.trim(),
                description: routeForm.description.trim() || null,
                baseDistanceKm: routeForm.baseDistanceKm === "" ? null : Number(routeForm.baseDistanceKm),
                estimatedDurationMin: routeForm.estimatedDurationMin === "" ? null : Number(routeForm.estimatedDurationMin),
                status: routeForm.status,
            });
            await loadRouteDetail();
            notify({
                icon: "success",
                title: lang === "VN" ? "Đã cập nhật tuyến đường!" : "Route Updated!",
                confirmButtonColor: "#124757",
                timer: 1600,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Lỗi khi cập nhật tuyến đường:", error);
            setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể cập nhật thông tin tuyến đường." : "Failed to update route."));
        } finally {
            setIsSavingRouteInfo(false);
        }
    };


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!route || !routeForm) {
        return (
            <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
                {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                        {errorMsg}
                    </div>
                )}
            </div>
        );
    }

    const sortedStops = (route.stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);

    const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";
    const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate("/admin/routes-management")}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 transition-all flex items-center justify-center shadow-inner shrink-0"
                >
                    <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
                </button>
                <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? `Chi tiết tuyến: ${route.routeName}` : `Route Detail: ${route.routeName}`}
                    </h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                    </span>
                    <button
                        type="button"
                        onClick={() => handleRouteFormChange("status", routeForm.status === "Active" ? "Inactive" : "Active")}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${routeForm.status === "Active" ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                    >
                        <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition duration-300 ease-in-out ${routeForm.status === "Active" ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                    </button>
                    <span className={`text-xs font-black uppercase tracking-wider ${routeForm.status === "Active" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                        {routeForm.status}
                    </span>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <form onSubmit={handleSaveRouteInfo} className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                    {lang === "VN" ? "Chỉnh sửa thông tin tuyến" : "Edit Route Info"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Mã tuyến" : "Route Code"}</label>
                        <input type="text" disabled value={route.routeCode} className={`${inputStyle} opacity-60 cursor-not-allowed`} />
                    </div>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Loại tuyến" : "Route Type"}</label>
                        <div className={`${inputStyle} opacity-60 cursor-not-allowed flex items-center`}>
                            {getRouteKindLabel(route, lang)}
                        </div>
                    </div>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Tên tuyến đường (*)" : "Route Name (*)"}</label>
                        <input
                            type="text" required value={routeForm.routeName}
                            onChange={(e) => handleRouteFormChange("routeName", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelStyle}>{lang === "VN" ? "Mô tả chi tiết" : "Description"}</label>
                    <textarea
                        rows={2} value={routeForm.description}
                        onChange={(e) => handleRouteFormChange("description", e.target.value)}
                        className={`${inputStyle} resize-none font-medium`}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Khoảng cách (km)" : "Base Distance (km)"}</label>
                        <input
                            type="number" step="any" min={0} value={routeForm.baseDistanceKm}
                            disabled
                            className={`${inputStyle} opacity-60 cursor-not-allowed`}
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Thời gian dự kiến (phút)" : "Estimated Duration (min)"}</label>
                        <input
                            type="number" step="any" min={0} value={routeForm.estimatedDurationMin}
                            disabled
                            className={`${inputStyle} opacity-60 cursor-not-allowed`}
                        />
                    </div>
                </div>

                <button type="submit" disabled={isSavingRouteInfo} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {isSavingRouteInfo && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thông tin tuyến" : "Save Route Info"}
                </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                        {lang === "VN" ? "Lộ trình bến dừng" : "Stop Sequence"}
                    </h3>
                    {isGpsOrMergedRoute(route) && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            {lang === "VN"
                                ? "Lộ trình do GPS/ghép tuyến tạo, không chỉnh sửa bến dừng."
                                : "Route created by GPS/merge — stops are read-only."}
                        </p>
                    )}

                    {sortedStops.length === 0 ? (
                        <p className="text-xs text-slate-400 italic font-medium text-center py-6">
                            {lang === "VN" ? "Tuyến đường chưa có bến dừng nào." : "No stops configured for this route."}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {sortedStops.map((stop, index) => {
                                const isFirstStop = index === 0;
                                const travelMin = stop.standardTravelMin;
                                return (
                                    <div key={stop.routeStopId || index} className="flex items-start gap-3 relative">
                                        {index < sortedStops.length - 1 && (
                                            <div className="absolute left-4 top-9 w-px h-full bg-slate-200 dark:bg-slate-700"></div>
                                        )}
                                        <div className="w-8 h-8 rounded-full bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center text-[11px] font-black font-headline shrink-0 shadow-sm z-10">
                                            {stop.stopOrder}
                                        </div>
                                        <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{stop.stationName}</h4>
                                                <span className="font-headline font-black text-[9px] tracking-wide text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0">
                                                    {stop.stationCode}
                                                </span>
                                            </div>

                                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                <span className="font-bold uppercase tracking-wide text-slate-400 mr-1">
                                                    {lang === "VN" ? "Phút chạy:" : "Travel:"}
                                                </span>
                                                {isFirstStop || travelMin == null || travelMin === ""
                                                    ? "—"
                                                    : `${travelMin} ${lang === "VN" ? "phút" : "min"}`}
                                            </p>

                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${stop.isPickupAllowed ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                                                    <span className="material-symbols-outlined text-[11px]">arrow_upward</span>
                                                    {lang === "VN" ? "Đón khách" : "Pickup"}
                                                </span>
                                                <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${stop.isDropoffAllowed ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}>
                                                    <span className="material-symbols-outlined text-[11px]">arrow_downward</span>
                                                    {lang === "VN" ? "Trả khách" : "Dropoff"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-145">
                    <div>
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">{lang === "VN" ? "Bản đồ lộ trình" : "Route Mapping"}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 mb-4">
                            {lang === "VN" ? "Vị trí các bến dừng của tuyến đường trên bản đồ." : "Visual placement of this route's stops on the map."}
                        </p>
                    </div>
                    <div className="flex-1 w-full relative min-h-75">
                        <WaterwayMap
                            coordinates={routeLine}
                            waterwayName={route.routeName}
                            stationsList={mapStations}
                            hideStationLink
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
