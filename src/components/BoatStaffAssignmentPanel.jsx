import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { useApp } from "../context/AppContext";
import { fetchOnBoardStaffUsers } from "../services/userService";
import { getApiErrorMessage } from "../utils/apiError";
import {
  fetchBoatCrewAssignments,
  assignBoatCrew,
  removeBoatCrewAssignment,
  fetchBoatCrewReplacements,
  createBoatCrewReplacement,
  removeBoatCrewReplacement,
  fetchBoatCrewCalendar,
} from "../services/boatService";

const pick = (source, keys, fallback = "") => {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
};

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (year, monthIndex, day) => `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;

// BE DateOnly thường trả dd/MM/yyyy; input/calendar FE dùng yyyy-MM-dd
const toISODateString = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(raw);
  if (dmy) return `${dmy[3]}-${pad2(Number(dmy[2]))}-${pad2(Number(dmy[1]))}`;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return toISODate(date.getFullYear(), date.getMonth(), date.getDate());
  return "";
};

const normalizeCrew = (item) => ({
  assignmentId: String(pick(item, ["assignmentId", "id", "crewAssignmentId"], "")),
  staffUserId: String(pick(item, ["staffUserId", "staffId", "userId", "staff.id"], "")),
  staffName: pick(item, ["staffName", "staff.fullName", "staff.name", "fullName"], "--"),
  fromDate: toISODateString(pick(item, ["fromDate"], "")),
  toDate: toISODateString(pick(item, ["toDate"], "")),
});

const normalizeReplacement = (item) => ({
  replacementId: String(pick(item, ["replacementId", "id"], "")),
  replacedStaffUserId: String(pick(item, ["replacedStaffUserId"], "")),
  replacedStaffName: pick(item, ["replacedStaffName", "replacedStaff.fullName"], "--"),
  replacementStaffUserId: String(pick(item, ["replacementStaffUserId"], "")),
  replacementStaffName: pick(item, ["replacementStaffName", "replacementStaff.fullName"], "--"),
  fromDate: toISODateString(pick(item, ["fromDate"], "")),
  toDate: toISODateString(pick(item, ["toDate"], "")),
  reason: pick(item, ["reason"], ""),
});

const getStaffType = (staff) => {
  const raw = String(pick(staff?.raw || staff, ["staffType", "staff_type"], "")).toLowerCase().replace(/[_\s-]/g, "");
  if (raw === "2" || raw === "onboard") return "onboard";
  if (raw === "1" || raw === "ground") return "ground";
  return raw;
};

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
  const iso = toISODateString(value);
  if (!iso) return value || "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB");
};

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
    const date = toISODateString(pick(item, ["date", "workingDate", "day"], ""));
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
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
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
                <span className="shrink-0 rounded-md bg-teal-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                  {lang === "VN" ? "Trên tàu" : "Onboard"}
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
  const [crewFromDate, setCrewFromDate] = useState("");
  const [crewToDate, setCrewToDate] = useState("");
  const [isSavingCrew, setIsSavingCrew] = useState(false);
  const [removingCrewId, setRemovingCrewId] = useState(null);

  // Thay thế
  const [showReplaceForm, setShowReplaceForm] = useState(false);
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const [staff, crewList, repList] = await Promise.all([
        fetchOnBoardStaffUsers({ force: true }),
        fetchBoatCrewAssignments(boatId),
        fetchBoatCrewReplacements(boatId),
      ]);
      setStaffOptions(staff || []);
      setCrew((crewList || []).map(normalizeCrew));
      setReplacements((repList || []).map(normalizeReplacement));
    } catch (error) {
      console.error(error);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được danh sách nhân viên trên tàu." : "Failed to load onboard staff."
        )
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
    fetchBoatCrewCalendar(boatId, fromDate, toDate)
      .then((data) => {
        if (active) setCalendarMap(normalizeCalendarByDate(data));
      })
      .catch((error) => {
        console.error(error);
        if (active) {
          setCalendarMap(new Map());
          setErrorMsg(
            getApiErrorMessage(
              error,
              lang === "VN" ? "Không tải được lịch nhân viên trên tàu." : "Failed to load onboard staff calendar."
            )
          );
        }
      })
      .finally(() => {
        if (active) setIsCalendarLoading(false);
      });
    return () => {
      active = false;
    };
  }, [viewMode, monthValue, boatId, lang]);

  // Chỉ nhân viên trên tàu (staffType = OnBoard)
  const onboardStaff = useMemo(
    () => staffOptions.filter((s) => isStaffActive(s) && getStaffType(s) === "onboard"),
    [staffOptions]
  );

  const activeCrewStaffIds = useMemo(() => new Set(crew.map((c) => c.staffUserId)), [crew]);

  // Chọn thêm crew: loại người đã trong crew
  const crewSelectOptions = useMemo(
    () => onboardStaff.filter((s) => !activeCrewStaffIds.has(s.id)),
    [onboardStaff, activeCrewStaffIds]
  );

  // Người bị thay: lấy từ crew hiện tại
  const replacedOptions = useMemo(
    () => crew.map((c) => ({ id: c.staffUserId, fullName: c.staffName, phone: "", email: "" })),
    [crew]
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
    const selected = onboardStaff.find((s) => s.id === crewStaffId);
    if (!selected) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Sai loại nhân viên" : "Invalid staff type",
        text: lang === "VN"
          ? "Chỉ được gán nhân viên loại Trên tàu."
          : "Only onboard staff can be assigned.",
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
        fromDate: crewFromDate,
        toDate: crewToDate || null,
      });
      setCrewStaffId("");
      setCrewToDate("");
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã thêm nhân viên" : "Staff assigned", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: lang === "VN" ? "Thêm nhân viên thất bại" : "Assign staff failed",
        text: getApiErrorMessage(error, lang === "VN" ? "Không thể thêm nhân viên." : "Could not assign staff."),
        confirmButtonColor: "#124757",
      });
    } finally {
      setIsSavingCrew(false);
    }
  };

  const startReplacement = (c) => {
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
      icon: "question",
      title: lang === "VN" ? "Gỡ nhân viên khỏi tàu?" : "Remove staff from boat?",
      html: lang === "VN"
        ? `Bạn chắc chắn muốn gỡ <b>${c.staffName}</b> khỏi tàu <b>${boatCode || "—"}</b>?<br/><span style="color:#94a3b8;font-size:12px">Lịch mặc định của người này trên tàu sẽ bị gỡ.</span>`
        : `Remove <b>${c.staffName}</b> from boat <b>${boatCode || "—"}</b>?<br/><span style="color:#94a3b8;font-size:12px">Their default assignment on this boat will be removed.</span>`,
      showCancelButton: true,
      focusCancel: true,
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Xác nhận gỡ" : "Yes, remove",
      cancelButtonText: lang === "VN" ? "Không" : "No",
    });
    if (!confirm.isConfirmed) return;
    try {
      setRemovingCrewId(c.assignmentId);
      await removeBoatCrewAssignment(boatId, c.assignmentId);
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã gỡ nhân viên" : "Staff removed", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Gỡ thất bại" : "Remove failed", text: getApiErrorMessage(error), confirmButtonColor: "#124757" });
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
    if (!onboardStaff.some((s) => s.id === repReplacementId)) {
      Swal.fire({
        icon: "warning",
        title: lang === "VN" ? "Sai loại nhân viên" : "Invalid staff type",
        text: lang === "VN"
          ? "Người thay phải là nhân viên trên tàu."
          : "Replacement must be onboard staff.",
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
      Swal.fire({ icon: "error", title: lang === "VN" ? "Tạo thay thế thất bại" : "Create failed", text: getApiErrorMessage(error), confirmButtonColor: "#124757" });
    } finally {
      setIsSavingRep(false);
    }
  };

  const handleCancelReplacement = async (r) => {
    const confirm = await Swal.fire({
      icon: "question",
      title: lang === "VN" ? "Hủy lịch thay thế?" : "Cancel replacement schedule?",
      html: lang === "VN"
        ? `Bạn chắc chắn muốn hủy lịch thay thế của <b>${r.replacementStaffName}</b>${r.replacedStaffName ? ` (thay cho <b>${r.replacedStaffName}</b>)` : ""}?<br/><span style="color:#94a3b8;font-size:12px">Lịch mặc định gốc vẫn giữ nguyên.</span>`
        : `Cancel replacement for <b>${r.replacementStaffName}</b>${r.replacedStaffName ? ` (covering <b>${r.replacedStaffName}</b>)` : ""}?<br/><span style="color:#94a3b8;font-size:12px">The original default roster stays unchanged.</span>`,
      showCancelButton: true,
      focusCancel: true,
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#124757",
      confirmButtonText: lang === "VN" ? "Xác nhận hủy" : "Yes, cancel it",
      cancelButtonText: lang === "VN" ? "Giữ lại" : "Keep it",
    });
    if (!confirm.isConfirmed) return;
    try {
      setCancelingRepId(r.replacementId);
      await removeBoatCrewReplacement(boatId, r.replacementId);
      await loadData();
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: lang === "VN" ? "Đã hủy thay thế" : "Replacement canceled", showConfirmButton: false, timer: 1500 });
    } catch (error) {
      Swal.fire({ icon: "error", title: lang === "VN" ? "Hủy thất bại" : "Cancel failed", text: getApiErrorMessage(error), confirmButtonColor: "#124757" });
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
              {lang === "VN" ? "Nhân viên mặc định trên tàu" : "Default onboard staff"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "VN"
                ? "Gán nhân viên trên tàu theo khoảng ngày (để trống ngày kết thúc = dài hạn). Khi có người nghỉ, tạo lịch thay thế."
                : "Assign onboard staff by date range (blank end date = long-term). Create a replacement when someone is off."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined text-sm">groups</span>
            {crew.length} {lang === "VN" ? "người" : "staff"}
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
        />
      ) : (
      <>
      {/* Danh sách crew mặc định */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm">
        {crew.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">group_off</span>
            <p className="text-xs font-bold text-slate-400">{lang === "VN" ? "Chưa có nhân viên mặc định trên tàu." : "No default onboard staff yet."}</p>
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
                    className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wide hover:bg-amber-100 transition-all"
                  >
                    {lang === "VN" ? "Thay thế" : "Replace"}
                  </button>
                  <button
                    type="button"
                    disabled={removingCrewId === c.assignmentId}
                    onClick={() => handleRemoveCrew(c)}
                    className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold uppercase tracking-wide hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    {removingCrewId === c.assignmentId ? (
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      lang === "VN" ? "Gỡ" : "Remove"
                    )}
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
          {lang === "VN" ? "Thêm nhân viên mặc định" : "Add default onboard staff"}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <label className={labelStyle}>{lang === "VN" ? "Chọn nhân viên trên tàu (*)" : "Select onboard staff (*)"}</label>
          <StaffSelect
            options={crewSelectOptions}
            value={crewStaffId}
            onChange={setCrewStaffId}
            placeholder={
              onboardStaff.length === 0
                ? (lang === "VN" ? "Chưa có nhân viên trên tàu" : "No onboard staff yet")
                : (lang === "VN" ? "Chưa chọn nhân viên" : "No staff selected")
            }
            lang={lang}
          />
          {onboardStaff.length === 0 && (
            <p className="mt-2 text-[11px] font-bold text-amber-600 dark:text-amber-300">
              {lang === "VN"
                ? "Chưa có nhân viên trên tàu đang Active. Vào Quản lý người dùng → tạo/sửa Staff loại Trên tàu rồi quay lại."
                : "No active onboard staff. Create/edit a Staff user as Onboard, then return here."}
              {" "}
              <Link to="/admin/users-management/create" className="underline hover:opacity-80">
                {lang === "VN" ? "Tạo nhân viên" : "Create staff"}
              </Link>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddCrew}
          disabled={!crewStaffId || !crewFromDate || isSavingCrew || onboardStaff.length === 0}
          className="w-full py-3 rounded-xl bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 text-[11px] font-headline font-black uppercase tracking-wider hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSavingCrew && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {lang === "VN" ? "Thêm nhân viên" : "Add staff"}
        </button>
      </div>

      {/* Crew thay thế */}
      <div id="boat-crew-replacement-section" className="bg-white dark:bg-slate-800 p-5 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-headline font-black text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              {lang === "VN" ? "Nhân viên thay thế tạm thời" : "Temporary replacements"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === "VN" ? "Dùng khi nhân viên nghỉ phép, không sửa lịch gốc." : "Use when onboard staff is off; original roster stays intact."}
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
                  placeholder={lang === "VN" ? "Chọn từ danh sách trên tàu" : "Choose from onboard roster"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

function shortStaffName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0];
  // Giữ 2 phần cuối cho tên VN (VD: An Toan)
  return parts.slice(-2).join(" ");
}

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function openDayStaffPopup(lang, date, entries) {
  const title = new Date(`${date}T00:00:00`).toLocaleDateString(
    lang === "VN" ? "vi-VN" : "en-GB",
    { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }
  );

  if (!entries.length) {
    Swal.fire({
      icon: "info",
      title,
      text: lang === "VN" ? "Không có nhân viên ngày này." : "No staff on this day.",
      confirmButtonColor: "#124757",
    });
    return;
  }

  const rows = entries.map((e) => {
    const badge = e.isReplacement
      ? `<span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:6px;background:#fff7ed;color:#c2410c;font-size:10px;font-weight:800;text-transform:uppercase">${lang === "VN" ? "Thay thế" : "Replacement"}</span>`
      : `<span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:6px;background:#ecfdf5;color:#0f766e;font-size:10px;font-weight:800;text-transform:uppercase">${lang === "VN" ? "Mặc định" : "Default"}</span>`;
    const replaced = e.isReplacement && e.replacedStaffName
      ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${lang === "VN" ? "Thay cho" : "Replacing"}: <b>${escapeHtml(e.replacedStaffName)}</b></div>`
      : "";
    const role = e.crewRole
      ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${lang === "VN" ? "Vai trò" : "Role"}: ${escapeHtml(e.crewRole)}</div>`
      : "";
    return `<div style="text-align:left;padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;background:#f8fafc">
      <div style="font-weight:800;color:#0f172a;font-size:13px">${escapeHtml(e.staffName)}${badge}</div>
      ${replaced}${role}
    </div>`;
  }).join("");

  Swal.fire({
    title,
    html: `<div style="max-height:320px;overflow:auto">${rows}</div>`,
    confirmButtonColor: "#124757",
    confirmButtonText: lang === "VN" ? "Đóng" : "Close",
    width: 420,
  });
}

