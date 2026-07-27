import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  DAYS_OF_WEEK,
  SHIFT_STATE,
  addStaffAssignmentsBulk,
  buildBulkAssignmentPayload,
  cancelStaffAssignment,
  fetchStaffAssignments,
  fetchMyStaffAssignments,
  isAssignmentInactive,
  labelAssignmentStatus,
  labelAssignmentType,
  labelShiftState,
  replaceStaffOnAssignment,
  resolveShiftState,
  validateBulkAssignmentForm,
} from "../../../services/staffAssignmentService";
import { fetchAllTrips, fetchTripDetail, toOperatingDateQuery } from "../../../services/tripService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getUserId, isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { StaffAssignmentCalendar } from "../../../components/StaffAssignmentCalendar";
import { AppDateInput } from "../../../components/AppDateInput";
import { FormSelect } from "../../../components/FormSelect";
import { getRangeForScheduleMode, toDateKey } from "../../../utils/staffAssignmentCalendarUtils";
import { notify } from "../../../utils/swalToast";

const pad2 = (n) => String(n).padStart(2, "0");

/** Ca Full ngày — khớp cửa sổ vận hành charter/ngày (BE). */
const FULL_DAY_START_TIME = "07:40";
const FULL_DAY_END_TIME = "23:00";
const FULL_DAY_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

/** Khoảng mặc định list: hôm nay → +6 = 7 ngày. BE giới hạn tối đa 62 ngày. */
const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 62;

const toDateInputValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Số ngày inclusive từ from→to (cùng ngày = 1). */
const inclusiveDaySpan = (fromValue, toValue) => {
  const from = parseDateInput(fromValue);
  const to = parseDateInput(toValue);
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 86400000) + 1;
};

const defaultDateRange = () => {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + (DEFAULT_RANGE_DAYS - 1));
  return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) };
};

