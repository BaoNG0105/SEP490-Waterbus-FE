import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllRoutes, removeRoute } from "../../../services/routeService";
import { FormSelect } from "../../../components/FormSelect";
import { getRouteKindLabel, getRouteKindTextColorClass, resolveRouteLabelKey } from "../../../utils/routeTypes";
import { notify } from "../../../utils/swalToast";

const getRouteTime = (route) => {
    const raw = route?.updatedAt || route?.modifiedAt || route?.createdAt || route?.createdDate || "";
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
};

export function RouteManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [routes, setRoutes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [deletingRouteId, setDeletingRouteId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    useEffect(() => {
        const getRoutesData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchAllRoutes();
                setRoutes(data || []);
            } catch (error) {
                console.error("Lỗi giao diện tải danh sách tuyến đường:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể kết nối tới máy chủ để tải danh sách tuyến đường."
                        : "Failed to establish secure connection to retrieve route logs."
                );
            } finally {
                setIsLoading(false);
            }
        };
        getRoutesData();
    }, [lang]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortBy, typeFilter, statusFilter]);

    const stats = useMemo(() => {
        let sightseeing = 0;
        let charter = 0;
        let bus = 0;
        routes.forEach((route) => {
            const key = resolveRouteLabelKey(route);
            if (key === "Sightseeing") sightseeing += 1;
            else if (key === "Charter" || key === "GPS") charter += 1;
            else if (key === "Bus") bus += 1;
        });
        return {
            total: routes.length,
            sightseeing,
            charter,
            bus,
        };
    }, [routes]);

    const filteredRoutes = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        const list = routes.filter((route) => {
            const matchesSearch = !term
                || (route.routeName?.toLowerCase() || "").includes(term)
                || (route.routeCode?.toLowerCase() || "").includes(term);
            const matchesType = typeFilter === "All" || String(route.routeType || "") === typeFilter;
            const matchesStatus = statusFilter === "All" || String(route.status || "") === statusFilter;
            return matchesSearch && matchesType && matchesStatus;
        });

        const sorted = [...list];
        sorted.sort((a, b) => {
            if (sortBy === "oldest") return getRouteTime(a) - getRouteTime(b);
            if (sortBy === "nameAsc") {
                return String(a.routeName || "").localeCompare(String(b.routeName || ""), "vi");
            }
            if (sortBy === "nameDesc") {
                return String(b.routeName || "").localeCompare(String(a.routeName || ""), "vi");
            }
            // newest (default)
            const timeDiff = getRouteTime(b) - getRouteTime(a);
            if (timeDiff !== 0) return timeDiff;
            return String(b.routeId || "").localeCompare(String(a.routeId || ""));
        });
        return sorted;
    }, [routes, searchTerm, sortBy, typeFilter, statusFilter]);

    const totalPages = Math.ceil(filteredRoutes.length / ITEMS_PER_PAGE);
    const currentRoutes = filteredRoutes.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredRoutes.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredRoutes.length);

    const handleDeleteRoute = async (route) => {
        const result = await notify({
            icon: "warning",
            title: lang === "VN" ? `Xóa tuyến "${route.routeCode}"?` : `Delete route "${route.routeCode}"?`,
            text: lang === "VN"
                ? "Chỉ xóa được tuyến chưa từng có chuyến đi. Nếu tuyến đã có chuyến, bạn mở chi tiết và chuyển sang Ngừng hoạt động thay vì xóa."
                : "You can only delete a route that has never had any trips. If it already has trips, open its details and set it to Inactive instead of deleting.",
            showCancelButton: true,
            confirmButtonText: lang === "VN" ? "Xóa tuyến" : "Delete",
            cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
            confirmButtonColor: "#e11d48",
            cancelButtonColor: "#124757"
        });
        if (!result.isConfirmed) return;

        try {
            setDeletingRouteId(route.routeId);
            await removeRoute(route.routeId);
            setRoutes(prev => prev.filter(r => r.routeId !== route.routeId));
            notify({
                icon: "success",
                title: lang === "VN" ? "Đã xóa tuyến đường!" : "Route Deleted!",
                confirmButtonColor: "#124757",
                timer: 1600,
                showConfirmButton: false
            });
        } catch (error) {
            console.error(`Lỗi khi xóa tuyến đường ${route.routeId}:`, error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa tuyến!" : "Cannot Delete Route!",
                text: error.response?.data?.message || (lang === "VN"
                    ? "Tuyến này đã có chuyến đi nên không xóa được. Bạn mở chi tiết và chuyển sang Ngừng hoạt động nhé."
                    : "This route already has trips, so it cannot be deleted. Please open its details and set it to Inactive."),
                confirmButtonColor: "#124757"
            });
        } finally {
            setDeletingRouteId(null);
        }
    };

    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages = [1, 2, 3, 4, '...', totalPages];
            } else if (currentPage >= totalPages - 2) {
                pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }
        return pages;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ CHÍNH & PHỤ + NÚT THÊM TUYẾN MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Tuyến Đường Sông" : "River Route Networks"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách các tuyến đường sông, lộ trình bến dừng và khoảng cách vận hành." : "Manage waterway routes, stop sequencing and operational distances."}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                        onClick={() => navigate("/admin/routes-management/merge-gps")}
                        className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm font-bold">merge</span>
                        {lang === "VN" ? "Ghép tuyến GPS" : "Merge GPS routes"}
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* SECTION 1: KHỐI CARD THỐNG KÊ SỐ LIỆU */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số tuyến" : "Total Routes"}</span>
                    <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : stats.total}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Sightseeing</span>
                    <h3 className="text-xl font-black font-headline text-violet-600 dark:text-violet-400 mt-0.5">{isLoading ? "..." : stats.sightseeing}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Waterbus</span>
                    <h3 className="text-xl font-black font-headline text-teal-600 dark:text-teal-400 mt-0.5">{isLoading ? "..." : stats.bus}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Request</span>
                    <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{isLoading ? "..." : stats.charter}</h3>
                </div>

            </div>

            {/* THANH TÌM KIẾM + BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center overflow-visible relative z-20">
                <div className="w-full relative flex items-center flex-1">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tên tuyến hoặc mã tuyến..." : "Search route by name or route code..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto justify-end overflow-visible">
                    <div className="relative z-30 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Sắp xếp" : "Sort"}
                        </span>
                        <FormSelect
                            value={sortBy}
                            onChange={setSortBy}
                            options={[
                                { value: "newest", label: lang === "VN" ? "Mới nhất" : "Newest" },
                                { value: "oldest", label: lang === "VN" ? "Cũ nhất" : "Oldest" },
                                { value: "nameAsc", label: lang === "VN" ? "Tên A → Z" : "Name A → Z" },
                                { value: "nameDesc", label: lang === "VN" ? "Tên Z → A" : "Name Z → A" },
                            ]}
                            className="min-w-37.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>

                    <div className="relative z-20 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Loại" : "Type"}
                        </span>
                        <FormSelect
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả loại" : "All types" },
                                { value: "CharterReference", label: getRouteKindLabel("CharterReference", lang) },
                                { value: "Charter", label: getRouteKindLabel("Charter", lang) },
                                { value: "Regular", label: getRouteKindLabel("Regular", lang) },
                                { value: "SightseeingLoop", label: getRouteKindLabel("SightseeingLoop", lang) },
                            ]}
                            className="min-w-52 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>

                    <div className="relative z-10 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Trạng thái" : "Status"}
                        </span>
                        <FormSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            menuAlign="right"
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All status" },
                                { value: "Active", label: lang === "VN" ? "Hoạt động" : "Active" },
                                { value: "Inactive", label: lang === "VN" ? "Ngưng hoạt động" : "Inactive" },
                            ]}
                            className="min-w-37.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH TUYẾN ĐƯỜNG */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin tuyến đường" : "Route Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Mã tuyến" : "Route Code"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Loại" : "Type"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Khoảng cách" : "Distance"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Thời gian" : "Duration"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentRoutes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có dữ liệu tuyến đường nào phù hợp." : "No records found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentRoutes.map((route) => (
                                    <tr key={route.routeId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">

                                        {/* Cột 1: Thông tin Tuyến */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug">
                                                        {route.routeName}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block max-w-sm truncate">
                                                        {route.description || (lang === "VN" ? "Chưa có mô tả" : "No description")}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Cột 2: Mã tuyến */}
                                        <td className="py-4 px-4 max-w-44">
                                            <span
                                                title={route.routeCode || ""}
                                                className="inline-block max-w-full truncate align-middle font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200"
                                            >
                                                {route.routeCode}
                                            </span>
                                        </td>

                                        {/* Cột 3: Loại tuyến */}
                                        <td className="py-4 px-4 text-center">
                                            <span className={`text-[10px] font-bold uppercase ${getRouteKindTextColorClass(route)}`}>
                                                {getRouteKindLabel(route, lang)}
                                            </span>
                                        </td>

                                        {/* Cột 4: Khoảng cách */}
                                        <td className="py-4 px-4 text-center">
                                            <span className="font-bold text-slate-600 dark:text-slate-300">
                                                {route.baseDistanceKm != null ? `${route.baseDistanceKm} km` : "—"}
                                            </span>
                                        </td>

                                        {/* Cột 5: Thời gian */}
                                        <td className="py-4 px-4 text-center">
                                            <span className="font-bold text-slate-600 dark:text-slate-300">
                                                {route.estimatedDurationMin != null ? `${route.estimatedDurationMin} ${lang === "VN" ? "phút" : "min"}` : "—"}
                                            </span>
                                        </td>

                                        {/* Cột 6: Trạng thái */}
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${route.status === "Active"
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-500 dark:text-rose-400"
                                                }`}>
                                                {route.status === "Active"
                                                    ? (lang === "VN" ? "Hoạt động" : "Active")
                                                    : (lang === "VN" ? "Ngưng hoạt động" : "Inactive")}
                                            </span>
                                        </td>

                                        {/* Cột 7: Nút Hành động */}
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/routes-management/${route.routeId}`)}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] hover:bg-slate-50 dark:hover:bg-slate-700 dark:hover:text-yellow-400 hover:border-slate-300 transition-all shadow-sm"
                                                    title={lang === "VN" ? "Xem chi tiết tuyến" : "View Route Detail"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRoute(route)}
                                                    disabled={deletingRouteId === route.routeId}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all shadow-sm disabled:opacity-40"
                                                    title={lang === "VN" ? "Xóa tuyến đường" : "Delete Route"}
                                                >
                                                    {deletingRouteId === route.routeId
                                                        ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                        : <span className="material-symbols-outlined text-[18px]">delete</span>}
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

            {/* KHỐI PHÂN TRANG (PAGINATION) */}
            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredRoutes.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${filteredRoutes.length} entries`}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">

                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_left</span>
                        </button>

                        {getPaginationGroup().map((item, index) => {
                            if (item === '...') {
                                return (
                                    <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-slate-400 font-bold tracking-widest shrink-0">
                                        ...
                                    </span>
                                );
                            }
                            return (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setCurrentPage(item)}
                                    className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${currentPage === item
                                        ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                                        : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    {item}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === totalPages
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_right</span>
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
