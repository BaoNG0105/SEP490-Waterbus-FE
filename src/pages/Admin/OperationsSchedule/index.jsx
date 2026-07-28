import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { FormSelect } from "../../../components/FormSelect";
import {
  fetchOperationsSchedule,
  getMovementStatusLabel,
  toOperationsScheduleDate,
} from "../../../services/operationsService";
import { getApiErrorMessage } from "../../../utils/apiError";
import { getTodayDateString } from "../../../utils/dateOnly";

const pad = (n) => String(n).padStart(2, "0");

const formatClock = (iso) => {
  if (!iso) return "--:--";
  const ms = Date.parse(String(iso));
  if (Number.isNaN(ms)) {
    const m = String(iso).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "--:--";
  }
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Lịch vận hành nội bộ (Admin / Manager / Staff).
 * GET /operations/schedule → click chuyến → trang sơ đồ ghế / manifest.
 */
export function OperationsSchedulePage() {
  const { lang } = useApp();
  const navigate = useNavigate();
  const today = getTodayDateString();
  const [date, setDate] = useState(today);
  const [serviceType, setServiceType] = useState("all");
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const serviceOptions = useMemo(() => ([
    { value: "all", label: lang === "VN" ? "Tất cả" : "All" },
    { value: "booking", label: lang === "VN" ? "Bus + Sightseeing" : "Bus + Sightseeing" },
    { value: "bus", label: "Bus" },
    { value: "sightseeing", label: "Sightseeing" },
    { value: "charter", label: "Charter" },
  ]), [lang]);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg("");
      const day = date || toOperationsScheduleDate();
      const list = await fetchOperationsSchedule({
        fromDate: day,
        toDate: day,
        serviceType: serviceType === "all" ? undefined : serviceType,
        includeCancelled: false,
        skipAuth: false,
      });
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        const aMs = Date.parse(String(a.displayStartAt || a.startAt || "")) || 0;
        const bMs = Date.parse(String(b.displayStartAt || b.startAt || "")) || 0;
        return aMs - bMs;
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
  }, [date, serviceType, lang]);

  useEffect(() => {
    load();
  }, [load]);

  const openSeatBoard = (trip) => {
    const tripId = String(trip?.tripId || "").trim();
    if (!tripId) return;
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
        <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500 dark:text-slate-300">
          {lang === "VN"
            ? "Admin / Manager / Staff: xem lịch trong ngày, bấm chuyến để mở trang sơ đồ ghế theo bến (xuống / lên / đi tiếp) và danh sách khách."
            : "Admin / Manager / Staff: day schedule; open a trip for the full-page station seat board and passenger list."}
        </p>

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
              serviceType
            </label>
            <FormSelect
              value={serviceType}
              onChange={setServiceType}
              options={serviceOptions}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FFD100] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-2xl bg-[#124757] px-5 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
          >
            {lang === "VN" ? "Tải lại" : "Refresh"}
          </button>
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
            {entries.map((trip) => {
              const dest = trip.destinationStationName || trip.toLocation || "—";
              const status = trip.movementStatus || trip.operationStatus || "";
              const stopCount = Array.isArray(trip.stops) ? trip.stops.length : 0;
              return (
                <li key={String(trip.tripId || trip.tripCode || Math.random())}>
                  <button
                    type="button"
                    onClick={() => openSeatBoard(trip)}
                    className="flex w-full flex-col gap-2 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-yellow-400">
                          {formatClock(trip.displayStartAt || trip.startAt)}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-yellow-400">
                          {formatClock(trip.displayEndAt || trip.endAt)}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                          {trip.tripCode || "—"}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {(trip.fromLocation || "—")} → <span className="text-[#124757] dark:text-yellow-400">{dest}</span>
                      </p>
                      <p className="text-[11px] font-medium text-slate-400">
                        {[trip.boatCode, trip.routeName || trip.routeCode].filter(Boolean).join(" · ") || "—"}
                        {stopCount > 0 ? ` · ${stopCount} ${lang === "VN" ? "bến" : "stops"}` : ""}
                      </p>
                      {stopCount > 0 ? (
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {trip.stops.map((s) => s.stationName || s.stationCode).filter(Boolean).join(" → ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="text-[10px] font-headline font-black uppercase tracking-wider text-slate-500">
                        {getMovementStatusLabel(status, lang) || status || "—"}
                      </span>
                      <span className="text-[11px] font-bold text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Sơ đồ ghế / khách →" : "Seat board / passengers →"}
                      </span>
                    </div>
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
