import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllVessels } from "../../../services/vesselService";

export function VesselManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    // Link ảnh mặc định phòng trường hợp imageUrl từ API trả về null
    const DEFAULT_VESSEL_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png";

    // STATE QUẢN LÝ DỮ LIỆU ĐỘI TÀU TỪ API
    const [vessels, setVessels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    // States quản lý tìm kiếm và bộ lọc nâng cao
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [deckFilter, setDeckFilter] = useState("All");

    // EFFECT: GỌI API KHI TRANG VỪA LOAD
    useEffect(() => {
        const getVesselsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchAllVessels();
                setVessels(data || []);
            } catch (error) {
                console.error("Failed to load vessels:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể kết nối đến hệ thống máy chủ để lấy dữ liệu đội tàu."
                        : "Failed to connect to server to fetch fleet records."
                );
            } finally {
                setIsLoading(false);
            }
        };

        getVesselsData();
    }, [lang]);

    // THỐNG KÊ NHANH (So sánh theo Text)
    const totalVessels = vessels.length;
    const activeVessels = vessels.filter(v => v.status?.toLowerCase() === "active").length;
    const inactiveVessels = vessels.filter(v => v.status?.toLowerCase() === "inactive").length;
    const retiredVessels = vessels.filter(v => v.status?.toLowerCase() === "retired").length;
    const maintenanceVessels = vessels.filter(v => v.status?.toLowerCase() === "maintenance").length;

    // Xử lý logic Tìm kiếm + Lọc trạng thái + Lọc số tầng
    const filteredVessels = vessels.filter(vessel => {
        const nameMatch = vessel.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const codeMatch = vessel.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSearch = nameMatch || codeMatch;

        const matchesStatus = statusFilter === "All" || vessel.status?.toLowerCase() === statusFilter.toLowerCase();
        const matchesDeck = deckFilter === "All" || Number(vessel.numberOfDecks) === Number(deckFilter);

        return matchesSearch && matchesStatus && matchesDeck;
    });

    // Helper map tên trạng thái hiển thị
    const getStatusInfo = (statusValue) => {
        const statusStr = statusValue?.toLowerCase();
        switch (statusStr) {
            case "active":
                return {
                    label: lang === "VN" ? "Hoạt động" : "Active",
                    classes: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                    dot: "bg-emerald-500"
                };
            case "inactive":
                return {
                    label: lang === "VN" ? "Tạm ngưng" : "Inactive",
                    classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    dot: "bg-slate-400"
                };
            case "retired":
                return {
                    label: lang === "VN" ? "Hết hạn" : "Retired",
                    classes: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
                    dot: "bg-rose-500"
                };
            case "maintenance":
                return {
                    label: lang === "VN" ? "Bảo trì" : "Maintenance",
                    classes: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
                    dot: "bg-amber-500"
                };
            default:
                return {
                    label: statusValue || (lang === "VN" ? "Không rõ" : "Unknown"),
                    classes: "bg-slate-100 text-slate-400",
                    dot: "bg-slate-300"
                };
        }
    };

    // CÁC HÀM XỬ LÝ ĐIỀU HƯỚNG
    const handleAddVessel = () => navigate("/admin/vessels-management/create");
    const handleEditVessel = (id) => navigate(`/admin/vessels-management/edit/${id}`);
    const handleConfigureSeats = (id) => navigate(`/admin/vessels-management/seats/${id}`);
    const handleDeleteVessel = (code) => {
        if (window.confirm(lang === "VN" ? `Bạn chắc chắn muốn xóa mã số hiệu tàu ${code} khỏi hệ thống?` : `Are you sure you want to delete vessel code ${code}?`)) {
            setVessels(prev => prev.filter(v => v.code !== code));
        }
    };

    return (
        <div className="space-y-8 select-none font-body">

            {/* --- KHỐI TIÊU ĐỀ CHÍNH & PHỤ --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Quản Lý Đội Tàu Phương Tiện" : "Vessel Fleet Matrix"}
                    </h2>
                    <p className="text-sm font-medium text-slate-400">
                        {lang === "VN"
                            ? "Giám sát thông số kỹ thuật, sức chứa, số tầng và điều phối trạng thái vận hành đội tàu thủy."
                            : "Monitor hardware specs, seating counts, deck configurations, and fleet status models."}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleAddVessel}
                    className="bg-[#FFD100] text-[#124757] font-headline font-black uppercase text-xs tracking-wider px-6 py-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center gap-2 w-max shrink-0"
                >
                    <span className="material-symbols-outlined text-base font-black">add_circle</span>
                    {lang === "VN" ? "Thêm tàu mới" : "Add New Vessel"}
                </button>
            </div>

            {/* --- SECTION 1: 5 KHỐI CARD VUÔNG THỐNG KÊ SỐ LIỆU --- */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-[#124757] dark:bg-slate-900 dark:text-yellow-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">directions_boat</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Tổng số tàu" : "Total Fleet"}</p>
                        <h3 className="text-xl font-headline font-black text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : totalVessels}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Hoạt động" : "Active"}</p>
                        <h3 className="text-xl font-headline font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{isLoading ? "..." : activeVessels}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">pause_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Tạm ngưng" : "Inactive"}</p>
                        <h3 className="text-xl font-headline font-black text-slate-600 dark:text-slate-300 mt-0.5">{isLoading ? "..." : inactiveVessels}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">history_toggle_off</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Hết hạn" : "Retired"}</p>
                        <h3 className="text-xl font-headline font-black text-rose-600 dark:text-rose-400 mt-0.5">{isLoading ? "..." : retiredVessels}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">build_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Bảo trì" : "Maintenance"}</p>
                        <h3 className="text-xl font-headline font-black text-amber-600 dark:text-amber-400 mt-0.5">{isLoading ? "..." : maintenanceVessels}</h3>
                    </div>
                </div>
            </div>

            {/* --- THANH TÌM KIẾM + BỘ LỌC ĐA NĂNG --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
                <div className="relative w-full md:max-w-xs">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={lang === "VN" ? "Tìm theo số hiệu, tên tàu..." : "Search by code, vessel name..."}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] transition-all dark:text-white"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Số tầng:" : "Decks:"}</span>
                        <select
                            value={deckFilter}
                            onChange={(e) => setDeckFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        >
                            <option value="All">{lang === "VN" ? "Tất cả tầng" : "All Decks"}</option>
                            <option value="1">{lang === "VN" ? "1 Tầng" : "1 Deck"}</option>
                            <option value="2">{lang === "VN" ? "2 Tầng" : "2 Decks"}</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        >
                            <option value="All">{lang === "VN" ? "Tất cả trạng thái" : "All Status"}</option>
                            <option value="Active">{lang === "VN" ? "Active (Hoạt động)" : "Active"}</option>
                            <option value="Inactive">{lang === "VN" ? "Inactive (Tạm ngưng)" : "Inactive"}</option>
                            <option value="Retired">{lang === "VN" ? "Retired (Hết hạn)" : "Retired"}</option>
                            <option value="Maintenance">{lang === "VN" ? "Maintenance (Bảo trì)" : "Maintenance"}</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* --- DANH SÁCH BẢNG TRUY VẤN TÀU --- */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-xs font-headline font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                <th className="py-4 px-6">{lang === "VN" ? "Số hiệu tàu" : "Vessel Code"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Hình ảnh" : "Image"}</th>
                                <th className="py-4 px-6">{lang === "VN" ? "Tên tàu" : "Vessel Name"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Sức chứa" : "Capacity"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Số tầng" : "Decks"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm font-medium">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-16 text-slate-400 font-medium">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#124757] rounded-full animate-spin mx-auto mb-2"></div>
                                        <p className="text-xs tracking-wider animate-pulse">{lang === "VN" ? "Đang đồng bộ dữ liệu đội tàu thủy..." : "Synchronizing vessels database..."}</p>
                                    </td>
                                </tr>
                            ) : errorMsg ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-16 text-red-500 font-bold text-xs">
                                        <span className="material-symbols-outlined text-3xl mb-1 block">error</span>
                                        {errorMsg}
                                    </td>
                                </tr>
                            ) : filteredVessels.length > 0 ? (
                                filteredVessels.map((vessel) => {
                                    const statusConfig = getStatusInfo(vessel.status);
                                    return (
                                        <tr key={vessel.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group">
                                            {/* "code": Số hiệu tàu */}
                                            <td className="py-4 px-6 font-headline font-black text-[#124757] dark:text-yellow-400">
                                                {vessel.code}
                                            </td>

                                            {/* "imageUrl": Ảnh tàu */}
                                            <td className="py-4 px-4">
                                                <div className="w-16 h-10 rounded-xl overflow-hidden shadow-sm border dark:border-slate-600 bg-slate-100 shrink-0">
                                                    <img
                                                        src={vessel.imageUrl || DEFAULT_VESSEL_IMAGE}
                                                        alt={vessel.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => { e.target.src = DEFAULT_VESSEL_IMAGE; }}
                                                    />
                                                </div>
                                            </td>

                                            {/* "name": Tên tàu + Cảnh báo chưa cấu hình ghế */}
                                            <td className="py-4 px-6">
                                                <p className="font-bold text-slate-800 dark:text-white">{vessel.name}</p>
                                                {!vessel.seatsConfigured && (
                                                    <p className="text-[10px] font-bold text-amber-500 mt-1 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">warning</span>
                                                        {lang === "VN" ? "Chưa cấu hình ghế" : "Pending Layout"}
                                                    </p>
                                                )}
                                            </td>

                                            {/* "seatCount": Sức chứa */}
                                            <td className="py-4 px-6 text-center font-headline font-black text-slate-700 dark:text-slate-200">
                                                {vessel.seatCount || 0} <span className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "ghế" : "pax"}</span>
                                            </td>

                                            {/* "numberOfDecks": Số tầng */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                    {vessel.numberOfDecks} {lang === "VN" ? "Tầng" : "Deck(s)"}
                                                </span>
                                            </td>

                                            {/* "status": Trạng thái */}
                                            <td className="py-4 px-6 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-headline font-black uppercase tracking-wider shadow-inner ${statusConfig.classes}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}></span>
                                                    {statusConfig.label}
                                                </span>
                                            </td>

                                            {/* Thao tác Hành động */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* NÚT CẤU HÌNH GHẾ */}
                                                    {/* CHỈ HIỂN THỊ NÚT KHI tàu chưa cấu hình ghế (seatsConfigured === false) */}
                                                    {!vessel.seatsConfigured && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfigureSeats(vessel.id)}
                                                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#124757] hover:text-[#124757] dark:hover:border-yellow-400 dark:hover:text-yellow-400 flex items-center justify-center transition-colors shadow-sm"
                                                            title={lang === "VN" ? "Cấu hình sơ đồ ghế" : "Configure Seats"}
                                                        >
                                                            <span className="material-symbols-outlined text-base">chair</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditVessel(vessel.id)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 flex items-center justify-center transition-all shadow-inner"
                                                        title={lang === "VN" ? "Sửa thông tin" : "Edit Details"}
                                                    >
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteVessel(vessel.code)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-inner"
                                                        title={lang === "VN" ? "Xóa khỏi danh sách" : "Delete Vessel"}
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" className="text-center py-12 text-slate-400 font-medium text-xs">
                                        <span className="material-symbols-outlined text-3xl mb-1 opacity-60 block">database_off</span>
                                        {lang === "VN" ? "Không có dữ liệu tàu thủy nào khớp với từ khóa tìm kiếm." : "No vessels records found matching the specifications."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- KHỐI ĐIỀU HƯỚNG PHÂN TRANG --- */}
            <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-400">
                <div>
                    {lang === "VN"
                        ? `Hiển thị ${filteredVessels.length}/${totalVessels} phương tiện`
                        : `Showing ${filteredVessels.length} of ${totalVessels} vessels`}
                </div>

                <div className="flex items-center gap-1.5">
                    <button type="button" disabled className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-300 cursor-not-allowed">
                        <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-[#124757] text-white dark:bg-[#FFD100] dark:text-slate-900 shadow-sm border border-transparent flex items-center justify-center font-black font-headline">
                        1
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-slate-400">
                        2
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-slate-400">
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                </div>
            </div>

        </div>
    );
}

export { EditVessel } from "./EditVessel";
export { CreateVessel } from "./CreateVessel";
export { SeatLayoutEditor } from "./SeatLayoutEditor";
