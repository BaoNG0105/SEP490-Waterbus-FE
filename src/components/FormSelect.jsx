import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Custom select — menu render portal + fixed để không bị card/section sau đè lên.
 * searchable: gõ để lọc option trong menu.
 */
export function FormSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = "",
  className = "",
  required = false,
  menuAlign = "left",
  searchable = false,
  searchPlaceholder = "Search...",
  emptyLabel = "No results",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, query, searchable]);

  const updateMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuMaxH = 240;
    const gap = 6;
    const spaceBelow = Math.max(120, window.innerHeight - rect.bottom - 12);
    const width = Math.max(rect.width, searchable ? 220 : rect.width);
    const left =
      menuAlign === "right"
        ? Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
        : Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));

    setMenuPos({
      left,
      width,
      top: rect.bottom + gap,
      bottom: undefined,
      maxHeight: Math.min(menuMaxH, spaceBelow),
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return undefined;
    }
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [isOpen, menuAlign, searchable, filtered.length]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return undefined;
    }
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, searchable]);

  const pick = (next) => {
    onChange(next);
    setIsOpen(false);
    setQuery("");
  };

  const menu =
    isOpen && !disabled && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: menuPos.left,
              width: menuPos.width,
              top: menuPos.top,
              bottom: menuPos.bottom,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
          >
            {searchable && (
              <div className="border-b border-slate-100 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsOpen(false);
                    if (e.key === "Enter" && filtered[0]) {
                      e.preventDefault();
                      pick(filtered[0].value);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#124757] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-yellow-400"
                />
              </div>
            )}
            <ul role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: menuPos.maxHeight }}>
              {filtered.length === 0 ? (
                <li className="px-3.5 py-2.5 text-xs font-semibold text-slate-400">{emptyLabel}</li>
              ) : (
                filtered.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <li key={String(opt.value)} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => pick(opt.value)}
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
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative w-full min-w-0 ${isOpen ? "z-[60]" : ""} ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-required={required || undefined}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate text-left ${selected ? "" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`material-symbols-outlined shrink-0 text-lg text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>
      {menu}
    </div>
  );
}
