import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats } from "../../../services/boatService";
import { fetchAllStations } from "../../../services/stationService";
import {
  fetchUserList,
  fetchUserStations,
  deleteUser,
} from "../../../services/userService";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TYPE,
  fetchStaffAssignments,
  isAssignmentInactive,
} from "../../../services/staffAssignmentService";
import { FormSelect } from "../../../components/FormSelect";
import { UserAvatar } from "../../../components/UserAvatar";
import { canManageUserRow, canResetManagedUserPassword, getRoleSystemName, isAdminUser, isManagerUser } from "../../../utils/roleHelpers";
import { promptResetManagedPassword } from "../../../utils/managedPasswordReset";
import { notify } from "../../../utils/swalToast";

const SCOPE = {
  STATION: "Station",
  BOAT: "Boat",
};

const normalizeStaffType = (value) => {
  const raw = String(value || "").toLowerCase().replace(/[_\s-]/g, "");
  if (raw === "onboard" || raw === "2") return "OnBoard";
  if (raw === "ground" || raw === "1") return "Ground";
  return "";
};

const toDateInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const extractStationIdsFromUser = (item) => {
  const raw = item?.stationIds || item?.stations || item?.stationList;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (entry == null) return "";
      if (typeof entry === "string" || typeof entry === "number") return String(entry);
      return String(entry.stationId || entry.id || entry.station?.stationId || entry.station?.id || "");
    })
    .filter(Boolean);
};

