import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllTrips, toDdMmYyyy, getTripStatusLabel, normalizeTripStatusKey, isTripRunningStatus, sortTripsForOpsList } from "../../../services/tripService";
import { fetchAllRoutes, fetchRouteDetail } from "../../../services/routeService";
import { FormSelect } from "../../../components/FormSelect";
import { AppDateInput } from "../../../components/AppDateInput";
import { getRouteShortLabel } from "../../../utils/routeTypes";
import { DEFAULT_BOAT_IMAGE, getBoatImageUrl } from "../../../utils/charterBookingAdmin";

const todayInputValue = () => {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const routeKindBadgeClass = (routeType) => {
    switch (routeType) {
        case "CharterReference":
            return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
        case "Charter":
            return "bg-[#EAF3F5] text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400";
        case "SightseeingLoop":
            return "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
        case "Regular":
            return "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300";
        default:
            return "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
    }
};

const tripStatusBadgeClass = (status) => {
    switch (normalizeTripStatusKey(status)) {
        case "Scheduled":
            return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400";
        case "Boarding":
            return "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400";
        case "InProgress":
            return "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400";
        case "Delayed":
            return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400";
        case "Completed":
            return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400";
        case "Cancelled":
            return "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400";
        default:
            return "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-400";
    }
};

const tripStatusDotClass = (status) => {
    switch (normalizeTripStatusKey(status)) {
        case "Scheduled": return "bg-blue-500";
        case "Boarding": return "bg-amber-500";
        case "InProgress": return "bg-indigo-500";
        case "Delayed": return "bg-orange-500";
        case "Completed": return "bg-emerald-500";
        case "Cancelled": return "bg-rose-500";
        default: return "bg-slate-400";
    }
};

const formatTime = (iso) => {
    if (!iso) return "—";
    const time = new Date(iso);
    if (Number.isNaN(time.getTime())) return "—";
    const pad2 = (n) => String(n).padStart(2, "0");
    return `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
};

const isUuid = (value) => /^[0-9a-f-]{36}$/i.test(String(value || "").trim());

const cleanLabel = (value) => {
    const text = String(value ?? "").trim();
    if (!text || isUuid(text)) return "";
    return text;
};

/** Lấy nhãn bến từ object / string / stop list — không hiện UUID. */
const labelFromStationLike = (station) => {
    if (station == null || station === "") return "";
    if (typeof station === "string") return cleanLabel(station);
    return cleanLabel(
        station.stationName
        || station.name
        || station.StationName
        || station.stationCode
        || station.code
        || station.StationCode,
    );
};

const labelFromStop = (stop) => {
    if (!stop) return "";
    return labelFromStationLike(stop)
        || labelFromStationLike(stop.station)
        || labelFromStationLike(stop.Station)
        || cleanLabel(stop.stationName)
        || cleanLabel(stop.stationCode);
};

/** Mã tuyến kiểu WB-BD-LB / RS-TT-BD → [BD, LB] */
const codesFromRouteCode = (routeCode) => {
    const parts = String(routeCode || "")
        .trim()
        .toUpperCase()
        .split("-")
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 3) return null;
    // Bỏ prefix dịch vụ (WB, RS, CH, SOS…)
    const stations = parts.slice(1);
    if (stations.length < 2) return null;
    return { from: stations[0], to: stations[stations.length - 1] };
};

/** "WATERBUS - BACH DANG - LINH DONG" → BACH DANG / LINH DONG */
const namesFromRouteName = (routeName) => {
    const parts = String(routeName || "")
        .split(/\s[-–—]\s/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (parts.length < 2) return null;
    const skip = /^(waterbus|bus|sightseeing|charter|tuyến)$/i;
    const stations = skip.test(parts[0]) ? parts.slice(1) : parts;
    if (stations.length < 2) return null;
    return { from: stations[0], to: stations[stations.length - 1] };
};

const resolveStationLabel = (trip, edge = "from", routeMeta = null) => {
    const station = edge === "to"
        ? (trip?.toStation ?? trip?.ToStation)
        : (trip?.fromStation ?? trip?.FromStation);
    const fallbackName = edge === "to"
        ? (trip?.toStationName ?? trip?.ToStationName ?? trip?.endStationName ?? trip?.destinationName)
        : (trip?.fromStationName ?? trip?.FromStationName ?? trip?.startStationName ?? trip?.originName);
    const fallbackCode = edge === "to"
        ? (trip?.toStationCode ?? trip?.ToStationCode ?? trip?.endStationCode)
        : (trip?.fromStationCode ?? trip?.FromStationCode ?? trip?.startStationCode);

    const direct = labelFromStationLike(station) || cleanLabel(fallbackName) || cleanLabel(fallbackCode);
    if (direct) return direct;

    const list = Array.isArray(trip?.stops)
        ? [...trip.stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
        : [];
    if (list.length) {
        const stop = edge === "to" ? list[list.length - 1] : list[0];
        const fromStop = labelFromStop(stop);
        if (fromStop) return fromStop;
    }

    const routeStops = Array.isArray(routeMeta?.stops)
        ? [...routeMeta.stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
        : [];
    if (routeStops.length) {
        const stop = edge === "to" ? routeStops[routeStops.length - 1] : routeStops[0];
        const fromRouteStop = labelFromStop(stop);
        if (fromRouteStop) return fromRouteStop;
    }

    const fromRouteName = namesFromRouteName(trip?.routeName || routeMeta?.routeName);
    if (fromRouteName) return edge === "to" ? fromRouteName.to : fromRouteName.from;

    const fromCode = codesFromRouteCode(trip?.routeCode || routeMeta?.routeCode);
    if (fromCode) return edge === "to" ? fromCode.to : fromCode.from;

    return "—";
};

const resolveBoatLabel = (trip, lang) => {
    const boat = trip?.boat || trip?.Boat || trip?.vessel || trip?.Vessel || {};
    const code = cleanLabel(
        trip?.boatCode
        || trip?.BoatCode
        || trip?.vesselCode
        || boat.boatCode
        || boat.vesselCode
        || boat.code
        || boat.BoatCode,
    );
    const name = cleanLabel(
        trip?.boatName
        || trip?.BoatName
        || trip?.vesselName
        || boat.boatName
        || boat.vesselName
        || boat.name
        || boat.BoatName,
    );
    if (code || name) return [code, name].filter(Boolean).join(" · ");

    const boatId = trip?.boatId || trip?.BoatId || boat.boatId || boat.vesselId || boat.id;
    const hasCapacity = trip?.capacitySnapshot != null || boat.capacity != null || boat.seatCount != null;
    if (boatId || hasCapacity) {
        return lang === "VN" ? "Đã gán tàu" : "Boat assigned";
    }
    return lang === "VN" ? "Chưa gán tàu" : "No boat";
};

const resolvePaxLabel = (trip) => {
    const pax = trip?.totalPassengerCount
        ?? trip?.uniquePassengerCount
        ?? trip?.onboardPassengerCount
        ?? trip?.TotalPassengerCount
        ?? trip?.passengerCount;
    const cap = trip?.capacitySnapshot
        ?? trip?.CapacitySnapshot
        ?? trip?.boat?.capacity
        ?? trip?.boat?.seatCount
        ?? trip?.Boat?.capacity;
    const paxN = pax === null || pax === undefined || pax === "" ? null : Number(pax);
    const capN = cap === null || cap === undefined || cap === "" ? null : Number(cap);
    if (Number.isFinite(capN)) {
        return `${Number.isFinite(paxN) ? paxN : 0}/${capN}`;
    }
    if (Number.isFinite(paxN)) return String(paxN);
    return "—";
};

const resolveRemainingSeats = (trip) => {
    const rem = trip?.remainingSeats ?? trip?.availableSeats ?? trip?.AvailableSeats;
    const n = Number(rem);
    return Number.isFinite(n) ? n : null;
};

const resolveTripThumb = (trip) => {
    const boat = trip?.boat || trip?.Boat || {};
    const candidates = [
        trip?.boatImageUrl,
        boat.imageUrl,
        Array.isArray(boat.imageUrls) ? boat.imageUrls[0] : "",
        trip?.fromStation?.imageUrl,
        trip?.fromStation?.stationImageUrl,
        Array.isArray(trip?.stops) ? trip.stops[0]?.stationImageUrl : "",
    ].filter(Boolean);
    const first = candidates.find((url) => {
        const s = String(url).trim();
        return s && !/image\s*not\s*available/i.test(s);
    });
    if (first) return first;
    return getBoatImageUrl(boat, DEFAULT_BOAT_IMAGE);
};

const formatFareAdjustment = (trip, lang) => {
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
    if (parts.length) return parts.join(" · ");
    return lang === "VN" ? "Có phụ thu" : "Surcharge";
};

const formatStopTimesBrief = (trip) => {
    const list = Array.isArray(trip?.stops)
        ? [...trip.stops].sort((a, b) => Number(a?.stopOrder ?? 0) - Number(b?.stopOrder ?? 0))
        : [];
    if (list.length < 2) return null;
    return list
        .map((stop) => {
            const name = labelFromStop(stop) || cleanLabel(stop.stationCode) || `#${stop.stopOrder}`;
            const t = formatTime(stop.scheduledDeparture || stop.scheduledArrival || stop.plannedDepartureTime);
            return `${name} ${t}`;
        })
        .join(" → ");
};

