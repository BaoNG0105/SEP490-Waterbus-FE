import { useEffect, useRef, useState } from "react";

/**
 * Custom select — tránh popup native bị lệch/tràn trong Simple Browser / parent có transform.
 */
export function FormSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = "",
  className = "",
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`relative ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-required={required || undefined}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined shrink-0 text-lg text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {isOpen && !disabled && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((opt) => {
            const active = String(opt.value) === String(value);
            return (
              <li key={String(opt.value)} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-bold transition-colors ${
                    active
                      ? "bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <span className="material-symbols-outlined text-base">check</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
