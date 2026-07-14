import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useApp } from "../../../context/AppContext";
import { fetchAllBoats } from "../../../services/boatService";
import { fetchAllStations } from "../../../services/stationService";
import {
  fetchGroundStaffUsers,
  fetchOnBoardStaffUsers,
  fetchUserStations,
} from "../../../services/userService";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TYPE,
  SHIFT_STATE,
  addStaffAssignment,
  buildCreateAssignmentPayload,
  cancelStaffAssignment,
  fetchStaffAssignments,
  fetchMyStaffAssignments,
  labelAssignmentStatus,
  labelAssignmentType,
  labelShiftState,
  resolveShiftState,
  validateCreateAssignmentForm,
} from "../../../services/staffAssignmentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getUserId, isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { StaffAssignmentCalendar } from "../../../components/StaffAssignmentCalendar";
import { getRangeForScheduleMode, toDateKey } from "../../../utils/staffAssignmentCalendarUtils";
import { notify } from "../../../utils/swalToast";

const pad2 = (n) => String(n).padStart(2, "0");

const toDateInputValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const defaultDateRange = ({ wide = false } = {}) => {
  const from = new Date();
  const to = new Date();
  if (wide) {
    // Staff xem lịch của mình: lùi 7 ngày + tới 60 ngày để không miss ca gần đây / sắp tới.
    from.setDate(from.getDate() - 7);
    to.setDate(to.getDate() + 60);
  } else {
    to.setDate(to.getDate() + 6);
  }
  return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) };
};

const emptyCreateForm = (assignmentType = ASSIGNMENT_TYPE.STATION) => {
  const start = new Date();
  start.setHours(8, 0, 0, 0);
  const end = new Date();
  end.setHours(16, 0, 0, 0);
  const toLocal = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return {
    assignmentType,
    staffUserId: "",
    boatId: "",
    stationId: "",
    startAt: toLocal(start),
    endAt: toLocal(end),
    note: "",
  };
};

