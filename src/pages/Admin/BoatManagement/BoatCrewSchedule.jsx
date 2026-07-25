import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { fetchBoatDetail } from "../../../services/boatService";
import { StaffAssignmentCalendar } from "../../../components/StaffAssignmentCalendar";
import { AppDateInput } from "../../../components/AppDateInput";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TYPE,
  SHIFT_STATE,
  fetchStaffAssignments,
  labelAssignmentStatus,
  labelShiftState,
  resolveShiftState,
} from "../../../services/staffAssignmentService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getRangeForScheduleMode, toDateKey } from "../../../utils/staffAssignmentCalendarUtils";

const pad2 = (n) => String(n).padStart(2, "0");

const toDateInputValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const defaultRange = () => {
  const from = new Date();
  from.setDate(1);
  const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) };
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

const getInitials = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * View-only: ca trên tàu lấy từ bảng tổng staff-assignments (Boat).
 * Có danh sách + lịch tuần/tháng. Không tạo / sửa.
 */
export function BoatDutyRosterPanel({ boatId }) {
  const { lang } = useApp();
  const range0 = defaultRange();
  const [displayMode, setDisplayMode] = useState("list"); // list | schedule
  const [calendarMode, setCalendarMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [fromDate, setFromDate] = useState(range0.fromDate);
  const [toDate, setToDate] = useState(range0.toDate);
  const [statusFilter, setStatusFilter] = useState("All");
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (displayMode !== "schedule") return;
    const range = getRangeForScheduleMode(calendarMode, anchorDate);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  }, [displayMode, calendarMode, anchorDate]);

  const load = useCallback(async () => {
    if (!boatId) {
      setAssignments([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg("");
      const data = await fetchStaffAssignments({
        boatId: String(boatId),
        assignmentType: ASSIGNMENT_TYPE.BOAT,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
      });
      const rows = (data || []).filter((row) => {
        if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return false;
        const rowBoatId = String(row.boat?.boatId || row.raw?.boatId || "");
        return !rowBoatId || rowBoatId === String(boatId);
      });
      setAssignments(rows);
    } catch (error) {
      console.error(error);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được lịch ca trên tàu." : "Failed to load boat duty schedule."
        )
      );
      setAssignments([]);
    } finally {
      setIsLoading(false);
    }
  }, [boatId, fromDate, toDate, statusFilter, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const activeNowCount = useMemo(
    () => assignments.filter((a) => resolveShiftState(a) === SHIFT_STATE.ACTIVE).length,
    [assignments]
  );

  const labelStyle =
    "text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider mb-1 block";
  const inputStyle =
    "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-[#124757] dark:focus:ring-yellow-400";

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-900 p-1 shrink-0">
          {[
            { id: "list", vn: "Danh sách", en: "List" },
            { id: "schedule", vn: "Lịch", en: "Calendar" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setDisplayMode(opt.id);
                if (opt.id === "schedule") setAnchorDate(new Date());
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider transition-all ${
                displayMode === opt.id
                  ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900 shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {lang === "VN" ? opt.vn : opt.en}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {assignments.length} {lang === "VN" ? "ca" : "shifts"}
            {activeNowCount > 0 ? ` · ${activeNowCount} Active` : ""}
          </span>
          <Link
            to="/admin/staffs-management?view=assignments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-yellow-400 text-slate-900 text-[10px] font-headline font-black uppercase tracking-wider hover:brightness-105"
          >
            <span className="material-symbols-outlined text-sm">badge</span>
            {lang === "VN" ? "Phân công Nhân viên" : "Staff Assignments"}
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-3 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm flex flex-wrap items-end gap-2">
        {displayMode === "list" ? (
          <>
            <div className="w-37">
              <label className={labelStyle}>{lang === "VN" ? "Từ ngày" : "From"}</label>
              <AppDateInput value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputStyle} />
            </div>
            <div className="w-37">
              <label className={labelStyle}>{lang === "VN" ? "Đến ngày" : "To"}</label>
              <AppDateInput value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputStyle} />
            </div>
          </>
        ) : (
          <div className="w-37">
            <label className={labelStyle}>{lang === "VN" ? "Ngày" : "Date"}</label>
            <AppDateInput
              value={toDateKey(anchorDate)}
              onChange={(e) =>
                setAnchorDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : new Date())
              }
              className={inputStyle}
            />
          </div>
        )}
        <div className="w-37">
          <label className={labelStyle}>{lang === "VN" ? "Trạng thái" : "Status"}</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputStyle}>
            <option value="All">{lang === "VN" ? "Tất cả" : "All"}</option>
            <option value={ASSIGNMENT_STATUS.SCHEDULED}>
              {labelAssignmentStatus(ASSIGNMENT_STATUS.SCHEDULED, lang)}
            </option>
            <option value={ASSIGNMENT_STATUS.CANCELLED}>
              {labelAssignmentStatus(ASSIGNMENT_STATUS.CANCELLED, lang)}
            </option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-bold border border-red-100 dark:border-red-500/20">
          {errorMsg}
        </div>
      )}

      {displayMode === "schedule" ? (
        <StaffAssignmentCalendar
          lang={lang}
          assignments={assignments}
          mode={calendarMode}
          onModeChange={setCalendarMode}
          layout="calendar"
          showLayoutToggle={false}
          anchorDate={anchorDate}
          onAnchorChange={setAnchorDate}
          isLoading={isLoading}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 p-10 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm text-center">
          <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">group_off</span>
          <p className="text-xs font-bold text-slate-400">
            {lang === "VN"
              ? "Chưa có ca Boat nào trong khoảng này. Tạo ở Phân công Staff."
              : "No Boat shifts in this range. Create them in Staff Assignments."}
          </p>
          <Link
            to="/admin/staffs-management?view=assignments"
            className="inline-flex mt-4 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] dark:text-yellow-400 underline"
          >
            {lang === "VN" ? "Đi phân công" : "Go assign"}
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-180">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                  <th className="py-3.5 px-5">{lang === "VN" ? "Nhân viên" : "Staff"}</th>
                  <th className="py-3.5 px-4">{lang === "VN" ? "Bắt đầu" : "Start"}</th>
                  <th className="py-3.5 px-4">{lang === "VN" ? "Kết thúc" : "End"}</th>
                  <th className="py-3.5 px-4 text-center">{lang === "VN" ? "Trạng thái" : "Status"}</th>
                  <th className="py-3.5 px-4 text-center">{lang === "VN" ? "Tiến độ ca" : "Shift"}</th>
                  <th className="py-3.5 px-5">{lang === "VN" ? "Ghi chú" : "Note"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {assignments.map((row) => (
                  <tr key={row.assignmentId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-[#124757] dark:bg-yellow-400 text-white dark:text-slate-900 flex items-center justify-center text-[11px] font-black shrink-0">
                          {getInitials(row.staffName)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-white truncate">{row.staffName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                      {formatDateTime(row.startAt, lang)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-300">
                      {formatDateTime(row.endAt, lang)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${statusTone(row.status)}`}
                      >
                        {labelAssignmentStatus(row.status, lang)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {resolveShiftState(row) ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-xl text-[10px] font-headline font-black uppercase tracking-wide border ${shiftStateTone(resolveShiftState(row))}`}
                        >
                          {labelShiftState(resolveShiftState(row), lang)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-5 text-slate-500 dark:text-slate-400">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function BoatCrewSchedule() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  const [boat, setBoat] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const isLoading = loadedId !== id;

  useEffect(() => {
    let active = true;
    fetchBoatDetail(id)
      .then((data) => {
        if (active) setBoat(data);
      })
      .catch((error) => {
        console.error("Lỗi tải thông tin tàu:", error);
      })
      .finally(() => {
        if (active) setLoadedId(id);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const boatCode = boat?.code || boat?.boatCode || "";
  const boatName = boat?.name || boat?.boatName || "";

  return (
    <div className="space-y-6 font-body pb-10 px-2 sm:px-4 max-w-5xl mx-auto animate-fade-in">
      <div className="flex bg-white dark:bg-slate-800 p-6 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin/boats-management")}
          className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-[#124757] hover:text-white transition-all flex items-center justify-center shadow-inner shrink-0"
        >
          <span className="material-symbols-outlined text-xl font-bold">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-headline font-black text-[#124757] dark:text-yellow-400 uppercase tracking-wide truncate">
            {lang === "VN" ? "Lịch ca trên tàu" : "Boat duty schedule"}
            {boatName ? `: ${boatName}` : ""}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {isLoading
              ? lang === "VN"
                ? "Đang tải thông tin tàu..."
                : "Loading boat..."
              : boatCode ||
                (lang === "VN"
                  ? "Chỉ xem ai đang được phân công trên tàu này"
                  : "View who is assigned to this boat")}
          </p>
        </div>
      </div>

      <BoatDutyRosterPanel boatId={id} />
    </div>
  );
}