export function TripManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [routes, setRoutes] = useState([]);
    const [routeDetailsByCode, setRouteDetailsByCode] = useState({});
    const [operatingDate, setOperatingDate] = useState(todayInputValue());
    const [statusFilter, setStatusFilter] = useState("All");

    useEffect(() => {
        fetchAllRoutes()
            .then((data) => {
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setRoutes(list);
            })
            .catch((error) => console.error("Lỗi tải danh sách tuyến cho bộ lọc:", error));
    }, []);

    useEffect(() => {
        const getTripsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const params = {};
                if (operatingDate) params.operatingDate = toDdMmYyyy(operatingDate);
                if (statusFilter !== "All") params.status = statusFilter;
                const data = await fetchAllTrips(params);
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setTrips(sortTripsForOpsList(list));
            } catch (error) {
                console.error("Lỗi giao diện tải danh sách chuyến tàu:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể kết nối tới máy chủ để tải danh sách chuyến tàu."
                        : "Failed to connect to server to fetch trip list."
                );
            } finally {
                setIsLoading(false);
            }
        };
        getTripsData();
    }, [lang, operatingDate, statusFilter]);

    // Enrich tuyến (kèm stops) để hiện hành trình khi list trip không trả from/to.
    useEffect(() => {
        const codes = [...new Set(
            trips.map((t) => String(t?.routeCode || "").trim()).filter(Boolean),
        )];
        if (!codes.length || !routes.length) return undefined;

        let active = true;
        const enrich = async () => {
            const next = { ...routeDetailsByCode };
            await Promise.all(codes.map(async (code) => {
                if (next[code]?.stops?.length) return;
                const summary = routes.find((r) => String(r.routeCode || "").toUpperCase() === code.toUpperCase());
                if (summary?.stops?.length) {
                    next[code] = summary;
                    return;
                }
                const routeId = summary?.routeId || summary?.id;
                if (!routeId) {
                    next[code] = summary || { routeCode: code, routeName: summary?.routeName };
                    return;
                }
                try {
                    const detail = await fetchRouteDetail(routeId);
                    const unwrapped = detail?.data && typeof detail.data === "object" ? detail.data : detail;
                    if (unwrapped) next[code] = unwrapped;
                } catch {
                    next[code] = summary || { routeCode: code };
                }
            }));
            if (active) setRouteDetailsByCode(next);
        };
        enrich();
        return () => { active = false; };
    // Chỉ chạy khi trips/routes đổi — không phụ thuộc routeDetailsByCode để tránh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trips, routes]);

    const routeByCode = useMemo(() => {
        const map = { ...routeDetailsByCode };
        routes.forEach((route) => {
            const code = String(route?.routeCode || "").trim();
            if (!code) return;
            if (!map[code]) map[code] = route;
        });
        return map;
    }, [routes, routeDetailsByCode]);

    const stats = {
        total: trips.length,
        scheduled: trips.filter((t) => normalizeTripStatusKey(t.tripStatus) === "Scheduled").length,
        running: trips.filter((t) => isTripRunningStatus(t.tripStatus)).length,
        cancelled: trips.filter((t) => normalizeTripStatusKey(t.tripStatus) === "Cancelled").length,
    };

    const statusOptions = [
        { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All status" },
        { value: "Scheduled", label: getTripStatusLabel("Scheduled", lang) },
        { value: "Boarding", label: getTripStatusLabel("Boarding", lang) },
        { value: "InProgress", label: getTripStatusLabel("InProgress", lang) },
        { value: "Delayed", label: getTripStatusLabel("Delayed", lang) },
        { value: "Completed", label: getTripStatusLabel("Completed", lang) },
        { value: "Cancelled", label: getTripStatusLabel("Cancelled", lang) },
    ];

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ CHÍNH & PHỤ + NÚT THÊM CHUYẾN MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Chuyến tàu" : "Trip Management"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Chuyến đang chuẩn bị / đang chạy xếp trước — lọc theo ngày và trạng thái."
                            : "Preparing / running trips first — filter by date and status."}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate("/admin/trips-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                    {lang === "VN" ? "Thêm chuyến mới" : "Add New Trip"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* SECTION 1: KHỐI CARD THỐNG KÊ SỐ LIỆU */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số chuyến" : "Total Trips"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã lên lịch" : "Scheduled"}</span>
                        <h3 className="text-xl font-black font-headline text-blue-600 dark:text-blue-400 mt-0.5">{isLoading ? "..." : stats.scheduled}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang vận hành" : "Running"}</span>
                        <h3 className="text-xl font-black font-headline text-indigo-600 dark:text-indigo-400 mt-0.5">{isLoading ? "..." : stats.running}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã hủy" : "Cancelled"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-600 dark:text-rose-400 mt-0.5">{isLoading ? "..." : stats.cancelled}</h3>
                    </div>
                </div>
            </div>

            {/* THANH BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center overflow-visible relative z-20">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Ngày vận hành" : "Operating date"}
                    </span>
                    <AppDateInput
                        value={operatingDate}
                        onChange={(e) => setOperatingDate(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>

                <div className="relative z-20 flex items-center gap-2 min-w-0 sm:ml-auto">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Trạng thái" : "Status"}
                    </span>
                    <FormSelect
                        value={statusFilter}
                        onChange={setStatusFilter}
                        menuAlign="right"
                        options={statusOptions}
                        className="min-w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>
            </div>

            {/* BẢNG DANH SÁCH CHUYẾN TÀU */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full table-fixed text-left border-collapse">
                        <colgroup>
                            <col className="w-[28%]" />
                            <col className="w-[22%]" />
                            <col className="w-[12%]" />
                            <col className="w-[14%]" />
                            <col className="w-[14%]" />
                            <col className="w-[10%]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-3.5 px-5 text-left">{lang === "VN" ? "Chuyến / Tàu" : "Trip / Boat"}</th>
                                <th className="py-3.5 px-4 text-left">{lang === "VN" ? "Hành trình" : "Stations"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Giờ chạy" : "Time"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "HK / Ghế còn" : "Pax / Left"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-3.5 px-3 text-left">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-slate-400 font-medium">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-xs tracking-wider animate-pulse">{lang === "VN" ? "Đang tải danh sách chuyến tàu..." : "Loading trip list..."}</p>
                                    </td>
                                </tr>
                            ) : trips.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có chuyến tàu nào phù hợp với bộ lọc." : "No trips found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                trips.map((trip) => {
                                    const boatLabel = resolveBoatLabel(trip, lang);
                                    const routeMeta = routeByCode[String(trip.routeCode || "").trim()] || null;
                                    const fromLabel = resolveStationLabel(trip, "from", routeMeta);
                                    const toLabel = resolveStationLabel(trip, "to", routeMeta);
                                    const stopCount = trip.stopCount
                                        ?? (Array.isArray(trip.stops) ? trip.stops.length : null)
                                        ?? (Array.isArray(routeMeta?.stops) ? routeMeta.stops.length : null);
                                    const thumb = resolveTripThumb(trip);
                                    const remaining = resolveRemainingSeats(trip);
                                    const fareAdj = formatFareAdjustment(trip, lang);
                                    const stopTimes = formatStopTimesBrief(trip);

                                    return (
                                        <tr key={trip.tripId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                            <td className="py-3.5 px-5 align-middle">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <img
                                                        src={thumb}
                                                        alt=""
                                                        className="h-12 w-12 shrink-0 rounded-xl object-cover bg-slate-100"
                                                        onError={(e) => { e.currentTarget.src = DEFAULT_BOAT_IMAGE; }}
                                                    />
                                                    <div className="min-w-0 space-y-1">
                                                        <h4 className="truncate font-headline text-xs font-black tracking-wide text-slate-800 dark:text-white">
                                                            {trip.tripCode}
                                                        </h4>
                                                        <p className="truncate text-[11px] font-bold text-slate-500">
                                                            {boatLabel}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${routeKindBadgeClass(trip.tripType === "Charter" ? "Charter" : trip.routeType)}`}>
                                                                {trip.tripType === "Charter"
                                                                    ? "Charter"
                                                                    : getRouteShortLabel(trip.routeType, lang)}
                                                            </span>
                                                            {trip.operatingDate ? (
                                                                <span className="text-[10px] font-medium text-slate-400">
                                                                    {trip.operatingDate}
                                                                </span>
                                                            ) : null}
                                                            {fareAdj ? (
                                                                <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" title={fareAdj}>
                                                                    {fareAdj}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 align-middle">
                                                <div className="flex min-w-0 items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                                                    <span className="max-w-[7.5rem] truncate" title={fromLabel}>{fromLabel}</span>
                                                    <span className="material-symbols-outlined shrink-0 text-[14px] text-[#FFD100]">arrow_forward</span>
                                                    <span className="max-w-[7.5rem] truncate" title={toLabel}>{toLabel}</span>
                                                </div>
                                                {stopCount != null ? (
                                                    <p className="mt-1 text-[10px] font-medium text-slate-400">
                                                        {stopCount} {lang === "VN" ? "bến" : "stops"}
                                                        {trip.routeName ? ` · ${trip.routeName}` : ""}
                                                    </p>
                                                ) : null}
                                                {stopTimes ? (
                                                    <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed text-slate-400" title={stopTimes}>
                                                        {stopTimes}
                                                    </p>
                                                ) : null}
                                            </td>

                                            <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                                                <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                                    {formatTime(trip.departureTime)}
                                                    <span className="mx-1 text-slate-300">→</span>
                                                    {formatTime(trip.arrivalTime)}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <div className="space-y-1">
                                                    <span className="inline-flex rounded-lg border bg-slate-100 px-2.5 py-1 text-xs font-black text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400">
                                                        {resolvePaxLabel(trip)}
                                                    </span>
                                                    {remaining != null ? (
                                                        <p className="text-[10px] font-bold text-slate-400">
                                                            {lang === "VN" ? `Còn ${remaining} ghế` : `${remaining} seats left`}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <span
                                                    title={trip.statusNote || ""}
                                                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wide ${tripStatusBadgeClass(trip.tripStatus)}`}
                                                >
                                                    <span className={`h-1.5 w-1.5 rounded-full ${tripStatusDotClass(trip.tripStatus)}`} />
                                                    {getTripStatusLabel(trip.tripStatus, lang)}
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/trips-management/${trip.tripId}`)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-[#124757] dark:border-slate-700 dark:bg-slate-800 dark:hover:text-yellow-400"
                                                    title={lang === "VN" ? "Xem chi tiết chuyến" : "View trip detail"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}

export { CreateTrip } from "./CreateTrip";
export { TripDetail } from "./TripDetail";