const emptyCreateForm = (assignmentType = ASSIGNMENT_TYPE.STATION) => {
  const start = new Date();
  start.setHours(8, 0, 0, 0);
  const end = new Date();
  end.setHours(16, 0, 0, 0);
  const toLocal = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const today = toDateInputValue(new Date());
  const monthEnd = new Date();
  monthEnd.setDate(monthEnd.getDate() + 30);
  // Mặc định Full ngày cho mọi loại phân công (tàu lẫn bến).
  return {
    mode: "fullDay",
    assignmentType,
    staffUserId: "",
    boatId: "",
    stationId: "",
    tripId: "",
    tripStopId: "",
    startAt: toLocal(start),
    endAt: toLocal(end),
    fromDate: today,
    toDate: toDateInputValue(monthEnd),
    startTime: FULL_DAY_START_TIME,
    endTime: FULL_DAY_END_TIME,
    daysOfWeek: [...FULL_DAY_DAYS_OF_WEEK],
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
    case ASSIGNMENT_STATUS.REPLACED:
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300";
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

export function StaffAssignmentManagement({ viewTabs = null }) {
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

  // Mặc định luôn 7 ngày (BE tối đa 62 ngày / request).
  const range0 = defaultDateRange();
  const [viewMode, setViewMode] = useState(() => (canViewManage ? "manage" : "mine"));
  const isMineView = viewMode === "mine" || (!canViewManage && canReceive);

  const [fromDate, setFromDate] = useState(range0.fromDate);
  const [toDate, setToDate] = useState(range0.toDate);
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState(
    canCreateStation && !canCreateBoat ? ASSIGNMENT_TYPE.STATION : "All"
  );
  const [statusFilter, setStatusFilter] = useState("All");
  const [shiftStateFilter, setShiftStateFilter] = useState("All");
  const [stationFilter, setStationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
  const [isLoadingStaffStation, setIsLoadingStaffStation] = useState(false);
  const [replaceForm, setReplaceForm] = useState({
    assignmentId: "",
    staffName: "",
    staffUserId: "",
    reason: "",
  });
  const [replaceError, setReplaceError] = useState("");
  const [isReplacing, setIsReplacing] = useState(false);
  const [gateTrips, setGateTrips] = useState([]);
  const [gateStops, setGateStops] = useState([]);
  const [isLoadingGateTrips, setIsLoadingGateTrips] = useState(false);
  const [isLoadingGateStops, setIsLoadingGateStops] = useState(false);

  // list | schedule — mặc định Lịch (Tuần; Admin xem theo tàu)
  const [displayMode, setDisplayMode] = useState("schedule");
  const [calendarMode, setCalendarMode] = useState("week"); // day | week | month
  const [calendarLayout] = useState(canCreateBoat ? "byBoat" : "calendar");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [expandedListGroups, setExpandedListGroups] = useState(() => new Set());

  // Gate scan: tải chuyến theo fromDate khi chọn bến.
  useEffect(() => {
    if (!isCreateOpen || createForm.assignmentType !== ASSIGNMENT_TYPE.STATION || !createForm.fromDate) {
      setGateTrips([]);
      return undefined;
    }
    let active = true;
    const load = async () => {
      try {
        setIsLoadingGateTrips(true);
        const list = await fetchAllTrips({ operatingDate: toOperatingDateQuery(createForm.fromDate) });
        if (!active) return;
        setGateTrips(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error("Lỗi tải trips cho gate assignment:", error);
        if (active) setGateTrips([]);
      } finally {
        if (active) setIsLoadingGateTrips(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isCreateOpen, createForm.assignmentType, createForm.fromDate]);

  // Gate scan: chọn trip → load stops, lọc theo stationId nếu có.
  useEffect(() => {
    if (!isCreateOpen || createForm.assignmentType !== ASSIGNMENT_TYPE.STATION || !createForm.tripId) {
      setGateStops([]);
      return undefined;
    }
    let active = true;
    const load = async () => {
      try {
        setIsLoadingGateStops(true);
        const detail = await fetchTripDetail(createForm.tripId);
        if (!active) return;
        const stops = Array.isArray(detail?.stops) ? detail.stops : [];
        const stationId = String(createForm.stationId || "");
        const filtered = stationId
          ? stops.filter((s) => String(s.stationId || s.station?.stationId || "") === stationId)
          : stops;
        setGateStops(filtered.length > 0 ? filtered : stops);
      } catch (error) {
        console.error("Lỗi tải trip stops cho gate assignment:", error);
        if (active) setGateStops([]);
      } finally {
        if (active) setIsLoadingGateStops(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isCreateOpen, createForm.assignmentType, createForm.tripId, createForm.stationId]);

  useEffect(() => {
    if (displayMode !== "schedule") return;
    const range = getRangeForScheduleMode(calendarMode, anchorDate);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  }, [displayMode, calendarMode, anchorDate]);

  useEffect(() => {
    if (isAdmin) {
      setAssignmentTypeFilter(ASSIGNMENT_TYPE.BOAT);
      return;
    }
    if (canCreateStation) setAssignmentTypeFilter(ASSIGNMENT_TYPE.STATION);
  }, [displayMode, calendarLayout, isAdmin, canCreateStation]);

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

  const stationSelectOptions = useMemo(() => {
    return usableStations.map((s) => {
      const id = getStationId(s);
      const code = s.stationCode || s.code || "";
      const name = s.stationName || s.name || "";
      return {
        value: id,
        label: [code, name].filter(Boolean).join(" · ") || id,
        searchText: `${code} ${name} ${id}`,
      };
    });
  }, [usableStations]);

  const stationLabelById = useMemo(() => {
    const map = new Map();
    stationSelectOptions.forEach((o) => map.set(String(o.value), o.label));
    return map;
  }, [stationSelectOptions]);

  const stationFilterOptions = useMemo(
    () => [
      { value: "", label: lang === "VN" ? "Tất cả bến" : "All stations" },
      ...stationSelectOptions,
    ],
    [stationSelectOptions, lang],
  );

  const staffOptionsForCreate = useMemo(() => {
    if (createForm.assignmentType === ASSIGNMENT_TYPE.BOAT) return onBoardStaff;
    return groundStaff;
  }, [createForm.assignmentType, onBoardStaff, groundStaff]);

  // Nhân viên bến đã có sẵn bến làm việc cố định → tự lấy bến đó, không cho chọn tay.
  useEffect(() => {
    if (createForm.assignmentType !== ASSIGNMENT_TYPE.STATION || !createForm.staffUserId) {
      return;
    }
    let cancelled = false;
    const loadStaffStation = async () => {
      try {
        setIsLoadingStaffStation(true);
        const ids = await fetchUserStations(createForm.staffUserId).catch(() => []);
        if (cancelled) return;
        setCreateForm((prev) => (
          prev.staffUserId === createForm.staffUserId
            ? { ...prev, stationId: ids?.[0] ? String(ids[0]) : "" }
            : prev
        ));
      } finally {
        if (!cancelled) setIsLoadingStaffStation(false);
      }
    };
    loadStaffStation();
    return () => {
      cancelled = true;
    };
  }, [createForm.assignmentType, createForm.staffUserId]);

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

  const dateRangeDays = useMemo(
    () => inclusiveDaySpan(fromDate, toDate),
    [fromDate, toDate],
  );
  const dateRangeTooWide = dateRangeDays != null && dateRangeDays > MAX_RANGE_DAYS;
  const dateRangeInvalid = fromDate && toDate && dateRangeDays == null;

  const loadAssignments = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");

      const span = inclusiveDaySpan(fromDate, toDate);
      if (fromDate && toDate && (span == null || span > MAX_RANGE_DAYS)) {
        setAssignments([]);
        setErrorMsg(
          span == null
            ? (lang === "VN"
              ? "Khoảng ngày không hợp lệ (Từ ngày phải ≤ Đến ngày)."
              : "Invalid date range (From must be ≤ To).")
            : (lang === "VN"
              ? `Chỉ xem tối đa ${MAX_RANGE_DAYS} ngày / lần. Hiện đang chọn ${span} ngày — hãy thu hẹp khoảng ngày.`
              : `You can view at most ${MAX_RANGE_DAYS} days at a time. Current range is ${span} days — please narrow the dates.`)
        );
        return;
      }

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
          // Staff không thấy Cancelled / Replaced
          data = data.filter((row) => !isAssignmentInactive(row.status));
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

      // Manager: chỉ Station của mình. Admin: chỉ Boat (phân NV theo tàu, không theo chuyến/bến).
      const forcedType =
        isManager && !isAdmin
          ? ASSIGNMENT_TYPE.STATION
          : isAdmin
            ? ASSIGNMENT_TYPE.BOAT
            : assignmentTypeFilter !== "All"
              ? assignmentTypeFilter
              : undefined;

      const params = {
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        assignmentType: forcedType,
        stationId: !isAdmin && stationFilter ? stationFilter : undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
      };

      let data = await fetchStaffAssignments(params);

      if (isAdmin) {
        data = data.filter((row) => row.assignmentType === ASSIGNMENT_TYPE.BOAT);
      } else if (isManager && !isAdmin) {
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
    assignmentTypeFilter,
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

  const visibleAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assignments;
    return assignments.filter((row) => {
      const hay = [
        row.staffName,
        row.staffType,
        row.staffUserId,
        row.boat?.boatCode,
        row.boat?.boatName,
        row.station?.stationCode,
        row.station?.stationName,
        labelAssignmentType(row.assignmentType, lang),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [assignments, searchQuery, lang]);

  /** Gộp cùng NV + tàu/bến + trạng thái → 1 nhóm (tránh list dài sau khi tạo bulk). */
  const assignmentGroups = useMemo(() => {
    const map = new Map();
    visibleAssignments.forEach((row) => {
      const scopeKey =
        row.assignmentType === ASSIGNMENT_TYPE.BOAT
          ? `boat:${row.boat?.boatId || row.boat?.boatCode || ""}`
          : `station:${row.station?.stationId || row.station?.stationCode || ""}`;
      const key = [
        row.staffUserId || row.staffName || "",
        row.assignmentType || "",
        scopeKey,
        row.status || "",
      ].join("|");
      if (!map.has(key)) {
        map.set(key, {
          key,
          staffName: row.staffName,
          staffType: row.staffType,
          assignmentType: row.assignmentType,
          status: row.status,
          boat: row.boat,
          station: row.station,
          items: [],
        });
      }
      map.get(key).items.push(row);
    });
    return [...map.values()]
      .map((group) => {
        const items = [...group.items].sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        );
        const activeCount = items.filter((r) => resolveShiftState(r) === SHIFT_STATE.ACTIVE).length;
        const upcomingCount = items.filter((r) => resolveShiftState(r) === SHIFT_STATE.UPCOMING).length;
        return {
          ...group,
          items,
          firstStart: items[0]?.startAt,
          lastEnd: items[items.length - 1]?.endAt,
          activeCount,
          upcomingCount,
        };
      })
      .sort((a, b) => String(a.staffName || "").localeCompare(String(b.staffName || "")));
  }, [visibleAssignments]);

  const toggleListGroup = (key) => {
    setExpandedListGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatDateShort = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  useEffect(() => {
    if (canAccess) loadAssignments();
  }, [canAccess, loadAssignments]);

  const stats = useMemo(
    () => ({
      total: visibleAssignments.length,
      scheduled: visibleAssignments.filter((a) => a.status === ASSIGNMENT_STATUS.SCHEDULED).length,
      active: visibleAssignments.filter((a) => resolveShiftState(a) === SHIFT_STATE.ACTIVE).length,
      cancelled: visibleAssignments.filter((a) => a.status === ASSIGNMENT_STATUS.CANCELLED).length,
    }),
    [visibleAssignments]
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
        next.tripId = "";
        next.tripStopId = "";
        // Chỉ còn Full ngày — luôn khóa giờ + đủ 7 thứ.
        next.mode = "fullDay";
        next.startTime = FULL_DAY_START_TIME;
        next.endTime = FULL_DAY_END_TIME;
        next.daysOfWeek = [...FULL_DAY_DAYS_OF_WEEK];
      }
      if (field === "staffUserId" && prev.assignmentType === ASSIGNMENT_TYPE.STATION) {
        // Bến sẽ được tự nạp lại theo nhân viên vừa chọn (xem effect loadStaffStation).
        next.stationId = "";
      }
      if (field === "stationId" || field === "fromDate") {
        next.tripId = "";
        next.tripStopId = "";
      }
      if (field === "tripId") {
        next.tripStopId = "";
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
        setCreateError(lang === "VN" ? "Chỉ quản trị viên mới xếp lịch trên tàu." : "Only admins can schedule boat shifts.");
        return;
      }
      if (createForm.assignmentType === ASSIGNMENT_TYPE.STATION && !canCreateStation) {
        setCreateError(
          lang === "VN"
            ? "Chỉ quản lý bến mới xếp lịch tại bến."
            : "Only station managers can schedule station shifts."
        );
        return;
      }

      if (createForm.assignmentType === ASSIGNMENT_TYPE.STATION && isManager) {
        const allowed = new Set(managerStationIds.map(String));
        if (allowed.size && !allowed.has(String(createForm.stationId))) {
          setCreateError(lang === "VN" ? "Chỉ xếp lịch cho bến bạn quản lý." : "You can only schedule stations you manage.");
          return;
        }
      }

      // Chỉ còn Full ngày → luôn bulk với giờ cố định 07:40–23:00.
      const formForSubmit = {
        ...createForm,
        mode: "fullDay",
        startTime: FULL_DAY_START_TIME,
        endTime: FULL_DAY_END_TIME,
        daysOfWeek: Array.isArray(createForm.daysOfWeek) && createForm.daysOfWeek.length > 0
          ? createForm.daysOfWeek
          : [...FULL_DAY_DAYS_OF_WEEK],
      };

      const formError = validateBulkAssignmentForm(formForSubmit, lang);
      if (formError) {
        setCreateError(formError);
        return;
      }

      await addStaffAssignmentsBulk(buildBulkAssignmentPayload(formForSubmit));
      setIsCreateOpen(false);
      setDisplayMode("schedule");
      setAnchorDate(new Date());
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã xếp lịch làm việc" : "Shift scheduled",
        showConfirmButton: false,
        timer: 1800,
      });
      await loadAssignments();
    } catch (error) {
      setCreateError(
        getApiErrorMessage(error, lang === "VN" ? "Không xếp được lịch. Vui lòng thử lại." : "Could not save the schedule. Please try again.")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openReplace = (row) => {
    setReplaceError("");
    setReplaceForm({
      assignmentId: row.assignmentId,
      staffName: row.staffName || "",
      staffUserId: "",
      reason: lang === "VN" ? "Nghỉ đột xuất" : "Sudden leave",
    });
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!replaceForm.assignmentId || !replaceForm.staffUserId) {
      setReplaceError(lang === "VN" ? "Chọn nhân viên thay thế." : "Select replacement staff.");
      return;
    }
    if (!String(replaceForm.reason || "").trim()) {
      setReplaceError(lang === "VN" ? "Nhập lý do thay." : "Enter a replacement reason.");
      return;
    }
    try {
      setIsReplacing(true);
      setReplaceError("");
      await replaceStaffOnAssignment(replaceForm.assignmentId, {
        replacementStaffUserId: replaceForm.staffUserId,
        reason: replaceForm.reason.trim(),
      });
      setReplaceForm({ assignmentId: "", staffName: "", staffUserId: "", reason: "" });
      notify({
        toast: true,
        position: "top-end",
        icon: "success",
        title: lang === "VN" ? "Đã thay nhân viên" : "Staff replaced",
        showConfirmButton: false,
        timer: 1600,
      });
      await loadAssignments();
    } catch (error) {
      setReplaceError(
        getApiErrorMessage(error, lang === "VN" ? "Thay nhân viên thất bại." : "Failed to replace staff.")
      );
    } finally {
      setIsReplacing(false);
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

  // Admin: phân theo tàu — không filter bến. Manager: filter bến.
  const showStationFilter = !isMineView && canCreateStation && !isAdmin;
  const isAdminBoatManage = !isMineView && isAdmin;
  const tableColSpan = isAdminBoatManage ? 7 : 8;

  const pageTitle = isMineView
    ? lang === "VN"
      ? "Lịch làm việc của tôi"
      : "My work schedule"
    : lang === "VN"
      ? "Phân công nhân viên"
      : "Staff Assignments";

  const pageHint = isMineView
    ? lang === "VN"
      ? "Các ca Admin/Manager đã gán cho bạn — Đang diễn ra / Đã kết thúc tính theo giờ ca."
      : "Shifts assigned to you — Active / Completed follow shift times."
    : isAdmin
      ? ""
      : (lang === "VN"
        ? "Tạo · xem · hủy ca bến."
        : "Create · view · cancel station shifts.");

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-7xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide">
            {pageTitle}
          </h2>
          {pageHint ? <p className="text-xs text-slate-400 mt-0.5">{pageHint}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewTabs}
          {canViewManage && canReceive && (
            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setViewMode("manage")}
                className={`px-3 py-2 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${!isMineView
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {lang === "VN" ? "Bảng tổng" : "Master"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mine")}
                className={`px-3 py-2 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${isMineView
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
                  ? "Xếp lịch tàu"
                  : "Xếp lịch bến"
                : canCreateBoat
                  ? "Schedule boat"
                  : "Schedule station"}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: lang === "VN" ? "Tổng ca" : "Shifts", value: stats.total },
          { label: lang === "VN" ? "Đã xếp lịch" : "Scheduled", value: stats.scheduled },
          { label: lang === "VN" ? "Đang diễn ra" : "Active now", value: stats.active },
          { label: lang === "VN" ? "Đã hủy" : "Cancelled", value: stats.cancelled },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex items-center gap-3"
          >
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {card.label}
              </span>
              <h3 className="text-lg font-black font-headline text-[#124757] dark:text-white leading-tight">
                {card.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 p-3 sm:p-3.5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
            {[
              { id: "schedule", vn: "Lịch", en: "Calendar" },
              { id: "list", vn: "Chi tiết ca", en: "Shift list" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setDisplayMode(opt.id);
                  if (opt.id === "schedule") setAnchorDate(new Date());
                  if (opt.id === "list") {
                    const next = defaultDateRange();
                    setFromDate(next.fromDate);
                    setToDate(next.toDate);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${displayMode === opt.id
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
                  }`}
              >
                {lang === "VN" ? opt.vn : opt.en}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {displayMode === "list" ? (
            <>
              <div className="w-37">
                <label className={labelStyle}>{lang === "VN" ? "Từ ngày" : "From"}</label>
                <AppDateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInputStyle} />
              </div>
              <div className="w-37">
                <label className={labelStyle}>{lang === "VN" ? "Đến ngày" : "To"}</label>
                <AppDateInput value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInputStyle} />
              </div>
              {(dateRangeTooWide || dateRangeInvalid) ? (
                <p className="w-full text-[11px] font-semibold text-rose-600 dark:text-rose-300">
                  {dateRangeInvalid
                    ? (lang === "VN"
                      ? "Từ ngày phải nhỏ hơn hoặc bằng Đến ngày."
                      : "From date must be on or before To date.")
                    : (lang === "VN"
                      ? `Chỉ xem tối đa ${MAX_RANGE_DAYS} ngày / lần (đang chọn ${dateRangeDays} ngày).`
                      : `Max ${MAX_RANGE_DAYS} days per view (currently ${dateRangeDays} days).`)}
                </p>
              ) : null}
            </>
          ) : (
            <div className="w-37">
              <label className={labelStyle}>{lang === "VN" ? "Ngày" : "Date"}</label>
              <AppDateInput
                value={toDateKey(anchorDate)}
                onChange={(e) => setAnchorDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : new Date())}
                className={filterInputStyle}
              />
            </div>
          )}
          <div className="w-32">
            <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInputStyle}>
              <option value="All">{lang === "VN" ? "Tất cả" : "All"}</option>
              <option value={ASSIGNMENT_STATUS.SCHEDULED}>
                {labelAssignmentStatus(ASSIGNMENT_STATUS.SCHEDULED, lang)}
              </option>
              <option value={ASSIGNMENT_STATUS.CANCELLED}>
                {labelAssignmentStatus(ASSIGNMENT_STATUS.CANCELLED, lang)}
              </option>
              <option value={ASSIGNMENT_STATUS.REPLACED}>
                {labelAssignmentStatus(ASSIGNMENT_STATUS.REPLACED, lang)}
              </option>
            </select>
          </div>
          <div className="w-35">
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
          {showStationFilter ? (
            <div className="min-w-50 w-55">
              <label className={labelStyle}>{lang === "VN" ? "Bến" : "Station"}</label>
              <FormSelect
                value={stationFilter}
                onChange={(value) => setStationFilter(String(value ?? ""))}
                options={stationFilterOptions}
                searchable
                placeholder={lang === "VN" ? "Tất cả bến" : "All stations"}
                searchPlaceholder={lang === "VN" ? "Tìm mã / tên bến..." : "Search station..."}
                emptyLabel={lang === "VN" ? "Không có bến" : "No stations"}
                className={filterInputStyle}
              />
            </div>
          ) : null}
          <div className="min-w-45 flex-1 max-w-xs">
            <label className={labelStyle}>{lang === "VN" ? "Tìm kiếm" : "Search"}</label>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAdminBoatManage
                  ? (lang === "VN" ? "Tên NV, mã tàu..." : "Staff, boat code...")
                  : (lang === "VN" ? "Tên NV, bến..." : "Staff, station...")
              }
              className={filterInputStyle}
            />
          </div>
        </div>
      </div>

      {displayMode === "schedule" ? (
        <StaffAssignmentCalendar
          lang={lang}
          assignments={visibleAssignments}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          layout={calendarLayout}
          showLayoutToggle={false}
          anchorDate={anchorDate}
          onAnchorChange={setAnchorDate}
          isLoading={isLoading}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-220">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                  <th className="py-4 px-5">{lang === "VN" ? "Nhân viên / lịch" : "Staff / schedule"}</th>
                  <th className="py-4 px-4">{lang === "VN" ? "Loại NV" : "Staff type"}</th>
                  {!isAdminBoatManage ? (
                    <th className="py-4 px-4">{lang === "VN" ? "Phạm vi" : "Scope"}</th>
                  ) : null}
                  <th className="py-4 px-4">
                    {isAdminBoatManage
                      ? (lang === "VN" ? "Tàu" : "Boat")
                      : (lang === "VN" ? "Bến" : "Station")}
                  </th>
                  <th className="py-4 px-4">{lang === "VN" ? "Khoảng ngày" : "Date range"}</th>
                  <th className="py-4 px-4 text-center">{lang === "VN" ? "Số ca" : "Shifts"}</th>
                  <th className="py-4 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                  <th className="py-4 px-5 text-center">{lang === "VN" ? "Hành động" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300">
                {isLoading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-16 text-center">
                      <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : assignmentGroups.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-14 text-center text-slate-400 font-bold">
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
                  assignmentGroups.map((group) => {
                    const targetLabel =
                      group.assignmentType === ASSIGNMENT_TYPE.BOAT
                        ? group.boat
                          ? `${group.boat.boatCode || ""} · ${group.boat.boatName || ""}`.trim()
                          : "—"
                        : group.station
                          ? `${group.station.stationCode || ""} · ${group.station.stationName || ""}`.trim()
                          : "—";
                    const expanded = expandedListGroups.has(group.key);
                    const canMutateAny = group.items.some((row) => canMutateAssignment(row) && !isAssignmentInactive(row.status));
                    return (
                      <Fragment key={group.key}>
                        <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                          <td className="py-3.5 px-5">
                            <button
                              type="button"
                              onClick={() => toggleListGroup(group.key)}
                              className="flex items-center gap-2 text-left"
                            >
                              <span className="material-symbols-outlined text-base text-slate-400">
                                {expanded ? "expand_more" : "chevron_right"}
                              </span>
                              <span>
                                <p className="font-bold text-slate-800 dark:text-white">{group.staffName}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {lang === "VN" ? "Bấm để xem từng ngày" : "Click to see each day"}
                                </p>
                              </span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4">{group.staffType || "—"}</td>
                          {!isAdminBoatManage ? (
                            <td className="py-3.5 px-4">
                              <span className="font-headline font-black text-[10px] uppercase tracking-wide">
                                {labelAssignmentType(group.assignmentType, lang)}
                              </span>
                            </td>
                          ) : null}
                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                            {targetLabel || "—"}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap font-semibold">
                            {formatDateShort(group.firstStart)}
                            <span className="mx-1 text-slate-300">→</span>
                            {formatDateShort(group.lastEnd)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 font-headline font-black text-[#124757] dark:text-yellow-400">
                              {group.items.length}
                            </span>
                            {(group.activeCount > 0 || group.upcomingCount > 0) && (
                              <p className="text-[10px] text-slate-400 mt-1">
                                {group.activeCount > 0
                                  ? `${group.activeCount} ${lang === "VN" ? "đang diễn ra" : "active"}`
                                  : `${group.upcomingCount} ${lang === "VN" ? "sắp tới" : "upcoming"}`}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusTone(group.status)}`}
                            >
                              {labelAssignmentStatus(group.status, lang)}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleListGroup(group.key)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-headline font-black uppercase tracking-wider hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                            >
                              {expanded
                                ? (lang === "VN" ? "Thu gọn" : "Collapse")
                                : (lang === "VN" ? "Xem ca" : "View shifts")}
                            </button>
                            {!canMutateAny && (
                              <p className="mt-1 text-[10px] font-bold uppercase text-slate-300 tracking-wider">
                                {lang === "VN" ? "Chỉ xem" : "View only"}
                              </p>
                            )}
                          </td>
                        </tr>
                        {expanded
                          ? group.items.map((row) => {
                            const busy = processingId === row.assignmentId;
                            const canMutate = canMutateAssignment(row);
                            const shift = resolveShiftState(row);
                            return (
                              <tr
                                key={row.assignmentId}
                                className="bg-slate-50/70 dark:bg-slate-900/30"
                              >
                                <td className="py-2.5 pl-14 pr-5" colSpan={isAdminBoatManage ? 3 : 4}>
                                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                    {formatDateShort(row.startAt)}
                                    <span className="mx-1.5 font-medium text-slate-400">
                                      {formatDateTime(row.startAt, lang).split(", ").pop()
                                        || formatDateTime(row.startAt, lang).split(" ").slice(-1)[0]}
                                      {" → "}
                                      {formatDateTime(row.endAt, lang).split(", ").pop()
                                        || formatDateTime(row.endAt, lang).split(" ").slice(-1)[0]}
                                    </span>
                                  </p>
                                </td>
                                <td className="py-2.5 px-4 text-center" colSpan={2}>
                                  {shift ? (
                                    <span
                                      className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-headline font-black uppercase tracking-wide border ${shiftStateTone(shift)}`}
                                    >
                                      {labelShiftState(shift, lang)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-5">
                                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                                    {canMutate && !isAssignmentInactive(row.status) ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => openReplace(row)}
                                          className="px-3 py-1.5 rounded-xl border border-sky-200 text-sky-700 text-[10px] font-headline font-black uppercase tracking-wider hover:bg-sky-600 hover:text-white disabled:opacity-50 dark:border-sky-500/30 dark:text-sky-300"
                                        >
                                          {lang === "VN" ? "Thay NV" : "Replace"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => handleCancel(row)}
                                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-500 text-[10px] font-headline font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white disabled:opacity-50 dark:border-rose-500/30"
                                        >
                                          {busy ? "…" : lang === "VN" ? "Hủy ca" : "Cancel"}
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase text-slate-300 dark:text-slate-600 tracking-wider">
                                        {lang === "VN" ? "Chỉ xem" : "View only"}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                          : null}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg max-h-[min(92vh,720px)] rounded-4xl border border-slate-100 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Xếp lịch làm việc" : "Schedule a shift"}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="w-9 h-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-5 py-4">
                {createError && (
                  <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
                    {createError}
                  </div>
                )}

                <div>
                  <label className={labelStyle}>
                    {lang === "VN" ? "Vị trí công việc (*)" : "Work location (*)"}
                  </label>
                  {(() => {
                    const createTypeOptions = [
                      ...(canCreateBoat
                        ? [{
                          value: ASSIGNMENT_TYPE.BOAT,
                          label: lang === "VN" ? "Trên tàu" : "On boat",
                        }]
                        : []),
                      ...(canCreateStation
                        ? [{
                          value: ASSIGNMENT_TYPE.STATION,
                          label: lang === "VN" ? "Tại bến" : "At station",
                        }]
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
                              className={`h-10 rounded-lg text-[11px] font-headline font-black uppercase tracking-wider transition-all ${selected
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
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-500/20 dark:bg-sky-500/10">
                  <p className="text-[10px] font-headline font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    {lang === "VN" ? "Giờ làm việc" : "Working hours"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-sky-800 dark:text-sky-200">
                    {FULL_DAY_START_TIME} → {FULL_DAY_END_TIME}
                  </p>
                </div>

                <div>
                  <label className={labelStyle}>
                    {createForm.assignmentType === ASSIGNMENT_TYPE.BOAT
                      ? lang === "VN"
                        ? "Nhân viên tàu (*)"
                        : "Boat crew (*)"
                      : lang === "VN"
                        ? "Nhân viên bến (*)"
                        : "Station staff (*)"}
                  </label>
                  <FormSelect
                    required
                    value={createForm.staffUserId}
                    onChange={(value) => handleCreateField("staffUserId", String(value ?? ""))}
                    options={staffOptionsForCreate
                      .map((s) => ({
                        value: getStaffId(s),
                        label: getStaffName(s),
                      }))
                      .filter((o) => o.value)}
                    searchable
                    placeholder={lang === "VN" ? "-- Chọn nhân viên --" : "-- Select staff --"}
                    searchPlaceholder={lang === "VN" ? "Tìm tên nhân viên..." : "Search staff..."}
                    emptyLabel={lang === "VN" ? "Không có nhân viên" : "No staff"}
                    className={inputStyle}
                  />
                </div>

                {createForm.assignmentType === ASSIGNMENT_TYPE.BOAT ? (
                  <div>
                    <label className={labelStyle}>
                      {lang === "VN" ? "Tàu được gán (*)" : "Assigned boat (*)"}
                    </label>
                    <FormSelect
                      required
                      value={createForm.boatId}
                      onChange={(value) => handleCreateField("boatId", String(value ?? ""))}
                      options={boats
                        .map((b) => ({
                          value: getBoatId(b),
                          label: `${b.boatCode || b.code} · ${b.boatName || b.name}`,
                        }))
                        .filter((o) => o.value)}
                      searchable
                      placeholder={lang === "VN" ? "-- Chọn tàu --" : "-- Select boat --"}
                      searchPlaceholder={lang === "VN" ? "Tìm mã / tên tàu..." : "Search boat..."}
                      emptyLabel={lang === "VN" ? "Không có tàu" : "No boats"}
                      className={inputStyle}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelStyle}>{lang === "VN" ? "Bến làm việc (*)" : "Work station (*)"}</label>
                      <div className={`${inputStyle} flex items-center gap-2 font-bold text-[#124757] dark:text-yellow-400`}>
                        {!createForm.staffUserId
                          ? (lang === "VN" ? "-- Chọn nhân viên trước --" : "-- Select staff first --")
                          : isLoadingStaffStation
                            ? (lang === "VN" ? "Đang tải..." : "Loading...")
                            : createForm.stationId
                              ? stationLabelById.get(String(createForm.stationId)) || createForm.stationId
                              : (lang === "VN" ? "Nhân viên chưa được gắn bến." : "Staff has no station assigned.")}
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>{lang === "VN" ? "Chuyến (*)" : "Trip (*)"}</label>
                      <FormSelect
                        required
                        value={createForm.tripId}
                        onChange={(value) => handleCreateField("tripId", String(value ?? ""))}
                        options={gateTrips.map((t) => ({
                          value: String(t.tripId || t.id || ""),
                          label: `${t.tripCode || t.tripId} · ${t.routeName || t.routeCode || ""}`.trim(),
                        })).filter((o) => o.value)}
                        searchable
                        disabled={isLoadingGateTrips || !createForm.fromDate}
                        placeholder={lang === "VN" ? "-- Chọn chuyến --" : "-- Select trip --"}
                        emptyLabel={lang === "VN" ? "Không có chuyến" : "No trips"}
                        className={inputStyle}
                      />
                    </div>
                    <div>
                      <label className={labelStyle}>
                        {lang === "VN" ? "Điểm dừng quét vé (*)" : "Ticket scan stop (*)"}
                      </label>
                      <FormSelect
                        required
                        value={createForm.tripStopId}
                        onChange={(value) => handleCreateField("tripStopId", String(value ?? ""))}
                        options={gateStops.map((s) => {
                          const id = String(s.tripStopId || s.id || s.stopId || "");
                          const order = s.stopOrder ?? s.order ?? "";
                          const name = s.stationName || s.station?.stationName || s.stationCode || "";
                          return {
                            value: id,
                            label: `#${order} · ${name}`.trim(),
                          };
                        }).filter((o) => o.value)}
                        searchable
                        disabled={isLoadingGateStops || !createForm.tripId}
                        placeholder={lang === "VN" ? "-- Chọn điểm dừng --" : "-- Select stop --"}
                        emptyLabel={lang === "VN" ? "Không có điểm dừng" : "No stops"}
                        className={inputStyle}
                      />
                      <p className="mt-1 text-[10px] text-slate-400">
                        {lang === "VN"
                          ? "Chọn điểm dừng nhân viên sẽ đứng quét vé cho khách."
                          : "Pick the stop where staff will scan passenger tickets."}
                      </p>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelStyle}>{lang === "VN" ? "Từ ngày (*)" : "Start date (*)"}</label>
                    <AppDateInput
                      required
                      value={createForm.fromDate}
                      onChange={(e) => handleCreateField("fromDate", e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className={labelStyle}>{lang === "VN" ? "Đến ngày (*)" : "End date (*)"}</label>
                    <AppDateInput
                      required
                      value={createForm.toDate}
                      onChange={(e) => handleCreateField("toDate", e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelStyle}>
                    {lang === "VN" ? "Làm những thứ nào" : "Which weekdays"}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS_OF_WEEK.map((day) => {
                      const selected = (createForm.daysOfWeek || []).includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => {
                            const prev = Array.isArray(createForm.daysOfWeek) ? createForm.daysOfWeek : [];
                            const next = selected
                              ? prev.filter((d) => d !== day.value)
                              : [...prev, day.value].sort((a, b) => a - b);
                            handleCreateField("daysOfWeek", next);
                          }}
                          className={`min-w-[2.4rem] h-9 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider border transition ${selected
                            ? "bg-[#124757] text-white border-[#124757] dark:bg-yellow-400 dark:text-slate-900 dark:border-yellow-400"
                            : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:border-slate-700"
                            }`}
                        >
                          {lang === "VN" ? day.labelVn : day.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl shadow-md hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  {lang === "VN" ? "Xác nhận xếp lịch" : "Confirm schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {replaceForm.assignmentId ? (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleReplaceSubmit}
            className="bg-white dark:bg-slate-800 w-full max-w-md rounded-4xl border border-slate-100 dark:border-slate-700 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-black text-sm uppercase tracking-wider text-[#124757] dark:text-yellow-400">
                {lang === "VN" ? "Thay nhân viên" : "Replace staff"}
              </h3>
              <button
                type="button"
                onClick={() => setReplaceForm({ assignmentId: "", staffName: "", staffUserId: "", reason: "" })}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {replaceError ? (
              <div className="bg-red-50 dark:bg-red-500/10 text-red-600 p-3 rounded-xl text-xs font-bold border border-red-100">
                {replaceError}
              </div>
            ) : null}
            <p className="text-xs font-semibold text-slate-500">
              {lang === "VN" ? "Ca hiện tại" : "Current"}: {replaceForm.staffName || "—"}
            </p>
            <p className="text-[10px] text-slate-400">
              {lang === "VN"
                ? "Ca cũ chuyển Replaced — nhân viên cũ không còn thấy ca/chuyến."
                : "Old shift becomes Replaced — previous staff no longer sees it."}
            </p>
            <label className="block space-y-1.5">
              <span className={labelStyle}>{lang === "VN" ? "Nhân viên mới (*)" : "New staff (*)"}</span>
              <FormSelect
                required
                value={replaceForm.staffUserId}
                onChange={(value) => setReplaceForm((prev) => ({ ...prev, staffUserId: String(value ?? "") }))}
                options={staffOptionsForCreate
                  .map((s) => ({
                    value: getStaffId(s),
                    label: getStaffName(s),
                  }))
                  .filter((o) => o.value)}
                searchable
                placeholder={lang === "VN" ? "-- Chọn nhân viên --" : "-- Select staff --"}
                searchPlaceholder={lang === "VN" ? "Tìm tên nhân viên..." : "Search staff..."}
                emptyLabel={lang === "VN" ? "Không có nhân viên" : "No staff"}
                className={inputStyle}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelStyle}>{lang === "VN" ? "Lý do thay (*)" : "Reason (*)"}</span>
              <input
                type="text"
                required
                value={replaceForm.reason}
                onChange={(e) => setReplaceForm((prev) => ({ ...prev, reason: e.target.value }))}
                className={inputStyle}
                placeholder={lang === "VN" ? "VD: Nghỉ đột xuất" : "e.g. Sudden leave"}
              />
            </label>
            <button
              type="submit"
              disabled={isReplacing}
              className="w-full bg-sky-600 text-white font-headline font-black uppercase text-xs tracking-wider py-3.5 rounded-xl hover:brightness-110 disabled:opacity-50"
            >
              {isReplacing
                ? "…"
                : (lang === "VN" ? "Xác nhận thay" : "Confirm replace")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
