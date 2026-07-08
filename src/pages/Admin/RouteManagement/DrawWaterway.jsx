import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { importGeoJsonNetwork } from "../../../services/routeService";
import { WaterwayMap } from "../../../components/WaterwayMap";
import Swal from "sweetalert2";

let pointUid = 0;
const nextPointUid = () => `pt-${++pointUid}`;

// Dựng 1 FeatureCollection GeoJSON chuẩn từ đường vẽ tay + các điểm bến đã đặt, đúng định dạng
// mà API POST /routes/geojson-import chấp nhận (LineString waterway + Point amenity=ferry_terminal)
const buildGeoJsonFeatureCollection = ({ linePoints, waterwayName, waterwayType, attachToRoute, fromStationCode, toStationCode, routeCode, stationPoints }) => {
    const features = [];

    if (linePoints.length >= 2) {
        const lineProperties = {};
        if (waterwayName.trim()) lineProperties.name = waterwayName.trim();
        if (waterwayType === "custom") {
            lineProperties.waterway_type = "custom";
        } else {
            lineProperties.waterway = waterwayType;
        }
        if (attachToRoute) {
            if (fromStationCode.trim()) lineProperties.from_station_code = fromStationCode.trim().toUpperCase();
            if (toStationCode.trim()) lineProperties.to_station_code = toStationCode.trim().toUpperCase();
            if (routeCode.trim()) {
                lineProperties.route_code = routeCode.trim().toUpperCase();
                lineProperties.waterbus_route = routeCode.trim().toUpperCase();
            }
        }

        features.push({
            type: "Feature",
            properties: lineProperties,
            geometry: {
                type: "LineString",
                coordinates: linePoints.map(p => [p.longitude, p.latitude])
            }
        });
    }

    stationPoints.forEach((pt) => {
        const pointProperties = { amenity: "ferry_terminal" };
        if (pt.stationName.trim()) pointProperties.name = pt.stationName.trim();
        if (pt.stationCode.trim()) {
            pointProperties.ref = pt.stationCode.trim().toUpperCase();
            pointProperties.station_code = pt.stationCode.trim().toUpperCase();
        }
        features.push({
            type: "Feature",
            properties: pointProperties,
            geometry: {
                type: "Point",
                coordinates: [pt.longitude, pt.latitude]
            }
        });
    });

    return { type: "FeatureCollection", features };
};

