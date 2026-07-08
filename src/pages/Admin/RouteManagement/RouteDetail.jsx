import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import {
    fetchRouteDetail,
    modifyRoute,
    removeRoute,
    addStopToRoute,
    modifyRouteStop,
    removeRouteStop
} from "../../../services/routeService";
import { fetchAllStations } from "../../../services/stationService";
import { fetchWaterwayDetail } from "../../../services/waterwayService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import Swal from "sweetalert2";

// routeGeometry trả về dạng GeoJSON [lng, lat] -> quy đổi sang {latitude, longitude} cho WaterwayMap
const geometryToCoordinates = (geometry) => {
    if (!Array.isArray(geometry)) return [];
    return geometry
        .filter(point => Array.isArray(point) && point.length >= 2)
        .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
};

// "Khoét" tọa độ từng bến vào đúng vị trí của nó trên đường tuyến sông (routeGeometry), để đường vẽ
// bẻ một góc chữ V ra bến rồi tiếp tục đúng điểm kế tiếp trên luồng lạch. Bến phải được truyền vào
// đúng thứ tự stopOrder để giữ tuyến đi đúng chiều. routeGeometry do backend sinh thường dài hơn thực
// tế (phủ luôn đoạn waterway trước bến đầu/sau bến cuối), nên cắt bỏ hẳn phần dư ở cả hai đầu - tuyến
// chỉ vẽ từ đúng bến đầu tiên đến đúng bến cuối cùng.
const spliceStationsIntoRouteLine = (linePositions, orderedStations) => {
    if (!linePositions || linePositions.length === 0) return [];
    if (!orderedStations || orderedStations.length === 0) return linePositions;

    const result = [];
    let cursor = 0;

    orderedStations.forEach((station, index) => {
        const stationPos = [station.latitude, station.longitude];

        // Chỉ tìm về phía trước kể từ cursor hiện tại để không đảo ngược chiều tuyến
        let nearestIndex = cursor;
        let minDistSq = Infinity;
        for (let i = cursor; i < linePositions.length; i++) {
            const dLat = linePositions[i][0] - stationPos[0];
            const dLng = linePositions[i][1] - stationPos[1];
            const distSq = dLat * dLat + dLng * dLng;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearestIndex = i;
            }
        }

        if (index === 0) {
            // Bến đầu tiên: bỏ hẳn phần luồng lạch dư phía trước, tuyến bắt đầu ngay tại bến
            result.push(stationPos);
        } else {
            // Nối đoạn tuyến sông đến ngay trước điểm rẽ, bẻ góc ra bến (không lặp lại điểm vừa đi qua)
            result.push(...linePositions.slice(cursor, nearestIndex));
            result.push(stationPos);
        }

        cursor = nearestIndex;
    });

    // Bến cuối cùng: không nối thêm phần luồng lạch dư phía sau, tuyến kết thúc ngay tại bến
    return result;
};

const emptyNewStopForm = {
    stationCode: "",
    stopOrder: 1,
    standardTravelMin: "",
    standardDwellMin: 2,
    isPickupAllowed: true,
    isDropoffAllowed: true
};

