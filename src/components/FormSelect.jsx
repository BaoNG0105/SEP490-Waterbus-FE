import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Custom select — menu render portal + fixed để không bị card/section sau đè lên.
 * searchable: gõ để lọc option trong menu.
 * options[].icon: node hiện trước label (vd: lá cờ).
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
  fullWidth = true,
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
    return options.filter((o) => {
      const hay = `${o.label || ""} ${o.searchText || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query, searchable]);

  const updateMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuMaxH = 240;
    const gap = 6;

    // Nếu trigger cuộn khuất một phần sau header cố định (AdminHeader/Header), menu vẫn có thể
    // tính top nhỏ hơn chiều cao header → menu (z cao) đè/chồng lên header. Kẹp top tối thiểu
    // bằng mép dưới của header cố định gần nhất để menu luôn bung ra bên dưới nó.
    const fixedHeader = document.querySelector("header, nav.fixed");
    const headerBottom = fixedHeader ? fixedHeader.getBoundingClientRect().bottom : 0;
    const minTop = Math.max(gap, headerBottom + gap);
    const top = Math.max(rect.bottom + gap, minTop);

    const spaceBelow = Math.max(120, window.innerHeight - top - 12);
    const width = Math.max(rect.width, searchable ? 220 : rect.width);
    const left =
      menuAlign === "right"
        ? Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
        : Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));

    setMenuPos({
      left,
      width,
      top,
      bottom: undefined,
      maxHeight: Math.min(menuMaxH, spaceBelow),
    });
  };

  useLayoutEffect(() => {
    // Đóng menu: không setState ở đây — `isOpen && menuPos` bên dưới đã ẩn menu,
    // menuPos cũ còn lại vô hại và tránh cascading render khi effect này chạy lại.
    if (!isOpen) return undefined;
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [isOpen, menuAlign, searchable, filtered.length]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onDoc);
    if (searchable) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen, searchable]);

  // Đóng menu ở đúng nơi trigger (click nút, click ngoài, Escape, chọn option)
  // thay vì trong effect — tránh setState kéo theo render tầng trong useEffect.
  const closeMenu = () => {
    setIsOpen(false);
    setQuery("");
  };

  const toggleMenu = () => {
    if (isOpen) closeMenu();
    else setIsOpen(true);
  };

  const pick = (next) => {
    onChange(next);
    closeMenu();
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
                    if (e.key === "Escape") closeMenu();
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
                  const optDisabled = Boolean(opt.disabled);
                  return (
                    <li key={String(opt.value)} role="option" aria-selected={active} aria-disabled={optDisabled || undefined}>
                      <button
                        type="button"
                        disabled={optDisabled}
                        onClick={() => {
                          if (optDisabled) return;
                          pick(opt.value);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-bold transition-colors ${
                          optDisabled
                            ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
                            : active
                              ? "border-l-[3px] border-l-[#124757] bg-[#124757]/10 text-[#124757] dark:border-l-yellow-400 dark:bg-yellow-400/15 dark:text-yellow-300"
                              : "border-l-[3px] border-l-transparent text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2.5">
                          {opt.icon ? <span className="inline-flex shrink-0 items-center">{opt.icon}</span> : null}
                          <span className="min-w-0 flex-1 whitespace-normal wrap-break-words leading-snug">{opt.label}</span>
                        </span>
                        {active && !optDisabled ? (
                          <span className="material-symbols-outlined shrink-0 text-base text-[#124757] dark:text-yellow-400">check</span>
                        ) : null}
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
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full min-w-0 max-w-full" : "w-auto shrink-0"} ${isOpen ? "z-60" : ""} ${disabled ? "opacity-50" : ""}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-required={required || undefined}
        title={selected ? String(selected.label) : undefined}
        onClick={() => !disabled && toggleMenu()}
        className={`flex min-w-0 items-center justify-between gap-1.5 overflow-hidden text-left ${fullWidth ? "w-full max-w-full" : "w-auto"} ${className}`}
      >
        <span className={`flex min-w-0 flex-1 items-center gap-2 text-left ${selected ? "" : "text-slate-400"}`}>
          {selected?.icon ? <span className="inline-flex shrink-0 items-center leading-none">{selected.icon}</span> : null}
          <span className="min-w-0 flex-1 truncate leading-5">
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`material-symbols-outlined inline-flex h-5 w-5 shrink-0 items-center justify-center text-[20px] leading-none text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      {menu}
    </div>
  );
}