export function DrawWaterway() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [mode, setMode] = useState("line"); // "line" | "point"
    const [linePoints, setLinePoints] = useState([]);
    const [stationPoints, setStationPoints] = useState([]);

    const [waterwayName, setWaterwayName] = useState("");
    const [waterwayType, setWaterwayType] = useState("custom");
    const [attachToRoute, setAttachToRoute] = useState(false);
    const [fromStationCode, setFromStationCode] = useState("");
    const [toStationCode, setToStationCode] = useState("");
    const [routeCode, setRouteCode] = useState("");

    const [errorMsg, setErrorMsg] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    const handleMapClick = (lat, lng) => {
        if (mode === "line") {
            setLinePoints(prev => [...prev, { latitude: lat, longitude: lng }]);
        } else {
            setStationPoints(prev => [...prev, { uid: nextPointUid(), latitude: lat, longitude: lng, stationCode: "", stationName: "" }]);
        }
    };

    const handleUndoLastLinePoint = () => {
        setLinePoints(prev => prev.slice(0, -1));
    };

    const handleClearLine = () => {
        setLinePoints([]);
    };

    const handleStationPointChange = (uid, field, value) => {
        setStationPoints(prev => prev.map(pt => pt.uid === uid ? { ...pt, [field]: value } : pt));
    };

    const handleRemoveStationPoint = (uid) => {
        setStationPoints(prev => prev.filter(pt => pt.uid !== uid));
    };

    const mapStationsPreview = stationPoints.map(pt => ({
        stationId: pt.uid,
        stationName: pt.stationName || (lang === "VN" ? "Bến chưa đặt tên" : "Unnamed station"),
        latitude: pt.latitude,
        longitude: pt.longitude,
        status: "Active"
    }));

    const getGeoJsonOrError = () => {
        if (linePoints.length < 2 && stationPoints.length === 0) {
            setErrorMsg(lang === "VN"
                ? "Chưa có dữ liệu để xuất. Hãy vẽ ít nhất 2 điểm đường sông hoặc đặt ít nhất 1 điểm bến."
                : "Nothing to export yet. Draw at least 2 waterway points or place at least 1 station point.");
            return null;
        }
        if (linePoints.length === 1) {
            setErrorMsg(lang === "VN"
                ? "Đường sông cần ít nhất 2 điểm để tạo thành 1 đoạn LineString."
                : "The waterway line needs at least 2 points to form a valid LineString.");
            return null;
        }
        setErrorMsg("");
        return buildGeoJsonFeatureCollection({ linePoints, waterwayName, waterwayType, attachToRoute, fromStationCode, toStationCode, routeCode, stationPoints });
    };

    const handleDownloadGeoJson = () => {
        const geoJson = getGeoJsonOrError();
        if (!geoJson) return;

        const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${waterwayName.trim() ? waterwayName.trim().replace(/\s+/g, "-").toLowerCase() : "waterway"}-${Date.now()}.geojson`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportNow = async () => {
        const geoJson = getGeoJsonOrError();
        if (!geoJson) return;

        try {
            setIsImporting(true);
            const blob = new Blob([JSON.stringify(geoJson)], { type: "application/geo+json" });
            await importGeoJsonNetwork(blob, "drawn-waterway.geojson");

            await Swal.fire({
                icon: "success",
                title: lang === "VN" ? "Import thành công!" : "Import Successful!",
                text: lang === "VN"
                    ? "Dữ liệu vừa vẽ đã được lưu vào mạng lưới sông rạch/bến."
                    : "The drawn data has been saved to the waterway/station network.",
                confirmButtonColor: "#124757"
            });

            setLinePoints([]);
            setStationPoints([]);
        } catch (error) {
            console.error("Lỗi khi import GeoJSON vẽ tay:", error);
            Swal.fire({
                icon: "error",
                title: lang === "VN" ? "Import thất bại!" : "Import Failed!",
                text: error.response?.data?.message || (lang === "VN"
                    ? "Không thể import dữ liệu vừa vẽ. Vui lòng thử lại."
                    : "Failed to import the drawn data. Please try again."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setIsImporting(false);
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
                        {lang === "VN" ? "Vẽ tuyến sông thủ công" : "Draw Waterway Manually"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Click lên bản đồ để vẽ đường sông/kênh rạch và đặt điểm bến, sau đó import trực tiếp hoặc tải file GeoJSON."
                            : "Click on the map to draw a waterway path and place station points, then import directly or download as GeoJSON."}
                    </p>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

                {/* PANEL BÊN TRÁI: CHẾ ĐỘ VẼ + METADATA + DANH SÁCH ĐIỂM BẾN */}
                <div className="lg:col-span-2 space-y-6">

                    {/* CHẾ ĐỘ VẼ TRÊN BẢN ĐỒ */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                            {lang === "VN" ? "Chế độ vẽ trên bản đồ" : "Map Drawing Mode"}
                        </h3>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMode("line")}
                                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all flex items-center justify-center gap-1.5 ${mode === "line" ? "bg-[#124757] text-white border-transparent dark:bg-yellow-400 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}
                            >
                                <span className="material-symbols-outlined text-sm">timeline</span>
                                {lang === "VN" ? "Vẽ đường sông" : "Draw Waterway"}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("point")}
                                className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all flex items-center justify-center gap-1.5 ${mode === "point" ? "bg-[#124757] text-white border-transparent dark:bg-yellow-400 dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"}`}
                            >
                                <span className="material-symbols-outlined text-sm">add_location_alt</span>
                                {lang === "VN" ? "Đặt điểm bến" : "Place Station"}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            {mode === "line"
                                ? (lang === "VN" ? `Mỗi lần click lên bản đồ sẽ thêm 1 điểm vào đường sông. Đã có ${linePoints.length} điểm.` : `Each map click adds a vertex to the waterway line. ${linePoints.length} point(s) so far.`)
                                : (lang === "VN" ? `Mỗi lần click lên bản đồ sẽ đặt 1 điểm bến (ferry_terminal). Đã có ${stationPoints.length} bến.` : `Each map click places a ferry terminal point. ${stationPoints.length} station(s) so far.`)}
                        </p>

                        {mode === "line" && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={linePoints.length === 0}
                                    onClick={handleUndoLastLinePoint}
                                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-500 disabled:opacity-40 transition-all"
                                >
                                    {lang === "VN" ? "Hoàn tác điểm cuối" : "Undo Last Point"}
                                </button>
                                <button
                                    type="button"
                                    disabled={linePoints.length === 0}
                                    onClick={handleClearLine}
                                    className="flex-1 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-[10px] font-black uppercase text-rose-500 disabled:opacity-40 transition-all"
                                >
                                    {lang === "VN" ? "Xóa đường" : "Clear Line"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* METADATA ĐƯỜNG SÔNG */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                            {lang === "VN" ? "Thông tin đoạn sông" : "Waterway Segment Info"}
                        </h3>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Tên đoạn sông" : "Waterway Name"}</label>
                            <input
                                type="text" value={waterwayName}
                                onChange={(e) => setWaterwayName(e.target.value)}
                                placeholder={lang === "VN" ? "Rạch Ông Nhiêu..." : "Custom canal name..."}
                                className={inputStyle}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>{lang === "VN" ? "Loại" : "Type"}</label>
                            <select
                                value={waterwayType}
                                onChange={(e) => setWaterwayType(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                            >
                                <option value="custom">{lang === "VN" ? "Tự vẽ (custom)" : "Custom (hand-drawn)"}</option>
                                <option value="river">{lang === "VN" ? "Sông (river)" : "River"}</option>
                                <option value="canal">{lang === "VN" ? "Kênh rạch (canal)" : "Canal"}</option>
                            </select>
                        </div>

                        {/* TÙY CHỌN GẮN VÀO 1 TUYẾN CỤ THỂ */}
                        <div className="p-3 bg-blue-50/50 dark:bg-slate-900/50 border border-blue-100 dark:border-slate-700 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-blue-800 dark:text-yellow-400 tracking-wider flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">alt_route</span>
                                    {lang === "VN" ? "Gắn vào 1 tuyến cụ thể" : "Attach To A Specific Route"}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setAttachToRoute(!attachToRoute)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 ease-in-out border-2 border-transparent focus:outline-none ${attachToRoute ? 'bg-yellow-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${attachToRoute ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                {lang === "VN"
                                    ? "Nếu bật và điền đủ 3 trường bên dưới, hệ thống sẽ tự tạo/cập nhật Route + RouteStop ngay khi import, không cần dùng form Tạo tuyến nữa."
                                    : "If enabled and all 3 fields below are filled, the system will auto create/update the Route + RouteStops on import, without needing the Create Route form."}
                            </p>
                            {attachToRoute && (
                                <div className="space-y-2">
                                    <input
                                        type="text" value={fromStationCode}
                                        onChange={(e) => setFromStationCode(e.target.value.toUpperCase())}
                                        placeholder={lang === "VN" ? "Mã bến đi (from_station_code)" : "From station code"}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757] uppercase"
                                    />
                                    <input
                                        type="text" value={toStationCode}
                                        onChange={(e) => setToStationCode(e.target.value.toUpperCase())}
                                        placeholder={lang === "VN" ? "Mã bến đến (to_station_code)" : "To station code"}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757] uppercase"
                                    />
                                    <input
                                        type="text" value={routeCode}
                                        onChange={(e) => setRouteCode(e.target.value.toUpperCase())}
                                        placeholder={lang === "VN" ? "Mã tuyến (route_code)" : "Route code"}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-[#124757] uppercase"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DANH SÁCH ĐIỂM BẾN ĐÃ ĐẶT */}
                    {stationPoints.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-3">
                            <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
                                {lang === "VN" ? `Điểm bến đã đặt (${stationPoints.length})` : `Placed Stations (${stationPoints.length})`}
                            </h3>
                            <div className="space-y-2">
                                {stationPoints.map((pt) => (
                                    <div key={pt.uid} className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[9px] text-slate-400 font-bold">
                                                {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveStationPoint(pt.uid)}
                                                className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-all shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text" value={pt.stationCode}
                                                onChange={(e) => handleStationPointChange(pt.uid, "stationCode", e.target.value.toUpperCase())}
                                                placeholder={lang === "VN" ? "Mã bến" : "Code"}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757] uppercase"
                                            />
                                            <input
                                                type="text" value={pt.stationName}
                                                onChange={(e) => handleStationPointChange(pt.uid, "stationName", e.target.value)}
                                                placeholder={lang === "VN" ? "Tên bến" : "Name"}
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-[#124757]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HÀNH ĐỘNG: TẢI XUỐNG / IMPORT NGAY */}
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadGeoJson}
                            className="w-full py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-[10px] font-black uppercase text-slate-500 flex items-center justify-center gap-1.5 transition-all"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            {lang === "VN" ? "Tải xuống .geojson" : "Download .geojson"}
                        </button>
                        <button
                            type="button"
                            onClick={handleImportNow}
                            disabled={isImporting}
                            className="w-full bg-emerald-600 text-white font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {isImporting
                                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                : <span className="material-symbols-outlined text-sm">cloud_upload</span>}
                            {lang === "VN" ? "Import ngay" : "Import Now"}
                        </button>
                    </div>
                </div>

                {/* PANEL BÊN PHẢI: BẢN ĐỒ VẼ TAY */}
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-145 sticky top-4">
                    <div>
                        <h3 className="font-headline font-black text-xs text-[#124757] dark:text-yellow-400 uppercase tracking-wider">{lang === "VN" ? "Bản đồ vẽ tay (GIS Map)" : "Hand-Drawing Map (GIS Map)"}</h3>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 mb-4">
                            {lang === "VN" ? "Click lên bản đồ để thêm điểm theo chế độ đang chọn ở panel bên trái." : "Click on the map to add a point according to the mode selected on the left panel."}
                        </p>
                    </div>
                    <div className="flex-1 w-full relative min-h-75">
                        <WaterwayMap
                            coordinates={linePoints}
                            stationsList={mapStationsPreview}
                            onLocationSelect={handleMapClick}
                            hideStationLink
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
