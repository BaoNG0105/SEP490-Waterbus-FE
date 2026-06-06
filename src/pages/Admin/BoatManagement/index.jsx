import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";

export function BoatManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    // ==========================================
    // MOCK DATA: DANH SÁCH ĐỘI TÀU
    // ==========================================
    const [boats, setBoats] = useState([
        { id: "SWB-001", name: "Saigon Waterbus 01", capacity: 66, status: "Active", image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png", type: "Standard" },
        { id: "SWB-002", name: "Saigon Waterbus 02", capacity: 66, status: "Active", image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png", type: "Standard" },
        { id: "SWB-003", name: "Saigon Water Taxi 01", capacity: 12, status: "Maintenance", image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075559/ustejbfjzikg2ls4rkvf.jpg", type: "Taxi" },
        { id: "SWB-004", name: "Saigon Cruise Pro", capacity: 80, status: "Active", image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075675/f2fvvilwixmukclz3nzn.png", type: "Express" },
        { id: "SWB-005", name: "Gia Định Charter H1", capacity: 45, status: "Inactive", image: "https://res.cloudinary.com/dygipvoal/image/upload/v1776075336/wkzbfwc5xyfby9ueute1.png", type: "Standard" },
    ]);

    // States quản lý tìm kiếm và bộ lọc trạng thái
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // ==========================================
    // THỐNG KÊ NHANH CÁC CHỈ SỐ (SECTION 1)
    // ==========================================
    const totalBoats = boats.length;
    const activeBoats = boats.filter(b => b.status === "Active").length;
    const maintenanceBoats = boats.filter(b => b.status === "Maintenance").length;
    const inactiveBoats = boats.filter(b => b.status === "Inactive").length;

    // Xử lý tìm kiếm và lọc dữ liệu trên danh sách
    const filteredBoats = boats.filter(boat => {
        const matchesSearch = boat.name.toLowerCase().includes(searchTerm.toLowerCase()) || boat.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = statusFilter === "All" || boat.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    const handleAddBoat = () => {
        navigate("/admin/boats-management/create");
    };

    const handleEditBoat = (id) => {
        navigate(`/admin/boats/edit/${id}`);
    };

    const handleDeleteBoat = (id) => {
        if (window.confirm(lang === "VN" ? `Bạn chắc chắn muốn xóa mã tàu ${id} khỏi đội tàu?` : `Are you sure you want to delete vessel ${id}?`)) {
            setBoats(prev => prev.filter(b => b.id !== id));
        }
    };

    return (
        <div className="space-y-8 select-none font-body">

            {/* --- KHỐI TIÊU ĐỀ CHÍNH & PHỤ (TITLE + SUBTITLE) --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Quản Lý Đội Tàu Phương Tiện" : "Vessel Fleet Management"}
                    </h2>
                    <p className="text-sm font-medium text-slate-400">
                        {lang === "VN"
                            ? "Giám sát thông số kỹ thuật, sức chứa và điều phối trạng thái bảo dưỡng đội tàu thủy trung tâm."
                            : "Monitor hardware specs, capacity grids, and service schedules across core river fleets."}
                    </p>
                </div>

                {/* NÚT THÊM MỚI (ADD BUTTON) */}
                <button
                    type="button"
                    onClick={handleAddBoat}
                    className="bg-[#FFD100] text-[#124757] font-headline font-black uppercase text-xs tracking-wider px-6 py-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center gap-2 w-max"
                >
                    <span className="material-symbols-outlined text-base font-black">add_circle</span>
                    {lang === "VN" ? "Thêm tàu mới" : "Add New Vessel"}
                </button>
            </div>

            {/* --- SECTION 1: CÁC CARD VUÔNG THỐNG KÊ SỐ LIỆU BAN ĐẦU --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1: Tổng số lượng tàu */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-2xl bg-[#124757]/10 text-[#124757] dark:bg-slate-900 dark:text-yellow-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">directions_boat</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Tổng số tàu" : "Total Fleet"}</p>
                        <h3 className="text-2xl font-headline font-black text-[#124757] dark:text-white mt-0.5">{totalBoats}</h3>
                    </div>
                </div>

                {/* Card 2: Số tàu hoạt động */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">check_circle</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Đang hoạt động" : "Active Vessels"}</p>
                        <h3 className="text-2xl font-headline font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeBoats}</h3>
                    </div>
                </div>

                {/* Card 3: Số tàu trục trặc/bảo trì */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">build_circle</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Đang bảo trì" : "Under Service"}</p>
                        <h3 className="text-2xl font-headline font-black text-amber-600 dark:text-amber-400 mt-0.5">{maintenanceBoats}</h3>
                    </div>
                </div>

                {/* Card 4: Tàu đang tạm dừng */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">pause_circle</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Đang tạm ngưng" : "Inactive"}</p>
                        <h3 className="text-2xl font-headline font-black text-slate-600 dark:text-slate-300 mt-0.5">{inactiveBoats}</h3>
                    </div>
                </div>
            </div>

            {/* --- THANH TÌM KIẾM + BỘ LỌC CHUYÊN SÂU (SEARCH BAR + FILTER) --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
                {/* Khung ô Search nhập liệu */}
                <div className="relative w-full md:max-w-md">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={lang === "VN" ? "Tìm theo mã số hoặc tên tàu thủy..." : "Search by vessel registration ID or name..."}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] transition-all dark:text-white"
                    />
                </div>

                {/* Khung Dropdown Filter */}
                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap hidden sm:block">
                        {lang === "VN" ? "Trạng thái:" : "Status Filter:"}
                    </span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    >
                        <option value="All">{lang === "VN" ? "Tất cả trạng thái" : "All Status"}</option>
                        <option value="Active">{lang === "VN" ? "Đang hoạt động" : "Active"}</option>
                        <option value="Maintenance">{lang === "VN" ? "Đang bảo trì" : "Maintenance"}</option>
                        <option value="Inactive">{lang === "VN" ? "Đang tạm dừng" : "Inactive"}</option>
                    </select>
                </div>
            </div>

            {/* --- LIST CÁC TÀU DẠNG BẢNG BENTO (ID, ẢNH, SỨC CHỨA, TRẠNG THÁI, ACTION) --- */}
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-xs font-headline font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                <th className="py-4 px-6">{lang === "VN" ? "Mã số tàu" : "Vessel ID"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Hình ảnh" : "Image"}</th>
                                <th className="py-4 px-6">{lang === "VN" ? "Tên phương tiện" : "Vessel Name"}</th>
                                <th className="py-4 px-6">{lang === "VN" ? "Phân loại" : "Class Type"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Sức chứa" : "Capacity"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm font-medium">
                            {filteredBoats.length > 0 ? (
                                filteredBoats.map((boat) => (
                                    <tr key={boat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group">
                                        {/* ID */}
                                        <td className="py-4 px-6 font-headline font-black text-[#124757] dark:text-yellow-400">
                                            {boat.id}
                                        </td>

                                        {/* Ảnh phương tiện */}
                                        <td className="py-4 px-4">
                                            <div className="w-16 h-10 rounded-xl overflow-hidden shadow-sm border dark:border-slate-600 bg-slate-100 shrink-0">
                                                <img src={boat.image} alt={boat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            </div>
                                        </td>

                                        {/* Tên Tàu */}
                                        <td className="py-4 px-6 font-bold text-slate-800 dark:text-white">
                                            {boat.name}
                                        </td>

                                        {/* Phân loại loại tàu */}
                                        <td className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400">
                                            {boat.type}
                                        </td>

                                        {/* Sức chứa */}
                                        <td className="py-4 px-6 text-center font-headline font-black text-slate-700 dark:text-slate-200">
                                            {boat.capacity} <span className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "ghế" : "pax"}</span>
                                        </td>

                                        {/* Trạng thái Badge dán màu */}
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-headline font-black uppercase tracking-wider shadow-inner ${boat.status === "Active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                boat.status === "Maintenance" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
                                                    "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${boat.status === "Active" ? "bg-emerald-500" :
                                                    boat.status === "Maintenance" ? "bg-amber-500" : "bg-rose-500"
                                                    }`}></span>
                                                {boat.status}
                                            </span>
                                        </td>

                                        {/* Cột các nút thao tác sửa/xóa */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditBoat(boat.id)}
                                                    className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border text-slate-500 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 flex items-center justify-center transition-all shadow-inner"
                                                    title={lang === "VN" ? "Sửa thông tin" : "Edit Details"}
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteBoat(boat.id)}
                                                    className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-inner"
                                                    title={lang === "VN" ? "Xóa khỏi danh sách" : "Delete Vessel"}
                                                >
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
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

            {/* --- KHỐI ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION) --- */}
            <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-400">
                <div>
                    {lang === "VN"
                        ? `Hiển thị ${filteredBoats.length}/${totalBoats} phương tiện`
                        : `Showing ${filteredBoats.length} of ${totalBoats} vessels`}
                </div>

                <div className="flex items-center gap-1.5">
                    <button type="button" disabled className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center font-bold text-slate-300 cursor-not-allowed">
                        <span className="material-symbols-outlined text-base">chevron_left</span>
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-[#124757] text-white dark:bg-[#FFD100] dark:text-slate-900 shadow-sm border border-transparent flex items-center justify-center font-black font-headline">
                        1
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-slate-400">
                        2
                    </button>
                    <button type="button" className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-slate-400">
                        <span className="material-symbols-outlined text-base">chevron_right</span>
                    </button>
                </div>
            </div>

        </div>
    );
}

export { EditBoat } from "./EditBoat";
export { CreateBoat } from "./CreateBoat";

// Lưu ý: Các chức năng thêm/sửa/xóa trong component này hiện chỉ là mô phỏng (mock) và chưa kết nối với backend thực tế. Khi tích hợp API, cần thay thế các hàm xử lý bằng các lệnh gọi HTTP tương ứng để thao tác dữ liệu thực tế trên server.