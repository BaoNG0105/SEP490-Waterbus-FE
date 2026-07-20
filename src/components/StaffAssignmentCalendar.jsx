import { useMemo } from "react";
import { ASSIGNMENT_STATUS, ASSIGNMENT_TYPE, SHIFT_STATE, labelAssignmentStatus, labelShiftState, resolveShiftState, isAssignmentInactive } from "../services/staffAssignmentService";
import {
  addDays,
  assignmentCoversDay,
  eachDay,
  endOfMonth,
  endOfWeek,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from "../utils/staffAssignmentCalendarUtils";

const pad2 = (n) => String(n).padStart(2, "0");

const getTargetLabel = (row) => {
  if (row.assignmentType === ASSIGNMENT_TYPE.BOAT) {
    const code = row.boat?.boatCode || "";
    const name = row.boat?.boatName || "";
    return [code, name].filter(Boolean).join(" · ") || "Boat";
  }
  const code = row.station?.stationCode || "";
  const name = row.station?.stationName || "";
  return [code, name].filter(Boolean).join(" · ") || "Station";
};

const getBoatKey = (row) => {
  if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return "";
  return String(row.boat?.boatId || row.raw?.boatId || row.boat?.boatCode || "unknown");
};

const statusChip = (row) => {
  if (isAssignmentInactive(row.status)) {
    return "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
  }
  const state = resolveShiftState(row);
  switch (state) {
    case SHIFT_STATE.ACTIVE:
      return "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
    case SHIFT_STATE.COMPLETED:
      return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";
    case SHIFT_STATE.UPCOMING:
    default:
      return "border-[#124757]/20 bg-[#124757]/5 text-[#124757] dark:border-yellow-400/25 dark:bg-yellow-400/10 dark:text-yellow-200";
  }
};

const WEEKDAY_LABELS_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const isWeekend = (day) => {
  const dow = day.getDay();
  return dow === 0 || dow === 6;
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

/**
 * Lịch phân công gộp Ngày / Tuần / Tháng (+ tùy chọn lưới theo tàu).
 * Cuối tuần (T7/CN) được đánh dấu.
 */
export function StaffAssignmentCalendar({
  lang = "VN",
  assignments = [],
  mode = "month", // day | week | month
  onModeChange,
  layout = "calendar", // calendar | byBoat
  onLayoutChange,
  showLayoutToggle = true,
  anchorDate,
  onAnchorChange,
  isLoading = false,
}) {
  const anchor = useMemo(() => {
    if (anchorDate instanceof Date) return anchorDate;
    if (typeof anchorDate === "string" && anchorDate) return parseDateKey(anchorDate);
    return new Date();
  }, [anchorDate]);

  const range = useMemo(() => {
    if (mode === "day") {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
      return { from: d, to: d };
    }
    if (mode === "month") {
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    }
    return { from: startOfWeek(anchor), to: endOfWeek(anchor) };
  }, [anchor, mode]);

  const days = useMemo(() => eachDay(range.from, range.to), [range]);

  const monthGridDays = useMemo(() => {
    if (mode !== "month") return days;
    return eachDay(startOfWeek(range.from), endOfWeek(range.to));
  }, [mode, range, days]);

  const displayDays = mode === "month" ? monthGridDays : days;
  const weekdayLabels = lang === "VN" ? WEEKDAY_LABELS_VN : WEEKDAY_LABELS_EN;

  const shiftAnchor = (delta) => {
    if (!onAnchorChange) return;
    if (mode === "month") {
      onAnchorChange(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
    } else if (mode === "week") {
      onAnchorChange(addDays(anchor, delta * 7));
    } else {
      onAnchorChange(addDays(anchor, delta));
    }
  };

  const goToday = () => onAnchorChange?.(new Date());

  const title = useMemo(() => {
    if (mode === "month") {
      return anchor.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
        month: "long",
        year: "numeric",
      });
    }
    if (mode === "day") {
      return anchor.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
    return lang === "VN"
      ? `Tuần ${toDateKey(range.from)} → ${toDateKey(range.to)}`
      : `Week ${toDateKey(range.from)} → ${toDateKey(range.to)}`;
  }, [mode, anchor, range, lang]);

  const boatRows = useMemo(() => {
    if (layout !== "byBoat") return [];
    const map = new Map();
    assignments.forEach((row) => {
      if (row.assignmentType !== ASSIGNMENT_TYPE.BOAT) return;
      if (isAssignmentInactive(row.status)) return;
      const key = getBoatKey(row);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { key, label: getTargetLabel(row) });
      }
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [assignments, layout]);

  const cellsForDay = (dayKey) =>
    assignments.filter((row) => !isAssignmentInactive(row.status) && assignmentCoversDay(row, dayKey));

  const renderChip = (row, keySuffix = "") => {
    const label =
      layout === "byBoat"
        ? row.staffName
        : `${row.staffName}${
            row.assignmentType === ASSIGNMENT_TYPE.BOAT
              ? ` · ${row.boat?.boatCode || ""}`
              : ` · ${row.station?.stationCode || ""}`
          }`;
    return (
      <div
        key={`${row.assignmentId}${keySuffix}`}
        title={`${row.staffName} · ${getTargetLabel(row)} · ${labelAssignmentStatus(row.status, lang)}`}
        className={`rounded-lg border px-1.5 py-1 text-[9px] font-bold leading-tight truncate ${statusChip(row)}`}
      >
        {label}
        {resolveShiftState(row) ? ` · ${labelShiftState(resolveShiftState(row), lang)}` : ""}
      </div>
    );
  };

  const isOutsideMonth = (day) =>
    mode === "month" &&
    (day.getMonth() !== anchor.getMonth() || day.getFullYear() !== anchor.getFullYear());

  const isToday = (day) => toDateKey(day) === toDateKey(new Date());

  const dayShellClass = (day, { tall = false } = {}) => {
    const weekend = isWeekend(day);
    const today = isToday(day);
    const outside = isOutsideMonth(day);
    let cls = tall ? "min-h-[110px] " : "min-h-[92px] ";
    cls += "rounded-2xl border p-1.5 transition-colors ";
    if (today) {
      cls += "border-[#124757]/50 bg-[#124757]/8 dark:border-yellow-400/50 dark:bg-yellow-400/10 ";
    } else if (weekend) {
      // Cuối tuần: xám ấm nhẹ — không cam / không cyan
      cls +=
        "border-slate-200/90 bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/50 ";
    } else {
      cls += "border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900/25 ";
    }
    if (outside) {
      cls += "opacity-45 bg-slate-50/80 dark:bg-slate-900/40 ";
    }
    return cls;
  };

  const periodOptions = [
    { id: "day", icon: "today", vn: "Ngày", en: "Day" },
    { id: "week", icon: "view_week", vn: "Tuần", en: "Week" },
    { id: "month", icon: "calendar_month", vn: "Tháng", en: "Month" },
  ];

  const dayRows = mode === "day" ? cellsForDay(toDateKey(anchor)) : [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-4xl border border-slate-100 dark:border-slate-700/50 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="font-headline font-black text-sm uppercase tracking-wide text-[#124757] dark:text-yellow-400">
              {layout === "byBoat"
                ? lang === "VN"
                  ? "Lịch tổng theo tàu"
                  : "Master schedule by boat"
                : lang === "VN"
                  ? "Lịch phân công"
                  : "Assignment calendar"}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{title}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftAnchor(-1)}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl">chevron_left</span>
            </button>
            <button
              type="button"
              onClick={goToday}
              className="px-3 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              {lang === "VN" ? "Hôm nay" : "Today"}
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(1)}
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
            {periodOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onModeChange?.(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-headline font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all ${
                  mode === opt.id
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                {lang === "VN" ? opt.vn : opt.en}
              </button>
            ))}
          </div>

          {showLayoutToggle && onLayoutChange && mode !== "day" && (
            <>
              <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <button
                type="button"
                onClick={() => onLayoutChange("calendar")}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                  layout === "calendar"
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "border border-slate-200 dark:border-slate-700 text-slate-500"
                }`}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                {lang === "VN" ? "Lưới ngày" : "Day grid"}
              </button>
              <button
                type="button"
                onClick={() => onLayoutChange("byBoat")}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-headline font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                  layout === "byBoat"
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                    : "border border-slate-200 dark:border-slate-700 text-slate-500"
                }`}
              >
                <span className="material-symbols-outlined text-sm">directions_boat</span>
                {lang === "VN" ? "Theo tàu" : "By boat"}
              </button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
        </div>
      ) : mode === "day" ? (
        <div className="p-5 space-y-3">
          <div
            className={`rounded-3xl border px-4 py-3 ${
              isWeekend(anchor)
                ? "border-slate-200 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-800/60"
                : "border-slate-100 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40"
            }`}
          >
            <p className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-400">
              {isWeekend(anchor)
                ? lang === "VN"
                  ? "Cuối tuần"
                  : "Weekend"
                : lang === "VN"
                  ? "Ngày trong tuần"
                  : "Weekday"}
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 capitalize">{title}</p>
          </div>
          {dayRows.length === 0 ? (
            <p className="text-center text-xs font-bold text-slate-400 py-10">
              {lang === "VN" ? "Không có ca trong ngày này." : "No shifts on this day."}
            </p>
          ) : (
            dayRows.map((row) => {
              const shift = resolveShiftState(row);
              return (
              <div
                key={row.assignmentId}
                className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${statusChip(row)}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{row.staffName}</p>
                  <p className="text-[11px] opacity-80 mt-0.5 truncate">{getTargetLabel(row)}</p>
                </div>
                <p className="text-[11px] font-bold whitespace-nowrap sm:text-right">
                  {formatDateTime(row.startAt, lang)} → {formatDateTime(row.endAt, lang)}
                  <span className="mx-2 opacity-40">·</span>
                  <span className="uppercase tracking-wide">
                    {shift ? labelShiftState(shift, lang) : labelAssignmentStatus(row.status, lang)}
                  </span>
                </p>
              </div>
              );
            })
          )}
        </div>
      ) : layout === "byBoat" ? (
        <div className="overflow-x-auto">
          {boatRows.length === 0 ? (
            <p className="text-center text-xs font-bold text-slate-400 py-14">
              {lang === "VN"
                ? "Chưa có ca tàu (không gồm ca đã hủy) trong khoảng này."
                : "No boat shifts (excluding cancelled) in this range."}
            </p>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900/50 py-3 px-4 text-[10px] font-headline font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700/60 min-w-[140px]">
                    {lang === "VN" ? "Tàu" : "Boat"}
                  </th>
                  {displayDays.map((day) => {
                    const key = toDateKey(day);
                    const weekend = isWeekend(day);
                    return (
                      <th
                        key={key}
                        className={`py-3 px-1.5 text-center text-[10px] font-headline font-black uppercase tracking-wide border-b border-slate-100 dark:border-slate-700/60 min-w-[88px] ${
                          isToday(day)
                            ? "text-[#124757] dark:text-yellow-400"
                            : weekend
                              ? "text-slate-500 dark:text-slate-400"
                              : "text-slate-400"
                        } ${isOutsideMonth(day) ? "opacity-40" : ""} ${
                          weekend ? "bg-slate-100/80 dark:bg-slate-800/50" : ""
                        }`}
                      >
                        <div>{weekdayLabels[(day.getDay() + 6) % 7]}</div>
                        <div className="text-[11px] mt-0.5">{pad2(day.getDate())}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {boatRows.map((boat) => (
                  <tr key={boat.key}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 py-2.5 px-4 text-xs font-bold text-slate-800 dark:text-white border-r border-slate-100 dark:border-slate-700/60">
                      {boat.label}
                    </td>
                    {displayDays.map((day) => {
                      const key = toDateKey(day);
                      const rows = cellsForDay(key).filter((row) => getBoatKey(row) === boat.key);
                      const weekend = isWeekend(day);
                      return (
                        <td
                          key={`${boat.key}-${key}`}
                          className={`align-top p-1.5 ${
                            isOutsideMonth(day) ? "opacity-40" : ""
                          } ${
                            isToday(day)
                              ? "bg-[#124757]/5 dark:bg-yellow-400/5"
                              : weekend
                                ? "bg-slate-100/70 dark:bg-slate-800/40"
                                : ""
                          }`}
                        >
                          <div className="space-y-1 min-h-[42px]">{rows.map((r) => renderChip(r, key))}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {weekdayLabels.map((label, index) => {
              const weekend = index >= 5;
              return (
                <div
                  key={label}
                  className={`text-center text-[10px] font-headline font-black uppercase tracking-widest py-1 rounded-lg ${
                    weekend
                      ? "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60"
                      : "text-slate-400"
                  }`}
                >
                  {label}
                  {weekend && (
                    <span className="block text-[8px] font-bold normal-case tracking-normal opacity-80">
                      {lang === "VN" ? "cuối tuần" : "weekend"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {displayDays.map((day) => {
              const key = toDateKey(day);
              const rows = cellsForDay(key);
              const limit = mode === "month" ? 3 : 6;
              return (
                <div
                  key={key}
                  className={dayShellClass(day, { tall: mode === "week" })}
                  onDoubleClick={() => {
                    onModeChange?.("day");
                    onAnchorChange?.(day);
                  }}
                >
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <span
                      className={`text-[11px] font-black ${
                        isToday(day)
                          ? "text-[#124757] dark:text-yellow-400"
                          : isWeekend(day)
                            ? "text-slate-500 dark:text-slate-400"
                            : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {pad2(day.getDate())}
                    </span>
                    {rows.length > 0 && (
                      <span className="text-[9px] font-bold text-slate-400">{rows.length}</span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-[130px] overflow-y-auto no-scrollbar">
                    {rows.slice(0, limit).map((r) => renderChip(r, key))}
                    {rows.length > limit && (
                      <p className="text-[9px] font-bold text-slate-400 px-0.5">+{rows.length - limit}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-3 text-[10px] font-bold text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#124757]/70 dark:bg-yellow-400" />{" "}
          {labelShiftState(SHIFT_STATE.UPCOMING, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{" "}
          {labelShiftState(SHIFT_STATE.ACTIVE, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />{" "}
          {labelShiftState(SHIFT_STATE.COMPLETED, lang)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" />
          {lang === "VN" ? "Cuối tuần (T7/CN)" : "Weekend"}
        </span>
        <span className="text-slate-300 dark:text-slate-600">
          {lang === "VN"
            ? "Tiến độ ca tự động · ca đã hủy không hiện"
            : "Auto shift progress · cancelled hidden"}
        </span>
      </div>
    </div>
  );
}
