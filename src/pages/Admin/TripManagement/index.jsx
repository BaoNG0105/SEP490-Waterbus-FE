import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllTrips, toDdMmYyyy, getTripStatusLabel, normalizeTripStatusKey, isTripRunningStatus } from "../../../services/tripService";
import { fetchAllRoutes } from "../../../services/routeService";
import { FormSelect } from "../../../components/FormSelect";
import { getRouteKindLabel } from "../../../utils/routeTypes";

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

export function TripManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [trips, setTrips] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [routes, setRoutes] = useState([]);
    const [operatingDate, setOperatingDate] = useState(todayInputValue());
    const [routeCode, setRouteCode] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    useEffect(() => {
        fetchAllRoutes()
            .then((data) => setRoutes(data || []))
            .catch((error) => console.error("Lỗi tải danh sách tuyến cho bộ lọc:", error));
    }, []);

    useEffect(() => {
        const getTripsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const params = {};
                if (operatingDate) params.operatingDate = toDdMmYyyy(operatingDate);
                if (routeCode !== "All") params.routeCode = routeCode;
                if (statusFilter !== "All") params.status = statusFilter;
                const data = await fetchAllTrips(params);
                setTrips(data || []);
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
    }, [lang, operatingDate, routeCode, statusFilter]);

    const stats = {
        total: trips.length,
        scheduled: trips.filter((t) => normalizeTripStatusKey(t.tripStatus) === "Scheduled").length,
        running: trips.filter((t) => isTripRunningStatus(t.tripStatus)).length,
        cancelled: trips.filter((t) => normalizeTripStatusKey(t.tripStatus) === "Cancelled").length,
    };

    const routeOptions = [
        { value: "All", label: lang === "VN" ? "Tất cả tuyến" : "All routes" },
        ...routes.map((route) => ({ value: route.routeCode, label: `${route.routeCode} — ${route.routeName}` })),
    ];

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
                        {lang === "VN" ? "Danh sách chuyến tàu vận hành theo tuyến, ngày và trạng thái." : "Manage operating trips by route, date and status."}
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
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-[#124757] group-hover:text-white dark:group-hover:bg-yellow-400 dark:group-hover:text-slate-900 transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">sailing</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số chuyến" : "Total Trips"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">event_upcoming</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã lên lịch" : "Scheduled"}</span>
                        <h3 className="text-xl font-black font-headline text-blue-600 dark:text-blue-400 mt-0.5">{isLoading ? "..." : stats.scheduled}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">directions_boat</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang vận hành" : "Running"}</span>
                        <h3 className="text-xl font-black font-headline text-indigo-600 dark:text-indigo-400 mt-0.5">{isLoading ? "..." : stats.running}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">cancel</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đã hủy" : "Cancelled"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-600 dark:text-rose-400 mt-0.5">{isLoading ? "..." : stats.cancelled}</h3>
                    </div>
                </div>
            </div>

            {/* THANH BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center overflow-visible relative z-20">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {lang === "VN" ? "Ngày vận hành" : "Operating date"}
                    </span>
                    <input
                        type="date"
                        value={operatingDate}
                        onChange={(e) => setOperatingDate(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto justify-end overflow-visible">
                    <div className="relative z-30 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Tuyến" : "Route"}
                        </span>
                        <FormSelect
                            value={routeCode}
                            onChange={setRouteCode}
                            options={routeOptions}
                            searchable
                            className="min-w-55 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>

                    <div className="relative z-20 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Trạng thái" : "Status"}
                        </span>
                        <FormSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            menuAlign="right"
                            options={statusOptions}
                            className="min-w-42.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH CHUYẾN TÀU */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Chuyến tàu" : "Trip"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Tuyến" : "Route"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Ngày vận hành" : "Operating Date"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Giờ chạy" : "Departure → Arrival"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Sức chứa" : "Capacity"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400 font-medium">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-xs tracking-wider animate-pulse">{lang === "VN" ? "Đang tải danh sách chuyến tàu..." : "Loading trip list..."}</p>
                                    </td>
                                </tr>
                            ) : trips.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">sailing</span>
                                        {lang === "VN" ? "Không có chuyến tàu nào phù hợp với bộ lọc." : "No trips found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                trips.map((trip) => (
                                    <tr key={trip.tripId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">

                                        {/* Cột 1: Mã chuyến + loại chuyến */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">

                                                <div className="space-y-1">
                                                    <h4 className="font-headline font-black text-slate-800 dark:text-white text-xs tracking-wide">
                                                        {trip.tripCode}
                                                    </h4>
                                                    <span className={`inline-flex text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${trip.tripType === "Charter" ? "bg-[#EAF3F5] text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-400" : "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"}`}>
                                                        {trip.tripType || "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 2: Tuyến */}
                                        <td className="py-4 px-4 max-w-[16rem]">
                                            <p className="font-bold text-slate-800 dark:text-white truncate">{trip.routeName}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="text-[10px] text-slate-400">{trip.routeCode}</span>
                                                <span className={`inline-flex text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${routeKindBadgeClass(trip.routeType)}`}>
                                                    {getRouteKindLabel(trip.routeType, lang)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Cột 3: Ngày vận hành */}
                                        <td className="py-4 px-4 text-center">
                                            <span className="font-bold text-slate-600 dark:text-slate-300">{trip.operatingDate}</span>
                                        </td>

                                        {/* Cột 4: Giờ chạy */}
                                        <td className="py-4 px-4 text-center">
                                            <span className="font-bold text-slate-600 dark:text-slate-300">
                                                {formatTime(trip.departureTime)} → {formatTime(trip.arrivalTime)}
                                            </span>
                                        </td>

                                        {/* Cột 5: Sức chứa */}
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                {trip.capacitySnapshot ?? "—"}
                                            </span>
                                        </td>

                                        {/* Cột 6: Trạng thái */}
                                        <td className="py-4 px-4 text-center">
                                            <span
                                                title={trip.statusNote || ""}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${tripStatusBadgeClass(trip.tripStatus)}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${tripStatusDotClass(trip.tripStatus)}`}></span>
                                                {getTripStatusLabel(trip.tripStatus, lang)}
                                            </span>
                                        </td>

                                        {/* Cột 7: Hành động */}
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed shadow-sm"
                                                    title={lang === "VN" ? "Chưa hỗ trợ sửa chuyến (chưa có API)" : "Editing not supported yet (API pending)"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}

export { CreateTrip } from "./CreateTrip";
