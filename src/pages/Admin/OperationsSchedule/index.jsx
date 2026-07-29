import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import {
  fetchOperationsSchedule,
  getMovementStatusLabel,
  getMovementStatusTone,
  toOperationsScheduleDate,
} from "../../../services/operationsService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getTodayDateString } from "../../../utils/dateOnly";
import { notify } from "../../../utils/swalToast";
import { formatTripClock, tripClockSortMinutes } from "../../../utils/tripClock";

/** 0 = đang di chuyển, 1 = chưa chạy, 2 = hoàn tất, 3 = khác. */
const tripStatusSortRank = (trip) => {
  const key = String(trip?.movementStatus || trip?.operationStatus || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (
    [
      "moving", "bangdichuyen", "dangdichuyen", "inprogress", "ongoing", "running",
      "boarding", "dangchuanbi", "arriving", "sapcapben",
      "atstation", "arrived", "dacapben", "departed", "departing", "daroiben",
      "delayed", "tre",
    ].includes(key)
  ) {
    return 0;
  }
  if (["scheduled", "chuachay", "pending", "planned"].includes(key)) return 1;
  if (["completed", "hoantat", "finished"].includes(key)) return 2;
  return 3;
};

const SERVICE_FILTER_KEYS = ["bus", "sightseeing", "charter"];

/** Map trip → bus | sightseeing | charter để lọc multi-select. */
const resolveTripServiceKey = (trip) => {
  const blob = [
    trip?.serviceType,
    trip?.routeType,
    trip?.tripType,
    trip?.routeCode,
    trip?.routeName,
  ].map((v) => String(v || "").toLowerCase()).join(" ");
  if (blob.includes("charter") || blob.includes("thuê") || blob.includes("request")) return "charter";
  if (blob.includes("sight")) return "sightseeing";
  if (blob.includes("bus") || blob.includes("water") || blob.includes("booking") || blob.includes("regular")) {
    return "bus";
  }
  return "";
};

/** Select multi: ô vuông trong menu — chọn 1 hoặc nhiều loại dịch vụ. */
function ServiceTypeMultiSelect({
  options,
  selected,
  onChange,
  allLabel,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const isAll = selected.length === 0 || selected.length === options.length;

  const summary = useMemo(() => {
    if (isAll) return allLabel;
    const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
    return labels.join(", ") || allLabel;
  }, [allLabel, isAll, options, selected]);

  const updateMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    setMenuPos({
      left: Math.min(window.innerWidth - width - 8, Math.max(8, rect.left)),
      top: rect.bottom + 6,
      width,
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [isOpen]);

  const selectAll = () => onChange([]);

  const toggleOne = (value) => {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    const next = options.map((o) => o.value).filter((key) => set.has(key));
    onChange(next.length === options.length ? [] : next);
  };

  const menu = isOpen && menuPos
    ? createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          left: menuPos.left,
          top: menuPos.top,
          width: menuPos.width,
          zIndex: 9999,
        }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
      >
        <label className={`flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold transition ${
          isAll
            ? "bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        }`}>
          <input
            type="checkbox"
            checked={isAll}
            onChange={selectAll}
            className="h-4 w-4 rounded border-slate-300 text-[#124757] focus:ring-[#124757]"
          />
          <span className="min-w-0 flex-1">{allLabel}</span>
        </label>
        {options.map((opt) => {
          const checked = !isAll && selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold transition ${
                checked
                  ? "bg-[#124757]/10 text-[#124757] dark:bg-yellow-400/15 dark:text-yellow-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleOne(opt.value)}
                className="h-4 w-4 rounded border-slate-300 text-[#124757] focus:ring-[#124757]"
              />
              <span className="min-w-0 flex-1">{opt.label}</span>
            </label>
          );
        })}
      </div>,
      document.body,
    )
    : null;

  return (
    <div ref={rootRef} className={`relative w-full ${isOpen ? "z-[60]" : ""}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={`flex w-full min-w-0 items-center justify-between gap-1.5 overflow-hidden text-left ${className}`}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-bold leading-5">{summary}</span>
        <span
          aria-hidden
          className={`material-symbols-outlined inline-flex h-5 w-5 shrink-0 items-center justify-center text-[20px] leading-none text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>
      {menu}
    </div>
  );
}

/**
 * Lịch vận hành nội bộ (Admin / Manager / Staff).
 * GET /operations/schedule → click chuyến → trang sơ đồ ghế / manifest.
 */
export function OperationsSchedulePage() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const today = getTodayDateString();
  const [date, setDate] = useState(today);
  /** Multi-select: [] = tất cả; còn lại subset của bus|sightseeing|charter. */
  const [selectedServices, setSelectedServices] = useState([]);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const serviceChecks = useMemo(() => ([
    { value: "bus", label: "Waterbus" },
    { value: "sightseeing", label: "Sightseeing" },
    { value: "charter", label: lang === "VN" ? "Tàu thuê" : "Request booking" },
  ]), [lang]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const day = date || toOperationsScheduleDate();
      const selected = SERVICE_FILTER_KEYS.filter((key) => selectedServices.includes(key));
      const allSelected = selected.length === 0 || selected.length === SERVICE_FILTER_KEYS.length;

      // 1 loại → gửi serviceType cho BE; nhiều loại / tất cả → lấy full rồi lọc FE.
      const apiServiceType = !allSelected && selected.length === 1 ? selected[0] : undefined;
      const list = await fetchOperationsSchedule({
        fromDate: day,
        toDate: day,
        serviceType: apiServiceType,
        includeCancelled: false,
        skipAuth: false,
      });

      let rows = Array.isArray(list) ? list : [];
      if (!allSelected && selected.length > 1) {
        const allow = new Set(selected);
        rows = rows.filter((trip) => {
          const key = resolveTripServiceKey(trip);
          return key && allow.has(key);
        });
      }

      // Đang di chuyển → Chưa chạy → Hoàn tất; trong nhóm xếp theo giờ khởi hành.
      const sorted = [...rows].sort((a, b) => {
        const byStatus = tripStatusSortRank(a) - tripStatusSortRank(b);
        if (byStatus !== 0) return byStatus;
        return tripClockSortMinutes(a.displayStartAt || a.startAt)
          - tripClockSortMinutes(b.displayStartAt || b.startAt);
      });
      setEntries(sorted);
    } catch (error) {
      setEntries([]);
      setErrorMsg(
        getApiErrorMessage(
          error,
          lang === "VN" ? "Không tải được lịch vận hành." : "Unable to load operations schedule.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [date, selectedServices, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const openSeatBoard = (trip) => {
    const tripId = String(trip?.tripId || trip?.id || trip?.tripCode || "").trim();
    if (!tripId) {
      notify({
        toast: true,
        position: "top-end",
        icon: "warning",
        title: lang === "VN" ? "Thiếu mã chuyến" : "Missing trip id",
        text: lang === "VN"
          ? "Chuyến này không có tripId/tripCode để mở chi tiết."
          : "This trip has no tripId/tripCode to open details.",
        showConfirmButton: false,
        timer: 2500,
      });
      return;
    }
    navigate(`/admin/trips/${encodeURIComponent(tripId)}/seat-board?from=${encodeURIComponent("/admin/operations-schedule")}`);
  };

  return (
    <div className="space-y-5 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Vận hành nội bộ" : "Internal operations"}
        </p>
        <h2 className="mt-1 font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
          {lang === "VN" ? "Lịch vận hành / Manifest chuyến" : "Ops schedule / Trip manifest"}
        </h2>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[11rem]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {lang === "VN" ? "Ngày" : "Date"}
            </label>
            <AppDateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#124757] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="min-w-[14rem]">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {lang === "VN" ? "Loại dịch vụ" : "Service type"}
            </label>
            <ServiceTypeMultiSelect
              options={serviceChecks}
              selected={selectedServices}
              onChange={setSelectedServices}
              allLabel={lang === "VN" ? "Tất cả" : "All"}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        {isLoading ? (
          <div className="px-6 py-16 text-center text-xs text-slate-400">
            {lang === "VN" ? "Đang tải lịch vận hành…" : "Loading ops schedule…"}
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-16 text-center text-xs text-slate-400">
            {lang === "VN" ? "Không có chuyến trong ngày đã chọn." : "No trips on the selected day."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {entries.map((trip, index) => {
              const dest = trip.destinationStationName || trip.toLocation || "—";
              const status = trip.movementStatus || trip.operationStatus || "";
              const statusLabel = getMovementStatusLabel(status, lang) || status || "—";
              const stopCount = Array.isArray(trip.stops) ? trip.stops.length : 0;
              const meta = [trip.boatCode, trip.routeName || trip.routeCode]
                .filter(Boolean)
                .join(" · ");
              const rowKey = String(
                trip.tripId
                || trip.tripCode
                || `${trip.boatCode || "boat"}-${trip.displayStartAt || trip.startAt || index}`,
              );

              return (
                <li key={rowKey}>
                  <button
                    type="button"
                    onClick={() => openSeatBoard(trip)}
                    className="grid w-full cursor-pointer grid-cols-[5.5rem_1fr_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40 sm:gap-4 sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="font-headline text-base font-black tabular-nums leading-tight text-[#124757] dark:text-yellow-400 sm:text-lg">
                        {formatTripClock(trip.displayStartAt || trip.startAt)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold tabular-nums text-slate-400">
                        → {formatTripClock(trip.displayEndAt || trip.endAt)}
                      </p>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                        {(trip.fromLocation || "—")} → {dest}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wide ${getMovementStatusTone(status)}`}>
                          {statusLabel}
                        </span>
                        {trip.tripCode ? (
                          <span className="truncate text-[10px] font-bold text-slate-400">
                            {trip.tripCode}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] font-medium text-slate-400">
                        {meta || "—"}
                        {stopCount > 0 ? ` · ${stopCount} ${lang === "VN" ? "bến" : "stops"}` : ""}
                      </p>
                    </div>

                    <span className="hidden shrink-0 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] sm:inline dark:text-yellow-400">
                      {lang === "VN" ? "Chi tiết →" : "Open →"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
