import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { getTodayDateString } from "../utils/dateOnly";

const WEEKDAYS = {
  VN: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  EN: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
};

const MONTHS = {
  VN: [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ],
  EN: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

const parseYmd = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
};

const toYmd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplay = (value, lang) => {
  const date = parseYmd(value);
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return lang === "VN" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
};

const startOfMonthGrid = (year, month) => {
  // Monday-first grid
  const first = new Date(year, month, 1);
  const weekday = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const start = new Date(year, month, 1 - weekday);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    cells.push(day);
  }
  return cells;
};

/**
 * Date input theo lang app (VN/EN). Value luôn YYYY-MM-DD như <input type="date">.
 */
export function AppDateInput({
  value = "",
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  name,
  id,
  className = "",
  placeholder,
}) {
  const { lang } = useApp();
  const isVn = lang === "VN";
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = parseYmd(value);
  const minDate = parseYmd(min);
  const maxDate = parseYmd(max);

  const initialView = selected || minDate || new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const base = selected || minDate || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
  }, [open, selected, minDate]);

  const cells = useMemo(() => startOfMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = `${MONTHS[isVn ? "VN" : "EN"][viewMonth]} ${viewYear}`;
  const weekdays = WEEKDAYS[isVn ? "VN" : "EN"];
  const displayValue = formatDisplay(value, lang);
  const displayPlaceholder = placeholder
    || (isVn ? "dd/mm/yyyy" : "mm/dd/yyyy");

  const isDisabledDay = (day) => {
    const key = toYmd(day);
    if (minDate && key < toYmd(minDate)) return true;
    if (maxDate && key > toYmd(maxDate)) return true;
    return false;
  };

  const emit = (nextValue) => {
    onChange?.({
      target: {
        name: name || "",
        value: nextValue,
        type: "date",
      },
    });
  };

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleSelect = (day) => {
    if (isDisabledDay(day)) return;
    emit(toYmd(day));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        aria-required={required || undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={displayValue ? "" : "text-slate-400"}>
          {displayValue || displayPlaceholder}
        </span>
        <span className="material-symbols-outlined shrink-0 text-[18px] text-slate-400">
          calendar_month
        </span>
      </button>

      {/* Hidden field for native form required / submit if needed */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        name={name ? `${name}__ymd` : undefined}
        value={value || ""}
        required={required}
        onChange={() => {}}
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      />

      {open && (
        <div
          role="dialog"
          aria-label={isVn ? "Chọn ngày" : "Choose date"}
          className="absolute left-0 z-50 mt-2 w-[18.5rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={isVn ? "Tháng trước" : "Previous month"}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <p className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={isVn ? "Tháng sau" : "Next month"}
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-headline font-black uppercase tracking-wide text-slate-400"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day) => {
              const key = toYmd(day);
              const inMonth = day.getMonth() === viewMonth;
              const isSelected = value === key;
              const disabledDay = isDisabledDay(day);
              const isToday = key === getTodayDateString();
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => handleSelect(day)}
                  className={`h-9 rounded-lg text-xs font-bold transition ${
                    isSelected
                      ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                      : isToday
                        ? "ring-1 ring-[#124757]/30 text-[#124757] dark:ring-yellow-400/40 dark:text-yellow-400"
                        : inMonth
                          ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          : "text-slate-300 dark:text-slate-600"
                  } ${disabledDay ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                emit("");
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-slate-50 dark:text-yellow-400 dark:hover:bg-slate-800"
            >
              {isVn ? "Xóa" : "Clear"}
            </button>
            <button
              type="button"
              onClick={() => {
                const today = getTodayDateString();
                if (minDate && today < toYmd(minDate)) return;
                if (maxDate && today > toYmd(maxDate)) return;
                emit(today);
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-slate-50 dark:text-yellow-400 dark:hover:bg-slate-800"
            >
              {isVn ? "Hôm nay" : "Today"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
