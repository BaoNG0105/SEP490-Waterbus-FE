import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { useApp } from "../context/AppContext";
import { fetchStaffUsers } from "../services/userService";
import {
  fetchBoatCrewAssignments,
  assignBoatCrew,
  removeBoatCrewAssignment,
  fetchBoatCrewReplacements,
  createBoatCrewReplacement,
  removeBoatCrewReplacement,
  fetchBoatCrewCalendar,
} from "../services/boatService";

const CREW_ROLE_OPTIONS = ["Captain", "Deckhand"];
const CREW_ROLE_LABELS = {
  Captain: { vn: "Thuyền trưởng", en: "Captain" },
  Deckhand: { vn: "Thủy thủ", en: "Deck hand" },
};

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const normalizeCrew = (item) => ({
  assignmentId: String(pick(item, ["assignmentId", "id", "crewAssignmentId"], "")),
  staffUserId: String(pick(item, ["staffUserId", "staffId", "userId", "staff.id"], "")),
  staffName: pick(item, ["staffName", "staff.fullName", "staff.name", "fullName"], "--"),
  crewRole: pick(item, ["crewRole", "dutyRole", "role"], ""),
  fromDate: pick(item, ["fromDate"], ""),
  toDate: pick(item, ["toDate"], ""),
});

const normalizeReplacement = (item) => ({
  replacementId: String(pick(item, ["replacementId", "id"], "")),
  crewRole: pick(item, ["crewRole", "role"], ""),
  replacedStaffUserId: String(pick(item, ["replacedStaffUserId"], "")),
  replacedStaffName: pick(item, ["replacedStaffName", "replacedStaff.fullName"], "--"),
  replacementStaffUserId: String(pick(item, ["replacementStaffUserId"], "")),
  replacementStaffName: pick(item, ["replacementStaffName", "replacementStaff.fullName"], "--"),
  fromDate: pick(item, ["fromDate"], ""),
  toDate: pick(item, ["toDate"], ""),
  reason: pick(item, ["reason"], ""),
});

const getStaffType = (staff) =>
  String(pick(staff?.raw || staff, ["staffType", "staff_type"], "")).toLowerCase();

const isStaffActive = (staff) => {
  const status = String(pick(staff?.raw || staff, ["status", "accountStatus"], "")).toLowerCase();
  if (pick(staff?.raw || staff, ["isActive"], null) === false) return false;
  if (!status) return true;
  return status === "active";
};

const getInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const formatDate = (value, lang) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB");
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (year, monthIndex, day) => `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

const getMonthRange = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  const monthIndex = month - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    year,
    monthIndex,
    lastDay,
    fromDate: toISODate(year, monthIndex, 1),
    toDate: toISODate(year, monthIndex, lastDay),
  };
};

// Lưới ngày, tuần bắt đầu từ Thứ 2
const buildMonthCells = (monthValue) => {
  const { year, monthIndex, lastDay } = getMonthRange(monthValue);
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7; // 0 = Mon
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= lastDay; d += 1) cells.push(toISODate(year, monthIndex, d));
  return cells;
};

const normalizeCalendarByDate = (list) => {
  const map = new Map();
  const addEntry = (date, entry) => {
    if (!date) return;
    const key = String(date).slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };

  (Array.isArray(list) ? list : []).forEach((item) => {
    const date = pick(item, ["date", "workingDate", "day"], "");
    const members = pick(item, ["crew", "assignments", "members", "staff"], null);
    if (Array.isArray(members)) {
      members.forEach((m) => addEntry(date, {
        staffName: pick(m, ["staffName", "fullName", "staff.fullName"], "--"),
        crewRole: pick(m, ["crewRole", "role"], ""),
        isReplacement: Boolean(pick(m, ["isReplacement"], false)),
        replacedStaffName: pick(m, ["replacedStaffName"], ""),
      }));
    } else {
      addEntry(date, {
        staffName: pick(item, ["staffName", "fullName"], "--"),
        crewRole: pick(item, ["crewRole", "role"], ""),
        isReplacement: Boolean(pick(item, ["isReplacement"], false)),
        replacedStaffName: pick(item, ["replacedStaffName"], ""),
      });
    }
  });
  return map;
};

const WEEKDAY_LABELS = {
  vn: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const inputStyle = "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400 shadow-inner transition-all";
const labelStyle = "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 block";

function StaffSelect({ options, value, onChange, placeholder, lang }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  const selected = options.find((o) => o.id === value) || null;
  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? options.filter((o) =>
        o.fullName.toLowerCase().includes(keyword) ||
        (o.phone || "").toLowerCase().includes(keyword) ||
        (o.email || "").toLowerCase().includes(keyword))
    : options;

  const close = () => {
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left text-sm font-bold outline-none transition-all dark:bg-slate-900 ${
          isOpen
            ? "border-[#124757] ring-2 ring-[#124757]/15 dark:border-yellow-400 dark:ring-yellow-400/20"
            : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`min-w-0 truncate ${selected ? "text-slate-800 dark:text-white" : "text-slate-400"}`}>
          {selected ? selected.fullName : placeholder}
        </span>
        <span className={`material-symbols-outlined shrink-0 text-xl text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "VN" ? "Tìm tên, SĐT, email..." : "Search name, phone, email..."}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#124757] focus:ring-2 focus:ring-[#124757]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1.5" role="listbox">
            {filtered.length > 0 ? filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  close();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                role="option"
                aria-selected={o.id === value}
              >
                <span className="w-8 h-8 rounded-full bg-[#124757]/10 dark:bg-yellow-400/10 text-[#124757] dark:text-yellow-400 flex items-center justify-center text-[11px] font-black shrink-0">
                  {getInitials(o.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800 dark:text-white truncate">{o.fullName}</span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {[o.phone, o.email].filter(Boolean).join(" · ") || (lang === "VN" ? "Không có liên hệ" : "No contact")}
                  </span>
                </span>
              </button>
            )) : (
              <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                {lang === "VN" ? "Không có nhân viên" : "No staff"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BoatStaffAssignmentPanel({ boatId, boatCode }) {
  const { lang } = useApp();
  const [staffOptions, setStaffOptions] = useState([]);
  const [crew, setCrew] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Thêm crew mặc định
  const [crewStaffId, setCrewStaffId] = useState("");
  const [crewRole, setCrewRole] = useState(CREW_ROLE_OPTIONS[0]);
  const [crewFromDate, setCrewFromDate] = useState("");
  const [crewToDate, setCrewToDate] = useState("");
  const [isSavingCrew, setIsSavingCrew] = useState(false);
  const [removingCrewId, setRemovingCrewId] = useState(null);

  // Thay thế
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [repRole, setRepRole] = useState(CREW_ROLE_OPTIONS[0]);
  const [repReplacedId, setRepReplacedId] = useState("");
  const [repReplacementId, setRepReplacementId] = useState("");
  const [repFromDate, setRepFromDate] = useState("");
  const [repToDate, setRepToDate] = useState("");
  const [repReason, setRepReason] = useState("");
  const [isSavingRep, setIsSavingRep] = useState(false);
  const [cancelingRepId, setCancelingRepId] = useState(null);

  // Lịch tháng
  const [viewMode, setViewMode] = useState("list");
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue());
  const [calendarMap, setCalendarMap] = useState(new Map());
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");

  const roleLabel = (role) => (lang === "VN" ? CREW_ROLE_LABELS[role]?.vn : CREW_ROLE_LABELS[role]?.en) || role;

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const [staff, crewList, repList] = await Promise.all([
        fetchStaffUsers(),
        fetchBoatCrewAssignments(boatId).catch((e) => {
          if (e.response?.status === 404) return [];
          throw e;
        }),
        fetchBoatCrewReplacements(boatId).catch(() => []),
      ]);
      setStaffOptions(staff || []);
      setCrew((crewList || []).map(normalizeCrew));
      setReplacements((repList || []).map(normalizeReplacement));
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error.response?.data?.message ||
          (lang === "VN" ? "Không tải được dữ liệu crew." : "Failed to load crew data.")
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (boatId) loadData();
  }, [boatId]);

  useEffect(() => {
    if (viewMode !== "calendar" || !boatId) return;
    let active = true;
    const { fromDate, toDate } = getMonthRange(monthValue);
    setIsCalendarLoading(true);
    setSelectedDate("");
    fetchBoatCrewCalendar(boatId, fromDate, toDate)
      .then((data) => {
        if (active) setCalendarMap(normalizeCalendarByDate(data));
      })
      .catch((error) => {
        console.error(error);
        if (active) setCalendarMap(new Map());
      })
      .finally(() => {
        if (active) setIsCalendarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewMode, monthValue, boatId]);

  // Nhân viên OnBoard + Active
  const onboardStaff = useMemo(() => {
    const hasStaffType = staffOptions.some((s) => getStaffType(s));
    return staffOptions.filter((s) => {
      if (!isStaffActive(s)) return false;
      if (!hasStaffType) return true;
      return getStaffType(s) === "onboard";
    });
  }, [staffOptions]);

  const activeCrewStaffIds = useMemo(() => new Set(crew.map((c) => c.staffUserId)), [crew]);

  // Chọn thêm crew: loại người đã trong crew
  const crewSelectOptions = useMemo(
    () => onboardStaff.filter((s) => !activeCrewStaffIds.has(s.id)),
    [onboardStaff, activeCrewStaffIds]
  );

  // Người bị thay: lấy từ crew hiện tại
  const replacedOptions = useMemo(
    () => crew.map((c) => ({ id: c.staffUserId, fullName: `${c.staffName} (${roleLabel(c.crewRole)})`, phone: "", email: "" })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crew, lang]
  );

  // Người thay: staff OnBoard không phải người bị thay
  const replacementOptions = useMemo(
    () => onboardStaff.filter((s) => s.id !== repReplacedId),
    [onboardStaff, repReplacedId]
  );

  const handleAddCrew = async () => {
    if (!crewStaffId || !crewFromDate) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing info",
        text: lang === "VN" ? "Chọn nhân viên và ngày bắt đầu." : "Select a staff and a start date.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    if (crewToDate && crewToDate < crewFromDate) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Ngày không hợp lệ" : "Invalid dates",
        text: lang === "VN" ? "Ngày kết thúc phải sau ngày bắt đầu." : "End date must be after start date.",
        confirmButtonColor: "#124757",
      });
      return;
    }

    try {
      setIsSavingCrew(true);
      await assignBoatCrew(boatId, {
        staffUserId: crewStaffId,
        crewRole,
        fromDate: crewFromDate,
        toDate: crewToDate || null,
      });
      setCrewStaffId("");
      setCrewToDate("");
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã thêm crew" : "Crew added", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Thêm crew thất bại" : "Add crew failed", text: error.response?.data?.message || (lang === "VN" ? "Không thể thêm crew." : "Could not add crew."), confirmButtonColor: "#124757" });
    } finally {
      setIsSavingCrew(false);
    }
  };

  const startReplacement = (c) => {
    setRepRole(c.crewRole || CREW_ROLE_OPTIONS[0]);
    setRepReplacedId(c.staffUserId);
    setRepReplacementId("");
    setRepFromDate("");
    setRepToDate("");
    setRepReason("");
    setShowReplaceForm(true);
    if (typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        document.getElementById("boat-crew-replacement-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const handleRemoveCrew = async (c) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: lang === "VN" ? "Gỡ crew?" : "Remove crew?",
      text: lang === "VN" ? `Gỡ ${c.staffName} khỏi tàu ${boatCode}?` : `Remove ${c.staffName} from boat ${boatCode}?`,
      showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Gỡ" : "Remove", cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!confirm.isConfirmed) return;
    try {
      setRemovingCrewId(c.assignmentId);
      await removeBoatCrewAssignment(boatId, c.assignmentId);
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã gỡ crew" : "Crew removed", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Gỡ thất bại" : "Remove failed", text: error.response?.data?.message || "", confirmButtonColor: "#124757" });
    } finally {
      setRemovingCrewId(null);
    }
  };

  const handleAddReplacement = async () => {
    if (!repReplacedId || !repReplacementId || !repFromDate || !repToDate || !repReason.trim()) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Thiếu thông tin" : "Missing info",
        text: lang === "VN" ? "Nhập đủ người bị thay, người thay, thời gian và lý do." : "Fill replaced/replacement staff, period and reason.",
        confirmButtonColor: "#124757",
      });
      return;
    }
    if (repToDate < repFromDate) {
      Swal.fire({ icon: "warning", title: lang === "VN" ? "Ngày không hợp lệ" : "Invalid dates", text: lang === "VN" ? "Ngày kết thúc phải sau ngày bắt đầu." : "End date must be after start date.", confirmButtonColor: "#124757" });
      return;
    }

    try {
      setIsSavingRep(true);
      await createBoatCrewReplacement(boatId, {
        crewRole: repRole,
        replacedStaffUserId: repReplacedId,
        replacementStaffUserId: repReplacementId,
        fromDate: repFromDate,
        toDate: repToDate,
        reason: repReason.trim(),
      });
      setShowReplaceForm(false);
      setRepReplacedId("");
      setRepReplacementId("");
      setRepFromDate("");
      setRepToDate("");
      setRepReason("");
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã tạo thay thế" : "Replacement created", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Tạo thay thế thất bại" : "Create failed", text: error.response?.data?.message || "", confirmButtonColor: "#124757" });
    } finally {
      setIsSavingRep(false);
    }
  };

  const handleCancelReplacement = async (r) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: lang === "VN" ? "Hủy thay thế?" : "Cancel replacement?",
      text: lang === "VN" ? `Hủy thay thế ${r.replacementStaffName}?` : `Cancel replacement ${r.replacementStaffName}?`,
      showCancelButton: true, confirmButtonColor: "#d33", cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Hủy thay thế" : "Cancel it", cancelButtonText: lang === "VN" ? "Đóng" : "Close",
    });
    if (!confirm.isConfirmed) return;
    try {
      setCancelingRepId(r.replacementId);
      await removeBoatCrewReplacement(boatId, r.replacementId);
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã hủy thay thế" : "Replacement canceled", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Hủy thất bại" : "Cancel failed", text: error.response?.data?.message || "", confirmButtonColor: "#124757" });
    } finally {
      setCancelingRepId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 w-full">
        <div className="w-10 h-10 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-headline font-black text-sm text-[#124757] dark:text-yellow-400 uppercase tracking-wider">
              {lang === "VN" ? "Crew mặc định của tàu" : "Default Boat Crew"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "VN"
                ? "Gán nhân viên OnBoard làm dài hạn (theo ngày bắt đầu/kết thúc), không cần setup từng ngày. Có người nghỉ thì tạo bản thay thế."
                : "Assign OnBoard staff long-term (from/to date). Create a replacement when someone is off."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-sm">groups</span>
            {crew.length} crew
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all inline-flex items-center gap-1.5 ${
              viewMode === "list"
                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <span className="material-symbols-outlined text-sm">list</span>
            {lang === "VN" ? "Danh sách" : "List"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("calendar")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all inline-flex items-center gap-1.5 ${
              viewMode === "calendar"
                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                : "bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            {lang === "VN" ? "Lịch tháng" : "Calendar"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20 shadow-sm">
          {errorMsg}
        </div>
      )}

      {viewMode === "calendar" ? (
        <CrewCalendarView
          lang={lang}
          monthValue={monthValue}
          setMonthValue={setMonthValue}
          calendarMap={calendarMap}
          isLoading={isCalendarLoading}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          roleLabel={roleLabel}
        />
      ) : (
      <>
      {/* Danh sách crew mặc định */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        {crew.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">group_off</span>
            <p className="text-xs font-bold text-slate-400">{lang === "VN" ? "Chưa có crew mặc định." : "No default crew yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {crew.map((c) => (
              <div key={c.assignmentId || c.staffUserId} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center font-headline font-black text-xs shrink-0">
                    {getInitials(c.staffName)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-headline font-black text-slate-800 dark:text-white truncate">{c.staffName}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/10 dark:text-yellow-300">
                        {roleLabel(c.crewRole)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[13px]">event</span>
                        {formatDate(c.fromDate, lang)} → {c.toDate ? formatDate(c.toDate, lang) : (lang === "VN" ? "dài hạn" : "long-term")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startReplacement(c)}
                    className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wide hover:bg-amber-100 transition-all inline-flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">swap_horiz</span>
                    {lang === "VN" ? "Thay thế" : "Replace"}
                  </button>
                  <button
                    type="button"
                    disabled={removingCrewId === c.assignmentId}
                    onClick={() => handleRemoveCrew(c)}
                    className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold uppercase tracking-wide hover:bg-red-100 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {removingCrewId === c.assignmentId ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-sm">person_remove</span>
                    )}
                    {lang === "VN" ? "Gỡ" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thêm crew mặc định */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
        <h4 className="font-headline font-black text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          {lang === "VN" ? "Thêm crew mặc định" : "Add default crew"}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Nhiệm vụ" : "Role"}</label>
            <select value={crewRole} onChange={(e) => setCrewRole(e.target.value)} className={`${inputStyle} cursor-pointer`}>
              {CREW_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Từ ngày (*)" : "From date (*)"}</label>
            <input type="date" value={crewFromDate} onChange={(e) => setCrewFromDate(e.target.value)} className={inputStyle} />
          </div>
          <div>
            <label className={labelStyle}>{lang === "VN" ? "Đến ngày (để trống = dài hạn)" : "To date (empty = long-term)"}</label>
            <input type="date" value={crewToDate} onChange={(e) => setCrewToDate(e.target.value)} className={inputStyle} />
          </div>
        </div>
        <div>
          <label className={labelStyle}>{lang === "VN" ? "Chọn nhân viên OnBoard (*)" : "Select OnBoard staff (*)"}</label>
          <StaffSelect
            options={crewSelectOptions}
            value={crewStaffId}
            onChange={setCrewStaffId}
            placeholder={lang === "VN" ? "Chưa chọn nhân viên" : "No staff selected"}
            lang={lang}
          />
        </div>
        <button
          type="button"
          onClick={handleAddCrew}
          disabled={!crewStaffId || !crewFromDate || isSavingCrew}
          className="w-full py-3 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-headline font-black uppercase tracking-wider hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSavingCrew && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {lang === "VN" ? "Thêm crew" : "Add crew"}
        </button>
      </div>

      {/* Crew thay thế */}
      <div id="boat-crew-replacement-section" className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-headline font-black text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              {lang === "VN" ? "Crew thay thế tạm thời" : "Temporary replacements"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === "VN" ? "Dùng khi crew nghỉ phép, không sửa lịch gốc." : "Use when a crew is off; original roster stays intact."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowReplaceForm((v) => !v)}
            disabled={crew.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">{showReplaceForm ? "close" : "swap_horiz"}</span>
            {showReplaceForm ? (lang === "VN" ? "Đóng" : "Close") : (lang === "VN" ? "Tạo thay thế" : "Add replacement")}
          </button>
        </div>

        {replacements.length > 0 && (
          <div className="space-y-3">
            {replacements.map((r) => (
              <div key={r.replacementId} className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                    <span className="line-through text-slate-400">{r.replacedStaffName}</span>
                    {" → "}
                    <span className="text-[#124757] dark:text-yellow-300">{r.replacementStaffName}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{roleLabel(r.crewRole)}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-[13px]">event</span>
                      {formatDate(r.fromDate, lang)} → {formatDate(r.toDate, lang)}
                    </span>
                    {r.reason && <span className="text-[10px] text-slate-400 truncate">· {r.reason}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cancelingRepId === r.replacementId}
                  onClick={() => handleCancelReplacement(r)}
                  className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold uppercase tracking-wide hover:bg-red-100 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {cancelingRepId === r.replacementId ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-sm">undo</span>
                  )}
                  {lang === "VN" ? "Hủy" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        )}

        {showReplaceForm && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Người bị thay (*)" : "Replaced staff (*)"}</label>
                <StaffSelect
                  options={replacedOptions}
                  value={repReplacedId}
                  onChange={setRepReplacedId}
                  placeholder={lang === "VN" ? "Chọn từ crew" : "Choose from crew"}
                  lang={lang}
                />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Người thay (*)" : "Replacement staff (*)"}</label>
                <StaffSelect
                  options={replacementOptions}
                  value={repReplacementId}
                  onChange={setRepReplacementId}
                  placeholder={lang === "VN" ? "Chọn nhân viên" : "Choose staff"}
                  lang={lang}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Nhiệm vụ" : "Role"}</label>
                <select value={repRole} onChange={(e) => setRepRole(e.target.value)} className={`${inputStyle} cursor-pointer`}>
                  {CREW_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Từ ngày (*)" : "From date (*)"}</label>
                <input type="date" value={repFromDate} onChange={(e) => setRepFromDate(e.target.value)} className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle}>{lang === "VN" ? "Đến ngày (*)" : "To date (*)"}</label>
                <input type="date" value={repToDate} onChange={(e) => setRepToDate(e.target.value)} className={inputStyle} />
              </div>
            </div>
            <div>
              <label className={labelStyle}>{lang === "VN" ? "Lý do (*)" : "Reason (*)"}</label>
              <input value={repReason} onChange={(e) => setRepReason(e.target.value)} className={inputStyle} placeholder={lang === "VN" ? "VD: Nghỉ phép" : "e.g. On leave"} />
            </div>
            <button
              type="button"
              onClick={handleAddReplacement}
              disabled={isSavingRep}
              className="w-full py-2.5 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-headline font-black uppercase tracking-wider hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSavingRep && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {lang === "VN" ? "Tạo thay thế" : "Create replacement"}
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function CrewCalendarView({ lang, monthValue, setMonthValue, calendarMap, isLoading, selectedDate, setSelectedDate, roleLabel }) {
  const cells = buildMonthCells(monthValue);
  const weekdays = lang === "VN" ? WEEKDAY_LABELS.vn : WEEKDAY_LABELS.en;
  const selectedEntries = selectedDate ? (calendarMap.get(selectedDate) || []) : [];

  const shiftMonth = (delta) => {
    const [year, month] = monthValue.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    setMonthValue(`${next.getFullYear()}-${pad2(next.getMonth() + 1)}`);
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all"
        >
          <span className="material-symbols-outlined text-lg">chevron_left</span>
        </button>
        <input
          type="month"
          value={monthValue}
          onChange={(e) => setMonthValue(e.target.value || monthValue)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-black text-[#124757] dark:text-yellow-400 outline-none focus:ring-2 focus:ring-[#124757]/20"
        />
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-all"
        >
          <span className="material-symbols-outlined text-lg">chevron_right</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#124757] dark:bg-yellow-400" />{lang === "VN" ? "Có crew" : "Has crew"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />{lang === "VN" ? "Có người thay" : "Replacement"}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-8 h-8 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((w) => (
              <div key={w} className="text-center text-[10px] font-black uppercase text-slate-400 py-1">{w}</div>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <div key={`blank-${idx}`} />;
              const entries = calendarMap.get(date) || [];
              const hasReplacement = entries.some((e) => e.isReplacement);
              const dayNum = Number(date.slice(8, 10));
              const isSelected = selectedDate === date;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? "" : date)}
                  className={`aspect-square rounded-xl border p-1.5 flex flex-col items-center justify-start transition-all ${
                    isSelected
                      ? "border-[#124757] dark:border-yellow-400 ring-2 ring-[#124757]/15 dark:ring-yellow-400/20"
                      : "border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  } ${entries.length > 0 ? "bg-slate-50 dark:bg-slate-900" : ""}`}
                >
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{dayNum}</span>
                  {entries.length > 0 && (
                    <span className="mt-auto flex items-center gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${hasReplacement ? "bg-amber-500" : "bg-[#124757] dark:bg-yellow-400"}`} />
                      <span className="text-[9px] font-bold text-slate-400">{entries.length}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400">
                {new Date(selectedDate).toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
              {selectedEntries.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">{lang === "VN" ? "Không có crew ngày này." : "No crew on this day."}</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedEntries.map((e, i) => (
                    <div key={`${e.staffName}-${i}`} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${e.isReplacement ? "bg-amber-500" : "bg-[#124757] dark:bg-yellow-400"}`} />
                      <span className="font-bold text-slate-700 dark:text-slate-200">{e.staffName}</span>
                      {e.crewRole && <span className="text-slate-400">· {roleLabel(e.crewRole)}</span>}
                      {e.isReplacement && (
                        <span className="text-amber-600 dark:text-amber-300 font-bold">
                          ({lang === "VN" ? "thay" : "replacing"}{e.replacedStaffName ? ` ${e.replacedStaffName}` : ""})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
