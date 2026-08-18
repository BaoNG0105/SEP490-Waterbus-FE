import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";

const PANEL_WIDTH = 224; // ~14rem
const PANEL_EST_HEIGHT = 250;
const YEARS_PER_GRID = 12; // lưới 4 hàng x 3 cột
const YEARS_BEFORE_CENTER = 5; // lưới hiển thị [viewYear-5 .. viewYear+6]

const clamp = (year, min, max) => {
  let next = year;
  if (min != null && next < min) next = min;
  if (max != null && next > max) next = max;
  return next;
};

/**
 * Ô nhập Năm kiểu "Select Year" (gõ tay 4 chữ số hoặc mở lưới 12 năm để chọn nhanh, nút ‹ ›
 * nhảy lùi/tiến 12 năm mỗi lần). Value luôn là chuỗi năm (vd "1990") hoặc "" nếu trống — API
 * giống input number thường, có thêm onChange dạng event-like { target: { name, value } } để
 * thay thế trực tiếp cho <input type="number"> ở các form hiện có (theo cùng convention với
 * AppDateInput — xem component đó để tham chiếu cách bố trí panel/portal).
 */
export function YearPickerInput({
  value = "",
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  name,
  id,
  className = "",
  placeholder = "YYYY",
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

  const selectedYear = /^\d{4}$/.test(String(value ?? "")) ? Number(value) : null;
  const nowYear = new Date().getFullYear();
  const [viewYear, setViewYear] = useState(selectedYear ?? clamp(nowYear, min, max));

  const text = draft != null ? draft : (value ?? "");

  const years = useMemo(
    () => Array.from({ length: YEARS_PER_GRID }, (_, i) => viewYear - YEARS_BEFORE_CENTER + i),
    [viewYear]
  );

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
    setViewYear(selectedYear ?? clamp(nowYear, min, max));
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

  const isYearDisabled = (year) => (min != null && year < min) || (max != null && year > max);

  const emit = (nextValue) => {
    onChange?.({
      target: {
        name: name || "",
        value: nextValue,
        type: "number",
      },
    });
  };

  const commitText = (nextText) => {
    const raw = String(nextText || "").trim();
    if (!raw) {
      setIsInvalid(false);
      setDraft(null);
      if (value) emit("");
      return;
    }
    if (!/^\d{4}$/.test(raw) || isYearDisabled(Number(raw))) {
      setIsInvalid(true);
      setDraft(null);
      return;
    }
    setIsInvalid(false);
    setDraft(null);
    if (raw !== String(value ?? "")) emit(raw);
  };

  const handleTextChange = (event) => {
    const next = event.target.value.replace(/\D/g, "").slice(0, 4);
    setDraft(next);
    setIsInvalid(false);
  };

  const shiftPage = (delta) => setViewYear((prev) => prev + delta);

  const handleSelect = (year) => {
    if (isYearDisabled(year)) return;
    setDraft(null);
    setIsInvalid(false);
    emit(String(year));
    setViewYear(year);
    setOpen(false);
  };

  const yearGridPanel = open && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={isVn ? "Chọn năm" : "Select year"}
        style={{ top: panelPos.top, left: panelPos.left }}
        onMouseDown={(event) => event.stopPropagation()}
        className="fixed z-200 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftPage(-YEARS_PER_GRID)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={isVn ? "12 năm trước" : "Previous 12 years"}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <p className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
            {viewYear}
          </p>
          <button
            type="button"
            onClick={() => shiftPage(YEARS_PER_GRID)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={isVn ? "12 năm sau" : "Next 12 years"}
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {years.map((year) => {
            const isSelected = selectedYear === year;
            const disabledYear = isYearDisabled(year);
            return (
              <button
                key={year}
                type="button"
                disabled={disabledYear}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(year)}
                className={`h-10 rounded-lg text-sm font-bold transition ${
                  isSelected
                    ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                } ${disabledYear ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className={`box-border flex w-full items-center gap-1 overflow-hidden ${className}`}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          id={id}
          name={name}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={text}
          aria-invalid={isInvalid || undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onFocus={() => {
            setDraft(String(value ?? ""));
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
          className={`h-full min-w-0 flex-1 bg-transparent text-inherit leading-none outline-none ${
            isInvalid ? "text-rose-600 dark:text-rose-400" : ""
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:text-[#124757] disabled:opacity-50 dark:hover:text-yellow-400"
          aria-label={isVn ? "Mở chọn năm" : "Open year picker"}
        >
          <span
            className="material-symbols-outlined pointer-events-none select-none text-[18px] leading-none"
            aria-hidden
          >
            event
          </span>
        </button>
      </div>

      {yearGridPanel}
    </div>
  );
}