export function StaffManagement({ viewTabs = null }) {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { user: currentUser } = useSelector((state) => state.auth);

  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [boats, setBoats] = useState([]);
  const [stationIdsByUser, setStationIdsByUser] = useState({});
  const [boatIdsByUser, setBoatIdsByUser] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState(SCOPE.STATION);
  const [stationFilter, setStationFilter] = useState("");
  const [boatFilter, setBoatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const canAccessPage = isAdminUser(currentUser) || isManagerUser(currentUser);
  const canCreateOnBoard = isAdminUser(currentUser);
  const canCreateGround = isAdminUser(currentUser) || isManagerUser(currentUser);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const [userRows, stationRows, boatRows] = await Promise.all([
        fetchUserList({ force: true }),
        fetchAllStations().catch(() => []),
        fetchAllBoats().catch(() => []),
      ]);
      setUsers(Array.isArray(userRows) ? userRows : []);
      setStations(Array.isArray(stationRows) ? stationRows : (stationRows?.items || stationRows?.data || []));
      setBoats(Array.isArray(boatRows) ? boatRows : (boatRows?.items || boatRows?.data || []));
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

  const staffUsers = useMemo(
    () => users.filter((u) => (u.roles || []).some((r) => getRoleSystemName(r) === "STAFF")),
    [users]
  );

  // Manager chỉ được xem nhân viên bến (Ground) thuộc (các) bến mình đang phụ trách.
  const isManagerOnly = isManagerUser(currentUser) && !isAdminUser(currentUser);
  const managerStationIds = useMemo(
    () => (currentUser?.stationAssignments || [])
      .filter((s) => s?.isActive !== false)
      .map((s) => String(s.stationId))
      .filter(Boolean),
    [currentUser]
  );

  // Gắn bến cho NV mặt đất (để lọc theo station).
  useEffect(() => {
    let cancelled = false;
    const ground = staffUsers.filter((u) => normalizeStaffType(u.staffType) === "Ground");
    if (ground.length === 0) {
      setStationIdsByUser({});
      return undefined;
    }

    (async () => {
      const entries = await Promise.all(
        ground.map(async (user) => {
          const id = String(user.id || "");
          const fromRow = extractStationIdsFromUser(user);
          if (fromRow.length > 0) return [id, fromRow];
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
  }, [staffUsers]);

  // Gắn tàu từ phân công Boat còn hiệu lực (để lọc theo boat).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const from = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 62);
        const rows = await fetchStaffAssignments({
          fromDate: toDateInput(from),
          toDate: toDateInput(to),
          assignmentType: ASSIGNMENT_TYPE.BOAT,
          status: ASSIGNMENT_STATUS.SCHEDULED,
        });
        if (cancelled) return;
        const map = {};
        (Array.isArray(rows) ? rows : []).forEach((row) => {
          if (isAssignmentInactive(row.status)) return;
          const staffId = String(row.staffUserId || row.staff?.id || "");
          const boatId = String(row.boat?.boatId || row.boatId || "");
          if (!staffId || !boatId) return;
          if (!map[staffId]) map[staffId] = new Set();
          map[staffId].add(boatId);
        });
        setBoatIdsByUser(
          Object.fromEntries(Object.entries(map).map(([id, set]) => [id, [...set]]))
        );
      } catch {
        if (!cancelled) setBoatIdsByUser({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, scopeFilter, stationFilter, boatFilter, statusFilter]);

  useEffect(() => {
    if (scopeFilter !== SCOPE.STATION) setStationFilter("");
    if (scopeFilter !== SCOPE.BOAT) setBoatFilter("");
  }, [scopeFilter]);

  const stationOptions = useMemo(
    () => [
      { value: "", label: lang === "VN" ? "Tất cả bến" : "All stations" },
      ...stations
        .filter((s) => !isManagerOnly || managerStationIds.includes(String(s.stationId || s.id || "")))
        .map((s) => ({
          value: String(s.stationId || s.id || ""),
          label: `${s.stationCode || s.code || ""} · ${s.stationName || s.name || ""}`.trim(),
        }))
        .filter((o) => o.value),
    ],
    [stations, lang, isManagerOnly, managerStationIds]
  );

  const stationNameById = useMemo(() => {
    const map = new Map();
    stations.forEach((s) => {
      const sid = String(s?.stationId || s?.id || "");
      if (sid) map.set(sid, s.stationName || s.name || s.stationCode || sid);
    });
    return map;
  }, [stations]);

  // Manager chỉ thấy nhân viên bến (Ground) thuộc (các) bến mình phụ trách.
  const visibleStaffUsers = useMemo(() => {
    if (!isManagerOnly) return staffUsers;
    const allowed = new Set(managerStationIds);
    return staffUsers.filter((item) => {
      if (normalizeStaffType(item.staffType) !== "Ground") return false;
      const userId = String(item.id || "");
      const ids = stationIdsByUser[userId] || extractStationIdsFromUser(item);
      return ids.some((sid) => allowed.has(String(sid)));
    });
  }, [isManagerOnly, staffUsers, stationIdsByUser, managerStationIds]);

  const boatOptions = useMemo(
    () => [
      { value: "", label: lang === "VN" ? "Tất cả tàu" : "All boats" },
      ...boats
        .map((b) => ({
          value: String(b.boatId || b.id || ""),
          label: `${b.boatCode || b.code || ""} · ${b.boatName || b.name || ""}`.trim(),
        }))
        .filter((o) => o.value),
    ],
    [boats, lang]
  );

  const filteredUsers = visibleStaffUsers.filter((item) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      (item.fullName?.toLowerCase() || "").includes(term) ||
      (item.code?.toLowerCase() || "").includes(term) ||
      (item.phoneNumber?.toLowerCase() || "").includes(term) ||
      (item.email?.toLowerCase() || "").includes(term);

    const staffType = normalizeStaffType(item.staffType);
    const userId = String(item.id || "");

    if (scopeFilter === SCOPE.STATION) {
      if (staffType !== "Ground") return false;
      if (stationFilter) {
        const ids = stationIdsByUser[userId] || extractStationIdsFromUser(item);
        if (!ids.map(String).includes(String(stationFilter))) return false;
      }
    } else if (scopeFilter === SCOPE.BOAT) {
      if (staffType !== "OnBoard") return false;
      if (boatFilter) {
        const ids = boatIdsByUser[userId] || [];
        if (!ids.map(String).includes(String(boatFilter))) return false;
      }
    }

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
      await deleteUser(item.id);
      await notify({
        icon: "success",
        title: lang === "VN" ? "Đã xóa nhân viên" : "Staff deleted",
        timer: 1600,
        showConfirmButton: false,
      });
      loadUsers();
    } catch (error) {
      console.error("Lỗi xóa nhân viên:", error);
      notify({
        icon: "error",
        title: lang === "VN" ? "Không xóa được" : "Delete failed",
        text: lang === "VN" ? "Vui lòng thử lại." : "Please try again.",
      });
    }
  };

  const handleResetPassword = (item) => promptResetManagedPassword({ user: item, lang });

  const scopeButtons = [
    { key: SCOPE.STATION, vn: "Theo bến", en: "By station" },
    ...(isManagerOnly ? [] : [{ key: SCOPE.BOAT, vn: "Theo tàu", en: "By boat" }]),
  ];

  const filterInputStyle =
    "h-11 w-full min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400";

  if (!canAccessPage) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <span className="material-symbols-outlined text-4xl">lock</span>
        <p className="text-sm font-bold">
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
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {lang === "VN" ? "Quản lý Nhân viên" : "Staff Management"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {lang === "VN"
              ? "Quản lý danh sách nhân viên theo bến / tàu"
              : "Manage staff list by station / boat"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewTabs}
          {canCreateOnBoard && (
            <button
              type="button"
              onClick={() => navigate("/admin/staffs-management/create?type=onboard")}
              className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-sm font-bold">person_add</span>
              {lang === "VN" ? "Thêm NV trên tàu" : "Add boat crew"}
            </button>
          )}
          {canCreateGround && (
            <button
              type="button"
              onClick={() => navigate("/admin/staffs-management/create?type=ground")}
              className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-sm font-bold">person_add</span>
              {lang === "VN" ? "Thêm NV bến" : "Add station staff"}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 p-4 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400">
              search
            </span>
            <input
              type="text"
              placeholder={lang === "VN" ? "Tìm theo tên, mã, SĐT hoặc email..." : "Search by name, code, phone or email..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-xs font-semibold text-slate-800 shadow-inner outline-none transition-all focus:ring-2 focus:ring-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-yellow-400"
            />
          </div>

          <div className="inline-flex h-11 shrink-0 items-center rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
            {scopeButtons.map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setScopeFilter(btn.key)}
                className={`h-full shrink-0 rounded-lg px-3.5 text-[10px] font-headline font-black uppercase tracking-wider transition ${
                  scopeFilter === btn.key
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {lang === "VN" ? btn.vn : btn.en}
              </button>
            ))}
          </div>

          {scopeFilter === SCOPE.STATION || scopeFilter === SCOPE.BOAT ? (
            <div className="w-full min-w-0 sm:max-w-xs sm:flex-1">
              {scopeFilter === SCOPE.STATION ? (
                <FormSelect
                  value={stationFilter}
                  onChange={(value) => setStationFilter(String(value ?? ""))}
                  options={stationOptions}
                  searchable
                  placeholder={lang === "VN" ? "Chọn bến" : "Select station"}
                  searchPlaceholder={lang === "VN" ? "Tìm bến..." : "Search station..."}
                  emptyLabel={lang === "VN" ? "Không có bến" : "No stations"}
                  className={filterInputStyle}
                />
              ) : (
                <FormSelect
                  value={boatFilter}
                  onChange={(value) => setBoatFilter(String(value ?? ""))}
                  options={boatOptions}
                  searchable
                  placeholder={lang === "VN" ? "Chọn tàu" : "Select boat"}
                  searchPlaceholder={lang === "VN" ? "Tìm tàu..." : "Search boat..."}
                  emptyLabel={lang === "VN" ? "Không có tàu" : "No boats"}
                  className={filterInputStyle}
                />
              )}
            </div>
          ) : null}

          <div className="relative z-10 flex items-center gap-2 shrink-0">
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
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 text-[10px] font-headline font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-6">{lang === "VN" ? "Thông tin nhân viên" : "Staff Information"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Liên hệ" : "Contact"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Loại NV" : "Type"}</th>
                {scopeFilter !== SCOPE.BOAT && (
                  <th className="py-4 px-4">{lang === "VN" ? "Nhà ga" : "Station"}</th>
                )}
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-6 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={scopeFilter === SCOPE.BOAT ? 5 : 6} className="text-center py-14 text-slate-400 dark:text-slate-500 font-bold">
                    {lang === "VN" ? "Không có nhân viên nào." : "No records found."}
                  </td>
                </tr>
              ) : (
                currentUsers.map((item) => {
                  const staffType = normalizeStaffType(item.staffType);
                  const canManage = canManageUserRow(currentUser, item.roles);
                  const canResetPassword = canResetManagedUserPassword(currentUser, item);
                  return (
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
                        {staffType && (
                          <span className={`inline-flex items-center text-[10px] font-headline font-black uppercase tracking-wide ${staffType === "OnBoard"
                            ? "text-teal-700 dark:text-teal-300"
                            : "text-slate-500 dark:text-slate-400"
                            }`}>
                            {staffType === "OnBoard"
                              ? (lang === "VN" ? "Trên tàu" : "Onboard")
                              : (lang === "VN" ? "Bến tàu" : "Station")}
                          </span>
                        )}
                      </td>
                      {scopeFilter !== SCOPE.BOAT && (
                        <td className="py-4 px-4">
                          {staffType === "Ground" && (() => {
                            const userId = String(item.id || "");
                            const ids = stationIdsByUser[userId] || extractStationIdsFromUser(item);
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
                      )}
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
                        {canManage || canResetPassword ? (
                          <div className="flex items-center justify-center gap-2">
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/staffs-management/edit/${item.id}`)}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/20 hover:border-amber-200 dark:hover:border-amber-500/30 transition-all shadow-sm"
                                title={lang === "VN" ? "Chỉnh sửa" : "Edit"}
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                            )}
                            {canResetPassword && (
                              <button
                                type="button"
                                onClick={() => handleResetPassword(item)}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-[#124757] hover:bg-slate-50 dark:hover:bg-yellow-400/15 hover:border-[#124757]/40 dark:hover:text-yellow-400 dark:hover:border-yellow-400/40 transition-all shadow-sm"
                                title={lang === "VN" ? "Đặt lại mật khẩu" : "Reset password"}
                              >
                                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                              </button>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-500/20 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-sm"
                                title={lang === "VN" ? "Xóa" : "Delete"}
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
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
                  className={`w-8 h-8 shrink-0 rounded-xl text-[11px] font-headline font-black transition-all ${currentPage === item
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-md"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
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
