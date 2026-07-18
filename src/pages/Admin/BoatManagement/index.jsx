import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats, modifyBoatStatus, deleteBoat, fetchBoatDetail, fetchBoatDocuments } from "../../../services/boatService";
import { getActivateBoatBlockReason } from "../../../utils/boatDocuments";
import { BoatSeatLayoutPreviewModal } from "../../../components/BoatSeatLayoutPreview";
import { FormSelect } from "../../../components/FormSelect";
import { notify } from "../../../utils/swalToast";

const BOAT_STATUS_OPTIONS = [
    { value: "Active", labelVn: "Hoạt động", labelEn: "Active", hintVn: "Sẵn sàng vận hành", hintEn: "Ready for operation", icon: "check_circle", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", ring: "border-emerald-200 dark:border-emerald-500/30" },
    { value: "UnderMaintenance", labelVn: "Bảo trì", labelEn: "Under maintenance", hintVn: "Tạm dừng để bảo dưỡng", hintEn: "Temporarily under maintenance", icon: "build", tone: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", ring: "border-amber-200 dark:border-amber-500/30" },
    { value: "Incident", labelVn: "Sự cố", labelEn: "Incident", hintVn: "Đang có sự cố Open", hintEn: "Has an open incident", icon: "emergency", tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", ring: "border-rose-200 dark:border-rose-500/30" },
    { value: "Inactive", labelVn: "Chưa hoạt động", labelEn: "Inactive", hintVn: "Không đưa vào lịch chạy", hintEn: "Not scheduled for trips", icon: "pause_circle", tone: "text-slate-500 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800", ring: "border-slate-200 dark:border-slate-600" },
    { value: "Retired", labelVn: "Dừng hoạt động", labelEn: "Retired", hintVn: "Ngừng sử dụng vĩnh viễn", hintEn: "Permanently out of service", icon: "cancel", tone: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", ring: "border-rose-200 dark:border-rose-500/30" },
];

export function BoatManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();

    // Link ảnh mặc định phòng trường hợp imageUrl từ API trả về null
    const DEFAULT_BOAT_IMAGE = "https://res.cloudinary.com/dygipvoal/image/upload/v1782999909/xpsin48malhqhy5c53oi.png";

    // STATE QUẢN LÝ DỮ LIỆU ĐỘI TÀU TỪ API
    const [boats, setBoats] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    // States quản lý tìm kiếm và bộ lọc nâng cao
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [deckFilter, setDeckFilter] = useState("All");
    const [statusModalBoat, setStatusModalBoat] = useState(null);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [seatPreviewBoat, setSeatPreviewBoat] = useState(null);

    // EFFECT: GỌI API KHI TRANG VỪA LOAD
    useEffect(() => {
        const getBoatsData = async () => {
            try {
                setIsLoading(true);
                setErrorMsg("");
                const data = await fetchAllBoats();
                setBoats(data || []);
            } catch (error) {
                console.error("Failed to load boats:", error);
                setErrorMsg(
                    lang === "VN"
                        ? "Không thể kết nối đến hệ thống máy chủ để lấy dữ liệu đội tàu."
                        : "Failed to connect to server to fetch fleet records."
                );
            } finally {
                setIsLoading(false);
            }
        };

        getBoatsData();
    }, [lang]);

    // XỬ LÝ: CẬP NHẬT TRẠNG THÁI TÀU
    const closeStatusModal = () => {
        if (isSavingStatus) return;
        setStatusModalBoat(null);
        setSelectedStatus("");
        setIsStatusDropdownOpen(false);
    };

    const handleUpdateStatus = (boat) => {
        // Tàu chưa cấu hình sơ đồ ghế thì BE đã tự set Inactive, không cho đổi sang trạng thái khác
        if (!boat.seatsConfigured) {
            notify({
                icon: "warning",
                title: lang === "VN" ? "Chưa thể đổi trạng thái" : "Cannot Change Status",
                text: lang === "VN"
                    ? "Tàu chưa được cấu hình sơ đồ ghế nên hệ thống tự đặt trạng thái Inactive. Vui lòng cấu hình sơ đồ ghế trước khi đổi trạng thái."
                    : "This boat has no seat layout configured, so the system keeps it Inactive. Configure the seat layout before changing its status.",
                confirmButtonColor: "#124757",
            });
            return;
        }

        setStatusModalBoat(boat);
        setSelectedStatus(boat.status || "Inactive");
        setIsStatusDropdownOpen(false);
    };

    const handleConfirmStatusUpdate = async () => {
        if (!statusModalBoat || !selectedStatus) return;

        if (selectedStatus === "Active" && !statusModalBoat.seatsConfigured) {
            notify({
                icon: "warning",
                title: lang === "VN" ? "Chưa thể kích hoạt" : "Cannot activate",
                text: lang === "VN"
                    ? "Tàu Active cần đủ sơ đồ ghế và 4 hồ sơ pháp lý. Hiện chưa cấu hình ghế."
                    : "Active requires seat layout and all 4 legal documents. Seats are not configured yet.",
                confirmButtonColor: "#124757",
            });
            return;
        }

        if (selectedStatus === statusModalBoat.status) {
            closeStatusModal();
            return;
        }

        if (selectedStatus === "Active") {
            try {
                setIsSavingStatus(true);
                const [boatDetail, documents] = await Promise.all([
                    fetchBoatDetail(statusModalBoat.id),
                    fetchBoatDocuments(statusModalBoat.id),
                ]);

                const wasUnderMaintenance = statusModalBoat.status?.toLowerCase() === "undermaintenance"
                    || boatDetail?.status?.toLowerCase() === "undermaintenance";
                const blockReason = getActivateBoatBlockReason(
                    { ...statusModalBoat, ...boatDetail },
                    documents,
                    lang,
                    { requireFreshInspection: wasUnderMaintenance },
                );

                if (blockReason) {
                    const confirmEdit = await notify({
                        icon: "warning",
                        title: lang === "VN" ? "Chưa đủ điều kiện Active" : "Cannot activate yet",
                        text: blockReason,
                        showCancelButton: true,
                        confirmButtonColor: "#124757",
                        cancelButtonColor: "#94a3b8",
                        confirmButtonText: lang === "VN" ? "Mở hồ sơ tàu" : "Open documents",
                        cancelButtonText: lang === "VN" ? "Đóng" : "Close",
                    });

                    if (confirmEdit.isConfirmed) {
                        navigate(`/admin/boats-management/edit/${statusModalBoat.id}`);
                    }
                    return;
                }
            } catch (error) {
                console.error("Lỗi kiểm tra hồ sơ tàu:", error);
                notify({
                    icon: "error",
                    title: lang === "VN" ? "Không kiểm tra được hồ sơ" : "Document check failed",
                    text: error.response?.data?.message || (lang === "VN"
                        ? "Không thể xác minh hồ sơ trước khi kích hoạt tàu."
                        : "Could not verify documents before activation."),
                    confirmButtonColor: "#124757",
                });
                return;
            } finally {
                setIsSavingStatus(false);
            }
        }

        try {
            setIsSavingStatus(true);
            await modifyBoatStatus(statusModalBoat.id, { status: selectedStatus });
            setStatusModalBoat(null);
            setSelectedStatus("");

            notify({
                icon: "success",
                title: lang === "VN" ? "Thành công!" : "Success!",
                text: lang === "VN" ? "Cập nhật trạng thái tàu thành công." : "Boat status updated successfully.",
                confirmButtonColor: "#124757",
                timer: 1400,
                showConfirmButton: false,
            });

            const data = await fetchAllBoats();
            setBoats(data || []);
        } catch (error) {
            console.error("Lỗi đổi trạng thái:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Lỗi hệ thống" : "Error",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể cập nhật trạng thái lúc này." : "Failed to update status."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsSavingStatus(false);
        }
    };

    // THỐNG KÊ NHANH (So sánh theo Text)
    const totalBoats = boats.length;
    const activeBoats = boats.filter(v => v.status?.toLowerCase() === "active").length;
    const inactiveBoats = boats.filter(v => v.status?.toLowerCase() === "inactive").length;
    const retiredBoats = boats.filter(v => v.status?.toLowerCase() === "retired").length;
    const maintenanceBoats = boats.filter(v => v.status?.toLowerCase() === "undermaintenance").length;

    // Xử lý logic Tìm kiếm + Lọc trạng thái + Lọc số tầng
    const filteredBoats = boats.filter(boats => {
        const nameMatch = boats.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const codeMatch = boats.code?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSearch = nameMatch || codeMatch;

        const matchesStatus = statusFilter === "All" || boats.status?.toLowerCase() === statusFilter.toLowerCase();
        const matchesDeck = deckFilter === "All" || Number(boats.numberOfDecks) === Number(deckFilter);

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
                    label: lang === "VN" ? "Chưa hoạt động" : "Inactive",
                    classes: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                    dot: "bg-slate-400"
                };
            case "retired":
                return {
                    label: lang === "VN" ? "Dừng hoạt động" : "Retired",
                    classes: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
                    dot: "bg-rose-500"
                };
            case "undermaintenance":
                return {
                    label: lang === "VN" ? "Bảo trì" : "UnderMaintenance",
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
    const handleAddBoat = () => navigate("/admin/boats-management/create");
    const handleEditBoat = (id) => navigate(`/admin/boats-management/edit/${id}`);
    const handleConfigureSeats = (id) => navigate(`/admin/boats-management/seats/${id}`);
    const handleCrewSchedule = (id) => navigate(`/admin/boats-management/crew/${id}`);
    const handleDeleteBoat = async (boat) => {
        const confirmResult = await notify({
            title: lang === "VN" ? "Xóa tàu?" : "Delete Boat?",
            html: lang === "VN"
                ? `Bạn chắc chắn muốn xóa vĩnh viễn tàu <b>${boat.name}</b> (${boat.code}) khỏi hệ thống? Hành động này không thể hoàn tác.`
                : `Are you sure you want to permanently delete boat <b>${boat.name}</b> (${boat.code})? This action cannot be undone.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Xác nhận xóa" : "Confirm Delete",
            cancelButtonText: lang === "VN" ? "Hủy bỏ" : "Cancel",
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setIsLoading(true);
            await deleteBoat(boat.id);

            notify({
                icon: "success",
                title: lang === "VN" ? "Đã xóa!" : "Deleted!",
                text: lang === "VN" ? `Tàu ${boat.code} đã được xóa khỏi hệ thống.` : `Boat ${boat.code} has been deleted.`,
                confirmButtonColor: "#124757",
            });

            const data = await fetchAllBoats();
            setBoats(data || []);
        } catch (error) {
            console.error("Lỗi xóa tàu:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa" : "Delete Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xóa tàu này. Có thể tàu đã có lịch chạy được ghi nhận." : "Failed to delete this boat. It may already be referenced by a schedule."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 select-none font-body">

            {/* --- KHỐI TIÊU ĐỀ CHÍNH & PHỤ --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Quản Lý Đội Tàu Phương Tiện" : "Boat Fleet Matrix"}
                    </h2>
                    <p className="text-sm font-medium text-slate-400">
                        {lang === "VN"
                            ? "Giám sát thông số kỹ thuật, sức chứa, số tầng và điều phối trạng thái vận hành đội tàu thủy."
                            : "Monitor hardware specs, seating counts, deck configurations, and fleet status models."}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleAddBoat}
                    className="bg-[#FFD100] text-[#124757] font-headline font-black uppercase text-xs tracking-wider px-6 py-3.5 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all flex items-center gap-2 w-max shrink-0"
                >
                    <span className="material-symbols-outlined text-base font-black">add_circle</span>
                    {lang === "VN" ? "Thêm tàu mới" : "Add New Boat"}
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
                        <h3 className="text-xl font-headline font-black text-[#124757] dark:text-white mt-0.5">{isLoading ? "..." : totalBoats}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Hoạt động" : "Active"}</p>
                        <h3 className="text-xl font-headline font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{isLoading ? "..." : activeBoats}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">pause_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Chưa hoạt động" : "Inactive"}</p>
                        <h3 className="text-xl font-headline font-black text-slate-600 dark:text-slate-300 mt-0.5">{isLoading ? "..." : inactiveBoats}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">history_toggle_off</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Dừng hoạt động" : "Retired"}</p>
                        <h3 className="text-xl font-headline font-black text-rose-600 dark:text-rose-400 mt-0.5">{isLoading ? "..." : retiredBoats}</h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-3.5 group hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/5 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">build_circle</span>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{lang === "VN" ? "Bảo trì" : "Maintenance"}</p>
                        <h3 className="text-xl font-headline font-black text-amber-600 dark:text-amber-400 mt-0.5">{isLoading ? "..." : maintenanceBoats}</h3>
                    </div>
                </div>
            </div>

            {/* --- THANH TÌM KIẾM + BỘ LỌC ĐA NĂNG --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between overflow-visible relative z-20">
                <div className="relative w-full md:max-w-xs">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={lang === "VN" ? "Tìm theo số hiệu, tên tàu..." : "Search by code, boat name..."}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#FFD100] transition-all dark:text-white"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end overflow-visible">
                    <div className="relative z-30 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Số tầng:" : "Decks:"}</span>
                        <FormSelect
                            value={deckFilter}
                            onChange={setDeckFilter}
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả tầng" : "All Decks" },
                                { value: "1", label: lang === "VN" ? "1 Tầng" : "1 Deck" },
                                { value: "2", label: lang === "VN" ? "2 Tầng" : "2 Decks" },
                            ]}
                            className="min-w-35 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>

                    <div className="relative z-20 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Trạng thái:" : "Status:"}</span>
                        <FormSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            menuAlign="right"
                            options={[
                                { value: "All", label: lang === "VN" ? "Tất cả trạng thái" : "All Status" },
                                { value: "Active", label: lang === "VN" ? "Active (Hoạt động)" : "Active" },
                                { value: "Inactive", label: lang === "VN" ? "Inactive (Chưa hoạt động)" : "Inactive" },
                                { value: "UnderMaintenance", label: lang === "VN" ? "UnderMaintenance (Bảo trì)" : "UnderMaintenance" },
                                { value: "Incident", label: lang === "VN" ? "Incident (Sự cố)" : "Incident" },
                                { value: "Retired", label: lang === "VN" ? "Retired (Dừng hoạt động)" : "Retired" },
                            ]}
                            className="min-w-50 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* --- DANH SÁCH BẢNG TRUY VẤN TÀU --- */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-xs font-headline font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">
                                <th className="py-4 px-6">{lang === "VN" ? "Số hiệu tàu" : "Boat Code"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Hình ảnh" : "Image"}</th>
                                <th className="py-4 px-6">{lang === "VN" ? "Tên tàu" : "Boat Name"}</th>
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
                                        <p className="text-xs tracking-wider animate-pulse">{lang === "VN" ? "Đang đồng bộ dữ liệu đội tàu thủy..." : "Synchronizing boats database..."}</p>
                                    </td>
                                </tr>
                            ) : errorMsg ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-16 text-red-500 font-bold text-xs">
                                        <span className="material-symbols-outlined text-3xl mb-1 block">error</span>
                                        {errorMsg}
                                    </td>
                                </tr>
                            ) : filteredBoats.length > 0 ? (
                                filteredBoats.map((boat) => {
                                    const statusConfig = getStatusInfo(boat.status);
                                    return (
                                        <tr key={boat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors group">
                                            {/* "code": Số hiệu tàu */}
                                            <td className="py-4 px-6 font-headline font-black text-[#124757] dark:text-yellow-400">
                                                {boat.code}
                                            </td>

                                            {/* "imageUrl": Ảnh tàu */}
                                            <td className="py-4 px-4">
                                                <div className="w-16 h-10 rounded-xl overflow-hidden shadow-sm border dark:border-slate-600 bg-slate-100 shrink-0">
                                                    <img
                                                        src={boat.imageUrl || DEFAULT_BOAT_IMAGE}
                                                        alt={boat.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        onError={(e) => { e.target.src = DEFAULT_BOAT_IMAGE; }}
                                                    />
                                                </div>
                                            </td>

                                            {/* "name": Tên tàu + Cảnh báo chưa cấu hình ghế */}
                                            <td className="py-4 px-6">
                                                <p className="font-bold text-slate-800 dark:text-white">{boat.name}</p>
                                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {String(boat.serviceType || "Passenger")}
                                                </p>
                                                {!boat.seatsConfigured && (
                                                    <p className="text-[10px] font-bold text-amber-500 mt-1 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">warning</span>
                                                        {lang === "VN" ? "Chưa cấu hình ghế" : "Pending Layout"}
                                                    </p>
                                                )}
                                            </td>

                                            {/* "seatCount": Sức chứa */}
                                            <td className="py-4 px-6 text-center font-headline font-black text-slate-700 dark:text-slate-200">
                                                {boat.seatCount || 0} <span className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "ghế" : "pax"}</span>
                                            </td>

                                            {/* "numberOfDecks": Số tầng */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                    {boat.numberOfDecks}
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
                                                    {/* Xem sơ đồ ghế (đã cấu hình) */}
                                                    {boat.seatsConfigured && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSeatPreviewBoat(boat)}
                                                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#124757] hover:text-[#124757] dark:hover:border-yellow-400 dark:hover:text-yellow-400 flex items-center justify-center transition-colors shadow-sm"
                                                            title={lang === "VN" ? "Xem sơ đồ ghế" : "View seat layout"}
                                                        >
                                                            <span className="material-symbols-outlined text-base">grid_view</span>
                                                        </button>
                                                    )}
                                                    {/* NÚT CẤU HÌNH GHẾ — chỉ khi chưa cấu hình */}
                                                    {!boat.seatsConfigured && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConfigureSeats(boat.id)}
                                                            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#124757] hover:text-[#124757] dark:hover:border-yellow-400 dark:hover:text-yellow-400 flex items-center justify-center transition-colors shadow-sm"
                                                            title={lang === "VN" ? "Cấu hình sơ đồ ghế" : "Configure Seats"}
                                                        >
                                                            <span className="material-symbols-outlined text-base">chair</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleUpdateStatus(boat)}
                                                        disabled={!boat.seatsConfigured}
                                                        className={`w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-all shadow-sm ${
                                                            boat.seatsConfigured
                                                                ? "text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 hover:border-indigo-200 dark:hover:border-indigo-500/30"
                                                                : "text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed"
                                                        }`}
                                                        title={boat.seatsConfigured
                                                            ? (lang === "VN" ? "Đổi trạng thái" : "Change Status")
                                                            : (lang === "VN" ? "Cần cấu hình sơ đồ ghế trước khi đổi trạng thái" : "Configure the seat layout before changing status")}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">published_with_changes</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCrewSchedule(boat.id)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 flex items-center justify-center transition-all shadow-inner"
                                                        title={lang === "VN" ? "Xem lịch ca trên tàu" : "View boat duty schedule"}
                                                    >
                                                        <span className="material-symbols-outlined text-base">groups</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditBoat(boat.id)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-[#124757] hover:text-white dark:hover:bg-yellow-400 dark:hover:text-slate-900 flex items-center justify-center transition-all shadow-inner"
                                                        title={lang === "VN" ? "Sửa thông tin" : "Edit Details"}
                                                    >
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBoat(boat)}
                                                        className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-inner"
                                                        title={lang === "VN" ? "Xóa tàu" : "Delete Boat"}
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
                                        {lang === "VN" ? "Không có dữ liệu tàu thủy nào khớp với từ khóa tìm kiếm." : "No boats records found matching the specifications."}
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
                        ? `Hiển thị ${filteredBoats.length}/${totalBoats} phương tiện`
                        : `Showing ${filteredBoats.length} of ${totalBoats} boats`}
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

            {statusModalBoat ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        aria-label="Close overlay"
                        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
                        onClick={closeStatusModal}
                        disabled={isSavingStatus}
                    />
                    <div className="relative w-full max-w-lg rounded-4xl border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
                            <div>
                                <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                                    {lang === "VN" ? "Quản lý đội tàu" : "Fleet management"}
                                </p>
                                <h3 className="mt-1 font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
                                    {lang === "VN" ? "Cập nhật trạng thái tàu" : "Update boat status"}
                                </h3>
                                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {statusModalBoat.name}
                                    {statusModalBoat.code ? ` · ${statusModalBoat.code}` : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeStatusModal}
                                disabled={isSavingStatus}
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <div className="space-y-2 px-6 py-5">
                            <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
                                {lang === "VN" ? "Trạng thái" : "Status"}
                            </p>
                            <div
                                className="relative"
                                onBlur={(event) => {
                                    if (!event.currentTarget.contains(event.relatedTarget)) {
                                        setIsStatusDropdownOpen(false);
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Escape") setIsStatusDropdownOpen(false);
                                }}
                            >
                                <button
                                    type="button"
                                    disabled={isSavingStatus}
                                    onClick={() => setIsStatusDropdownOpen((open) => !open)}
                                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left outline-none transition-all disabled:opacity-60 dark:bg-slate-900 ${
                                        isStatusDropdownOpen
                                            ? "border-[#124757] ring-2 ring-[#124757]/15 dark:border-yellow-400 dark:ring-yellow-400/20"
                                            : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                                    }`}
                                    aria-haspopup="listbox"
                                    aria-expanded={isStatusDropdownOpen}
                                >
                                    <span className="truncate text-sm font-bold text-slate-800 dark:text-white">
                                        {(() => {
                                            const selected = BOAT_STATUS_OPTIONS.find((option) => option.value === selectedStatus);
                                            return selected
                                                ? (lang === "VN" ? selected.labelVn : selected.labelEn)
                                                : (lang === "VN" ? "Chọn trạng thái" : "Select status");
                                        })()}
                                    </span>
                                    <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isStatusDropdownOpen ? "rotate-180" : ""}`}>
                                        expand_more
                                    </span>
                                </button>

                                {isStatusDropdownOpen && !isSavingStatus ? (
                                    <div
                                        className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
                                        role="listbox"
                                    >
                                        {BOAT_STATUS_OPTIONS.map((option) => {
                                            const isSelected = selectedStatus === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStatus(option.value);
                                                        setIsStatusDropdownOpen(false);
                                                    }}
                                                    className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors ${
                                                        isSelected
                                                            ? "bg-[#124757]/5 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-300"
                                                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    }`}
                                                    role="option"
                                                    aria-selected={isSelected}
                                                >
                                                    {lang === "VN" ? option.labelVn : option.labelEn}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>

                            {selectedStatus === "Active" && (
                                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    {lang === "VN"
                                        ? "Active cần đủ ghế + 4 hồ sơ. Sau bảo trì chỉ cập nhật Đăng kiểm nếu BE đánh dấu requiresRefresh — giữ nguyên các hồ sơ khác."
                                        : "Active needs seats + 4 documents. After maintenance, refresh Inspection only when requiresRefresh — keep other files."}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end dark:border-slate-700">
                            <button
                                type="button"
                                onClick={closeStatusModal}
                                disabled={isSavingStatus}
                                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            >
                                {lang === "VN" ? "Hủy" : "Cancel"}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmStatusUpdate}
                                disabled={isSavingStatus || !selectedStatus}
                                className="rounded-2xl bg-[#124757] px-5 py-3 text-[10px] font-headline font-black uppercase tracking-wider text-white transition-colors hover:bg-[#0d3541] disabled:opacity-60 dark:bg-yellow-400 dark:text-slate-900 dark:hover:bg-yellow-300"
                            >
                                {isSavingStatus
                                    ? (lang === "VN" ? "Đang lưu..." : "Saving...")
                                    : (lang === "VN" ? "Cập nhật" : "Update")}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {seatPreviewBoat ? (
                <BoatSeatLayoutPreviewModal
                    boatId={seatPreviewBoat.id}
                    boatName={seatPreviewBoat.name}
                    boatCode={seatPreviewBoat.code}
                    boatImageUrl={seatPreviewBoat.imageUrl || seatPreviewBoat.imageUrls?.[0] || DEFAULT_BOAT_IMAGE}
                    lang={lang}
                    variant="admin"
                    boatMeta={{
                        seatCount: seatPreviewBoat.seatCount,
                        numberOfDecks: seatPreviewBoat.numberOfDecks,
                        seatSetupType: seatPreviewBoat.seatSetupType,
                        imageUrl: seatPreviewBoat.imageUrl || seatPreviewBoat.imageUrls?.[0] || DEFAULT_BOAT_IMAGE,
                    }}
                    onClose={() => setSeatPreviewBoat(null)}
                />
            ) : null}

        </div>
    );
}

export { EditBoat } from "./EditBoat";
export { CreateBoat } from "./CreateBoat";
export { SeatLayoutEditor } from "./SeatLayoutEditor";
export { BoatCrewSchedule } from "./BoatCrewSchedule";
