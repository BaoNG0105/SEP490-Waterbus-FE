import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserList, updateUserStatus, USER_STATUS } from "../../../services/userService";
import { getRoleSystemName, isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { UserAvatar } from "../../../components/UserAvatar";
import { FormSelect } from "../../../components/FormSelect";
import { notify } from "../../../utils/swalToast";

export function UserManagement() {
    const { lang } = useApp();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [updatingUserId, setUpdatingUserId] = useState("");
    const ITEMS_PER_PAGE = 8;

    const canAccessPage = isAdminUser(currentUser) || isManagerUser(currentUser);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const data = await fetchUserList({ force: true });
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Lỗi khi tải danh sách khách hàng:", error);
            setErrorMsg(
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách khách hàng."
                    : "Failed to connect to server to fetch customer records."
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
    }, [searchTerm, statusFilter]);

    const customers = useMemo(
        () => users.filter((u) => (u.roles || []).some((r) => getRoleSystemName(r) === "CUSTOMER")),
        [users]
    );

    const stats = useMemo(() => ({
        total: customers.length,
        active: customers.filter((u) => u.status === "Active").length,
        inactive: customers.filter((u) => u.status !== "Active").length,
    }), [customers]);

    const filteredUsers = customers.filter((item) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !term ||
            (item.fullName?.toLowerCase() || "").includes(term) ||
            (item.code?.toLowerCase() || "").includes(term) ||
            (item.phoneNumber?.toLowerCase() || "").includes(term) ||
            (item.email?.toLowerCase() || "").includes(term);

        const matchesStatus = statusFilter === "All" || item.status === statusFilter;

        return matchesSearch && matchesStatus;
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

    const handleToggleStatus = async (item) => {
        const nextStatus = item.status === USER_STATUS.ACTIVE ? USER_STATUS.SUSPENDED : USER_STATUS.ACTIVE;
        const isSuspending = nextStatus === USER_STATUS.SUSPENDED;

        const confirmResult = await notify({
            icon: isSuspending ? "warning" : "question",
            title: isSuspending
                ? (lang === "VN" ? "Tạm khóa tài khoản?" : "Suspend account?")
                : (lang === "VN" ? "Kích hoạt tài khoản?" : "Activate account?"),
            html: lang === "VN"
                ? `${isSuspending ? "Tạm khóa" : "Kích hoạt"} tài khoản <b>${item.fullName}</b> (${item.code})?<br/><span style="color:#94a3b8;font-size:12px">Thao tác này sẽ thu hồi phiên đăng nhập hiện tại của khách hàng.</span>`
                : `${isSuspending ? "Suspend" : "Activate"} account <b>${item.fullName}</b> (${item.code})?<br/><span style="color:#94a3b8;font-size:12px">This will revoke the customer's active login session.</span>`,
            showCancelButton: true,
            focusCancel: true,
            reverseButtons: true,
            confirmButtonColor: isSuspending ? "#dc2626" : "#124757",
            cancelButtonColor: "#124757",
            confirmButtonText: isSuspending
                ? (lang === "VN" ? "Tạm khóa" : "Suspend")
                : (lang === "VN" ? "Kích hoạt" : "Activate"),
            cancelButtonText: lang === "VN" ? "Không" : "No",
        });
        if (!confirmResult.isConfirmed) return;

        try {
            setUpdatingUserId(item.id);
            await updateUserStatus(item.id, nextStatus);
            await notify({
                icon: "success",
                title: isSuspending
                    ? (lang === "VN" ? "Đã tạm khóa tài khoản" : "Account suspended")
                    : (lang === "VN" ? "Đã kích hoạt tài khoản" : "Account activated"),
                timer: 1600,
                showConfirmButton: false,
            });
            await loadUsers();
        } catch (error) {
            console.error("Lỗi khi cập nhật trạng thái khách hàng:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Cập nhật thất bại" : "Update failed",
                text: lang === "VN" ? "Vui lòng thử lại." : "Please try again.",
            });
        } finally {
            setUpdatingUserId("");
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

            {/* KHỐI TIÊU ĐỀ HEADER */}
            <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
                        {lang === "VN" ? "Quản lý danh sách Khách hàng" : "Customer Management"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Xem danh sách tài khoản Khách hàng trong hệ thống." : "View the list of customer accounts across the system."}
                    </p>
                </div>
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
                        <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Đang hoạt động" : "Active"}</span>
                        <h3 className="text-xl font-black font-headline text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.active}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4 group">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">{lang === "VN" ? "Ngừng hoạt động" : "Inactive"}</span>
                        <h3 className="text-xl font-black font-headline text-rose-500 dark:text-rose-400 mt-0.5">{stats.inactive}</h3>
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

            {/* BẢNG DANH SÁCH KHÁCH HÀNG */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin khách hàng" : "Customer Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Liên hệ" : "Contact"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        <span className="material-symbols-outlined text-4xl block mb-2">person_off</span>
                                        {lang === "VN" ? "Không có khách hàng nào phù hợp bộ lọc." : "No records found matching filters."}
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <UserAvatar
                                                    avatarUrl={item.avatarUrl}
                                                    alt={item.fullName}
                                                    className="w-10 h-10 rounded-full overflow-hidden border shadow-sm shrink-0"
                                                />
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
                                            <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${item.status === "Active"
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-500 dark:text-rose-400"
                                                }`}>
                                                {item.status === "Active"
                                                    ? (lang === "VN" ? "Hoạt động" : "Active")
                                                    : (lang === "VN" ? "Ngưng hoạt động" : "Inactive")}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(item)}
                                                disabled={updatingUserId === item.id}
                                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-[10px] font-headline font-black uppercase tracking-wide transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${item.status === "Active"
                                                    ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400"
                                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500/20 dark:hover:text-emerald-400"
                                                    }`}
                                                title={item.status === "Active"
                                                    ? (lang === "VN" ? "Tạm khóa tài khoản" : "Suspend account")
                                                    : (lang === "VN" ? "Kích hoạt tài khoản" : "Activate account")}
                                            >
                                                {updatingUserId === item.id ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[15px]">
                                                        {item.status === "Active" ? "block" : "check_circle"}
                                                    </span>
                                                )}
                                                {item.status === "Active"
                                                    ? (lang === "VN" ? "Khóa" : "Suspend")
                                                    : (lang === "VN" ? "Kích hoạt" : "Activate")}
                                            </button>
                                        </td>
                                    </tr>
                                ))
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