const formatDateTime = (value, lang) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusTone = (status) => {
  switch (status) {
    case ASSIGNMENT_STATUS.SCHEDULED:
      return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400";
    case ASSIGNMENT_STATUS.CANCELLED:
      return "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
};

const shiftStateTone = (state) => {
  switch (state) {
    case SHIFT_STATE.ACTIVE:
      return "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400";
    case SHIFT_STATE.COMPLETED:
      return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300";
    case SHIFT_STATE.UPCOMING:
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300";
    default:
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
};

const getStaffId = (staff) => String(staff?.id || staff?.userId || staff?.raw?.id || "");
const getStaffName = (staff) => staff?.fullName || staff?.name || staff?.raw?.fullName || "—";
const getBoatId = (boat) => String(boat?.boatId || boat?.id || "");
const getStationId = (station) => String(station?.stationId || station?.id || "");

export function StaffAssignmentManagement() {
  const { lang } = useApp();
  const { user: currentUser } = useSelector((state) => state.auth);
  const myUserId = getUserId(currentUser);
  const isAdmin = isAdminUser(currentUser);
  const isManager = isManagerUser(currentUser);
  const isStaff = isStaffUser(currentUser) && !isAdmin;

  // Bảng tổng: Boat + Station. Admin tạo/sửa Boat · xem Station. Manager tạo Station. Staff/Manager nhận ca.
  const canCreateBoat = isAdmin;
  const canCreateStation = isManager && !isAdmin;
  const canViewManage = isAdmin || canCreateStation;
  const canReceive = (isStaff || isManager) && !isAdmin;
  const canAccess = isAdmin || isManager || isStaff;

  // Staff/Manager xem "của tôi": mặc định khoảng rộng hơn để thấy ca gần đây & sắp tới.
  const range0 = defaultDateRange({ wide: canReceive });
  const [viewMode, setViewMode] = useState(() => (canViewManage ? "manage" : "mine"));
  const isMineView = viewMode === "mine" || (!canViewManage && canReceive);

  const [fromDate, setFromDate] = useState(range0.fromDate);
  const [toDate, setToDate] = useState(range0.toDate);
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState(
    canCreateStation && !canCreateBoat ? ASSIGNMENT_TYPE.STATION : "All"
  );
  const [statusFilter, setStatusFilter] = useState("All");
  const [shiftStateFilter, setShiftStateFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("");
  const [boatFilter, setBoatFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("");

  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const [boats, setBoats] = useState([]);
  const [stations, setStations] = useState([]);
  const [onBoardStaff, setOnBoardStaff] = useState([]);
  const [groundStaff, setGroundStaff] = useState([]);
  const [managerStationIds, setManagerStationIds] = useState([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() =>
    emptyCreateForm(canCreateBoat ? ASSIGNMENT_TYPE.BOAT : ASSIGNMENT_TYPE.STATION)
  );
  const [createError, setCreateError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // list | schedule — Ngày/Tuần/Tháng gộp trong StaffAssignmentCalendar
  const [displayMode, setDisplayMode] = useState("list");
  const [calendarMode, setCalendarMode] = useState("month"); // day | week | month
  const [calendarLayout, setCalendarLayout] = useState("calendar");
  const [anchorDate, setAnchorDate] = useState(() => new Date());

  useEffect(() => {
    if (displayMode !== "schedule") return;
    const range = getRangeForScheduleMode(calendarMode, anchorDate);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  }, [displayMode, calendarMode, anchorDate]);

  useEffect(() => {
    if (displayMode !== "schedule" || calendarLayout !== "byBoat") return;
    if (isAdmin) setAssignmentTypeFilter(ASSIGNMENT_TYPE.BOAT);
  }, [displayMode, calendarLayout, isAdmin]);

  // Tránh giữ filter mục tiêu không khớp phạm vi đang chọn.
  useEffect(() => {
    if (assignmentTypeFilter !== ASSIGNMENT_TYPE.BOAT) setBoatFilter("");
    if (assignmentTypeFilter !== ASSIGNMENT_TYPE.STATION) setStationFilter("");
  }, [assignmentTypeFilter]);

  const labelStyle =
    "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1 block";
  const inputStyle =
    "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
  const filterInputStyle =
    "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400";

  const usableStations = useMemo(() => {
    if (isAdmin) return stations;
    if (isManager && managerStationIds.length > 0) {
      const allowed = new Set(managerStationIds.map(String));
      return stations.filter((s) => allowed.has(getStationId(s)));
    }
    return stations;
  }, [isAdmin, isManager, stations, managerStationIds]);

  const staffOptionsForCreate = useMemo(() => {
    if (createForm.assignmentType === ASSIGNMENT_TYPE.BOAT) return onBoardStaff;
    return groundStaff;
  }, [createForm.assignmentType, onBoardStaff, groundStaff]);

  const allStaffForFilter = useMemo(() => {
    const map = new Map();
    [...onBoardStaff, ...groundStaff].forEach((s) => {
      const id = getStaffId(s);
      if (id) map.set(id, s);
    });
    return [...map.values()];
  }, [onBoardStaff, groundStaff]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [boatData, stationData, onboard, ground] = await Promise.all([
          canCreateBoat || isAdmin ? fetchAllBoats().catch(() => []) : Promise.resolve([]),
          canViewManage ? fetchAllStations().catch(() => []) : Promise.resolve([]),
          canCreateBoat || isAdmin ? fetchOnBoardStaffUsers({ force: true }).catch(() => []) : Promise.resolve([]),
          canCreateStation || isAdmin ? fetchGroundStaffUsers({ force: true }).catch(() => []) : Promise.resolve([]),
        ]);
        setBoats(Array.isArray(boatData) ? boatData : boatData?.items || []);
        setStations(Array.isArray(stationData) ? stationData : []);
        setOnBoardStaff(onboard || []);
        setGroundStaff(ground || []);

        if (canCreateStation && currentUser?.id) {
          const ids = await fetchUserStations(currentUser.id).catch(() => []);
          setManagerStationIds(ids || []);
        }
      } catch (error) {
        console.error("Lỗi tải lookup phân công:", error);
      }
    };
    if (canAccess) loadLookups();
  }, [
    canAccess,
    canCreateBoat,
    canCreateStation,
    canViewManage,
    isAdmin,
    isMineView,
    currentUser?.id,
  ]);

  const loadAssignments = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");

      if (isMineView) {
        if (!myUserId) {
          setAssignments([]);
          return;
        }
        try {
          let data = await fetchMyStaffAssignments({
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            status: statusFilter !== "All" ? statusFilter : undefined,
            staffUserId: myUserId,
          });
          if (shiftStateFilter !== "All") {
            data = data.filter((row) => resolveShiftState(row) === shiftStateFilter);
          }
          setAssignments(data);
        } catch {
          // Staff nhận lịch: không hiện lỗi — có ca thì sẽ hiện khi API trả được.
          setAssignments([]);
        }
        return;
      }

      // Manager (không Admin): bảng quản lý chỉ Station của mình.
      // Admin: bảng tổng Boat + Station.
      const forcedType =
        isManager && !isAdmin
          ? ASSIGNMENT_TYPE.STATION
          : assignmentTypeFilter !== "All"
            ? assignmentTypeFilter
            : undefined;

      const params = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        staffUserId: staffFilter || undefined,
        assignmentType: forcedType,
        boatId:
          forcedType === ASSIGNMENT_TYPE.BOAT || (!forcedType && isAdmin)
            ? boatFilter || undefined
            : undefined,
        stationId:
          forcedType === ASSIGNMENT_TYPE.STATION || !forcedType || (isManager && !isAdmin)
            ? stationFilter || undefined
            : undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
      };

      let data = await fetchStaffAssignments(params);

      if (isManager && !isAdmin) {
        const allowed = new Set(managerStationIds.map(String));
        data = data.filter(
          (row) =>
            row.assignmentType === ASSIGNMENT_TYPE.STATION &&
            (!allowed.size || allowed.has(String(row.station?.stationId || "")))
        );
      }

      if (shiftStateFilter !== "All") {
        data = data.filter((row) => resolveShiftState(row) === shiftStateFilter);
      }

      setAssignments(data);
    } catch (error) {
      console.error(error);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được danh sách phân công." : "Failed to load staff assignments."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    fromDate,
    toDate,
    staffFilter,
    assignmentTypeFilter,
    boatFilter,
    stationFilter,
    statusFilter,
    shiftStateFilter,
    isAdmin,
    isManager,
    isMineView,
    myUserId,
    managerStationIds,
    lang,
  ]);

  useEffect(() => {
    if (canAccess) loadAssignments();
  }, [canAccess, loadAssignments]);

  const stats = useMemo(
    () => ({
      total: assignments.length,
      scheduled: assignments.filter((a) => a.status === ASSIGNMENT_STATUS.SCHEDULED).length,
      active: assignments.filter((a) => resolveShiftState(a) === SHIFT_STATE.ACTIVE).length,
      cancelled: assignments.filter((a) => a.status === ASSIGNMENT_STATUS.CANCELLED).length,
    }),
    [assignments]
  );

  const canMutateAssignment = (row) => {
    if (!row || isMineView) return false;
    if (row.assignmentType === ASSIGNMENT_TYPE.BOAT) return canCreateBoat;
    if (row.assignmentType === ASSIGNMENT_TYPE.STATION) {
      if (!canCreateStation) return false;
      if (!managerStationIds.length) return true;
      return managerStationIds.map(String).includes(String(row.station?.stationId || ""));
    }
    return false;
  };

  const openCreate = () => {
    setCreateError("");
    if (!canCreateBoat && !canCreateStation) return;
    setCreateForm(emptyCreateForm(canCreateBoat ? ASSIGNMENT_TYPE.BOAT : ASSIGNMENT_TYPE.STATION));
    setIsCreateOpen(true);
  };

  const handleCreateField = (field, value) => {
    setCreateForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "assignmentType") {
        next.staffUserId = "";
        next.boatId = "";
        next.stationId = "";
      }
      return next;
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setCreateError("");

      if (createForm.assignmentType === ASSIGNMENT_TYPE.BOAT && !canCreateBoat) {
        setCreateError(lang === "VN" ? "Admin mới được tạo phân công tàu." : "Only Admin can create Boat assignments.");
        return;
      }
      if (createForm.assignmentType === ASSIGNMENT_TYPE.STATION && !canCreateStation) {
        setCreateError(
          lang === "VN"
            ? "Admin chỉ xem phân công bến — Manager mới được tạo."
            : "Admin can only view Station — Manager creates them."
        );
        return;
      }

      const formError = validateCreateAssignmentForm(createForm, lang);
      if (formError) {
        setCreateError(formError);
        return;
      }

      if (createForm.assignmentType === ASSIGNMENT_TYPE.STATION && isManager) {
        const allowed = new Set(managerStationIds.map(String));
        if (allowed.size && !allowed.has(String(createForm.stationId))) {
          setCreateError(lang === "VN" ? "Chỉ phân công bến bạn quản lý." : "Only stations you manage are allowed.");
          return;
        }
      }

      await addStaffAssignment(buildCreateAssignmentPayload(createForm));
      setIsCreateOpen(false);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã tạo phân công" : "Assignment created",
        showConfirmButton: false,
        timer: 1600,
      });
      await loadAssignments();
    } catch (error) {
      setCreateError(
        getApiErrorMessage(error, lang === "VN" ? "Tạo phân công thất bại." : "Failed to create assignment.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (assignment) => {
    if (!canMutateAssignment(assignment)) {
      notify({
        icon: "info",
        title: lang === "VN" ? "Chỉ được xem" : "View only",
        text:
          lang === "VN"
            ? "Admin quản lý ca tàu; Manager quản lý ca bến."
            : "Admin manages boat shifts; Manager manages station shifts.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    const confirm = await notify({
      icon: "warning",
      title: lang === "VN" ? "Hủy phân công?" : "Cancel assignment?",
      html:
        lang === "VN"
          ? "Hủy ca này có thể làm trống phân công.<br/>Nếu cần người thay, hãy tạo phân công mới sau khi hủy."
          : "Cancelling may leave the shift vacant.<br/>If a replacement is needed, create a new assignment after cancel.",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Hủy ca" : "Cancel shift",
      cancelButtonText: lang === "VN" ? "Đóng" : "Close",
    });
    if (!confirm.isConfirmed) return;

    try {
      setProcessingId(assignment.assignmentId);
      await cancelStaffAssignment(assignment.assignmentId);
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã hủy ca" : "Shift cancelled",
        showConfirmButton: false,
        timer: 1500,
      });
      await loadAssignments();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Không hủy được" : "Cancel failed",
        text: getApiErrorMessage(error),
        confirmButtonColor: "#124757",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (!canAccess) {
    return (
      <div className="p-8 text-center text-sm font-bold text-slate-400">
        {lang === "VN"
          ? "Bạn không có quyền xem phân công."
          : "You do not have permission to view assignments."}
      </div>
    );
  }

  // Chỉ hiện select mục tiêu khớp phạm vi: Tàu → tàu, Bến → bến (Tất cả → ẩn cả hai).
  const showBoatFilter =
    !isMineView && isAdmin && assignmentTypeFilter === ASSIGNMENT_TYPE.BOAT;
  const showStationFilter =
    !isMineView && assignmentTypeFilter === ASSIGNMENT_TYPE.STATION;

  const pageTitle = isMineView
    ? lang === "VN"
      ? "Lịch làm việc của tôi"
      : "My work schedule"
    : lang === "VN"
      ? "Phân công Staff"
      : "Staff Assignments";

  const pageHint = isMineView
    ? lang === "VN"
      ? "Các ca Admin/Manager đã gán cho bạn — Đang diễn ra / Đã kết thúc tính theo giờ ca."
      : "Shifts assigned to you — Active / Completed follow shift times."
    : lang === "VN"
      ? "Tạo · xem · hủy ca. Trạng thái: Đã xếp lịch / Đã hủy. Tiến độ ca (Sắp tới / Đang diễn ra / Đã kết thúc) tính tự động."
      : "Create · view · cancel. Status: Scheduled / Cancelled. Shift progress (Upcoming / Active / Completed) is automatic.";

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {pageTitle}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{pageHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canViewManage && canReceive && (
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setViewMode("manage")}
                className={`px-3 py-2 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${
                  !isMineView
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {lang === "VN" ? "Bảng tổng" : "Master"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mine")}
                className={`px-3 py-2 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${
                  isMineView
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {lang === "VN" ? "Ca của tôi" : "My shifts"}
              </button>
            </div>
          )}
          {!isMineView && (canCreateBoat || canCreateStation) && (
            <button
              type="button"
              onClick={openCreate}
              className="px-5 py-3 bg-yellow-400 text-slate-900 font-headline font-black text-xs uppercase tracking-widest rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
              {lang === "VN"
                ? canCreateBoat
                  ? "Phân công tàu"
                  : "Phân công bến"
                : canCreateBoat
                  ? "Assign boat"
                  : "Assign station"}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: lang === "VN" ? "Tổng" : "Total", value: stats.total, icon: "assignment_ind" },
          { label: lang === "VN" ? "Đã xếp lịch" : "Scheduled", value: stats.scheduled, icon: "schedule" },
          { label: lang === "VN" ? "Đang diễn ra" : "Active now", value: stats.active, icon: "play_circle" },
          { label: lang === "VN" ? "Đã hủy" : "Cancelled", value: stats.cancelled, icon: "cancel" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#124757] dark:text-yellow-400">
              <span className="material-symbols-outlined text-2xl">{card.icon}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {card.label}
              </span>
              <h3 className="text-xl font-black font-headline text-[#124757] dark:text-white mt-0.5">
                {card.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "list", icon: "table_rows", vn: "Danh sách", en: "List" },
            { id: "schedule", icon: "calendar_month", vn: "Lịch", en: "Calendar" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setDisplayMode(opt.id);
                if (opt.id === "schedule") setAnchorDate(new Date());
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all ${
                displayMode === opt.id
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{opt.icon}</span>
              {lang === "VN" ? opt.vn : opt.en}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {displayMode === "list" ? (
            <>
              <div className="w-[148px]">
                <label className={labelStyle}>{lang === "VN" ? "Từ ngày" : "From"}</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInputStyle} />
              </div>
              <div className="w-[148px]">
                <label className={labelStyle}>{lang === "VN" ? "Đến ngày" : "To"}</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInputStyle} />
              </div>
            </>
          ) : (
            <div className="w-[148px]">
              <label className={labelStyle}>{lang === "VN" ? "Ngày" : "Date"}</label>
              <input
                type="date"
                value={toDateKey(anchorDate)}
                onChange={(e) => setAnchorDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : new Date())}
                className={filterInputStyle}
              />
            </div>
          )}
          <div className="w-[128px]">
            <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInputStyle}>
              <option value="All">{lang === "VN" ? "Tất cả" : "All"}</option>
              <option value={ASSIGNMENT_STATUS.SCHEDULED}>
                {labelAssignmentStatus(ASSIGNMENT_STATUS.SCHEDULED, lang)}
              </option>
              <option value={ASSIGNMENT_STATUS.CANCELLED}>
                {labelAssignmentStatus(ASSIGNMENT_STATUS.CANCELLED, lang)}
              </option>
            </select>
          </div>
          <div className="w-[140px]">
            <label className={labelStyle}>{lang === "VN" ? "Tiến độ ca" : "Shift"}</label>
            <select value={shiftStateFilter} onChange={(e) => setShiftStateFilter(e.target.value)} className={filterInputStyle}>
              <option value="All">{lang === "VN" ? "Tất cả" : "All"}</option>
              {Object.values(SHIFT_STATE).map((s) => (
                <option key={s} value={s}>
                  {labelShiftState(s, lang)}
                </option>
              ))}
            </select>
          </div>
          {!isMineView && (
            <div className="w-[120px]">
              <label className={labelStyle}>{lang === "VN" ? "Phạm vi" : "Scope"}</label>
              <select
                value={assignmentTypeFilter}
                disabled={(isManager && !isAdmin) || (displayMode === "schedule" && calendarLayout === "byBoat" && isAdmin)}
                onChange={(e) => {
                  setAssignmentTypeFilter(e.target.value);
                  setBoatFilter("");
                  setStationFilter("");
                }}
                className={filterInputStyle}
              >
                {isAdmin && <option value="All">{lang === "VN" ? "Tất cả" : "All"}</option>}
                {isAdmin && (
                  <option value={ASSIGNMENT_TYPE.BOAT}>{labelAssignmentType(ASSIGNMENT_TYPE.BOAT, lang)}</option>
                )}
                <option value={ASSIGNMENT_TYPE.STATION}>{labelAssignmentType(ASSIGNMENT_TYPE.STATION, lang)}</option>
              </select>
            </div>
          )}
          {!isMineView && (canCreateBoat || canCreateStation || isAdmin) && (
            <div className="w-[168px]">
              <label className={labelStyle}>{lang === "VN" ? "Nhân viên" : "Staff"}</label>
              <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className={filterInputStyle}>
                <option value="">{lang === "VN" ? "Tất cả nhân viên" : "All staff"}</option>
                {allStaffForFilter.map((s) => (
                  <option key={getStaffId(s)} value={getStaffId(s)}>
                    {getStaffName(s)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showBoatFilter && (
            <div className="w-[168px]">
              <label className={labelStyle}>{lang === "VN" ? "Tàu" : "Boat"}</label>
              <select value={boatFilter} onChange={(e) => setBoatFilter(e.target.value)} className={filterInputStyle}>
                <option value="">{lang === "VN" ? "Tất cả tàu" : "All boats"}</option>
                {boats.map((b) => (
                  <option key={getBoatId(b)} value={getBoatId(b)}>
                    {b.boatCode || b.code} · {b.boatName || b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showStationFilter && (
            <div className="w-[168px]">
              <label className={labelStyle}>{lang === "VN" ? "Bến" : "Station"}</label>
              <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)} className={filterInputStyle}>
                <option value="">{lang === "VN" ? "Tất cả bến" : "All stations"}</option>
                {usableStations.map((s) => (
                  <option key={getStationId(s)} value={getStationId(s)}>
                    {s.stationCode || s.code} · {s.stationName || s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {displayMode === "schedule" ? (
        <StaffAssignmentCalendar
          lang={lang}
          assignments={assignments}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          layout={calendarLayout}
          onLayoutChange={setCalendarLayout}
          showLayoutToggle={isAdmin || canCreateBoat}
          anchorDate={anchorDate}
          onAnchorChange={setAnchorDate}
          isLoading={isLoading}
        />
      ) : (
      <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                <th className="py-4 px-5">{lang === "VN" ? "Nhân viên" : "Staff"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Loại NV" : "Staff type"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Phạm vi" : "Scope"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Bến / Tàu" : "Target"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Bắt đầu" : "Start"}</th>
                <th className="py-4 px-4">{lang === "VN" ? "Kết thúc" : "End"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                <th className="py-4 px-4 text-center">{lang === "VN" ? "Tiến độ ca" : "Shift"}</th>
                <th className="py-4 px-5 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400 font-bold">
                    {isMineView
                      ? lang === "VN"
                        ? "Chưa có ca được gán cho bạn."
                        : "No shifts assigned to you yet."
                      : lang === "VN"
                        ? "Không có phân công phù hợp."
                        : "No assignments found."}
                  </td>
                </tr>
              ) : (
                assignments.map((row) => {
                  const targetLabel =
                    row.assignmentType === ASSIGNMENT_TYPE.BOAT
                      ? row.boat
                        ? `${row.boat.boatCode || ""} · ${row.boat.boatName || ""}`.trim()
                        : "—"
                      : row.station
                        ? `${row.station.stationCode || ""} · ${row.station.stationName || ""}`.trim()
                        : "—";
                  const busy = processingId === row.assignmentId;
                  const canMutate = canMutateAssignment(row);
                  const shift = resolveShiftState(row);
                  return (
                    <tr key={row.assignmentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800 dark:text-white">{row.staffName}</p>
                      </td>
                      <td className="py-3.5 px-4">{row.staffType || "—"}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-headline font-black text-[10px] uppercase tracking-wide">
                          {labelAssignmentType(row.assignmentType, lang)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                        {targetLabel || "—"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{formatDateTime(row.startAt, lang)}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{formatDateTime(row.endAt, lang)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusTone(row.status)}`}
                        >
                          {labelAssignmentStatus(row.status, lang)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {shift ? (
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${shiftStateTone(shift)}`}
                          >
                            {labelShiftState(shift, lang)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {canMutate && row.status !== ASSIGNMENT_STATUS.CANCELLED && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleCancel(row)}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 text-[10px] font-headline font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white disabled:opacity-50 dark:border-rose-500/30"
                              title={lang === "VN" ? "Hủy ca" : "Cancel shift"}
                            >
                              {busy ? "…" : lang === "VN" ? "Hủy ca" : "Cancel"}
                            </button>
                          )}
                          {(!canMutate || row.status === ASSIGNMENT_STATUS.CANCELLED) && (
                            <span className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-600 tracking-wider">
                              {lang === "VN" ? "Chỉ xem" : "View only"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-4xl border border-slate-100 dark:border-slate-700 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Tạo phân công" : "Create assignment"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              {createError && (
                <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                  {createError}
                </div>
              )}

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Loại phân công (*)" : "Assignment type (*)"}</label>
                {(() => {
                  const createTypeOptions = [
                    ...(canCreateBoat
                      ? [{ value: ASSIGNMENT_TYPE.BOAT, label: labelAssignmentType(ASSIGNMENT_TYPE.BOAT, lang) }]
                      : []),
                    ...(canCreateStation
                      ? [{ value: ASSIGNMENT_TYPE.STATION, label: labelAssignmentType(ASSIGNMENT_TYPE.STATION, lang) }]
                      : []),
                  ];
                  if (createTypeOptions.length <= 1) {
                    return (
                      <div className={`${inputStyle} flex items-center font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400`}>
                        {createTypeOptions[0]?.label || "—"}
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
                      {createTypeOptions.map((opt) => {
                        const selected = createForm.assignmentType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleCreateField("assignmentType", opt.value)}
                            className={`h-10 rounded-lg text-[11px] font-headline font-black uppercase tracking-wider transition-all ${
                              selected
                                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                                : "text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                {isAdmin && (
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {lang === "VN"
                      ? "Admin tạo ca tàu. Ca bến: chỉ xem (Manager tạo). Roster dài hạn: tab Lịch NV trên chi tiết tàu."
                      : "Admin creates boat shifts. Station: view only (Manager creates). Long-term roster: Onboard schedule tab on boat detail."}
                  </p>
                )}
              </div>

              <div>
                <label className={labelStyle}>
                  {createForm.assignmentType === ASSIGNMENT_TYPE.BOAT
                    ? lang === "VN"
                      ? "Nhân viên tàu (OnBoard) (*)"
                      : "Boat staff (OnBoard) (*)"
                    : lang === "VN"
                      ? "Nhân viên bến (Ground) (*)"
                      : "Station staff (Ground) (*)"}
                </label>
                <select
                  required
                  value={createForm.staffUserId}
                  onChange={(e) => handleCreateField("staffUserId", e.target.value)}
                  className={inputStyle}
                >
                  <option value="">{lang === "VN" ? "-- Chọn staff --" : "-- Select staff --"}</option>
                  {staffOptionsForCreate.map((s) => (
                    <option key={getStaffId(s)} value={getStaffId(s)}>
                      {getStaffName(s)}
                    </option>
                  ))}
                </select>
              </div>

              {createForm.assignmentType === ASSIGNMENT_TYPE.BOAT ? (
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Tàu (*)" : "Boat (*)"}</label>
                  <select
                    required
                    value={createForm.boatId}
                    onChange={(e) => handleCreateField("boatId", e.target.value)}
                    className={inputStyle}
                  >
                    <option value="">{lang === "VN" ? "-- Chọn tàu --" : "-- Select boat --"}</option>
                    {boats.map((b) => (
                      <option key={getBoatId(b)} value={getBoatId(b)}>
                        {b.boatCode || b.code} · {b.boatName || b.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={labelStyle}>{lang === "VN" ? "Bến (*)" : "Station (*)"}</label>
                  <select
                    required
                    value={createForm.stationId}
                    onChange={(e) => handleCreateField("stationId", e.target.value)}
                    className={inputStyle}
                  >
                    <option value="">{lang === "VN" ? "-- Chọn bến --" : "-- Select station --"}</option>
                    {usableStations.map((s) => (
                      <option key={getStationId(s)} value={getStationId(s)}>
                        {s.stationCode || s.code} · {s.stationName || s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelStyle}>startAt (*)</label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.startAt}
                    onChange={(e) => handleCreateField("startAt", e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className={labelStyle}>endAt (*)</label>
                  <input
                    type="datetime-local"
                    required
                    value={createForm.endAt}
                    onChange={(e) => handleCreateField("endAt", e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label className={labelStyle}>{lang === "VN" ? "Ghi chú" : "Note"}</label>
                <input
                  type="text"
                  value={createForm.note}
                  onChange={(e) => handleCreateField("note", e.target.value)}
                  placeholder={lang === "VN" ? "Ca sáng" : "Morning shift"}
                  className={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {lang === "VN" ? "Tạo phân công" : "Create assignment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
