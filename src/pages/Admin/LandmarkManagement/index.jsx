import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllLandmarks, removeLandmark } from "../../../services/landmarksService";
import { notify } from "../../../utils/swalToast";
import { getApiErrorMessage } from "../../../utils/apiError";
import { FormSelect } from "../../../components/FormSelect";
import { WaterwayMap } from "../../../components/WaterwayMap";

export function LandmarkManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [landmarks, setLandmarks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    const loadLandmarks = useCallback(async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchAllLandmarks();
            setLandmarks(data || []);
        } catch (error) {
            console.error("Lỗi giao diện tải danh sách landmark:", error);
            setErrorMsg(getApiErrorMessage(
                error,
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách landmark."
                    : "Failed to load landmark directory."
            ));
        } finally {
            setIsLoading(false);
        }
    }, [lang]);

    useEffect(() => {
        loadLandmarks();
    }, [loadLandmarks]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const stats = {
        total: landmarks.length,
        active: landmarks.filter((l) => l.isActive).length,
        inactive: landmarks.filter((l) => !l.isActive).length,
        audios: landmarks.reduce((sum, l) => sum + (l.audios?.length || 0), 0),
    };

    const filteredLandmarks = landmarks.filter((landmark) => {
        const matchesSearch = (landmark.landmarkName?.toLowerCase() || "").includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === "All" ||
            (statusFilter === "Active" && landmark.isActive) ||
            (statusFilter === "Inactive" && !landmark.isActive);
        return matchesSearch && matchesStatus;
    });

    const sortedLandmarks = [...filteredLandmarks].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    // Điểm hiện trên bản đồ — theo đúng bộ lọc tìm kiếm/trạng thái đang áp dụng, không phụ thuộc phân trang.
    const landmarkMapMarkers = useMemo(
        () => sortedLandmarks.map((landmark) => ({
            id: landmark.id,
            name: landmark.landmarkName,
            latitude: landmark.latitude,
            longitude: landmark.longitude,
            isActive: landmark.isActive,
            radius: landmark.triggerRadiusMeters,
        })),
        [sortedLandmarks],
    );

    const totalPages = Math.ceil(sortedLandmarks.length / ITEMS_PER_PAGE);
    const currentLandmarks = sortedLandmarks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = sortedLandmarks.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, sortedLandmarks.length);

    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 3) {
            pages = [1, 2, 3, 4, '...', totalPages];
        } else if (currentPage >= totalPages - 2) {
            pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
        }
        return pages;
    };

    const handleDelete = async (landmark) => {
        const confirmResult = await notify({
            title: lang === "VN" ? "Xóa landmark?" : "Delete this landmark?",
            html: lang === "VN"
                ? `Landmark <b>${landmark.landmarkName}</b> và toàn bộ audio đã bake của nó sẽ bị <b>xóa vĩnh viễn</b>.`
                : `Landmark <b>${landmark.landmarkName}</b> and all of its baked audio will be <b>permanently deleted</b>.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Xóa" : "Delete",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setProcessingId(landmark.id);
            await removeLandmark(landmark.id);
            notify({
                toast: true,
                icon: "success",
                title: lang === "VN" ? "Đã xóa landmark" : "Landmark deleted",
                showConfirmButton: false,
                timer: 1600,
            });
            await loadLandmarks();
        } catch (error) {
            console.error("Lỗi khi xóa landmark:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Thất bại" : "Failed",
                text: getApiErrorMessage(error, lang === "VN" ? "Không thể xóa landmark này." : "Failed to delete this landmark."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setProcessingId(null);
        }
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

            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Landmark thuyết minh" : "Landmark Directory"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN"
                            ? "Điểm mốc định danh bằng tọa độ, dùng chung mọi tuyến đi ngang qua để phát audio thuyết minh."
                            : "Coordinate-based waypoints shared across every route that passes through them, used to trigger audio narration."}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/landmarks-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                    {lang === "VN" ? "Thêm landmark mới" : "Add Landmark"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số landmark" : "Total Landmarks"}</span>
                    <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang kích hoạt" : "Active"}</span>
                    <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Ngưng kích hoạt" : "Inactive"}</span>
                    <h3 className="text-xl font-black font-headline text-rose-500 mt-0.5">{stats.inactive}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Audio đã bake" : "Baked Audios"}</span>
                    <h3 className="text-xl font-black font-headline text-indigo-500 dark:text-indigo-400 mt-0.5">{stats.audios}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-115">
                <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
                    <div>
                        <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                            {lang === "VN" ? "Bản đồ landmark" : "Landmark map"}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {lang === "VN"
                                ? "Vị trí các landmark theo tọa độ — chấm xám là landmark đang ngưng hoạt động."
                                : "Landmark positions by coordinate — grey dots are inactive landmarks."}
                        </p>
                    </div>
                    <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {landmarkMapMarkers.length} {lang === "VN" ? "điểm" : "points"}
                    </span>
                </div>
                <div className="relative min-h-75 w-full flex-1">
                    <div className="absolute inset-0">
                        {landmarkMapMarkers.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400 dark:bg-slate-900">
                                {lang === "VN" ? "Không có landmark nào phù hợp bộ lọc." : "No landmarks match the current filters."}
                            </div>
                        ) : (
                            <WaterwayMap
                                landmarkMarkers={landmarkMapMarkers}
                                onLandmarkEdit={(landmark) =>
                                    navigate(`/admin/landmarks-management/edit/${landmark.id}`)
                                }
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
                <div className="w-full xl:flex-1 relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tên landmark..." : "Search by landmark name..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="relative z-10 flex items-center gap-2 w-full xl:w-auto justify-end">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
                    <FormSelect
                        value={statusFilter}
                        onChange={setStatusFilter}
                        menuAlign="right"
                        options={[
                            { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All Status" },
                            { value: "Active", label: lang === "VN" ? "Hoạt động" : "Active" },
                            { value: "Inactive", label: lang === "VN" ? "Ngưng hoạt động" : "Inactive" },
                        ]}
                        className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin landmark" : "Landmark Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Tọa độ" : "Coordinates"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Bán kính (m)" : "Radius (m)"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Audio" : "Audio"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentLandmarks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có landmark nào phù hợp bộ lọc." : "No landmarks found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentLandmarks.map((landmark) => (
                                    <tr key={landmark.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug">
                                                            {landmark.landmarkName}
                                                        </h4>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200 tabular-nums">
                                                {landmark.latitude?.toFixed(5)}, {landmark.longitude?.toFixed(5)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center tabular-nums font-bold">
                                            {landmark.triggerRadiusMeters}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                                                {landmark.audios.length}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${landmark.isActive
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-500 dark:text-rose-400"
                                                }`}>
                                                {landmark.isActive
                                                    ? (lang === "VN" ? "Hoạt động" : "Active")
                                                    : (lang === "VN" ? "Ngưng hoạt động" : "Inactive")}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/landmarks-management/edit/${landmark.id}`, { state: { landmark } })}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                    title={lang === "VN" ? "Chỉnh sửa landmark" : "Edit landmark"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(landmark)}
                                                    disabled={processingId === landmark.id}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:border-rose-200 dark:hover:border-rose-500/30 transition-all shadow-sm disabled:opacity-40"
                                                    title={lang === "VN" ? "Xóa landmark" : "Delete landmark"}
                                                >
                                                    {processingId === landmark.id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    )}
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

            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${sortedLandmarks.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${sortedLandmarks.length} entries`}
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
