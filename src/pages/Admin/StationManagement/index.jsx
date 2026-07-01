import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllStations } from "../../../services/stationService";

export function StationManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    const DEFAULT_STATION_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776077167/vbxeolfuttvnbyql60ct.jpg";

    const [stations, setStations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // STATE QUẢN LÝ PHÂN TRANG
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6; // Giới hạn 6 nhà ga 1 trang

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

    // Tự động đưa về trang 1 nếu người dùng thay đổi bộ lọc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

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

        return matchesSearch && matchesStatus;
    });

    // LOGIC TÍNH TOÁN PHÂN TRANG
    const totalPages = Math.ceil(filteredStations.length / ITEMS_PER_PAGE);
    
    // Cắt lấy 6 nhà ga tương ứng với trang hiện tại
    const currentStations = filteredStations.slice(
        (currentPage - 1) * ITEMS_PER_PAGE, 
        currentPage * ITEMS_PER_PAGE
    );

    // Tính toán số hiển thị (Ví dụ: Hiển thị 1-6 / 10)
    const startIndex = filteredStations.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredStations.length);

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
                        {lang === "VN" ? "Quản lý Hệ thống Nhà Ga" : "Stations Blueprint Directory"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách các trạm bến WaterBus, cấu hình vị trí địa lý tọa độ địa cầu và trạng thái." : "Monitor public piers, manage geographic coordinates and infrastructure setups."}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/stations-management/create")}
                    className="px-5 py-3 bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                    {lang === "VN" ? "Thêm nhà ga mới" : "Import Pier"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 group-hover:bg-[#124757] group-hover:text-white dark:group-hover:bg-yellow-400 dark:group-hover:text-slate-900 transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">home_storage</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số nhà ga" : "Total Stations"}</span>
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">gpp_good</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang hoạt động" : "Active Piers"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-colors shadow-inner">
                        <span className="material-symbols-outlined text-2xl">wrong_location</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Ngưng hoạt động" : "Inactive / Closed"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-500 mt-0.5">{stats.inactive}</h3>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row gap-3 items-center">
                <div className="w-full md:flex-1 relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tên bến ga hoặc mã hiệu..." : "Search pier by name or station code..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pr-1 shrink-0">
                    {[
                        { key: "All", vn: "Tất cả trạng thái", en: "All Status" },
                        { key: "Active", vn: "Active", en: "Active" },
                        { key: "Inactive", vn: "Inactive", en: "Inactive" }
                    ].map((btn) => (
                        <button
                            key={btn.key} type="button"
                            onClick={() => setStatusFilter(btn.key)}
                            className={`px-4 py-3 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider border transition-all shrink-0 ${
                                statusFilter === btn.key
                                    ? "bg-[#124757] text-white border-transparent dark:bg-yellow-400 dark:text-slate-900 shadow-md"
                                    : "bg-white text-slate-500 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            {lang === "VN" ? btn.vn : btn.en}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin nhà ga" : "Pier Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Mã nhà ga" : "Station Code"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {/* Map qua currentStations thay vì map toàn bộ */}
                            {currentStations.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">wrong_location</span>
                                        {lang === "VN" ? "Không có dữ liệu nhà ga nào phù hợp bộ lọc." : "No records found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentStations.map((station) => (
                                    <tr key={station.stationId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-10 rounded-xl overflow-hidden border bg-slate-100 dark:bg-slate-700 shadow-sm shrink-0">
                                                    <img 
                                                        src={station.imageUrl || (station.imageUrls && station.imageUrls[0]) || DEFAULT_STATION_IMAGE} 
                                                        alt="Station" 
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        onError={(e) => { e.target.src = DEFAULT_STATION_IMAGE; }}
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug">
                                                        {station.stationName}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block max-w-sm truncate">
                                                        {station.address || (lang === "VN" ? "Chưa thiết lập địa chỉ" : "Address unassigned")}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-4 px-4">
                                            <span className="font-headline font-black text-[11px] tracking-wide text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border">
                                                {station.stationCode}
                                            </span>
                                        </td>

                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${
                                                station.status === "Active"
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                                                    : "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${station.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                                {station.status || "Inactive"}
                                            </span>
                                        </td>

                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/stations-management/edit/${station.stationId}`)}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                    title={lang === "VN" ? "Chỉnh sửa nhà ga" : "Modify Station"}
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

            {/* KHỐI ĐIỀU HƯỚNG PHÂN TRANG PAGINIATION ĐỘNG */}
            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN" 
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredStations.length} kết quả` 
                            : `Showing ${startIndex}-${endIndex} of ${filteredStations.length} entries`}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                        {/* Nút Prev */}
                        <button 
                            type="button" 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${
                                currentPage === 1 
                                    ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50" 
                                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_left</span>
                        </button>

                        {/* Các nút số thứ tự trang */}
                        {Array.from({ length: totalPages }).map((_, index) => {
                            const pageNum = index + 1;
                            return (
                                <button 
                                    key={pageNum} 
                                    type="button" 
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-black font-headline text-xs transition-all ${
                                        currentPage === pageNum
                                            ? "bg-[#124757] text-white shadow-md border-transparent dark:bg-yellow-400 dark:text-slate-900"
                                            : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        {/* Nút Next */}
                        <button 
                            type="button" 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${
                                currentPage === totalPages 
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