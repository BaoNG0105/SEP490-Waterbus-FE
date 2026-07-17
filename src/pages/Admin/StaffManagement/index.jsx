import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserList, deleteUser } from "../../../services/userService";
import { canManageUserRow, getRoleSystemName, isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { notify } from "../../../utils/swalToast";

const DEFAULT_AVATAR = "https://res.cloudinary.com/dygipvoal/image/upload/v1782985383/piwocu1i25ijlua88bn0.webp";

export function StaffManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [staffTypeFilter, setStaffTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    const canAccessPage = isAdminUser(currentUser) || isManagerUser(currentUser);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchUserList({ force: true });
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Lỗi khi tải danh sách nhân viên:", error);
            setErrorMsg(
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách nhân viên."
                    : "Failed to connect to server to fetch staff records."
            );
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!canAccessPage) return;
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, staffTypeFilter, statusFilter]);

    const normalizeStaffType = (value) => {
        const raw = String(value || "").toLowerCase().replace(/[_\s-]/g, "");
        if (raw === "onboard" || raw === "2") return "OnBoard";
        if (raw === "ground" || raw === "1") return "Ground";
        return "";
    };

    const staffUsers = useMemo(
        () => users.filter((u) => (u.roles || []).some((r) => getRoleSystemName(r) === "STAFF")),
        [users]
    );

    const stats = useMemo(() => ({
        total: staffUsers.length,
        onBoard: staffUsers.filter((u) => normalizeStaffType(u.staffType) === "OnBoard").length,
        ground: staffUsers.filter((u) => normalizeStaffType(u.staffType) === "Ground").length,
    }), [staffUsers]);

    const filteredUsers = staffUsers.filter((item) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !term ||
            (item.fullName?.toLowerCase() || "").includes(term) ||
            (item.code?.toLowerCase() || "").includes(term) ||
            (item.phoneNumber?.toLowerCase() || "").includes(term) ||
            (item.email?.toLowerCase() || "").includes(term);

        const itemStaffType = normalizeStaffType(item.staffType);
        const matchesStaffType = staffTypeFilter === "All" || itemStaffType === staffTypeFilter;

        const matchesStatus = statusFilter === "All" || item.status === statusFilter;

        return matchesSearch && matchesStaffType && matchesStatus;
    });

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const currentUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredUsers.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length);

    const getPaginationGroup = () => {
        let pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 3) {
            pages = [1, 2, 3, 4, "...", totalPages];
        } else if (currentPage >= totalPages - 2) {
            pages = [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
        }
        return pages;
    };

    const handleDelete = async (item) => {
        const confirmResult = await notify({
            icon: "question",
            title: lang === "VN" ? "Xóa nhân viên?" : "Delete staff?",
            html: lang === "VN"
                ? `Bạn chắc chắn muốn xóa vĩnh viễn tài khoản <b>${item.fullName}</b> (${item.code})?<br/><span style="color:#94a3b8;font-size:12px">Hành động này không thể hoàn tác.</span>`
                : `Permanently delete <b>${item.fullName}</b> (${item.code})?<br/><span style="color:#94a3b8;font-size:12px">This action cannot be undone.</span>`,
            showCancelButton: true,
            focusCancel: true,
            reverseButtons: true,
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#124757",
            confirmButtonText: lang === "VN" ? "Xác nhận xóa" : "Yes, delete",
            cancelButtonText: lang === "VN" ? "Không" : "No",
        });

        if (!confirmResult.isConfirmed) return;

        try {
            setIsLoading(true);
            await deleteUser(item.id);
            notify({
                icon: "success",
                title: lang === "VN" ? "Đã xóa!" : "Deleted!",
                text: lang === "VN" ? `Nhân viên ${item.code} đã được xóa khỏi hệ thống.` : `Staff ${item.code} has been deleted.`,
                confirmButtonColor: "#124757",
            });
            await loadUsers();
        } catch (error) {
            console.error("Lỗi xóa nhân viên:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa" : "Delete Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xóa nhân viên này." : "Failed to delete this staff."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!canAccessPage) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300">lock</span>
                <p className="text-sm font-bold text-slate-400">
                    {lang === "VN" ? "Bạn không có quyền truy cập trang này." : "You do not have permission to access this page."}
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64 w-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">

            {/* KHỐI TIÊU ĐỀ HEADER & NÚT THÊM MỚI */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý Nhân viên" : "Staff Management"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách tài khoản Nhân viên (mặt đất / trên tàu) trong hệ thống." : "Manage staff accounts (ground / onboard) across the system."}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/staffs-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                    {lang === "VN" ? "Thêm nhân viên" : "Add Staff"}
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {errorMsg}
                </div>
            )}

            {/* KHỐI CARD THỐNG KÊ */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Tổng số" : "Total"}</span>
                        <h3 className="text-xl font-black font-headline text-sky-600 dark:text-sky-400 mt-0.5">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Trên tàu" : "Onboard"}</span>
                        <h3 className="text-xl font-black font-headline text-teal-600 dark:text-teal-400 mt-0.5">{stats.onBoard}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Mặt đất" : "Ground"}</span>
                        <h3 className="text-xl font-black font-headline text-slate-600 dark:text-slate-300 mt-0.5">{stats.ground}</h3>
                    </div>
                </div>
            </div>

            {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-col xl:flex-row gap-3 items-center">
                <div className="w-full xl:flex-1 relative flex items-center">
                    <span className="material-symbols-outlined absolute left-4 text-slate-400 text-lg pointer-events-none">search</span>
                    <input
                        type="text"
                        placeholder={lang === "VN" ? "Tìm kiếm theo tên, mã, số điện thoại hoặc email..." : "Search by name, code, phone or email..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 transition-all shadow-inner"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto overflow-x-auto shrink-0">
                    <select
                        value={staffTypeFilter}
                        onChange={(e) => setStaffTypeFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-[10px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 outline-none cursor-pointer shadow-inner shrink-0"
                    >
                        <option value="All">{lang === "VN" ? "Tất cả loại NV" : "All staff types"}</option>
                        <option value="OnBoard">{lang === "VN" ? "Trên tàu" : "Onboard"}</option>
                        <option value="Ground">{lang === "VN" ? "Mặt đất" : "Ground"}</option>
                    </select>

                    <div className="flex gap-2">
                        {[
                            { key: "All", vn: "Tất cả trạng thái", en: "All Status" },
                            { key: "Active", vn: "Active", en: "Active" },
                            { key: "Inactive", vn: "Inactive", en: "Inactive" },
                        ].map((btn) => (
                            <button
                                key={btn.key}
                                type="button"
                                onClick={() => setStatusFilter(btn.key)}
                                className={`px-5 py-3.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider border transition-all shrink-0 ${statusFilter === btn.key
                                    ? " border-transparent bg-yellow-400 text-slate-900 shadow-md"
                                    : "bg-white text-slate-500 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                                    }`}
                            >
                                {lang === "VN" ? btn.vn : btn.en}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* BẢNG DANH SÁCH NHÂN VIÊN */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin nhân viên" : "Staff Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Liên hệ" : "Contact"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Loại NV" : "Type"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">person_off</span>
                                        {lang === "VN" ? "Không có nhân viên nào phù hợp bộ lọc." : "No records found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((item) => {
                                    const staffType = normalizeStaffType(item.staffType);
                                    const canManage = canManageUserRow(currentUser, item.roles);
                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden border bg-slate-100 dark:bg-slate-700 shadow-sm shrink-0">
                                                        <img
                                                            src={item.avatarUrl || DEFAULT_AVATAR}
                                                            alt={item.fullName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                                                        />
                                                    </div>
                                                    <div className="space-y-0.5">
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm tracking-tight leading-snug">
                                                            {item.fullName || "--"}
                                                        </h4>
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-headline font-black tracking-wide">
                                                            {item.code}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.phoneNumber || "--"}</p>
                                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-45">{item.email || "--"}</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                {staffType && (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${staffType === "OnBoard"
                                                            ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/20"
                                                            : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600"
                                                        }`}>
                                                        {staffType === "OnBoard"
                                                            ? (lang === "VN" ? "Trên tàu" : "Onboard")
                                                            : (lang === "VN" ? "Mặt đất" : "Ground")}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${item.status === "Active"
                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                                                    : "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${item.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                                    {item.status || "Inactive"}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                {canManage ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/admin/staffs-management/edit/${item.id}`)}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                            title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item)}
                                                            className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm"
                                                            title={lang === "VN" ? "Xóa" : "Delete"}
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider flex items-center justify-center gap-1">
                                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                                        {lang === "VN" ? "Chỉ xem" : "View only"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PHÂN TRANG */}
            {totalPages > 0 && (
                <div className="flex bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center justify-between flex-col sm:flex-row gap-4">
                    <span className="text-xs font-bold text-slate-400">
                        {lang === "VN"
                            ? `Hiển thị ${startIndex}-${endIndex} trong số ${filteredUsers.length} kết quả`
                            : `Showing ${startIndex}-${endIndex} of ${filteredUsers.length} entries`}
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center font-bold transition-all ${currentPage === 1
                                ? "bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed dark:bg-slate-800/50 dark:border-slate-700/50"
                                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">chevron_left</span>
                        </button>

                        {getPaginationGroup().map((item, index) => {
                            if (item === "...") {
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
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
