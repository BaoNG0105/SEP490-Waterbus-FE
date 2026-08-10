import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchUserList, fetchUserStations, deleteUser } from "../../../services/userService";
import { fetchAllStations } from "../../../services/stationService";
import { canResetManagedUserPassword, getRoleSystemName, isAdminUser } from "../../../utils/roleHelpers";
import { promptResetManagedPassword } from "../../../utils/managedPasswordReset";
import { notify } from "../../../utils/swalToast";
import { UserAvatar } from "../../../components/UserAvatar";
import { FormSelect } from "../../../components/FormSelect";

export function ManagerManagement() {
    const { lang } = useApp();
    const navigate = useNavigate();
    const { user: currentUser } = useSelector((state) => state.auth);

    const [users, setUsers] = useState([]);
    const [stations, setStations] = useState([]);
    const [stationIdsByUser, setStationIdsByUser] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [stationFilter, setStationFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    const canAccessPage = isAdminUser(currentUser);

    const loadUsers = async () => {
        try {
            setIsLoading(true);
            setErrorMsg("");
            const [data, stationRows] = await Promise.all([
                fetchUserList({ force: true }),
                fetchAllStations().catch(() => []),
            ]);
            setUsers(Array.isArray(data) ? data : []);
            setStations(Array.isArray(stationRows) ? stationRows : (stationRows?.items || stationRows?.data || []));
        } catch (error) {
            console.error("Lỗi khi tải danh sách quản lý:", error);
            setErrorMsg(
                lang === "VN"
                    ? "Không thể kết nối tới máy chủ để tải danh sách quản lý."
                    : "Failed to connect to server to fetch manager records."
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
    }, [searchTerm, statusFilter, stationFilter]);

    const managers = useMemo(
        () => users.filter((u) => (u.roles || []).some((r) => getRoleSystemName(r) === "MANAGER")),
        [users]
    );

    // Gắn bến phụ trách cho từng manager để hiển thị trong bảng.
    useEffect(() => {
        let cancelled = false;
        if (managers.length === 0) {
            setStationIdsByUser({});
            return undefined;
        }

        (async () => {
            const entries = await Promise.all(
                managers.map(async (user) => {
                    const id = String(user.id || "");
                    try {
                        const ids = await fetchUserStations(id);
                        return [id, ids];
                    } catch {
                        return [id, []];
                    }
                })
            );
            if (cancelled) return;
            setStationIdsByUser(Object.fromEntries(entries));
        })();

        return () => {
            cancelled = true;
        };
    }, [managers]);

    const stationNameById = useMemo(() => {
        const map = new Map();
        stations.forEach((s) => {
            const sid = String(s?.stationId || s?.id || "");
            if (sid) map.set(sid, s.stationName || s.name || s.stationCode || sid);
        });
        return map;
    }, [stations]);

    const stats = useMemo(() => ({
        total: managers.length,
        active: managers.filter((u) => u.status === "Active").length,
        inactive: managers.filter((u) => u.status !== "Active").length,
    }), [managers]);

    const stationOptions = useMemo(
        () => [
            { value: "All", label: lang === "VN" ? "Tất cả bến" : "All Stations" },
            ...stations
                .filter((s) => s?.isWaterbusStation === true)
                .map((s) => ({
                    value: String(s?.stationId || s?.id || ""),
                    label: s.stationName || s.name || s.stationCode || "",
                }))
                .filter((o) => o.value)
                .sort((a, b) => a.label.localeCompare(b.label, "vi")),
        ],
        [stations, lang]
    );

    const filteredUsers = managers.filter((item) => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !term ||
            (item.fullName?.toLowerCase() || "").includes(term) ||
            (item.code?.toLowerCase() || "").includes(term) ||
            (item.phoneNumber?.toLowerCase() || "").includes(term) ||
            (item.email?.toLowerCase() || "").includes(term);

        const matchesStatus = statusFilter === "All" || item.status === statusFilter;

        const matchesStation =
            stationFilter === "All" ||
            (stationIdsByUser[String(item.id || "")] || []).map(String).includes(stationFilter);

        return matchesSearch && matchesStatus && matchesStation;
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
            title: lang === "VN" ? "Xóa quản lý?" : "Delete manager?",
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
                text: lang === "VN" ? `Quản lý ${item.code} đã được xóa khỏi hệ thống.` : `Manager ${item.code} has been deleted.`,
                confirmButtonColor: "#124757",
            });
            await loadUsers();
        } catch (error) {
            console.error("Lỗi xóa quản lý:", error);
            notify({
                icon: "error",
                title: lang === "VN" ? "Không thể xóa" : "Delete Failed",
                text: error.response?.data?.message || (lang === "VN" ? "Không thể xóa quản lý này." : "Failed to delete this manager."),
                confirmButtonColor: "#124757",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = (item) => promptResetManagedPassword({ user: item, lang });

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
                        {lang === "VN" ? "Quản lý tài khoản Manager" : "Manager Management"}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {lang === "VN" ? "Danh sách tài khoản Quản lý (Manager) trong hệ thống." : "Manage manager accounts across the system."}
                    </p>
                </div>
                <button
                    onClick={() => navigate("/admin/managers-management/create")}
                    className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
                >
                    <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                    {lang === "VN" ? "Thêm quản lý" : "Add Manager"}
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
                        <h3 className="text-xl font-black font-headline text-amber-600 dark:text-amber-400 mt-0.5">{stats.total}</h3>
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

                <div className="relative z-10 flex items-center gap-2 w-full xl:w-auto justify-end">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">{lang === "VN" ? "Bến:" : "Station:"}</span>
                    <FormSelect
                        value={stationFilter}
                        onChange={setStationFilter}
                        menuAlign="right"
                        options={stationOptions}
                        className="min-w-40 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#FFD100] dark:text-white"
                    />
                </div>
            </div>

            {/* BẢNG DANH SÁCH QUẢN LÝ */}
            <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                                <th className="py-4 px-6">{lang === "VN" ? "Thông tin quản lý" : "Manager Information"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Liên hệ" : "Contact"}</th>
                                <th className="py-4 px-4">{lang === "VN" ? "Bến quản lý" : "Managed Stations"}</th>
                                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                                        {lang === "VN" ? "Không có quản lý nào." : "No records found."}
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
                                        <td className="py-4 px-4">
                                            {(() => {
                                                const userId = String(item.id || "");
                                                const ids = stationIdsByUser[userId] || [];
                                                const names = ids.map((sid) => stationNameById.get(String(sid))).filter(Boolean);
                                                return names.length > 0 ? (
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                        {names.join(", ")}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                        {lang === "VN" ? "Chưa gắn bến" : "No station"}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-headline font-black uppercase tracking-wide ${item.status === "Active"
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-500 dark:text-rose-400"
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                                                {item.status === "Active"
                                                    ? (lang === "VN" ? "Hoạt động" : "Active")
                                                    : (lang === "VN" ? "Ngưng hoạt động" : "Inactive")}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/admin/managers-management/edit/${item.id}`)}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                                    title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                {canResetManagedUserPassword(currentUser, item) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResetPassword(item)}
                                                        className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] hover:bg-slate-50 dark:hover:bg-yellow-400/15 hover:border-[#124757]/40 dark:hover:text-yellow-400 dark:hover:border-yellow-400/40 transition-all shadow-sm"
                                                        title={lang === "VN" ? "Đặt lại mật khẩu" : "Reset password"}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm"
                                                    title={lang === "VN" ? "Xóa" : "Delete"}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
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
