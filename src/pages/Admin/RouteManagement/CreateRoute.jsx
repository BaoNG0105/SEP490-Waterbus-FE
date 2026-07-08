import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { createNewRoute, importGeoJsonNetwork } from "../../../services/routeService";
import { fetchAllStations } from "../../../services/stationService";
import { fetchWaterways } from "../../../services/waterwayService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import Swal from "sweetalert2";

let waypointUid = 0;
const nextWaypointUid = () => `wp-${++waypointUid}`;

export function CreateRoute() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const [stationsList, setStationsList] = useState([]);
    const [waterwaysList, setWaterwaysList] = useState([]);
    const [isLoadingRefs, setIsLoadingRefs] = useState(true);

    const [geoJsonFile, setGeoJsonFile] = useState(null);
    const [isImportingGeoJson, setIsImportingGeoJson] = useState(false);

    const [formData, setFormData] = useState({
        routeCode: "",
        routeName: "",
        description: "",
        estimatedDurationMin: 60,
        autoRouteGeometry: true,
        preferWaterwayType: ""
    });

    // Danh sách waypoint theo thứ tự (stopOrder = vị trí index + 1)
    const [waypoints, setWaypoints] = useState([
        { uid: nextWaypointUid(), type: "station", stationCode: "", waterwayOsmId: "" },
        { uid: nextWaypointUid(), type: "station", stationCode: "", waterwayOsmId: "" }
    ]);

    const loadReferenceData = useCallback(async () => {
        try {
            setIsLoadingRefs(true);
            const [stations, waterways] = await Promise.all([
                fetchAllStations().catch(() => []),
                fetchWaterways().catch(() => [])
            ]);
            setStationsList((stations || []).filter(s => s.status === "Active"));
            setWaterwaysList(waterways || []);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu tham chiếu nhà ga/tuyến sông:", error);
        } finally {
            setIsLoadingRefs(false);
        }
    }, []);

    useEffect(() => {
        loadReferenceData();
    }, [loadReferenceData]);

    const handleImportGeoJson = async (e) => {
        e.preventDefault();
        if (!geoJsonFile) return;
        try {
            setIsImportingGeoJson(true);
            setErrorMsg("");
            await importGeoJsonNetwork(geoJsonFile);
            setGeoJsonFile(null);
            await loadReferenceData();
            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Import thành công!" : "Import Successful!",
                text: lang === "VN"
                    ? "Dữ liệu sông rạch và bến tàu đã được cập nhật, danh sách waypoint bên dưới đã được làm mới."
                    : "Waterway and station data has been updated; the waypoint lists below have been refreshed.",
                confirmButtonColor: "#124757"
            });
        } catch (error) {
            console.error("Lỗi khi import GeoJSON:", error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Import thất bại!" : "Import Failed!",
                text: error.response?.data?.message || (lang === "VN"
                    ? "Không thể import file GeoJSON. Vui lòng kiểm tra định dạng file."
                    : "Failed to import the GeoJSON file. Please check the file format."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setIsImportingGeoJson(false);
        }
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleWaypointChange = (uid, field, value) => {
        setWaypoints(prev => prev.map(wp => wp.uid === uid ? { ...wp, [field]: value } : wp));
    };

    const handleWaypointTypeChange = (uid, type) => {
        setWaypoints(prev => prev.map(wp => wp.uid === uid ? { ...wp, type, stationCode: "", waterwayOsmId: "" } : wp));
    };

    const addWaypoint = (type) => {
        setWaypoints(prev => [...prev, { uid: nextWaypointUid(), type, stationCode: "", waterwayOsmId: "" }]);
    };

    const removeWaypoint = (uid) => {
        setWaypoints(prev => prev.filter(wp => wp.uid !== uid));
    };

    const moveWaypoint = (index, direction) => {
        setWaypoints(prev => {
            const targetIndex = index + direction;
            if (targetIndex < 0 || targetIndex >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
            return next;
        });
    };

    // Không có waypoint viaWaterway nào => backend không có dữ liệu sông để dựng RouteGeometry thật,
    // sẽ fallback nối thẳng (as-the-crow-flies) giữa các station, có thể cắt ngang qua đất liền
    const hasViaWaterwayWaypoint = waypoints.some(wp => wp.type === "viaWaterway");

    // Xây dựng danh sách nhà ga đã chọn để hiển thị trực quan trên bản đồ
    const selectedMapStations = waypoints
        .filter(wp => wp.type === "station" && wp.stationCode)
        .map(wp => stationsList.find(s => s.stationCode === wp.stationCode))
        .filter(Boolean)
        .map(s => ({ ...s, status: "Active" }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            setErrorMsg("");

            const stationWaypoints = waypoints.filter(wp => wp.type === "station");
            if (stationWaypoints.length < 2) {
                setErrorMsg(lang === "VN" ? "Tuyến đường phải có ít nhất 2 waypoint loại station." : "Route must contain at least 2 station waypoints.");
                return;
            }
            if (waypoints[0].type !== "station" || waypoints[waypoints.length - 1].type !== "station") {
                setErrorMsg(lang === "VN" ? "Waypoint đầu và cuối bắt buộc phải là loại station." : "First and last waypoints must be of type station.");
                return;
            }
            if (waypoints.some(wp => wp.type === "station" && !wp.stationCode)) {
                setErrorMsg(lang === "VN" ? "Vui lòng chọn nhà ga cho tất cả waypoint loại station." : "Please select a station for every station waypoint.");
                return;
            }
            if (waypoints.some(wp => wp.type === "viaWaterway" && !wp.waterwayOsmId)) {
                setErrorMsg(lang === "VN" ? "Vui lòng chọn tuyến sông cho tất cả waypoint loại viaWaterway." : "Please select a waterway for every viaWaterway waypoint.");
                return;
            }

            setIsSubmitting(true);

            const payload = {
                routeCode: formData.routeCode.trim().toUpperCase(),
                routeName: formData.routeName.trim(),
                description: formData.description.trim() || null,
                estimatedDurationMin: Number(formData.estimatedDurationMin) || 0,
                waypoints: waypoints.map((wp, index) => (
                    wp.type === "station"
                        ? { type: "station", stationCode: wp.stationCode, stopOrder: index + 1 }
                        : { type: "viaWaterway", waterwayOsmId: wp.waterwayOsmId, stopOrder: index + 1 }
                )),
                autoRouteGeometry: formData.autoRouteGeometry,
                preferWaterwayType: formData.preferWaterwayType || null
            };

            await createNewRoute(payload);

            Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Tạo tuyến thành công!" : "Route Created!",
                text: lang === "VN" ? "Tuyến đường sông mới đã được lưu trữ an toàn." : "New river route has been successfully saved.",
                confirmButtonColor: "#124757"
            }).then(() => navigate("/admin/routes-management"));

        } catch (error) {
            console.error("Lỗi tạo tuyến đường:", error);
            let validationError = "";
            if (error.response?.data?.errors) {
                validationError = Object.values(error.response.data.errors).flat().join(" | ");
            }
            setErrorMsg(validationError || error.response?.data?.message || (lang === "VN" ? "Gặp lỗi trong quá trình tạo tuyến đường." : "Failed to create route."));
        } finally {
            setIsSubmitting(false);
        }
    };

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
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Tạo tuyến đường sông mới" : "Create New River Route"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Thiết lập thông tin tuyến, thứ tự bến dừng và đoạn tuyến sông liên kết." : "Configure route profile, stop sequencing and connecting waterway segments."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            {/* IMPORT MẠNG LƯỚI SÔNG RẠCH & BẾN TỪ FILE GEOJSON (BƯỚC CHUẨN BỊ DỮ LIỆU NỀN, KHÔNG BẮT BUỘC) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
                <div>
                    <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                        {lang === "VN" ? "Import mạng lưới sông rạch (GeoJSON)" : "Import Waterway Network (GeoJSON)"}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {lang === "VN"
                            ? "Tùy chọn: tải lên file .geojson chứa mạng lưới sông/kênh rạch và bến tàu để bổ sung dữ liệu waterway/station dùng cho waypoints bên dưới."
                            : "Optional: upload a .geojson file containing the river/canal network and ferry stations to populate the waterway/station data used by the waypoints below."}
                        {" "}
                        <button
                            type="button"
                            onClick={() => navigate("/admin/routes-management/draw-waterway")}
                            className="text-[#124757] dark:text-yellow-400 font-bold underline underline-offset-2 hover:brightness-110"
                        >
                            {lang === "VN" ? "Chưa có file? Vẽ tay tại đây →" : "No file yet? Draw it manually →"}
                        </button>
                    </p>
                </div>

                <form onSubmit={handleImportGeoJson} className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 flex items-center gap-3 border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl px-4 py-3 cursor-pointer transition-all">
                        <span className="material-symbols-outlined text-slate-400">upload_file</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate flex-1">
                            {geoJsonFile ? geoJsonFile.name : (lang === "VN" ? "Chọn tệp .geojson..." : "Choose .geojson file...")}
                        </span>
                        <input
                            type="file"
                            accept=".geojson,application/geo+json,application/json"
                            onChange={(e) => setGeoJsonFile(e.target.files[0] || null)}
                            className="hidden"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={!geoJsonFile || isImportingGeoJson}
                        className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-headline font-black uppercase text-xs tracking-wider shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shrink-0"
                    >
                        {isImportingGeoJson
                            ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            : <span className="material-symbols-outlined text-sm">cloud_upload</span>}
                        {lang === "VN" ? "Import dữ liệu" : "Import Data"}
                    </button>
                </form>
            </div>

            <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                {/* PANEL BÊN TRÁI: FORM THÔNG TIN + WAYPOINTS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* THÔNG TIN CHUNG TUYẾN ĐƯỜNG */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                            {lang === "VN" ? "Thông tin tuyến đường" : "Route Profile"}
                        </h3>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Mã tuyến (*)" : "Route Code (*)"}</label>
                            <input
                                type="text" required value={formData.routeCode}
                                onChange={(e) => handleFieldChange("routeCode", e.target.value.toUpperCase())}
                                placeholder="R01-BD-LD"
                                className={`${inputStyle} uppercase`}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Tên tuyến đường (*)" : "Route Name (*)"}</label>
                            <input
                                type="text" required value={formData.routeName}
                                onChange={(e) => handleFieldChange("routeName", e.target.value)}
                                placeholder={lang === "VN" ? "Tuyến 01: Bạch Đằng - Linh Đông" : "Route 01: Bach Dang - Linh Dong"}
                                className={inputStyle}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Thời gian dự kiến (phút)" : "Estimated Duration (min)"}</label>
                            <input
                                type="number" min={0} value={formData.estimatedDurationMin}
                                onChange={(e) => handleFieldChange("estimatedDurationMin", e.target.value)}
                                className={inputStyle}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Mô tả chi tiết" : "General Description"}</label>
                            <textarea
                                rows={2} value={formData.description}
                                onChange={(e) => handleFieldChange("description", e.target.value)}
                                className={`${inputStyle} resize-none font-medium`}
                            />
                        </div>

                        {/* TÙY CHỌN NÂNG CAO SINH GEOMETRY TỰ ĐỘNG */}
                        <div className="p-3 bg-blue-50/50 dark:bg-slate-900/50 border border-blue-100 dark:border-slate-700 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-blue-800 dark:text-yellow-400 tracking-wider flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                                    {lang === "VN" ? "Tự động sinh lộ trình" : "Auto Route Geometry"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleFieldChange("autoRouteGeometry", !formData.autoRouteGeometry)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${formData.autoRouteGeometry ? 'bg-yellow-400' : 'bg-slate-300 dark:bg-slate-600'
                                        }`}
                                >
                                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${formData.autoRouteGeometry ? 'translate-x-4' : 'translate-x-0'
                                        }`} />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                {lang === "VN" ? "Nếu bật, hệ thống dùng dữ liệu waterway đã import để tự tạo RouteGeometry từ các waypoint viaWaterway." : "When enabled, the system builds RouteGeometry from imported waterway data for viaWaterway waypoints."}
                            </p>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">{lang === "VN" ? "Loại tuyến sông ưu tiên" : "Preferred Waterway Type"}</label>
                                <select
                                    value={formData.preferWaterwayType}
                                    onChange={(e) => handleFieldChange("preferWaterwayType", e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757]"
                                >
                                    <option value="">{lang === "VN" ? "-- Không ưu tiên --" : "-- No preference --"}</option>
                                    <option value="river">{lang === "VN" ? "Sông (river)" : "River"}</option>
                                    <option value="canal">{lang === "VN" ? "Kênh rạch (canal)" : "Canal"}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* DANH SÁCH WAYPOINTS */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                            <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
                                {lang === "VN" ? "Waypoints lộ trình" : "Route Waypoints"}
                            </h3>
                            <span className="text-[9px] text-slate-400 font-bold uppercase">{lang === "VN" ? "Đầu & cuối phải là station" : "First & last must be station"}</span>
                        </div>

                        {!hasViaWaterwayWaypoint && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                                <span className="material-symbols-outlined text-amber-500 text-base shrink-0">warning</span>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                    {lang === "VN"
                                        ? "Chưa có waypoint \"Đoạn sông\" nào. Nếu không thêm, hệ thống sẽ nối thẳng (đường chim bay) giữa các bến vì không có dữ liệu sông để dựng lộ trình thật — đường có thể cắt ngang qua đất liền. Hãy thêm waypoint \"Đoạn sông\" giữa các bến để tuyến đi đúng theo luồng lạch."
                                        : "No \"Waterway\" waypoint added yet. Without one, the system will connect stations with a straight (as-the-crow-flies) line since there's no river data to build the real path — it may cut across land. Add a \"Waterway\" waypoint between stations so the route follows the actual waterway."}
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {waypoints.map((wp, index) => {
                                const isEdgeWaypoint = index === 0 || index === waypoints.length - 1;
                                return (
                                <div key={wp.uid} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center text-[10px] font-black font-headline shrink-0">
                                                {index + 1}
                                            </span>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleWaypointTypeChange(wp.uid, "station")}
                                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all ${wp.type === "station" ? "bg-[#124757] text-white border-transparent dark:bg-yellow-400 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                        }`}
                                                >
                                                    {lang === "VN" ? "Trạm" : "Station"}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isEdgeWaypoint}
                                                    onClick={() => handleWaypointTypeChange(wp.uid, "viaWaterway")}
                                                    title={isEdgeWaypoint ? (lang === "VN" ? "Waypoint đầu/cuối bắt buộc là station" : "First/last waypoint must be a station") : undefined}
                                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${wp.type === "viaWaterway" ? "bg-[#124757] text-white border-transparent dark:bg-yellow-400 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                                        }`}
                                                >
                                                    {lang === "VN" ? "Đoạn sông" : "Waterway"}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button type="button" disabled={index === 0} onClick={() => moveWaypoint(index, -1)} className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                                            </button>
                                            <button type="button" disabled={index === waypoints.length - 1} onClick={() => moveWaypoint(index, 1)} className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                                            </button>
                                            <button type="button" disabled={waypoints.length <= 2} onClick={() => removeWaypoint(wp.uid)} className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    {wp.type === "station" ? (
                                        <select
                                            required
                                            value={wp.stationCode}
                                            onChange={(e) => handleWaypointChange(wp.uid, "stationCode", e.target.value)}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                        >
                                            <option value="">{isLoadingRefs ? (lang === "VN" ? "Đang tải nhà ga..." : "Loading stations...") : (lang === "VN" ? "-- Chọn nhà ga --" : "-- Select station --")}</option>
                                            {stationsList.map((s) => (
                                                <option key={s.stationId} value={s.stationCode}>
                                                    {s.stationCode} - {s.stationName}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <select
                                            required
                                            value={wp.waterwayOsmId}
                                            onChange={(e) => handleWaypointChange(wp.uid, "waterwayOsmId", e.target.value)}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                        >
                                            <option value="">{isLoadingRefs ? (lang === "VN" ? "Đang tải tuyến sông..." : "Loading waterways...") : (lang === "VN" ? "-- Chọn tuyến sông --" : "-- Select waterway --")}</option>
                                            {waterwaysList.map((w) => (
                                                <option key={w.id} value={w.osmId}>
                                                    {w.waterwayName || `Sông không tên (${w.osmId})`} [{w.totalLengthKm} km]
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => addWaypoint("station")}
                                className="flex-1 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-500 flex items-center justify-center gap-1.5 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">add_location_alt</span>
                                {lang === "VN" ? "Thêm trạm" : "Add Station"}
                            </button>
                            <button
                                type="button"
                                onClick={() => addWaypoint("viaWaterway")}
                                className="flex-1 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-500 flex items-center justify-center gap-1.5 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">water</span>
                                {lang === "VN" ? "Thêm đoạn sông" : "Add Waterway"}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={isSubmitting} className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {isSubmitting && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                        {lang === "VN" ? "Tạo tuyến đường" : "Create Route"}
                    </button>
                </div>

                {/* PANEL BÊN PHẢI: BẢN ĐỒ XEM TRƯỚC VỊ TRÍ CÁC TRẠM ĐÃ CHỌN */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-145 sticky top-4">
                    <div>
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">{lang === "VN" ? "Xem trước lộ trình (GIS Map)" : "Route Preview (GIS Map)"}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 mb-4">
                            {lang === "VN" ? "Vị trí các nhà ga đã chọn ở waypoint loại station." : "Preview of selected station waypoints on the map."}
                        </p>
                    </div>
                    <div className="flex-1 w-full relative min-h-75">
                        <WaterwayMap stationsList={selectedMapStations} hideStationLink />
                    </div>
                </div>
            </form>
        </div>
    );
}
