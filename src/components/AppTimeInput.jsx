import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";

const PANEL_WIDTH = 208; // ~13rem — 2 cột Giờ/Phút
const PANEL_EST_HEIGHT = 288;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const pad2 = (n) => String(n).padStart(2, "0");

/** "HH:mm" (chấp nhận cả "HH:mm:ss" từ BE) → { h, m } hoặc null nếu rỗng/sai. */
const parseHm = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const matched = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!matched) return null;
  const h = Number(matched[1]);
  const m = Number(matched[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
};

const toHm = (h, m) => `${pad2(h)}:${pad2(m)}`;

/** Gõ số → tự chèn ":" theo HH:mm, giới hạn 4 chữ số. */
const maskTypedTime = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

/** Chuỗi gõ tay → "HH:mm" hợp lệ, "" nếu rỗng, null nếu sai định dạng/giờ phút. */
const parseTypedToHm = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const matched = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!matched) return null;
  const h = Number(matched[1]);
  const m = Number(matched[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return toHm(h, m);
};

/**
 * Time input theo lang app (VN/EN), giao diện đồng bộ với AppDateInput / YearPickerInput:
 * gõ tay được (HH:mm, tự chèn ":") + chọn nhanh qua panel 2 cột Giờ/Phút (portal, cuộn dọc).
 * Value luôn là chuỗi "HH:mm" (hoặc "" nếu trống) — thay thế trực tiếp cho <input type="time">.
 * `min`/`max` cũng là chuỗi "HH:mm" (so sánh dạng chuỗi vì đã zero-pad).
 */
export function AppTimeInput({
  value = "",
  onChange,
  min,
  max,
  step = 5,
  required = false,
  disabled = false,
  name,
  id,
  className = "",
  placeholder = "--:--",
}) {
  const { lang } = useApp();
  const isVn = lang === "VN";
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  /** null = đang không gõ tay → hiển thị theo value; string = đang nhập. */
  const [draft, setDraft] = useState(null);
  const [isInvalid, setIsInvalid] = useState(false);

  const selected = parseHm(value);
  const text = draft != null ? draft : (selected ? toHm(selected.h, selected.m) : "");

  const minutes = useMemo(() => {
    const list = [];
    for (let m = 0; m < 60; m += step) list.push(m);
    // Vẫn cho chọn đúng phút hiện tại dù không rơi vào lưới step (VD BE trả về "06:07").
    if (selected && !list.includes(selected.m)) list.push(selected.m);
    return list.sort((a, b) => a - b);
  }, [step, selected]);

  const isBelowMin = (hm) => Boolean(min) && hm < min;
  const isAboveMax = (hm) => Boolean(max) && hm > max;

  const isHourDisabled = (h) => isBelowMin(toHm(h, 59)) || isAboveMax(toHm(h, 0));
  const isMinuteDisabled = (h, m) => isBelowMin(toHm(h, m)) || isAboveMax(toHm(h, m));

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

  // Cuộn cột Giờ/Phút tới mục đang chọn mỗi lần mở panel.
  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      hourListRef.current?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "center" });
      minuteListRef.current?.querySelector('[data-active="true"]')
        ?.scrollIntoView({ block: "center" });
    });
  }, [open]);

  const emit = (nextValue) => {
    onChange?.({
      target: {
        name: name || "",
        value: nextValue,
        type: "time",
      },
    });
  };

  const commitText = (nextText) => {
    const parsed = parseTypedToHm(nextText);
    if (parsed === "") {
      setIsInvalid(false);
      setDraft(null);
      if (value) emit("");
      return;
    }
    if (parsed == null || isBelowMin(parsed) || isAboveMax(parsed)) {
      setIsInvalid(true);
      setDraft(null);
      return;
    }
    setIsInvalid(false);
    setDraft(null);
    if (parsed !== value) emit(parsed);
  };

  const handleTextChange = (event) => {
    const next = maskTypedTime(event.target.value);
    setDraft(next);
    setIsInvalid(false);
    if (next.length === 5) {
      const parsed = parseTypedToHm(next);
      if (parsed && !isBelowMin(parsed) && !isAboveMax(parsed) && parsed !== value) {
        emit(parsed);
      }
    } else if (!next && value) {
      emit("");
    }
  };

  const selectHour = (h) => {
    if (isHourDisabled(h)) return;
    let m = selected?.m ?? 0;
    if (isMinuteDisabled(h, m)) {
      m = minutes.find((candidate) => !isMinuteDisabled(h, candidate)) ?? m;
    }
    setDraft(null);
    setIsInvalid(false);
    emit(toHm(h, m));
  };

  const selectMinute = (m) => {
    const h = selected?.h ?? 0;
    if (isMinuteDisabled(h, m)) return;
    setDraft(null);
    setIsInvalid(false);
    emit(toHm(h, m));
  };

  const timePanel = open && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label={isVn ? "Chọn giờ" : "Choose time"}
        style={{ top: panelPos.top, left: panelPos.left }}
        onMouseDown={(event) => event.stopPropagation()}
        className="fixed z-200 w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-900"
      >
        <div className="mb-2 flex items-center justify-center gap-1.5 border-b border-slate-100 pb-2 dark:border-slate-700">
          <span className="material-symbols-outlined text-[16px] text-[#124757] dark:text-yellow-400">
            schedule
          </span>
          <p className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
            {selected ? toHm(selected.h, selected.m) : "--:--"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-center text-[9px] font-headline font-black uppercase tracking-wide text-slate-400">
              {isVn ? "Giờ" : "Hour"}
            </p>
            <div ref={hourListRef} className="custom-scrollbar h-40 space-y-0.5 overflow-y-auto pr-1">
              {HOURS.map((h) => {
                const isActive = selected?.h === h;
                const disabledHour = isHourDisabled(h);
                return (
                  <button
                    key={h}
                    type="button"
                    data-active={isActive || undefined}
                    disabled={disabledHour}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectHour(h)}
                    className={`w-full rounded-lg py-1.5 text-center text-xs font-bold transition ${
                      isActive
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    } ${disabledHour ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                  >
                    {pad2(h)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1 text-center text-[9px] font-headline font-black uppercase tracking-wide text-slate-400">
              {isVn ? "Phút" : "Min"}
            </p>
            <div ref={minuteListRef} className="custom-scrollbar h-40 space-y-0.5 overflow-y-auto pr-1">
              {minutes.map((m) => {
                const isActive = selected?.m === m;
                const disabledMinute = selected ? isMinuteDisabled(selected.h, m) : false;
                return (
                  <button
                    key={m}
                    type="button"
                    data-active={isActive || undefined}
                    disabled={disabledMinute}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectMinute(m)}
                    className={`w-full rounded-lg py-1.5 text-center text-xs font-bold transition ${
                      isActive
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    } ${disabledMinute ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
                  >
                    {pad2(m)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setIsInvalid(false);
              emit("");
            }}
            className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-slate-50 dark:text-yellow-400 dark:hover:bg-slate-800"
          >
            {isVn ? "Xóa" : "Clear"}
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const roundedMinute = Math.round(now.getMinutes() / step) * step;
              const h = roundedMinute >= 60 ? (now.getHours() + 1) % 24 : now.getHours();
              const m = roundedMinute >= 60 ? 0 : roundedMinute;
              const next = toHm(h, m);
              if (isBelowMin(next) || isAboveMax(next)) return;
              setDraft(null);
              setIsInvalid(false);
              emit(next);
            }}
            className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] hover:bg-slate-50 dark:text-yellow-400 dark:hover:bg-slate-800"
          >
            {isVn ? "Bây giờ" : "Now"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-[11px] font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {isVn ? "Xong" : "Done"}
          </button>
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
          autoComplete="off"
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
            setDraft(selected ? toHm(selected.h, selected.m) : "");
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
          aria-label={isVn ? "Mở chọn giờ" : "Open time picker"}
        >
          <span
            className="material-symbols-outlined pointer-events-none select-none text-[18px] leading-none"
            aria-hidden
          >
            schedule
          </span>
        </button>
      </div>

      {timePanel}
    </div>
  );
}