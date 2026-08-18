import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllStations, fetchStationDetail, modifyStation } from "../../../services/stationService";
import { notify } from "../../../utils/swalToast";
import { NullImageIcon } from "../../../components/NullImageIcon";
import { FormSelect } from "../../../components/FormSelect";
import { WaterwayMap } from "../../../components/WaterwayMap";

export function StationManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    // Danh sách ID nhà ga có ảnh lỗi (load thất bại) -> hiển thị NullImageIcon thay thế
    const [brokenImageIds, setBrokenImageIds] = useState(new Set());

    // State quản lý 3 bộ lọc
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [typeFilter, setTypeFilter] = useState("All"); // Bộ lọc loại trạm (isWaterbusStation)

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    const [togglingId, setTogglingId] = useState(null);

    useEffect(() => {
        const getStationsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchAllStations();
                setStations(data || []);
            } catch (error) {
                console.error("Lỗi giao diện tải danh sách trạm:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể kết nối tới máy chủ để tải danh sách nhà ga."
                        : "Failed to establish secure connection to retrieve station logs."
                );
            } finally {
                setIsLoading(false);
            }
        };
        getStationsData();
    }, [lang]);

    // Tự động đưa về trang 1 nếu người dùng thay đổi bất kỳ bộ lọc nào
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, typeFilter]);

    const stats = {
        total: stations.length,
        active: stations.filter(s => s.status === "Active").length,
        inactive: stations.filter(s => s.status === "Inactive" || s.status === null).length
    };

    const filteredStations = stations.filter((station) => {
        const matchesSearch =
            (station.stationName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (station.stationCode?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        const matchesStatus =
            statusFilter === "All" ||
            (station.status === statusFilter);

        // KIỂM TRA BỘ LỌC LOẠI TRẠM (isWaterbusStation)
        const isWaterbus = station.isWaterbusStation !== false; // Mặc định true nếu API thiếu field
        const matchesType =
            typeFilter === "All" ||
            (typeFilter === "Waterbus" && isWaterbus) ||
            (typeFilter === "Other" && !isWaterbus);

        return matchesSearch && matchesStatus && matchesType;
    });

    // Điểm hiện trên bản đồ — theo đúng bộ lọc tìm kiếm/loại/trạng thái đang áp dụng, không phụ thuộc phân trang.
    const stationMapMarkers = useMemo(
        () => filteredStations.filter((station) => station.latitude != null && station.longitude != null),
        [filteredStations]
    );

    const totalPages = Math.ceil(filteredStations.length / ITEMS_PER_PAGE);
    const currentStations = filteredStations.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredStations.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredStations.length);

    // THUẬT TOÁN TẠO PHÂN TRANG GỌN NHẸ (Hiển thị mảng ví dụ: 1, 2, 3, ..., 10)
    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            // Nếu có ít hơn hoặc bằng 5 trang, hiện đủ hết
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // Rút gọn bằng dấu ...
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

    // Đánh dấu ảnh của một nhà ga bị lỗi (load thất bại) để chuyển sang hiển thị NullImageIcon
    const markImageBroken = (stationId) => {
        setBrokenImageIds((prev) => {
            if (prev.has(stationId)) return prev;
            const next = new Set(prev);
            next.add(stationId);
            return next;
        });
    };

    // Nhãn trạng thái theo ngôn ngữ hiện tại
    const getStatusLabel = (status) => {
        const isActive = status === "Active";
        if (lang === "VN") return isActive ? "Hoạt động" : "Ngưng hoạt động";
        return isActive ? "Active" : "Inactive";
    };

    // Bật/tắt trạng thái hoạt động của nhà ga (giữ nguyên các trường khác)
    const handleToggleStatus = async (station) => {
        const previousStatus = station.status || "Inactive";
        const nextStatus = previousStatus === "Active" ? "Inactive" : "Active";

        setTogglingId(station.stationId);
        setStations((prev) =>
            prev.map((s) => (s.stationId === station.stationId ? { ...s, status: nextStatus } : s))
        );

        try {
            const detail = await fetchStationDetail(station.stationId);
            const payload = {
                stationName: detail.stationName,
                address: detail.address || null,
                description: detail.description || null,
                latitude: Number(detail.latitude),
                longitude: Number(detail.longitude),
                status: nextStatus,
                hasWaitingArea: !!detail.hasWaitingArea,
                hasParking: !!detail.hasParking,
                hasTicketCounter: !!detail.hasTicketCounter,
                openingTime: detail.openingTime || null,
                closingTime: detail.closingTime || null,
                isWaterbusStation: detail.isWaterbusStation !== false,
                imageUrls: detail.imageUrls?.length ? detail.imageUrls : (detail.imageUrl ? [detail.imageUrl] : []),
            };

            await modifyStation(station.stationId, payload);

            notify({
                toast: true,
                icon: "success",
                title: nextStatus === "Active"
                    ? (lang === "VN" ? "Đã bật nhà ga" : "Station activated")
                    : (lang === "VN" ? "Đã tắt nhà ga" : "Station deactivated"),
                showConfirmButton: false,
                timer: 1500,
            });
        } catch (error) {
            console.error(`Lỗi khi đổi trạng thái nhà ga ${station.stationId}:`, error);
            setStations((prev) =>
                prev.map((s) => (s.stationId === station.stationId ? { ...s, status: previousStatus } : s))
            );
            notify({
                icon: "error",
                title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể đổi trạng thái nhà ga." : "Could not update station status."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setTogglingId(null);
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

            {/* KHỐI TIÊU ĐỀ CHÍNH & PHỤ + NÚT THÊM NHÀ GA MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Hệ thống Nhà Ga" : "Stations Blueprint Directory"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách các trạm bến WaterBus, phân loại trạm, tọa độ địa cầu và trạng thái." : "Monitor public piers, manage geographic coordinates and infrastructure setups."}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/stations-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                    {lang === "VN" ? "Thêm nhà ga mới" : "Import Pier"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* SECTION 1: KHỐI CARD THỐNG KÊ SỐ LIỆU */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số nhà ga" : "Total Stations"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang hoạt động" : "Active Piers"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Ngưng hoạt động" : "Inactive / Closed"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-500 mt-0.5">{stats.inactive}</h3>
                    </div>
                </div>
            </div>

            {/* SECTION 2: BẢN ĐỒ NHÀ GA */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col h-115">
                <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-2">
                    <div>
                        <h3 className="font-headline text-xs font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                            {lang === "VN" ? "Bản đồ nhà ga" : "Station map"}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {lang === "VN"
                                ? "Vị trí các nhà ga theo tọa độ — cờ mờ/xám là nhà ga đang ngưng hoạt động. Bấm vào cờ để sửa nhanh."
                                : "Station positions by coordinate — dimmed/grey flags are inactive stations. Click a flag to edit."}
                        </p>
                    </div>
                    <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                        {stationMapMarkers.length} {lang === "VN" ? "điểm" : "points"}
                    </span>
                </div>
                <div className="relative min-h-75 w-full flex-1">
                    <div className="absolute inset-0">
                        {stationMapMarkers.length === 0 ? (
                            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-400 dark:bg-slate-900">
                                {lang === "VN" ? "Không có nhà ga nào phù hợp bộ lọc." : "No stations match the current filters."}
                            </div>
                        ) : (
                            <WaterwayMap
                                stationsList={stationMapMarkers}
                                stationAsFlag
                                showStationLabels
                                showStationImages
                                includeInactiveStations
                                onStationEdit={(station) =>
                                    navigate(`/admin/stations-management/edit/${station.stationId}`)
                                }
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* THANH TÌM KIẾM VÀ CÁC BỘ LỌC FILTER */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-stretch xl:items-center overflow-visible relative z-20">

                {/* Khối Tìm kiếm Text */}
                <div className="w-full relative flex items-center flex-1">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tên bến ga hoặc mã hiệu..." : "Search pier by name or station code..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                {/* Khối Nút Lọc (Dropdown) */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto justify-end overflow-visible">
                    <div className="relative z-30 flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:inline">
                            {lang === "VN" ? "Loại" : "Type"}
                        </span>
                        <FormSelect
                            value={typeFilter}
                            onChange={setTypeFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả loại trạm" : "All Pier Types" },
                                { value: "Waterbus", label: lang === "VN" ? "Trạm Waterbus" : "Waterbus Pier" },
                                { value: "Other", label: lang === "VN" ? "Trạm liên kết" : "Partner Pier" },
                            ]}
                            className="min-w-45 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
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

            {/* BẢNG DANH SÁCH NHÀ GA */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Hình ảnh" : "Image"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Tên / Địa chỉ nhà ga" : "Name / Address"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Phân loại" : "Type"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Mã nhà ga" : "Station Code"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentStations.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">wrong_location</span>
                                        {lang === "VN" ? "Không có dữ liệu nhà ga nào phù hợp bộ lọc." : "No records found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentStations.map((station) => (
                                    <tr key={station.stationId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">

                                        {/* Cột 1: Hình ảnh */}
                                        <td className="py-4 px-6">
                                            <div className="w-14 h-10 rounded-xl overflow-hidden border bg-slate-100 dark:bg-slate-700 shadow-sm shrink-0 flex items-center justify-center">
                                                {(() => {
                                                    const imgSrc = station.imageUrl || (station.imageUrls && station.imageUrls[0]);
                                                    const showImage = imgSrc && !brokenImageIds.has(station.stationId);
                                                    return showImage ? (
                                                        <img
                                                            src={imgSrc}
                                                            alt="Station"
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={() => markImageBroken(station.stationId)}
                                                        />
                                                    ) : (
                                                        <NullImageIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                                                    );
                                                })()}
                                            </div>
                                        </td>

                                        {/* Cột 2: Tên / Địa chỉ nhà ga */}
                                        <td className="py-4 px-4">
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug">
                                                    {station.stationName}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block max-w-sm truncate">
                                                    {station.address || (lang === "VN" ? "Chưa thiết lập địa chỉ" : "Address unassigned")}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Cột 3: Phân loại trạm */}
                                        <td className="py-4 px-4 text-center">
                                            {station.isWaterbusStation !== false ? (
                                                <span className="text-[#124757] dark:text-yellow-400 text-[10px] uppercase font-black tracking-widest" title={lang === "VN" ? "Trạm Waterbus Chính Thức" : "Official Waterbus Pier"}>
                                                    {lang === "VN" ? "Trạm Waterbus" : "Waterbus Pier"}
                                                </span>
                                            ) : (
                                                <span className="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-black tracking-widest" title={lang === "VN" ? "Trạm Liên Kết Ngoại" : "Partner Pier"}>
                                                    {lang === "VN" ? "Trạm liên kết" : "Partner Pier"}
                                                </span>
                                            )}
                                        </td>

                                        {/* Cột 4: Mã nhà ga */}
                                        <td className="py-4 px-4">
                                            <span className="font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200">
                                                {station.stationCode}
                                            </span>
                                        </td>

                                        {/* Cột 5: Trạng thái */}
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${station.status === "Active"
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-rose-500 dark:text-rose-400"
                                                }`}>
                                                {getStatusLabel(station.status)}
                                            </span>
                                        </td>

                                        {/* Cột 6: Nút Hành động */}
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/stations-management/edit/${station.stationId}`)}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                    title={lang === "VN" ? "Chỉnh sửa nhà ga" : "Modify Station"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(station)}
                                                    disabled={togglingId === station.stationId}
                                                    className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${station.status === "Active"
                                                            ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:border-rose-200 dark:hover:border-rose-500/30"
                                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:border-emerald-200 dark:hover:border-emerald-500/30"
                                                        }`}
                                                    title={station.status === "Active"
                                                        ? (lang === "VN" ? "Tắt nhà ga" : "Deactivate Station")
                                                        : (lang === "VN" ? "Bật nhà ga" : "Activate Station")}
                                                >
                                                    {togglingId === station.stationId ? (
                                                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            {station.status === "Active" ? "toggle_on" : "toggle_off"}
                                                        </span>
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

            {/* KHỐI PHÂN TRANG (PAGINATION) */}
            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredStations.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${filteredStations.length} entries`}
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

                        {/* Gọi hàm Render mảng phân trang có chứa '...' */}
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