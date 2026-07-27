import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const PANEL_WIDTH = 296; // ~18.5rem
const PANEL_EST_HEIGHT = 340;

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

/** Chuỗi hiển thị → YYYY-MM-DD (hoặc "" nếu trống, null nếu sai). */
const parseDisplayToYmd = (text, lang) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return parseYmd(raw) ? raw : null;

  const matched = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!matched) return null;

  const a = Number(matched[1]);
  const b = Number(matched[2]);
  const y = Number(matched[3]);
  const day = lang === "VN" ? a : b;
  const month = lang === "VN" ? b : a;
  if (!y || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(y, month - 1, day);
  if (date.getFullYear() !== y || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toYmd(date);
};

/** Gõ số → tự chèn / theo dd/mm/yyyy hoặc mm/dd/yyyy. */
const maskTypedDate = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
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
 * Gõ tay được (dd/mm/yyyy | mm/dd/yyyy) + chọn lịch (portal).
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
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  /** null = đang không gõ tay → hiển thị theo value; string = đang nhập. */
  const [draft, setDraft] = useState(null);
  const [isInvalid, setIsInvalid] = useState(false);

  const selected = parseYmd(value);
  const minDate = parseYmd(min);
  const maxDate = parseYmd(max);

  const initialView = selected || minDate || new Date();
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  const text = draft != null ? draft : formatDisplay(value, lang);

  const placePanel = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.left;
    if (left + PANEL_WIDTH > vw - 8) {
      left = Math.max(8, rect.right - PANEL_WIDTH);
    }
    left = Math.max(8, left);

    let top = rect.bottom + 8;
    if (top + PANEL_EST_HEIGHT > vh - 8) {
      top = Math.max(8, rect.top - PANEL_EST_HEIGHT - 8);
    }
    setPanelPos({ top, left });
  };

  const openPicker = () => {
    if (disabled) return;
    const base = selected || minDate || new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    placePanel();
    setOpen(true);
    window.requestAnimationFrame(placePanel);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      const t = event.target;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => placePanel();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const cells = useMemo(() => startOfMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthLabel = `${MONTHS[isVn ? "VN" : "EN"][viewMonth]} ${viewYear}`;
  const weekdays = WEEKDAYS[isVn ? "VN" : "EN"];
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

  const commitText = (nextText) => {
    const parsed = parseDisplayToYmd(nextText, lang);
    if (parsed === "") {
      setIsInvalid(false);
      setDraft(null);
      if (value) emit("");
      return;
    }
    if (parsed == null) {
      setIsInvalid(true);
      setDraft(null);
      return;
    }
    if (minDate && parsed < toYmd(minDate)) {
      setIsInvalid(true);
      setDraft(null);
      return;
    }
    if (maxDate && parsed > toYmd(maxDate)) {
      setIsInvalid(true);
      setDraft(null);
      return;
    }
    setIsInvalid(false);
    setDraft(null);
    if (parsed !== value) emit(parsed);
  };

  const handleTextChange = (event) => {
    const next = maskTypedDate(event.target.value);
    setDraft(next);
    setIsInvalid(false);
    if (next.length === 10) {
      const parsed = parseDisplayToYmd(next, lang);
      if (parsed && !(minDate && parsed < toYmd(minDate)) && !(maxDate && parsed > toYmd(maxDate))) {
        if (parsed !== value) emit(parsed);
      }
    } else if (!next && value) {
      emit("");
    }
  };

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleSelect = (day) => {
    if (isDisabledDay(day)) return;
    const next = toYmd(day);
    setDraft(null);
    setIsInvalid(false);
    emit(next);
    setOpen(false);
  };

  const calendarPanel = open && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={isVn ? "Chọn ngày" : "Choose date"}
        style={{ top: panelPos.top, left: panelPos.left }}
        onMouseDown={(event) => event.stopPropagation()}
        className="fixed z-[200] w-[18.5rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900"
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(day)}
                className={`h-9 rounded-lg text-xs font-bold transition ${
                  isSelected
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                    : isToday
                      ? "ring-1 ring-[#124757]/30 text-[#124757] dark:ring-yellow-400/40 dark:text-yellow-400"
                      : inMonth
                        ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
              setDraft(null);
              setIsInvalid(false);
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
              setDraft(null);
              setIsInvalid(false);
              emit(today);
              setOpen(false);
            }}
            className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-slate-50 dark:text-yellow-400 dark:hover:bg-slate-800"
          >
            {isVn ? "Hôm nay" : "Today"}
          </button>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className={`flex w-full items-center gap-1.5 overflow-visible ${className}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          id={id}
          name={name}
          disabled={disabled}
          required={required}
          placeholder={displayPlaceholder}
          value={text}
          aria-invalid={isInvalid || undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onFocus={() => {
            setDraft(formatDisplay(value, lang));
            setIsInvalid(false);
          }}
          onChange={handleTextChange}
          onBlur={() => commitText(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText(text);
              setOpen(false);
            }
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              openPicker();
            }
          }}
          className={`min-w-0 flex-1 bg-transparent outline-none ${
            isInvalid ? "text-rose-600 dark:text-rose-400" : ""
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="inline-flex size-7 shrink-0 items-center justify-center overflow-visible rounded-md text-slate-400 hover:text-[#124757] disabled:opacity-50 dark:hover:text-yellow-400"
          aria-label={isVn ? "Mở lịch" : "Open calendar"}
        >
          <span
            className="material-symbols-outlined pointer-events-none select-none text-[20px] leading-none"
            style={{ overflow: "visible", display: "block", width: 20, height: 20 }}
            aria-hidden
          >
            calendar_month
          </span>
        </button>
      </div>

      {calendarPanel}
    </div>
  );
}