export function RouteDetail() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { id } = useParams();

    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [route, setRoute] = useState(null);
    const [mapStations, setMapStations] = useState([]);
    const [routeLine, setRouteLine] = useState([]);
    const [stationsList, setStationsList] = useState([]);

    const [routeForm, setRouteForm] = useState(null);
    const [isSavingRouteInfo, setIsSavingRouteInfo] = useState(false);
    const [isDeletingRoute, setIsDeletingRoute] = useState(false);

    const [stopEdits, setStopEdits] = useState({});
    const [savingStopId, setSavingStopId] = useState(null);
    const [deletingStopId, setDeletingStopId] = useState(null);

    const [newStopForm, setNewStopForm] = useState(emptyNewStopForm);
    const [isAddingStop, setIsAddingStop] = useState(false);

    const loadRouteDetail = useCallback(async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");

            const [detail, allStations] = await Promise.all([
                fetchRouteDetail(id),
                fetchAllStations().catch(() => [])
            ]);

            setRoute(detail);
            setStationsList((allStations || []).filter(s => s.status === "Active"));

            setRouteForm({
                routeName: detail.routeName || "",
                description: detail.description || "",
                baseDistanceKm: detail.baseDistanceKm ?? "",
                estimatedDurationMin: detail.estimatedDurationMin ?? "",
                status: detail.status || "Active"
            });

            const stationCoordsById = new Map((allStations || []).map(s => [s.stationId, s]));
            const stops = (detail.stops || []).slice().sort((a, b) => a.stopOrder - b.stopOrder);

            const stopEditsMap = {};
            stops.forEach(stop => {
                stopEditsMap[stop.routeStopId] = {
                    standardTravelMin: stop.standardTravelMin ?? "",
                    standardDwellMin: stop.standardDwellMin ?? "",
                    isPickupAllowed: !!stop.isPickupAllowed,
                    isDropoffAllowed: !!stop.isDropoffAllowed
                };
            });
            setStopEdits(stopEditsMap);
            setNewStopForm(prev => ({
                ...prev,
                stopOrder: stops.length > 0 ? Math.max(...stops.map(s => s.stopOrder)) + 1 : 1
            }));

            // Ghép tọa độ (lat/lng) từ danh sách nhà ga đầy đủ vào từng bến dừng của tuyến để vẽ bản đồ
            const stopsWithCoords = stops
                .map(stop => {
                    const stationInfo = stationCoordsById.get(stop.stationId);
                    if (!stationInfo) return null;
                    return {
                        stationId: stop.stationId,
                        stationName: stop.stationName,
                        address: stationInfo.address,
                        latitude: stationInfo.latitude,
                        longitude: stationInfo.longitude,
                        status: "Active"
                    };
                })
                .filter(Boolean);
            setMapStations(stopsWithCoords);

            // Ưu tiên vẽ đường sông thực tế từ routeGeometry đã được backend tự sinh sẵn
            let coordinates = geometryToCoordinates(detail.routeGeometry);

            // Fallback: nếu chưa có routeGeometry, dựng lại đường đi bằng cách tra cứu từng waterway đã import qua waterwayApi
            if (coordinates.length === 0 && Array.isArray(detail.segments) && detail.segments.length > 0) {
                try {
                    const sortedSegments = detail.segments.slice().sort((a, b) => (a.segmentOrder || 0) - (b.segmentOrder || 0));
                    const waterwayIds = sortedSegments.map(seg => seg.waterwayId || seg.wayId).filter(Boolean);
                    const waterwayDetails = await Promise.all(
                        waterwayIds.map(waterwayId => fetchWaterwayDetail(waterwayId).catch(() => null))
                    );
                    coordinates = waterwayDetails
                        .filter(Boolean)
                        .flatMap(wd => (wd.segments || [])
                            .slice()
                            .sort((a, b) => a.segmentOrder - b.segmentOrder)
                            .flatMap(s => s.coordinates || []));
                } catch (fallbackError) {
                    console.error("Không dựng được đường sông từ segments/waterwayApi:", fallbackError);
                }
            }

            // Rẽ đường tuyến vào đúng vị trí từng bến theo thứ tự stopOrder rồi quay lại luồng lạch
            if (coordinates.length > 0 && stopsWithCoords.length > 0) {
                const linePositions = coordinates.map(c => [c.latitude, c.longitude]);
                const splicedPositions = spliceStationsIntoRouteLine(linePositions, stopsWithCoords);
                coordinates = splicedPositions.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
            }

            setRouteLine(coordinates);

        } catch (error) {
            console.error("Lỗi khi tải chi tiết tuyến đường:", error);
            if (error.response?.status === 404) {
                Swal.fire({
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
                status: routeForm.status
            });
            await loadRouteDetail();
            Swal.fire({
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

    const handleDeleteRoute = async () => {
        const result = await Swal.fire({
            icon: "warning",
            title: lang === "VN" ? "Xóa tuyến đường?" : "Delete Route?",
            text: lang === "VN"
                ? "Chỉ xóa được tuyến chưa có chuyến đi (trip) nào. Nếu tuyến đã có trip, hãy chuyển trạng thái sang Inactive thay vì xóa."
                : "Only routes without any trips can be deleted. If this route already has trips, set status to Inactive instead.",
            showCancelButton: true,
            confirmButtonText: lang === "VN" ? "Xóa tuyến" : "Delete",
            cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#124757"
        });
        if (!result.isConfirmed) return;

        try {
            setIsDeletingRoute(true);
            await removeRoute(id);
            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Đã xóa tuyến đường!" : "Route Deleted!",
                confirmButtonColor: "#124757"
            }).then(() => navigate("/admin/routes-management"));
        } catch (error) {
            console.error("Lỗi khi xóa tuyến đường:", error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa tuyến!" : "Cannot Delete Route!",
                text: error.response?.data?.message || (lang === "VN"
                    ? "Tuyến đường đã có chuyến đi. Hãy chuyển trạng thái sang Inactive thay vì xóa."
                    : "This route already has trips. Set status to Inactive instead."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setIsDeletingRoute(false);
        }
    };

    const handleStopFieldChange = (stopId, field, value) => {
        setStopEdits(prev => ({ ...prev, [stopId]: { ...prev[stopId], [field]: value } }));
    };

    const handleSaveStop = async (stopId) => {
        const editValues = stopEdits[stopId];
        if (!editValues) return;
        try {
            setSavingStopId(stopId);
            setErrorMsg("");
            await modifyRouteStop(id, stopId, {
                standardTravelMin: editValues.standardTravelMin === "" ? null : Number(editValues.standardTravelMin),
                standardDwellMin: editValues.standardDwellMin === "" ? null : Number(editValues.standardDwellMin),
                isPickupAllowed: editValues.isPickupAllowed,
                isDropoffAllowed: editValues.isDropoffAllowed
            });
            await loadRouteDetail();
        } catch (error) {
            console.error(`Lỗi khi cập nhật bến dừng ${stopId}:`, error);
            setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể cập nhật bến dừng." : "Failed to update stop."));
        } finally {
            setSavingStopId(null);
        }
    };

    const handleDeleteStop = async (stopId) => {
        const result = await Swal.fire({
            icon: "warning",
            title: lang === "VN" ? "Xóa bến dừng này khỏi tuyến?" : "Remove this stop from route?",
            showCancelButton: true,
            confirmButtonText: lang === "VN" ? "Xóa" : "Remove",
            cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#124757"
        });
        if (!result.isConfirmed) return;

        try {
            setDeletingStopId(stopId);
            await removeRouteStop(id, stopId);
            await loadRouteDetail();
        } catch (error) {
            console.error(`Lỗi khi xóa bến dừng ${stopId}:`, error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa bến dừng!" : "Cannot Remove Stop!",
                text: error.response?.data?.message || (lang === "VN" ? "Đã xảy ra lỗi khi xóa bến dừng." : "Failed to remove stop."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setDeletingStopId(null);
        }
    };

    const handleNewStopFieldChange = (field, value) => {
        setNewStopForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddStop = async (e) => {
        e.preventDefault();
        if (!newStopForm.stationCode) {
            setErrorMsg(lang === "VN" ? "Vui lòng chọn nhà ga cho bến dừng mới." : "Please select a station for the new stop.");
            return;
        }
        try {
            setIsAddingStop(true);
            setErrorMsg("");
            await addStopToRoute(id, {
                stationCode: newStopForm.stationCode,
                stopOrder: Number(newStopForm.stopOrder),
                standardTravelMin: newStopForm.standardTravelMin === "" ? null : Number(newStopForm.standardTravelMin),
                standardDwellMin: newStopForm.standardDwellMin === "" ? null : Number(newStopForm.standardDwellMin),
                isPickupAllowed: newStopForm.isPickupAllowed,
                isDropoffAllowed: newStopForm.isDropoffAllowed
            });
            setNewStopForm(emptyNewStopForm);
            await loadRouteDetail();
        } catch (error) {
            console.error("Lỗi khi thêm bến dừng:", error);
            setErrorMsg(error.response?.data?.message || (lang === "VN" ? "Không thể thêm bến dừng vào tuyến." : "Failed to add stop to route."));
        } finally {
            setIsAddingStop(false);
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

            {/* KHỐI TIÊU ĐỀ HEADER TRANG */}
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
                        {lang === "VN" ? `Chi tiết tuyến: ${route.routeCode}` : `Route Detail: ${route.routeCode}`}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {route.routeName}
                    </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border shrink-0 ${route.status === "Active"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${route.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                    {route.status || "Inactive"}
                </span>
                <button
                    type="button"
                    onClick={handleDeleteRoute}
                    disabled={isDeletingRoute}
                    title={lang === "VN" ? "Xóa tuyến đường" : "Delete Route"}
                    className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0 disabled:opacity-50"
                >
                    {isDeletingRoute
                        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        : <span className="material-symbols-outlined text-xl">delete</span>}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            {/* SECTION: KHỐI CARD THÔNG SỐ TUYẾN ĐƯỜNG */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                        <span className="material-symbols-outlined text-2xl">straighten</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Khoảng cách" : "Base Distance"}</span>
                        <h3 className="text-xl font-black font-headline text-blue-600 dark:text-blue-400 mt-0.5">{route.baseDistanceKm != null ? `${route.baseDistanceKm} km` : "—"}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner">
                        <span className="material-symbols-outlined text-2xl">schedule</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Thời gian di chuyển ước tính" : "Estimated Duration"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{route.estimatedDurationMin != null ? `${route.estimatedDurationMin} ${lang === "VN" ? "phút" : "min"}` : "—"}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 shadow-inner">
                        <span className="material-symbols-outlined text-2xl">pin_drop</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số bến dừng" : "Total Stops"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{sortedStops.length}</h3>
                    </div>
                </div>
            </div>

            {/* CHỈNH SỬA THÔNG TIN TUYẾN ĐƯỜNG */}
            <form onSubmit={handleSaveRouteInfo} className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                    {lang === "VN" ? "Chỉnh sửa thông tin tuyến" : "Edit Route Info"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Mã tuyến" : "Route Code"}</label>
                        <input type="text" disabled value={route.routeCode} className={`${inputStyle} opacity-60 cursor-not-allowed`} />
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
                            onChange={(e) => handleRouteFormChange("baseDistanceKm", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                    <div>
                        <label className={labelStyle}>{lang === "VN" ? "Thời gian dự kiến (phút)" : "Estimated Duration (min)"}</label>
                        <input
                            type="number" min={0} value={routeForm.estimatedDurationMin}
                            onChange={(e) => handleRouteFormChange("estimatedDurationMin", e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                    <span className={labelStyle + " mb-0"}>{lang === "VN" ? "Trạng thái" : "Status"}</span>
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

                <button type="submit" disabled={isSavingRouteInfo} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                    {isSavingRouteInfo && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {lang === "VN" ? "Lưu thông tin tuyến" : "Save Route Info"}
                </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                {/* PANEL BÊN TRÁI: DANH SÁCH BẾN DỪNG THEO THỨ TỰ (CÓ THỂ CHỈNH SỬA / XÓA / THÊM MỚI) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                    <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                        {lang === "VN" ? "Lộ trình bến dừng" : "Stop Sequence"}
                    </h3>

                    {sortedStops.length === 0 ? (
                        <p className="text-xs text-slate-400 italic font-medium text-center py-6">
                            {lang === "VN" ? "Tuyến đường chưa có bến dừng nào." : "No stops configured for this route."}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {sortedStops.map((stop, index) => {
                                const edits = stopEdits[stop.routeStopId] || {};
                                return (
                                    <div key={stop.routeStopId || index} className="flex items-start gap-3 relative">
                                        {/* Đường nối dọc thể hiện lộ trình */}
                                        {index < sortedStops.length - 1 && (
                                            <div className="absolute left-4 top-9 w-px h-full bg-slate-200 dark:bg-slate-700"></div>
                                        )}
                                        <div className="w-8 h-8 rounded-full bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center text-[11px] font-black font-headline shrink-0 shadow-sm z-10">
                                            {stop.stopOrder}
                                        </div>
                                        <div className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{stop.stationName}</h4>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-headline font-black text-[9px] tracking-wide text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shrink-0">
                                                        {stop.stationCode}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteStop(stop.routeStopId)}
                                                        disabled={deletingStopId === stop.routeStopId}
                                                        title={lang === "VN" ? "Xóa bến dừng" : "Remove stop"}
                                                        className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 disabled:opacity-40 transition-all shrink-0"
                                                    >
                                                        {deletingStopId === stop.routeStopId
                                                            ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                            : <span className="material-symbols-outlined text-[14px]">delete</span>}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">{lang === "VN" ? "Phút chạy" : "Travel min"}</label>
                                                    <input
                                                        type="number" min={0} value={edits.standardTravelMin}
                                                        onChange={(e) => handleStopFieldChange(stop.routeStopId, "standardTravelMin", e.target.value)}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">{lang === "VN" ? "Phút dừng" : "Dwell min"}</label>
                                                    <input
                                                        type="number" min={0} value={edits.standardDwellMin}
                                                        onChange={(e) => handleStopFieldChange(stop.routeStopId, "standardDwellMin", e.target.value)}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStopFieldChange(stop.routeStopId, "isPickupAllowed", !edits.isPickupAllowed)}
                                                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${edits.isPickupAllowed ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
                                                >
                                                    <span className="material-symbols-outlined text-[11px]">arrow_upward</span>
                                                    {lang === "VN" ? "Đón khách" : "Pickup"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStopFieldChange(stop.routeStopId, "isDropoffAllowed", !edits.isDropoffAllowed)}
                                                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${edits.isDropoffAllowed ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
                                                >
                                                    <span className="material-symbols-outlined text-[11px]">arrow_downward</span>
                                                    {lang === "VN" ? "Trả khách" : "Dropoff"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveStop(stop.routeStopId)}
                                                    disabled={savingStopId === stop.routeStopId}
                                                    className="ml-auto text-[9px] font-black uppercase px-3 py-1 rounded-lg bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-1"
                                                >
                                                    {savingStopId === stop.routeStopId && <div className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                                                    {lang === "VN" ? "Lưu" : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* THÊM BẾN DỪNG MỚI VÀO TUYẾN */}
                    <form onSubmit={handleAddStop} className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{lang === "VN" ? "Thêm bến dừng mới" : "Add New Stop"}</h4>
                        <select
                            required
                            value={newStopForm.stationCode}
                            onChange={(e) => handleNewStopFieldChange("stationCode", e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                        >
                            <option value="">{lang === "VN" ? "-- Chọn nhà ga --" : "-- Select station --"}</option>
                            {stationsList.map((s) => (
                                <option key={s.stationId} value={s.stationCode}>{s.stationCode} - {s.stationName}</option>
                            ))}
                        </select>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">{lang === "VN" ? "Thứ tự" : "Order"}</label>
                                <input
                                    type="number" min={1} required value={newStopForm.stopOrder}
                                    onChange={(e) => handleNewStopFieldChange("stopOrder", e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">{lang === "VN" ? "Phút chạy" : "Travel"}</label>
                                <input
                                    type="number" min={0} value={newStopForm.standardTravelMin}
                                    onChange={(e) => handleNewStopFieldChange("standardTravelMin", e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">{lang === "VN" ? "Phút dừng" : "Dwell"}</label>
                                <input
                                    type="number" min={0} value={newStopForm.standardDwellMin}
                                    onChange={(e) => handleNewStopFieldChange("standardDwellMin", e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleNewStopFieldChange("isPickupAllowed", !newStopForm.isPickupAllowed)}
                                className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${newStopForm.isPickupAllowed ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
                            >
                                <span className="material-symbols-outlined text-[11px]">arrow_upward</span>
                                {lang === "VN" ? "Đón khách" : "Pickup"}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNewStopFieldChange("isDropoffAllowed", !newStopForm.isDropoffAllowed)}
                                className={`text-[9px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 transition-all ${newStopForm.isDropoffAllowed ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" : "text-slate-400 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"}`}
                            >
                                <span className="material-symbols-outlined text-[11px]">arrow_downward</span>
                                {lang === "VN" ? "Trả khách" : "Dropoff"}
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={isAddingStop}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-500 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                            {isAddingStop
                                ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                : <span className="material-symbols-outlined text-sm">add_location_alt</span>}
                            {lang === "VN" ? "Thêm bến dừng" : "Add Stop"}
                        </button>
                    </form>
                </div>

                {/* PANEL BÊN PHẢI: BẢN ĐỒ LỘ TRÌNH TUYẾN */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-145">
                    <div>
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">{lang === "VN" ? "Bản đồ lộ trình (GIS Map)" : "Route GIS Mapping"}</h3>
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