function CrewCalendarView({ lang, monthValue, setMonthValue, calendarMap, isLoading }) {
  const cells = buildMonthCells(monthValue);
  const weekdays = lang === "VN" ? WEEKDAY_LABELS.vn : WEEKDAY_LABELS.en;

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
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#124757] dark:bg-yellow-400" />
          {lang === "VN" ? "Nhân viên mặc định" : "Default staff"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          {lang === "VN" ? "Người thay thế" : "Replacement"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          {lang === "VN" ? "Cuối tuần (T7 / CN)" : "Weekend (Sat / Sun)"}
        </span>
        <span className="text-slate-400 font-medium normal-case tracking-normal">
          {lang === "VN" ? "Nhấn tên để xem chi tiết" : "Click a name for details"}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="w-8 h-8 border-4 border-[#124757] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekdays.map((w, i) => (
            <div
              key={w}
              className={`text-center text-[10px] font-black uppercase py-1 ${
                i >= 5 ? "text-rose-500 dark:text-rose-300" : "text-slate-400"
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((date, idx) => {
            if (!date) return <div key={`blank-${idx}`} />;
            const entries = calendarMap.get(date) || [];
            const dayNum = Number(date.slice(8, 10));
            const weekday = new Date(`${date}T00:00:00`).getDay(); // 0=CN, 6=T7
            const isSunday = weekday === 0;
            const isSaturday = weekday === 6;

            let cellBg = "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700";
            if (isSunday) {
              cellBg = "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30";
            } else if (isSaturday) {
              cellBg = "bg-orange-50/80 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20";
            } else if (entries.length > 0) {
              cellBg = "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700";
            }

            return (
              <div
                key={date}
                className={`min-h-24 rounded-xl border p-1.5 flex flex-col gap-1 ${cellBg}`}
              >
                <span
                  className={`text-[11px] font-bold px-0.5 ${
                    isSunday
                      ? "text-rose-600 dark:text-rose-300"
                      : isSaturday
                        ? "text-orange-600 dark:text-orange-300"
                        : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {dayNum}
                </span>
                <div className="flex flex-col gap-0.5 min-h-0">
                  {entries.map((e, i) => (
                    <button
                      key={`${date}-${e.staffName}-${i}`}
                      type="button"
                      title={e.staffName}
                      onClick={() => openDayStaffPopup(lang, date, entries)}
                      className={`w-full truncate rounded-md px-1 py-0.5 text-left text-[9px] font-bold leading-tight transition-colors ${
                        e.isReplacement
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-200"
                          : "bg-[#124757]/10 text-[#124757] hover:bg-[#124757]/20 dark:bg-yellow-400/15 dark:text-yellow-300"
                      }`}
                    >
                      {shortStaffName(e.staffName)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
